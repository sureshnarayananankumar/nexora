import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AdminApi } from '../../core/api.service';
import { DailyPoint, Overview } from '../../core/models';
import { errorText } from '../../core/toast.service';
import { ChartComponent } from '../../shared/chart.component';
import { AgoPipe, StatComponent } from '../../shared/ui';

@Component({
  selector: 'nx-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StatComponent, ChartComponent, AgoPipe, DecimalPipe, RouterLink],
  template: `
    <div class="page-header"><div><h1>Platform overview</h1><p class="muted">Tenants, usage and platform health at a glance.</p></div>
      <button class="btn" (click)="load()" [disabled]="loading()">↻ Refresh</button></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    @if (data(); as o) {
      <div class="grid-4">
        <nx-stat label="Organizations" [value]="o.organizations" [foot]="o.activeOrganizations + ' active'" />
        <nx-stat label="Users" [value]="o.users" [foot]="o.signups30d + ' new in 30 days'" />
        <nx-stat label="Projects · tasks" [value]="o.projects + ' · ' + o.tasks" [foot]="o.tasksCompleted7d + ' tasks completed this week'" />
        <nx-stat label="Workflow runs (24h)" [value]="o.workflowRuns24h" [foot]="o.workflowFailures24h + ' failed'" [tone]="o.workflowFailures24h > 0 ? 'danger' : undefined" />
      </div>
      <div class="grid-main">
        <section class="card">
          <div class="card-header"><h3>Activity, last 30 days</h3><a class="small" routerLink="/analytics">Full report →</a></div>
          <div class="card-body">
            @if (daily().length) {
              <nx-chart type="area" ariaLabel="Daily activity" [labels]="labels()" [series]="[
                { name: 'Tasks created', color: '#7c5cff', values: col('tasksCreated') },
                { name: 'Tasks completed', color: '#10b981', values: col('tasksCompleted') },
                { name: 'Workflow runs', color: '#22d3ee', values: col('workflowRuns') }]" />
            }
          </div>
        </section>
        <section class="card">
          <div class="card-header"><h3>API health (24h)</h3><a class="small" routerLink="/api-monitoring">Details →</a></div>
          <div class="card-body stack">
            <div class="kv"><span>Requests</span><strong>{{ o.apiRequests24h | number }}</strong></div>
            <div class="kv"><span>Error rate (5xx)</span><strong [class.danger]="o.apiErrorRate24h > 1">{{ o.apiErrorRate24h }}%</strong></div>
            <div class="kv"><span>p95 latency</span><strong [class.danger]="o.apiP95Ms24h > 500">{{ o.apiP95Ms24h }} ms</strong></div>
            <div class="divider"></div>
            <h3 style="font-size:13px">Plans</h3>
            @for (p of plans(); track p.name) {
              <div>
                <div class="kv small"><span>{{ p.name }}</span><span>{{ p.count }}</span></div>
                <div class="bar"><span [style.width.%]="p.pct"></span></div>
              </div>
            }
          </div>
        </section>
      </div>
      <section class="card">
        <div class="card-header"><h3>Recent admin & security events</h3><a class="small" routerLink="/audit">Audit log →</a></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Action</th><th>Actor</th><th>Entity</th><th>IP</th><th>When</th></tr></thead>
            <tbody>
              @for (a of o.recentAudit; track a.id) {
                <tr>
                  <td><span class="badge" [class.badge-danger]="a.action.includes('FAILED') || a.action.includes('REUSE')">{{ a.action }}</span></td>
                  <td>{{ a.actorEmail ?? 'system' }}</td>
                  <td class="muted">{{ a.entityType }} {{ a.entityId }}</td>
                  <td class="mono small muted">{{ a.ipAddress ?? '—' }}</td>
                  <td class="muted small">{{ a.createdAt | ago }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    } @else if (loading()) {
      <div class="grid-4">@for (i of [1,2,3,4]; track i) { <div class="card skeleton" style="height:110px"></div> }</div>
    }
  `,
})
export class DashboardComponent {
  private readonly api = inject(AdminApi);
  readonly data = signal<Overview | null>(null);
  readonly daily = signal<DailyPoint[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly labels = computed(() => this.daily().map((d) => d.day.slice(5)));
  readonly plans = computed(() => {
    const dist = this.data()?.planDistribution ?? {};
    const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(dist).map(([name, count]) => ({ name, count, pct: (count / total) * 100 }));
  });

  constructor() { this.load(); }

  col(key: keyof Omit<DailyPoint, 'day'>) { return this.daily().map((d) => d[key]); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ overview: this.api.overview(), daily: this.api.daily(30) }).subscribe({
      next: ({ overview, daily }) => { this.data.set(overview); this.daily.set(daily); this.loading.set(false); },
      error: (e) => { this.error.set(errorText(e, 'Could not load the overview')); this.loading.set(false); },
    });
  }
}
