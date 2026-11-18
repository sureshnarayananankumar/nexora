package com.nexora.workflow;

import com.nexora.task.Task;
import com.nexora.task.TaskPriority;
import com.nexora.task.TaskStatus;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import java.util.Map;

/** Pure evaluation of condition blocks against a task. */
public final class ConditionEvaluator {

    private ConditionEvaluator() {
    }

    public record Result(boolean value, String message) {
    }

    public static Result evaluate(String kind, Map<String, Object> config, Task t, LocalDate today) {
        Map<String, Object> cfg = config == null ? Map.of() : config;
        return switch (kind) {
            case "STATUS_IS" -> {
                TaskStatus s = TaskStatus.valueOf(String.valueOf(cfg.get("status")));
                yield new Result(t.getStatus() == s, "Status is " + t.getStatus() + (t.getStatus() == s ? " = " : " ≠ ") + s);
            }
            case "PRIORITY_AT_LEAST" -> {
                TaskPriority p = TaskPriority.valueOf(String.valueOf(cfg.get("priority")));
                boolean ok = t.getPriority().atLeast(p);
                yield new Result(ok, "Priority " + t.getPriority() + (ok ? " ≥ " : " < ") + p);
            }
            case "DUE_WITHIN_DAYS" -> {
                int days = (int) Double.parseDouble(String.valueOf(cfg.get("days")));
                if (t.getDueDate() == null) yield new Result(false, "No due date");
                long left = ChronoUnit.DAYS.between(today, t.getDueDate());
                yield new Result(left <= days, left < 0 ? "Overdue by " + (-left) + " days" : "Due in " + left + " days (limit " + days + ")");
            }
            case "TITLE_CONTAINS" -> {
                String needle = String.valueOf(cfg.get("text")).toLowerCase(Locale.ROOT).trim();
                boolean ok = t.getTitle().toLowerCase(Locale.ROOT).contains(needle);
                yield new Result(ok, "Title " + (ok ? "contains" : "doesn't contain") + " \"" + needle + "\"");
            }
            case "IS_UNASSIGNED" -> new Result(t.getAssigneeId() == null,
                    t.getAssigneeId() == null ? "Task has no assignee" : "Task is assigned");
            default -> throw new IllegalArgumentException("Unknown condition " + kind);
        };
    }
}
