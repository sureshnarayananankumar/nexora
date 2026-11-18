import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { Redis } from 'ioredis';
import { pino } from 'pino';
import { StreamConsumer } from '../src/streamConsumer.js';
import { RedisPresence } from '../src/presence.js';
import type { StreamEvent } from '../src/router.js';

// Uses a throwaway local redis-server when one is installed; skipped otherwise (CI uses a service container).
const PORT = 6390 + Math.floor(Math.random() * 100);
let proc: ChildProcess | null = null;
let redis: Redis | null = null;
let available = true;

beforeAll(async () => {
  try {
    proc = spawn('redis-server', ['--port', String(PORT), '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
    await new Promise<void>((resolve, reject) => {
      proc!.once('error', reject);
      setTimeout(resolve, 400);
    });
    redis = new Redis({ port: PORT, maxRetriesPerRequest: 1, lazyConnect: true });
    await redis.connect();
  } catch {
    available = false;
  }
});

afterAll(async () => {
  redis?.disconnect();
  proc?.kill();
});

describe('Redis integration', () => {
  it('consumes the API event stream with acknowledgements', async (ctx) => {
    if (!available || !redis) ctx.skip();
    const received: StreamEvent[] = [];
    const consumer = new StreamConsumer(redis!.duplicate(), 'test:events', 'rt', 'c1', (e) => received.push(e), pino({ level: 'silent' }));
    await consumer.start();
    // Same field layout as RealtimeEventRelay.java
    await redis!.xadd('test:events', '*', 'type', 'task.created', 'orgId', '1', 'projectId', '3', 'userIds', '',
      'orgWide', 'false', 'payload', '{"id":7}', 'emittedAt', new Date().toISOString());
    for (let i = 0; i < 50 && received.length === 0; i++) await new Promise((r) => setTimeout(r, 100));
    await consumer.stop();
    expect(received[0]).toMatchObject({ type: 'task.created', projectId: 3, payload: { id: 7 } });
    const pending = (await redis!.xpending('test:events', 'rt')) as [number, ...unknown[]];
    expect(pending[0]).toBe(0);
  });

  it('shares presence through Redis', async (ctx) => {
    if (!available || !redis) ctx.skip();
    const p = new RedisPresence(redis!);
    await p.join('org:1', { id: 1, name: 'Ana' });
    await p.join('org:1', { id: 1, name: 'Ana' });
    await p.leave('org:1', 1);
    expect(await p.list('org:1')).toEqual([{ id: 1, name: 'Ana' }]);
    await p.leave('org:1', 1);
    expect(await p.list('org:1')).toEqual([]);
  });
});
