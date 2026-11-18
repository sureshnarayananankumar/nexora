package com.nexora.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface TaskCommentRepository extends JpaRepository<TaskComment, Long> {
    List<TaskComment> findByTaskIdOrderByCreatedAtAsc(Long taskId);
    long countByTaskId(Long taskId);

    @Query("select c.taskId, count(c) from TaskComment c where c.taskId in :ids group by c.taskId")
    List<Object[]> countByTaskIds(@Param("ids") Collection<Long> ids);
}
