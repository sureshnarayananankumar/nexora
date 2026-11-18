package com.nexora.insights;

import com.nexora.task.TaskPriority;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/** Rule-based priority suggestions with human-readable reasons. */
public final class PriorityRecommender {

    private PriorityRecommender() {
    }

    public record Recommendation(Long taskId, String key, String title, TaskPriority current, TaskPriority recommended,
                                 int score, List<String> reasons) {
    }

    public static List<Recommendation> recommend(List<TaskFacts> tasks, Map<Long, Integer> blocking,
                                                 Map<Long, LocalDate> milestoneDue, LocalDate today) {
        List<Recommendation> out = new ArrayList<>();
        for (TaskFacts t : tasks) {
            if (!t.open()) continue;
            Recommendation r = score(t, blocking.getOrDefault(t.id(), 0), milestoneDue.get(t.milestoneId()), today);
            if (r.recommended() != t.priority()) out.add(r);
        }
        out.sort(Comparator.comparingInt(Recommendation::score).reversed());
        return out;
    }

    static Recommendation score(TaskFacts t, int blocks, LocalDate milestoneDue, LocalDate today) {
        List<String> reasons = new ArrayList<>();
        int urgency = 0;
        if (t.dueDate() != null) {
            long days = ChronoUnit.DAYS.between(today, t.dueDate());
            if (days < 0) { urgency = 40; reasons.add("Overdue by " + (-days) + " day" + (days == -1 ? "" : "s")); }
            else if (days <= 2) { urgency = 30; reasons.add(days == 0 ? "Due today" : "Due in " + days + " day" + (days == 1 ? "" : "s")); }
            else if (days <= 7) { urgency = 18; reasons.add("Due within a week"); }
            else if (days <= 14) { urgency = 8; reasons.add("Due within two weeks"); }
        }
        int blocking = Math.min(blocks * 8, 24);
        if (blocks > 0) reasons.add("Blocks " + blocks + " other open task" + (blocks == 1 ? "" : "s"));

        int current = switch (t.priority()) {
            case CRITICAL -> 20;
            case HIGH -> 12;
            case MEDIUM -> 6;
            case LOW -> 0;
        };

        int milestone = 0;
        if (milestoneDue != null) {
            long md = ChronoUnit.DAYS.between(today, milestoneDue);
            if (md <= 7) { milestone = 10; reasons.add("Its milestone is due " + (md < 0 ? "and already late" : "within 7 days")); }
        }

        int age = 0;
        if (t.createdAt() != null) {
            long openDays = ChronoUnit.DAYS.between(t.createdAt().atZone(ZoneOffset.UTC).toLocalDate(), today);
            age = (int) Math.min(Math.max(openDays, 0) / 3, 10);
            if (openDays >= 21) reasons.add("Open for " + openDays + " days");
        }

        int score = urgency + blocking + current + milestone + age;
        TaskPriority rec = score >= 60 ? TaskPriority.CRITICAL : score >= 40 ? TaskPriority.HIGH
                : score >= 20 ? TaskPriority.MEDIUM : TaskPriority.LOW;
        if (rec.rank() < t.priority().rank() && reasons.isEmpty()) {
            reasons.add("No deadline pressure and nothing depends on it");
        }
        return new Recommendation(t.id(), t.key(), t.title(), t.priority(), rec, score, reasons);
    }
}
