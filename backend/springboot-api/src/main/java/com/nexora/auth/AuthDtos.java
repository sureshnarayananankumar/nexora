package com.nexora.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Set;

public final class AuthDtos {
    private AuthDtos() {
    }

    public static final String PASSWORD_RULE = "^(?=.*[A-Za-z])(?=.*\\d).{8,72}$";
    public static final String PASSWORD_MESSAGE = "Use 8-72 characters with at least one letter and one number";

    public record LoginRequest(
            @NotBlank @Email @Size(max = 190) String email,
            @NotBlank @Size(max = 72) String password) {
    }

    public record RegisterRequest(
            @NotBlank @Size(min = 2, max = 120) String fullName,
            @NotBlank @Email @Size(max = 190) String email,
            @NotBlank @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MESSAGE) String password,
            @NotBlank @Size(min = 2, max = 120) String organizationName) {
    }

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MESSAGE) String newPassword) {
    }

    public record OrgRef(Long id, String name, String slug, String plan) {
    }

    public record MeDto(Long id, String email, String fullName, String jobTitle, String avatarColor, String role,
                        Set<String> permissions, OrgRef organization, int capacityPoints, String timezone,
                        String theme, List<String> dashboardLayout) {
    }

    public record AuthResponse(String accessToken, long expiresIn, MeDto user) {
    }

    /** Internal result: the response body plus the raw refresh token destined for the cookie. */
    public record IssuedTokens(AuthResponse response, String refreshToken, long refreshMaxAgeSeconds) {
    }
}
