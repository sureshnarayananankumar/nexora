package com.nexora.task;

import com.nexora.project.Project;
import com.nexora.user.UserDirectory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Stream;

@Component
public class TaskMapper {

    private final UserDirectory directory;
    private final TaskCommentRepository comments;

    public TaskMapper(UserDirectory directory, TaskCommentRepository comments) {
        this.directory = directory;
        this.comments = comments;
    }

    public TaskDtos.TaskDto toDto(Task t, Project p) {
        return toDtos(List.of(t), Map.of(p.getId(), p)).get(0);
    }

    /** Batch mapping: one user lookup for the whole list. */
    public List<TaskDtos.TaskDto> toDtos(List<Task> list, Map<Long, Project> projects) {
        Set<Long> ids = new HashSet<>();
        list.forEach(t -> Stream.of(t.getAssigneeId(), t.getReporterId()).filter(Objects::nonNull).forEach(ids::add));
        Map<Long, UserDirectory.UserRef> refs = directory.refs(ids);
        Map<Long, Long> commentCounts = new HashMap<>();
        if (!list.isEmpty()) {
            comments.countByTaskIds(list.stream().map(Task::getId).toList())
                    .forEach(row -> commentCounts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue()));
        }
        return list.stream().map(t -> {
            Project p = projects.get(t.getProjectId());
            String key = (p == null ? "TASK" : p.getKey()) + "-" + t.getTaskNumber();
            return new TaskDtos.TaskDto(t.getId(), t.getProjectId(), key, t.getTitle(), t.getDescription(),
                    t.getStatus(), t.getPriority(), refs.get(t.getAssigneeId()), refs.get(t.getReporterId()),
                    t.getMilestoneId(), t.getStoryPoints(), t.getDueDate(), t.getPosition(), t.getBlockedReason(),
                    t.getDependsOn().stream().sorted().toList(), commentCounts.getOrDefault(t.getId(), 0L),
                    t.getStartedAt(), t.getCompletedAt(), t.getCreatedAt(), t.getUpdatedAt(), t.getVersion());
        }).toList();
    }
}
