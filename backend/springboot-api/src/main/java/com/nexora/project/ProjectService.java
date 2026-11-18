package com.nexora.project;

import com.nexora.activity.ActivityService;
import com.nexora.audit.AuditService;
import com.nexora.common.ApiException;
import com.nexora.common.Jsons;
import com.nexora.events.RealtimeEvent;
import com.nexora.organization.PlanLimits;
import com.nexora.security.AuthUser;
import com.nexora.task.Task;
import com.nexora.task.TaskRepository;
import com.nexora.task.TaskStatus;
import com.nexora.user.User;
import com.nexora.user.UserDirectory;
import com.nexora.user.UserRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ProjectService {

    private final ProjectRepository projects;
    private final ProjectMemberRepository members;
    private final MilestoneRepository milestones;
    private final TaskRepository tasks;
    private final UserRepository users;
    private final UserDirectory directory;
    private final ProjectAccess access;
    private final PlanLimits limits;
    private final ActivityService activity;
    private final AuditService audit;
    private final ApplicationEventPublisher events;

    public ProjectService(ProjectRepository projects, ProjectMemberRepository members, MilestoneRepository milestones,
                          TaskRepository tasks, UserRepository users, UserDirectory directory, ProjectAccess access,
                          PlanLimits limits, ActivityService activity, AuditService audit, ApplicationEventPublisher events) {
        this.projects = projects;
        this.members = members;
        this.milestones = milestones;
        this.tasks = tasks;
        this.users = users;
        this.directory = directory;
        this.access = access;
        this.limits = limits;
        this.activity = activity;
        this.audit = audit;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public List<ProjectDtos.ProjectSummary> list(AuthUser me, boolean includeArchived) {
        List<Project> list = new ArrayList<>(access.visibleProjects(me));
        if (includeArchived && me.seesAllOrgProjects()) {
            projects.findByOrganizationIdAndStatusNotOrderByNameAsc(me.organizationId(), "__none__").stream()
                    .filter(p -> "ARCHIVED".equals(p.getStatus())).forEach(list::add);
        }
        return list.stream().map(p -> summary(p, me)).toList();
    }

    @Transactional(readOnly = true)
    public ProjectDtos.ProjectDetail get(Long id, AuthUser me) {
        Project p = access.require(id, me, ProjectAccess.Level.READ);
        return detail(p, me);
    }

    @Transactional
    public ProjectDtos.ProjectDetail create(ProjectDtos.CreateProjectRequest req, AuthUser me) {
        if (!me.can("PROJECT_CREATE")) throw ApiException.forbidden("You can't create projects");
        String key = req.key().toUpperCase(Locale.ROOT);
        if (projects.existsByOrganizationIdAndKey(me.organizationId(), key)) {
            throw ApiException.conflict("KEY_TAKEN", "Another project already uses the key " + key);
        }
        validateDates(req.startDate(), req.dueDate());
        limits.checkProjects(me.organizationId());

        Project p = new Project();
        p.setOrganizationId(me.organizationId());
        p.setKey(key);
        p.setName(req.name().trim());
        p.setDescription(req.description());
        p.setColor(req.color().toUpperCase(Locale.ROOT));
        p.setOwnerId(me.id());
        p.setStartDate(req.startDate());
        p.setDueDate(req.dueDate());
        projects.save(p);
        members.save(new ProjectMember(p.getId(), me.id(), "OWNER"));
        if (req.memberIds() != null) {
            for (Long uid : new LinkedHashSet<>(req.memberIds())) {
                if (uid.equals(me.id())) continue;
                User u = users.findByIdAndOrganizationId(uid, me.organizationId())
                        .orElseThrow(() -> ApiException.badRequest("INVALID_MEMBER", "User " + uid + " is not in your organisation"));
                members.save(new ProjectMember(p.getId(), u.getId(), "CONTRIBUTOR"));
            }
        }
        activity.record(me.organizationId(), p.getId(), me.id(), "PROJECT_CREATED", "PROJECT", p.getId(),
                me.fullName() + " created project " + p.getName(), null);
        audit.log("PROJECT_CREATED", "PROJECT", p.getId(), Jsons.map("key", key, "name", p.getName()));
        events.publishEvent(RealtimeEvent.toOrg("project.changed", me.organizationId(), Jsons.map("projectId", p.getId())));
        return detail(p, me);
    }

    @Transactional
    public ProjectDtos.ProjectDetail update(Long id, ProjectDtos.UpdateProjectRequest req, AuthUser me) {
        Project p = access.require(id, me, ProjectAccess.Level.MANAGE);
        validateDates(req.startDate(), req.dueDate());
        if ("ARCHIVED".equals(p.getStatus()) && !"ARCHIVED".equals(req.status())) {
            limits.checkProjects(me.organizationId());
        }
        String oldStatus = p.getStatus();
        p.setName(req.name().trim());
        p.setDescription(req.description());
        p.setColor(req.color().toUpperCase(Locale.ROOT));
        p.setStatus(req.status());
        p.setStartDate(req.startDate());
        p.setDueDate(req.dueDate());
        if (!oldStatus.equals(req.status())) {
            activity.record(me.organizationId(), p.getId(), me.id(), "PROJECT_STATUS", "PROJECT", p.getId(),
                    me.fullName() + " changed " + p.getName() + " from " + oldStatus + " to " + req.status(), null);
            audit.log("PROJECT_STATUS_CHANGED", "PROJECT", p.getId(), Jsons.map("from", oldStatus, "to", req.status()));
        }
        events.publishEvent(RealtimeEvent.toOrg("project.changed", me.organizationId(), Jsons.map("projectId", p.getId())));
        return detail(p, me);
    }

    @Transactional
    public ProjectDtos.ProjectDetail addMember(Long projectId, ProjectDtos.AddMemberRequest req, AuthUser me) {
        Project p = access.require(projectId, me, ProjectAccess.Level.MANAGE);
        User u = users.findByIdAndOrganizationId(req.userId(), me.organizationId())
                .orElseThrow(() -> ApiException.notFound("User"));
        if (members.existsByIdProjectIdAndIdUserId(p.getId(), u.getId())) {
            throw ApiException.conflict("ALREADY_MEMBER", u.getFullName() + " is already on this project");
        }
        members.save(new ProjectMember(p.getId(), u.getId(), req.projectRole()));
        activity.record(me.organizationId(), p.getId(), me.id(), "MEMBER_ADDED", "PROJECT", p.getId(),
                me.fullName() + " added " + u.getFullName() + " to " + p.getName(), null);
        return detail(p, me);
    }

    @Transactional
    public ProjectDtos.ProjectDetail updateMember(Long projectId, Long userId, ProjectDtos.UpdateMemberRequest req, AuthUser me) {
        Project p = access.require(projectId, me, ProjectAccess.Level.MANAGE);
        ProjectMember m = members.findById(new ProjectMemberId(p.getId(), userId)).orElseThrow(() -> ApiException.notFound("Member"));
        if (userId.equals(p.getOwnerId()) && !"OWNER".equals(req.projectRole())) {
            throw ApiException.badRequest("OWNER_ROLE", "The project owner must keep the OWNER role");
        }
        m.setProjectRole(req.projectRole());
        return detail(p, me);
    }

    @Transactional
    public ProjectDtos.ProjectDetail removeMember(Long projectId, Long userId, AuthUser me) {
        Project p = access.require(projectId, me, ProjectAccess.Level.MANAGE);
        if (userId.equals(p.getOwnerId())) throw ApiException.badRequest("OWNER_REMOVAL", "You can't remove the project owner");
        ProjectMember m = members.findById(new ProjectMemberId(p.getId(), userId)).orElseThrow(() -> ApiException.notFound("Member"));
        members.delete(m);
        // Unassign their open tasks in this project so nothing is silently owned by a non-member.
        tasks.findByProjectId(p.getId()).stream()
                .filter(t -> userId.equals(t.getAssigneeId()) && t.isOpen())
                .forEach(t -> t.setAssigneeId(null));
        activity.record(me.organizationId(), p.getId(), me.id(), "MEMBER_REMOVED", "PROJECT", p.getId(),
                me.fullName() + " removed " + directory.ref(userId).fullName() + " from " + p.getName(), null);
        return detail(p, me);
    }

    @Transactional
    public ProjectDtos.MilestoneDto saveMilestone(Long projectId, Long milestoneId, ProjectDtos.MilestoneRequest req, AuthUser me) {
        Project p = access.require(projectId, me, ProjectAccess.Level.MANAGE);
        Milestone m = milestoneId == null ? new Milestone()
                : milestones.findByIdAndProjectId(milestoneId, p.getId()).orElseThrow(() -> ApiException.notFound("Milestone"));
        boolean created = m.getId() == null;
        m.setProjectId(p.getId());
        m.setName(req.name().trim());
        m.setDescription(req.description());
        m.setDueDate(req.dueDate());
        m.setCompleted(req.completed());
        milestones.save(m);
        activity.record(me.organizationId(), p.getId(), me.id(), created ? "MILESTONE_CREATED" : "MILESTONE_UPDATED",
                "MILESTONE", m.getId(), me.fullName() + (created ? " added milestone " : " updated milestone ") + m.getName(), null);
        return milestoneDto(m, tasks.findByProjectId(p.getId()));
    }

    @Transactional
    public void deleteMilestone(Long projectId, Long milestoneId, AuthUser me) {
        Project p = access.require(projectId, me, ProjectAccess.Level.MANAGE);
        Milestone m = milestones.findByIdAndProjectId(milestoneId, p.getId()).orElseThrow(() -> ApiException.notFound("Milestone"));
        milestones.delete(m);
    }

    // ── mapping ────────────────────────────────────────────────────────

    ProjectDtos.ProjectSummary summary(Project p, AuthUser me) {
        List<Task> all = tasks.findByProjectId(p.getId());
        int done = (int) all.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
        int progress = all.isEmpty() ? 0 : Math.round(done * 100f / all.size());
        return new ProjectDtos.ProjectSummary(p.getId(), p.getKey(), p.getName(), p.getDescription(), p.getStatus(),
                p.getColor(), directory.ref(p.getOwnerId()), p.getStartDate(), p.getDueDate(),
                (int) members.countByIdProjectId(p.getId()), all.size(), done, all.size() - done, progress,
                access.roleOf(p.getId(), me.id()), p.getCreatedAt());
    }

    private ProjectDtos.ProjectDetail detail(Project p, AuthUser me) {
        List<ProjectMember> ms = members.findByIdProjectId(p.getId());
        Map<Long, User> userMap = users.findByIdIn(ms.stream().map(ProjectMember::userId).toList()).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        List<ProjectDtos.MemberDto> memberDtos = ms.stream()
                .filter(m -> userMap.containsKey(m.userId()))
                .map(m -> {
                    User u = userMap.get(m.userId());
                    return new ProjectDtos.MemberDto(UserDirectory.UserRef.of(u), m.getProjectRole(), u.getCapacityPoints(), m.getJoinedAt());
                })
                .sorted(Comparator.comparing(d -> d.user().fullName()))
                .toList();
        List<Task> all = tasks.findByProjectId(p.getId());
        List<ProjectDtos.MilestoneDto> ml = milestones.findByProjectIdOrderByDueDateAsc(p.getId()).stream()
                .map(m -> milestoneDto(m, all)).toList();
        return new ProjectDtos.ProjectDetail(summary(p, me), memberDtos, ml);
    }

    private static ProjectDtos.MilestoneDto milestoneDto(Milestone m, List<Task> all) {
        List<Task> in = all.stream().filter(t -> m.getId().equals(t.getMilestoneId())).toList();
        int done = (int) in.stream().filter(t -> t.getStatus() == TaskStatus.DONE).count();
        return new ProjectDtos.MilestoneDto(m.getId(), m.getName(), m.getDescription(), m.getDueDate(), m.isCompleted(),
                in.size(), done);
    }

    private static void validateDates(java.time.LocalDate start, java.time.LocalDate due) {
        if (due != null && due.isBefore(start)) {
            throw ApiException.badRequest("INVALID_DATES", "Due date must be on or after the start date");
        }
    }
}
