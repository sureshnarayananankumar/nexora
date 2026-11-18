package com.nexora.user;

import com.nexora.audit.AuditService;
import com.nexora.auth.RefreshTokenRepository;
import com.nexora.common.ApiException;
import com.nexora.common.Jsons;
import com.nexora.organization.PlanLimits;
import com.nexora.role.RoleRepository;
import com.nexora.security.AuthUser;
import com.nexora.security.CurrentUser;
import com.nexora.task.Task;
import com.nexora.task.TaskRepository;
import com.nexora.task.TaskStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/team")
@Tag(name = "Team")
public class TeamController {

    static final Set<String> ASSIGNABLE_ROLES = Set.of("ORG_ADMIN", "MANAGER", "MEMBER");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final RoleRepository roles;
    private final TaskRepository tasks;
    private final PasswordEncoder encoder;
    private final PlanLimits limits;
    private final AuditService audit;
    private final RefreshTokenRepository refreshTokens;

    public TeamController(UserRepository users, RoleRepository roles, TaskRepository tasks, PasswordEncoder encoder,
                          PlanLimits limits, AuditService audit, RefreshTokenRepository refreshTokens) {
        this.users = users;
        this.roles = roles;
        this.tasks = tasks;
        this.encoder = encoder;
        this.limits = limits;
        this.audit = audit;
        this.refreshTokens = refreshTokens;
    }

    public record TeamMemberDto(Long id, String fullName, String email, String jobTitle, String avatarColor, String role,
                                String status, int capacityPoints, int openPoints, int openTasks, Instant lastLoginAt) {
    }

    public record InviteRequest(
            @NotBlank @Size(min = 2, max = 120) String fullName,
            @NotBlank @Email @Size(max = 190) String email,
            @NotBlank String role,
            @Size(max = 120) String jobTitle) {
    }

    public record InviteResponse(TeamMemberDto member, String temporaryPassword) {
    }

    public record UpdateMemberRequest(@NotBlank String role, @NotBlank @Pattern(regexp = "ACTIVE|SUSPENDED") String status,
                                      @Min(1) @Max(200) int capacityPoints, @Size(max = 120) String jobTitle) {
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<TeamMemberDto> list() {
        Long orgId = CurrentUser.get().organizationId();
        return users.findByOrganizationIdOrderByFullNameAsc(orgId).stream().map(this::toDto).toList();
    }

    @PostMapping
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Add a teammate; returns a one-time temporary password to share securely")
    @Transactional
    public InviteResponse invite(@Valid @RequestBody InviteRequest req) {
        AuthUser me = CurrentUser.get();
        if (!ASSIGNABLE_ROLES.contains(req.role())) throw ApiException.badRequest("INVALID_ROLE", "Unknown role");
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) throw ApiException.conflict("EMAIL_TAKEN", "That email is already registered");
        limits.checkUsers(me.organizationId());

        String temp = temporaryPassword();
        User u = new User();
        u.setOrganizationId(me.organizationId());
        u.setRole(roles.findByName(req.role()).orElseThrow());
        u.setEmail(email);
        u.setFullName(req.fullName().trim());
        u.setJobTitle(req.jobTitle());
        u.setPasswordHash(encoder.encode(temp));
        users.save(u);
        audit.log("USER_INVITED", "USER", u.getId(), Jsons.map("email", email, "role", req.role()));
        return new InviteResponse(toDto(u), temp);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('USER_MANAGE')")
    @Transactional
    public TeamMemberDto update(@PathVariable Long id, @Valid @RequestBody UpdateMemberRequest req) {
        AuthUser me = CurrentUser.get();
        User u = users.findByIdAndOrganizationId(id, me.organizationId()).orElseThrow(() -> ApiException.notFound("User"));
        if (!ASSIGNABLE_ROLES.contains(req.role())) throw ApiException.badRequest("INVALID_ROLE", "Unknown role");
        if ("SUPER_ADMIN".equals(u.getRole().getName())) throw ApiException.forbidden("Platform admins are managed in the admin console");
        if (u.getId().equals(me.id()) && (!req.role().equals(u.getRole().getName()) || !"ACTIVE".equals(req.status()))) {
            throw ApiException.badRequest("SELF_CHANGE", "You can't change your own role or suspend yourself");
        }
        String oldRole = u.getRole().getName();
        String oldStatus = u.getStatus();
        u.setRole(roles.findByName(req.role()).orElseThrow());
        u.setStatus(req.status());
        u.setCapacityPoints(req.capacityPoints());
        u.setJobTitle(req.jobTitle());
        if ("SUSPENDED".equals(req.status()) && !"SUSPENDED".equals(oldStatus)) {
            refreshTokens.revokeAllForUser(u.getId(), Instant.now());
        }
        audit.log("USER_UPDATED", "USER", u.getId(), Jsons.map("role", oldRole + " → " + req.role(),
                "status", oldStatus + " → " + req.status(), "capacity", req.capacityPoints()));
        return toDto(u);
    }

    private TeamMemberDto toDto(User u) {
        List<Task> open = tasks.findByAssigneeIdAndStatusNotOrderByDueDateAsc(u.getId(), TaskStatus.DONE);
        int points = open.stream().mapToInt(Task::effectivePoints).sum();
        return new TeamMemberDto(u.getId(), u.getFullName(), u.getEmail(), u.getJobTitle(), u.getAvatarColor(),
                u.getRole().getName(), u.getStatus(), u.getCapacityPoints(), points, open.size(), u.getLastLoginAt());
    }

    static String temporaryPassword() {
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        StringBuilder sb = new StringBuilder("Nx-");
        for (int i = 0; i < 12; i++) sb.append(alphabet.charAt(RANDOM.nextInt(alphabet.length())));
        sb.append(RANDOM.nextInt(10));
        return sb.toString();
    }
}
