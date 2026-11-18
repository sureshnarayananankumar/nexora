import type { Redis } from 'ioredis';

export interface PresenceUser {
  id: number;
  name: string;
}

/** Tracks who is online (per organisation) and who is viewing a project, counting multiple tabs. */
export interface PresenceStore {
  join(scope: string, user: PresenceUser): Promise<void>;
  leave(scope: string, userId: number): Promise<void>;
  list(scope: string): Promise<PresenceUser[]>;
}

export class MemoryPresence implements PresenceStore {
  private readonly scopes = new Map<string, Map<number, { name: string; count: number }>>();

  async join(scope: string, user: PresenceUser): Promise<void> {
    const m = this.scopes.get(scope) ?? new Map();
    const cur = m.get(user.id);
    m.set(user.id, { name: user.name, count: (cur?.count ?? 0) + 1 });
    this.scopes.set(scope, m);
  }

  async leave(scope: string, userId: number): Promise<void> {
    const m = this.scopes.get(scope);
    const cur = m?.get(userId);
    if (!m || !cur) return;
    if (cur.count <= 1) m.delete(userId);
    else m.set(userId, { ...cur, count: cur.count - 1 });
    if (m.size === 0) this.scopes.delete(scope);
  }

  async list(scope: string): Promise<PresenceUser[]> {
    return [...(this.scopes.get(scope)?.entries() ?? [])]
      .map(([id, v]) => ({ id, name: v.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

/** Redis-backed presence so several realtime instances share one view. Keys expire if an instance dies. */
export class RedisPresence implements PresenceStore {
  constructor(private readonly redis: Redis, private readonly ttlSeconds = 3600) {}

  private countKey(scope: string) { return `nexora:presence:${scope}:count`; }
  private nameKey(scope: string) { return `nexora:presence:${scope}:names`; }

  async join(scope: string, user: PresenceUser): Promise<void> {
    await this.redis.multi()
      .hincrby(this.countKey(scope), String(user.id), 1)
      .hset(this.nameKey(scope), String(user.id), user.name)
      .expire(this.countKey(scope), this.ttlSeconds)
      .expire(this.nameKey(scope), this.ttlSeconds)
      .exec();
  }

  async leave(scope: string, userId: number): Promise<void> {
    const left = await this.redis.hincrby(this.countKey(scope), String(userId), -1);
    if (left <= 0) {
      await this.redis.multi().hdel(this.countKey(scope), String(userId)).hdel(this.nameKey(scope), String(userId)).exec();
    }
  }

  async list(scope: string): Promise<PresenceUser[]> {
    const [counts, names] = await Promise.all([
      this.redis.hgetall(this.countKey(scope)),
      this.redis.hgetall(this.nameKey(scope)),
    ]);
    return Object.entries(counts)
      .filter(([, c]) => Number(c) > 0)
      .map(([id]) => ({ id: Number(id), name: names[id] ?? 'Someone' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
