import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AdminApi } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { PermissionRow, RoleRow } from '../../core/models';
import { ToastService, errorText } from '../../core/toast.service';
import { DialogComponent } from '../../shared/ui';

@Component({
  selector: 'nx-roles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DialogComponent],
  template: `
    <div class="page-header">
      <div><h1>Roles &amp; permissions</h1><p class="muted">Permissions are data: edit a role and every user with it gets the change on their next token refresh.</p></div>
      @if (canEdit) { <button class="btn btn-primary" (click)="openCreate()">＋ New role</button> }
    </div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    <div class="roles-layout">
      <div class="role-list">
        @for (r of roles(); track r.id) {
          <button class="role-item card" [class.active]="selected()?.id === r.id" (click)="select(r)">
            <div class="spread"><strong>{{ r.name }}</strong>@if (r.systemRole) { <span class="badge">system</span> }</div>
            <div class="tiny muted">{{ r.description }}</div>
            <div class="tiny muted">{{ r.users }} user{{ r.users === 1 ? '' : 's' }} · {{ r.permissions.length }} permissions</div>
          </button>
        }
      </div>
      @if (selected(); as role) {
        <section class="card">
          <div class="card-header">
            <div><h3>{{ role.name }}</h3><div class="tiny muted">{{ role.description }}</div></div>
            <div class="row">
              @if (canEdit && !role.systemRole && role.users === 0) { <button class="btn btn-danger btn-sm" (click)="remove(role)">Delete role</button> }
              @if (canEdit && role.name !== 'SUPER_ADMIN') { <button class="btn btn-primary btn-sm" [disabled]="!dirty() || saving()" (click)="savePermissions(role)">{{ saving() ? 'Saving…' : 'Save permissions' }}</button> }
            </div>
          </div>
          <div class="card-body">
            @if (role.name === 'SUPER_ADMIN') { <div class="alert alert-info">SUPER_ADMIN always holds every permission.</div> }
            @for (cat of categories(); track cat.name) {
              <div class="perm-group">
                <div class="perm-cat">{{ cat.name }}</div>
                @for (p of cat.items; track p.code) {
                  <label class="perm">
                    <input type="checkbox" [checked]="draft().has(p.code)" [disabled]="!canEdit || role.name === 'SUPER_ADMIN'" (change)="toggle(p.code)" />
                    <span><code>{{ p.code }}</code><span class="muted small">{{ p.description }}</span></span>
                  </label>
                }
              </div>
            }
          </div>
        </section>
      }
    </div>

    @if (creating()) {
      <nx-dialog title="New role" (closed)="creating.set(false)" width="min(480px, 100%)">
        <form class="stack" [formGroup]="form">
          <label class="field"><span>Name</span><input class="input mono" formControlName="name" placeholder="e.g. AUDITOR" />
            @if (form.controls.name.touched && form.controls.name.invalid) { <small class="field-error">2–50 characters, UPPER_SNAKE_CASE</small> }</label>
          <label class="field"><span>Description</span><input class="input" formControlName="description" /></label>
          <p class="small muted">You’ll choose permissions after creating the role.</p>
        </form>
        <div actions>
          <button class="btn" (click)="creating.set(false)">Cancel</button>
          <button class="btn btn-primary" [disabled]="form.invalid || saving()" (click)="create()">Create</button>
        </div>
      </nx-dialog>
    }
  `,
})
export class RolesComponent {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly canEdit = inject(AuthService).can('ROLE_MANAGE');

  readonly roles = signal<RoleRow[]>([]);
  readonly permissions = signal<PermissionRow[]>([]);
  readonly selected = signal<RoleRow | null>(null);
  readonly draft = signal<Set<string>>(new Set());
  readonly saving = signal(false);
  readonly creating = signal(false);
  readonly error = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/^[A-Z][A-Z_]{1,49}$/)]],
    description: ['', Validators.maxLength(255)],
  });

  readonly categories = computed(() => {
    const map = new Map<string, PermissionRow[]>();
    this.permissions().forEach((p) => map.set(p.category, [...(map.get(p.category) ?? []), p]));
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  });
  readonly dirty = computed(() => {
    const s = this.selected();
    if (!s) return false;
    const d = this.draft();
    return d.size !== s.permissions.length || s.permissions.some((p) => !d.has(p));
  });

  constructor() { this.load(); }

  load(selectId?: number): void {
    forkJoin({ roles: this.api.roles(), perms: this.api.permissions() }).subscribe({
      next: ({ roles, perms }) => {
        this.roles.set(roles);
        this.permissions.set(perms);
        this.select(roles.find((r) => r.id === (selectId ?? this.selected()?.id)) ?? roles[0]);
      },
      error: (e) => this.error.set(errorText(e)),
    });
  }

  select(r: RoleRow | undefined): void {
    this.selected.set(r ?? null);
    this.draft.set(new Set(r?.permissions ?? []));
  }

  toggle(code: string): void {
    this.draft.update((d) => { const n = new Set(d); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  }

  savePermissions(role: RoleRow): void {
    this.saving.set(true);
    this.api.updateRole(role.id, { name: role.name, description: role.description, permissions: [...this.draft()] }).subscribe({
      next: () => { this.toast.success(`${role.name} permissions saved`); this.saving.set(false); this.load(role.id); },
      error: (e) => { this.toast.error(e); this.saving.set(false); },
    });
  }

  openCreate(): void { this.form.reset(); this.creating.set(true); }

  create(): void {
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.api.createRole({ name: v.name, description: v.description || undefined, permissions: [] }).subscribe({
      next: (r) => { this.toast.success(`Role ${r.name} created`); this.creating.set(false); this.saving.set(false); this.load(r.id); },
      error: (e) => { this.toast.error(e); this.saving.set(false); },
    });
  }

  remove(role: RoleRow): void {
    if (!confirm(`Delete role ${role.name}?`)) return;
    this.api.deleteRole(role.id).subscribe({
      next: () => { this.toast.success('Role deleted'); this.selected.set(null); this.load(); },
      error: (e) => this.toast.error(e),
    });
  }
}
