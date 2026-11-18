package com.nexora.workflow;

import com.nexora.activity.ActivityService;
import com.nexora.audit.AuditService;
import com.nexora.common.ApiException;
import com.nexora.common.Jsons;
import com.nexora.common.PageResponse;
import com.nexora.organization.PlanLimits;
import com.nexora.project.Project;
import com.nexora.project.ProjectAccess;
import com.nexora.project.ProjectMemberRepository;
import com.nexora.project.ProjectRepository;
import com.nexora.security.AuthUser;
import com.nexora.task.Task;
import com.nexora.task.TaskService;
import com.nexora.user.UserDirectory;
import com.nexora.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class WorkflowService {

    private final WorkflowRepository workflows;
    private final WorkflowNodeRepository nodes;
    private final WorkflowEdgeRepository edges;
    private final WorkflowExecutionRepository executions;
    private final ProjectRepository projects;
    private final ProjectMemberRepository members;
    private final ProjectAccess access;
    private final UserRepository users;
    private final UserDirectory directory;
    private final PlanLimits limits;
    private final AuditService audit;
    private final ActivityService activity;
    private final WorkflowDispatcher dispatcher;
    private final TaskService taskService;

    public WorkflowService(WorkflowRepository workflows, WorkflowNodeRepository nodes, WorkflowEdgeRepository edges,
                           WorkflowExecutionRepository executions, ProjectRepository projects,
                           ProjectMemberRepository members, ProjectAccess access, UserRepository users,
                           UserDirectory directory, PlanLimits limits, AuditService audit, ActivityService activity,
                           WorkflowDispatcher dispatcher, TaskService taskService) {
        this.workflows = workflows;
        this.nodes = nodes;
        this.edges = edges;
        this.executions = executions;
        this.projects = projects;
        this.members = members;
        this.access = access;
        this.users = users;
        this.directory = directory;
        this.limits = limits;
        this.audit = audit;
        this.activity = activity;
        this.dispatcher = dispatcher;
        this.taskService = taskService;
    }

    @Transactional(readOnly = true)
    public List<WorkflowDtos.WorkflowSummary> list(AuthUser me) {
        Set<Long> visible = new HashSet<>(access.visibleProjectIds(me));
        return workflows.findByOrganizationIdOrderByUpdatedAtDesc(me.organizationId()).stream()
                .filter(w -> w.getProjectId() == null || visible.contains(w.getProjectId()))
                .map(this::summary).toList();
    }

    @Transactional(readOnly = true)
    public WorkflowDtos.WorkflowDetail get(Long id, AuthUser me) {
        Workflow w = load(id, me);
        return detail(w);
    }

    @Transactional
    public WorkflowDtos.WorkflowDetail create(WorkflowDtos.SaveWorkflowRequest req, AuthUser me) {
        requireManage(me);
        limits.checkWorkflows(me.organizationId());
        TriggerType trigger = validate(req, me);
        Workflow w = new Workflow();
        w.setOrganizationId(me.organizationId());
        w.setCreatedBy(me.id());
        apply(w, req, trigger);
        workflows.save(w);
        replaceGraph(w, req);
        audit.log("WORKFLOW_CREATED", "WORKFLOW", w.getId(), Jsons.map("name", w.getName(), "trigger", trigger.name()));
        activity.record(me.organizationId(), w.getProjectId(), me.id(), "WORKFLOW_CREATED", "WORKFLOW", w.getId(),
                me.fullName() + " created workflow \"" + w.getName() + "\"", null);
        return detail(w);
    }

    @Transactional
    public WorkflowDtos.WorkflowDetail update(Long id, WorkflowDtos.SaveWorkflowRequest req, AuthUser me) {
        requireManage(me);
        Workflow w = load(id, me);
        TriggerType trigger = validate(req, me);
        apply(w, req, trigger);
        replaceGraph(w, req);
        workflows.saveAndFlush(w);
        audit.log("WORKFLOW_UPDATED", "WORKFLOW", w.getId(), Jsons.map("name", w.getName(), "enabled", w.isEnabled()));
        return detail(w);
    }

    @Transactional
    public WorkflowDtos.WorkflowSummary toggle(Long id, boolean enabled, AuthUser me) {
        requireManage(me);
        Workflow w = load(id, me);
        w.setEnabled(enabled);
        audit.log(enabled ? "WORKFLOW_ENABLED" : "WORKFLOW_DISABLED", "WORKFLOW", w.getId(), Jsons.map("name", w.getName()));
        return summary(w);
    }

    @Transactional
    public void delete(Long id, AuthUser me) {
        requireManage(me);
        Workflow w = load(id, me);
        workflows.delete(w);
        audit.log("WORKFLOW_DELETED", "WORKFLOW", id, Jsons.map("name", w.getName()));
    }

    /** Dry run against a real task: conditions are evaluated, actions are described but not applied. */
    public WorkflowDtos.ExecutionDto test(Long id, Long taskId, AuthUser me) {
        Workflow w = loadReadOnly(id, me);
        Task t = taskService.load(taskId);
        Project p = access.require(t.getProjectId(), me, ProjectAccess.Level.READ);
        if (w.getProjectId() != null && !w.getProjectId().equals(p.getId())) {
            throw ApiException.badRequest("OUT_OF_SCOPE", "This workflow only applies to another project");
        }
        WorkflowExecution ex = dispatcher.execute(w.getId(), t.getId(), w.getTriggerType(), true);
        return toDto(ex, w.getName());
    }

    @Transactional(readOnly = true)
    public PageResponse<WorkflowDtos.ExecutionDto> executions(Long workflowId, AuthUser me, int page, int size) {
        var pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100));
        if (workflowId != null) {
            Workflow w = load(workflowId, me);
            return PageResponse.of(executions.findByWorkflowIdOrderByStartedAtDesc(w.getId(), pageable), e -> toDto(e, w.getName()));
        }
        Map<Long, String> names = new HashMap<>();
        workflows.findByOrganizationIdOrderByUpdatedAtDesc(me.organizationId()).forEach(w -> names.put(w.getId(), w.getName()));
        return PageResponse.of(executions.findForOrganization(me.organizationId(), pageable),
                e -> toDto(e, names.getOrDefault(e.getWorkflowId(), "Workflow")));
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private TriggerType validate(WorkflowDtos.SaveWorkflowRequest req, AuthUser me) {
        List<String> errors = new ArrayList<>(GraphValidator.validate(req.nodes(), req.edges()));
        if (req.projectId() != null) {
            access.require(req.projectId(), me, ProjectAccess.Level.MANAGE);
        } else if (!me.seesAllOrgProjects()) {
            errors.add("Only organisation admins can create organisation-wide workflows; pick a project");
        }
        // People referenced by actions must belong to the organisation (and the project, for assignment).
        for (WorkflowDtos.NodeDto n : req.nodes()) {
            if (n.config() == null || !n.config().containsKey("userId")) continue;
            Long uid;
            try {
                uid = Long.parseLong(String.valueOf(n.config().get("userId")).replace(".0", ""));
            } catch (NumberFormatException e) {
                continue; // already reported by GraphValidator
            }
            if (users.findByIdAndOrganizationId(uid, me.organizationId()).isEmpty()) {
                errors.add("\"" + n.label() + "\" refers to someone outside your organisation");
            } else if ("ASSIGN_USER".equals(n.kind()) && req.projectId() != null
                    && !members.existsByIdProjectIdAndIdUserId(req.projectId(), uid)) {
                errors.add("\"" + n.label() + "\" assigns to someone who isn't a member of the project");
            }
        }
        if (!errors.isEmpty()) {
            throw ApiException.badRequest("INVALID_WORKFLOW", String.join(" · ", errors));
        }
        String kind = req.nodes().stream().filter(n -> "TRIGGER".equals(n.type())).findFirst().orElseThrow().kind();
        return TriggerType.valueOf(kind);
    }

    private void apply(Workflow w, WorkflowDtos.SaveWorkflowRequest req, TriggerType trigger) {
        w.setName(req.name().trim());
        w.setDescription(req.description());
        w.setProjectId(req.projectId());
        w.setEnabled(req.enabled());
        w.setTriggerType(trigger);
    }

    private void replaceGraph(Workflow w, WorkflowDtos.SaveWorkflowRequest req) {
        edges.deleteByWorkflowId(w.getId());
        nodes.deleteByWorkflowId(w.getId());
        nodes.flush();
        for (WorkflowDtos.NodeDto n : req.nodes()) {
            WorkflowNode node = new WorkflowNode();
            node.setWorkflowId(w.getId());
            node.setNodeKey(n.key());
            node.setNodeType(n.type());
            node.setKind(n.kind());
            node.setLabel(n.label());
            node.setConfig(n.config() == null ? new HashMap<>() : new HashMap<>(n.config()));
            node.setPositionX(n.x());
            node.setPositionY(n.y());
            nodes.save(node);
        }
        for (WorkflowDtos.EdgeDto e : req.edges()) {
            WorkflowEdge edge = new WorkflowEdge();
            edge.setWorkflowId(w.getId());
            edge.setSourceKey(e.source());
            edge.setTargetKey(e.target());
            edge.setBranch(e.branch());
            edges.save(edge);
        }
    }

    private void requireManage(AuthUser me) {
        if (!me.can("WORKFLOW_MANAGE")) throw ApiException.forbidden("You can't manage workflows");
    }

    private Workflow load(Long id, AuthUser me) {
        Workflow w = workflows.findByIdAndOrganizationId(id, me.organizationId())
                .orElseThrow(() -> ApiException.notFound("Workflow"));
        if (w.getProjectId() != null) access.require(w.getProjectId(), me, ProjectAccess.Level.READ);
        return w;
    }

    private Workflow loadReadOnly(Long id, AuthUser me) {
        return load(id, me);
    }

    private WorkflowDtos.WorkflowSummary summary(Workflow w) {
        String projectName = w.getProjectId() == null ? null
                : projects.findById(w.getProjectId()).map(Project::getName).orElse(null);
        return new WorkflowDtos.WorkflowSummary(w.getId(), w.getName(), w.getDescription(), w.getProjectId(),
                projectName, w.getTriggerType(), w.isEnabled(), w.getRunCount(), w.getLastRunAt(),
                nodes.findByWorkflowId(w.getId()).size(), directory.ref(w.getCreatedBy()), w.getUpdatedAt());
    }

    private WorkflowDtos.WorkflowDetail detail(Workflow w) {
        List<WorkflowDtos.NodeDto> ns = nodes.findByWorkflowId(w.getId()).stream()
                .map(n -> new WorkflowDtos.NodeDto(n.getNodeKey(), n.getNodeType(), n.getKind(), n.getLabel(),
                        n.getConfig(), n.getPositionX(), n.getPositionY()))
                .toList();
        List<WorkflowDtos.EdgeDto> es = edges.findByWorkflowId(w.getId()).stream()
                .map(e -> new WorkflowDtos.EdgeDto(e.getSourceKey(), e.getTargetKey(), e.getBranch()))
                .toList();
        return new WorkflowDtos.WorkflowDetail(summary(w), ns, es, w.getVersion());
    }

    static WorkflowDtos.ExecutionDto toDto(WorkflowExecution e, String name) {
        return new WorkflowDtos.ExecutionDto(e.getId(), e.getWorkflowId(), name, e.getTriggerEvent(), e.getTaskId(),
                e.getStatus(), e.isDryRun(), e.getSteps(), e.getErrorMessage(), e.getStartedAt(), e.getDurationMs());
    }
}
