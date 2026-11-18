import { HttpClient, HttpContext, HttpContextToken, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { AdminUser, AuthResponse } from './models';

/** Requests flagged with this token skip the auth interceptor's refresh-and-retry logic. */
export const SKIP_AUTH_RETRY = new HttpContextToken<boolean>(() => false);

const ADMIN_HEADERS = new HttpHeaders({ 'X-Client': 'admin' });

/**
 * Holds the admin session in memory (signals). The refresh token is an HttpOnly cookie
 * scoped to the admin client, separate from the product app's cookie.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _token = signal<string | null>(null);
  private readonly _user = signal<AdminUser | null>(null);
  private refreshing$: Observable<boolean> | null = null;

  readonly token = this._token.asReadonly();
  readonly user = this._user.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token());

  can(permission: string): boolean {
    return this._user()?.permissions.includes(permission) ?? false;
  }

  login(email: string, password: string): Observable<AdminUser> {
    return this.http.post<AuthResponse>('/api/v1/auth/login', { email, password }, {
      headers: ADMIN_HEADERS, withCredentials: true, context: new HttpContext().set(SKIP_AUTH_RETRY, true),
    }).pipe(tap((r) => this.setSession(r)), map((r) => r.user));
  }

  /** Exchanges the HttpOnly cookie for a fresh access token. Concurrent callers share one request. */
  refresh(): Observable<boolean> {
    if (!this.refreshing$) {
      this.refreshing$ = this.http.post<AuthResponse>('/api/v1/auth/refresh', null, {
        headers: ADMIN_HEADERS, withCredentials: true, context: new HttpContext().set(SKIP_AUTH_RETRY, true),
      }).pipe(
        tap((r) => this.setSession(r)),
        map((r) => r.user.permissions.includes('ADMIN_ACCESS')),
        catchError(() => { this.clear(); return of(false); }),
        finalize(() => { this.refreshing$ = null; }),
        shareReplay(1),
      );
    }
    return this.refreshing$;
  }

  logout(): void {
    this.http.post('/api/v1/auth/logout', null, {
      headers: ADMIN_HEADERS, withCredentials: true, context: new HttpContext().set(SKIP_AUTH_RETRY, true),
    }).pipe(catchError(() => of(null))).subscribe(() => {
      this.clear();
      void this.router.navigate(['/login']);
    });
  }

  clear(): void {
    this._token.set(null);
    this._user.set(null);
  }

  private setSession(r: AuthResponse): void {
    this._token.set(r.accessToken);
    this._user.set(r.user);
  }
}
