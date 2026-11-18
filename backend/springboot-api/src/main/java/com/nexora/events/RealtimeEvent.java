package com.nexora.events;

import java.util.Collection;
import java.util.List;
import java.util.Map;

/**
 * An event the realtime service fans out to Socket.IO rooms.
 * Routing: projectId → room "project:{id}", userIds → "user:{id}", orgWide → "org:{id}".
 */
public record RealtimeEvent(String type, Long organizationId, Long projectId, List<Long> userIds,
                            boolean orgWide, Object payload) {

    public static RealtimeEvent toProject(String type, Long orgId, Long projectId, Object payload) {
        return new RealtimeEvent(type, orgId, projectId, List.of(), false, payload);
    }

    public static RealtimeEvent toUsers(String type, Long orgId, Collection<Long> userIds, Object payload) {
        return new RealtimeEvent(type, orgId, null, List.copyOf(userIds), false, payload);
    }

    public static RealtimeEvent toOrg(String type, Long orgId, Object payload) {
        return new RealtimeEvent(type, orgId, null, List.of(), true, payload);
    }

    public Map<String, Object> routing() {
        return Map.of("projectId", projectId == null ? "" : projectId, "orgWide", orgWide);
    }
}
