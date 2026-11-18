// NEXORA in-browser demo API.
// Built only into the GitHub Pages demo (VITE_DEMO / Angular "demo" configuration).
// It answers /api/v1 calls with sample data so the real React and Angular apps run on static hosting.
// Nothing here talks to a server, and production builds never include it.
/* eslint-disable */
const NOW = Date.now();
const d = (days) => new Date(NOW + days * 864e5).toISOString().slice(0, 10);
const t = (days) => new Date(NOW + days * 864e5).toISOString();
const U = {
  1: { id: 1, fullName: 'Sarah Chen', email: 'sarah@acme.dev', avatarColor: '#6366F1' },
  2: { id: 2, fullName: 'Rahul Mehta', email: 'rahul@acme.dev', avatarColor: '#0EA5E9' },
  3: { id: 3, fullName: 'Mei Tanaka', email: 'mei@acme.dev', avatarColor: '#EC4899' },
  4: { id: 4, fullName: 'Diego Alvarez', email: 'diego@acme.dev', avatarColor: '#F59E0B' },
  5: { id: 5, fullName: 'Aisha Bello', email: 'aisha@acme.dev', avatarColor: '#10B981' },
  6: { id: 6, fullName: 'Tom Fischer', email: 'tom@acme.dev', avatarColor: '#8B5CF6' },
};
const me = { id: 1, email: 'sarah@acme.dev', fullName: 'Sarah Chen', jobTitle: 'VP Engineering', avatarColor: '#6366F1', role: 'ORG_ADMIN',
  permissions: ['ORG_MANAGE', 'USER_MANAGE', 'PROJECT_CREATE', 'PROJECT_MANAGE', 'WORKFLOW_MANAGE', 'TASK_WRITE', 'COMMENT_WRITE', 'ANALYTICS_READ'],
  organization: { id: 2, name: 'Acme Robotics', slug: 'acme-robotics', plan: 'GROWTH' }, capacityPoints: 20, timezone: 'Asia/Kolkata', theme: 'dark',
  dashboardLayout: ['throughput', 'status', 'workload', 'health', 'priority', 'topContributors'] };
const admin = { ...me, id: 99, email: 'admin@nexora.dev', fullName: 'Nora Admin', role: 'SUPER_ADMIN', avatarColor: '#0F172A',
  permissions: ['ADMIN_ACCESS', 'PLAN_MANAGE', 'SYSTEM_CONFIG', 'AUDIT_READ', 'ROLE_MANAGE', 'ORG_MANAGE', 'USER_MANAGE'], organization: { id: 1, name: 'Nexora Platform', slug: 'nexora-platform', plan: 'PLATFORM' } };
const projects = [
  { id: 1, key: 'ATL', name: 'Atlas Mobile App', description: 'Cross-platform field-technician app with offline sync.', status: 'ACTIVE', color: '#6366F1', owner: U[2], startDate: d(-60), dueDate: d(20), memberCount: 6, totalTasks: 17, doneTasks: 6, openTasks: 11, progress: 35, myRole: 'CONTRIBUTOR', createdAt: t(-60) },
  { id: 2, key: 'HEL', name: 'Helios Data Platform', description: 'Streaming analytics for robot telemetry.', status: 'ACTIVE', color: '#0EA5E9', owner: U[1], startDate: d(-30), dueDate: d(60), memberCount: 4, totalTasks: 7, doneTasks: 3, openTasks: 4, progress: 43, myRole: 'OWNER', createdAt: t(-30) },
  { id: 3, key: 'CPR', name: 'Customer Portal Revamp', description: 'Self-service portal for enterprise customers.', status: 'ACTIVE', color: '#F59E0B', owner: U[1], startDate: d(-90), dueDate: d(-5), memberCount: 5, totalTasks: 7, doneTasks: 2, openTasks: 5, progress: 29, myRole: 'OWNER', createdAt: t(-90) },
];
let seq = 100;
const mk = (id, n, title, status, priority, a, pts, due, extra = {}) => ({ id, projectId: 1, key: `ATL-${n}`, title, description: 'Seeded demo task.', status, priority,
  assignee: a ? U[a] : undefined, reporter: U[2], milestoneId: extra.ms, storyPoints: pts, dueDate: d(due), position: 1024 * n, blockedReason: extra.blocked,
  dependsOn: extra.deps ?? [], commentCount: extra.comments ?? 0, createdAt: t(-20), updatedAt: t(-1), version: 1 });
let tasks = [
  mk(2, 2, 'Background sync engine for work orders', 'IN_PROGRESS', 'CRITICAL', 4, 8, 2, { comments: 2, ms: 1 }),
  mk(3, 3, 'Conflict resolution for concurrent edits', 'TODO', 'HIGH', 4, 8, 4, { deps: [2], ms: 1 }),
  mk(4, 4, 'Push notifications for new assignments', 'TODO', 'MEDIUM', 4, 5, 12, { deps: [2] }),
  mk(5, 5, 'Onboarding flow redesign', 'IN_REVIEW', 'MEDIUM', 6, 3, 1, { comments: 1 }),
  mk(7, 7, 'Job map with clustering', 'IN_PROGRESS', 'HIGH', 3, 5, -2),
  mk(9, 9, 'Bug: crash when resuming from background on Android 15', 'TODO', 'MEDIUM', null, 3, 3),
  mk(10, 10, 'Accessibility audit (screen readers)', 'BACKLOG', 'LOW', 5, 3, 18),
  mk(11, 11, 'End-to-end tests for sync scenarios', 'BLOCKED', 'HIGH', 5, 5, 6, { blocked: 'Waiting for the sync engine API to stabilise', deps: [2], comments: 1 }),
  mk(12, 12, 'App Store listing and screenshots', 'TODO', 'MEDIUM', 6, 2, 16),
  mk(13, 13, 'Cold start under 1.5 s', 'IN_PROGRESS', 'MEDIUM', 2, 5, 9),
  mk(6, 6, 'Dark mode for the technician dashboard', 'DONE', 'LOW', 3, 3, -10),
  mk(15, 15, 'SSO login with company identity provider', 'DONE', 'HIGH', 4, 5, -25),
  mk(17, 17, 'Customer signature capture', 'BACKLOG', 'LOW', null, 3, 14),
];
const page = (content) => ({ content, page: 0, size: 30, totalElements: content.length, totalPages: 1 });
const members = [1, 2, 3, 4, 5, 6].map((i) => ({ user: U[i], projectRole: i === 2 ? 'OWNER' : 'CONTRIBUTOR', capacityPoints: [0, 20, 18, 20, 14, 20, 14][i], joinedAt: t(-60) }));
const milestones = [{ id: 1, name: 'Public beta', dueDate: d(5), completed: false, totalTasks: 4, doneTasks: 0, description: 'Invite 200 technicians' }, { id: 2, name: 'App Store launch', dueDate: d(20), completed: false, totalTasks: 4, doneTasks: 1 }];
const health = { score: 58, risk: 'MEDIUM', factors: [
  { code: 'OVERDUE', label: 'Overdue work', penalty: 5, maxPenalty: 30, detail: '2 of 11 open tasks are past their due date' },
  { code: 'SCHEDULE_SLIP', label: 'Schedule slip', penalty: 18, maxPenalty: 25, detail: '75% of the timeline has passed and 35% of story points are done (40 points behind)' },
  { code: 'BLOCKED', label: 'Blocked work', penalty: 1, maxPenalty: 15, detail: '1 task blocked' },
  { code: 'STALE', label: 'Stale work', penalty: 2, maxPenalty: 10, detail: '1 in-progress task untouched for 7+ days' },
  { code: 'UNOWNED_URGENT', label: 'Unowned urgent work', penalty: 0, maxPenalty: 10, detail: 'Every high-priority task has an owner' },
  { code: 'OVERLOAD', label: 'Team overload', penalty: 4, maxPenalty: 10, detail: '1 member above 100% capacity' }],
  forecast: { velocityPerDay: 1.43, remainingPoints: 50, projectedFinish: d(35), daysLate: 15, message: 'Projected 15 days late at 1.43 points/day' },
  stats: { totalTasks: 17, openTasks: 11, doneTasks: 6, overdueTasks: 2, blockedTasks: 1, staleTasks: 1, unassignedUrgent: 0, overloadedMembers: 1, completedPoints: 27, totalPoints: 77, progressPercent: 35, elapsedPercent: 75 } };
