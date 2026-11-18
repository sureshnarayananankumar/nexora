package com.nexora.insights;

import com.nexora.security.CurrentUser;
import com.nexora.task.TaskDtos;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Insights", description = "Explainable, rule-based project intelligence (no ML)")
public class InsightsController {

    private final InsightsService service;

    public InsightsController(InsightsService service) {
        this.service = service;
    }

    public record RebalanceRequest(@NotNull Long taskId, @NotNull Long toUserId) {
    }

    @GetMapping("/insights/portfolio")
    @Operation(summary = "Health score and risk for every project I can see, riskiest first")
    public List<InsightsService.PortfolioItem> portfolio() {
        return service.portfolio(CurrentUser.get());
    }

    @GetMapping("/projects/{id}/insights/health")
    @Operation(summary = "Project health score with per-factor explanation and delay forecast")
    public HealthCalculator.HealthReport health(@PathVariable Long id) {
        return service.health(id, CurrentUser.get());
    }

    @GetMapping("/projects/{id}/insights/priorities")
    @Operation(summary = "Tasks whose priority should change, with reasons")
    public List<PriorityRecommender.Recommendation> priorities(@PathVariable Long id) {
        return service.recommendations(id, CurrentUser.get());
    }

    @PostMapping("/projects/{id}/insights/priorities/{taskId}/apply")
    public TaskDtos.TaskDto applyPriority(@PathVariable Long id, @PathVariable Long taskId) {
        return service.applyRecommendation(id, taskId, CurrentUser.get());
    }

    @GetMapping("/projects/{id}/insights/workload")
    @Operation(summary = "Utilisation per member and reassignment suggestions")
    public WorkloadBalancer.Result workload(@PathVariable Long id) {
        return service.workload(id, CurrentUser.get());
    }

    @PostMapping("/projects/{id}/insights/workload/apply")
    public TaskDtos.TaskDto applyRebalance(@PathVariable Long id, @Valid @RequestBody RebalanceRequest req) {
        return service.applyRebalance(id, req.taskId(), req.toUserId(), CurrentUser.get());
    }
}
