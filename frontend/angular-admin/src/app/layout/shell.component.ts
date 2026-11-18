import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ThemeService } from '../core/theme.service';

interface NavItem { path: string; label: string; icon: string; permission?: string }

@Component({
  selector: 'nx-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell" [class.nav-open]="navOpen()">
      <nav class="sidebar" aria-label="Admin navigation">
        <div class="brand">
          <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="ag" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C5CFF"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="var(--surface-2)"/><path d="M18 46V18l28 28V18" fill="none" stroke="url(#ag)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <div><div class="brand-name">NEXORA</div><div class="brand-sub">Admin console</div></div>
        </div>
        @for (group of groups; track group.title) {
          <div class="nav-section">{{ group.title }}</div>
          @for (item of group.items; track item.path) {
            @if (!item.permission || auth.can(item.permission)) {
              <a class="nav-link" [routerLink]="item.path" routerLinkActive="active" (click)="navOpen.set(false)">
                <span class="nav-icon" aria-hidden="true">{{ item.icon }}</span>{{ item.label }}
              </a>
            }
          }
        }
      </nav>
      @if (navOpen()) { <div class="scrim" (click)="navOpen.set(false)"></div> }
      <div class="main">
        <header class="topbar">
          <button class="btn btn-ghost btn-icon mobile-only" aria-label="Open navigation" (click)="navOpen.set(true)">☰</button>
          <span class="env-pill">● Production console</span>
          <span class="grow"></span>
          <button class="btn btn-ghost btn-sm" (click)="theme.toggle()" [attr.aria-label]="'Switch to ' + (theme.dark() ? 'light' : 'dark') + ' theme'">{{ theme.dark() ? '☀ Light' : '☾ Dark' }}</button>
          @if (auth.user(); as u) {
            <div class="me">
              <span class="avatar" [style.background]="u.avatarColor">{{ u.fullName.charAt(0) }}</span>
              <div class="me-text"><strong>{{ u.fullName }}</strong><span>{{ u.email }}</span></div>
            </div>
          }
          <button class="btn btn-sm" (click)="auth.logout()">Log out</button>
        </header>
        <main class="content"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly navOpen = signal(false);

  readonly groups: { title: string; items: NavItem[] }[] = [
    { title: 'Overview', items: [
      { path: '/dashboard', label: 'Dashboard', icon: '◧' },
      { path: '/analytics', label: 'Analytics & reports', icon: '▤' },
    ] },
    { title: 'Tenants', items: [
      { path: '/organizations', label: 'Organizations', icon: '▣' },
      { path: '/users', label: 'Users', icon: '◉' },
      { path: '/projects', label: 'Project monitoring', icon: '◈' },
    ] },
    { title: 'Access & billing', items: [
      { path: '/roles', label: 'Roles & permissions', icon: '⚿' },
      { path: '/plans', label: 'Subscription plans', icon: '◇' },
    ] },
    { title: 'Operations', items: [
      { path: '/api-monitoring', label: 'API monitoring', icon: '∿' },
      { path: '/audit', label: 'Audit logs', icon: '☰', permission: 'AUDIT_READ' },
      { path: '/settings', label: 'System configuration', icon: '⚙' },
    ] },
  ];
}
