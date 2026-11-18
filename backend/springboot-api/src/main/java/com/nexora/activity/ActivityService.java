package com.nexora.activity;

import com.nexora.events.RealtimeEvent;
import com.nexora.user.UserDirectory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;

@Service
public class ActivityService {

    private final ActivityRepository repo;
    private final ApplicationEventPublisher events;
    private final UserDirectory users;

    public ActivityService(ActivityRepository repo, ApplicationEventPublisher events, UserDirectory users) {
        this.repo = repo;
        this.events = events;
        this.users = users;
    }

    public record ActivityDto(Long id, Long projectId, String type, String entityType, Long entityId, String summary,
                              Map<String, Object> metadata, UserDirectory.UserRef actor, Instant createdAt) {
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public Activity record(Long orgId, Long projectId, Long actorId, String type, String entityType, Long entityId,
                           String summary, Map<String, Object> metadata) {
        Activity a = new Activity();
        a.setOrganizationId(orgId);
        a.setProjectId(projectId);
        a.setActorId(actorId);
        a.setType(type);
        a.setEntityType(entityType);
        a.setEntityId(entityId);
        a.setSummary(summary.length() > 500 ? summary.substring(0, 497) + "..." : summary);
        a.setMetadata(metadata);
        repo.save(a);
        ActivityDto dto = toDto(a);
        events.publishEvent(projectId != null
                ? RealtimeEvent.toProject("activity.created", orgId, projectId, dto)
                : RealtimeEvent.toOrg("activity.created", orgId, dto));
        return a;
    }

    public ActivityDto toDto(Activity a) {
        return new ActivityDto(a.getId(), a.getProjectId(), a.getType(), a.getEntityType(), a.getEntityId(),
                a.getSummary(), a.getMetadata(), a.getActorId() == null ? null : users.ref(a.getActorId()), a.getCreatedAt());
    }
}