const team = [1, 2, 3, 4, 5, 6].map((i) => ({ ...U[i], jobTitle: ['', 'VP Engineering', 'Engineering Manager', 'Frontend Engineer', 'Backend Engineer', 'QA Engineer', 'Product Designer'][i], role: i === 1 ? 'ORG_ADMIN' : i === 2 ? 'MANAGER' : 'MEMBER', status: 'ACTIVE', capacityPoints: [0, 20, 18, 20, 14, 20, 14][i], openPoints: [0, 2, 10, 8, 26, 13, 5][i], openTasks: [0, 1, 3, 2, 4, 3, 2][i], lastLoginAt: t(-i / 10) }));
const catalog = { placeholders: ['{task}', '{title}', '{status}', '{priority}', '{assignee}', '{project}'], kinds: [
  ['TRIGGER', 'TASK_CREATED', 'Task created'], ['TRIGGER', 'TASK_STATUS_CHANGED', 'Status changed'], ['TRIGGER', 'TASK_ASSIGNED', 'Task assigned'], ['TRIGGER', 'COMMENT_ADDED', 'Comment added'], ['TRIGGER', 'TASK_OVERDUE', 'Task overdue'],
  ['CONDITION', 'STATUS_IS', 'Status is', [['status', 'status', true, 'Status']]], ['CONDITION', 'PRIORITY_AT_LEAST', 'Priority at least', [['priority', 'priority', true, 'Priority']]], ['CONDITION', 'DUE_WITHIN_DAYS', 'Due within', [['days', 'number', true, 'Days']]], ['CONDITION', 'TITLE_CONTAINS', 'Title contains', [['text', 'text', true, 'Text']]], ['CONDITION', 'IS_UNASSIGNED', 'Is unassigned'],
  ['ACTION', 'SET_PRIORITY', 'Set priority', [['priority', 'priority', true, 'Priority']]], ['ACTION', 'SET_STATUS', 'Move to status', [['status', 'status', true, 'Status']]], ['ACTION', 'ASSIGN_USER', 'Assign to person', [['userId', 'user', true, 'Person']]], ['ACTION', 'ASSIGN_LEAST_LOADED', 'Assign least-loaded'], ['ACTION', 'NOTIFY_ASSIGNEE', 'Notify assignee', [['message', 'text', true, 'Message']]], ['ACTION', 'NOTIFY_USER', 'Notify person', [['userId', 'user', true, 'Person'], ['message', 'text', true, 'Message']]], ['ACTION', 'NOTIFY_PROJECT_OWNER', 'Notify project owner', [['message', 'text', true, 'Message']]], ['ACTION', 'ADD_COMMENT', 'Add comment', [['text', 'text', true, 'Comment']]],
].map(([type, kind, label, fields = []]) => ({ type, kind, label, description: label, fields: fields.map(([name, ft, required, l]) => ({ name, type: ft, required, label: l })) })) };
const wfDetail = { workflow: { id: 2, name: 'Auto-assign unowned work', description: 'Gives new unassigned tasks to whoever has the most spare capacity', triggerType: 'TASK_CREATED', enabled: true, runCount: 9, lastRunAt: t(-0.1), nodeCount: 4, createdBy: U[1], updatedAt: t(-3) },
  nodes: [{ key: 't', type: 'TRIGGER', kind: 'TASK_CREATED', label: 'Task created', config: {}, x: 220, y: 20 }, { key: 'c', type: 'CONDITION', kind: 'IS_UNASSIGNED', label: 'Is unassigned', config: {}, x: 220, y: 160 },
    { key: 'a1', type: 'ACTION', kind: 'ASSIGN_LEAST_LOADED', label: 'Assign least-loaded', config: {}, x: 80, y: 310 }, { key: 'a2', type: 'ACTION', kind: 'ADD_COMMENT', label: 'Explain', config: { text: 'Auto-assigned to {assignee} based on current workload.' }, x: 80, y: 450 }],
  edges: [{ source: 't', target: 'c' }, { source: 'c', target: 'a1', branch: 'TRUE' }, { source: 'a1', target: 'a2' }], version: 1 };
const execs = [{ id: 7, workflowId: 2, workflowName: 'Auto-assign unowned work', triggerEvent: 'TASK_CREATED', taskId: 17, status: 'SUCCESS', dryRun: false, durationMs: 14, startedAt: t(-0.25), steps: [
  { node: 't', label: 'Task created', result: 'FIRED', message: 'Triggered by TASK_CREATED on ATL-17' }, { node: 'c', label: 'Is unassigned', result: 'TRUE', message: 'Task has no assignee' },
  { node: 'a1', label: 'Assign least-loaded', result: 'DONE', message: 'Assigned to Aisha Bello (lowest utilisation)' }, { node: 'a2', label: 'Explain', result: 'DONE', message: 'Posted a comment' }] },
  { id: 6, workflowId: 3, workflowName: 'QA handoff', triggerEvent: 'TASK_STATUS_CHANGED', taskId: 5, status: 'SUCCESS', dryRun: false, durationMs: 9, startedAt: t(-1), steps: [] },
  { id: 5, workflowId: 2, workflowName: 'Auto-assign unowned work', triggerEvent: 'TASK_CREATED', taskId: 9, status: 'SKIPPED', dryRun: false, durationMs: 4, startedAt: t(-2), steps: [] }];
