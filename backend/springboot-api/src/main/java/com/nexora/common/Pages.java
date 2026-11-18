package com.nexora.common;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;

/** Builds safe Pageable objects: clamps size and only allows whitelisted sort fields. */
public final class Pages {
    private Pages() {
    }

    public static Pageable of(int page, int size, String sort, Set<String> allowed, String defaultSort) {
        int safeSize = Math.max(1, Math.min(size, 100));
        int safePage = Math.max(0, page);
        String field = defaultSort;
        Sort.Direction dir = Sort.Direction.DESC;
        if (sort != null && !sort.isBlank()) {
            String[] parts = sort.split(",");
            if (allowed.contains(parts[0])) {
                field = parts[0];
            }
            if (parts.length > 1 && parts[1].equalsIgnoreCase("asc")) {
                dir = Sort.Direction.ASC;
            }
        }
        return PageRequest.of(safePage, safeSize, Sort.by(dir, field));
    }
}
