/** Asks the Spring Boot API whether the caller may see a project, forwarding the caller's own token. */
export type ProjectAccessChecker = (projectId: number, token: string) => Promise<boolean>;

export function apiAccessChecker(apiUrl: string, fetchImpl: typeof fetch = fetch): ProjectAccessChecker {
  const cache = new Map<string, { ok: boolean; at: number }>();
  return async (projectId, token) => {
    const key = `${projectId}:${token.slice(-24)}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 30_000) return hit.ok;
    try {
      const res = await fetchImpl(`${apiUrl}/api/v1/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      });
      const ok = res.ok;
      cache.set(key, { ok, at: Date.now() });
      if (cache.size > 5000) cache.clear();
      return ok;
    } catch {
      return false;
    }
  };
}
