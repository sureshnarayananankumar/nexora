package com.nexora.admin;

import com.nexora.audit.AuditLog;
import com.nexora.audit.AuditLogRepository;
import com.nexora.audit.AuditService;
import com.nexora.auth.RefreshTokenRepository;
import com.nexora.common.ApiException;
import com.nexora.common.Jsons;
import com.nexora.common.PageResponse;
import com.nexora.common.Pages;
import com.nexora.insights.HealthCalculator;
import com.nexora.insights.InsightsService;
import com.nexora.monitoring.ApiMetricsService;
import com.nexora.organization.Organization;
import com.nexora.organization.OrganizationRepository;
import com.nexora.plan.Plan;
import com.nexora.plan.PlanRepository;
import com.nexora.project.Project;
import com.nexora.project.ProjectRepository;
import com.nexora.role.Permission;
import com.nexora.role.PermissionRepository;
import com.nexora.role.Role;
import com.nexora.role.RoleRepository;
import com.nexora.security.CurrentUser;
import com.nexora.task.Task;
import com.nexora.task.TaskRepository;
import com.nexora.task.TaskStatus;
import com.nexora.user.User;
import com.nexora.user.UserDirectory;
import com.nexora.user.UserRepository;
import com.nexora.workflow.WorkflowExecutionRepository;
import com.nexora.workflow.WorkflowRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdminService {

    private final OrganizationRepository orgs;
    private final UserRepository users;
    private final RoleRepository roles;
    private final PermissionRepository permissions;
    private final PlanRepository plans;
    private final ProjectRepository projects;
    private final TaskRepository tasks;
    private final WorkflowRepository workflows;
    private final WorkflowExecutionRepository executions;
    private final AuditLogRepository auditLogs;
    private final AuditService audit;
    private final RefreshTokenRepository refreshTokens;
    private final InsightsService insights;
    private final ApiMetricsService apiMetrics;
    private final UserDirectory directory;
    private final JdbcTemplate jdbc;

    public AdminService(OrganizationRepository orgs, UserRepository users, RoleRepository roles,
                        PermissionRepository permissions, PlanRepository plans, ProjectRepository projects,
                        TaskRepository tasks, WorkflowRepository workflows, WorkflowExecutionRepository executions,
                        AuditLogRepository auditLogs, AuditService audit, RefreshTokenRepository refreshTokens,
                        InsightsService insights, ApiMetricsService apiMetrics, UserDirectory directory,
                        JdbcTemplate jdbc) {
        this.orgs = orgs;
        this.users = users;
        this.roles = roles;
        this.permissions = permissions;
        this.plans = plans;
        this.projects = projects;
        this.tasks = tasks;
        this.workflows = workflows;
        this.executions = executions;
        this.auditLogs = auditLogs;
        this.audit = audit;
        this.refreshTokens = refreshTokens;
        this.insights = insights;
        this.apiMetrics = apiMetrics;
        this.directory = directory;
        this.jdbc = jdbc;
    }

    // ── Overview & analytics ─────────────────────────────────────────────

    @Transactional(readOnly = true)
    public AdminDtos.Overview overview() {
        Instant now = Instant.now();
        Instant day = now.minus(24, ChronoUnit.HOURS);
        List<Organization> allOrgs = orgs.findAll();
        Map<String, Long> planDist = allOrgs.stream()
                .collect(Collectors.groupingBy(o -> o.getPlan().getName(), TreeMap::new, Collectors.counting()));
        ApiMetricsService.Summary api = apiMetrics.summary(24);
        List<AdminDtos.AuditDto> recent = auditLogs.findAll(PageRequest.of(0, 8, Sort.by(Sort.Direction.DESC, "createdAt")))
                .map(AdminService::auditDto).getContent();
        long activeUsers = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE status = 'ACTIVE'", Long.class);
        return new AdminDtos.Overview(allOrgs.size(),
                allOrgs.stream().filter(o -> "ACTIVE".equals(o.getStatus())).count(),
                users.count(), activeUsers, projects.count(), tasks.count(),
                tasks.countByStatusAndCompletedAtAfter(TaskStatus.DONE, now.minus(7, ChronoUnit.DAYS)),
                users.countByCreatedAtAfter(now.minus(30, ChronoUnit.DAYS)),
                executions.countByStartedAtAfter(day), executions.countByStatusAndStartedAtAfter("FAILED", day),
                api.requests(), api.errorRate(), api.p95Ms(), planDist, recent);
    }

    public List<AdminDtos.DailyPoint> daily(int days) {
        int d = Math.max(7, Math.min(days, 90));
        LocalDate start = LocalDate.now(ZoneOffset.UTC).minusDays(d - 1L);
        Timestamp since = Timestamp.from(start.atStartOfDay(ZoneOffset.UTC).toInstant());
        Map<LocalDate, long[]> rows = new TreeMap<>();
        for (int i = 0; i < d; i++) rows.put(start.plusDays(i), new long[5]);
        String[] queries = {
                "SELECT DATE(created_at) d, COUNT(*) n FROM users WHERE created_at >= ? GROUP BY d",
                "SELECT DATE(created_at) d, COUNT(*) n FROM organizations WHERE created_at >= ? GROUP BY d",
                "SELECT DATE(created_at) d, COUNT(*) n FROM tasks WHERE created_at >= ? GROUP BY d",
                "SELECT DATE(completed_at) d, COUNT(*) n FROM tasks WHERE completed_at >= ? GROUP BY d",
                "SELECT DATE(started_at) d, COUNT(*) n FROM workflow_executions WHERE dry_run = FALSE AND started_at >= ? GROUP BY d"
        };
        for (int q = 0; q < queries.length; q++) {
            final int idx = q;
            jdbc.query(queries[q], rs -> {
                LocalDate day = rs.getDate("d").toLocalDate();
                long[] r = rows.get(day);
                if (r != null) r[idx] = rs.getLong("n");
            }, since);
        }
        return rows.entrySet().stream().map(e -> new AdminDtos.DailyPoint(e.getKey(), e.getValue()[0], e.getValue()[1],
                e.getValue()[2], e.getValue()[3], e.getValue()[4])).toList();
    }

    // ── Users ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResponse<AdminDtos.UserRow> users(String q, String status, Long roleId, Long orgId, int page, int size, String sort) {
        var pageable = Pages.of(page, size, sort, Set.of("createdAt", "fullName", "email", "lastLoginAt"), "createdAt");
        var result = users.search(blank(q), blank(status), roleId, orgId, pageable);
        Map<Long, String> orgNames = orgNames();
        return PageResponse.of(result, u -> userRow(u, orgNames));
    }

    @Transactional
    public AdminDtos.UserRow updateUser(Long id, AdminDtos.UpdateUserRequest req) {
        User u = users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
        if (u.getId().equals(CurrentUser.get().id())) {
            throw ApiException.badRequest("SELF_CHANGE", "You can't change your own role or status");
        }
        Role role = roles.findById(req.roleId()).orElseThrow(() -> ApiException.notFound("Role"));
        String before = u.getRole().getName() + "/" + u.getStatus();
        u.setRole(role);
        u.setStatus(req.status());
        if ("SUSPENDED".equals(req.status())) refreshTokens.revokeAllForUser(u.getId(), Instant.now());
        audit.log("ADMIN_USER_UPDATED", "USER", u.getId(),
                Jsons.map("email", u.getEmail(), "from", before, "to", role.getName() + "/" + req.status()));
        return userRow(u, orgNames());
    }

    @Transactional
    public int revokeSessions(Long id) {
        User u = users.findById(id).orElseThrow(() -> ApiException.notFound("User"));
        int n = refreshTokens.revokeAllForUser(u.getId(), Instant.now());
        audit.log("ADMIN_SESSIONS_REVOKED", "USER", u.getId(), Jsons.map("email", u.getEmail(), "sessions", n));
        return n;
    }

    // ── Organisations ────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResponse<AdminDtos.OrgRow> organizations(String q, String status, int page, int size, String sort) {
        var pageable = Pages.of(page, size, sort, Set.of("createdAt", "name"), "createdAt");
        return PageResponse.of(orgs.search(blank(q), blank(status), pageable), this::orgRow);
    }

    @Transactional(readOnly = true)
    public AdminDtos.OrgDetail organization(Long id) {
        Organization o = orgs.findById(id).orElseThrow(() -> ApiException.notFound("Organization"));
        Map<Long, String> names = Map.of(o.getId(), o.getName());
        List<AdminDtos.UserRow> admins = users.findByOrganizationIdOrderByFullNameAsc(o.getId()).stream()
                .filter(u -> Set.of("ORG_ADMIN", "SUPER_ADMIN").contains(u.getRole().getName()))
                .map(u -> userRow(u, names)).toList();
        long openTasks = projects.findByOrganizationIdAndStatusNotOrderByNameAsc(o.getId(), "ARCHIVED").stream()
                .mapToLong(p -> tasks.countByProjectIdAndStatusNot(p.getId(), TaskStatus.DONE)).sum();
        return new AdminDtos.OrgDetail(orgRow(o), workflows.countByOrganizationId(o.getId()), openTasks, admins);
    }

    @Transactional
    public AdminDtos.OrgRow updateOrganization(Long id, AdminDtos.UpdateOrgRequest req) {
        Organization o = orgs.findById(id).orElseThrow(() -> ApiException.notFound("Organization"));
        if ("nexora-platform".equals(o.getSlug()) && "SUSPENDED".equals(req.status())) {
            throw ApiException.badRequest("PLATFORM_ORG", "The platform organisation can't be suspended");
        }
        Plan plan = plans.findById(req.planId()).orElseThrow(() -> ApiException.notFound("Plan"));
        String before = o.getPlan().getCode() + "/" + o.getStatus();
        o.setPlan(plan);
        o.setStatus(req.status());
        audit.log("ADMIN_ORG_UPDATED", "ORGANIZATION", o.getId(),
                Jsons.map("name", o.getName(), "from", before, "to", plan.getCode() + "/" + req.status()));
        return orgRow(o);
    }

    // ── Roles & permissions ──────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AdminDtos.RoleRow> roles() {
        return roles.findAll(Sort.by("id")).stream().map(this::roleRow).toList();
    }

    @Transactional(readOnly = true)
    public List<AdminDtos.PermissionRow> permissions() {
        return permissions.findAllByOrderByCategoryAscCodeAsc().stream()
                .map(p -> new AdminDtos.PermissionRow(p.getId(), p.getCode(), p.getDescription(), p.getCategory())).toList();
    }

    @Transactional
    public AdminDtos.RoleRow createRole(AdminDtos.RoleRequest req) {
        if (roles.existsByName(req.name())) throw ApiException.conflict("ROLE_EXISTS", "A role with that name exists");
        Role r = new Role();
        r.setName(req.name());
        r.setDescription(req.description());
        r.setPermissions(resolvePermissions(req.permissions()));
        roles.save(r);
        audit.log("ROLE_CREATED", "ROLE", r.getId(), Jsons.map("name", r.getName(), "permissions", req.permissions()));
        return roleRow(r);
    }

    @Transactional
    public AdminDtos.RoleRow updateRole(Long id, AdminDtos.RoleRequest req) {
        Role r = roles.findById(id).orElseThrow(() -> ApiException.notFound("Role"));
        if ("SUPER_ADMIN".equals(r.getName())) {
            throw ApiException.badRequest("PROTECTED_ROLE", "SUPER_ADMIN always has every permission");
        }
        if (!r.isSystemRole() && !r.getName().equals(req.name())) {
            if (roles.existsByName(req.name())) throw ApiException.conflict("ROLE_EXISTS", "A role with that name exists");
            r.setName(req.name());
        }
        Set<String> before = r.permissionCodes();
        r.setDescription(req.description());
        r.setPermissions(resolvePermissions(req.permissions()));
        audit.log("ROLE_UPDATED", "ROLE", r.getId(), Jsons.map("name", r.getName(), "from", before, "to", req.permissions()));
        return roleRow(r);
    }

    @Transactional
    public void deleteRole(Long id) {
        Role r = roles.findById(id).orElseThrow(() -> ApiException.notFound("Role"));
        if (r.isSystemRole()) throw ApiException.badRequest("PROTECTED_ROLE", "System roles can't be deleted");
        if (users.countByRoleId(id) > 0) throw ApiException.conflict("ROLE_IN_USE", "Reassign this role's users first");
        roles.delete(r);
        audit.log("ROLE_DELETED", "ROLE", id, Jsons.map("name", r.getName()));
    }

    private Set<Permission> resolvePermissions(Set<String> codes) {
        List<Permission> found = permissions.findByCodeIn(codes);
        if (found.size() != codes.size()) {
            throw ApiException.badRequest("UNKNOWN_PERMISSION", "One or more permissions don't exist");
        }
        return new HashSet<>(found);
    }

    // ── Plans ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<AdminDtos.PlanRow> plans() {
        return plans.findAllByOrderByPriceMonthlyAsc().stream().map(this::planRow).toList();
    }

    @Transactional
    public AdminDtos.PlanRow savePlan(Long id, AdminDtos.PlanRequest req) {
        Plan p;
        if (id == null) {
            if (plans.existsByCode(req.code())) throw ApiException.conflict("PLAN_EXISTS", "A plan with that code exists");
            p = new Plan();
            p.setCode(req.code());
        } else {
            p = plans.findById(id).orElseThrow(() -> ApiException.notFound("Plan"));
            if (!p.getCode().equals(req.code())) throw ApiException.badRequest("CODE_IMMUTABLE", "Plan codes can't change");
        }
        p.setName(req.name().trim());
        p.setDescription(req.description());
        p.setPriceMonthly(req.priceMonthly());
        p.setMaxUsers(req.maxUsers());
        p.setMaxProjects(req.maxProjects());
        p.setMaxWorkflows(req.maxWorkflows());
        p.setActive(req.active());
        plans.save(p);
        audit.log(id == null ? "PLAN_CREATED" : "PLAN_UPDATED", "PLAN", p.getId(),
                Jsons.map("code", p.getCode(), "price", p.getPriceMonthly(), "maxUsers", p.getMaxUsers(),
                        "maxProjects", p.getMaxProjects(), "active", p.isActive()));
        return planRow(p);
    }

    // ── Project monitoring ───────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResponse<AdminDtos.ProjectRow> projects(String q, String status, Long orgId, int page, int size, String sort) {
        var pageable = Pages.of(page, size, sort, Set.of("createdAt", "name", "dueDate"), "createdAt");
        Map<Long, String> orgNames = orgNames();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        return PageResponse.of(projects.search(blank(q), blank(status), orgId, pageable), p -> {
            List<Task> ts = tasks.findByProjectId(p.getId());
            HealthCalculator.HealthReport h = insights.healthOf(p);
            return new AdminDtos.ProjectRow(p.getId(), p.getKey(), p.getName(), p.getStatus(), p.getOrganizationId(),
                    orgNames.get(p.getOrganizationId()), directory.ref(p.getOwnerId()).fullName(), ts.size(),
                    (int) ts.stream().filter(Task::isOpen).count(), (int) ts.stream().filter(t -> t.isOverdue(today)).count(),
                    h.score(), h.risk(), p.getDueDate());
        });
    }

    // ── Audit ────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public PageResponse<AdminDtos.AuditDto> audit(String action, String entityType, Long orgId, String q,
                                                  LocalDate from, LocalDate to, int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by(Sort.Direction.DESC, "createdAt"));
        Instant f = from == null ? null : from.atStartOfDay(ZoneOffset.UTC).toInstant();
        Instant t = to == null ? null : to.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
        return PageResponse.of(auditLogs.search(blank(action), blank(entityType), orgId, blank(q), f, t, pageable),
                AdminService::auditDto);
    }

    public List<String> auditActions() {
        return jdbc.queryForList("SELECT DISTINCT action FROM audit_logs ORDER BY action", String.class);
    }

    // ── mapping helpers ──────────────────────────────────────────────────

    private Map<Long, String> orgNames() {
        Map<Long, String> m = new HashMap<>();
        orgs.findAll().forEach(o -> m.put(o.getId(), o.getName()));
        return m;
    }

    private AdminDtos.UserRow userRow(User u, Map<Long, String> orgNames) {
        return new AdminDtos.UserRow(u.getId(), u.getFullName(), u.getEmail(), u.getRole().getName(), u.getRole().getId(),
                u.getStatus(), u.getOrganizationId(), orgNames.get(u.getOrganizationId()), u.getLastLoginAt(), u.getCreatedAt());
    }

    private AdminDtos.OrgRow orgRow(Organization o) {
        return new AdminDtos.OrgRow(o.getId(), o.getName(), o.getSlug(), o.getStatus(), o.getIndustry(),
                o.getPlan().getCode(), o.getPlan().getName(), users.countByOrganizationId(o.getId()),
                projects.countByOrganizationIdAndStatusNot(o.getId(), "ARCHIVED"), o.getCreatedAt());
    }

    private AdminDtos.RoleRow roleRow(Role r) {
        return new AdminDtos.RoleRow(r.getId(), r.getName(), r.getDescription(), r.isSystemRole(),
                new TreeSet<>(r.permissionCodes()), users.countByRoleId(r.getId()));
    }

    private AdminDtos.PlanRow planRow(Plan p) {
        return new AdminDtos.PlanRow(p.getId(), p.getCode(), p.getName(), p.getDescription(), p.getPriceMonthly(),
                p.getMaxUsers(), p.getMaxProjects(), p.getMaxWorkflows(), p.isActive(), orgs.countByPlanId(p.getId()));
    }

    static AdminDtos.AuditDto auditDto(AuditLog a) {
        return new AdminDtos.AuditDto(a.getId(), a.getOrganizationId(), a.getActorId(), a.getActorEmail(), a.getAction(),
                a.getEntityType(), a.getEntityId(), a.getIpAddress(), a.getDetails(), a.getCreatedAt());
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
