package com.nexora.admin;

import com.nexora.common.PageResponse;
import com.nexora.monitoring.ApiMetricsService;
import com.nexora.settings.SettingsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Platform administration. Every route needs ADMIN_ACCESS (enforced in SecurityConfig) plus a specific permission. */
@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Admin")
public class AdminController {

    private final AdminService admin;
    private final SettingsService settings;
    private final ApiMetricsService apiMetrics;

    public AdminController(AdminService admin, SettingsService settings, ApiMetricsService apiMetrics) {
        this.admin = admin;
        this.settings = settings;
        this.apiMetrics = apiMetrics;
    }

    @GetMapping("/overview")
    public AdminDtos.Overview overview() {
        return admin.overview();
    }

    @GetMapping("/analytics/daily")
    @Operation(summary = "Daily platform activity for charts")
    public List<AdminDtos.DailyPoint> daily(@RequestParam(defaultValue = "30") int days) {
        return admin.daily(days);
    }

    // users
    @GetMapping("/users")
    public PageResponse<AdminDtos.UserRow> users(@RequestParam(required = false) String q,
                                                 @RequestParam(required = false) String status,
                                                 @RequestParam(required = false) Long roleId,
                                                 @RequestParam(required = false) Long organizationId,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "20") int size,
                                                 @RequestParam(required = false) String sort) {
        return admin.users(q, status, roleId, organizationId, page, size, sort);
    }

    @PutMapping("/users/{id}")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public AdminDtos.UserRow updateUser(@PathVariable Long id, @Valid @RequestBody AdminDtos.UpdateUserRequest req) {
        return admin.updateUser(id, req);
    }

    @PostMapping("/users/{id}/revoke-sessions")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    public Map<String, Integer> revoke(@PathVariable Long id) {
        return Map.of("revoked", admin.revokeSessions(id));
    }

    // organisations
    @GetMapping("/organizations")
    public PageResponse<AdminDtos.OrgRow> organizations(@RequestParam(required = false) String q,
                                                        @RequestParam(required = false) String status,
                                                        @RequestParam(defaultValue = "0") int page,
                                                        @RequestParam(defaultValue = "20") int size,
                                                        @RequestParam(required = false) String sort) {
        return admin.organizations(q, status, page, size, sort);
    }

    @GetMapping("/organizations/{id}")
    public AdminDtos.OrgDetail organization(@PathVariable Long id) {
        return admin.organization(id);
    }

    @PutMapping("/organizations/{id}")
    @PreAuthorize("hasAuthority('ORG_MANAGE')")
    public AdminDtos.OrgRow updateOrganization(@PathVariable Long id, @Valid @RequestBody AdminDtos.UpdateOrgRequest req) {
        return admin.updateOrganization(id, req);
    }

    // roles & permissions
    @GetMapping("/roles")
    public List<AdminDtos.RoleRow> roles() {
        return admin.roles();
    }

    @GetMapping("/permissions")
    public List<AdminDtos.PermissionRow> permissions() {
        return admin.permissions();
    }

    @PostMapping("/roles")
    @PreAuthorize("hasAuthority('ROLE_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminDtos.RoleRow createRole(@Valid @RequestBody AdminDtos.RoleRequest req) {
        return admin.createRole(req);
    }

    @PutMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('ROLE_MANAGE')")
    public AdminDtos.RoleRow updateRole(@PathVariable Long id, @Valid @RequestBody AdminDtos.RoleRequest req) {
        return admin.updateRole(id, req);
    }

    @DeleteMapping("/roles/{id}")
    @PreAuthorize("hasAuthority('ROLE_MANAGE')")
    public ResponseEntity<Void> deleteRole(@PathVariable Long id) {
        admin.deleteRole(id);
        return ResponseEntity.noContent().build();
    }

    // plans
    @GetMapping("/plans")
    public List<AdminDtos.PlanRow> plans() {
        return admin.plans();
    }

    @PostMapping("/plans")
    @PreAuthorize("hasAuthority('PLAN_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    public AdminDtos.PlanRow createPlan(@Valid @RequestBody AdminDtos.PlanRequest req) {
        return admin.savePlan(null, req);
    }

    @PutMapping("/plans/{id}")
    @PreAuthorize("hasAuthority('PLAN_MANAGE')")
    public AdminDtos.PlanRow updatePlan(@PathVariable Long id, @Valid @RequestBody AdminDtos.PlanRequest req) {
        return admin.savePlan(id, req);
    }

    // projects
    @GetMapping("/projects")
    public PageResponse<AdminDtos.ProjectRow> projects(@RequestParam(required = false) String q,
                                                       @RequestParam(required = false) String status,
                                                       @RequestParam(required = false) Long organizationId,
                                                       @RequestParam(defaultValue = "0") int page,
                                                       @RequestParam(defaultValue = "20") int size,
                                                       @RequestParam(required = false) String sort) {
        return admin.projects(q, status, organizationId, page, size, sort);
    }

    // audit
    @GetMapping("/audit-logs")
    @PreAuthorize("hasAuthority('AUDIT_READ')")
    public PageResponse<AdminDtos.AuditDto> audit(@RequestParam(required = false) String action,
                                                  @RequestParam(required = false) String entityType,
                                                  @RequestParam(required = false) Long organizationId,
                                                  @RequestParam(required = false) String q,
                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                                  @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "25") int size) {
        return admin.audit(action, entityType, organizationId, q, from, to, page, size);
    }

    @GetMapping("/audit-logs/actions")
    @PreAuthorize("hasAuthority('AUDIT_READ')")
    public List<String> auditActions() {
        return admin.auditActions();
    }

    // settings
    @GetMapping("/settings")
    public List<SettingsService.SettingDto> settings() {
        return settings.list();
    }

    @PutMapping("/settings/{key}")
    @PreAuthorize("hasAuthority('SYSTEM_CONFIG')")
    public SettingsService.SettingDto updateSetting(@PathVariable String key, @Valid @RequestBody AdminDtos.SettingUpdate req) {
        return settings.update(key, req.value());
    }

    // api monitoring
    @GetMapping("/api-metrics")
    public ApiMetricsService.Summary apiMetrics(@RequestParam(defaultValue = "24") int hours) {
        return apiMetrics.summary(hours);
    }
}
