package com.nexora.analytics;

import com.nexora.common.ApiException;
import com.nexora.project.Milestone;
import com.nexora.project.MilestoneRepository;
import com.nexora.project.Project;
import com.nexora.project.ProjectAccess;
import com.nexora.security.AuthUser;
import com.nexora.security.CurrentUser;
import com.nexora.task.TaskPriority;
import com.nexora.task.TaskRepository;
import com.nexora.task.TaskStatus;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Analytics & calendar")
public class AnalyticsController {

    private final AnalyticsService analytics;
    private final ProjectAccess access;
    private final TaskRepository tasks;
    private final MilestoneRepository milestones;

    public AnalyticsController(AnalyticsService analytics, ProjectAccess access, TaskRepository tasks,
                               MilestoneRepository milestones) {
        this.analytics = analytics;
        this.access = access;
        this.tasks = tasks;
        this.milestones = milestones;
    }

    public record CalendarItem(String kind, Long id, Long projectId, String projectKey, String projectColor,
                               String title, LocalDate date, TaskStatus status, TaskPriority priority, boolean completed) {
    }

    @GetMapping("/analytics/overview")
    public AnalyticsService.Overview overview(@RequestParam(required = false) Long projectId,
                                              @RequestParam(defaultValue = "8") int weeks) {
        AuthUser me = CurrentUser.get();
        if (!me.can("ANALYTICS_READ")) throw ApiException.forbidden("You can't view analytics");
        return analytics.overview(me, projectId, weeks);
    }

    @GetMapping("/calendar")
    @Transactional(readOnly = true)
    public List<CalendarItem> calendar(@RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                       @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                       @RequestParam(required = false) Long projectId) {
        if (to.isBefore(from) || ChronoUnit.DAYS.between(from, to) > 93) {
            throw ApiException.badRequest("INVALID_RANGE", "Choose a range of up to 93 days");
        }
        AuthUser me = CurrentUser.get();
        Map<Long, Project> visible = (projectId != null
                ? List.of(access.require(projectId, me, ProjectAccess.Level.READ))
                : access.visibleProjects(me)).stream().collect(Collectors.toMap(Project::getId, Function.identity()));
        if (visible.isEmpty()) return List.of();
        List<CalendarItem> items = new ArrayList<>();
        tasks.findByProjectIdInAndDueDateBetween(visible.keySet(), from, to).forEach(t -> {
            Project p = visible.get(t.getProjectId());
            items.add(new CalendarItem("TASK", t.getId(), p.getId(), p.getKey(), p.getColor(),
                    p.getKey() + "-" + t.getTaskNumber() + " · " + t.getTitle(), t.getDueDate(), t.getStatus(),
                    t.getPriority(), t.getStatus() == TaskStatus.DONE));
        });
        for (Milestone m : milestones.findByProjectIdInAndDueDateBetween(visible.keySet(), from, to)) {
            Project p = visible.get(m.getProjectId());
            items.add(new CalendarItem("MILESTONE", m.getId(), p.getId(), p.getKey(), p.getColor(), m.getName(),
                    m.getDueDate(), null, null, m.isCompleted()));
        }
        items.sort(Comparator.comparing(CalendarItem::date).thenComparing(CalendarItem::kind));
        return items;
    }
}
