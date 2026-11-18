package com.nexora.workflow;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** Runs a workflow and always records the outcome, even when the run itself was rolled back. */
@Component
public class WorkflowDispatcher {

    private static final Logger log = LoggerFactory.getLogger(WorkflowDispatcher.class);

    private final WorkflowRunner runner;
    private final ExecutionRecorder recorder;

    public WorkflowDispatcher(WorkflowRunner runner, ExecutionRecorder recorder) {
        this.runner = runner;
        this.recorder = recorder;
    }

    public WorkflowExecution execute(Long workflowId, Long taskId, TriggerType trigger, boolean dryRun) {
        Instant started = Instant.now();
        String status;
        List<Map<String, Object>> steps;
        String error = null;
        try {
            WorkflowRunner.Outcome outcome = runner.run(workflowId, taskId, trigger, dryRun);
            status = outcome.status();
            steps = outcome.steps();
        } catch (WorkflowRunner.RunFailed e) {
            status = "FAILED";
            steps = e.steps();
            error = e.getMessage();
        } catch (RuntimeException e) {
            log.error("Workflow {} crashed on task {}", workflowId, taskId, e);
            status = "FAILED";
            steps = List.of();
            error = "Unexpected error: " + e.getClass().getSimpleName();
        }
        return recorder.record(workflowId, taskId, trigger, dryRun, status, steps, error, started);
    }

}
