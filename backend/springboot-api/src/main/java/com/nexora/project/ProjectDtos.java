package com.nexora.project;

import com.nexora.user.UserDirectory;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class ProjectDtos {
    private ProjectDtos() {
    }

    public record ProjectSummary(Long id, String key, String name, String description, String status, String color,
                                 UserDirectory.UserRef owner, LocalDate startDate, LocalDate dueDate, int memberCount,
                                 int totalTasks, int doneTasks, int openTasks, int progress, String myRole,
                                 Instant createdAt) {
    }

    public record MemberDto(UserDirectory.UserRef user, String projectRole, int capacityPoints, Instant joinedAt) {
    }

    public record MilestoneDto(Long id, String name, String description, LocalDate dueDate, boolean completed,
                               int totalTasks, int doneTasks) {
    }

    public record ProjectDetail(ProjectSummary project, List<MemberDto> members, List<MilestoneDto> milestones) {
    }

    public record CreateProjectRequest(
            @NotBlank @Pattern(regexp = "^[A-Za-z][A-Za-z0-9]{1,5}$", message = "2-6 letters or digits, starting with a letter") String key,
            @NotBlank @Size(min = 2, max = 120) String name,
            @Size(max = 4000) String description,
            @NotBlank @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String color,
            @NotNull LocalDate startDate,
            LocalDate dueDate,
            List<Long> memberIds) {
    }

    public record UpdateProjectRequest(
            @NotBlank @Size(min = 2, max = 120) String name,
            @Size(max = 4000) String description,
            @NotBlank @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String color,
            @NotBlank @Pattern(regexp = "ACTIVE|ON_HOLD|COMPLETED|ARCHIVED") String status,
            @NotNull LocalDate startDate,
            LocalDate dueDate) {
    }

    public record AddMemberRequest(@NotNull Long userId, @NotBlank @Pattern(regexp = "OWNER|CONTRIBUTOR|VIEWER") String projectRole) {
    }

    public record UpdateMemberRequest(@NotBlank @Pattern(regexp = "OWNER|CONTRIBUTOR|VIEWER") String projectRole) {
    }

    public record MilestoneRequest(@NotBlank @Size(max = 120) String name, @Size(max = 500) String description,
                                   @NotNull LocalDate dueDate, boolean completed) {
    }
}
