package com.nexora.task;

import com.nexora.activity.ActivityService;
import com.nexora.common.ApiException;
import com.nexora.common.Jsons;
import com.nexora.events.RealtimeEvent;
import com.nexora.notification.NotificationService;
import com.nexora.project.Project;
import com.nexora.project.ProjectAccess;
import com.nexora.security.AuthUser;
import com.nexora.user.UserDirectory;
import com.nexora.workflow.TriggerType;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class CommentService {

    private final TaskCommentRepository comments;
    private final com.nexora.project.ProjectRepository projects;
    private final TaskService taskService;
    private final ProjectAccess access;
    private final UserDirectory directory;
    private final ActivityService activity;
    private final NotificationService notifications;
    private final ApplicationEventPublisher events;

    public CommentService(TaskCommentRepository comments, com.nexora.project.ProjectRepository projects, TaskService taskService, ProjectAccess access,
                          UserDirectory directory, ActivityService activity, NotificationService notifications,
                          ApplicationEventPublisher events) {
        this.comments = comments;
        this.projects = projects;
        this.taskService = taskService;
        this.access = access;
        this.directory = directory;
        this.activity = activity;
        this.notifications = notifications;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public List<TaskDtos.CommentDto> list(Long taskId, AuthUser me) {
        Task t = taskService.load(taskId);
        access.require(t.getProjectId(), me, ProjectAccess.Level.READ);
        List<TaskComment> list = comments.findByTaskIdOrderByCreatedAtAsc(taskId);
        Map<Long, UserDirectory.UserRef> refs = directory.refs(list.stream().map(TaskComment::getAuthorId).toList());
        return list.stream().map(c -> toDto(c, refs.get(c.getAuthorId()))).toList();
    }

    @Transactional
    public TaskDtos.CommentDto add(Long taskId, TaskDtos.CommentRequest req, AuthUser me) {
        if (!me.can("COMMENT_WRITE")) throw ApiException.forbidden("You can't comment");
        Task t = taskService.load(taskId);
        Project p = access.require(t.getProjectId(), me, ProjectAccess.Level.READ);
        if ("ARCHIVED".equals(p.getStatus())) throw ApiException.badRequest("PROJECT_ARCHIVED", "This project is archived");
        TaskComment c = new TaskComment();
        c.setTaskId(t.getId());
        c.setAuthorId(me.id());
        c.setBody(req.body().trim());
        comments.save(c);
        TaskDtos.CommentDto dto = toDto(c, directory.ref(me.id()));

        String key = p.getKey() + "-" + t.getTaskNumber();
        activity.record(me.organizationId(), p.getId(), me.id(), "COMMENT_ADDED", "TASK", t.getId(),
                me.fullName() + " commented on " + key, Jsons.map("commentId", c.getId()));
        events.publishEvent(RealtimeEvent.toProject("comment.created", me.organizationId(), p.getId(), dto));

        Set<Long> recipients = new LinkedHashSet<>();
        if (t.getAssigneeId() != null) recipients.add(t.getAssigneeId());
        if (t.getReporterId() != null) recipients.add(t.getReporterId());
        String preview = c.getBody().length() > 140 ? c.getBody().substring(0, 137) + "..." : c.getBody();
        recipients.forEach(uid -> notifications.notify(me.organizationId(), uid, me.id(), "COMMENT_ADDED",
                me.fullName() + " commented on " + key, preview, TaskService.link(p, t)));

        events.publishEvent(new TaskDomainEvent(TriggerType.COMMENT_ADDED, me.organizationId(), p.getId(), t.getId(),
                me.id(), c.getBody()));
        return dto;
    }

    /** Comment written by a workflow action. Attributed to the task's reporter and flagged as automated. */
    @Transactional
    public void addAutomated(Task t, String body, String workflowName) {
        TaskComment c = new TaskComment();
        c.setTaskId(t.getId());
        c.setAuthorId(t.getReporterId());
        c.setAutomated(true);
        c.setBody("⚡ " + workflowName + ": " + body);
        comments.save(c);
        Long orgId = projects.findById(t.getProjectId()).map(Project::getOrganizationId).orElse(null);
        events.publishEvent(RealtimeEvent.toProject("comment.created", orgId, t.getProjectId(),
                toDto(c, directory.ref(c.getAuthorId()))));
    }

    @Transactional
    public void delete(Long commentId, AuthUser me) {
        TaskComment c = comments.findById(commentId).orElseThrow(() -> ApiException.notFound("Comment"));
        Task t = taskService.load(c.getTaskId());
        Project p = access.require(t.getProjectId(), me, ProjectAccess.Level.READ);
        if (!c.getAuthorId().equals(me.id()) || c.isAutomated()) {
            access.require(p.getId(), me, ProjectAccess.Level.MANAGE);
        }
        comments.delete(c);
        events.publishEvent(RealtimeEvent.toProject("comment.deleted", me.organizationId(), p.getId(),
                Jsons.map("id", c.getId(), "taskId", t.getId())));
    }

    private static TaskDtos.CommentDto toDto(TaskComment c, UserDirectory.UserRef author) {
        return new TaskDtos.CommentDto(c.getId(), c.getTaskId(), author, c.getBody(), c.isAutomated(), c.getCreatedAt());
    }
}
