package com.nexora.workflow;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface WorkflowExecutionRepository extends JpaRepository<WorkflowExecution, Long> {
    Page<WorkflowExecution> findByWorkflowIdOrderByStartedAtDesc(Long workflowId, Pageable pageable);

    @Query("""
            select e from WorkflowExecution e
            where e.workflowId in (select w.id from Workflow w where w.organizationId = :orgId)
            order by e.startedAt desc
            """)
    Page<WorkflowExecution> findForOrganization(@Param("orgId") Long orgId, Pageable pageable);

    boolean existsByWorkflowIdAndTaskIdAndTriggerEventAndDryRunFalseAndStartedAtAfter(
            Long workflowId, Long taskId, String triggerEvent, Instant after);

    long countByStartedAtAfter(Instant after);

    long countByStatusAndStartedAtAfter(String status, Instant after);
}
