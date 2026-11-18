package com.nexora.auth;

import com.nexora.config.NexoraProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication")
public class AuthController {

    static final String WEB_COOKIE = "nexora_rt";
    static final String ADMIN_COOKIE = "nexora_admin_rt";
    static final String COOKIE_PATH = "/api/v1/auth";

    private final AuthService auth;
    private final NexoraProperties props;

    public AuthController(AuthService auth, NexoraProperties props) {
        this.auth = auth;
        this.props = props;
    }

    @PostMapping("/register")
    @Operation(summary = "Create an organisation and its first admin account")
    public ResponseEntity<AuthDtos.AuthResponse> register(@Valid @RequestBody AuthDtos.RegisterRequest req,
                                                          HttpServletRequest http) {
        var issued = auth.register(req, http.getHeader(HttpHeaders.USER_AGENT), http.getRemoteAddr());
        return withCookie(HttpStatus.CREATED, issued, AuthService.CLIENT_WEB);
    }

    @PostMapping("/login")
    @Operation(summary = "Log in; send header X-Client: admin from the admin console")
    public ResponseEntity<AuthDtos.AuthResponse> login(@Valid @RequestBody AuthDtos.LoginRequest req,
                                                       @RequestHeader(value = "X-Client", required = false) String client,
                                                       HttpServletRequest http) {
        String c = normalise(client);
        var issued = auth.login(req, c, http.getHeader(HttpHeaders.USER_AGENT), http.getRemoteAddr());
        return withCookie(HttpStatus.OK, issued, c);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Exchange the refresh cookie for a new access token (rotates the cookie)")
    public ResponseEntity<AuthDtos.AuthResponse> refresh(@RequestHeader(value = "X-Client", required = false) String client,
                                                         HttpServletRequest http) {
        String c = normalise(client);
        var issued = auth.refresh(readCookie(http, cookieName(c)), c, http.getHeader(HttpHeaders.USER_AGENT), http.getRemoteAddr());
        return withCookie(HttpStatus.OK, issued, c);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader(value = "X-Client", required = false) String client,
                                       HttpServletRequest http) {
        String c = normalise(client);
        auth.logout(readCookie(http, cookieName(c)));
        ResponseCookie cleared = ResponseCookie.from(cookieName(c), "").httpOnly(true).secure(props.cookieSecure())
                .sameSite("Strict").path(COOKIE_PATH).maxAge(0).build();
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cleared.toString()).build();
    }

    private ResponseEntity<AuthDtos.AuthResponse> withCookie(HttpStatus status, AuthDtos.IssuedTokens issued, String client) {
        ResponseCookie cookie = ResponseCookie.from(cookieName(client), issued.refreshToken())
                .httpOnly(true)
                .secure(props.cookieSecure())
                .sameSite("Strict")
                .path(COOKIE_PATH)
                .maxAge(issued.refreshMaxAgeSeconds())
                .build();
        return ResponseEntity.status(status).header(HttpHeaders.SET_COOKIE, cookie.toString()).body(issued.response());
    }

    private static String normalise(String client) {
        return AuthService.CLIENT_ADMIN.equalsIgnoreCase(client) ? AuthService.CLIENT_ADMIN : AuthService.CLIENT_WEB;
    }

    private static String cookieName(String client) {
        return AuthService.CLIENT_ADMIN.equals(client) ? ADMIN_COOKIE : WEB_COOKIE;
    }

    private static String readCookie(HttpServletRequest req, String name) {
        if (req.getCookies() == null) return null;
        for (Cookie c : req.getCookies()) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}
