import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { IS_DEMO } from '../../core/demo';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorText } from '../../core/toast.service';

@Component({
  selector: 'nx-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="login-page">
      <div class="login-glow" aria-hidden="true"></div>
      <form class="login-card card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="brand" style="padding:0 0 18px">
          <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C5CFF"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="var(--surface-2)"/><path d="M18 46V18l28 28V18" fill="none" stroke="url(#lg)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <div><div class="brand-name">NEXORA</div><div class="brand-sub">Admin console</div></div>
        </div>
        <h1>Sign in</h1>
        <p class="muted">Restricted to platform administrators.</p>
        @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
        <label class="field">
          <span>Email</span>
          <input class="input" type="email" formControlName="email" autocomplete="username" [attr.aria-invalid]="invalid('email')" />
          @if (invalid('email')) { <small class="field-error">Enter a valid email</small> }
        </label>
        <label class="field">
          <span>Password</span>
          <input class="input" type="password" formControlName="password" autocomplete="current-password" [attr.aria-invalid]="invalid('password')" />
          @if (invalid('password')) { <small class="field-error">Enter your password</small> }
        </label>
        <button class="btn btn-primary btn-lg" type="submit" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Sign in' }}</button>
        @if (demo) { <p class="tiny muted" style="margin-top:14px">Online demo: the admin account is prefilled and any password works.</p> }
        @else if (local) { <p class="tiny muted" style="margin-top:14px">Local demo: <code>admin&#64;nexora.dev</code> with your <code>NEXORA_DEMO_PASSWORD</code>.</p> }
      </form>
    </div>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly local = ['localhost', '127.0.0.1'].includes(location.hostname);
  readonly demo = IS_DEMO;

  readonly form = this.fb.nonNullable.group({
    email: [IS_DEMO ? 'admin@nexora.dev' : '', [Validators.required, Validators.email]],
    password: [IS_DEMO ? 'demo1234' : '', Validators.required],
  });

  invalid(name: 'email' | 'password') {
    const c = this.form.controls[name];
    return c.invalid && (c.touched || c.dirty);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (e) => { this.error.set(errorText(e, 'Sign-in failed')); this.busy.set(false); },
    });
  }
}
