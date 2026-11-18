package com.nexora.security;

import com.nexora.common.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

public final class CurrentUser {
    private CurrentUser() {
    }

    public static AuthUser get() {
        return find().orElseThrow(() -> ApiException.unauthorized("Authentication required"));
    }

    public static Optional<AuthUser> find() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthUser user) {
            return Optional.of(user);
        }
        return Optional.empty();
    }
}
