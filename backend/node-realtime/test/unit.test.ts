import { describe, expect, it } from 'vitest';
import { parseStreamFields, roomsFor } from '../src/router.js';
import { verifyAccessToken } from '../src/auth.js';
import { MemoryPresence } from '../src/presence.js';
import { Metrics } from '../src/metrics.js';
import { loadConfig } from '../src/config.js';
import { SECRET, token } from './helpers.js';

describe('stream routing', () => {
  it('parses API stream fields and routes to scoped rooms only', () => {
    const e = parseStreamFields(['type', 'task.updated', 'orgId', '3', 'projectId', '7', 'userIds', '4,5',
      'orgWide', 'false', 'payload', '{"id":1}', 'emittedAt', '2026-01-01T00:00:00Z']);
    expect(e).toMatchObject({ type: 'task.updated', orgId: 3, projectId: 7, userIds: [4, 5], orgWide: false, payload: { id: 1 } });
    expect(roomsFor(e)).toEqual(['project:7', 'user:4', 'user:5']);
  });

  it('org-wide events go to the org room; nothing is ever global', () => {
    const e = parseStreamFields(['type', 'workflow.executed', 'orgId', '9', 'projectId', '', 'userIds', '', 'orgWide', 'true', 'payload', 'not-json']);
    expect(roomsFor(e)).toEqual(['org:9']);
    expect(e.payload).toBeNull();
    expect(roomsFor({ ...e, orgWide: false })).toEqual([]);
  });

  it('rejects entries without a type', () => {
    expect(() => parseStreamFields(['payload', '{}'])).toThrow();
  });
});

describe('JWT verification (same contract as the Spring API)', () => {
  it('accepts tokens signed by the API secret', () => {
    const u = verifyAccessToken(token(5, 2, 'Mei'), SECRET);
    expect(u).toMatchObject({ id: 5, orgId: 2, name: 'Mei', role: 'MEMBER', permissions: ['TASK_WRITE'] });
  });

  it('rejects wrong secret, expired and missing tokens', () => {
    expect(() => verifyAccessToken(token(1, 1, 'x', { secret: 'another-secret-another-secret-another-secret' }), SECRET)).toThrow();
    expect(() => verifyAccessToken(token(1, 1, 'x', { expiresIn: -10 }), SECRET)).toThrow();
    expect(() => verifyAccessToken(undefined, SECRET)).toThrow();
  });
});

describe('presence', () => {
  it('counts multiple tabs per user', async () => {
    const p = new MemoryPresence();
    await p.join('project:1', { id: 1, name: 'Bo' });
    await p.join('project:1', { id: 1, name: 'Bo' });
    await p.join('project:1', { id: 2, name: 'Al' });
    await p.leave('project:1', 1);
    expect(await p.list('project:1')).toEqual([{ id: 2, name: 'Al' }, { id: 1, name: 'Bo' }]);
    await p.leave('project:1', 1);
    expect(await p.list('project:1')).toEqual([{ id: 2, name: 'Al' }]);
  });
});

describe('metrics & config', () => {
  it('tracks events and connections', () => {
    const m = new Metrics();
    m.connected(); m.connected(); m.disconnected();
    m.event('task.updated'); m.event('task.updated'); m.event('activity.created');
    const s = m.snapshot();
    expect(s).toMatchObject({ connections: 1, peakConnections: 2, eventsProcessed: 3, eventsLastMinute: 3 });
    expect(s.byType).toEqual({ 'task.updated': 2, 'activity.created': 1 });
  });

  it('requires a strong JWT secret and builds the Redis URL', () => {
    expect(() => loadConfig({ JWT_SECRET: 'short' })).toThrow();
    const c = loadConfig({ JWT_SECRET: SECRET, REDIS_HOST: 'redis', REDIS_PASSWORD: 'p@ss' });
    expect(c.redisUrl).toBe('redis://:p%40ss@redis:6379');
  });
});
