package com.nexora.insights;

import com.nexora.task.TaskPriority;
import com.nexora.task.TaskStatus;

import java.util.*;

/** Utilisation per member plus greedy reassignment suggestions (see docs/architecture.md §5). */
public final class WorkloadBalancer {

    private WorkloadBalancer() {
    }

    public record Member(Long userId, String name, String avatarColor, int capacity, int openPoints, int openTasks) {
    }

    public record MemberLoad(Long userId, String name, String avatarColor, int capacity, int openPoints, int openTasks,
                             int utilization, String state) {
    }

    public record Suggestion(Long taskId, String taskKey, String taskTitle, int points, Long fromUserId, String fromName,
                             Long toUserId, String toName, String reason) {
    }

    public record Result(List<MemberLoad> members, List<Suggestion> suggestions) {
    }

    public static String state(int utilization) {
        return utilization > 100 ? "OVERLOADED" : utilization >= 60 ? "BALANCED" : "AVAILABLE";
    }

    public static int utilization(int points, int capacity) {
        return capacity <= 0 ? 0 : Math.round(points * 100f / capacity);
    }

    /**
     * @param members      project members with their organisation-wide open load
     * @param projectTasks open tasks in this project (only these may be moved)
     */
    public static Result analyze(List<Member> members, List<TaskFacts> projectTasks) {
        Map<Long, Integer> load = new HashMap<>();
        members.forEach(m -> load.put(m.userId(), m.openPoints()));
        Map<Long, Member> byId = new HashMap<>();
        members.forEach(m -> byId.put(m.userId(), m));

        List<Suggestion> suggestions = new ArrayList<>();
        List<Member> overloaded = members.stream()
                .filter(m -> utilization(m.openPoints(), m.capacity()) > 100)
                .sorted(Comparator.comparingInt((Member m) -> utilization(m.openPoints(), m.capacity())).reversed())
                .toList();

        for (Member src : overloaded) {
            List<TaskFacts> movable = projectTasks.stream()
                    .filter(t -> src.userId().equals(t.assigneeId()))
                    .filter(t -> t.status() == TaskStatus.TODO || t.status() == TaskStatus.BACKLOG)
                    .sorted(Comparator.comparingInt((TaskFacts t) -> t.priority().rank())
                            .thenComparing(t -> t.dueDate() == null ? java.time.LocalDate.MAX : t.dueDate(), Comparator.reverseOrder()))
                    .toList();
            for (TaskFacts t : movable) {
                if (load.get(src.userId()) <= src.capacity()) break;
                Member target = members.stream()
                        .filter(m -> !m.userId().equals(src.userId()))
                        .filter(m -> load.get(m.userId()) + t.points() <= m.capacity())
                        .max(Comparator.comparingInt(m -> m.capacity() - load.get(m.userId())))
                        .orElse(null);
                if (target == null) continue;
                load.merge(src.userId(), -t.points(), Integer::sum);
                load.merge(target.userId(), t.points(), Integer::sum);
                int after = utilization(load.get(target.userId()), target.capacity());
                suggestions.add(new Suggestion(t.id(), t.key(), t.title(), t.points(), src.userId(), src.name(),
                        target.userId(), target.name(),
                        src.name() + " is at " + utilization(src.openPoints(), src.capacity()) + "% capacity; "
                                + target.name() + " would be at " + after + "% after taking this "
                                + (t.priority().atLeast(TaskPriority.HIGH) ? "high-priority " : "") + "task"));
            }
        }

        List<MemberLoad> loads = members.stream().map(m -> {
            int u = utilization(m.openPoints(), m.capacity());
            return new MemberLoad(m.userId(), m.name(), m.avatarColor(), m.capacity(), m.openPoints(), m.openTasks(), u, state(u));
        }).sorted(Comparator.comparingInt(MemberLoad::utilization).reversed()).toList();
        return new Result(loads, suggestions);
    }
}
