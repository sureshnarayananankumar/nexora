package com.nexora.organization;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrganizationRepository extends JpaRepository<Organization, Long> {
    boolean existsBySlug(String slug);

    @Query("""
            select o from Organization o
            where (:q is null or lower(o.name) like lower(concat('%', :q, '%')) or lower(o.slug) like lower(concat('%', :q, '%')))
              and (:status is null or o.status = :status)
            """)
    Page<Organization> search(@Param("q") String q, @Param("status") String status, Pageable pageable);

    long countByPlanId(Long planId);
}
