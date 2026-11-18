package com.nexora.workflow;

import com.nexora.notification.NotificationService;
import com.nexora.project.Project;
import com.nexora.project.ProjectMember;
import com.nexora.project.ProjectMemberRepository;
import com.nexora.project.ProjectRepository;
import com.nexora.settings.SettingsService;
import com.nexora.task.*;
import com.nexora.user.User;
import com.nexora.user.UserDirectory;
import com.nexora.user.UserRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

/**
 * Walks a workflow graph for one task. Runs in its own transaction: if any action fails the
 * whole run is rolled back and reported as FAILED (the execution record is saved separately).
 */
@Component
public class WorkflowRunner {

    public record Outcome(String status, List<Map<String, Object>> steps) {
    }

    public static class RunFailed extends RuntimeException {
        private final transient List<Map<String, Object>> steps;

        RunFailed(String message, List<Map<String, Object>> steps) {
            super(message);
            this.steps = steps;
        }

        public List<Map<String, Object>> steps() { return steps; }
    }

    private final WorkflowRepository workflows;
    private final WorkflowNodeRepository nodes;
    private final WorkflowEdgeRepository edges;
    private final TaskRepository tasks;
    private final TaskService taskService;
    private final CommentService commentService;
    private final NotificationService notifications;
    private final ProjectRepository projects;
    private final ProjectMemberRepository members;
    private final UserRepository users;
    private final UserDirectory directory;
    private final SettingsService settings;

