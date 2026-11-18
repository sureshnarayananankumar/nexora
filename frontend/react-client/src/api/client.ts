import { useAuth } from '../stores/auth';
import type { AuthResponse } from './types';

export interface FieldError { field: string; message: string }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fieldErrors: FieldError[] = []) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/** Exchanges the HttpOnly refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) {
          useAuth.getState().clear();
          return false;
        }
        const body = (await res.json()) as AuthResponse;
        useAuth.getState().setSession(body.accessToken, body.user);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = await res.json();
    return new ApiError(res.status, body.code ?? 'ERROR', body.message ?? res.statusText, body.fieldErrors ?? []);
  } catch {
    return new ApiError(res.status, 'ERROR', res.status >= 500 ? 'The server is having trouble. Try again shortly.' : res.statusText);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}, retry = true): Promise<T> {
  const token = useAuth.getState().token;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, { ...init, headers, body, credentials: 'include' });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Can’t reach NEXORA. Check your connection.');
  }
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return api<T>(path, init, false);
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, json?: unknown) => api<T>(path, { method: 'POST', json });
export const put = <T>(path: string, json?: unknown) => api<T>(path, { method: 'PUT', json });
export const patch = <T>(path: string, json?: unknown) => api<T>(path, { method: 'PATCH', json });
export const del = <T = void>(path: string) => api<T>(path, { method: 'DELETE' });

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}
