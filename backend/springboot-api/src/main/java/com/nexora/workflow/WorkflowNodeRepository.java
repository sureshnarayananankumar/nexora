package com.nexora.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WorkflowNodeRepository extends JpaRepository<WorkflowNode, Long> {
    List<WorkflowNode> findByWorkflowId(Long workflowId);

    @Modifying
    @Query("delete from WorkflowNode n where n.workflowId = :workflowId")
    void deleteByWorkflowId(@Param("workflowId") Long workflowId);
}
