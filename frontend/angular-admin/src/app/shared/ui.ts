import { ChangeDetectionStrategy, Component, Pipe, PipeTransform, input, output } from '@angular/core';

@Pipe({ name: 'ago' })
export class AgoPipe implements PipeTransform {
  transform(iso?: string | null): string {
    if (!iso) return '—';
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now';
    const units: [number, string][] = [[60, 'min'], [3600, 'h'], [86400, 'd'], [2592000, 'mo'], [31536000, 'y']];
    let out = `${Math.floor(s / 60)} min ago`;
    for (const [secs, label] of units) if (s >= secs) out = `${Math.floor(s / secs)} ${label} ago`;
    return out;
  }
}

@Component({
  selector: 'nx-stat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stat card">
      <div class="stat-label">{{ label() }}</div>
      <div class="stat-value" [class.danger]="tone() === 'danger'" [class.success]="tone() === 'success'">{{ value() }}</div>
      @if (foot()) { <div class="stat-foot">{{ foot() }}</div> }
    </div>
  `,
})
export class StatComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly foot = input<string>();
  readonly tone = input<'danger' | 'success' | undefined>();
}

@Component({
  selector: 'nx-pager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pager">
      <span class="muted small">{{ total() }} result{{ total() === 1 ? '' : 's' }} · page {{ page() + 1 }} of {{ pages() || 1 }}</span>
      <div class="row">
        <button class="btn btn-sm" [disabled]="page() === 0" (click)="change.emit(page() - 1)">Previous</button>
        <button class="btn btn-sm" [disabled]="page() + 1 >= pages()" (click)="change.emit(page() + 1)">Next</button>
      </div>
    </div>
  `,
})
export class PagerComponent {
  readonly page = input.required<number>();
  readonly pages = input.required<number>();
  readonly total = input.required<number>();
  readonly change = output<number>();
}

@Component({
  selector: 'nx-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="backdrop" (mousedown)="$event.target === $event.currentTarget && closed.emit()">
      <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="title()" [style.width]="width()">
        <header><h2>{{ title() }}</h2><button class="btn btn-ghost btn-icon" aria-label="Close" (click)="closed.emit()">✕</button></header>
        <div class="dialog-body"><ng-content /></div>
        <footer><ng-content select="[actions]" /></footer>
      </div>
    </div>
  `,
})
export class DialogComponent {
  readonly title = input.required<string>();
  readonly width = input('min(560px, 100%)');
  readonly closed = output<void>();
}

@Component({
  selector: 'nx-empty',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="empty"><div class="empty-icon">◎</div><strong>{{ title() }}</strong>@if (body()) {<p class="muted">{{ body() }}</p>}</div>`,
})
export class EmptyComponent {
  readonly title = input.required<string>();
  readonly body = input<string>();
}

/** Small health ring used in project monitoring. */
@Component({
  selector: 'nx-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 36 36" role="img" [attr.aria-label]="'Health ' + value()">
      <circle cx="18" cy="18" r="15" fill="none" stroke="var(--surface-3)" stroke-width="4" />
      <circle cx="18" cy="18" r="15" fill="none" [attr.stroke]="color()" stroke-width="4" stroke-linecap="round"
              [attr.stroke-dasharray]="94.25" [attr.stroke-dashoffset]="94.25 - 94.25 * value() / 100" transform="rotate(-90 18 18)" />
      <text x="18" y="22" text-anchor="middle" font-size="10" font-weight="700" fill="var(--text)">{{ value() }}</text>
    </svg>
  `,
})
export class RingComponent {
  readonly value = input.required<number>();
  readonly size = input(38);
  color() { return this.value() >= 75 ? 'var(--success)' : this.value() >= 50 ? 'var(--warning)' : 'var(--danger)'; }
}
