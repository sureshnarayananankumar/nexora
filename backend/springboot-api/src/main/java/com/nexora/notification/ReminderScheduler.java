package com.nexora.notification;

import com.nexora.auth.RefreshTokenRepository;
import com.nexora.project.Project;
import com.nexora.project.ProjectRepository;
import com.nexora.task.Task;
import com.nexora.task.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

/** Automated notifications that don't depend on a user action, plus housekeeping. */
@Component
public class ReminderScheduler {

    private static final Logger log = LoggerFactory.getLogger(ReminderScheduler.class);

    private final TaskRepository tasks;
    private final ProjectRepository projects;
    private final NotificationService notifications;
    private final NotificationRepository notificationRepo;
    private final RefreshTokenRepository refreshTokens;

    public ReminderScheduler(TaskRepository tasks, ProjectRepository projects, NotificationService notifications,
                             NotificationRepository notificationRepo, RefreshTokenRepository refreshTokens) {
        this.tasks = tasks;
        this.projects = projects;
        this.notifications = notifications;
        this.notificationRepo = notificationRepo;
        this.refreshTokens = refreshTokens;
    }

    /** Hourly: remind assignees about open tasks due tomorrow (once per task per day). */
    @Scheduled(cron = "0 5 * * * *", zone = "UTC")
    @Transactional
    public void dueTomorrow() {
        LocalDate tomorrow = LocalDate.now(ZoneOffset.UTC).plusDays(1);
        Instant dayAgo = Instant.now().minus(20, ChronoUnit.HOURS);
        int sent = 0;
        for (Task t : tasks.findOpenDueOn(tomorrow)) {
            Project p = projects.findById(t.getProjectId()).orElse(null);
            if (p == null || "ARCHIVED".equals(p.getStatus())) continue;
            String link = "/projects/" + p.getId() + "/board?task=" + t.getId();
            if (notificationRepo.existsByUserIdAndTypeAndLinkAndCreatedAtAfter(t.getAssigneeId(), "DUE_SOON", link, dayAgo)) continue;
            notifications.notify(p.getOrganizationId(), t.getAssigneeId(), null, "DUE_SOON",
                    p.getKey() + "-" + t.getTaskNumber() + " is due tomorrow", t.getTitle(), link);
            sent++;
        }
        if (sent > 0) log.info("Sent {} due-tomorrow reminders", sent);
    }

    @Scheduled(cron = "0 30 3 * * *", zone = "UTC")
    @Transactional
    public void purgeExpiredTokens() {
        int n = refreshTokens.deleteExpired(Instant.now().minus(1, ChronoUnit.DAYS));
        if (n > 0) log.info("Purged {} expired refresh tokens", n);
    }
}
