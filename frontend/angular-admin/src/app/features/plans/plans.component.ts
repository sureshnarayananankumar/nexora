import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApi } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { PlanRow } from '../../core/models';
import { ToastService, errorText } from '../../core/toast.service';
import { DialogComponent } from '../../shared/ui';

@Component({
  selector: 'nx-plans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, DialogComponent],
  template: `
    <div class="page-header">
      <div><h1>Subscription plans</h1><p class="muted">Limits here are enforced by the API when tenants add seats, projects or workflows.</p></div>
      @if (canEdit) { <button class="btn btn-primary" (click)="edit(null)">＋ New plan</button> }
    </div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    <div class="plan-grid">
      @for (p of plans(); track p.id) {
        <article class="card plan-card" [class.inactive]="!p.active">
          <div class="spread"><span class="badge badge-accent mono">{{ p.code }}</span>@if (!p.active) { <span class="badge">inactive</span> }</div>
          <h2>{{ p.name }}</h2>
          <div class="price">\${{ p.priceMonthly }}<span>/month</span></div>
          <p class="muted small">{{ p.description }}</p>
          <ul class="limits">
            <li><span>Seats</span><strong>{{ p.maxUsers }}</strong></li>
            <li><span>Active projects</span><strong>{{ p.maxProjects }}</strong></li>
            <li><span>Workflows</span><strong>{{ p.maxWorkflows }}</strong></li>
          </ul>
          <div class="spread small"><span class="muted">{{ p.organizations }} organization{{ p.organizations === 1 ? '' : 's' }}</span>
            @if (canEdit) { <button class="btn btn-sm" (click)="edit(p)">Edit</button> }</div>
        </article>
      }
    </div>

    @if (editing() !== undefined) {
      <nx-dialog [title]="editing() ? 'Edit ' + editing()!.name : 'New plan'" (closed)="editing.set(undefined)">
        <form class="stack" [formGroup]="form">
          <div class="grid-2">
            <label class="field"><span>Code</span><input class="input mono" formControlName="code" [readonly]="!!editing()" />
              @if (form.controls.code.touched && form.controls.code.invalid) { <small class="field-error">UPPER_SNAKE_CASE, 2–40 characters</small> }</label>
            <label class="field"><span>Name</span><input class="input" formControlName="name" />
              @if (form.controls.name.touched && form.controls.name.invalid) { <small class="field-error">Required</small> }</label>
          </div>
          <label class="field"><span>Description</span><input class="input" formControlName="description" /></label>
          <div class="grid-2">
            <label class="field"><span>Price per month (USD)</span><input class="input" type="number" min="0" step="0.01" formControlName="priceMonthly" />
              @if (form.controls.priceMonthly.invalid) { <small class="field-error">0 – 99,999.99</small> }</label>
            <label class="field checkbox-field"><input type="checkbox" formControlName="active" /> Available to tenants</label>
          </div>
          <div class="grid-3">
            <label class="field"><span>Seats</span><input class="input" type="number" min="1" formControlName="maxUsers" /></label>
            <label class="field"><span>Active projects</span><input class="input" type="number" min="1" formControlName="maxProjects" /></label>
            <label class="field"><span>Workflows</span><input class="input" type="number" min="0" formControlName="maxWorkflows" /></label>
          </div>
          @if (form.invalid && form.touched) { <small class="field-error">Limits must be whole numbers within range.</small> }
        </form>
        <div actions>
          <button class="btn" (click)="editing.set(undefined)">Cancel</button>
          <button class="btn btn-primary" [disabled]="saving()" (click)="save()">{{ saving() ? 'Saving…' : 'Save plan' }}</button>
        </div>
      </nx-dialog>
    }
  `,
})
export class PlansComponent {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly canEdit = inject(AuthService).can('PLAN_MANAGE');
  readonly plans = signal<PlanRow[]>([]);
  readonly editing = signal<PlanRow | null | undefined>(undefined);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.pattern(/^[A-Z][A-Z_]{1,39}$/)]],
    name: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', Validators.maxLength(255)],
    priceMonthly: [0, [Validators.required, Validators.min(0), Validators.max(99999.99)]],
    maxUsers: [5, [Validators.required, Validators.min(1), Validators.max(100000)]],
    maxProjects: [3, [Validators.required, Validators.min(1), Validators.max(100000)]],
    maxWorkflows: [2, [Validators.required, Validators.min(0), Validators.max(100000)]],
    active: [true],
  });

  constructor() { this.load(); }

  load(): void {
    this.api.plans().subscribe({ next: (p) => this.plans.set(p), error: (e) => this.error.set(errorText(e)) });
  }

  edit(p: PlanRow | null): void {
    this.form.reset(p ? { ...p, description: p.description ?? '' } : { code: '', name: '', description: '', priceMonthly: 0, maxUsers: 5, maxProjects: 3, maxWorkflows: 2, active: true });
    this.editing.set(p);
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    this.api.savePlan(this.editing()?.id ?? null, this.form.getRawValue()).subscribe({
      next: (p) => { this.toast.success(`${p.name} saved`); this.editing.set(undefined); this.saving.set(false); this.load(); },
      error: (e) => { this.toast.error(e); this.saving.set(false); },
    });
  }
}
