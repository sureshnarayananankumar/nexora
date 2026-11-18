package com.nexora.security;

import java.util.Set;

/** The authenticated caller, rebuilt from the access token on every request (no DB hit). */
public record AuthUser(Long id, Long organizationId, String email, String fullName, String role, Set<String> permissions) {

    public boolean can(String permission) {
        return permissions.contains(permission);
    }

    public boolean isSuperAdmin() {
        return "SUPER_ADMIN".equals(role);
    }

    /** Org admins and platform admins see every project in their organisation. */
    public boolean seesAllOrgProjects() {
        return isSuperAdmin() || "ORG_ADMIN".equals(role);
    }
}
