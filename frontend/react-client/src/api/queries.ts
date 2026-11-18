import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { del, get, patch, post, put, qs } from './client';
import type {
  Activity, AnalyticsOverview, CalendarItem, CatalogKind, Comment, Execution, HealthReport, Me, MilestoneDto,
  Notification, OrganizationDto, Page, PortfolioItem, ProjectDetail, ProjectRole, ProjectSummary, PublicConfig,
  Recommendation, Task, TaskPriority, TaskStatus, TeamMember, Theme, WorkflowDetail, WorkflowEdgeDto,
  WorkflowNodeDto, WorkflowSummary, Workload,
} from './types';

export const keys = {
  me: ['me'] as const,
  config: ['public-config'] as const,
  projects: ['projects'] as const,
  project: (id: number) => ['project', id] as const,
  tasks: (projectId: number) => ['tasks', projectId] as const,
  task: (id: number) => ['task', id] as const,
  myTasks: ['tasks', 'mine'] as const,
  comments: (taskId: number) => ['comments', taskId] as const,
  activities: (scope: string) => ['activities', scope] as const,
  notifications: ['notifications'] as const,
  unread: ['notifications', 'unread'] as const,
  portfolio: ['insights', 'portfolio'] as const,
  health: (projectId: number) => ['insights', 'health', projectId] as const,
  recommendations: (projectId: number) => ['insights', 'recommendations', projectId] as const,
  workload: (projectId: number) => ['insights', 'workload', projectId] as const,
  analytics: (projectId?: number) => ['analytics', projectId ?? 'all'] as const,
  calendar: (from: string, to: string) => ['calendar', from, to] as const,
  team: ['team'] as const,
  organization: ['organization'] as const,
  workflows: ['workflows'] as const,
  workflow: (id: number) => ['workflow', id] as const,
  catalog: ['workflow-catalog'] as const,
  executions: (workflowId?: number) => ['executions', workflowId ?? 'all'] as const,
};

/** Insights depend on tasks; refresh them whenever task data changes. */
export function invalidateTaskViews(qc: QueryClient, projectId?: number) {
  if (projectId) {
    qc.invalidateQueries({ queryKey: keys.tasks(projectId) });
    qc.invalidateQueries({ queryKey: keys.project(projectId) });
    qc.invalidateQueries({ queryKey: keys.health(projectId) });
    qc.invalidateQueries({ queryKey: keys.recommendations(projectId) });
    qc.invalidateQueries({ queryKey: keys.workload(projectId) });
  }
  qc.invalidateQueries({ queryKey: keys.myTasks });
  qc.invalidateQueries({ queryKey: keys.portfolio });
  qc.invalidateQueries({ queryKey: keys.projects });
  qc.invalidateQueries({ queryKey: ['analytics'] });
}

