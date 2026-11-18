package com.nexora.task;

import com.nexora.user.UserDirectory;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class TaskDtos {
    private TaskDtos() {
    }

    public record TaskDto(Long id, Long projectId, String key, String title, String description, TaskStatus status,
                          TaskPriority priority, UserDirectory.UserRef assignee, UserDirectory.UserRef reporter,
                          Long milestoneId, Integer storyPoints, LocalDate dueDate, double position,
                          String blockedReason, List<Long> dependsOn, long commentCount, Instant startedAt,
                          Instant completedAt, Instant createdAt, Instant updatedAt, long version) {
    }

    public record CreateTaskRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 10000) String description,
            TaskStatus status,
            @NotNull TaskPriority priority,
            Long assigneeId,
            Long milestoneId,
            @Min(0) @Max(100) Integer storyPoints,
            LocalDate dueDate,
            List<Long> dependsOn) {
    }

    public record UpdateTaskRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 10000) String description,
            @NotNull TaskStatus status,
            @NotNull TaskPriority priority,
            Long assigneeId,
            Long milestoneId,
            @Min(0) @Max(100) Integer storyPoints,
            LocalDate dueDate,
            @Size(max = 255) String blockedReason,
            List<Long> dependsOn,
            @NotNull Long version) {
    }

    public record MoveTaskRequest(@NotNull TaskStatus status, @NotNull Double position) {
    }

    public record CommentDto(Long id, Long taskId, UserDirectory.UserRef author, String body, boolean automated,
                             Instant createdAt) {
    }

    public record CommentRequest(@NotBlank @Size(max = 5000) String body) {
    }
}
