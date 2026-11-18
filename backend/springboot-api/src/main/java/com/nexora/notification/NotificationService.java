package com.nexora.notification;

import com.nexora.common.ApiException;
import com.nexora.common.PageResponse;
import com.nexora.events.RealtimeEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository repo;
    private final ApplicationEventPublisher events;

    public NotificationService(NotificationRepository repo, ApplicationEventPublisher events) {
        this.repo = repo;
        this.events = events;
    }

    public record NotificationDto(Long id, String type, String title, String body, String link, boolean read,
                                  Instant createdAt) {
        static NotificationDto of(Notification n) {
            return new NotificationDto(n.getId(), n.getType(), n.getTitle(), n.getBody(), n.getLink(),
                    n.getReadAt() != null, n.getCreatedAt());
        }
    }

    /** Stores a notification and pushes it live to the user's socket room. Skips self-notifications. */
    @Transactional
    public void notify(Long orgId, Long userId, Long actorId, String type, String title, String body, String link) {
        if (userId == null || userId.equals(actorId)) return;
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type);
        n.setTitle(truncate(title, 200));
        n.setBody(truncate(body, 500));
        n.setLink(link);
        repo.save(n);
        events.publishEvent(RealtimeEvent.toUsers("notification.created", orgId, List.of(userId), NotificationDto.of(n)));
    }

    @Transactional(readOnly = true)
    public PageResponse<NotificationDto> list(Long userId, boolean unreadOnly, int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50));
        var result = unreadOnly
                ? repo.findByUserIdAndReadAtIsNullOrderByCreatedAtDesc(userId, pageable)
                : repo.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        return PageResponse.of(result, NotificationDto::of);
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        return repo.countByUserIdAndReadAtIsNull(userId);
    }

    @Transactional
    public NotificationDto markRead(Long userId, Long id) {
        Notification n = repo.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("Notification"));
        if (n.getReadAt() == null) n.setReadAt(Instant.now());
        return NotificationDto.of(n);
    }

    @Transactional
    public int markAllRead(Long userId) {
        return repo.markAllRead(userId, Instant.now());
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max - 3) + "..." : s;
    }
}
