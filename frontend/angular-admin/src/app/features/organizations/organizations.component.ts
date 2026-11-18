import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { LowerCasePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApi } from '../../core/api.service';
import { OrgDetail, OrgRow, Page, PlanRow } from '../../core/models';
import { ToastService, errorText } from '../../core/toast.service';
import { AgoPipe, DialogComponent, EmptyComponent, PagerComponent } from '../../shared/ui';

@Component({
  selector: 'nx-organizations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ReactiveFormsModule, PagerComponent, DialogComponent, EmptyComponent, AgoPipe, LowerCasePipe],
  template: `
    <div class="page-header"><div><h1>Organizations</h1><p class="muted">Every tenant on the platform, their plan and usage.</p></div></div>
    <div class="toolbar">
      <input class="input" placeholder="Search by name or slug…" [ngModel]="q()" (ngModelChange)="search$.next($event)" aria-label="Search organizations" />
      <select class="select" [ngModel]="status()" (ngModelChange)="status.set($event); load(0)" aria-label="Status">
        <option value="">Any status</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option>
      </select>
    </div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    <div class="card table-wrap">
      <table class="table">
        <thead><tr><th>Organization</th><th>Plan</th><th>Seats</th><th>Active projects</th><th>Status</th><th>Created</th></tr></thead>
        <tbody>
          @for (o of page()?.content ?? []; track o.id) {
            <tr class="clickable" (click)="open(o)" tabindex="0" (keydown.enter)="open(o)">
              <td><strong>{{ o.name }}</strong><div class="tiny muted mono">{{ o.slug }}{{ o.industry ? ' · ' + o.industry : '' }}</div></td>
              <td><span class="badge badge-accent">{{ o.planName }}</span></td>
              <td>{{ o.users }}</td>
              <td>{{ o.projects }}</td>
              <td><span class="badge" [class.badge-success]="o.status === 'ACTIVE'" [class.badge-danger]="o.status !== 'ACTIVE'">{{ o.status | lowercase }}</span></td>
              <td class="muted small">{{ o.createdAt | ago }}</td>
            </tr>
          }
        </tbody>
      </table>
      @if (page() && !page()!.content.length) { <nx-empty title="No organizations match" /> }
    </div>
    @if (page(); as p) { <nx-pager [page]="p.page" [pages]="p.totalPages" [total]="p.totalElements" (change)="load($event)" /> }

    @if (detail(); as d) {
      <nx-dialog [title]="d.organization.name" (closed)="detail.set(null)">
        <div class="stack">
          <div class="grid-3">
            <div class="mini-stat"><span>Seats</span><strong>{{ d.organization.users }}</strong></div>
            <div class="mini-stat"><span>Workflows</span><strong>{{ d.workflows }}</strong></div>
            <div class="mini-stat"><span>Open tasks</span><strong>{{ d.openTasks }}</strong></div>
          </div>
          <form class="grid-2" [formGroup]="form">
            <label class="field"><span>Plan</span>
              <select class="select" formControlName="planId">@for (p of plans(); track p.id) { <option [ngValue]="p.id">{{ p.name }} (\${{ p.priceMonthly }}/mo · {{ p.maxUsers }} seats)</option> }</select>
            </label>
            <label class="field"><span>Status</span>
              <select class="select" formControlName="status"><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select>
            </label>
          </form>
          @if (form.value.status === 'SUSPENDED') { <div class="alert alert-warning">Suspended organizations can’t sign in. Existing access tokens expire within 15 minutes.</div> }
          <div>
            <h3 style="font-size:13px;margin-bottom:8px">Administrators</h3>
            @for (a of d.admins; track a.id) { <div class="kv small"><span>{{ a.fullName }} · {{ a.email }}</span><span class="badge">{{ a.role }}</span></div> }
            @empty { <p class="muted small">No administrators</p> }
          </div>
        </div>
        <div actions>
          <button class="btn" (click)="detail.set(null)">Cancel</button>
          <button class="btn btn-primary" [disabled]="saving() || form.pristine" (click)="save(d.organization.id)">{{ saving() ? 'Saving…' : 'Save changes' }}</button>
        </div>
      </nx-dialog>
    }
  `,
})
export class OrganizationsComponent {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly q = signal('');
  readonly status = signal('');
  readonly page = signal<Page<OrgRow> | null>(null);
  readonly plans = signal<PlanRow[]>([]);
  readonly detail = signal<OrgDetail | null>(null);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly search$ = new Subject<string>();
  readonly form = this.fb.nonNullable.group({ planId: [0, Validators.required], status: ['ACTIVE', Validators.required] });

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe((q) => { this.q.set(q); this.load(0); });
    this.api.plans().subscribe((p) => this.plans.set(p));
    this.load(0);
  }

  load(page: number): void {
    this.api.organizations({ q: this.q(), status: this.status(), page, size: 15 }).subscribe({
      next: (p) => { this.page.set(p); this.error.set(null); },
      error: (e) => this.error.set(errorText(e)),
    });
  }

  open(o: OrgRow): void {
    this.api.organization(o.id).subscribe({
      next: (d) => {
        const plan = this.plans().find((p) => p.code === d.organization.planCode);
        this.form.reset({ planId: plan?.id ?? 0, status: d.organization.status });
        this.detail.set(d);
      },
      error: (e) => this.toast.error(e),
    });
  }

  save(id: number): void {
    this.saving.set(true);
    this.api.updateOrganization(id, this.form.getRawValue()).subscribe({
      next: (o) => { this.toast.success(`${o.name} updated`); this.detail.set(null); this.saving.set(false); this.load(this.page()?.page ?? 0); },
      error: (e) => { this.toast.error(e); this.saving.set(false); },
    });
  }
}