// ── reads ────────────────────────────────────────────────────────────────
export const usePublicConfig = () => useQuery({ queryKey: keys.config, queryFn: () => get<PublicConfig>('/public/config'), staleTime: 60_000 });
export const useProjects = () => useQuery({ queryKey: keys.projects, queryFn: () => get<ProjectSummary[]>('/projects') });
export const useProject = (id: number) => useQuery({ queryKey: keys.project(id), queryFn: () => get<ProjectDetail>(`/projects/${id}`), enabled: id > 0 });
export const useTasks = (projectId: number) => useQuery({ queryKey: keys.tasks(projectId), queryFn: () => get<Task[]>(`/projects/${projectId}/tasks`), enabled: projectId > 0 });
export const useTask = (id: number | null) => useQuery({ queryKey: keys.task(id ?? 0), queryFn: () => get<Task>(`/tasks/${id}`), enabled: !!id });
export const useMyTasks = () => useQuery({ queryKey: keys.myTasks, queryFn: () => get<Task[]>('/tasks/mine') });
export const useComments = (taskId: number | null) => useQuery({ queryKey: keys.comments(taskId ?? 0), queryFn: () => get<Comment[]>(`/tasks/${taskId}/comments`), enabled: !!taskId });
export const useActivities = (params: { projectId?: number; taskId?: number; size?: number }) => useQuery({
  queryKey: keys.activities(`${params.projectId ?? 'all'}:${params.taskId ?? ''}`),
  queryFn: () => get<Page<Activity>>(`/activities${qs({ projectId: params.projectId, taskId: params.taskId, size: params.size ?? 30 })}`),
});
export const useNotifications = (unread = false) => useQuery({ queryKey: [...keys.notifications, unread], queryFn: () => get<Page<Notification>>(`/notifications${qs({ unread, size: 30 })}`) });
export const useUnreadCount = () => useQuery({ queryKey: keys.unread, queryFn: () => get<{ count: number }>('/notifications/unread-count'), refetchInterval: 60_000 });
export const usePortfolio = () => useQuery({ queryKey: keys.portfolio, queryFn: () => get<PortfolioItem[]>('/insights/portfolio') });
export const useHealth = (projectId: number) => useQuery({ queryKey: keys.health(projectId), queryFn: () => get<HealthReport>(`/projects/${projectId}/insights/health`), enabled: projectId > 0 });
export const useRecommendations = (projectId: number) => useQuery({ queryKey: keys.recommendations(projectId), queryFn: () => get<Recommendation[]>(`/projects/${projectId}/insights/priorities`), enabled: projectId > 0 });
export const useWorkload = (projectId: number) => useQuery({ queryKey: keys.workload(projectId), queryFn: () => get<Workload>(`/projects/${projectId}/insights/workload`), enabled: projectId > 0 });
export const useAnalytics = (projectId?: number) => useQuery({ queryKey: keys.analytics(projectId), queryFn: () => get<AnalyticsOverview>(`/analytics/overview${qs({ projectId, weeks: 8 })}`) });
export const useCalendar = (from: string, to: string) => useQuery({ queryKey: keys.calendar(from, to), queryFn: () => get<CalendarItem[]>(`/calendar${qs({ from, to })}`) });
export const useTeam = () => useQuery({ queryKey: keys.team, queryFn: () => get<TeamMember[]>('/team') });
export const useOrganization = () => useQuery({ queryKey: keys.organization, queryFn: () => get<OrganizationDto>('/organization') });
export const useWorkflows = () => useQuery({ queryKey: keys.workflows, queryFn: () => get<WorkflowSummary[]>('/workflows') });
export const useWorkflow = (id: number | null) => useQuery({ queryKey: keys.workflow(id ?? 0), queryFn: () => get<WorkflowDetail>(`/workflows/${id}`), enabled: !!id });
export const useCatalog = () => useQuery({ queryKey: keys.catalog, queryFn: () => get<{ kinds: CatalogKind[]; placeholders: string[] }>('/workflows/catalog'), staleTime: Infinity });
export const useExecutions = (workflowId?: number) => useQuery({
  queryKey: keys.executions(workflowId),
  queryFn: () => get<Page<Execution>>(workflowId ? `/workflows/${workflowId}/executions?size=30` : '/workflows/executions?size=30'),
});

// ── writes ───────────────────────────────────────────────────────────────
export interface TaskInput {
  title: string; description?: string; status?: TaskStatus; priority: TaskPriority; assigneeId?: number | null;
  milestoneId?: number | null; storyPoints?: number | null; dueDate?: string | null; dependsOn?: number[]; blockedReason?: string | null;
}

export function useCreateTask(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) => post<Task>(`/projects/${projectId}/tasks`, input),
    onSuccess: () => invalidateTaskViews(qc, projectId),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: TaskInput & { id: number; version: number; status: TaskStatus }) => put<Task>(`/tasks/${id}`, input),
    onSuccess: (task) => {
      qc.setQueryData(keys.task(task.id), task);
      invalidateTaskViews(qc, task.projectId);
    },
  });
}

/** Optimistic board move: the card jumps immediately and rolls back if the API refuses. */
export function useMoveTask(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, position }: { id: number; status: TaskStatus; position: number }) => patch<Task>(`/tasks/${id}/move`, { status, position }),
    onMutate: async ({ id, status, position }) => {
      await qc.cancelQueries({ queryKey: keys.tasks(projectId) });
      const previous = qc.getQueryData<Task[]>(keys.tasks(projectId));
      qc.setQueryData<Task[]>(keys.tasks(projectId), (old) => old?.map((t) => (t.id === id ? { ...t, status, position } : t)));
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(keys.tasks(projectId), ctx.previous),
    onSuccess: (task) => {
      qc.setQueryData<Task[]>(keys.tasks(projectId), (old) => old?.map((t) => (t.id === task.id ? task : t)));
      qc.setQueryData(keys.task(task.id), task);
    },
    onSettled: () => invalidateTaskViews(qc, projectId),
  });
}

export function useDeleteTask(projectId: number) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => del(`/tasks/${id}`), onSuccess: () => invalidateTaskViews(qc, projectId) });
}

export function useAddComment(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => post<Comment>(`/tasks/${taskId}/comments`, { body }),
    onSuccess: (c) => {
      qc.setQueryData<Comment[]>(keys.comments(taskId), (old) => (old?.some((x) => x.id === c.id) ? old : [...(old ?? []), c]));
    },
  });
}

export function useDeleteComment(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => del(`/comments/${id}`),
    onSuccess: (_d, id) => qc.setQueryData<Comment[]>(keys.comments(taskId), (old) => old?.filter((c) => c.id !== id)),
  });
}

