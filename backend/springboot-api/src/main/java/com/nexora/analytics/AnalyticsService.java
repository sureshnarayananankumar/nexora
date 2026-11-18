package com.nexora.analytics;

import com.nexora.insights.WorkloadBalancer;
import com.nexora.project.Project;
import com.nexora.project.ProjectAccess;
import com.nexora.security.AuthUser;
import com.nexora.task.Task;
import com.nexora.task.TaskRepository;
import com.nexora.task.TaskStatus;
import com.nexora.user.User;
import com.nexora.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AnalyticsService {

    private final ProjectAccess access;
    private final TaskRepository tasks;
    private final UserRepository users;

    public AnalyticsService(ProjectAccess access, TaskRepository tasks, UserRepository users) {
        this.access = access;
        this.tasks = tasks;
        this.users = users;
    }

    public record WeekPoint(LocalDate weekStart, int created, int completed, int completedPoints) {
    }

    public record Contributor(Long userId, String name, String avatarColor, int completedTasks, int completedPoints) {
    }

    public record Totals(int total, int open, int done, int overdue, int completionRate, double avgCycleTimeDays,
                         double avgLeadTimeDays) {
    }

    public record Overview(Totals totals, List<WeekPoint> throughput, Map<String, Integer> statusDistribution,
                           Map<String, Integer> priorityDistribution, List<Contributor> topContributors,
                           List<WorkloadBalancer.MemberLoad> workload) {
    }

    @Transactional(readOnly = true)
    public Overview overview(AuthUser me, Long projectId, int weeks) {
        List<Long> projectIds = projectId != null
                ? List.of(access.require(projectId, me, ProjectAccess.Level.READ).getId())
                : access.visibleProjects(me).stream().map(Project::getId).toList();
        List<Task> all = projectIds.isEmpty() ? List.of() : tasks.findByProjectIdIn(projectIds);
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        int w = Math.max(4, Math.min(weeks, 26));

        // throughput per ISO week
        LocalDate firstWeek = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(w - 1L);
        List<WeekPoint> throughput = new ArrayList<>();
        for (int i = 0; i < w; i++) {
            LocalDate start = firstWeek.plusWeeks(i);
            Instant from = start.atStartOfDay(ZoneOffset.UTC).toInstant();
            Instant to = start.plusWeeks(1).atStartOfDay(ZoneOffset.UTC).toInstant();
            int created = (int) all.stream().filter(t -> within(t.getCreatedAt(), from, to)).count();
            List<Task> done = all.stream().filter(t -> within(t.getCompletedAt(), from, to)).toList();
            throughput.add(new WeekPoint(start, created, done.size(), done.stream().mapToInt(Task::effectivePoints).sum()));
        }

        Map<String, Integer> status = new LinkedHashMap<>();
        for (TaskStatus s : TaskStatus.values()) status.put(s.name(), 0);
        all.forEach(t -> status.merge(t.getStatus().name(), 1, Integer::sum));

        Map<String, Integer> priority = new LinkedHashMap<>();
        for (var p : com.nexora.task.TaskPriority.values()) priority.put(p.name(), 0);
        all.stream().filter(Task::isOpen).forEach(t -> priority.merge(t.getPriority().name(), 1, Integer::sum));

        Instant since60 = today.minusDays(60).atStartOfDay(ZoneOffset.UTC).toInstant();
        List<Task> recentDone = all.stream().filter(t -> t.getStatus() == TaskStatus.DONE && t.getCompletedAt() != null
                && t.getCompletedAt().isAfter(since60)).toList();
        double cycle = recentDone.stream().filter(t -> t.getStartedAt() != null)
                .mapToDouble(t -> Duration.between(t.getStartedAt(), t.getCompletedAt()).toHours() / 24.0)
                .average().orElse(0);
        double lead = recentDone.stream()
                .mapToDouble(t -> Duration.between(t.getCreatedAt(), t.getCompletedAt()).toHours() / 24.0)
                .average().orElse(0);

        int open = (int) all.stream().filter(Task::isOpen).count();
        int done = all.size() - open;
        int overdue = (int) all.stream().filter(t -> t.isOverdue(today)).count();
        Totals totals = new Totals(all.size(), open, done, overdue,
                all.isEmpty() ? 0 : Math.round(done * 100f / all.size()), round(cycle), round(lead));

        Instant since30 = today.minusDays(30).atStartOfDay(ZoneOffset.UTC).toInstant();
        Map<Long, List<Task>> doneBy = all.stream()
                .filter(t -> t.getAssigneeId() != null && t.getCompletedAt() != null && t.getCompletedAt().isAfter(since30))
                .collect(Collectors.groupingBy(Task::getAssigneeId));
        Map<Long, User> userMap = users.findByIdIn(new HashSet<>(all.stream().map(Task::getAssigneeId)
                        .filter(Objects::nonNull).toList())).stream()
                .collect(Collectors.toMap(User::getId, u -> u));
        List<Contributor> contributors = doneBy.entrySet().stream()
                .filter(e -> userMap.containsKey(e.getKey()))
                .map(e -> new Contributor(e.getKey(), userMap.get(e.getKey()).getFullName(), userMap.get(e.getKey()).getAvatarColor(),
                        e.getValue().size(), e.getValue().stream().mapToInt(Task::effectivePoints).sum()))
                .sorted(Comparator.comparingInt(Contributor::completedPoints).reversed())
                .limit(8).toList();

        List<WorkloadBalancer.MemberLoad> workload = userMap.values().stream().filter(User::isActive).map(u -> {
            List<Task> openTasks = tasks.findByAssigneeIdAndStatusNotOrderByDueDateAsc(u.getId(), TaskStatus.DONE);
            int pts = openTasks.stream().mapToInt(Task::effectivePoints).sum();
            int util = WorkloadBalancer.utilization(pts, u.getCapacityPoints());
            return new WorkloadBalancer.MemberLoad(u.getId(), u.getFullName(), u.getAvatarColor(), u.getCapacityPoints(),
                    pts, openTasks.size(), util, WorkloadBalancer.state(util));
        }).sorted(Comparator.comparingInt(WorkloadBalancer.MemberLoad::utilization).reversed()).toList();

        return new Overview(totals, throughput, status, priority, contributors, workload);
    }

    private static boolean within(Instant t, Instant from, Instant to) {
        return t != null && !t.isBefore(from) && t.isBefore(to);
    }

    private static double round(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
