package com.nexora.user;

import com.nexora.auth.AuthDtos;
import com.nexora.auth.AuthService;
import com.nexora.common.ApiException;
import com.nexora.organization.OrganizationRepository;
import com.nexora.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "My account")
public class MeController {

    /** Widgets the analytics dashboard knows how to render. */
    public static final Set<String> WIDGETS = Set.of("throughput", "status", "priority", "workload", "health",
            "cycleTime", "createdVsCompleted", "topContributors");

    private final UserRepository users;
    private final OrganizationRepository orgs;
    private final AuthService auth;

    public MeController(UserRepository users, OrganizationRepository orgs, AuthService auth) {
        this.users = users;
        this.orgs = orgs;
        this.auth = auth;
    }

    public record UpdateProfileRequest(
            @NotBlank @Size(min = 2, max = 120) String fullName,
            @Size(max = 120) String jobTitle,
            @NotBlank @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Use a hex colour like #6366F1") String avatarColor,
            @NotBlank @Size(max = 60) String timezone,
            @Min(1) @Max(200) int capacityPoints) {
    }

    public record PreferencesRequest(
            @NotBlank @Pattern(regexp = "light|dark|system") String theme,
            @NotNull @Size(max = 12) List<@NotBlank String> dashboardLayout) {
    }

    @GetMapping
    @Transactional(readOnly = true)
    public AuthDtos.MeDto me() {
        User u = users.findById(CurrentUser.get().id()).orElseThrow(() -> ApiException.notFound("User"));
        return auth.me(u, orgs.findById(u.getOrganizationId()).orElseThrow());
    }

    @PutMapping
    @Transactional
    public AuthDtos.MeDto update(@Valid @RequestBody UpdateProfileRequest req) {
        try {
            ZoneId.of(req.timezone());
        } catch (DateTimeException e) {
            throw ApiException.badRequest("INVALID_TIMEZONE", "Unknown time zone");
        }
        User u = users.findById(CurrentUser.get().id()).orElseThrow(() -> ApiException.notFound("User"));
        u.setFullName(req.fullName().trim());
        u.setJobTitle(req.jobTitle() == null || req.jobTitle().isBlank() ? null : req.jobTitle().trim());
        u.setAvatarColor(req.avatarColor().toUpperCase());
        u.setTimezone(req.timezone());
        u.setCapacityPoints(req.capacityPoints());
        return auth.me(u, orgs.findById(u.getOrganizationId()).orElseThrow());
    }

    @PutMapping("/preferences")
    @Transactional
    public AuthDtos.MeDto preferences(@Valid @RequestBody PreferencesRequest req) {
        List<String> unknown = req.dashboardLayout().stream().filter(w -> !WIDGETS.contains(w)).toList();
        if (!unknown.isEmpty()) {
            throw ApiException.badRequest("UNKNOWN_WIDGET", "Unknown widgets: " + String.join(", ", unknown));
        }
        User u = users.findById(CurrentUser.get().id()).orElseThrow(() -> ApiException.notFound("User"));
        u.setTheme(req.theme());
        u.setDashboardLayout(req.dashboardLayout().stream().distinct().toList());
        return auth.me(u, orgs.findById(u.getOrganizationId()).orElseThrow());
    }

    @PutMapping("/password")
    public ResponseEntity<Void> password(@Valid @RequestBody AuthDtos.ChangePasswordRequest req) {
        auth.changePassword(CurrentUser.get().id(), req);
        return ResponseEntity.noContent().build();
    }
}
