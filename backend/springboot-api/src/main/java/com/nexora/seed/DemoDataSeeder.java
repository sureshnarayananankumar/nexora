package com.nexora.seed;

import com.nexora.activity.Activity;
import com.nexora.activity.ActivityRepository;
import com.nexora.config.NexoraProperties;
import com.nexora.notification.Notification;
import com.nexora.notification.NotificationRepository;
import com.nexora.organization.Organization;
import com.nexora.organization.OrganizationRepository;
import com.nexora.plan.PlanRepository;
import com.nexora.project.*;
import com.nexora.role.RoleRepository;
import com.nexora.task.*;
import com.nexora.user.User;
import com.nexora.user.UserRepository;
import com.nexora.workflow.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Local-development demo data. Runs only when NEXORA_SEED_DEMO=true and NEXORA_DEMO_PASSWORD is set,
 * and only once (it checks for the demo admin account). Dates are relative to "today" so the
 * insights and analytics always look alive.
 */
@Component
public class DemoDataSeeder {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    static final String ADMIN_EMAIL = "admin@nexora.dev";

    private final NexoraProperties props;
    private final TransactionTemplate tx;
    private final JdbcTemplate jdbc;
    private final PasswordEncoder encoder;
    private final UserRepository users;
    private final RoleRepository roles;
    private final OrganizationRepository orgs;
    private final PlanRepository plans;
    private final ProjectRepository projects;
    private final ProjectMemberRepository members;
    private final MilestoneRepository milestones;
    private final TaskRepository tasks;
    private final TaskCommentRepository comments;
    private final WorkflowRepository workflows;
    private final WorkflowNodeRepository nodes;
    private final WorkflowEdgeRepository edges;
    private final WorkflowExecutionRepository executions;
    private final ActivityRepository activities;
    private final NotificationRepository notifications;

    private String passwordHash;
    private final LocalDate today = LocalDate.now(ZoneOffset.UTC);
    private final Instant now = Instant.now();

