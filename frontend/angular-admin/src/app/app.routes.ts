import { Routes } from '@angular/router';
import { adminGuard, permissionGuard } from './core/auth.guard';
import { ShellComponent } from './layout/shell.component';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent), title: 'Sign in · NEXORA Admin' },
  {
    path: '',
    component: ShellComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent), title: 'Dashboard · NEXORA Admin' },
      { path: 'analytics', loadComponent: () => import('./features/analytics/analytics.component').then((m) => m.AnalyticsComponent), title: 'Analytics · NEXORA Admin' },
      { path: 'organizations', loadComponent: () => import('./features/organizations/organizations.component').then((m) => m.OrganizationsComponent), title: 'Organizations · NEXORA Admin' },
      { path: 'users', loadComponent: () => import('./features/users/users.component').then((m) => m.UsersComponent), title: 'Users · NEXORA Admin' },
      { path: 'projects', loadComponent: () => import('./features/projects/projects.component').then((m) => m.ProjectsComponent), title: 'Projects · NEXORA Admin' },
      { path: 'roles', loadComponent: () => import('./features/roles/roles.component').then((m) => m.RolesComponent), title: 'Roles · NEXORA Admin' },
      { path: 'plans', loadComponent: () => import('./features/plans/plans.component').then((m) => m.PlansComponent), title: 'Plans · NEXORA Admin' },
      { path: 'api-monitoring', loadComponent: () => import('./features/api-monitoring/api-monitoring.component').then((m) => m.ApiMonitoringComponent), title: 'API monitoring · NEXORA Admin' },
      { path: 'audit', canActivate: [permissionGuard('AUDIT_READ')], loadComponent: () => import('./features/audit/audit.component').then((m) => m.AuditComponent), title: 'Audit logs · NEXORA Admin' },
      { path: 'settings', loadComponent: () => import('./features/settings/settings.component').then((m) => m.SettingsComponent), title: 'Configuration · NEXORA Admin' },
      { path: 'forbidden', loadComponent: () => import('./features/forbidden.component').then((m) => m.ForbiddenComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
