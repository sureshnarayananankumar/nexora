import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { LowerCasePipe } from '@angular/common';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdminApi } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Page, RoleRow, UserRow } from '../../core/models';
import { ToastService, errorText } from '../../core/toast.service';
import { AgoPipe, DialogComponent, EmptyComponent, PagerComponent } from '../../shared/ui';

@Component({
  selector: 'nx-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ReactiveFormsModule, PagerComponent, DialogComponent, EmptyComponent, AgoPipe, LowerCasePipe],
  template: `
    <div class="page-header"><div><h1>Users</h1><p class="muted">Every account across all organizations.</p></div></div>
    <div class="toolbar">
      <input class="input" placeholder="Search name or email…" (input)="search$.next($any($event.target).value)" aria-label="Search users" />
      <select class="select" [ngModel]="roleId()" (ngModelChange)="roleId.set($event); load(0)" aria-label="Role">
        <option [ngValue]="null">Any role</option>@for (r of roles(); track r.id) { <option [ngValue]="r.id">{{ r.name }}</option> }
      </select>
      <select class="select" [ngModel]="status()" (ngModelChange)="status.set($event); load(0)" aria-label="Status">
        <option value="">Any status</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option>
      </select>
      <select class="select" [ngModel]="sort()" (ngModelChange)="sort.set($event); load(0)" aria-label="Sort">
        <option value="createdAt,desc">Newest first</option><option value="lastLoginAt,desc">Recently active</option><option value="fullName,asc">Name A–Z</option>
      </select>
    </div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    <div class="card table-wrap">
      <table class="table">
        <thead><tr><th>User</th><th>Organization</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead>
        <tbody>
          @for (u of page()?.content ?? []; track u.id) {
            <tr>
              <td><strong>{{ u.fullName }}</strong><div class="tiny muted">{{ u.email }}</div></td>
              <td>{{ u.organizationName }}</td>
              <td><span class="badge badge-accent">{{ u.role }}</span></td>
              <td><span class="badge" [class.badge-success]="u.status === 'ACTIVE'" [class.badge-danger]="u.status !== 'ACTIVE'">{{ u.status | lowercase }}</span></td>
              <td class="muted small">{{ u.lastLoginAt | ago }}</td>
              <td class="right">
                @if (auth.can('USER_MANAGE') && u.id !== auth.user()?.id) {
                  <button class="btn btn-sm" (click)="edit(u)">Edit</button>
                  <button class="btn btn-ghost btn-sm" (click)="revoke(u)" title="Sign this user out everywhere">Revoke sessions</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
      @if (page() && !page()!.content.length) { <nx-empty title="No users match these filters" /> }
    </div>
    @if (page(); as p) { <nx-pager [page]="p.page" [pages]="p.totalPages" [total]="p.totalElements" (change)="load($event)" /> }

    @if (editing(); as u) {
      <nx-dialog [title]="'Edit ' + u.fullName" (closed)="editing.set(null)" width="min(460px, 100%)">
        <form class="stack" [formGroup]="form">
          <p class="muted small">{{ u.email }} · {{ u.organizationName }}</p>
          <label class="field"><span>Role</span>
            <select class="select" formControlName="roleId">@for (r of roles(); track r.id) { <option [ngValue]="r.id">{{ r.name }}</option> }</select>
          </label>
          <label class="field"><span>Status</span>
            <select class="select" formControlName="status"><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select>
          </label>
          @if (form.value.status === 'SUSPENDED') { <div class="alert alert-warning">Suspending revokes all of this user’s sessions immediately.</div> }
        </form>
        <div actions>
          <button class="btn" (click)="editing.set(null)">Cancel</button>
          <button class="btn btn-primary" [disabled]="form.pristine || saving()" (click)="save(u)">{{ saving() ? 'Saving…' : 'Save' }}</button>
        </div>
      </nx-dialog>
    }
  `,
})
export class UsersComponent {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);

  readonly q = signal('');
  readonly status = signal('');
  readonly roleId = signal<number | null>(null);
  readonly sort = signal('createdAt,desc');
  readonly page = signal<Page<UserRow> | null>(null);
  readonly roles = signal<RoleRow[]>([]);
  readonly editing = signal<UserRow | null>(null);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly search$ = new Subject<string>();
  readonly form = this.fb.nonNullable.group({ roleId: [0, Validators.required], status: ['ACTIVE', Validators.required] });

  constructor() {
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe((q) => { this.q.set(q); this.load(0); });
    this.api.roles().subscribe((r) => this.roles.set(r));
    this.load(0);
  }

  load(page: number): void {
    this.api.users({ q: this.q(), status: this.status(), roleId: this.roleId(), page, size: 20, sort: this.sort() }).subscribe({
      next: (p) => { this.page.set(p); this.error.set(null); },
      error: (e) => this.error.set(errorText(e)),
    });
  }

  edit(u: UserRow): void {
    this.form.reset({ roleId: u.roleId, status: u.status });
    this.editing.set(u);
  }

  save(u: UserRow): void {
    this.saving.set(true);
    this.api.updateUser(u.id, this.form.getRawValue()).subscribe({
      next: () => { this.toast.success(`${u.fullName} updated`); this.editing.set(null); this.saving.set(false); this.load(this.page()?.page ?? 0); },
      error: (e) => { this.toast.error(e); this.saving.set(false); },
    });
  }

  revoke(u: UserRow): void {
    if (!confirm(`Sign ${u.fullName} out of every device?`)) return;
    this.api.revokeSessions(u.id).subscribe({
      next: (r) => this.toast.success(`${r.revoked} session${r.revoked === 1 ? '' : 's'} revoked`),
      error: (e) => this.toast.error(e),
    });
  }
}
