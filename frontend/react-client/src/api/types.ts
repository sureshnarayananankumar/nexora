// Mirrors the Spring Boot DTOs (see backend/springboot-api/**/…Dtos.java).

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'BLOCKED' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ProjectStatus = 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';
export type ProjectRole = 'OWNER' | 'CONTRIBUTOR' | 'VIEWER';
export type Theme = 'light' | 'dark' | 'system';

export interface UserRef { id: number; fullName: string; email?: string; avatarColor: string }

export interface Me {
  id: number; email: string; fullName: string; jobTitle?: string; avatarColor: string; role: string;
  permissions: string[]; organization: { id: number; name: string; slug: string; plan: string };
  capacityPoints: number; timezone: string; theme: Theme; dashboardLayout?: string[];
}

export interface AuthResponse { accessToken: string; expiresIn: number; user: Me }

export interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number }

export interface ProjectSummary {
  id: number; key: string; name: string; description?: string; status: ProjectStatus; color: string;
  owner: UserRef; startDate: string; dueDate?: string; memberCount: number; totalTasks: number; doneTasks: number;
  openTasks: number; progress: number; myRole?: ProjectRole; createdAt: string;
}
export interface ProjectMemberDto { user: UserRef; projectRole: ProjectRole; capacityPoints: number; joinedAt: string }
export interface MilestoneDto { id: number; name: string; description?: string; dueDate: string; completed: boolean; totalTasks: number; doneTasks: number }
export interface ProjectDetail { project: ProjectSummary; members: ProjectMemberDto[]; milestones: MilestoneDto[] }

export interface Task {
  id: number; projectId: number; key: string; title: string; description?: string; status: TaskStatus;
  priority: TaskPriority; assignee?: UserRef; reporter?: UserRef; milestoneId?: number; storyPoints?: number;
  dueDate?: string; position: number; blockedReason?: string; dependsOn: number[]; commentCount: number;
  startedAt?: string; completedAt?: string; createdAt: string; updatedAt: string; version: number;
}
export interface Comment { id: number; taskId: number; author?: UserRef; body: string; automated: boolean; createdAt: string }

export interface Activity {
  id: number; projectId?: number; type: string; entityType: string; entityId?: number; summary: string;
  metadata?: Record<string, unknown>; actor?: UserRef; createdAt: string;
}
export interface Notification { id: number; type: string; title: string; body?: string; link?: string; read: boolean; createdAt: string }

export interface HealthFactor { code: string; label: string; penalty: number; maxPenalty: number; detail: string }
export interface HealthReport {
  score: number; risk: 'LOW' | 'MEDIUM' | 'HIGH'; factors: HealthFactor[];
  forecast: { velocityPerDay: number; remainingPoints: number; projectedFinish?: string; daysLate?: number; message: string };
  stats: {
    totalTasks: number; openTasks: number; doneTasks: number; overdueTasks: number; blockedTasks: number; staleTasks: number;
    unassignedUrgent: number; overloadedMembers: number; completedPoints: number; totalPoints: number; progressPercent: number;
    elapsedPercent?: number;
  };
}
export interface PortfolioItem {
  projectId: number; key: string; name: string; color: string; status: ProjectStatus; score: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH'; forecast: string; progressPercent: number; openTasks: number; overdueTasks: number;
}
export interface Recommendation { taskId: number; key: string; title: string; current: TaskPriority; recommended: TaskPriority; score: number; reasons: string[] }
export interface MemberLoad { userId: number; name: string; avatarColor: string; capacity: number; openPoints: number; openTasks: number; utilization: number; state: 'OVERLOADED' | 'BALANCED' | 'AVAILABLE' }
export interface Suggestion { taskId: number; taskKey: string; taskTitle: string; points: number; fromUserId: number; fromName: string; toUserId: number; toName: string; reason: string }
export interface Workload { members: MemberLoad[]; suggestions: Suggestion[] }

export interface AnalyticsOverview {
  totals: { total: number; open: number; done: number; overdue: number; completionRate: number; avgCycleTimeDays: number; avgLeadTimeDays: number };
  throughput: { weekStart: string; created: number; completed: number; completedPoints: number }[];
  statusDistribution: Record<TaskStatus, number>;
  priorityDistribution: Record<TaskPriority, number>;
  topContributors: { userId: number; name: string; avatarColor: string; completedTasks: number; completedPoints: number }[];
  workload: MemberLoad[];
}

export type NodeType = 'TRIGGER' | 'CONDITION' | 'ACTION';
export interface CatalogField { name: string; type: 'status' | 'priority' | 'number' | 'text' | 'user'; required: boolean; label: string }
export interface CatalogKind { type: NodeType; kind: string; label: string; description: string; fields: CatalogField[] }
export interface WorkflowNodeDto { key: string; type: NodeType; kind: string; label?: string; config: Record<string, unknown>; x: number; y: number }
export interface WorkflowEdgeDto { source: string; target: string; branch?: 'TRUE' | 'FALSE' | null }
export interface WorkflowSummary {
  id: number; name: string; description?: string; projectId?: number; projectName?: string; triggerType: string;
  enabled: boolean; runCount: number; lastRunAt?: string; nodeCount: number; createdBy?: UserRef; updatedAt: string;
}
export interface WorkflowDetail { workflow: WorkflowSummary; nodes: WorkflowNodeDto[]; edges: WorkflowEdgeDto[]; version: number }
export interface ExecutionStep { node: string; type?: NodeType; kind?: string; label?: string; result: string; message: string; ms?: number }
export interface Execution {
  id: number; workflowId: number; workflowName: string; triggerEvent: string; taskId?: number; status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  dryRun: boolean; steps: ExecutionStep[]; errorMessage?: string; startedAt: string; durationMs: number;
}

export interface TeamMember {
  id: number; fullName: string; email: string; jobTitle?: string; avatarColor: string; role: string; status: 'ACTIVE' | 'SUSPENDED';
  capacityPoints: number; openPoints: number; openTasks: number; lastLoginAt?: string;
}
export interface OrganizationDto {
  id: number; name: string; slug: string; industry?: string; status: string;
  plan: { code: string; name: string; priceMonthly: number; maxUsers: number; maxProjects: number; maxWorkflows: number };
  usage: { users: number; projects: number; workflows: number };
}
export interface CalendarItem {
  kind: 'TASK' | 'MILESTONE'; id: number; projectId: number; projectKey: string; projectColor: string; title: string;
  date: string; status?: TaskStatus; priority?: TaskPriority; completed: boolean;
}
export interface PublicConfig { registrationEnabled: boolean; announcement: string }
