import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService, SKIP_AUTH_RETRY } from './auth.service';

/** Adds the bearer token and X-Client header; on 401 refreshes once and retries the request. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!req.url.startsWith('/api/') && !req.url.startsWith('/realtime/')) return next(req);

  const withToken = (token: string | null) => req.clone({
    setHeaders: { 'X-Client': 'admin', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    withCredentials: true,
  });

  return next(withToken(auth.token())).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401 || req.context.get(SKIP_AUTH_RETRY)) {
        return throwError(() => err);
      }
      return auth.refresh().pipe(switchMap((ok) => {
        if (!ok) {
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          return throwError(() => err);
        }
        return next(withToken(auth.token()));
      }));
    }),
  );
};
