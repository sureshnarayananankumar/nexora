package com.nexora.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WorkflowEdgeRepository extends JpaRepository<WorkflowEdge, Long> {
    List<WorkflowEdge> findByWorkflowId(Long workflowId);

    @Modifying
    @Query("delete from WorkflowEdge e where e.workflowId = :workflowId")
    void deleteByWorkflowId(@Param("workflowId") Long workflowId);
}
