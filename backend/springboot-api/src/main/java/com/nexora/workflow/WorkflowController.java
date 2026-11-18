package com.nexora.workflow;

import com.nexora.common.PageResponse;
import com.nexora.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/workflows")
@Tag(name = "Workflow automation")
public class WorkflowController {

    private final WorkflowService service;

    public WorkflowController(WorkflowService service) {
        this.service = service;
    }

    @GetMapping("/catalog")
    @Operation(summary = "Blocks available in the visual builder")
    public Map<String, Object> catalog() {
        return Map.of("kinds", NodeCatalog.KINDS, "placeholders", NodeCatalog.placeholders().get("tokens"));
    }

    @GetMapping
    public List<WorkflowDtos.WorkflowSummary> list() {
        return service.list(CurrentUser.get());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkflowDtos.WorkflowDetail create(@Valid @RequestBody WorkflowDtos.SaveWorkflowRequest req) {
        return service.create(req, CurrentUser.get());
    }

    @GetMapping("/executions")
    @Operation(summary = "Recent executions across all workflows in my organisation")
    public PageResponse<WorkflowDtos.ExecutionDto> allExecutions(@RequestParam(defaultValue = "0") int page,
                                                                @RequestParam(defaultValue = "20") int size) {
        return service.executions(null, CurrentUser.get(), page, size);
    }

    @GetMapping("/{id}")
    public WorkflowDtos.WorkflowDetail get(@PathVariable Long id) {
        return service.get(id, CurrentUser.get());
    }

    @PutMapping("/{id}")
    public WorkflowDtos.WorkflowDetail update(@PathVariable Long id, @Valid @RequestBody WorkflowDtos.SaveWorkflowRequest req) {
        return service.update(id, req, CurrentUser.get());
    }

    @PatchMapping("/{id}/enabled")
    public WorkflowDtos.WorkflowSummary toggle(@PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        return service.toggle(id, Boolean.TRUE.equals(body.get("enabled")), CurrentUser.get());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id, CurrentUser.get());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/test")
    @Operation(summary = "Dry-run the workflow against a task and return the step trace")
    public WorkflowDtos.ExecutionDto test(@PathVariable Long id, @Valid @RequestBody WorkflowDtos.TestRequest req) {
        return service.test(id, req.taskId(), CurrentUser.get());
    }

    @GetMapping("/{id}/executions")
    public PageResponse<WorkflowDtos.ExecutionDto> executions(@PathVariable Long id,
                                                             @RequestParam(defaultValue = "0") int page,
                                                             @RequestParam(defaultValue = "20") int size) {
        return service.executions(id, CurrentUser.get(), page, size);
    }
}
