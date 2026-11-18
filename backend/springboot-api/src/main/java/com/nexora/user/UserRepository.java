package com.nexora.user;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
    List<User> findByOrganizationIdOrderByFullNameAsc(Long organizationId);
    List<User> findByIdIn(Collection<Long> ids);
    long countByOrganizationIdAndStatus(Long organizationId, String status);
    long countByOrganizationId(Long organizationId);
    long countByRoleId(Long roleId);
    long countByCreatedAtAfter(Instant after);
    Optional<User> findByIdAndOrganizationId(Long id, Long organizationId);

    @Query("""
            select u from User u
            where (:q is null or lower(u.fullName) like lower(concat('%', :q, '%')) or lower(u.email) like lower(concat('%', :q, '%')))
              and (:status is null or u.status = :status)
              and (:roleId is null or u.role.id = :roleId)
              and (:orgId is null or u.organizationId = :orgId)
            """)
    Page<User> search(@Param("q") String q, @Param("status") String status, @Param("roleId") Long roleId,
                      @Param("orgId") Long orgId, Pageable pageable);
}
