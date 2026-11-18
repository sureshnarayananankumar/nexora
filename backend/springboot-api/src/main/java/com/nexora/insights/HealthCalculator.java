package com.nexora.insights;

import com.nexora.task.TaskPriority;
import com.nexora.task.TaskStatus;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Explainable project health score. Every point lost is attributed to a named factor.
 * See docs/architecture.md §5 for the formula.
 */
public final class HealthCalculator {

    private HealthCalculator() {
    }

    public record Factor(String code, String label, int penalty, int maxPenalty, String detail) {
    }

    public record Forecast(double velocityPerDay, int remainingPoints, LocalDate projectedFinish, Integer daysLate,
                           String message) {
    }

    public record Stats(int totalTasks, int openTasks, int doneTasks, int overdueTasks, int blockedTasks,
                        int staleTasks, int unassignedUrgent, int overloadedMembers, int completedPoints,
                        int totalPoints, int progressPercent, Integer elapsedPercent) {
    }

    public record HealthReport(int score, String risk, List<Factor> factors, Forecast forecast, Stats stats) {
    }

    public record Input(LocalDate startDate, LocalDate dueDate, LocalDate today, List<TaskFacts> tasks,
                        Map<Long, Integer> memberCapacity, Map<Long, Integer> memberOpenPoints, int staleDays) {
    }

    public static HealthReport calculate(Input in) {
        List<TaskFacts> open = in.tasks().stream().filter(TaskFacts::open).toList();
        int total = in.tasks().size();
        int done = total - open.size();
        Instant staleBefore = in.today().atStartOfDay(ZoneOffset.UTC).toInstant().minus(in.staleDays(), ChronoUnit.DAYS);

        int overdue = (int) open.stream().filter(t -> t.dueDate() != null && t.dueDate().isBefore(in.today())).count();
        int blocked = (int) open.stream().filter(t -> t.status() == TaskStatus.BLOCKED).count();
        int stale = (int) open.stream().filter(t -> t.status() == TaskStatus.IN_PROGRESS
                && t.updatedAt() != null && t.updatedAt().isBefore(staleBefore)).count();
        int unassignedUrgent = (int) open.stream()
                .filter(t -> t.assigneeId() == null && t.priority().atLeast(TaskPriority.HIGH)).count();
        int overloaded = (int) in.memberCapacity().entrySet().stream()
                .filter(e -> in.memberOpenPoints().getOrDefault(e.getKey(), 0) > e.getValue()).count();
        int totalPoints = in.tasks().stream().mapToInt(TaskFacts::points).sum();
        int donePoints = in.tasks().stream().filter(t -> !t.open()).mapToInt(TaskFacts::points).sum();
        int progress = totalPoints == 0 ? 0 : Math.round(donePoints * 100f / totalPoints);
        Integer elapsed = elapsedPercent(in.startDate(), in.dueDate(), in.today());

        List<Factor> factors = new ArrayList<>();
        int openCount = Math.max(open.size(), 1);
        factors.add(new Factor("OVERDUE", "Overdue work", cap(Math.round(overdue * 30f / openCount), 30), 30,
                overdue == 0 ? "Nothing is overdue" : overdue + " of " + open.size() + " open tasks are past their due date"));

        int slipPenalty = 0;
        String slipDetail = "No due date set, so schedule slip isn't measured";
        if (elapsed != null) {
            int gap = elapsed - progress;
            slipPenalty = gap > 10 ? cap(Math.round((gap - 10) * 25f / 50f), 25) : 0;
            slipDetail = elapsed + "% of the timeline has passed and " + progress + "% of story points are done"
                    + (gap > 10 ? " (" + gap + " points behind)" : " (on track)");
        }
        factors.add(new Factor("SCHEDULE_SLIP", "Schedule slip", slipPenalty, 25, slipDetail));

        factors.add(new Factor("BLOCKED", "Blocked work", cap(Math.round(blocked * 15f / openCount), 15), 15,
                blocked == 0 ? "No blocked tasks" : blocked + " task" + plural(blocked) + " blocked"));
        factors.add(new Factor("STALE", "Stale work", cap(stale * 2, 10), 10,
                stale == 0 ? "All in-progress work moved in the last " + in.staleDays() + " days"
                        : stale + " in-progress task" + plural(stale) + " untouched for " + in.staleDays() + "+ days"));
        factors.add(new Factor("UNOWNED_URGENT", "Unowned urgent work", cap(unassignedUrgent * 3, 10), 10,
                unassignedUrgent == 0 ? "Every high-priority task has an owner"
                        : unassignedUrgent + " high/critical task" + plural(unassignedUrgent) + " without an assignee"));
        factors.add(new Factor("OVERLOAD", "Team overload", cap(overloaded * 4, 10), 10,
                overloaded == 0 ? "Nobody is above capacity" : overloaded + " member" + plural(overloaded) + " above 100% capacity"));

        int penalty = factors.stream().mapToInt(Factor::penalty).sum();
        int score = Math.max(0, 100 - penalty);
        String risk = score >= 75 ? "LOW" : score >= 50 ? "MEDIUM" : "HIGH";

        Forecast forecast = forecast(in, open);
        return new HealthReport(score, risk, factors, forecast, new Stats(total, open.size(), done, overdue, blocked,
                stale, unassignedUrgent, overloaded, donePoints, totalPoints, progress, elapsed));
    }

    static Forecast forecast(Input in, List<TaskFacts> open) {
        Instant since = in.today().atStartOfDay(ZoneOffset.UTC).toInstant().minus(14, ChronoUnit.DAYS);
        int recentPoints = in.tasks().stream()
                .filter(t -> !t.open() && t.completedAt() != null && t.completedAt().isAfter(since))
                .mapToInt(TaskFacts::points).sum();
        double velocity = recentPoints / 14.0;
        int remaining = open.stream().mapToInt(TaskFacts::points).sum();
        if (remaining == 0) {
            return new Forecast(round(velocity), 0, in.today(), 0, "All work is done");
        }
        if (velocity <= 0) {
            return new Forecast(0, remaining, null, null,
                    "No story points completed in the last 14 days, so a finish date can't be projected");
        }
        LocalDate finish = in.today().plusDays((long) Math.ceil(remaining / velocity));
        if (in.dueDate() == null) {
            return new Forecast(round(velocity), remaining, finish, null, "At the current pace, work finishes around " + finish);
        }
        long late = ChronoUnit.DAYS.between(in.dueDate(), finish);
        String message = late > 0
                ? "Projected " + late + " day" + plural((int) late) + " late at " + round(velocity) + " points/day"
                : "On track to finish " + (-late) + " day" + plural((int) -late) + " before the due date";
        return new Forecast(round(velocity), remaining, finish, (int) Math.max(late, 0), message);
    }

    static Integer elapsedPercent(LocalDate start, LocalDate due, LocalDate today) {
        if (start == null || due == null || !due.isAfter(start)) return null;
        long span = ChronoUnit.DAYS.between(start, due);
        long gone = ChronoUnit.DAYS.between(start, today);
        return (int) Math.max(0, Math.min(100, Math.round(gone * 100.0 / span)));
    }

    private static int cap(int v, int max) {
        return Math.max(0, Math.min(v, max));
    }

    private static String plural(int n) {
        return n == 1 ? "" : "s";
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
