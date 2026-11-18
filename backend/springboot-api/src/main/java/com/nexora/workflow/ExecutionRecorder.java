package com.nexora.workflow;

import com.nexora.common.Jsons;
import com.nexora.events.RealtimeEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Persists execution history in its own transaction so failed (rolled back) runs are still recorded. */
@Component
public class ExecutionRecorder {

    private final WorkflowRepository workflows;
    private final WorkflowExecutionRepository executions;
    private final ApplicationEventPublisher events;

    public ExecutionRecorder(WorkflowRepository workflows, WorkflowExecutionRepository executions,
                             ApplicationEventPublisher events) {
        this.workflows = workflows;
        this.executions = executions;
        this.events = events;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public WorkflowExecution record(Long workflowId, Long taskId, TriggerType trigger, boolean dryRun, String status,
                                    List<Map<String, Object>> steps, String error, Instant started) {
        Instant finished = Instant.now();
        WorkflowExecution ex = new WorkflowExecution();
        ex.setWorkflowId(workflowId);
        ex.setTaskId(taskId);
        ex.setTriggerEvent(trigger.name());
        ex.setDryRun(dryRun);
        ex.setStatus(status);
        ex.setSteps(steps);
        ex.setErrorMessage(error == null ? null : error.substring(0, Math.min(error.length(), 500)));
        ex.setStartedAt(started);
        ex.setFinishedAt(finished);
        ex.setDurationMs((int) Duration.between(started, finished).toMillis());
        executions.save(ex);
        workflows.findById(workflowId).ifPresent(wf -> {
            if (!dryRun && !"SKIPPED".equals(status)) {
                wf.setRunCount(wf.getRunCount() + 1);
                wf.setLastRunAt(finished);
            }
            events.publishEvent(RealtimeEvent.toOrg("workflow.executed", wf.getOrganizationId(),
                    Jsons.map("workflowId", wf.getId(), "executionId", ex.getId(), "status", status, "taskId", taskId,
                            "dryRun", dryRun)));
        });
        return ex;
    }
}
