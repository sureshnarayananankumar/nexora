import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastService } from './core/toast.service';
import { ThemeService } from './core/theme.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    <router-outlet />
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) {
        <div class="toast" [class]="'toast toast-' + t.tone" role="status">
          <span>{{ t.text }}</span>
          <button class="btn btn-ghost btn-icon btn-sm" aria-label="Dismiss" (click)="toast.dismiss(t.id)">✕</button>
        </div>
      }
    </div>
  `,
})
export class App {
  readonly toast = inject(ToastService);
  // Instantiated eagerly so the saved theme applies before the first route renders.
  private readonly theme = inject(ThemeService);
}