const weeks = Array.from({ length: 8 }, (_, i) => ({ weekStart: d(-7 * (7 - i)), created: [4, 6, 5, 8, 7, 9, 6, 8][i], completed: [2, 3, 5, 4, 6, 5, 7, 6][i], completedPoints: [6, 9, 14, 11, 17, 15, 21, 18][i] }));
const dailyArr = (n) => Array.from({ length: n }, (_, i) => ({ day: d(i - n + 1), newUsers: Math.round(2 + 2 * Math.sin(i / 3) + (i % 5 === 0 ? 3 : 0)), newOrganizations: i % 6 === 0 ? 1 : 0, tasksCreated: Math.round(8 + 5 * Math.sin(i / 4) + i / 5), tasksCompleted: Math.round(6 + 4 * Math.cos(i / 5) + i / 6), workflowRuns: Math.round(20 + 10 * Math.sin(i / 2.5) + i / 2) }));
const orgs = [{ id: 2, name: 'Acme Robotics', slug: 'acme-robotics', status: 'ACTIVE', industry: 'Robotics', planCode: 'GROWTH', planName: 'Growth', users: 6, projects: 3, createdAt: t(-120) }, { id: 4, name: 'Initech Labs', slug: 'initech-labs', status: 'ACTIVE', industry: 'Fintech', planCode: 'ENTERPRISE', planName: 'Enterprise', users: 1, projects: 1, createdAt: t(-200) }, { id: 3, name: 'Globex Health', slug: 'globex-health', status: 'ACTIVE', industry: 'Healthcare', planCode: 'STARTER', planName: 'Starter', users: 2, projects: 1, createdAt: t(-45) }, { id: 1, name: 'Nexora Platform', slug: 'nexora-platform', status: 'ACTIVE', industry: 'Software', planCode: 'PLATFORM', planName: 'Platform', users: 1, projects: 0, createdAt: t(-300) }];
const roles = [{ id: 1, name: 'SUPER_ADMIN', description: 'Platform operator with full access', systemRole: true, permissions: admin.permissions.concat(me.permissions), users: 1 }, { id: 2, name: 'ORG_ADMIN', description: 'Administers one organisation', systemRole: true, permissions: me.permissions, users: 3 }, { id: 3, name: 'MANAGER', description: 'Plans projects and automates work', systemRole: true, permissions: ['PROJECT_CREATE', 'PROJECT_MANAGE', 'WORKFLOW_MANAGE', 'TASK_WRITE', 'COMMENT_WRITE', 'ANALYTICS_READ'], users: 1 }, { id: 4, name: 'MEMBER', description: 'Works on tasks and collaborates', systemRole: true, permissions: ['TASK_WRITE', 'COMMENT_WRITE', 'ANALYTICS_READ'], users: 5 }];

const permissions = [['ADMIN_ACCESS', 'Open the platform admin console', 'PLATFORM'], ['PLAN_MANAGE', 'Create and edit subscription plans', 'PLATFORM'], ['SYSTEM_CONFIG', 'Change platform settings', 'PLATFORM'], ['AUDIT_READ', 'Read audit logs', 'PLATFORM'], ['ROLE_MANAGE', 'Create and edit roles and permissions', 'PLATFORM'], ['ORG_MANAGE', 'Edit organisation details', 'ORGANIZATION'], ['USER_MANAGE', 'Invite, update and suspend users', 'ORGANIZATION'], ['PROJECT_CREATE', 'Create projects', 'PROJECT'], ['PROJECT_MANAGE', 'Edit projects, members and milestones', 'PROJECT'], ['WORKFLOW_MANAGE', 'Create, edit and run workflows', 'AUTOMATION'], ['TASK_WRITE', 'Create, edit and move tasks', 'WORK'], ['COMMENT_WRITE', 'Comment on tasks', 'WORK'], ['ANALYTICS_READ', 'View analytics and insights', 'WORK']].map(([code, description, category], i) => ({ id: i + 1, code, description, category })).sort((a, b) => a.category.localeCompare(b.category));
const plans = [['PLATFORM', 'Platform', 'Internal plan for the platform operator', 0, 1000, 1000, 1000, 1], ['STARTER', 'Starter', 'Small teams getting organised', 0, 5, 3, 2, 1], ['GROWTH', 'Growth', 'Growing teams that automate their workflow', 49, 25, 20, 15, 1], ['ENTERPRISE', 'Enterprise', 'Unlimited scale with priority support', 199, 500, 500, 200, 1]].map(([code, name, description, priceMonthly, maxUsers, maxProjects, maxWorkflows, organizations], i) => ({ id: i + 1, code, name, description, priceMonthly, maxUsers, maxProjects, maxWorkflows, active: true, organizations }));
const adminProjects = [['CPR', 'Customer Portal Revamp', 'Acme Robotics', 'Sarah Chen', 7, 5, 4, 41, 'HIGH', d(-5)], ['ATL', 'Atlas Mobile App', 'Acme Robotics', 'Rahul Mehta', 17, 11, 2, 58, 'MEDIUM', d(20)], ['PP', 'Patient Portal', 'Globex Health', 'Lena Novak', 3, 2, 0, 84, 'LOW', d(40)], ['HEL', 'Helios Data Platform', 'Acme Robotics', 'Sarah Chen', 7, 4, 0, 92, 'LOW', d(60)], ['LED', 'Ledger Reconciliation', 'Initech Labs', 'Omar Haddad', 1, 1, 0, 100, 'LOW', d(50)]].map(([key, name, org, owner, total, open, overdue, score, risk, due], i) => ({ id: i + 1, key, name, status: 'ACTIVE', organizationId: 2, organizationName: org, ownerName: owner, totalTasks: total, openTasks: open, overdueTasks: overdue, healthScore: score, risk, dueDate: due }));
const auditLogs = Array.from({ length: 12 }, (_, i) => ({ id: 200 - i, action: ['LOGIN_SUCCESS', 'WORKFLOW_UPDATED', 'LOGIN_FAILED', 'PROJECT_CREATED', 'USER_INVITED', 'SETTING_UPDATED'][i % 6], actorEmail: ['sarah@acme.dev', 'rahul@acme.dev', 'unknown@acme.dev', 'sarah@acme.dev', 'lena@globex.dev', 'admin@nexora.dev'][i % 6], entityType: ['USER', 'WORKFLOW', 'USER', 'PROJECT', 'USER', 'SETTING'][i % 6], entityId: String(i + 1), ipAddress: '172.18.0.1', createdAt: t(-i * 0.3), details: { client: 'web', from: 'ACTIVE', to: 'ACTIVE' } }));
const settings = [['announcement.banner', '', 'STRING', 'Message shown at the top of the user app (empty = hidden)'], ['api_logs.retention_days', '7', 'NUMBER', 'How long API request logs are kept for monitoring'], ['insights.stale_days', '7', 'NUMBER', 'Days without updates before an in-progress task counts as stale'], ['registration.enabled', 'true', 'BOOLEAN', 'Allow new organisations to sign up'], ['workflow.max_steps', '50', 'NUMBER', 'Maximum steps a single workflow run may execute']].map(([key, value, valueType, description]) => ({ key, value, valueType, description, updatedBy: 'admin@nexora.dev', updatedAt: t(-5) }));
const apiMetrics = { requests: 18432, errors: 37, errorRate: 0.2, avgMs: 31, p95Ms: 87, hourly: Array.from({ length: 24 }, (_, i) => ({ hour: t(-1 + i / 24).slice(0, 13) + ':00', requests: Math.round(500 + 400 * Math.sin(i / 3.5) + i * 12), errors: i % 7 === 0 ? 4 : 1, avgMs: 30 })),
  endpoints: [['GET', '/api/v1/projects/{id}/tasks', 5210, 0, 18, 44], ['PATCH', '/api/v1/tasks/{id}/move', 2433, 2, 27, 61], ['GET', '/api/v1/insights/portfolio', 1802, 0, 64, 142], ['GET', '/api/v1/notifications/unread-count', 1650, 0, 6, 12], ['POST', '/api/v1/auth/refresh', 1201, 0, 22, 48], ['PUT', '/api/v1/tasks/{id}', 940, 3, 35, 80], ['POST', '/api/v1/tasks/{id}/comments', 512, 0, 29, 66], ['GET', '/api/v1/projects/{id}/insights/health', 488, 0, 71, 168], ['POST', '/api/v1/auth/login', 233, 31, 240, 410]].map(([method, path, requests, errors, avgMs, p95Ms]) => ({ method, path, requests, errors, errorRate: Math.round(errors * 1000 / requests) / 10, avgMs, p95Ms })), slowest: [] };

