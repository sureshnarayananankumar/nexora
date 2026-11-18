package com.nexora.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    @Query("""
            select a from AuditLog a
            where (:action is null or a.action = :action)
              and (:entityType is null or a.entityType = :entityType)
              and (:orgId is null or a.organizationId = :orgId)
              and (:q is null or lower(a.actorEmail) like lower(concat('%', :q, '%')) or a.entityId = :q)
              and (:from is null or a.createdAt >= :from)
              and (:to is null or a.createdAt < :to)
            """)
    Page<AuditLog> search(@Param("action") String action, @Param("entityType") String entityType,
                          @Param("orgId") Long orgId, @Param("q") String q,
                          @Param("from") Instant from, @Param("to") Instant to, Pageable pageable);
}
