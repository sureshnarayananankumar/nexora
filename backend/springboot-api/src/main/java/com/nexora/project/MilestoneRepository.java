package com.nexora.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MilestoneRepository extends JpaRepository<Milestone, Long> {
    List<Milestone> findByProjectIdOrderByDueDateAsc(Long projectId);
    Optional<Milestone> findByIdAndProjectId(Long id, Long projectId);
    List<Milestone> findByProjectIdInAndDueDateBetween(Collection<Long> projectIds, LocalDate from, LocalDate to);
}
