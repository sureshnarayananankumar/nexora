import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface ChartSeries { name: string; color: string; values: number[] }

/**
 * Dependency-free SVG chart (grouped bars, lines or areas) with an accessible hover readout.
 * Kept small on purpose: the admin console only needs time series.
 */
@Component({
  selector: 'nx-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart" (mouseleave)="hover.set(null)">
      <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none" role="img" [attr.aria-label]="ariaLabel()">
        @for (t of ticks(); track t) {
          <line class="grid" [attr.x1]="P" [attr.x2]="W - 8" [attr.y1]="y(t)" [attr.y2]="y(t)" />
          <text class="axis" [attr.x]="P - 6" [attr.y]="y(t) + 3" text-anchor="end">{{ t }}</text>
        }
        @if (type() === 'bar') {
          @for (s of series(); track s.name; let si = $index) {
            @for (v of s.values; track $index; let i = $index) {
              <rect [attr.x]="barX(i, si)" [attr.y]="y(v)" [attr.width]="barW()" [attr.height]="H - B - y(v)" [attr.fill]="s.color" rx="2"
                    [class.dim]="hover() !== null && hover() !== i" />
            }
          }
        } @else {
          @for (s of series(); track s.name) {
            @if (type() === 'area') { <path [attr.d]="area(s.values)" [attr.fill]="s.color" opacity=".14" /> }
            <path [attr.d]="line(s.values)" [attr.stroke]="s.color" fill="none" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />
          }
        }
        @for (l of labels(); track $index; let i = $index) {
          @if (i % labelEvery() === 0) { <text class="axis" [attr.x]="cx(i)" [attr.y]="H - 6" text-anchor="middle">{{ l }}</text> }
          <rect class="hit" [attr.x]="cx(i) - step() / 2" y="0" [attr.width]="step()" [attr.height]="H - B" (mouseenter)="hover.set(i)" />
        }
        @if (hover() !== null && type() !== 'bar') {
          <line class="cursor" [attr.x1]="cx(hover()!)" [attr.x2]="cx(hover()!)" y1="8" [attr.y2]="H - B" />
        }
      </svg>
      <div class="chart-legend">
        @for (s of series(); track s.name) {
          <span><i [style.background]="s.color"></i>{{ s.name }}@if (hover() !== null) {: <b>{{ s.values[hover()!] }}</b>}</span>
        }
        @if (hover() !== null) { <span class="muted">{{ labels()[hover()!] }}</span> }
      </div>
    </div>
  `,
  styles: [`
    .chart { width: 100%; }
    svg { width: 100%; height: 220px; display: block; }
    .grid { stroke: var(--border); stroke-width: 1; }
    .axis { fill: var(--text-3); font-size: 10px; }
    .hit { fill: transparent; }
    .cursor { stroke: var(--text-3); stroke-dasharray: 3 3; }
    rect.dim { opacity: .45; }
    .chart-legend { display: flex; flex-wrap: wrap; gap: 4px 16px; font-size: 12px; color: var(--text-2); margin-top: 6px; min-height: 18px; }
    .chart-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 6px; }
  `],
})
export class ChartComponent {
  readonly series = input.required<ChartSeries[]>();
  readonly labels = input.required<string[]>();
  readonly type = input<'bar' | 'line' | 'area'>('bar');
  readonly ariaLabel = input('Chart');

  readonly W = 640;
  readonly H = 220;
  readonly P = 34;
  readonly B = 22;
  readonly hover = signal<number | null>(null);

  readonly max = computed(() => {
    const m = Math.max(1, ...this.series().flatMap((s) => s.values));
    const mag = 10 ** Math.floor(Math.log10(m));
    return Math.ceil(m / mag) * mag;
  });
  readonly ticks = computed(() => [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(this.max() * f)));
  readonly step = computed(() => (this.W - this.P - 8) / Math.max(this.labels().length, 1));
  readonly barW = computed(() => Math.max(2, (this.step() * 0.7) / Math.max(this.series().length, 1)));
  readonly labelEvery = computed(() => Math.max(1, Math.ceil(this.labels().length / 8)));

  y(v: number) { return 8 + (this.H - this.B - 8) * (1 - v / this.max()); }
  cx(i: number) { return this.P + this.step() * i + this.step() / 2; }
  barX(i: number, si: number) { return this.cx(i) - (this.barW() * this.series().length) / 2 + si * this.barW(); }
  line(values: number[]) { return values.map((v, i) => `${i ? 'L' : 'M'}${this.cx(i).toFixed(1)},${this.y(v).toFixed(1)}`).join(' '); }
  area(values: number[]) {
    if (!values.length) return '';
    return `${this.line(values)} L${this.cx(values.length - 1)},${this.H - this.B} L${this.cx(0)},${this.H - this.B} Z`;
  }
}
