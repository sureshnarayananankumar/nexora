import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LowerCasePipe } from '@angular/common';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApi } from '../../core/api.service';
import { Page, ProjectRow } from '../../core/models';
import { errorText } from '../../core/toast.service';
import { EmptyComponent, PagerComponent, RingComponent } from '../../shared/ui';

@Component({
  selector: 'nx-projects',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PagerComponent, EmptyComponent, RingComponent, LowerCasePipe],
  template: `
    <div class="page-header"><div><h1>Project monitoring</h1><p class="muted">Health and risk for every project on the platform, scored by the insights engine.</p></div></div>
    <div class="toolbar">
      <input class="input" placeholder="Search projects…" (input)="search$.next($any($event.target).value)" aria-label="Search projects" />
      <select class="select" [ngModel]="status()" (ngModelChange)="status.set($event); load(0)" aria-label="Status">
        <option value="">Any status</option><option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="COMPLETED">Completed</option><option value="ARCHIVED">Archived</option>
      </select>
      <select class="select" [ngModel]="sort()" (ngModelChange)="sort.set($event); load(0)" aria-label="Sort">
        <option value="createdAt,desc">Newest</option><option value="dueDate,asc">Due soonest</option><option value="name,asc">Name</option>
      </select>
    </div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    <div class="card table-wrap">
      <table class="table">
        <thead><tr><th>Health</th><th>Project</th><th>Organization</th><th>Owner</th><th>Open / total</th><th>Overdue</th><th>Risk</th><th>Due</th></tr></thead>
        <tbody>
          @for (p of page()?.content ?? []; track p.id) {
            <tr>
              <td><nx-ring [value]="p.healthScore" /></td>
              <td><strong>{{ p.name }}</strong><div class="tiny muted mono">{{ p.key }} · {{ p.status | lowercase }}</div></td>
              <td>{{ p.organizationName }}</td>
              <td class="muted">{{ p.ownerName }}</td>
              <td>{{ p.openTasks }} / {{ p.totalTasks }}</td>
              <td [class.danger]="p.overdueTasks > 0">{{ p.overdueTasks }}</td>
              <td><span class="badge" [class.badge-success]="p.risk === 'LOW'" [class.badge-warning]="p.risk === 'MEDIUM'" [class.badge-danger]="p.risk === 'HIGH'">{{ p.risk | lowercase }}</span></td>
              <td class="muted small">{{ p.dueDate ?? '—' }}</td>
            </tr>
          }
        </tbody>
      </table>
      @if (page() && !page()!.content.length) { <nx-empty title="No projects match" /> }
    </div>
    @if (page(); as p) { <nx-pager [page]="p.page" [pages]="p.totalPages" [total]="p.totalElements" (change)="load($event)" /> }
  `,
})
export class ProjectsComponent {
  private readonly api = inject(AdminApi);
  readonly q = signal('');
  readonly status = signal('');
  readonly sort = signal('createdAt,desc');
  readonly page = signal<Page<ProjectRow> | null>(null);
  readonly error = signal<string | null>(null);
  readonly search$ = new Subject<string>();

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe((q) => { this.q.set(q); this.load(0); });
    this.load(0);
  }

  load(page: number): void {
    this.api.projects({ q: this.q(), status: this.status(), page, size: 15, sort: this.sort() }).subscribe({
      next: (p) => { this.page.set(p); this.error.set(null); },
      error: (e) => this.error.set(errorText(e)),
    });
  }
}