    public DemoDataSeeder(NexoraProperties props, TransactionTemplate tx, JdbcTemplate jdbc, PasswordEncoder encoder,
                          UserRepository users, RoleRepository roles, OrganizationRepository orgs, PlanRepository plans,
                          ProjectRepository projects, ProjectMemberRepository members, MilestoneRepository milestones,
                          TaskRepository tasks, TaskCommentRepository comments, WorkflowRepository workflows,
                          WorkflowNodeRepository nodes, WorkflowEdgeRepository edges,
                          WorkflowExecutionRepository executions, ActivityRepository activities,
                          NotificationRepository notifications) {
        this.props = props;
        this.tx = tx;
        this.jdbc = jdbc;
        this.encoder = encoder;
        this.users = users;
        this.roles = roles;
        this.orgs = orgs;
        this.plans = plans;
        this.projects = projects;
        this.members = members;
        this.milestones = milestones;
        this.tasks = tasks;
        this.comments = comments;
        this.workflows = workflows;
        this.nodes = nodes;
        this.edges = edges;
        this.executions = executions;
        this.activities = activities;
        this.notifications = notifications;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void seed() {
        if (!props.seedDemo()) return;
        if (props.demoPassword() == null || props.demoPassword().isBlank()) {
            log.warn("NEXORA_SEED_DEMO=true but NEXORA_DEMO_PASSWORD is empty; skipping demo data");
            return;
        }
        if (users.existsByEmailIgnoreCase(ADMIN_EMAIL)) {
            log.info("Demo data already present");
            return;
        }
        passwordHash = encoder.encode(props.demoPassword());
        tx.executeWithoutResult(s -> seedAll());
        log.info("Demo data created. Log in as {} (admin console) or sarah@acme.dev (app)", ADMIN_EMAIL);
    }

    private void seedAll() {
        Organization platform = orgs.findAll().stream().filter(o -> "nexora-platform".equals(o.getSlug())).findFirst().orElseThrow();
        user(platform, "SUPER_ADMIN", ADMIN_EMAIL, "Nora Admin", "Platform Operations", "#0F172A", 20);

        // ── Acme Robotics (the showcase tenant) ─────────────────────────
        Organization acme = org("Acme Robotics", "acme-robotics", "GROWTH", "Robotics", 120);
        User sarah = user(acme, "ORG_ADMIN", "sarah@acme.dev", "Sarah Chen", "VP Engineering", "#6366F1", 20);
        User rahul = user(acme, "MANAGER", "rahul@acme.dev", "Rahul Mehta", "Engineering Manager", "#0EA5E9", 18);
        User mei = user(acme, "MEMBER", "mei@acme.dev", "Mei Tanaka", "Frontend Engineer", "#EC4899", 20);
        User diego = user(acme, "MEMBER", "diego@acme.dev", "Diego Alvarez", "Backend Engineer", "#F59E0B", 14);
        User aisha = user(acme, "MEMBER", "aisha@acme.dev", "Aisha Bello", "QA Engineer", "#10B981", 20);
        User tom = user(acme, "MEMBER", "tom@acme.dev", "Tom Fischer", "Product Designer", "#8B5CF6", 14);
        List<User> team = List.of(sarah, rahul, mei, diego, aisha, tom);

        Project atlas = project(acme, "ATL", "Atlas Mobile App", "Cross-platform field-technician app with offline sync.",
                "#6366F1", rahul, -60, 20, team);
        Milestone beta = milestone(atlas, "Public beta", 5);
        Milestone launch = milestone(atlas, "App Store launch", 20);
        Map<String, Task> a = new LinkedHashMap<>();
        a.put("auth", task(atlas, "Offline-first auth token storage", TaskStatus.DONE, TaskPriority.HIGH, diego, 5, -40, 55, 38, null));
        a.put("sync", task(atlas, "Background sync engine for work orders", TaskStatus.IN_PROGRESS, TaskPriority.CRITICAL, diego, 8, 2, 45, null, beta));
        a.put("conflict", task(atlas, "Conflict resolution for concurrent edits", TaskStatus.TODO, TaskPriority.HIGH, diego, 8, 4, 30, null, beta));
        a.put("push", task(atlas, "Push notifications for new assignments", TaskStatus.TODO, TaskPriority.MEDIUM, diego, 5, 12, 20, null, launch));
        a.put("onboard", task(atlas, "Onboarding flow redesign", TaskStatus.IN_REVIEW, TaskPriority.MEDIUM, tom, 3, 1, 25, null, beta));
        a.put("dark", task(atlas, "Dark mode for the technician dashboard", TaskStatus.DONE, TaskPriority.LOW, mei, 3, -10, 35, 12, null));
        a.put("map", task(atlas, "Job map with clustering", TaskStatus.IN_PROGRESS, TaskPriority.HIGH, mei, 5, -2, 28, null, beta));
        a.put("photo", task(atlas, "Photo capture with compression", TaskStatus.DONE, TaskPriority.MEDIUM, mei, 3, -15, 40, 16, null));
        a.put("crash", task(atlas, "Bug: crash when resuming from background on Android 15", TaskStatus.TODO, TaskPriority.MEDIUM, null, 3, 3, 4, null, beta));
        a.put("a11y", task(atlas, "Accessibility audit (screen readers)", TaskStatus.BACKLOG, TaskPriority.LOW, aisha, 3, 18, 10, null, launch));
        a.put("e2e", task(atlas, "End-to-end tests for sync scenarios", TaskStatus.BLOCKED, TaskPriority.HIGH, aisha, 5, 6, 18, null, beta));
        a.put("store", task(atlas, "App Store listing and screenshots", TaskStatus.TODO, TaskPriority.MEDIUM, tom, 2, 16, 8, null, launch));
        a.put("perf", task(atlas, "Cold start under 1.5 s", TaskStatus.IN_PROGRESS, TaskPriority.MEDIUM, rahul, 5, 9, 22, null, launch));
        a.put("i18n", task(atlas, "Arabic and Spanish localisation", TaskStatus.DONE, TaskPriority.MEDIUM, mei, 5, -20, 50, 24, null));
        a.put("sso", task(atlas, "SSO login with company identity provider", TaskStatus.DONE, TaskPriority.HIGH, diego, 5, -25, 52, 30, null));
        a.put("telemetry", task(atlas, "Crash and performance telemetry", TaskStatus.DONE, TaskPriority.MEDIUM, rahul, 3, -8, 33, 9, null));
        a.put("signature", task(atlas, "Customer signature capture", TaskStatus.TODO, TaskPriority.LOW, null, 3, 14, 6, null, launch));
        blocked(a.get("e2e"), "Waiting for the sync engine API to stabilise");
        depend(a.get("conflict"), a.get("sync"));
        depend(a.get("e2e"), a.get("sync"));
        depend(a.get("push"), a.get("sync"));
        depend(a.get("store"), a.get("onboard"));

        Project helios = project(acme, "HEL", "Helios Data Platform", "Streaming analytics for robot telemetry.",
                "#0EA5E9", sarah, -30, 60, List.of(sarah, rahul, diego, aisha));
        Milestone ingest = milestone(helios, "Ingestion GA", 25);
        task(helios, "Kafka topic design for telemetry", TaskStatus.DONE, TaskPriority.HIGH, diego, 3, -20, 28, 21, ingest);
        task(helios, "Schema registry and compatibility rules", TaskStatus.DONE, TaskPriority.MEDIUM, diego, 3, -12, 26, 13, ingest);
        task(helios, "Anomaly alert thresholds per robot model", TaskStatus.IN_PROGRESS, TaskPriority.MEDIUM, rahul, 5, 10, 14, null, ingest);
        task(helios, "Data retention policy (90 days hot)", TaskStatus.TODO, TaskPriority.LOW, sarah, 2, 30, 9, null, null);
        task(helios, "Load test: 50k events/second", TaskStatus.TODO, TaskPriority.HIGH, aisha, 5, 20, 7, null, ingest);
        task(helios, "Grafana dashboards for fleet health", TaskStatus.DONE, TaskPriority.MEDIUM, rahul, 3, -3, 18, 5, null);
        task(helios, "Backfill historical telemetry", TaskStatus.BACKLOG, TaskPriority.LOW, null, 5, 45, 3, null, null);

        Project portal = project(acme, "CPR", "Customer Portal Revamp", "Self-service portal for enterprise customers.",
                "#F59E0B", sarah, -90, -5, List.of(sarah, mei, tom, aisha, rahul));
        Milestone go = milestone(portal, "Go-live", -5);
        task(portal, "Invoice history with PDF export", TaskStatus.IN_PROGRESS, TaskPriority.HIGH, mei, 5, -8, 40, null, go);
        task(portal, "Role-based access for customer admins", TaskStatus.TODO, TaskPriority.CRITICAL, null, 8, -3, 30, null, go);
        blocked(task(portal, "Support ticket widget", TaskStatus.BLOCKED, TaskPriority.MEDIUM, tom, 3, -1, 35, null, go),
                "Vendor API keys pending from legal");
        task(portal, "Usage charts per site", TaskStatus.DONE, TaskPriority.MEDIUM, mei, 5, -30, 70, 33, null);
        task(portal, "Design system migration", TaskStatus.DONE, TaskPriority.HIGH, tom, 8, -45, 85, 50, null);
        task(portal, "Penetration test fixes", TaskStatus.TODO, TaskPriority.HIGH, aisha, 5, -2, 15, null, go);
        task(portal, "Bug: wrong timezone on scheduled reports", TaskStatus.IN_REVIEW, TaskPriority.HIGH, rahul, 2, 1, 12, null, go);

        // Comments + activity
        comment(a.get("sync"), rahul, "Can we ship a first version that syncs only work orders, and add attachments next sprint?", 3);
        comment(a.get("sync"), diego, "Yes, attachments are the slow part. Splitting it now.", 2);
        comment(a.get("e2e"), aisha, "Blocked until the sync API settles; I'll write the fixtures meanwhile.", 1);
        comment(a.get("onboard"), tom, "Ready for review. Figma link is in the description.", 1);

        // Workflows (valid graphs, same shape the builder produces)
        workflow(acme, atlas, sarah, "Escalate new bugs", "Raises priority of bug reports and tells the project owner",
                TriggerType.TASK_CREATED,
                List.of(node("t", "TRIGGER", "TASK_CREATED", "Task created", Map.of(), 220, 20),
                        node("c", "CONDITION", "TITLE_CONTAINS", "Title contains \"bug\"", Map.of("text", "bug"), 220, 160),
                        node("a1", "ACTION", "SET_PRIORITY", "Set priority HIGH", Map.of("priority", "HIGH"), 80, 310),
                        node("a2", "ACTION", "NOTIFY_PROJECT_OWNER", "Notify owner", Map.of("message", "New bug {task}: {title}"), 80, 450)),
                List.of(edge("t", "c", null), edge("c", "a1", "TRUE"), edge("a1", "a2", null)), 14);
        Workflow auto = workflow(acme, null, sarah, "Auto-assign unowned work", "Gives new unassigned tasks to whoever has the most spare capacity",
                TriggerType.TASK_CREATED,
                List.of(node("t", "TRIGGER", "TASK_CREATED", "Task created", Map.of(), 220, 20),
                        node("c", "CONDITION", "IS_UNASSIGNED", "Is unassigned", Map.of(), 220, 160),
                        node("a1", "ACTION", "ASSIGN_LEAST_LOADED", "Assign least-loaded", Map.of(), 80, 310),
                        node("a2", "ACTION", "ADD_COMMENT", "Explain", Map.of("text", "Auto-assigned to {assignee} based on current workload."), 80, 450)),
                List.of(edge("t", "c", null), edge("c", "a1", "TRUE"), edge("a1", "a2", null)), 9);
        workflow(acme, atlas, rahul, "QA handoff", "Pings QA when work is ready for review",
                TriggerType.TASK_STATUS_CHANGED,
                List.of(node("t", "TRIGGER", "TASK_STATUS_CHANGED", "Moved to In review", Map.of("toStatus", "IN_REVIEW"), 220, 20),
                        node("a1", "ACTION", "NOTIFY_USER", "Notify QA", Map.of("userId", aisha.getId(), "message", "{task} is ready for QA: {title}"), 220, 160)),
                List.of(edge("t", "a1", null)), 21);
        workflow(acme, null, sarah, "Overdue nudge", "Escalates overdue high-priority work and leaves a note on the rest",
                TriggerType.TASK_OVERDUE,
                List.of(node("t", "TRIGGER", "TASK_OVERDUE", "Task overdue", Map.of(), 220, 20),
                        node("c", "CONDITION", "PRIORITY_AT_LEAST", "Priority ≥ HIGH", Map.of("priority", "HIGH"), 220, 160),
                        node("a1", "ACTION", "NOTIFY_ASSIGNEE", "Nudge assignee", Map.of("message", "{task} is overdue. Can you update the plan?"), 60, 310),
                        node("a2", "ACTION", "ADD_COMMENT", "Leave a note", Map.of("text", "This task is past its due date."), 380, 310)),
                List.of(edge("t", "c", null), edge("c", "a1", "TRUE"), edge("c", "a2", "FALSE")), 6);
        execution(auto, a.get("crash"), "SKIPPED", List.of(
                step("t", "TRIGGER", "Task created", "FIRED", "Triggered by TASK_CREATED on ATL-9"),
                step("c", "CONDITION", "Is unassigned", "FALSE", "Task is assigned")), 2);
        execution(auto, a.get("signature"), "SUCCESS", List.of(
                step("t", "TRIGGER", "Task created", "FIRED", "Triggered by TASK_CREATED on ATL-17"),
                step("c", "CONDITION", "Is unassigned", "TRUE", "Task has no assignee"),
                step("a1", "ACTION", "Assign least-loaded", "DONE", "Assigned to Aisha Bello (lowest utilisation)"),
                step("a2", "ACTION", "Explain", "DONE", "Posted a comment")), 6);

        activity(acme, atlas, rahul, "TASK_STATUS", "Rahul Mehta moved ATL-13 to In progress", 1);
        activity(acme, atlas, mei, "TASK_STATUS", "Mei Tanaka completed ATL-6 · Dark mode for the technician dashboard", 12);
        activity(acme, portal, tom, "TASK_STATUS", "Tom Fischer marked CPR-3 as blocked: vendor API keys pending", 2);
        activity(acme, helios, rahul, "TASK_STATUS", "Rahul Mehta completed HEL-6 · Grafana dashboards for fleet health", 5);

        notify(sarah, "TASK_COMPLETED", "Rahul Mehta completed HEL-6", "Grafana dashboards for fleet health", "/projects/" + helios.getId() + "/board");
        notify(sarah, "WORKFLOW", "⚡ Overdue nudge · CPR-2", "Role-based access for customer admins is overdue", "/projects/" + portal.getId() + "/board");
        notify(mei, "COMMENT_ADDED", "Rahul Mehta commented on ATL-7", "Looks great. Can clusters show job counts?", "/projects/" + atlas.getId() + "/board");

        // ── Other tenants (for the admin console) ───────────────────────
        Organization globex = org("Globex Health", "globex-health", "STARTER", "Healthcare", 45);
        User lena = user(globex, "ORG_ADMIN", "lena@globex.dev", "Lena Novak", "CTO", "#14B8A6", 20);
        User sam = user(globex, "MEMBER", "sam@globex.dev", "Sam Okafor", "Full-stack Engineer", "#EF4444", 20);
        Project pp = project(globex, "PP", "Patient Portal", "Appointment booking and records.", "#14B8A6", lena, -20, 40, List.of(lena, sam));
        task(pp, "Appointment booking flow", TaskStatus.IN_PROGRESS, TaskPriority.HIGH, sam, 5, 7, 12, null, null);
        task(pp, "HIPAA logging review", TaskStatus.TODO, TaskPriority.CRITICAL, lena, 3, 3, 5, null, null);
        task(pp, "Insurance card OCR spike", TaskStatus.DONE, TaskPriority.LOW, sam, 2, -5, 15, 6, null);

        Organization initech = org("Initech Labs", "initech-labs", "ENTERPRISE", "Fintech", 200);
        User omar = user(initech, "ORG_ADMIN", "omar@initech.dev", "Omar Haddad", "Head of Platform", "#F97316", 20);
        Project ledger = project(initech, "LED", "Ledger Reconciliation", "Automated daily reconciliation.", "#F97316", omar, -10, 50, List.of(omar));
        task(ledger, "Bank statement parser", TaskStatus.IN_PROGRESS, TaskPriority.HIGH, omar, 5, 12, 8, null, null);

        backdateUsers();
    }

    // ── builders ──────────────────────────────────────────────────────────

    private Organization org(String name, String slug, String planCode, String industry, int createdDaysAgo) {
        Organization o = new Organization();
        o.setName(name);
        o.setSlug(slug);
        o.setIndustry(industry);
        o.setPlan(plans.findByCode(planCode).orElseThrow());
        orgs.save(o);
        orgs.flush();
        jdbc.update("UPDATE organizations SET created_at = ? WHERE id = ?", ts(now.minus(createdDaysAgo, ChronoUnit.DAYS)), o.getId());
        return o;
    }

    private User user(Organization org, String role, String email, String name, String title, String color, int capacity) {
        User u = new User();
        u.setOrganizationId(org.getId());
        u.setRole(roles.findByName(role).orElseThrow());
        u.setEmail(email);
        u.setFullName(name);
        u.setJobTitle(title);
        u.setAvatarColor(color);
        u.setCapacityPoints(capacity);
        u.setPasswordHash(passwordHash);
        u.setLastLoginAt(now.minus(new Random(email.hashCode()).nextInt(72), ChronoUnit.HOURS));
        u.setDashboardLayout(List.of("throughput", "status", "workload", "health", "priority", "topContributors"));
        return users.save(u);
    }

    private void backdateUsers() {
        users.flush();
        int i = 0;
        for (User u : users.findAll()) {
            jdbc.update("UPDATE users SET created_at = ? WHERE id = ?", ts(now.minus(5 + (i++ * 9L) % 80, ChronoUnit.DAYS)), u.getId());
        }
    }

    private Project project(Organization org, String key, String name, String desc, String color, User owner,
                            int startOffset, int dueOffset, List<User> team) {
        Project p = new Project();
        p.setOrganizationId(org.getId());
        p.setKey(key);
        p.setName(name);
        p.setDescription(desc);
        p.setColor(color);
        p.setOwnerId(owner.getId());
        p.setStartDate(today.plusDays(startOffset));
        p.setDueDate(today.plusDays(dueOffset));
        projects.save(p);
        for (User u : team) {
            members.save(new ProjectMember(p.getId(), u.getId(), u.getId().equals(owner.getId()) ? "OWNER" : "CONTRIBUTOR"));
        }
        projects.flush();
        jdbc.update("UPDATE projects SET created_at = ? WHERE id = ?", ts(today.plusDays(startOffset).atStartOfDay(ZoneOffset.UTC).toInstant()), p.getId());
        return p;
    }

    private Milestone milestone(Project p, String name, int dueOffset) {
        Milestone m = new Milestone();
        m.setProjectId(p.getId());
        m.setName(name);
        m.setDueDate(today.plusDays(dueOffset));
        return milestones.save(m);
    }

    private Task task(Project p, String title, TaskStatus status, TaskPriority priority, User assignee, int points,
                      int dueOffset, int createdDaysAgo, Integer completedDaysAgo, Milestone milestone) {
        p.setTaskSequence(p.getTaskSequence() + 1);
        Task t = new Task();
        t.setProjectId(p.getId());
        t.setTaskNumber(p.getTaskSequence());
        t.setTitle(title);
        t.setStatus(status);
        t.setPriority(priority);
        t.setAssigneeId(assignee == null ? null : assignee.getId());
        t.setReporterId(p.getOwnerId());
        t.setStoryPoints(points);
        t.setDueDate(today.plusDays(dueOffset));
        t.setMilestoneId(milestone == null ? null : milestone.getId());
        t.setPosition(1024.0 * p.getTaskSequence());
        t.setDescription("Seeded demo task. Edit me, move me across the board, or let a workflow act on me.");
        tasks.save(t);
        tasks.flush();
        Instant created = now.minus(createdDaysAgo, ChronoUnit.DAYS);
        Instant started = status == TaskStatus.BACKLOG || status == TaskStatus.TODO ? null
                : created.plus(Math.max(1, createdDaysAgo / 4), ChronoUnit.DAYS);
        Instant completed = completedDaysAgo == null ? null : now.minus(completedDaysAgo, ChronoUnit.DAYS);
        // In-progress work on Atlas's sync engine is deliberately "stale" to show the stale-work factor.
        Instant updated = completed != null ? completed
                : title.startsWith("Background sync") ? now.minus(9, ChronoUnit.DAYS) : now.minus(createdDaysAgo % 5, ChronoUnit.DAYS);
        jdbc.update("UPDATE tasks SET created_at = ?, updated_at = ?, started_at = ?, completed_at = ? WHERE id = ?",
                ts(created), ts(updated), started == null ? null : ts(started), completed == null ? null : ts(completed), t.getId());
        return t;
    }

    private void blocked(Task t, String reason) {
        jdbc.update("UPDATE tasks SET blocked_reason = ? WHERE id = ?", reason, t.getId());
    }

    private void depend(Task task, Task on) {
        jdbc.update("INSERT INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)", task.getId(), on.getId());
    }

    private void comment(Task t, User author, String body, int daysAgo) {
        TaskComment c = new TaskComment();
        c.setTaskId(t.getId());
        c.setAuthorId(author.getId());
        c.setBody(body);
        comments.save(c);
        comments.flush();
        jdbc.update("UPDATE task_comments SET created_at = ? WHERE id = ?", ts(now.minus(daysAgo, ChronoUnit.DAYS)), c.getId());
    }

    private void activity(Organization org, Project p, User actor, String type, String summary, int daysAgo) {
        Activity act = new Activity();
        act.setOrganizationId(org.getId());
        act.setProjectId(p.getId());
        act.setActorId(actor.getId());
        act.setType(type);
        act.setEntityType("PROJECT");
        act.setEntityId(p.getId());
        act.setSummary(summary);
        activities.save(act);
        activities.flush();
        jdbc.update("UPDATE activities SET created_at = ? WHERE id = ?", ts(now.minus(daysAgo, ChronoUnit.DAYS)), act.getId());
    }

    private void notify(User u, String type, String title, String body, String link) {
        Notification n = new Notification();
        n.setUserId(u.getId());
        n.setType(type);
        n.setTitle(title);
        n.setBody(body);
        n.setLink(link);
        notifications.save(n);
    }

    private record NodeSpec(String key, String type, String kind, String label, Map<String, Object> config, double x, double y) {
    }

    private record EdgeSpec(String source, String target, String branch) {
    }

    private static NodeSpec node(String key, String type, String kind, String label, Map<String, Object> config, double x, double y) {
        return new NodeSpec(key, type, kind, label, config, x, y);
    }

    private static EdgeSpec edge(String s, String t, String branch) {
        return new EdgeSpec(s, t, branch);
    }

    private Workflow workflow(Organization org, Project project, User creator, String name, String description,
                              TriggerType trigger, List<NodeSpec> ns, List<EdgeSpec> es, int runs) {
        Workflow w = new Workflow();
        w.setOrganizationId(org.getId());
        w.setProjectId(project == null ? null : project.getId());
        w.setName(name);
        w.setDescription(description);
        w.setTriggerType(trigger);
        w.setCreatedBy(creator.getId());
        w.setRunCount(runs);
        w.setLastRunAt(now.minus(runs % 4 + 1, ChronoUnit.HOURS));
        workflows.save(w);
        for (NodeSpec n : ns) {
            WorkflowNode node = new WorkflowNode();
            node.setWorkflowId(w.getId());
            node.setNodeKey(n.key());
            node.setNodeType(n.type());
            node.setKind(n.kind());
            node.setLabel(n.label());
            node.setConfig(new HashMap<>(n.config()));
            node.setPositionX(n.x());
            node.setPositionY(n.y());
            nodes.save(node);
        }
        for (EdgeSpec e : es) {
            WorkflowEdge edge = new WorkflowEdge();
            edge.setWorkflowId(w.getId());
            edge.setSourceKey(e.source());
            edge.setTargetKey(e.target());
            edge.setBranch(e.branch());
            edges.save(edge);
        }
        return w;
    }

    private static Map<String, Object> step(String node, String type, String label, String result, String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("node", node);
        m.put("type", type);
        m.put("label", label);
        m.put("result", result);
        m.put("message", message);
        m.put("ms", 3);
        return m;
    }

    private void execution(Workflow w, Task t, String status, List<Map<String, Object>> steps, int hoursAgo) {
        WorkflowExecution e = new WorkflowExecution();
        e.setWorkflowId(w.getId());
        e.setTaskId(t.getId());
        e.setTriggerEvent(w.getTriggerType().name());
        e.setStatus(status);
        e.setSteps(new ArrayList<>(steps));
        e.setStartedAt(now.minus(hoursAgo, ChronoUnit.HOURS));
        e.setFinishedAt(now.minus(hoursAgo, ChronoUnit.HOURS).plusMillis(14));
        e.setDurationMs(14);
        executions.save(e);
    }

    private static Timestamp ts(Instant i) {
        return Timestamp.from(i);
    }
}
