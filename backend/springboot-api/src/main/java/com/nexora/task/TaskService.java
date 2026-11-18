package com.nexora.task;

import com.nexora.activity.ActivityService;
import com.nexora.common.ApiException;
import com.nexora.common.Jsons;
import com.nexora.events.RealtimeEvent;
import com.nexora.insights.InsightsCache;
import com.nexora.notification.NotificationService;
import com.nexora.project.*;
import com.nexora.security.AuthUser;
import com.nexora.user.UserDirectory;
import com.nexora.workflow.TriggerType;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class TaskService {

    static final double POSITION_GAP = 1024;

    private final TaskRepository tasks;
    private final ProjectRepository projects;
    private final ProjectMemberRepository members;
    private final MilestoneRepository milestones;
    private final ProjectAccess access;
    private final TaskMapper mapper;
    private final ActivityService activity;
    private final NotificationService notifications;
    private final ApplicationEventPublisher events;
    private final UserDirectory directory;
    private final InsightsCache insightsCache;

    public TaskService(TaskRepository tasks, ProjectRepository projects, ProjectMemberRepository members,
                       MilestoneRepository milestones, ProjectAccess access, TaskMapper mapper,
                       ActivityService activity, NotificationService notifications,
                       ApplicationEventPublisher events, UserDirectory directory, InsightsCache insightsCache) {
        this.tasks = tasks;
        this.projects = projects;
        this.members = members;
        this.milestones = milestones;
        this.access = access;
        this.mapper = mapper;
        this.activity = activity;
        this.notifications = notifications;
        this.events = events;
        this.directory = directory;
        this.insightsCache = insightsCache;
    }

    // ── Queries ──────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<TaskDtos.TaskDto> board(Long projectId, AuthUser me) {
        Project p = access.require(projectId, me, ProjectAccess.Level.READ);
        return mapper.toDtos(tasks.findByProjectIdOrderByStatusAscPositionAsc(p.getId()), Map.of(p.getId(), p));
    }

    @Transactional(readOnly = true)
    public List<TaskDtos.TaskDto> mine(AuthUser me) {
        Map<Long, Project> visible = access.visibleProjects(me).stream()
                .collect(Collectors.toMap(Project::getId, Function.identity()));
        List<Task> list = tasks.findByAssigneeIdAndStatusNotOrderByDueDateAsc(me.id(), TaskStatus.DONE).stream()
                .filter(t -> visible.containsKey(t.getProjectId()))
                .sorted(Comparator.comparing(Task::getDueDate, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(t -> -t.getPriority().rank()))
                .toList();
        return mapper.toDtos(list, visible);
    }

    @Transactional(readOnly = true)
    public TaskDtos.TaskDto get(Long taskId, AuthUser me) {
        Task t = load(taskId);
        Project p = access.require(t.getProjectId(), me, ProjectAccess.Level.READ);
        return mapper.toDto(t, p);
    }

    // ── Commands (user initiated) ────────────────────────────────────────

    @Transactional
    public TaskDtos.TaskDto create(Long projectId, TaskDtos.CreateTaskRequest req, AuthUser me) {
        access.require(projectId, me, ProjectAccess.Level.WRITE);
        Project p = projects.lockById(projectId).orElseThrow(() -> ApiException.notFound("Project"));
        validateAssignee(p, req.assigneeId());
        validateMilestone(p, req.milestoneId());

        p.setTaskSequence(p.getTaskSequence() + 1);
        Task t = new Task();
        t.setProjectId(p.getId());
        t.setTaskNumber(p.getTaskSequence());
        t.setTitle(req.title().trim());
        t.setDescription(req.description());
        TaskStatus status = req.status() == null ? TaskStatus.TODO : req.status();
        t.setStatus(TaskStatus.TODO);
        t.changeStatus(status);
        t.setPriority(req.priority());
        t.setAssigneeId(req.assigneeId());
        t.setReporterId(me.id());
        t.setMilestoneId(req.milestoneId());
        t.setStoryPoints(req.storyPoints());
        t.setDueDate(req.dueDate());
        t.setPosition(tasks.maxPosition(p.getId(), status) + POSITION_GAP);
        tasks.save(t);
        setDependencies(p, t, req.dependsOn());

        String key = p.getKey() + "-" + t.getTaskNumber();
        activity.record(me.organizationId(), p.getId(), me.id(), "TASK_CREATED", "TASK", t.getId(),
                me.fullName() + " created " + key + " · " + t.getTitle(), Jsons.map("status", status.name()));
        TaskDtos.TaskDto dto = mapper.toDto(t, p);
        events.publishEvent(RealtimeEvent.toProject("task.created", me.organizationId(), p.getId(), dto));
        if (t.getAssigneeId() != null) {
            notifications.notify(me.organizationId(), t.getAssigneeId(), me.id(), "TASK_ASSIGNED",
                    me.fullName() + " assigned you " + key, t.getTitle(), link(p, t));
        }
        events.publishEvent(new TaskDomainEvent(TriggerType.TASK_CREATED, me.organizationId(), p.getId(), t.getId(), me.id(), null));
        if (t.getAssigneeId() != null) {
            events.publishEvent(new TaskDomainEvent(TriggerType.TASK_ASSIGNED, me.organizationId(), p.getId(), t.getId(), me.id(), null));
        }
        insightsCache.evict(p.getId());
        return dto;
    }

    @Transactional
    public TaskDtos.TaskDto update(Long taskId, TaskDtos.UpdateTaskRequest req, AuthUser me) {
        Task t = load(taskId);
        Project p = access.require(t.getProjectId(), me, ProjectAccess.Level.WRITE);
        if (req.version() != t.getVersion()) {
            throw ApiException.conflict("STALE_UPDATE", "Someone else changed this task. Reload to see their changes.");
        }
        validateAssignee(p, req.assigneeId());
        validateMilestone(p, req.milestoneId());
        if (req.status() == TaskStatus.BLOCKED && (req.blockedReason() == null || req.blockedReason().isBlank())) {
            throw ApiException.badRequest("BLOCKED_REASON_REQUIRED", "Say what is blocking this task");
        }

        List<String> changes = new ArrayList<>();
        TaskStatus oldStatus = t.getStatus();
        Long oldAssignee = t.getAssigneeId();
        if (!Objects.equals(t.getTitle(), req.title().trim())) changes.add("title");
        if (!Objects.equals(t.getDescription(), req.description())) changes.add("description");
        if (t.getPriority() != req.priority()) changes.add("priority → " + req.priority());
        if (!Objects.equals(t.getStoryPoints(), req.storyPoints())) changes.add("points → " + req.storyPoints());
        if (!Objects.equals(t.getDueDate(), req.dueDate())) changes.add("due date → " + req.dueDate());
        if (!Objects.equals(t.getMilestoneId(), req.milestoneId())) changes.add("milestone");

        t.setTitle(req.title().trim());
        t.setDescription(req.description());
        t.setPriority(req.priority());
        t.setStoryPoints(req.storyPoints());
        t.setDueDate(req.dueDate());
        t.setMilestoneId(req.milestoneId());
        t.setAssigneeId(req.assigneeId());
        if (oldStatus != req.status()) {
            t.changeStatus(req.status());
            t.setPosition(tasks.maxPosition(p.getId(), req.status()) + POSITION_GAP);
            changes.add("status " + oldStatus + " → " + req.status());
        }
        if (req.status() == TaskStatus.BLOCKED) t.setBlockedReason(req.blockedReason().trim());
        if (req.dependsOn() != null) setDependencies(p, t, req.dependsOn());
        if (!Objects.equals(oldAssignee, req.assigneeId())) {
            changes.add("assignee → " + (req.assigneeId() == null ? "nobody" : directory.ref(req.assigneeId()).fullName()));
        }
        tasks.saveAndFlush(t);

        afterChange(p, t, me, oldStatus, oldAssignee, changes);
        return mapper.toDto(t, p);
    }

    @Transactional
    public TaskDtos.TaskDto move(Long taskId, TaskDtos.MoveTaskRequest req, AuthUser me) {
        Task t = load(taskId);
        Project p = access.require(t.getProjectId(), me, ProjectAccess.Level.WRITE);
        if (req.position().isNaN() || req.position().isInfinite()) {
            throw ApiException.badRequest("INVALID_POSITION", "Position must be a finite number");
        }
        if (req.status() == TaskStatus.BLOCKED && t.getStatus() != TaskStatus.BLOCKED) {
            t.setBlockedReason("Moved to Blocked on the board");
        }
        TaskStatus oldStatus = t.getStatus();
        t.changeStatus(req.status());
        if (req.status() == TaskStatus.BLOCKED && t.getBlockedReason() == null) t.setBlockedReason("Moved to Blocked on the board");
        t.setPosition(req.position());
        tasks.saveAndFlush(t);
        List<String> changes = oldStatus == req.status() ? List.of() : List.of("status " + oldStatus + " → " + req.status());
        afterChange(p, t, me, oldStatus, t.getAssigneeId(), changes);
        return mapper.toDto(t, p);
    }

    @Transactional
    public void delete(Long taskId, AuthUser me) {
        Task t = load(taskId);
        Project p = access.require(t.getProjectId(), me, ProjectAccess.Level.WRITE);
        if (!me.id().equals(t.getReporterId())) {
            access.require(p.getId(), me, ProjectAccess.Level.MANAGE);
        }
        String key = p.getKey() + "-" + t.getTaskNumber();
        tasks.delete(t);
        activity.record(me.organizationId(), p.getId(), me.id(), "TASK_DELETED", "TASK", t.getId(),
                me.fullName() + " deleted " + key + " · " + t.getTitle(), null);
        events.publishEvent(RealtimeEvent.toProject("task.deleted", me.organizationId(), p.getId(),
                Jsons.map("id", t.getId(), "projectId", p.getId())));
        insightsCache.evict(p.getId());
    }

    /** One-click actions from the insights panels (priority recommendation, workload rebalancing). */
    @Transactional
    public TaskDtos.TaskDto changePriority(Long taskId, TaskPriority priority, AuthUser me) {
        Task t = load(taskId);
        Project p = access.require(t.getProjectId(), me, ProjectAccess.Level.WRITE);
        TaskPriority old = t.getPriority();
        if (old == priority) return mapper.toDto(t, p);
        t.setPriority(priority);
        tasks.saveAndFlush(t);
        afterChange(p, t, me, t.getStatus(), t.getAssigneeId(), List.of("priority " + old + " → " + priority + " (recommended)"));
        return mapper.toDto(t, p);
    }

    @Transactional
    public TaskDtos.TaskDto reassign(Long taskId, Long userId, AuthUser me) {
        Task t = load(taskId);
        Project p = access.require(t.getProjectId(), me, ProjectAccess.Level.MANAGE);
        validateAssignee(p, userId);
        Long old = t.getAssigneeId();
        t.setAssigneeId(userId);
        tasks.saveAndFlush(t);
        afterChange(p, t, me, t.getStatus(), old, List.of("assignee → " + directory.ref(userId).fullName() + " (workload rebalance)"));
        return mapper.toDto(t, p);
    }

    // ── Commands used by the workflow engine (no workflow re-triggering) ─

    @Transactional
    public void automationSetPriority(Task t, TaskPriority priority, String workflowName) {
        if (t.getPriority() == priority) return;
        TaskPriority old = t.getPriority();
        t.setPriority(priority);
        automationChanged(t, workflowName, "priority " + old + " → " + priority);
    }

    @Transactional
    public void automationSetStatus(Task t, TaskStatus status, String workflowName) {
        if (t.getStatus() == status) return;
        TaskStatus old = t.getStatus();
        t.changeStatus(status);
        if (status == TaskStatus.BLOCKED) t.setBlockedReason("Blocked by workflow \"" + workflowName + "\"");
        t.setPosition(tasks.maxPosition(t.getProjectId(), status) + POSITION_GAP);
        automationChanged(t, workflowName, "status " + old + " → " + status);
    }

    @Transactional
    public void automationAssign(Task t, Long userId, String workflowName) {
        if (Objects.equals(t.getAssigneeId(), userId)) return;
        Project p = projects.findById(t.getProjectId()).orElseThrow();
        if (!members.existsByIdProjectIdAndIdUserId(p.getId(), userId)) {
            throw new IllegalArgumentException("User " + userId + " is not a member of " + p.getKey());
        }
        t.setAssigneeId(userId);
        automationChanged(t, workflowName, "assignee → " + directory.ref(userId).fullName());
        notifications.notify(p.getOrganizationId(), userId, null, "TASK_ASSIGNED",
                "Workflow \"" + workflowName + "\" assigned you " + p.getKey() + "-" + t.getTaskNumber(), t.getTitle(), link(p, t));
    }

    private void automationChanged(Task t, String workflowName, String change) {
        tasks.saveAndFlush(t);
        Project p = projects.findById(t.getProjectId()).orElseThrow();
        String key = p.getKey() + "-" + t.getTaskNumber();
        activity.record(p.getOrganizationId(), p.getId(), null, "AUTOMATION", "TASK", t.getId(),
                "⚡ " + workflowName + " changed " + key + ": " + change, Jsons.map("workflow", workflowName));
        events.publishEvent(RealtimeEvent.toProject("task.updated", p.getOrganizationId(), p.getId(), mapper.toDto(t, p)));
        insightsCache.evict(p.getId());
    }

    // ── helpers ───────────────────────────────────────────────────────────

    public Task load(Long taskId) {
        return tasks.findById(taskId).orElseThrow(() -> ApiException.notFound("Task"));
    }

    private void afterChange(Project p, Task t, AuthUser me, TaskStatus oldStatus, Long oldAssignee, List<String> changes) {
        String key = p.getKey() + "-" + t.getTaskNumber();
        if (!changes.isEmpty()) {
            activity.record(me.organizationId(), p.getId(), me.id(),
                    oldStatus != t.getStatus() ? "TASK_STATUS" : "TASK_UPDATED", "TASK", t.getId(),
                    me.fullName() + " updated " + key + ": " + String.join(", ", changes),
                    Jsons.map("from", oldStatus.name(), "to", t.getStatus().name()));
        }
        events.publishEvent(RealtimeEvent.toProject("task.updated", me.organizationId(), p.getId(), mapper.toDto(t, p)));

        if (!Objects.equals(oldAssignee, t.getAssigneeId()) && t.getAssigneeId() != null) {
            notifications.notify(me.organizationId(), t.getAssigneeId(), me.id(), "TASK_ASSIGNED",
                    me.fullName() + " assigned you " + key, t.getTitle(), link(p, t));
            events.publishEvent(new TaskDomainEvent(TriggerType.TASK_ASSIGNED, me.organizationId(), p.getId(), t.getId(), me.id(), null));
        }
        if (oldStatus != t.getStatus()) {
            if (t.getStatus() == TaskStatus.DONE && t.getReporterId() != null) {
                notifications.notify(me.organizationId(), t.getReporterId(), me.id(), "TASK_COMPLETED",
                        me.fullName() + " completed " + key, t.getTitle(), link(p, t));
            }
            events.publishEvent(new TaskDomainEvent(TriggerType.TASK_STATUS_CHANGED, me.organizationId(), p.getId(),
                    t.getId(), me.id(), oldStatus.name()));
        }
        insightsCache.evict(p.getId());
    }

    private void validateAssignee(Project p, Long assigneeId) {
        if (assigneeId != null && !members.existsByIdProjectIdAndIdUserId(p.getId(), assigneeId)) {
            throw ApiException.badRequest("INVALID_ASSIGNEE", "The assignee must be a member of this project");
        }
    }

    private void validateMilestone(Project p, Long milestoneId) {
        if (milestoneId != null && milestones.findByIdAndProjectId(milestoneId, p.getId()).isEmpty()) {
            throw ApiException.badRequest("INVALID_MILESTONE", "That milestone doesn't belong to this project");
        }
    }

    /** Replaces the task's dependencies after checking project scope and that no cycle is created. */
    private void setDependencies(Project p, Task t, List<Long> dependsOn) {
        if (dependsOn == null) return;
        Set<Long> wanted = new LinkedHashSet<>(dependsOn);
        if (wanted.contains(t.getId())) throw ApiException.badRequest("INVALID_DEPENDENCY", "A task can't depend on itself");
        Map<Long, Task> projectTasks = tasks.findByProjectId(p.getId()).stream()
                .collect(Collectors.toMap(Task::getId, Function.identity()));
        for (Long id : wanted) {
            if (!projectTasks.containsKey(id)) {
                throw ApiException.badRequest("INVALID_DEPENDENCY", "Dependencies must be tasks in the same project");
            }
        }
        // Cycle check: walking from each wanted dependency must never reach t.
        Deque<Long> stack = new ArrayDeque<>(wanted);
        Set<Long> seen = new HashSet<>();
        while (!stack.isEmpty()) {
            Long cur = stack.pop();
            if (cur.equals(t.getId())) {
                throw ApiException.badRequest("DEPENDENCY_CYCLE", "That dependency would create a cycle");
            }
            if (seen.add(cur)) {
                Task ct = projectTasks.get(cur);
                if (ct != null) ct.getDependsOn().forEach(stack::push);
            }
        }
        t.getDependsOn().clear();
        t.getDependsOn().addAll(wanted);
    }

    static String link(Project p, Task t) {
        return "/projects/" + p.getId() + "/board?task=" + t.getId();
    }
}
