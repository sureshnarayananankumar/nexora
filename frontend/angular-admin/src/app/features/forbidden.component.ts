import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'nx-forbidden',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `<div class="card empty" style="margin-top:40px"><div class="empty-icon">⚿</div><strong>You don’t have access to that page</strong><p class="muted">Your role lacks the required permission.</p><a class="btn" routerLink="/dashboard">Back to dashboard</a></div>`,
})
export class ForbiddenComponent {}
