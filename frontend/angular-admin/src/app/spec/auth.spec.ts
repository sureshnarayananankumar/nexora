import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { Observable, firstValueFrom, isObservable } from 'rxjs';
import { authInterceptor } from '../core/auth.interceptor';
import { AuthService } from '../core/auth.service';
import { adminGuard } from '../core/auth.guard';
import { AdminUser } from '../core/models';

const admin: AdminUser = {
  id: 1, email: 'admin@nexora.dev', fullName: 'Nora', role: 'SUPER_ADMIN', permissions: ['ADMIN_ACCESS', 'AUDIT_READ'], avatarColor: '#000',
  organization: { id: 1, name: 'Platform', slug: 'p', plan: 'PLATFORM' },
};

describe('admin auth', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => ctrl.verify());

  it('logs in with the admin client header and stores the session', async () => {
    const done = firstValueFrom(auth.login('admin@nexora.dev', 'pw'));
    const req = ctrl.expectOne('/api/v1/auth/login');
    expect(req.request.headers.get('X-Client')).toBe('admin');
    expect(req.request.withCredentials).toBeTrue();
    req.flush({ accessToken: 'tok', expiresIn: 900, user: admin });
    await done;
    expect(auth.token()).toBe('tok');
    expect(auth.can('AUDIT_READ')).toBeTrue();
  });

  it('adds the bearer token and refreshes once on 401', async () => {
    const login = firstValueFrom(auth.login('a', 'b'));
    ctrl.expectOne('/api/v1/auth/login').flush({ accessToken: 'old', expiresIn: 900, user: admin });
    await login;

    const result = firstValueFrom(http.get<number[]>('/api/v1/admin/overview'));
    const first = ctrl.expectOne('/api/v1/admin/overview');
    expect(first.request.headers.get('Authorization')).toBe('Bearer old');
    first.flush({ code: 'UNAUTHORIZED' }, { status: 401, statusText: 'Unauthorized' });

    ctrl.expectOne('/api/v1/auth/refresh').flush({ accessToken: 'new', expiresIn: 900, user: admin });
    const retry = ctrl.expectOne('/api/v1/admin/overview');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    retry.flush([1]);
    expect(await result).toEqual([1]);
  });

  it('guard redirects to /login when the silent refresh fails', async () => {
    const outcome = TestBed.runInInjectionContext(() => adminGuard({} as never, { url: '/users' } as never));
    const value = isObservable(outcome) ? firstValueFrom(outcome as Observable<boolean | UrlTree>) : Promise.resolve(outcome);
    ctrl.expectOne('/api/v1/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });
    const tree = (await value) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(tree)).toBe('/login?returnUrl=%2Fusers');
  });

  it('guard rejects non-admin sessions', async () => {
    const outcome = TestBed.runInInjectionContext(() => adminGuard({} as never, { url: '/' } as never));
    const value = firstValueFrom(outcome as Observable<boolean | UrlTree>);
    ctrl.expectOne('/api/v1/auth/refresh').flush({ accessToken: 't', expiresIn: 900, user: { ...admin, permissions: ['TASK_WRITE'] } });
    expect(await value).not.toBeTrue();
  });
});
