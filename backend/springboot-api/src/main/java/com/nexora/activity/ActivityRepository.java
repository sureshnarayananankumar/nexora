package com.nexora.activity;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;

public interface ActivityRepository extends JpaRepository<Activity, Long> {
    Page<Activity> findByProjectIdOrderByCreatedAtDesc(Long projectId, Pageable pageable);

    @Query("""
            select a from Activity a
            where a.organizationId = :orgId and (a.projectId is null or a.projectId in :projectIds)
            order by a.createdAt desc
            """)
    Page<Activity> findForProjects(@Param("orgId") Long orgId, @Param("projectIds") Collection<Long> projectIds, Pageable pageable);

    Page<Activity> findByEntityTypeAndEntityIdOrderByCreatedAtDesc(String entityType, Long entityId, Pageable pageable);
}
