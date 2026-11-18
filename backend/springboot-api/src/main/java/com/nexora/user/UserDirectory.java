package com.nexora.user;

import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/** Lightweight lookups for rendering "who" in DTOs without loading full entities everywhere. */
@Component
public class UserDirectory {

    private final UserRepository users;

    public UserDirectory(UserRepository users) {
        this.users = users;
    }

    public record UserRef(Long id, String fullName, String email, String avatarColor) {
        public static UserRef of(User u) {
            return new UserRef(u.getId(), u.getFullName(), u.getEmail(), u.getAvatarColor());
        }
    }

    public UserRef ref(Long id) {
        if (id == null) return null;
        return users.findById(id).map(UserRef::of).orElse(new UserRef(id, "Deleted user", null, "#94A3B8"));
    }

    public Map<Long, UserRef> refs(Collection<Long> ids) {
        Map<Long, UserRef> map = new HashMap<>();
        if (ids == null || ids.isEmpty()) return map;
        users.findByIdIn(ids.stream().filter(java.util.Objects::nonNull).distinct().toList())
                .forEach(u -> map.put(u.getId(), UserRef.of(u)));
        return map;
    }

    public Optional<User> find(Long id) {
        return id == null ? Optional.empty() : users.findById(id);
    }
}
