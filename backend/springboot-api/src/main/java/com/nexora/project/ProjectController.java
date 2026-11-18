package com.nexora.project;

import com.nexora.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/projects")
@Tag(name = "Projects")
public class ProjectController {

    private final ProjectService service;

    public ProjectController(ProjectService service) {
        this.service = service;
    }

    @GetMapping
    public List<ProjectDtos.ProjectSummary> list(@RequestParam(defaultValue = "false") boolean includeArchived) {
        return service.list(CurrentUser.get(), includeArchived);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectDtos.ProjectDetail create(@Valid @RequestBody ProjectDtos.CreateProjectRequest req) {
        return service.create(req, CurrentUser.get());
    }

    @GetMapping("/{id}")
    public ProjectDtos.ProjectDetail get(@PathVariable Long id) {
        return service.get(id, CurrentUser.get());
    }

    @PutMapping("/{id}")
    public ProjectDtos.ProjectDetail update(@PathVariable Long id, @Valid @RequestBody ProjectDtos.UpdateProjectRequest req) {
        return service.update(id, req, CurrentUser.get());
    }

    @PostMapping("/{id}/members")
    public ProjectDtos.ProjectDetail addMember(@PathVariable Long id, @Valid @RequestBody ProjectDtos.AddMemberRequest req) {
        return service.addMember(id, req, CurrentUser.get());
    }

    @PutMapping("/{id}/members/{userId}")
    public ProjectDtos.ProjectDetail updateMember(@PathVariable Long id, @PathVariable Long userId,
                                                 @Valid @RequestBody ProjectDtos.UpdateMemberRequest req) {
        return service.updateMember(id, userId, req, CurrentUser.get());
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ProjectDtos.ProjectDetail removeMember(@PathVariable Long id, @PathVariable Long userId) {
        return service.removeMember(id, userId, CurrentUser.get());
    }

    @PostMapping("/{id}/milestones")
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectDtos.MilestoneDto createMilestone(@PathVariable Long id, @Valid @RequestBody ProjectDtos.MilestoneRequest req) {
        return service.saveMilestone(id, null, req, CurrentUser.get());
    }

    @PutMapping("/{id}/milestones/{milestoneId}")
    public ProjectDtos.MilestoneDto updateMilestone(@PathVariable Long id, @PathVariable Long milestoneId,
                                                    @Valid @RequestBody ProjectDtos.MilestoneRequest req) {
        return service.saveMilestone(id, milestoneId, req, CurrentUser.get());
    }

    @DeleteMapping("/{id}/milestones/{milestoneId}")
    public ResponseEntity<Void> deleteMilestone(@PathVariable Long id, @PathVariable Long milestoneId) {
        service.deleteMilestone(id, milestoneId, CurrentUser.get());
        return ResponseEntity.noContent().build();
    }
}
