package com.nexora.security;

import com.nexora.config.NexoraProperties;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    static JwtService service(String secret) {
        var props = new NexoraProperties(new NexoraProperties.Jwt(secret, 15, 7), false, false, null, List.of(), "s");
        JwtService s = new JwtService(props);
        s.init();
        return s;
    }

    @Test
    void roundTripsClaims() {
        JwtService jwt = service("test-secret-that-is-definitely-longer-than-32-bytes");
        AuthUser u = new AuthUser(7L, 3L, "a@b.dev", "Ann", "MANAGER", Set.of("TASK_WRITE", "PROJECT_CREATE"));
        AuthUser parsed = jwt.parse(jwt.issueAccessToken(u)).orElseThrow();
        assertThat(parsed).isEqualTo(u);
    }

    @Test
    void rejectsTamperedAndForeignTokens() {
        JwtService a = service("secret-a-secret-a-secret-a-secret-a-secret-a");
        JwtService b = service("secret-b-secret-b-secret-b-secret-b-secret-b");
        String token = a.issueAccessToken(new AuthUser(1L, 1L, "x@y.dev", "X", "MEMBER", Set.of()));
        assertThat(b.parse(token)).isEmpty();
        assertThat(a.parse(token + "x")).isEmpty();
        assertThat(a.parse("not-a-jwt")).isEmpty();
    }

    @Test
    void refusesShortSecrets() {
        assertThatThrownBy(() -> service("short")).isInstanceOf(IllegalStateException.class);
    }
}
