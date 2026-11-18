package com.nexora.notification;

import com.nexora.common.PageResponse;
import com.nexora.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
@Tag(name = "Notifications")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<NotificationService.NotificationDto> list(@RequestParam(defaultValue = "false") boolean unread,
                                                                 @RequestParam(defaultValue = "0") int page,
                                                                 @RequestParam(defaultValue = "20") int size) {
        return service.list(CurrentUser.get().id(), unread, page, size);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> unreadCount() {
        return Map.of("count", service.unreadCount(CurrentUser.get().id()));
    }

    @PostMapping("/{id}/read")
    public NotificationService.NotificationDto read(@PathVariable Long id) {
        return service.markRead(CurrentUser.get().id(), id);
    }

    @PostMapping("/read-all")
    public Map<String, Integer> readAll() {
        return Map.of("updated", service.markAllRead(CurrentUser.get().id()));
    }
}
