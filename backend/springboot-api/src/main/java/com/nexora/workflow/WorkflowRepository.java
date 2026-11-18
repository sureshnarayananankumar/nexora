package com.nexora.workflow;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface WorkflowRepository extends JpaRepository<Workflow, Long> {
    List<Workflow> findByOrganizationIdOrderByUpdatedAtDesc(Long organizationId);
    Optional<Workflow> findByIdAndOrganizationId(Long id, Long organizationId);
    long countByOrganizationId(Long organizationId);

    @Query("""
            select w from Workflow w
            where w.organizationId = :orgId and w.enabled = true and w.triggerType = :trigger
              and (w.projectId is null or w.projectId = :projectId)
            """)
    List<Workflow> findActive(@Param("orgId") Long orgId, @Param("projectId") Long projectId, @Param("trigger") TriggerType trigger);

    List<Workflow> findByEnabledTrueAndTriggerType(TriggerType trigger);
}
