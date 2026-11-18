import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of } from 'rxjs';
import { AuthService } from './auth.service';

/** Allows platform admins only. Tries a silent cookie refresh before redirecting to /login. */
export const adminGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() && auth.can('ADMIN_ACCESS')) return of(true);
  return auth.refresh().pipe(map((ok) => ok || router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })));
};

/** Route-level permission check, e.g. canActivate: [permissionGuard('AUDIT_READ')]. */
export const permissionGuard = (permission: string): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.can(permission) || router.createUrlTree(['/forbidden']);
};
