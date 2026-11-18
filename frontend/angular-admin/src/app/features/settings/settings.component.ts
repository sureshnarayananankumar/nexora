import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApi } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Setting } from '../../core/models';
import { ToastService, errorText } from '../../core/toast.service';
import { AgoPipe } from '../../shared/ui';

@Component({
  selector: 'nx-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, AgoPipe],
  template: `
    <div class="page-header"><div><h1>System configuration</h1><p class="muted">Runtime settings read by the API (cached for 30 seconds). Every change is audited.</p></div></div>
    @if (error()) { <div class="alert alert-danger">{{ error() }}</div> }
    <div class="stack">
      @for (s of settings(); track s.key) {
        <section class="card setting">
          <div class="grow">
            <div class="mono strong">{{ s.key }}</div>
            <div class="muted small">{{ s.description }}</div>
            <div class="tiny muted">Updated {{ s.updatedAt | ago }}{{ s.updatedBy ? ' by ' + s.updatedBy : '' }}</div>
          </div>
          <div class="setting-control">
            @switch (s.valueType) {
              @case ('BOOLEAN') {
                <label class="switch"><input type="checkbox" [checked]="draft[s.key] === 'true'" [disabled]="!canEdit" (change)="draft[s.key] = $any($event.target).checked ? 'true' : 'false'" [attr.aria-label]="s.key" /><span></span></label>
              }
              @case ('NUMBER') { <input class="input" type="number" min="0" style="width:120px" [(ngModel)]="draft[s.key]" [disabled]="!canEdit" [attr.aria-label]="s.key" /> }
              @default { <input class="input" style="width:min(380px, 60vw)" maxlength="500" [(ngModel)]="draft[s.key]" [disabled]="!canEdit" placeholder="(empty)" [attr.aria-label]="s.key" /> }
            }
            @if (canEdit) { <button class="btn btn-primary btn-sm" [disabled]="draft[s.key] === s.value || saving() === s.key" (click)="save(s)">{{ saving() === s.key ? 'Saving…' : 'Save' }}</button> }
          </div>
        </section>
      }
    </div>
  `,
})
export class SettingsComponent {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  readonly canEdit = inject(AuthService).can('SYSTEM_CONFIG');
  readonly settings = signal<Setting[]>([]);
  readonly saving = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  draft: Record<string, string> = {};

  constructor() { this.load(); }

  load(): void {
    this.api.settings().subscribe({
      next: (s) => { this.draft = Object.fromEntries(s.map((x) => [x.key, x.value])); this.settings.set(s); },
      error: (e) => this.error.set(errorText(e)),
    });
  }

  save(s: Setting): void {
    this.saving.set(s.key);
    this.api.updateSetting(s.key, String(this.draft[s.key] ?? '')).subscribe({
      next: (u) => {
        this.settings.update((list) => list.map((x) => (x.key === u.key ? u : x)));
        this.draft[u.key] = u.value;
        this.saving.set(null);
        this.toast.success(`${u.key} updated`);
      },
      error: (e) => { this.toast.error(e); this.saving.set(null); },
    });
  }
}
