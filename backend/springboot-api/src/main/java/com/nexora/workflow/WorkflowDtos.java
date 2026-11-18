package com.nexora.workflow;

import com.nexora.user.UserDirectory;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class WorkflowDtos {
    private WorkflowDtos() {
    }

    public record NodeDto(@NotBlank @Size(max = 40) String key,
                          @NotBlank String type,
                          @NotBlank String kind,
                          @Size(max = 120) String label,
                          Map<String, Object> config,
                          double x, double y) {
    }

    public record EdgeDto(@NotBlank String source, @NotBlank String target, String branch) {
    }

    public record SaveWorkflowRequest(@NotBlank @Size(max = 120) String name,
                                      @Size(max = 500) String description,
                                      Long projectId,
                                      boolean enabled,
                                      @NotNull @Size(min = 2, max = 40) List<@Valid NodeDto> nodes,
                                      @NotNull @Size(max = 80) List<@Valid EdgeDto> edges) {
    }

    public record WorkflowSummary(Long id, String name, String description, Long projectId, String projectName,
                                  TriggerType triggerType, boolean enabled, int runCount, Instant lastRunAt,
                                  int nodeCount, UserDirectory.UserRef createdBy, Instant updatedAt) {
    }

    public record WorkflowDetail(WorkflowSummary workflow, List<NodeDto> nodes, List<EdgeDto> edges, long version) {
    }

    public record ExecutionDto(Long id, Long workflowId, String workflowName, String triggerEvent, Long taskId,
                               String status, boolean dryRun, List<Map<String, Object>> steps, String errorMessage,
                               Instant startedAt, int durationMs) {
    }

    public record TestRequest(@NotNull Long taskId) {
    }
}
