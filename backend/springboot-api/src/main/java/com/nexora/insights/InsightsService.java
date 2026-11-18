package com.nexora.insights;

import com.nexora.common.ApiException;
import com.nexora.project.*;
import com.nexora.security.AuthUser;
import com.nexora.settings.SettingsService;
import com.nexora.task.*;
import com.nexora.user.User;
import com.nexora.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class InsightsService {

    private final ProjectAccess access;
    private final TaskRepository tasks;
    private final ProjectMemberRepository members;
    private final MilestoneRepository milestones;
    private final UserRepository users;
    private final SettingsService settings;
    private final InsightsCache cache;
    private final TaskService taskService;

    public InsightsService(ProjectAccess access, TaskRepository tasks, ProjectMemberRepository members,
                           MilestoneRepository milestones, UserRepository users, SettingsService settings,
                           InsightsCache cache, TaskService taskService) {
        this.access = access;
        this.tasks = tasks;
        this.members = members;
        this.milestones = milestones;
        this.users = users;
        this.settings = settings;
        this.cache = cache;
        this.taskService = taskService;
    }

    public record PortfolioItem(Long projectId, String key, String name, String color, String status, int score,
                                String risk, String forecast, int progressPercent, int openTasks, int overdueTasks) {
    }

    @Transactional(readOnly = true)
    public HealthCalculator.HealthReport health(Long projectId, AuthUser me) {
        Project p = access.require(projectId, me, ProjectAccess.Level.READ);
        return cache.health(p.getId(), () -> computeHealth(p));
    }

    @Transactional(readOnly = true)
    public List<PortfolioItem> portfolio(AuthUser me) {
        return access.visibleProjects(me).stream().map(p -> {
            HealthCalculator.HealthReport r = cache.health(p.getId(), () -> computeHealth(p));
            return new PortfolioItem(p.getId(), p.getKey(), p.getName(), p.getColor(), p.getStatus(), r.score(), r.risk(),
                    r.forecast().message(), r.stats().progressPercent(), r.stats().openTasks(), r.stats().overdueTasks());
        }).sorted(Comparator.comparingInt(PortfolioItem::score)).toList();
    }

    @Transactional(readOnly = true)
    public List<PriorityRecommender.Recommendation> recommendations(Long projectId, AuthUser me) {
        Project p = access.require(projectId, me, ProjectAccess.Level.READ);
        List<TaskFacts> facts = tasks.findByProjectId(p.getId()).stream().map(t -> TaskFacts.of(t, p.getKey())).toList();
        Map<Long, Integer> blocking = new HashMap<>();
        tasks.blockingCounts(p.getId()).forEach(row ->
                blocking.put(((Number) row[0]).longValue(), ((Number) row[1]).intValue()));
        Map<Long, LocalDate> milestoneDue = milestones.findByProjectIdOrderByDueDateAsc(p.getId()).stream()
                .filter(m -> !m.isCompleted())
                .collect(Collectors.toMap(Milestone::getId, Milestone::getDueDate));
        return PriorityRecommender.recommend(facts, blocking, milestoneDue, today());
    }

    @Transactional
    public TaskDtos.TaskDto applyRecommendation(Long projectId, Long taskId, AuthUser me) {
        PriorityRecommender.Recommendation rec = recommendations(projectId, me).stream()
                .filter(r -> r.taskId().equals(taskId)).findFirst()
                .orElseThrow(() -> ApiException.conflict("NO_RECOMMENDATION", "This task no longer has a recommendation"));
        return taskService.changePriority(taskId, rec.recommended(), me);
    }

    @Transactional(readOnly = true)
    public WorkloadBalancer.Result workload(Long projectId, AuthUser me) {
        Project p = access.require(projectId, me, ProjectAccess.Level.READ);
        return computeWorkload(p);
    }

    @Transactional
    public TaskDtos.TaskDto applyRebalance(Long projectId, Long taskId, Long toUserId, AuthUser me) {
        Project p = access.require(projectId, me, ProjectAccess.Level.MANAGE);
        boolean stillSuggested = computeWorkload(p).suggestions().stream()
                .anyMatch(s -> s.taskId().equals(taskId) && s.toUserId().equals(toUserId));
        if (!stillSuggested) {
            throw ApiException.conflict("SUGGESTION_EXPIRED", "Workload changed since this suggestion. Refresh to see new ones.");
        }
        return taskService.reassign(taskId, toUserId, me);
    }

    // ── computation ──────────────────────────────────────────────────────

    /** Cached health for any project (used by the platform admin console, which bypasses membership). */
    public HealthCalculator.HealthReport healthOf(Project p) {
        return cache.health(p.getId(), () -> computeHealth(p));
    }

    HealthCalculator.HealthReport computeHealth(Project p) {
        List<Task> projectTasks = tasks.findByProjectId(p.getId());
        List<TaskFacts> facts = projectTasks.stream().map(t -> TaskFacts.of(t, p.getKey())).toList();
        Map<Long, Integer> capacity = new HashMap<>();
        Map<Long, Integer> openPoints = new HashMap<>();
        memberLoads(p).forEach(m -> {
            capacity.put(m.userId(), m.capacity());
            openPoints.put(m.userId(), m.openPoints());
        });
        return HealthCalculator.calculate(new HealthCalculator.Input(p.getStartDate(), p.getDueDate(), today(), facts,
                capacity, openPoints, settings.integer(SettingsService.STALE_DAYS, 7)));
    }

    private WorkloadBalancer.Result computeWorkload(Project p) {
        List<TaskFacts> open = tasks.findByProjectId(p.getId()).stream()
                .filter(Task::isOpen).map(t -> TaskFacts.of(t, p.getKey())).toList();
        return WorkloadBalancer.analyze(memberLoads(p), open);
    }

    /** Project members with their organisation-wide open load (a person's capacity is shared across projects). */
    private List<WorkloadBalancer.Member> memberLoads(Project p) {
        List<Long> ids = members.findByIdProjectId(p.getId()).stream().map(ProjectMember::userId).toList();
        List<WorkloadBalancer.Member> out = new ArrayList<>();
        for (User u : users.findByIdIn(ids)) {
            if (!u.isActive()) continue;
            List<Task> open = tasks.findByAssigneeIdAndStatusNotOrderByDueDateAsc(u.getId(), TaskStatus.DONE);
            out.add(new WorkloadBalancer.Member(u.getId(), u.getFullName(), u.getAvatarColor(), u.getCapacityPoints(),
                    open.stream().mapToInt(Task::effectivePoints).sum(), open.size()));
        }
        return out;
    }

    private static LocalDate today() {
        return LocalDate.now(ZoneOffset.UTC);
    }
}
