import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AdminApi } from '../../core/api.service';
import { AuditEntry, Page } from '../../core/models';
import { errorText } from '../../core/toast.service';
import { EmptyComponent, PagerComponent } from '../../shared/ui';

@Component({
  selector: 'nx-audit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, PagerComponent, EmptyComponent, DatePipe, JsonPipe],
  template: `
    <div class="page-header"><div><h1>Audit logs</h1><p class="muted">Append-only record of sign-ins, permission changes and administrative actions.</p></div></div>
    <form class="toolbar" [formGroup]="filters" (ngSubmit)="load(0)">
      <select class="select" formControlName="action" aria-label="Action">
        <option value="">All actions</option>@for (a of actions(); track a) { <option [value]="a">{{ a }}</option> }
      </select>
      <select class="select" formControlName="entityType" aria-label="Entity">
        <option value="">All entities</option>@for (e of entities; track e) { <option [value]="e">{{ e }}</option> }
      </select>
      <input class="input" formControlName="q" placeholder="Actor email or entity id" aria-label="Search" />
      <input class="input" type="date" formControlName="from" aria-label="From" />
      <input class="input" type="date" formControlName="to" aria-label="To" />
      <button class="btn btn-primary" type="submit">Apply</button>
      <button class="btn btn-ghost" type="button" (click)="filters.reset(); load(0)">Reset</button>
    </form>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    <div class="card table-wrap">
      <table class="table">
        <thead><tr><th>Time (UTC)</th><th>Action</th><th>Actor</th><th>Entity</th><th>IP</th><th></th></tr></thead>
        <tbody>
          @for (a of page()?.content ?? []; track a.id) {
            <tr>
              <td class="mono small">{{ a.createdAt | date: 'yyyy-MM-dd HH:mm:ss' : 'UTC' }}</td>
              <td><span class="badge" [class.badge-danger]="isAlert(a)">{{ a.action }}</span></td>
              <td>{{ a.actorEmail ?? 'system' }}</td>
              <td class="muted">{{ a.entityType }} <span class="mono">{{ a.entityId }}</span></td>
              <td class="mono small muted">{{ a.ipAddress ?? '—' }}</td>
              <td class="right">@if (a.details) { <button class="btn btn-ghost btn-sm" (click)="expanded.set(expanded() === a.id ? null : a.id)">{{ expanded() === a.id ? 'Hide' : 'Details' }}</button> }</td>
            </tr>
            @if (expanded() === a.id) { <tr class="detail-row"><td colspan="6"><pre>{{ a.details | json }}</pre></td></tr> }
          }
        </tbody>
      </table>
      @if (page() && !page()!.content.length) { <nx-empty title="No audit entries match" body="Try widening the date range." /> }
    </div>
    @if (page(); as p) { <nx-pager [page]="p.page" [pages]="p.totalPages" [total]="p.totalElements" (change)="load($event)" /> }
  `,
})
export class AuditComponent {
  private readonly api = inject(AdminApi);
  private readonly fb = inject(FormBuilder);
  readonly page = signal<Page<AuditEntry> | null>(null);
  readonly actions = signal<string[]>([]);
  readonly expanded = signal<number | null>(null);
  readonly error = signal<string | null>(null);
  readonly entities = ['USER', 'ORGANIZATION', 'PROJECT', 'WORKFLOW', 'ROLE', 'PLAN', 'SETTING'];
  readonly filters = this.fb.nonNullable.group({ action: '', entityType: '', q: '', from: '', to: '' });

  constructor() {
    this.api.auditActions().subscribe((a) => this.actions.set(a));
    this.load(0);
  }

  isAlert(a: AuditEntry) { return /FAILED|REUSE|SUSPEND|REVOKED|DELETED/.test(a.action); }

  load(page: number): void {
    this.api.audit({ ...this.filters.getRawValue(), page, size: 25 }).subscribe({
      next: (p) => { this.page.set(p); this.error.set(null); },
      error: (e) => this.error.set(errorText(e)),
    });
  }
}