// Boards for the other two sample projects.
const extraTask = (pid, prefix, color, n, title, status, priority, a, pts, due, blocked) => ({ ...mk(++seq, n, title, status, priority, a, pts, due, { blocked }), projectId: pid, key: `${prefix}-${n}` });
tasks.push(
  extraTask(2, 'HEL', '#0EA5E9', 1, 'Kafka ingestion for robot telemetry', 'DONE', 'HIGH', 4, 8, -12),
  extraTask(2, 'HEL', '#0EA5E9', 2, 'Schema registry and contracts', 'DONE', 'MEDIUM', 2, 5, -6),
  extraTask(2, 'HEL', '#0EA5E9', 3, 'Grafana dashboards for fleet health', 'DONE', 'MEDIUM', 3, 3, -2),
  extraTask(2, 'HEL', '#0EA5E9', 4, 'Data retention policy (90 days hot)', 'IN_PROGRESS', 'HIGH', 1, 5, 9),
  extraTask(2, 'HEL', '#0EA5E9', 5, 'Anomaly alerts for battery drain', 'TODO', 'MEDIUM', 5, 5, 21),
  extraTask(2, 'HEL', '#0EA5E9', 6, 'Backfill historic telemetry', 'BACKLOG', 'LOW', null, 8, 40),
  extraTask(2, 'HEL', '#0EA5E9', 7, 'Cost report per robot model', 'IN_REVIEW', 'LOW', 2, 3, 12),
  extraTask(3, 'CPR', '#F59E0B', 1, 'Customer SSO with SAML', 'DONE', 'HIGH', 4, 8, -30),
  extraTask(3, 'CPR', '#F59E0B', 2, 'Role-based access for customer admins', 'IN_PROGRESS', 'CRITICAL', 4, 8, -6),
  extraTask(3, 'CPR', '#F59E0B', 3, 'Invoice history and PDF download', 'BLOCKED', 'HIGH', 6, 5, -3, 'Waiting for the billing API from finance'),
  extraTask(3, 'CPR', '#F59E0B', 4, 'Support ticket timeline', 'TODO', 'MEDIUM', null, 5, -1),
  extraTask(3, 'CPR', '#F59E0B', 5, 'Usage analytics for account owners', 'TODO', 'MEDIUM', 3, 5, -2),
  extraTask(3, 'CPR', '#F59E0B', 6, 'Brand theming per customer', 'DONE', 'LOW', 6, 3, -20),
  extraTask(3, 'CPR', '#F59E0B', 7, 'Accessibility pass (WCAG 2.2 AA)', 'BACKLOG', 'MEDIUM', 5, 3, 10),
);

// ───────────────────────── session (per tab) ─────────────────────────
const store = (() => { try { return window.sessionStorage; } catch { return null; } })();
const sessionKey = (client) => 'nexora-demo-session-' + client;
const hasSession = (client) => { try { return store?.getItem(sessionKey(client)) === '1'; } catch { return false; } };
const setSession = (client, on) => { try { on ? store?.setItem(sessionKey(client), '1') : store?.removeItem(sessionKey(client)); } catch { /* private mode */ } };

// ───────────────────────── mutable demo state ─────────────────────────
const comments = [
  { id: 1, taskId: 2, author: U[2], body: 'Can we ship a first version that syncs only work orders, and add attachments next sprint?', automated: false, createdAt: t(-3) },
  { id: 2, taskId: 2, author: U[4], body: 'Yes, attachments are the slow part. Splitting it now.', automated: false, createdAt: t(-2) },
  { id: 3, taskId: 2, author: U[2], body: '⚡ Escalate new bugs: priority raised to HIGH.', automated: true, createdAt: t(-1) },
];
const notifications = [
  { id: 1, type: 'TASK_ASSIGNED', title: 'Rahul Mehta assigned you HEL-4', body: 'Data retention policy (90 days hot)', read: false, createdAt: t(-0.1), link: '/projects/2/board' },
  { id: 2, type: 'WORKFLOW', title: '⚡ Overdue nudge · CPR-2', body: 'Role-based access for customer admins is overdue', read: false, createdAt: t(-0.5) },
  { id: 3, type: 'COMMENT_ADDED', title: 'Tom Fischer commented on ATL-5', body: 'Ready for review. Figma link is in the description.', read: true, createdAt: t(-1) },
  { id: 4, type: 'DUE_SOON', title: 'ATL-5 is due tomorrow', body: 'Onboarding flow redesign', read: true, createdAt: t(-1.2) },
];
const activity = [['Diego Alvarez moved ATL-2 to In progress', 4, -0.05], ['⚡ Auto-assign unowned work changed ATL-17: assignee → Aisha Bello', null, -0.25], ['Tom Fischer commented on ATL-5', 6, -1], ['Mei Tanaka completed ATL-6 · Dark mode for the technician dashboard', 3, -2], ['Rahul Mehta added milestone Public beta', 2, -3], ['Aisha Bello marked ATL-11 as blocked', 5, -4]]
  .map(([s, a, ago], i) => ({ id: i + 1, projectId: 1, type: 'TASK_STATUS', entityType: 'TASK', summary: s, actor: a ? U[a] : undefined, createdAt: t(ago) }));
