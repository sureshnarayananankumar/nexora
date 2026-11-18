package com.nexora.project;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    Optional<Project> findByIdAndOrganizationId(Long id, Long organizationId);
    boolean existsByOrganizationIdAndKey(Long organizationId, String key);
    long countByOrganizationIdAndStatusNot(Long organizationId, String status);
    List<Project> findByOrganizationIdAndStatusNotOrderByNameAsc(Long organizationId, String status);
    List<Project> findByStatusNot(String status);

    @Query("""
            select p from Project p
            where p.organizationId = :orgId and p.status <> 'ARCHIVED'
              and exists (select 1 from ProjectMember m where m.id.projectId = p.id and m.id.userId = :userId)
            order by p.name
            """)
    List<Project> findVisibleForMember(@Param("orgId") Long orgId, @Param("userId") Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Project p where p.id = :id")
    Optional<Project> lockById(@Param("id") Long id);

    @Query("""
            select p from Project p
            where (:q is null or lower(p.name) like lower(concat('%', :q, '%')))
              and (:status is null or p.status = :status)
              and (:orgId is null or p.organizationId = :orgId)
            """)
    Page<Project> search(@Param("q") String q, @Param("status") String status, @Param("orgId") Long orgId, Pageable pageable);
}
