package com.nexora.activity;

import com.nexora.common.PageResponse;
import com.nexora.project.ProjectAccess;
import com.nexora.security.AuthUser;
import com.nexora.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/v1/activities")
@Tag(name = "Activity timeline")
public class ActivityController {

    private final ActivityRepository repo;
    private final ActivityService service;
    private final ProjectAccess access;
    private final com.nexora.task.TaskRepository tasks;

    public ActivityController(ActivityRepository repo, ActivityService service, ProjectAccess access,
                              com.nexora.task.TaskRepository tasks) {
        this.repo = repo;
        this.tasks = tasks;
        this.service = service;
        this.access = access;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public PageResponse<ActivityService.ActivityDto> list(@RequestParam(required = false) Long projectId,
                                                          @RequestParam(required = false) Long taskId,
                                                          @RequestParam(defaultValue = "0") int page,
                                                          @RequestParam(defaultValue = "30") int size) {
        AuthUser me = CurrentUser.get();
        var pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        if (taskId != null) {
            if (projectId == null) throw com.nexora.common.ApiException.badRequest("PROJECT_REQUIRED", "projectId is required with taskId");
            access.require(projectId, me, ProjectAccess.Level.READ);
            boolean taskInProject = tasks.findById(taskId).map(t -> t.getProjectId().equals(projectId)).orElse(false);
            if (!taskInProject) throw com.nexora.common.ApiException.notFound("Task");
            return PageResponse.of(repo.findByEntityTypeAndEntityIdOrderByCreatedAtDesc("TASK", taskId, pageable), service::toDto);
        }
        if (projectId != null) {
            access.require(projectId, me, ProjectAccess.Level.READ);
            return PageResponse.of(repo.findByProjectIdOrderByCreatedAtDesc(projectId, pageable), service::toDto);
        }
        List<Long> ids = new ArrayList<>(access.visibleProjectIds(me));
        if (ids.isEmpty()) ids.add(-1L);
        return PageResponse.of(repo.findForProjects(me.organizationId(), ids, pageable), service::toDto);
    }
}