const logActivity = (summary, taskId) => activity.unshift({ id: ++seq, projectId: 1, type: 'TASK_UPDATED', entityType: 'TASK', entityId: taskId, summary, actor: U[1], createdAt: new Date().toISOString() });
const workflows = [
  { id: 1, name: 'Escalate new bugs', description: 'Raises priority of bug reports and tells the project owner', projectId: 1, projectName: 'Atlas Mobile App', triggerType: 'TASK_CREATED', enabled: true, runCount: 14, lastRunAt: t(-0.2), nodeCount: 4, createdBy: U[1], updatedAt: t(-4) },
  wfDetail.workflow,
  { id: 3, name: 'QA handoff', description: 'Pings QA when work is ready for review', projectId: 1, projectName: 'Atlas Mobile App', triggerType: 'TASK_STATUS_CHANGED', enabled: true, runCount: 21, lastRunAt: t(-1), nodeCount: 2, createdBy: U[2], updatedAt: t(-6) },
  { id: 4, name: 'Overdue nudge', description: 'Escalates overdue high-priority work and leaves a note on the rest', triggerType: 'TASK_OVERDUE', enabled: false, runCount: 6, lastRunAt: t(-2), nodeCount: 4, createdBy: U[1], updatedAt: t(-8) },
];
const wfGraphs = { 2: { nodes: wfDetail.nodes, edges: wfDetail.edges } };
const graphFor = (id) => wfGraphs[id] ?? { nodes: [{ key: 't', type: 'TRIGGER', kind: workflows.find((w) => w.id === id)?.triggerType ?? 'TASK_CREATED', label: 'Trigger', config: {}, x: 220, y: 20 }, { key: 'a', type: 'ACTION', kind: 'NOTIFY_PROJECT_OWNER', label: 'Notify owner', config: { message: '{task} needs attention' }, x: 220, y: 170 }], edges: [{ source: 't', target: 'a' }] };
const wfDetailFor = (id) => { const w = workflows.find((x) => x.id === id); return w ? { workflow: w, ...graphFor(id), version: 1 } : null; };
const projectTasks = (pid) => tasks.filter((x) => x.projectId === pid);
const nextTaskNumber = (pid) => Math.max(0, ...projectTasks(pid).map((x) => +x.key.split('-')[1])) + 1;
const err = (status, code, message) => ({ status, body: { code, message, status, fieldErrors: [] } });

// ───────────────────────── routes ─────────────────────────
const routes = [];
const on = (method, pattern, handler) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
  routes.push({ method, re, keys, handler });
};
const json = (v) => (typeof v === 'function' ? v : () => v);

// auth (any credentials work in the demo; the session lives in this tab only)
on('POST', '/api/v1/auth/refresh', (c) => (hasSession(c.client) ? { accessToken: 'demo', expiresIn: 900, user: c.client === 'admin' ? admin : me } : err(401, 'UNAUTHORIZED', 'No session')));
on('POST', '/api/v1/auth/login', (c) => { setSession(c.client, true); return { accessToken: 'demo', expiresIn: 900, user: c.client === 'admin' ? admin : me }; });
on('POST', '/api/v1/auth/register', (c) => { setSession('web', true); return { status: 201, body: { accessToken: 'demo', expiresIn: 900, user: { ...me, fullName: c.body?.fullName ?? me.fullName, email: c.body?.email ?? me.email } } }; });
on('POST', '/api/v1/auth/logout', (c) => { setSession(c.client, false); return { status: 204 }; });
on('GET', '/api/v1/public/config', json({ registrationEnabled: true, announcement: '' }));

// profile & org
on('GET', '/api/v1/me', () => me);
on('PUT', '/api/v1/me', (c) => Object.assign(me, c.body));
on('PUT', '/api/v1/me/preferences', (c) => Object.assign(me, c.body));
on('PUT', '/api/v1/me/password', () => ({ status: 204 }));
on('GET', '/api/v1/organization', json({ id: 2, name: 'Acme Robotics', slug: 'acme-robotics', industry: 'Robotics', status: 'ACTIVE', plan: { code: 'GROWTH', name: 'Growth', priceMonthly: 49, maxUsers: 25, maxProjects: 20, maxWorkflows: 15 }, usage: { users: 6, projects: 3, workflows: 4 } }));
on('PUT', '/api/v1/organization', (c) => ({ id: 2, slug: 'acme-robotics', status: 'ACTIVE', ...c.body }));
on('GET', '/api/v1/team', () => team);
on('POST', '/api/v1/team', (c) => { const m = { id: ++seq, fullName: c.body.fullName, email: c.body.email, jobTitle: c.body.jobTitle ?? '', role: c.body.role ?? 'MEMBER', status: 'ACTIVE', avatarColor: '#14B8A6', capacityPoints: c.body.capacityPoints ?? 20, openPoints: 0, openTasks: 0, lastLoginAt: null }; team.push(m); return { status: 201, body: { member: m, temporaryPassword: 'demo-only-not-real' } }; });
on('PUT', '/api/v1/team/:id', (c) => Object.assign(team.find((m) => m.id === +c.params.id) ?? {}, c.body));

// projects
on('GET', '/api/v1/projects', () => projects);
on('POST', '/api/v1/projects', (c) => { const p = { id: ++seq, key: (c.body.key ?? 'NEW').toUpperCase(), name: c.body.name, description: c.body.description ?? '', status: 'ACTIVE', color: c.body.color ?? '#6366F1', owner: U[1], startDate: c.body.startDate, dueDate: c.body.dueDate, memberCount: 1, totalTasks: 0, doneTasks: 0, openTasks: 0, progress: 0, myRole: 'OWNER', createdAt: new Date().toISOString() }; projects.push(p); return { status: 201, body: { project: p, members: [members[0]], milestones: [] } }; });
on('GET', '/api/v1/projects/:id', (c) => { const p = projects.find((x) => x.id === +c.params.id); return p ? { project: p, members, milestones: p.id === 1 ? milestones : [] } : err(404, 'PROJECT_NOT_FOUND', 'Project not found'); });
on('PUT', '/api/v1/projects/:id', (c) => { const p = Object.assign(projects.find((x) => x.id === +c.params.id), c.body); return { project: p, members, milestones }; });
on('POST', '/api/v1/projects/:id/members', () => ({ project: projects[0], members, milestones }));
on('PUT', '/api/v1/projects/:id/members/:userId', () => ({ project: projects[0], members, milestones }));
on('DELETE', '/api/v1/projects/:id/members/:userId', () => ({ project: projects[0], members, milestones }));
on('POST', '/api/v1/projects/:id/milestones', (c) => { const m = { id: ++seq, completed: false, totalTasks: 0, doneTasks: 0, ...c.body }; milestones.push(m); return { status: 201, body: m }; });
on('PUT', '/api/v1/projects/:id/milestones/:mid', (c) => Object.assign(milestones.find((m) => m.id === +c.params.mid) ?? {}, c.body));
on('DELETE', '/api/v1/projects/:id/milestones/:mid', (c) => { const i = milestones.findIndex((m) => m.id === +c.params.mid); if (i >= 0) milestones.splice(i, 1); return { status: 204 }; });

