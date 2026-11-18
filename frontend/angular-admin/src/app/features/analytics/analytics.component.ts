import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AdminApi } from '../../core/api.service';
import { DailyPoint } from '../../core/models';
import { errorText } from '../../core/toast.service';
import { ChartComponent } from '../../shared/chart.component';
import { StatComponent } from '../../shared/ui';

@Component({
  selector: 'nx-analytics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartComponent, StatComponent],
  template: `
    <div class="page-header">
      <div><h1>Analytics &amp; reports</h1><p class="muted">Platform growth and delivery across every tenant.</p></div>
      <div class="row">
        <div class="segmented">
          @for (d of [7, 30, 90]; track d) { <button [class.on]="days() === d" (click)="setDays(d)">{{ d }} days</button> }
        </div>
        <button class="btn" (click)="exportCsv()" [disabled]="!rows().length">⤓ Export CSV</button>
      </div>
    </div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    <div class="grid-4">
      <nx-stat label="New users" [value]="sum('newUsers')" [foot]="'last ' + days() + ' days'" />
      <nx-stat label="New organizations" [value]="sum('newOrganizations')" />
      <nx-stat label="Tasks completed" [value]="sum('tasksCompleted')" [foot]="sum('tasksCreated') + ' created'" />
      <nx-stat label="Workflow runs" [value]="sum('workflowRuns')" [foot]="'≈ ' + avg('workflowRuns') + ' per day'" />
    </div>
    <div class="grid-2">
      <section class="card"><div class="card-header"><h3>Tasks created vs completed</h3></div><div class="card-body">
        <nx-chart type="bar" ariaLabel="Tasks created and completed per day" [labels]="labels()" [series]="[
          { name: 'Created', color: '#f59e0b', values: col('tasksCreated') }, { name: 'Completed', color: '#10b981', values: col('tasksCompleted') }]" />
      </div></section>
      <section class="card"><div class="card-header"><h3>Sign-ups</h3></div><div class="card-body">
        <nx-chart type="line" ariaLabel="New users and organizations per day" [labels]="labels()" [series]="[
          { name: 'Users', color: '#7c5cff', values: col('newUsers') }, { name: 'Organizations', color: '#ec4899', values: col('newOrganizations') }]" />
      </div></section>
    </div>
    <section class="card"><div class="card-header"><h3>Automation volume</h3></div><div class="card-body">
      <nx-chart type="area" ariaLabel="Workflow runs per day" [labels]="labels()" [series]="[{ name: 'Workflow runs', color: '#22d3ee', values: col('workflowRuns') }]" />
    </div></section>
  `,
})
export class AnalyticsComponent {
  private readonly api = inject(AdminApi);
  readonly days = signal(30);
  readonly rows = signal<DailyPoint[]>([]);
  readonly error = signal<string | null>(null);
  readonly labels = computed(() => this.rows().map((d) => d.day.slice(5)));

  constructor() { this.load(); }

  setDays(d: number) { this.days.set(d); this.load(); }
  col(k: keyof Omit<DailyPoint, 'day'>) { return this.rows().map((r) => r[k]); }
  sum(k: keyof Omit<DailyPoint, 'day'>) { return this.col(k).reduce((a, b) => a + b, 0); }
  avg(k: keyof Omit<DailyPoint, 'day'>) { return this.rows().length ? Math.round((this.sum(k) / this.rows().length) * 10) / 10 : 0; }

  load(): void {
    this.api.daily(this.days()).subscribe({
      next: (r) => { this.rows.set(r); this.error.set(null); },
      error: (e) => this.error.set(errorText(e, 'Could not load analytics')),
    });
  }

  /** Client-side CSV export of the current report. */
  exportCsv(): void {
    const header = 'day,new_users,new_organizations,tasks_created,tasks_completed,workflow_runs';
    const lines = this.rows().map((r) => [r.day, r.newUsers, r.newOrganizations, r.tasksCreated, r.tasksCompleted, r.workflowRuns].join(','));
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nexora-platform-report-${this.days()}d.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
