import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  ApiMetrics, AuditEntry, DailyPoint, OrgDetail, OrgRow, Overview, Page, PermissionRow, PlanRow, ProjectRow,
  RealtimeMetrics, RoleRow, Setting, UserRow,
} from './models';

type Params = Record<string, string | number | boolean | null | undefined>;

function params(p: Params): HttpParams {
  let hp = new HttpParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') hp = hp.set(k, String(v));
  });
  return hp;
}

/** Typed wrapper over the Spring Boot /api/v1/admin endpoints. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/v1/admin';

  overview() { return this.http.get<Overview>(`${this.base}/overview`); }
  daily(days = 30) { return this.http.get<DailyPoint[]>(`${this.base}/analytics/daily`, { params: params({ days }) }); }

  users(p: Params) { return this.http.get<Page<UserRow>>(`${this.base}/users`, { params: params(p) }); }
  updateUser(id: number, body: { roleId: number; status: string }) { return this.http.put<UserRow>(`${this.base}/users/${id}`, body); }
  revokeSessions(id: number) { return this.http.post<{ revoked: number }>(`${this.base}/users/${id}/revoke-sessions`, null); }

  organizations(p: Params) { return this.http.get<Page<OrgRow>>(`${this.base}/organizations`, { params: params(p) }); }
  organization(id: number) { return this.http.get<OrgDetail>(`${this.base}/organizations/${id}`); }
  updateOrganization(id: number, body: { planId: number; status: string }) { return this.http.put<OrgRow>(`${this.base}/organizations/${id}`, body); }

  roles() { return this.http.get<RoleRow[]>(`${this.base}/roles`); }
  permissions() { return this.http.get<PermissionRow[]>(`${this.base}/permissions`); }
  createRole(body: { name: string; description?: string; permissions: string[] }) { return this.http.post<RoleRow>(`${this.base}/roles`, body); }
  updateRole(id: number, body: { name: string; description?: string; permissions: string[] }) { return this.http.put<RoleRow>(`${this.base}/roles/${id}`, body); }
  deleteRole(id: number) { return this.http.delete<void>(`${this.base}/roles/${id}`); }

  plans() { return this.http.get<PlanRow[]>(`${this.base}/plans`); }
  savePlan(id: number | null, body: Omit<PlanRow, 'id' | 'organizations'>) {
    return id ? this.http.put<PlanRow>(`${this.base}/plans/${id}`, body) : this.http.post<PlanRow>(`${this.base}/plans`, body);
  }

  projects(p: Params) { return this.http.get<Page<ProjectRow>>(`${this.base}/projects`, { params: params(p) }); }

  audit(p: Params) { return this.http.get<Page<AuditEntry>>(`${this.base}/audit-logs`, { params: params(p) }); }
  auditActions() { return this.http.get<string[]>(`${this.base}/audit-logs/actions`); }

  settings() { return this.http.get<Setting[]>(`${this.base}/settings`); }
  updateSetting(key: string, value: string) { return this.http.put<Setting>(`${this.base}/settings/${encodeURIComponent(key)}`, { value }); }

  apiMetrics(hours = 24) { return this.http.get<ApiMetrics>(`${this.base}/api-metrics`, { params: params({ hours }) }); }
  realtimeMetrics() { return this.http.get<RealtimeMetrics>('/realtime/metrics'); }
}
