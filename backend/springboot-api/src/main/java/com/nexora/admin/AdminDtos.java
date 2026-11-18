package com.nexora.admin;

import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class AdminDtos {
    private AdminDtos() {
    }

    public record Overview(long organizations, long activeOrganizations, long users, long activeUsers, long projects,
                           long tasks, long tasksCompleted7d, long signups30d, long workflowRuns24h,
                           long workflowFailures24h, long apiRequests24h, double apiErrorRate24h, int apiP95Ms24h,
                           Map<String, Long> planDistribution, List<AuditDto> recentAudit) {
    }

    public record DailyPoint(LocalDate day, long newUsers, long newOrganizations, long tasksCreated, long tasksCompleted,
                             long workflowRuns) {
    }

    public record UserRow(Long id, String fullName, String email, String role, Long roleId, String status,
                          Long organizationId, String organizationName, Instant lastLoginAt, Instant createdAt) {
    }

    public record UpdateUserRequest(@NotNull Long roleId, @NotBlank @Pattern(regexp = "ACTIVE|SUSPENDED") String status) {
    }

    public record OrgRow(Long id, String name, String slug, String status, String industry, String planCode,
                         String planName, long users, long projects, Instant createdAt) {
    }

    public record OrgDetail(OrgRow organization, long workflows, long openTasks, List<UserRow> admins) {
    }

    public record UpdateOrgRequest(@NotNull Long planId, @NotBlank @Pattern(regexp = "ACTIVE|SUSPENDED") String status) {
    }

    public record RoleRow(Long id, String name, String description, boolean systemRole, Set<String> permissions,
                          long users) {
    }

    public record RoleRequest(@NotBlank @Pattern(regexp = "^[A-Z][A-Z_]{2,49}$", message = "Use UPPER_SNAKE_CASE") String name,
                              @Size(max = 255) String description, @NotNull Set<String> permissions) {
    }

    public record PermissionRow(Long id, String code, String description, String category) {
    }

    public record PlanRow(Long id, String code, String name, String description, BigDecimal priceMonthly, int maxUsers,
                          int maxProjects, int maxWorkflows, boolean active, long organizations) {
    }

    public record PlanRequest(@NotBlank @Pattern(regexp = "^[A-Z][A-Z_]{1,39}$", message = "Use UPPER_SNAKE_CASE") String code,
                              @NotBlank @Size(max = 80) String name,
                              @Size(max = 255) String description,
                              @NotNull @DecimalMin("0.00") @DecimalMax("99999.99") BigDecimal priceMonthly,
                              @Min(1) @Max(100000) int maxUsers,
                              @Min(1) @Max(100000) int maxProjects,
                              @Min(0) @Max(100000) int maxWorkflows,
                              boolean active) {
    }

    public record ProjectRow(Long id, String key, String name, String status, Long organizationId,
                             String organizationName, String ownerName, int totalTasks, int openTasks, int overdueTasks,
                             int healthScore, String risk, LocalDate dueDate) {
    }

    public record AuditDto(Long id, Long organizationId, Long actorId, String actorEmail, String action,
                           String entityType, String entityId, String ipAddress, Map<String, Object> details,
                           Instant createdAt) {
    }

    public record SettingUpdate(@NotNull @Size(max = 500) String value) {
    }
}