export interface ProjectInput { key?: string; name: string; description?: string; color: string; startDate: string; dueDate?: string | null; status?: string; memberIds?: number[] }

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (input: ProjectInput) => post<ProjectDetail>('/projects', input), onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }) });
}

export function useUpdateProject(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput) => put<ProjectDetail>(`/projects/${id}`, input),
    onSuccess: (d) => { qc.setQueryData(keys.project(id), d); qc.invalidateQueries({ queryKey: keys.projects }); qc.invalidateQueries({ queryKey: keys.portfolio }); },
  });
}

export function useProjectMembers(id: number) {
  const qc = useQueryClient();
  const done = (d: ProjectDetail) => { qc.setQueryData(keys.project(id), d); qc.invalidateQueries({ queryKey: keys.workload(id) }); };
  return {
    add: useMutation({ mutationFn: (v: { userId: number; projectRole: ProjectRole }) => post<ProjectDetail>(`/projects/${id}/members`, v), onSuccess: done }),
    update: useMutation({ mutationFn: (v: { userId: number; projectRole: ProjectRole }) => put<ProjectDetail>(`/projects/${id}/members/${v.userId}`, { projectRole: v.projectRole }), onSuccess: done }),
    remove: useMutation({ mutationFn: (userId: number) => del<ProjectDetail>(`/projects/${id}/members/${userId}`), onSuccess: (d) => { done(d); invalidateTaskViews(qc, id); } }),
  };
}

export function useSaveMilestone(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id?: number; name: string; description?: string; dueDate: string; completed: boolean }) =>
      id ? put<MilestoneDto>(`/projects/${projectId}/milestones/${id}`, input) : post<MilestoneDto>(`/projects/${projectId}/milestones`, input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.project(projectId) }); qc.invalidateQueries({ queryKey: ['calendar'] }); },
  });
}

export function useDeleteMilestone(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => del(`/projects/${projectId}/milestones/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.project(projectId) }); qc.invalidateQueries({ queryKey: ['calendar'] }); },
  });
}

export function useApplyRecommendation(projectId: number) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (taskId: number) => post<Task>(`/projects/${projectId}/insights/priorities/${taskId}/apply`), onSuccess: () => invalidateTaskViews(qc, projectId) });
}

export function useApplyRebalance(projectId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { taskId: number; toUserId: number }) => post<Task>(`/projects/${projectId}/insights/workload/apply`, v),
    onSuccess: () => { invalidateTaskViews(qc, projectId); qc.invalidateQueries({ queryKey: keys.team }); },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return {
    one: useMutation({ mutationFn: (id: number) => post<Notification>(`/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }) }),
    all: useMutation({ mutationFn: () => post('/notifications/read-all'), onSuccess: () => qc.invalidateQueries({ queryKey: keys.notifications }) }),
  };
}

export interface WorkflowInput { name: string; description?: string; projectId?: number | null; enabled: boolean; nodes: WorkflowNodeDto[]; edges: WorkflowEdgeDto[] }

export function useSaveWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: WorkflowInput & { id?: number }) => (id ? put<WorkflowDetail>(`/workflows/${id}`, input) : post<WorkflowDetail>('/workflows', input)),
    onSuccess: (d) => { qc.setQueryData(keys.workflow(d.workflow.id), d); qc.invalidateQueries({ queryKey: keys.workflows }); qc.invalidateQueries({ queryKey: keys.organization }); },
  });
}

export function useToggleWorkflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) => patch<WorkflowSummary>(`/workflows/${id}/enabled`, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.workflows }),
  });
}

export function useDeleteWorkflow() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => del(`/workflows/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: keys.workflows }); qc.invalidateQueries({ queryKey: keys.organization }); } });
}

export function useTestWorkflow(id: number) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (taskId: number) => post<Execution>(`/workflows/${id}/test`, { taskId }), onSuccess: () => qc.invalidateQueries({ queryKey: ['executions'] }) });
}

export function useInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { fullName: string; email: string; role: string; jobTitle?: string }) => post<{ member: TeamMember; temporaryPassword: string }>('/team', v),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.team }); qc.invalidateQueries({ queryKey: keys.organization }); },
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...v }: { id: number; role: string; status: string; capacityPoints: number; jobTitle?: string }) => put<TeamMember>(`/team/${id}`, v),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.team }),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (v: { name: string; industry?: string }) => put<OrganizationDto>('/organization', v), onSuccess: (o) => qc.setQueryData(keys.organization, o) });
}

export const updateProfile = (v: { fullName: string; jobTitle?: string; avatarColor: string; timezone: string; capacityPoints: number }) => put<Me>('/me', v);
export const updatePreferences = (v: { theme: Theme; dashboardLayout: string[] }) => put<Me>('/me/preferences', v);
export const changePassword = (v: { currentPassword: string; newPassword: string }) => put<void>('/me/password', v);
