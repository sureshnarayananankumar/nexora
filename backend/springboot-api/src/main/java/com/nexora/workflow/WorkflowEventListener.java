package com.nexora.workflow;

import com.nexora.task.TaskDomainEvent;
import com.nexora.task.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;

/** Connects domain events (after commit) and the overdue scheduler to the workflow engine. */
@Component
public class WorkflowEventListener {

    private static final Logger log = LoggerFactory.getLogger(WorkflowEventListener.class);

    private final WorkflowRepository workflows;
    private final WorkflowDispatcher dispatcher;
    private final WorkflowExecutionRepository executions;
    private final TaskRepository tasks;
    private final com.nexora.project.ProjectRepository projects;

    public WorkflowEventListener(WorkflowRepository workflows, WorkflowDispatcher dispatcher,
                                 WorkflowExecutionRepository executions, TaskRepository tasks,
                                 com.nexora.project.ProjectRepository projects) {
        this.workflows = workflows;
        this.dispatcher = dispatcher;
        this.executions = executions;
        this.tasks = tasks;
        this.projects = projects;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onTaskEvent(TaskDomainEvent e) {
        for (Workflow wf : workflows.findActive(e.organizationId(), e.projectId(), e.trigger())) {
            try {
                dispatcher.execute(wf.getId(), e.taskId(), e.trigger(), false);
            } catch (RuntimeException ex) {
                log.error("Workflow {} failed to dispatch for task {}", wf.getId(), e.taskId(), ex);
            }
        }
    }

    /** TASK_OVERDUE triggers: every 15 minutes, at most once per workflow/task per 24 h. */
    @Scheduled(fixedDelay = 900_000, initialDelay = 120_000)
    public void checkOverdue() {
        var overdueWorkflows = workflows.findByEnabledTrueAndTriggerType(TriggerType.TASK_OVERDUE);
        if (overdueWorkflows.isEmpty()) return;
        var overdue = tasks.findOverdue(LocalDate.now(ZoneOffset.UTC));
        Instant dayAgo = Instant.now().minus(24, ChronoUnit.HOURS);
        for (Workflow wf : overdueWorkflows) {
            for (var t : overdue) {
                boolean inScope = wf.getProjectId() != null ? wf.getProjectId().equals(t.getProjectId())
                        : projects.findById(t.getProjectId()).map(p -> p.getOrganizationId().equals(wf.getOrganizationId())).orElse(false);
                if (!inScope) continue;
                if (executions.existsByWorkflowIdAndTaskIdAndTriggerEventAndDryRunFalseAndStartedAtAfter(
                        wf.getId(), t.getId(), TriggerType.TASK_OVERDUE.name(), dayAgo)) continue;
                dispatcher.execute(wf.getId(), t.getId(), TriggerType.TASK_OVERDUE, false);
            }
        }
    }
}
