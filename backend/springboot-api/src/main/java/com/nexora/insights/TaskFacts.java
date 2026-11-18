package com.nexora.insights;

import com.nexora.task.Task;
import com.nexora.task.TaskPriority;
import com.nexora.task.TaskStatus;

import java.time.Instant;
import java.time.LocalDate;

/** The subset of a task the insight algorithms need. Keeps the algorithms pure and easy to unit test. */
public record TaskFacts(Long id, String key, String title, TaskStatus status, TaskPriority priority, int points,
                        LocalDate dueDate, Long assigneeId, Long milestoneId, Instant createdAt, Instant updatedAt,
                        Instant completedAt) {

    public boolean open() {
        return status != TaskStatus.DONE;
    }

    public static TaskFacts of(Task t, String projectKey) {
        return new TaskFacts(t.getId(), projectKey + "-" + t.getTaskNumber(), t.getTitle(), t.getStatus(),
                t.getPriority(), t.effectivePoints(), t.getDueDate(), t.getAssigneeId(), t.getMilestoneId(),
                t.getCreatedAt(), t.getUpdatedAt(), t.getCompletedAt());
    }
}