// tasks
on('GET', '/api/v1/projects/:id/tasks', (c) => projectTasks(+c.params.id));
on('POST', '/api/v1/projects/:id/tasks', (c) => {
  const pid = +c.params.id;
  const n = nextTaskNumber(pid);
  const prefix = projects.find((p) => p.id === pid)?.key ?? 'ATL';
  const task = { ...mk(++seq, n, c.body.title, c.body.status ?? 'TODO', c.body.priority ?? 'MEDIUM', c.body.assigneeId ?? null, c.body.storyPoints ?? 3, 7), description: c.body.description ?? '', dueDate: c.body.dueDate ?? null, assignee: c.body.assigneeId ? U[c.body.assigneeId] : undefined, reporter: U[1], position: 1024 * (tasks.length + 1), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), projectId: pid, key: `${prefix}-${n}` };
  tasks.push(task); logActivity(`Sarah Chen created ${task.key} · ${task.title}`, task.id);
  return { status: 201, body: task };
});
on('GET', '/api/v1/tasks/mine', () => tasks.filter((x) => x.status !== 'DONE').slice(0, 6).map((x) => ({ ...x, assignee: U[1] })));
on('GET', '/api/v1/tasks/:id', (c) => tasks.find((x) => x.id === +c.params.id) ?? err(404, 'TASK_NOT_FOUND', 'Task not found'));
on('PUT', '/api/v1/tasks/:id', (c) => {
  const task = tasks.find((x) => x.id === +c.params.id);
  if (!task) return err(404, 'TASK_NOT_FOUND', 'Task not found');
  const { assigneeId, version, ...rest } = c.body;
  Object.assign(task, rest, { assignee: assigneeId ? U[assigneeId] ?? team.find((m) => m.id === assigneeId) : undefined, version: task.version + 1, updatedAt: new Date().toISOString() });
  logActivity(`Sarah Chen updated ${task.key}`, task.id);
  return task;
});
on('PATCH', '/api/v1/tasks/:id/move', (c) => {
  const task = tasks.find((x) => x.id === +c.params.id);
  if (!task) return err(404, 'TASK_NOT_FOUND', 'Task not found');
  const moved = task.status !== c.body.status;
  Object.assign(task, { status: c.body.status, position: c.body.position, version: task.version + 1, updatedAt: new Date().toISOString() });
  if (moved) logActivity(`Sarah Chen moved ${task.key} to ${c.body.status.replace('_', ' ').toLowerCase()}`, task.id);
  return task;
});
on('DELETE', '/api/v1/tasks/:id', (c) => { const i = tasks.findIndex((x) => x.id === +c.params.id); if (i >= 0) tasks.splice(i, 1); return { status: 204 }; });
on('GET', '/api/v1/tasks/:id/comments', (c) => comments.filter((x) => x.taskId === +c.params.id));
on('POST', '/api/v1/tasks/:id/comments', (c) => {
  const cm = { id: ++seq, taskId: +c.params.id, author: U[1], body: c.body.body, automated: false, createdAt: new Date().toISOString() };
  comments.push(cm);
  const task = tasks.find((x) => x.id === cm.taskId); if (task) { task.commentCount = (task.commentCount ?? 0) + 1; logActivity(`Sarah Chen commented on ${task.key}`, task.id); }
  return { status: 201, body: cm };
});
on('DELETE', '/api/v1/comments/:id', (c) => { const i = comments.findIndex((x) => x.id === +c.params.id); if (i >= 0) comments.splice(i, 1); return { status: 204 }; });

// activity, notifications, insights, analytics
on('GET', '/api/v1/activities', (c) => page(activity.filter((a) => !c.query.taskId || a.entityId === +c.query.taskId || !a.entityId)));
on('GET', '/api/v1/notifications', () => page(notifications));
on('GET', '/api/v1/notifications/unread-count', () => ({ count: notifications.filter((n) => !n.read).length }));
on('POST', '/api/v1/notifications/:id/read', (c) => Object.assign(notifications.find((n) => n.id === +c.params.id) ?? {}, { read: true }));
on('POST', '/api/v1/notifications/read-all', () => { notifications.forEach((n) => { n.read = true; }); return { status: 204 }; });
on('GET', '/api/v1/insights/portfolio', json([{ projectId: 3, key: 'CPR', name: 'Customer Portal Revamp', color: '#F59E0B', status: 'ACTIVE', score: 41, risk: 'HIGH', forecast: 'Projected 21 days late at 0.5 points/day', progressPercent: 29, openTasks: 5, overdueTasks: 4 }, { projectId: 1, key: 'ATL', name: 'Atlas Mobile App', color: '#6366F1', status: 'ACTIVE', score: 58, risk: 'MEDIUM', forecast: 'Projected 15 days late at 1.43 points/day', progressPercent: 35, openTasks: 11, overdueTasks: 2 }, { projectId: 2, key: 'HEL', name: 'Helios Data Platform', color: '#0EA5E9', status: 'ACTIVE', score: 92, risk: 'LOW', forecast: 'On track to finish 12 days before the due date', progressPercent: 43, openTasks: 4, overdueTasks: 0 }]));
on('GET', '/api/v1/projects/:id/insights/health', () => health);
const priorities = [{ taskId: 7, key: 'ATL-7', title: 'Job map with clustering', current: 'HIGH', recommended: 'CRITICAL', score: 62, reasons: ['Overdue by 2 days', 'Its milestone is due within 7 days'] }, { taskId: 10, key: 'ATL-10', title: 'Accessibility audit (screen readers)', current: 'LOW', recommended: 'MEDIUM', score: 22, reasons: ['Open for 30 days', 'Due within two weeks'] }];
on('GET', '/api/v1/projects/:id/insights/priorities', () => priorities);
on('POST', '/api/v1/projects/:id/insights/priorities/:taskId/apply', (c) => {
  const i = priorities.findIndex((p) => p.taskId === +c.params.taskId); const task = tasks.find((x) => x.id === +c.params.taskId);
  if (i >= 0 && task) { task.priority = priorities[i].recommended; priorities.splice(i, 1); }
  return task ?? err(404, 'TASK_NOT_FOUND', 'Task not found');
});
const workload = { members: team.map((m) => ({ userId: m.id, name: m.fullName, avatarColor: m.avatarColor, capacity: m.capacityPoints, openPoints: m.openPoints, openTasks: m.openTasks, utilization: Math.round(m.openPoints * 100 / m.capacityPoints), state: m.openPoints > m.capacityPoints ? 'OVERLOADED' : m.openPoints / m.capacityPoints >= 0.6 ? 'BALANCED' : 'AVAILABLE' })).sort((a, b) => b.utilization - a.utilization),
  suggestions: [{ taskId: 4, taskKey: 'ATL-4', taskTitle: 'Push notifications for new assignments', points: 5, fromUserId: 4, fromName: 'Diego Alvarez', toUserId: 1, toName: 'Sarah Chen', reason: 'Diego Alvarez is at 186% capacity; Sarah Chen would be at 35% after taking this task' }, { taskId: 3, taskKey: 'ATL-3', taskTitle: 'Conflict resolution for concurrent edits', points: 8, fromUserId: 4, fromName: 'Diego Alvarez', toUserId: 3, toName: 'Mei Tanaka', reason: 'Diego Alvarez is at 186% capacity; Mei Tanaka would be at 80% after taking this high-priority task' }] };
