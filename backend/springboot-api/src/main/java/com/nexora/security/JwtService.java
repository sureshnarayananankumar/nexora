package com.nexora.security;

import com.nexora.config.NexoraProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Issues and verifies HS256 access tokens. The Node realtime service verifies the
 * same tokens with the same shared secret (issuer "nexora", audience "nexora-clients").
 */
@Service
public class JwtService {

    public static final String ISSUER = "nexora";
    public static final String AUDIENCE = "nexora-clients";

    private final NexoraProperties props;
    private SecretKey key;

    public JwtService(NexoraProperties props) {
        this.props = props;
    }

    @PostConstruct
    void init() {
        String secret = props.jwt() == null ? null : props.jwt().secret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SECRET must be set and at least 32 bytes long");
        }
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public long accessTtlSeconds() {
        return props.jwt().accessTtlMinutes() * 60;
    }

    public String issueAccessToken(AuthUser user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(ISSUER)
                .audience().add(AUDIENCE).and()
                .subject(String.valueOf(user.id()))
                .claim("org", user.organizationId())
                .claim("email", user.email())
                .claim("name", user.fullName())
                .claim("role", user.role())
                .claim("perms", List.copyOf(user.permissions()))
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(props.jwt().accessTtlMinutes(), ChronoUnit.MINUTES)))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public Optional<AuthUser> parse(String token) {
        try {
            Claims c = Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(ISSUER)
                    .requireAudience(AUDIENCE)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            Set<String> perms = new HashSet<>();
            Object raw = c.get("perms");
            if (raw instanceof List<?> list) {
                list.forEach(p -> perms.add(String.valueOf(p)));
            }
            return Optional.of(new AuthUser(
                    Long.valueOf(c.getSubject()),
                    c.get("org", Number.class).longValue(),
                    c.get("email", String.class),
                    c.get("name", String.class),
                    c.get("role", String.class),
                    Set.copyOf(perms)));
        } catch (JwtException | IllegalArgumentException | NullPointerException e) {
            return Optional.empty();
        }
    }
}
