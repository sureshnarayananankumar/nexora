package com.nexora.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByProjectIdOrderByStatusAscPositionAsc(Long projectId);

    List<Task> findByProjectId(Long projectId);

    List<Task> findByProjectIdIn(Collection<Long> projectIds);

    List<Task> findByAssigneeIdAndStatusNotOrderByDueDateAsc(Long assigneeId, TaskStatus status);

    List<Task> findByProjectIdInAndDueDateBetween(Collection<Long> projectIds, LocalDate from, LocalDate to);

    long countByProjectIdAndStatusNot(Long projectId, TaskStatus status);

    long countByCreatedAtAfter(Instant after);

    long countByStatusAndCompletedAtAfter(TaskStatus status, Instant after);

    @Query("select coalesce(max(t.position), 0) from Task t where t.projectId = :projectId and t.status = :status")
    double maxPosition(@Param("projectId") Long projectId, @Param("status") TaskStatus status);

    @Query("select t from Task t where t.status <> com.nexora.task.TaskStatus.DONE and t.dueDate < :today")
    List<Task> findOverdue(@Param("today") LocalDate today);

    @Query("select t from Task t where t.status <> com.nexora.task.TaskStatus.DONE and t.dueDate = :day and t.assigneeId is not null")
    List<Task> findOpenDueOn(@Param("day") LocalDate day);

    /** For each task in the project: how many open tasks depend on it (i.e. it blocks). */
    @Query(value = """
            SELECT d.depends_on_task_id AS taskId, COUNT(*) AS blocking
            FROM task_dependencies d
            JOIN tasks t ON t.id = d.task_id
            WHERE t.project_id = :projectId AND t.status <> 'DONE'
            GROUP BY d.depends_on_task_id
            """, nativeQuery = true)
    List<Object[]> blockingCounts(@Param("projectId") Long projectId);

    Optional<Task> findByProjectIdAndTaskNumber(Long projectId, int taskNumber);
}