    public WorkflowRunner(WorkflowRepository workflows, WorkflowNodeRepository nodes, WorkflowEdgeRepository edges,
                          TaskRepository tasks, TaskService taskService, CommentService commentService,
                          NotificationService notifications, ProjectRepository projects,
                          ProjectMemberRepository members, UserRepository users, UserDirectory directory,
                          SettingsService settings) {
        this.workflows = workflows;
        this.nodes = nodes;
        this.edges = edges;
        this.tasks = tasks;
        this.taskService = taskService;
        this.commentService = commentService;
        this.notifications = notifications;
        this.projects = projects;
        this.members = members;
        this.users = users;
        this.directory = directory;
        this.settings = settings;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Outcome run(Long workflowId, Long taskId, TriggerType trigger, boolean dryRun) {
        Workflow wf = workflows.findById(workflowId).orElseThrow();
        Task task = tasks.findById(taskId).orElseThrow(() -> new RunFailed("Task no longer exists", List.of()));
        Project project = projects.findById(task.getProjectId()).orElseThrow();
        Map<String, WorkflowNode> byKey = new HashMap<>();
        nodes.findByWorkflowId(wf.getId()).forEach(n -> byKey.put(n.getNodeKey(), n));
        Map<String, List<WorkflowEdge>> out = new HashMap<>();
        edges.findByWorkflowId(wf.getId()).forEach(e -> out.computeIfAbsent(e.getSourceKey(), k -> new ArrayList<>()).add(e));

        List<Map<String, Object>> steps = new ArrayList<>();
        WorkflowNode trig = byKey.values().stream().filter(n -> "TRIGGER".equals(n.getNodeType())).findFirst()
                .orElseThrow(() -> new RunFailed("Workflow has no trigger", steps));

        Object toStatus = trig.getConfig() == null ? null : trig.getConfig().get("toStatus");
        if (trigger == TriggerType.TASK_STATUS_CHANGED && toStatus != null && !String.valueOf(toStatus).isBlank()
                && !task.getStatus().name().equals(String.valueOf(toStatus))) {
            steps.add(step(trig, "SKIPPED", "Task moved to " + task.getStatus() + ", trigger waits for " + toStatus, 0));
            return new Outcome("SKIPPED", steps);
        }
        steps.add(step(trig, "FIRED", "Triggered by " + trigger + " on " + project.getKey() + "-" + task.getTaskNumber(), 0));

        int maxSteps = settings.integer(SettingsService.WORKFLOW_MAX_STEPS, 50);
        int actionsRun = 0;
        Deque<String> queue = new ArrayDeque<>();
        out.getOrDefault(trig.getNodeKey(), List.of()).forEach(e -> queue.add(e.getTargetKey()));
        LocalDate today = LocalDate.now(ZoneOffset.UTC);

        while (!queue.isEmpty()) {
            if (steps.size() >= maxSteps) {
                steps.add(Map.of("node", "-", "result", "STOPPED", "message", "Reached the limit of " + maxSteps + " steps"));
                break;
            }
            WorkflowNode node = byKey.get(queue.poll());
            if (node == null) continue;
            long started = System.nanoTime();
            if ("CONDITION".equals(node.getNodeType())) {
                ConditionEvaluator.Result r = ConditionEvaluator.evaluate(node.getKind(), node.getConfig(), task, today);
                steps.add(step(node, r.value() ? "TRUE" : "FALSE", r.message(), started));
                String branch = r.value() ? "TRUE" : "FALSE";
                out.getOrDefault(node.getNodeKey(), List.of()).stream()
                        .filter(e -> branch.equals(e.getBranch())).forEach(e -> queue.add(e.getTargetKey()));
            } else {
                try {
                    String msg = dryRun ? "Would " + describe(node, task, project) : act(node, task, project, wf.getName());
                    steps.add(step(node, dryRun ? "DRY_RUN" : "DONE", msg, started));
                    actionsRun++;
                } catch (RuntimeException ex) {
                    steps.add(step(node, "ERROR", ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage(), started));
                    throw new RunFailed("Action \"" + label(node) + "\" failed: " + ex.getMessage(), steps);
                }
                out.getOrDefault(node.getNodeKey(), List.of()).forEach(e -> queue.add(e.getTargetKey()));
            }
        }
        return new Outcome(actionsRun > 0 ? "SUCCESS" : "SKIPPED", steps);
    }

    private String act(WorkflowNode node, Task task, Project project, String wfName) {
        Map<String, Object> cfg = node.getConfig() == null ? Map.of() : node.getConfig();
        String key = project.getKey() + "-" + task.getTaskNumber();
        String link = "/projects/" + project.getId() + "/board?task=" + task.getId();
        switch (node.getKind()) {
            case "SET_PRIORITY" -> {
                TaskPriority p = TaskPriority.valueOf(String.valueOf(cfg.get("priority")));
                taskService.automationSetPriority(task, p, wfName);
                return "Set priority to " + p;
            }
            case "SET_STATUS" -> {
                TaskStatus s = TaskStatus.valueOf(String.valueOf(cfg.get("status")));
                taskService.automationSetStatus(task, s, wfName);
                return "Moved to " + s;
            }
            case "ASSIGN_USER" -> {
                Long uid = asLong(cfg.get("userId"));
                taskService.automationAssign(task, uid, wfName);
                return "Assigned to " + directory.ref(uid).fullName();
            }
            case "ASSIGN_LEAST_LOADED" -> {
                User pick = leastLoaded(project);
                if (pick == null) return "No eligible project member to assign";
                taskService.automationAssign(task, pick.getId(), wfName);
                return "Assigned to " + pick.getFullName() + " (lowest utilisation)";
            }
            case "NOTIFY_ASSIGNEE" -> {
                if (task.getAssigneeId() == null) return "Task has no assignee; nobody notified";
                notifications.notify(project.getOrganizationId(), task.getAssigneeId(), null, "WORKFLOW",
                        "⚡ " + wfName + " · " + key, fill(cfg.get("message"), task, project), link);
                return "Notified " + directory.ref(task.getAssigneeId()).fullName();
            }
            case "NOTIFY_USER" -> {
                Long uid = asLong(cfg.get("userId"));
                User u = users.findByIdAndOrganizationId(uid, project.getOrganizationId())
                        .orElseThrow(() -> new IllegalArgumentException("Person no longer exists in this organisation"));
                notifications.notify(project.getOrganizationId(), u.getId(), null, "WORKFLOW",
                        "⚡ " + wfName + " · " + key, fill(cfg.get("message"), task, project), link);
                return "Notified " + u.getFullName();
            }
            case "NOTIFY_PROJECT_OWNER" -> {
                notifications.notify(project.getOrganizationId(), project.getOwnerId(), null, "WORKFLOW",
                        "⚡ " + wfName + " · " + key, fill(cfg.get("message"), task, project), link);
                return "Notified project owner " + directory.ref(project.getOwnerId()).fullName();
            }
            case "ADD_COMMENT" -> {
                commentService.addAutomated(task, fill(cfg.get("text"), task, project), wfName);
                return "Posted a comment";
            }
            default -> throw new IllegalArgumentException("Unknown action " + node.getKind());
        }
    }

    private String describe(WorkflowNode node, Task task, Project project) {
        Map<String, Object> cfg = node.getConfig() == null ? Map.of() : node.getConfig();
        return switch (node.getKind()) {
            case "SET_PRIORITY" -> "set priority to " + cfg.get("priority");
            case "SET_STATUS" -> "move to " + cfg.get("status");
            case "ASSIGN_USER" -> "assign to " + directory.ref(asLong(cfg.get("userId"))).fullName();
            case "ASSIGN_LEAST_LOADED" -> {
                User u = leastLoaded(project);
                yield u == null ? "find no eligible member" : "assign to " + u.getFullName();
            }
            case "NOTIFY_ASSIGNEE" -> task.getAssigneeId() == null ? "skip notifying (no assignee)"
                    : "notify " + directory.ref(task.getAssigneeId()).fullName() + ": \"" + fill(cfg.get("message"), task, project) + "\"";
            case "NOTIFY_USER" -> "notify " + directory.ref(asLong(cfg.get("userId"))).fullName() + ": \"" + fill(cfg.get("message"), task, project) + "\"";
            case "NOTIFY_PROJECT_OWNER" -> "notify the project owner: \"" + fill(cfg.get("message"), task, project) + "\"";
            case "ADD_COMMENT" -> "comment \"" + fill(cfg.get("text"), task, project) + "\"";
            default -> "run " + node.getKind();
        };
    }

    /** Active, non-viewer project member with the lowest organisation-wide utilisation. */
    private User leastLoaded(Project project) {
        User best = null;
        double bestUtil = Double.MAX_VALUE;
        for (ProjectMember m : members.findByIdProjectId(project.getId())) {
            if ("VIEWER".equals(m.getProjectRole())) continue;
            User u = users.findById(m.userId()).orElse(null);
            if (u == null || !u.isActive()) continue;
            int points = tasks.findByAssigneeIdAndStatusNotOrderByDueDateAsc(u.getId(), TaskStatus.DONE).stream()
                    .mapToInt(Task::effectivePoints).sum();
            double util = points / (double) Math.max(u.getCapacityPoints(), 1);
            if (util < bestUtil) {
                bestUtil = util;
                best = u;
            }
        }
        return best;
    }

    private String fill(Object template, Task t, Project p) {
        String s = template == null ? "" : String.valueOf(template);
        return s.replace("{task}", p.getKey() + "-" + t.getTaskNumber())
                .replace("{title}", t.getTitle())
                .replace("{status}", t.getStatus().name())
                .replace("{priority}", t.getPriority().name())
                .replace("{assignee}", t.getAssigneeId() == null ? "nobody" : directory.ref(t.getAssigneeId()).fullName())
                .replace("{project}", p.getName());
    }

    private static Long asLong(Object v) {
        if (v instanceof Number n) return n.longValue();
        return Long.parseLong(String.valueOf(v).replace(".0", ""));
    }

    private static String label(WorkflowNode n) {
        return n.getLabel() == null || n.getLabel().isBlank() ? n.getKind() : n.getLabel();
    }

    private static Map<String, Object> step(WorkflowNode n, String result, String message, long startedNanos) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("node", n.getNodeKey());
        m.put("type", n.getNodeType());
        m.put("kind", n.getKind());
        m.put("label", label(n));
        m.put("result", result);
        m.put("message", message);
        m.put("ms", startedNanos == 0 ? 0 : Math.max(0, (System.nanoTime() - startedNanos) / 1_000_000));
        return m;
    }
}