on('GET', '/api/v1/projects/:id/insights/workload', () => workload);
on('POST', '/api/v1/projects/:id/insights/workload/apply', (c) => {
  const task = tasks.find((x) => x.id === c.body.taskId); if (!task) return err(404, 'TASK_NOT_FOUND', 'Task not found');
  const s = workload.suggestions.find((x) => x.taskId === task.id);
  if (s) {
    const from = workload.members.find((m) => m.userId === s.fromUserId); const to = workload.members.find((m) => m.userId === s.toUserId);
    from.openPoints -= s.points; from.openTasks -= 1; to.openPoints += s.points; to.openTasks += 1;
    [from, to].forEach((m) => { m.utilization = Math.round(m.openPoints * 100 / m.capacity); m.state = m.openPoints > m.capacity ? 'OVERLOADED' : m.openPoints / m.capacity >= 0.6 ? 'BALANCED' : 'AVAILABLE'; });
    workload.suggestions.splice(workload.suggestions.indexOf(s), 1);
  }
  task.assignee = U[c.body.toUserId]; logActivity(`Sarah Chen reassigned ${task.key} to ${task.assignee?.fullName}`, task.id);
  return task;
});
on('GET', '/api/v1/analytics/overview', json({ totals: { total: 31, open: 20, done: 11, overdue: 6, completionRate: 35, avgCycleTimeDays: 6.4, avgLeadTimeDays: 14.2 }, throughput: weeks, statusDistribution: { BACKLOG: 3, TODO: 8, IN_PROGRESS: 5, IN_REVIEW: 2, BLOCKED: 2, DONE: 11 }, priorityDistribution: { LOW: 4, MEDIUM: 8, HIGH: 6, CRITICAL: 2 },
  topContributors: [[4, 13, 33], [3, 4, 16], [6, 2, 11], [2, 3, 9], [1, 1, 2]].map(([u, n, p]) => ({ userId: u, name: U[u].fullName, avatarColor: U[u].avatarColor, completedTasks: n, completedPoints: p })),
  workload: workload.members }));
on('GET', '/api/v1/calendar', () => [...tasks.filter((x) => x.dueDate).map((x) => ({ kind: 'TASK', id: x.id, projectId: x.projectId, projectKey: x.key.split('-')[0], projectColor: projects.find((p) => p.id === x.projectId)?.color ?? '#6366F1', title: `${x.key} · ${x.title}`, date: x.dueDate, status: x.status, priority: x.priority, completed: x.status === 'DONE' })), { kind: 'MILESTONE', id: 1, projectId: 1, projectKey: 'ATL', projectColor: '#6366F1', title: 'Public beta', date: d(5), completed: false }, { kind: 'MILESTONE', id: 3, projectId: 2, projectKey: 'HEL', projectColor: '#0EA5E9', title: 'Ingestion GA', date: d(25), completed: false }].sort((a, b) => a.date.localeCompare(b.date)));

// workflows
on('GET', '/api/v1/workflows/catalog', () => catalog);
on('GET', '/api/v1/workflows', () => workflows);
on('GET', '/api/v1/workflows/executions', () => page(execs));
on('POST', '/api/v1/workflows', (c) => {
  const w = { id: ++seq, name: c.body.name, description: c.body.description ?? '', projectId: c.body.projectId, projectName: projects.find((p) => p.id === c.body.projectId)?.name, triggerType: c.body.nodes?.find((n) => n.type === 'TRIGGER')?.kind ?? 'TASK_CREATED', enabled: !!c.body.enabled, runCount: 0, lastRunAt: null, nodeCount: c.body.nodes?.length ?? 0, createdBy: U[1], updatedAt: new Date().toISOString() };
  workflows.push(w); wfGraphs[w.id] = { nodes: c.body.nodes ?? [], edges: c.body.edges ?? [] };
  return { status: 201, body: wfDetailFor(w.id) };
});
on('GET', '/api/v1/workflows/:id', (c) => wfDetailFor(+c.params.id) ?? err(404, 'WORKFLOW_NOT_FOUND', 'Workflow not found'));
on('PUT', '/api/v1/workflows/:id', (c) => {
  const w = workflows.find((x) => x.id === +c.params.id); if (!w) return err(404, 'WORKFLOW_NOT_FOUND', 'Workflow not found');
  Object.assign(w, { name: c.body.name, description: c.body.description, enabled: !!c.body.enabled, nodeCount: c.body.nodes?.length ?? w.nodeCount, triggerType: c.body.nodes?.find((n) => n.type === 'TRIGGER')?.kind ?? w.triggerType, updatedAt: new Date().toISOString() });
  wfGraphs[w.id] = { nodes: c.body.nodes ?? [], edges: c.body.edges ?? [] };
  return wfDetailFor(w.id);
});
on('PATCH', '/api/v1/workflows/:id/enabled', (c) => Object.assign(workflows.find((x) => x.id === +c.params.id) ?? {}, { enabled: !!c.body.enabled }));
on('DELETE', '/api/v1/workflows/:id', (c) => { const i = workflows.findIndex((x) => x.id === +c.params.id); if (i >= 0) workflows.splice(i, 1); return { status: 204 }; });
on('GET', '/api/v1/workflows/:id/executions', (c) => page(execs.filter((e) => e.workflowId === +c.params.id)));
on('POST', '/api/v1/workflows/:id/test', () => ({ ...execs[0], id: ++seq, dryRun: true, startedAt: new Date().toISOString(), steps: execs[0].steps.map((s) => (s.result === 'DONE' ? { ...s, result: 'DRY_RUN', message: 'Would ' + s.message.charAt(0).toLowerCase() + s.message.slice(1) } : s)) }));

// admin console
on('GET', '/api/v1/admin/overview', json({ organizations: 4, activeOrganizations: 4, users: 10, activeUsers: 10, projects: 5, tasks: 35, tasksCompleted7d: 9, signups30d: 7, workflowRuns24h: 48, workflowFailures24h: 1, apiRequests24h: 18432, apiErrorRate24h: 0.2, apiP95Ms24h: 87, planDistribution: { Enterprise: 1, Growth: 1, Platform: 1, Starter: 1 },
  recentAudit: [['LOGIN_SUCCESS', 'sarah@acme.dev', 'USER', '2'], ['WORKFLOW_UPDATED', 'sarah@acme.dev', 'WORKFLOW', '2'], ['LOGIN_FAILED', 'unknown@acme.dev', 'USER', null], ['ADMIN_ORG_UPDATED', 'admin@nexora.dev', 'ORGANIZATION', '3'], ['USER_INVITED', 'lena@globex.dev', 'USER', '9'], ['SETTING_UPDATED', 'admin@nexora.dev', 'SETTING', 'insights.stale_days']].map(([a, e, et, id], i) => ({ id: 100 - i, action: a, actorEmail: e, entityType: et, entityId: id, ipAddress: '172.18.0.1', createdAt: t(-i * 0.2), details: { client: 'web' } })) }));
