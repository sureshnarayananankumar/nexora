import { api, ApiError, refreshSession } from '../api/client';
import { useAuth } from '../stores/auth';

const me = { id: 1, email: 'a@b.dev', fullName: 'A', avatarColor: '#000', role: 'MEMBER', permissions: [], organization: { id: 1, name: 'O', slug: 'o', plan: 'STARTER' }, capacityPoints: 20, timezone: 'UTC', theme: 'dark' as const };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => { vi.restoreAllMocks(); useAuth.getState().clear(); });

describe('api client', () => {
  it('refreshes once on 401 and retries with the new token', async () => {
    useAuth.getState().setSession('old', me);
    const calls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      calls.push(`${url} ${new Headers(init?.headers).get('Authorization') ?? ''}`);
      if (url.endsWith('/auth/refresh')) return json(200, { accessToken: 'new', expiresIn: 900, user: me });
      return new Headers(init?.headers).get('Authorization') === 'Bearer new' ? json(200, [1, 2]) : json(401, { code: 'UNAUTHORIZED', message: 'x' });
    });
    await expect(api<number[]>('/projects')).resolves.toEqual([1, 2]);
    expect(calls).toEqual(['/api/v1/projects Bearer old', '/api/v1/auth/refresh ', '/api/v1/projects Bearer new']);
    expect(useAuth.getState().token).toBe('new');
  });

  it('shares one refresh between concurrent callers', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { accessToken: 't', expiresIn: 900, user: me }));
    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('turns error bodies into ApiError with field errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(400, { code: 'VALIDATION_FAILED', message: 'Some fields are invalid', fieldErrors: [{ field: 'title', message: 'must not be blank' }] }));
    const err = await api('/tasks/1', { method: 'PUT', json: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_FAILED', fieldErrors: [{ field: 'title' }] });
  });

  it('signs the user out when refresh fails', async () => {
    useAuth.getState().setSession('old', me);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(401, { code: 'UNAUTHORIZED', message: 'Session expired' }));
    await expect(api('/projects')).rejects.toBeInstanceOf(ApiError);
    expect(useAuth.getState().status).toBe('anonymous');
  });
});
