package com.nexora.auth;

import com.nexora.audit.AuditService;
import com.nexora.common.ApiException;
import com.nexora.common.Jsons;
import com.nexora.config.NexoraProperties;
import com.nexora.organization.Organization;
import com.nexora.organization.OrganizationRepository;
import com.nexora.plan.PlanRepository;
import com.nexora.role.RoleRepository;
import com.nexora.security.AuthUser;
import com.nexora.security.JwtService;
import com.nexora.settings.SettingsService;
import com.nexora.user.User;
import com.nexora.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class AuthService {

    public static final String CLIENT_ADMIN = "admin";
    public static final String CLIENT_WEB = "web";

    private static final String[] AVATAR_COLORS = {"#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6"};

    private final UserRepository users;
    private final OrganizationRepository orgs;
    private final PlanRepository plans;
    private final RoleRepository roles;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final AuditService audit;
    private final SettingsService settings;
    private final LoginRateLimiter limiter;
    private final NexoraProperties props;

    public AuthService(UserRepository users, OrganizationRepository orgs, PlanRepository plans, RoleRepository roles,
                       RefreshTokenRepository refreshTokens, PasswordEncoder encoder, JwtService jwt,
                       AuditService audit, SettingsService settings, LoginRateLimiter limiter, NexoraProperties props) {
        this.users = users;
        this.orgs = orgs;
        this.plans = plans;
        this.roles = roles;
        this.refreshTokens = refreshTokens;
        this.encoder = encoder;
        this.jwt = jwt;
        this.audit = audit;
        this.settings = settings;
        this.limiter = limiter;
        this.props = props;
    }

    @Transactional
    public AuthDtos.IssuedTokens register(AuthDtos.RegisterRequest req, String userAgent, String ip) {
        if (!settings.bool(SettingsService.REGISTRATION_ENABLED, true)) {
            throw ApiException.forbidden("New sign-ups are currently closed");
        }
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("EMAIL_TAKEN", "An account with this email already exists");
        }
        Organization org = new Organization();
        org.setName(req.organizationName().trim());
        org.setSlug(uniqueSlug(req.organizationName()));
        org.setPlan(plans.findByCode("STARTER").orElseThrow(() -> new IllegalStateException("STARTER plan missing")));
        orgs.save(org);

        User user = new User();
        user.setOrganizationId(org.getId());
        user.setRole(roles.findByName("ORG_ADMIN").orElseThrow());
        user.setEmail(email);
        user.setFullName(req.fullName().trim());
        user.setPasswordHash(encoder.encode(req.password()));
        user.setAvatarColor(AVATAR_COLORS[ThreadLocalRandom.current().nextInt(AVATAR_COLORS.length)]);
        user.setLastLoginAt(Instant.now());
        users.save(user);

        audit.logAs(org.getId(), user.getId(), email, "ORG_REGISTERED", "ORGANIZATION", org.getId(),
                Jsons.map("organization", org.getName()));
        return issue(user, org, CLIENT_WEB, userAgent, ip);
    }

    @Transactional
    public AuthDtos.IssuedTokens login(AuthDtos.LoginRequest req, String client, String userAgent, String ip) {
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        if (limiter.isBlocked(email)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "TOO_MANY_ATTEMPTS",
                    "Too many failed attempts. Try again in 15 minutes.");
        }
        User user = users.findByEmailIgnoreCase(email).orElse(null);
        if (user == null || !encoder.matches(req.password(), user.getPasswordHash())) {
            limiter.recordFailure(email);
            audit.logAs(user == null ? null : user.getOrganizationId(), user == null ? null : user.getId(), email,
                    "LOGIN_FAILED", "USER", user == null ? null : user.getId(), Jsons.map("client", client));
            throw ApiException.unauthorized("Email or password is incorrect");
        }
        if (!user.isActive()) {
            throw ApiException.forbidden("This account is suspended. Contact your administrator.");
        }
        Organization org = orgs.findById(user.getOrganizationId()).orElseThrow();
        if (!"ACTIVE".equals(org.getStatus()) && !"SUPER_ADMIN".equals(user.getRole().getName())) {
            throw ApiException.forbidden("Your organisation is suspended. Contact support.");
        }
        if (CLIENT_ADMIN.equals(client) && !user.getRole().permissionCodes().contains("ADMIN_ACCESS")) {
            limiter.recordFailure(email);
            throw ApiException.forbidden("This account can't access the admin console");
        }
        limiter.reset(email);
        user.setLastLoginAt(Instant.now());
        audit.logAs(org.getId(), user.getId(), email, "LOGIN_SUCCESS", "USER", user.getId(), Jsons.map("client", client));
        return issue(user, org, client, userAgent, ip);
    }

    /** Rotates the refresh token. Reusing a revoked token revokes the whole family for that user. */
    @Transactional(noRollbackFor = ApiException.class)
    public AuthDtos.IssuedTokens refresh(String rawToken, String client, String userAgent, String ip) {
        if (rawToken == null || rawToken.isBlank()) throw ApiException.unauthorized("Session expired");
        RefreshToken current = refreshTokens.findByTokenHash(TokenHasher.sha256(rawToken))
                .orElseThrow(() -> ApiException.unauthorized("Session expired"));
        Instant now = Instant.now();
        if (current.getRevokedAt() != null) {
            refreshTokens.revokeAllForUser(current.getUserId(), now);
            audit.logAs(null, current.getUserId(), null, "REFRESH_TOKEN_REUSE", "USER", current.getUserId(), null);
            throw ApiException.unauthorized("Session expired");
        }
        if (!current.isUsable(now)) throw ApiException.unauthorized("Session expired");

        User user = users.findById(current.getUserId()).orElseThrow(() -> ApiException.unauthorized("Session expired"));
        Organization org = orgs.findById(user.getOrganizationId()).orElseThrow();
        if (!user.isActive()) {
            refreshTokens.revokeAllForUser(user.getId(), now);
            throw ApiException.unauthorized("Account suspended");
        }
        AuthDtos.IssuedTokens issued = issue(user, org, current.getClient(), userAgent, ip);
        RefreshToken next = refreshTokens.findByTokenHash(TokenHasher.sha256(issued.refreshToken())).orElseThrow();
        current.setRevokedAt(now);
        current.setReplacedBy(next.getId());
        return issued;
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) return;
        refreshTokens.findByTokenHash(TokenHasher.sha256(rawToken)).ifPresent(t -> {
            if (t.getRevokedAt() == null) t.setRevokedAt(Instant.now());
        });
    }

    @Transactional
    public void changePassword(Long userId, AuthDtos.ChangePasswordRequest req) {
        User user = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        if (!encoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("WRONG_PASSWORD", "Current password is incorrect");
        }
        user.setPasswordHash(encoder.encode(req.newPassword()));
        refreshTokens.revokeAllForUser(userId, Instant.now());
        audit.log("PASSWORD_CHANGED", "USER", userId, null);
    }

    public AuthDtos.MeDto me(User user, Organization org) {
        return new AuthDtos.MeDto(user.getId(), user.getEmail(), user.getFullName(), user.getJobTitle(),
                user.getAvatarColor(), user.getRole().getName(), user.getRole().permissionCodes(),
                new AuthDtos.OrgRef(org.getId(), org.getName(), org.getSlug(), org.getPlan().getCode()),
                user.getCapacityPoints(), user.getTimezone(), user.getTheme(), user.getDashboardLayout());
    }

    private AuthDtos.IssuedTokens issue(User user, Organization org, String client, String userAgent, String ip) {
        AuthUser principal = new AuthUser(user.getId(), org.getId(), user.getEmail(), user.getFullName(),
                user.getRole().getName(), user.getRole().permissionCodes());
        String access = jwt.issueAccessToken(principal);

        String raw = TokenHasher.newToken();
        Duration ttl = Duration.ofDays(props.jwt().refreshTtlDays());
        RefreshToken rt = new RefreshToken();
        rt.setUserId(user.getId());
        rt.setTokenHash(TokenHasher.sha256(raw));
        rt.setClient(CLIENT_ADMIN.equals(client) ? CLIENT_ADMIN : CLIENT_WEB);
        rt.setExpiresAt(Instant.now().plus(ttl));
        rt.setUserAgent(userAgent == null ? null : userAgent.substring(0, Math.min(userAgent.length(), 255)));
        rt.setIpAddress(ip);
        refreshTokens.save(rt);

        return new AuthDtos.IssuedTokens(new AuthDtos.AuthResponse(access, jwt.accessTtlSeconds(), me(user, org)),
                raw, ttl.toSeconds());
    }

    private String uniqueSlug(String name) {
        String base = Normalizer.normalize(name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        if (base.isBlank()) base = "org";
        if (base.length() > 60) base = base.substring(0, 60);
        String slug = base;
        int i = 2;
        while (orgs.existsBySlug(slug)) {
            slug = base + "-" + i++;
        }
        return slug;
    }
}
