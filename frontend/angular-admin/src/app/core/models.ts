export interface Page<T> { content: T[]; page: number; size: number; totalElements: number; totalPages: number }

export interface AdminUser {
  id: number; email: string; fullName: string; role: string; permissions: string[]; avatarColor: string;
  organization: { id: number; name: string; slug: string; plan: string };
}
export interface AuthResponse { accessToken: string; expiresIn: number; user: AdminUser }

export interface AuditEntry {
  id: number; organizationId?: number; actorId?: number; actorEmail?: string; action: string; entityType: string;
  entityId?: string; ipAddress?: string; details?: Record<string, unknown>; createdAt: string;
}

export interface Overview {
  organizations: number; activeOrganizations: number; users: number; activeUsers: number; projects: number; tasks: number;
  tasksCompleted7d: number; signups30d: number; workflowRuns24h: number; workflowFailures24h: number;
  apiRequests24h: number; apiErrorRate24h: number; apiP95Ms24h: number; planDistribution: Record<string, number>;
  recentAudit: AuditEntry[];
}

export interface DailyPoint { day: string; newUsers: number; newOrganizations: number; tasksCreated: number; tasksCompleted: number; workflowRuns: number }

export interface UserRow {
  id: number; fullName: string; email: string; role: string; roleId: number; status: 'ACTIVE' | 'SUSPENDED';
  organizationId: number; organizationName?: string; lastLoginAt?: string; createdAt: string;
}

export interface OrgRow {
  id: number; name: string; slug: string; status: 'ACTIVE' | 'SUSPENDED'; industry?: string; planCode: string;
  planName: string; users: number; projects: number; createdAt: string;
}
export interface OrgDetail { organization: OrgRow; workflows: number; openTasks: number; admins: UserRow[] }

export interface RoleRow { id: number; name: string; description?: string; systemRole: boolean; permissions: string[]; users: number }
export interface PermissionRow { id: number; code: string; description: string; category: string }

export interface PlanRow {
  id: number; code: string; name: string; description?: string; priceMonthly: number; maxUsers: number;
  maxProjects: number; maxWorkflows: number; active: boolean; organizations: number;
}

export interface ProjectRow {
  id: number; key: string; name: string; status: string; organizationId: number; organizationName?: string; ownerName: string;
  totalTasks: number; openTasks: number; overdueTasks: number; healthScore: number; risk: 'LOW' | 'MEDIUM' | 'HIGH'; dueDate?: string;
}

export interface Setting { key: string; value: string; valueType: 'STRING' | 'BOOLEAN' | 'NUMBER'; description: string; updatedBy?: string; updatedAt: string }

export interface EndpointStat { method: string; path: string; requests: number; errors: number; errorRate: number; avgMs: number; p95Ms: number }
export interface ApiMetrics {
  requests: number; errors: number; errorRate: number; avgMs: number; p95Ms: number;
  hourly: { hour: string; requests: number; errors: number; avgMs: number }[];
  endpoints: EndpointStat[]; slowest: EndpointStat[];
}

export interface RealtimeMetrics {
  uptimeSeconds: number; connections: number; peakConnections: number; eventsProcessed: number; eventsFailed: number;
  eventsLastHour: number; eventsLastMinute: number; lastEventAt: string | null; byType: Record<string, number>;
}

export interface ApiErrorBody { code: string; message: string; fieldErrors?: { field: string; message: string }[] }