on('GET', '/api/v1/admin/analytics/daily', (c) => dailyArr(+(c.query.days ?? 30)));
on('GET', '/api/v1/admin/organizations', () => page(orgs));
on('GET', '/api/v1/admin/organizations/:id', (c) => ({ organization: orgs.find((o) => o.id === +c.params.id), workflows: 4, openTasks: 20, admins: [{ id: 1, fullName: 'Sarah Chen', email: 'sarah@acme.dev', role: 'ORG_ADMIN', roleId: 2, status: 'ACTIVE', organizationId: 2, createdAt: t(-100) }] }));
on('PUT', '/api/v1/admin/organizations/:id', (c) => Object.assign(orgs.find((o) => o.id === +c.params.id) ?? {}, c.body));
on('GET', '/api/v1/admin/roles', () => roles);
on('POST', '/api/v1/admin/roles', (c) => { const r = { id: ++seq, systemRole: false, users: 0, permissions: [], ...c.body }; roles.push(r); return { status: 201, body: r }; });
on('PUT', '/api/v1/admin/roles/:id', (c) => Object.assign(roles.find((r) => r.id === +c.params.id) ?? {}, c.body));
on('DELETE', '/api/v1/admin/roles/:id', (c) => { const i = roles.findIndex((r) => r.id === +c.params.id && !r.systemRole); if (i < 0) return err(400, 'SYSTEM_ROLE', 'System roles cannot be deleted'); roles.splice(i, 1); return { status: 204 }; });
on('GET', '/api/v1/admin/permissions', () => permissions);
const adminUsers = team.map((u) => ({ id: u.id, fullName: u.fullName, email: u.email, role: u.role, roleId: u.role === 'ORG_ADMIN' ? 2 : u.role === 'MANAGER' ? 3 : 4, status: u.status, organizationId: 2, organizationName: 'Acme Robotics', lastLoginAt: u.lastLoginAt, createdAt: t(-90) }))
  .concat([{ id: 9, fullName: 'Lena Novak', email: 'lena@globex.dev', role: 'ORG_ADMIN', roleId: 2, status: 'ACTIVE', organizationId: 3, organizationName: 'Globex Health', lastLoginAt: t(-0.6), createdAt: t(-45) }, { id: 10, fullName: 'Sam Okafor', email: 'sam@globex.dev', role: 'MEMBER', roleId: 4, status: 'SUSPENDED', organizationId: 3, organizationName: 'Globex Health', lastLoginAt: t(-9), createdAt: t(-40) }]);
on('GET', '/api/v1/admin/users', (c) => page(adminUsers.filter((u) => (!c.query.q || (u.fullName + u.email).toLowerCase().includes(String(c.query.q).toLowerCase())) && (!c.query.status || u.status === c.query.status) && (!c.query.roleId || u.roleId === +c.query.roleId))));
on('PUT', '/api/v1/admin/users/:id', (c) => { const u = adminUsers.find((x) => x.id === +c.params.id); if (u && c.body.roleId) u.role = roles.find((r) => r.id === +c.body.roleId)?.name ?? u.role; return Object.assign(u ?? {}, c.body); });
on('POST', '/api/v1/admin/users/:id/revoke-sessions', () => ({ status: 204 }));
on('GET', '/api/v1/admin/plans', () => plans);
on('POST', '/api/v1/admin/plans', (c) => { const p = { id: ++seq, active: true, organizations: 0, ...c.body }; plans.push(p); return { status: 201, body: p }; });
on('PUT', '/api/v1/admin/plans/:id', (c) => Object.assign(plans.find((p) => p.id === +c.params.id) ?? {}, c.body));
on('GET', '/api/v1/admin/projects', () => page(adminProjects));
on('GET', '/api/v1/admin/audit-logs/actions', json(['ADMIN_ORG_UPDATED', 'LOGIN_FAILED', 'LOGIN_SUCCESS', 'ORG_REGISTERED', 'PROJECT_CREATED', 'SETTING_UPDATED', 'USER_INVITED', 'WORKFLOW_UPDATED']));
on('GET', '/api/v1/admin/audit-logs', (c) => page(auditLogs.filter((a) => !c.query.action || a.action === c.query.action)));
on('GET', '/api/v1/admin/settings', () => settings);
on('PUT', '/api/v1/admin/settings/:key', (c) => Object.assign(settings.find((s) => s.key === decodeURIComponent(c.params.key)) ?? {}, { value: String(c.body.value), updatedBy: 'admin@nexora.dev', updatedAt: new Date().toISOString() }));
on('GET', '/api/v1/admin/api-metrics', () => apiMetrics);
on('GET', '/realtime/metrics', json({ uptimeSeconds: 186400, connections: 7, peakConnections: 23, eventsProcessed: 18210, eventsFailed: 0, eventsLastHour: 412, eventsLastMinute: 9, lastEventAt: t(0), byType: { 'task.updated': 7311, 'activity.created': 6120, 'notification.created': 2101, 'comment.created': 1450, 'workflow.executed': 822 } }));

// ───────────────────────── fetch interception ─────────────────────────
function handle(method, url, headers, rawBody) {
  const path = url.pathname.replace(/^.*?(?=\/api\/v1\/|\/realtime\/)/, '');
  const route = routes.find((r) => r.method === method && r.re.test(path));
  if (!route) {
    if (method === 'GET') return { status: 404, body: { code: 'NOT_FOUND', message: 'Not available in the demo', status: 404 } };
    return { status: 200, body: {} };
  }
  const m = path.match(route.re);
  const params = Object.fromEntries(route.keys.map((k, i) => [k, m[i + 1]]));
  const query = Object.fromEntries(url.searchParams.entries());
  let body = null;
  try { body = rawBody ? JSON.parse(rawBody) : null; } catch { body = null; }
  const client = (headers.get('X-Client') || headers.get('x-client')) === 'admin' ? 'admin' : 'web';
  const out = route.handler({ params, query, body: body ?? {}, client });
  if (out && typeof out === 'object' && 'status' in out && ('body' in out || out.status === 204) && Object.keys(out).every((k) => k === 'status' || k === 'body')) return out;
  return { status: 200, body: out };
}

const DEMO_PATTERN = /\/api\/v1\/|\/realtime\/metrics/;

function showBanner(text) {
  const mount = () => {
    if (document.getElementById('nexora-demo-banner')) return;
    const el = document.createElement('div');
    el.id = 'nexora-demo-banner';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483000;max-width:calc(100vw - 32px);padding:8px 14px;border-radius:999px;font:500 12.5px/1.35 Inter,system-ui,sans-serif;color:#fff;background:linear-gradient(90deg,#7c5cff,#22d3ee);box-shadow:0 6px 24px rgba(0,0,0,.35);display:flex;gap:10px;align-items:center';
    const span = document.createElement('span');
    span.textContent = text;
    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Hide demo notice');
    close.textContent = '×';
    close.style.cssText = 'background:rgba(255,255,255,.2);border:0;color:#fff;border-radius:999px;width:20px;height:20px;cursor:pointer;font-size:14px;line-height:1';
    close.onclick = () => el.remove();
    el.append(span, close);
    document.body.appendChild(el);
  };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
}

/**
 * Answers NEXORA API calls inside the browser with sample data so the built apps can run on static hosting.
 * Only used by demo builds (GitHub Pages); production builds never include this module.
 */
export function installDemoApi(options = {}) {
  if (window.__nexoraDemo) return;
  window.__nexoraDemo = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const req = input instanceof Request ? input : null;
    const url = new URL(req ? req.url : String(input), window.location.href);
    if (!DEMO_PATTERN.test(url.pathname)) return realFetch(input, init);
    const method = (init.method || req?.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers || req?.headers || {});
    let raw = init.body;
    if (raw == null && req) raw = await req.clone().text();
    if (raw != null && typeof raw !== 'string') raw = await new Response(raw).text();
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 180));
    const { status, body } = handle(method, url, headers, raw);
    return new Response(status === 204 || body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  };
  if (options.banner !== false) showBanner(options.banner || 'Live demo with sample data. Sign in with any password; changes stay in this tab.');
}
