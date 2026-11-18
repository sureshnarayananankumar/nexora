import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApi } from '../../core/api.service';
import { ApiMetrics, RealtimeMetrics } from '../../core/models';
import { errorText } from '../../core/toast.service';
import { ChartComponent } from '../../shared/chart.component';
import { StatComponent } from '../../shared/ui';

@Component({
  selector: 'nx-api-monitoring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartComponent, StatComponent, DecimalPipe],
  template: `
    <div class="page-header">
      <div><h1>API monitoring</h1><p class="muted">Every request through the Spring Boot API is measured and aggregated per endpoint. Refreshes every 30 s.</p></div>
      <div class="segmented">@for (h of [1, 6, 24, 168]; track h) { <button [class.on]="hours() === h" (click)="setHours(h)">{{ h === 168 ? '7d' : h + 'h' }}</button> }</div>
    </div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    @if (m(); as m) {
      <div class="grid-4">
        <nx-stat label="Requests" [value]="(m.requests | number) ?? '0'" [foot]="'last ' + hours() + 'h'" />
        <nx-stat label="Error rate (5xx)" [value]="m.errorRate + '%'" [foot]="m.errors + ' errors'" [tone]="m.errorRate > 1 ? 'danger' : 'success'" />
        <nx-stat label="Average latency" [value]="m.avgMs + ' ms'" />
        <nx-stat label="p95 latency" [value]="m.p95Ms + ' ms'" [tone]="m.p95Ms > 500 ? 'danger' : undefined" />
      </div>
      <div class="grid-main">
        <section class="card"><div class="card-header"><h3>Traffic per hour</h3></div><div class="card-body">
          <nx-chart type="bar" ariaLabel="Requests and errors per hour" [labels]="hourLabels()" [series]="[
            { name: 'Requests', color: '#7c5cff', values: hourCol('requests') }, { name: 'Errors', color: '#f43f5e', values: hourCol('errors') }]" />
        </div></section>
        <section class="card">
          <div class="card-header"><h3>Realtime gateway</h3><span class="badge" [class.badge-success]="!!rt()" [class.badge-danger]="!rt()">{{ rt() ? 'online' : 'unreachable' }}</span></div>
          <div class="card-body stack">
            @if (rt(); as r) {
              <div class="kv"><span>Open WebSocket connections</span><strong>{{ r.connections }}</strong></div>
              <div class="kv"><span>Peak connections</span><strong>{{ r.peakConnections }}</strong></div>
              <div class="kv"><span>Events fanned out (last hour)</span><strong>{{ r.eventsLastHour }}</strong></div>
              <div class="kv"><span>Failed events</span><strong [class.danger]="r.eventsFailed > 0">{{ r.eventsFailed }}</strong></div>
              <div class="kv"><span>Uptime</span><strong>{{ uptime(r.uptimeSeconds) }}</strong></div>
              <div class="divider"></div>
              @for (t of topTypes(); track t[0]) { <div class="kv small"><span class="mono">{{ t[0] }}</span><span>{{ t[1] }}</span></div> }
            } @else { <p class="muted small">The Node.js realtime service didn’t respond. Check its container health.</p> }
          </div>
        </section>
      </div>
      <section class="card">
        <div class="card-header"><h3>Endpoints</h3><span class="tiny muted">top 25 by volume</span></div>
        <div class="table-wrap"><table class="table">
          <thead><tr><th>Endpoint</th><th class="right">Requests</th><th class="right">Errors</th><th class="right">Avg</th><th class="right">p95</th></tr></thead>
          <tbody>
            @for (e of m.endpoints; track e.method + e.path) {
              <tr>
                <td><span class="method" [attr.data-m]="e.method">{{ e.method }}</span> <span class="mono small">{{ e.path }}</span></td>
                <td class="right">{{ e.requests | number }}</td>
                <td class="right" [class.danger]="e.errors > 0">{{ e.errors }} <span class="tiny muted">({{ e.errorRate }}%)</span></td>
                <td class="right">{{ e.avgMs }} ms</td>
                <td class="right" [class.danger]="e.p95Ms > 500">{{ e.p95Ms }} ms</td>
              </tr>
            } @empty { <tr><td colspan="5" class="muted">No traffic recorded in this window.</td></tr> }
          </tbody>
        </table></div>
      </section>
    }
  `,
})
export class ApiMonitoringComponent {
  private readonly api = inject(AdminApi);
  readonly hours = signal(24);
  readonly m = signal<ApiMetrics | null>(null);
  readonly rt = signal<RealtimeMetrics | null>(null);
  readonly error = signal<string | null>(null);
  readonly hourLabels = computed(() => (this.m()?.hourly ?? []).map((h) => h.hour.slice(11)));
  readonly topTypes = computed(() => Object.entries(this.rt()?.byType ?? {}).slice(0, 6));

  constructor() {
    this.load();
    interval(30_000).pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => this.load());
  }

  hourCol(k: 'requests' | 'errors') { return (this.m()?.hourly ?? []).map((h) => h[k]); }
  setHours(h: number) { this.hours.set(h); this.load(); }
  uptime(s: number) { const h = Math.floor(s / 3600); return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor((s % 3600) / 60)}m`; }

  load(): void {
    this.api.apiMetrics(this.hours()).subscribe({
      next: (m) => { this.m.set(m); this.error.set(null); },
      error: (e) => this.error.set(errorText(e, 'Could not load metrics')),
    });
    this.api.realtimeMetrics().subscribe({ next: (r) => this.rt.set(r), error: () => this.rt.set(null) });
  }
}
