import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import { pino } from 'pino';
import { createRealtimeServer, type RealtimeServer } from '../src/server.js';
import { MemoryPresence } from '../src/presence.js';
import { SECRET, token } from './helpers.js';

let server: RealtimeServer;
let url: string;
const sockets: Socket[] = [];

function client(tok: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(url, { path: '/socket.io', auth: { token: tok }, transports: ['websocket'], reconnection: false });
    sockets.push(s);
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

const next = <T>(s: Socket, event: string) => new Promise<T>((resolve) => s.once(event, resolve));

beforeAll(async () => {
  // Project 1 is visible to everyone, project 2 to nobody (stands in for the API membership check).
  server = createRealtimeServer({
    jwtSecret: SECRET,
    corsOrigins: ['http://localhost'],
    presence: new MemoryPresence(),
    canAccessProject: async (projectId) => projectId === 1,
    log: pino({ level: 'silent' }),
  });
  await new Promise<void>((r) => server.http.listen(0, r));
  url = `http://localhost:${(server.http.address() as AddressInfo).port}`;
});

afterAll(async () => {
  sockets.forEach((s) => s.close());
  await server.close();
});

describe('socket gateway', () => {
  it('rejects connections without a valid token', async () => {
    await expect(client('nope')).rejects.toThrow('unauthorized');
  });

  it('joins authorised projects, shares presence and refuses others', async () => {
    const a = await client(token(1, 10, 'Ana'));
    const b = await client(token(2, 10, 'Ben'));
    const joinA = await a.emitWithAck('project:join', { projectId: 1 });
    expect(joinA.ok).toBe(true);
    const presence = next<{ users: { name: string }[] }>(a, 'presence:project');
    const joinB = await b.emitWithAck('project:join', { projectId: 1 });
    expect(joinB.users.map((u: { name: string }) => u.name)).toEqual(['Ana', 'Ben']);
    expect((await presence).users.map((u) => u.name)).toEqual(['Ana', 'Ben']);
    const denied = await a.emitWithAck('project:join', { projectId: 2 });
    expect(denied).toEqual({ ok: false, error: 'forbidden' });
  });

  it('relays typing to other project members only', async () => {
    const a = await client(token(3, 11, 'Cy'));
    const b = await client(token(4, 11, 'Di'));
    await a.emitWithAck('project:join', { projectId: 1 });
    await b.emitWithAck('project:join', { projectId: 1 });
    const got = next<{ user: { name: string }; taskId: number }>(b, 'typing');
    a.emit('typing', { projectId: 1, taskId: 99, typing: true });
    expect(await got).toMatchObject({ taskId: 99, user: { name: 'Cy' } });
  });

  it('fans stream events out to the right rooms and not to other tenants', async () => {
    const member = await client(token(5, 20, 'Eve'));
    const outsider = await client(token(6, 21, 'Fin'));
    await member.emitWithAck('project:join', { projectId: 1 });
    let outsiderGot = false;
    outsider.on('notification.created', () => { outsiderGot = true; });
    const projectEvent = next<{ payload: { id: number } }>(member, 'task.updated');
    const userEvent = next<{ payload: { title: string } }>(member, 'notification.created');
    server.dispatch({ type: 'task.updated', orgId: 20, projectId: 1, userIds: [], orgWide: false, payload: { id: 42 }, emittedAt: '' });
    server.dispatch({ type: 'notification.created', orgId: 20, projectId: null, userIds: [5], orgWide: false, payload: { title: 'hi' }, emittedAt: '' });
    expect((await projectEvent).payload.id).toBe(42);
    expect((await userEvent).payload.title).toBe('hi');
    await new Promise((r) => setTimeout(r, 100));
    expect(outsiderGot).toBe(false);
  });

  it('exposes health and metrics', async () => {
    const health = await request(server.http).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('UP');
    expect((await request(server.http).get('/metrics')).status).toBe(401);
    expect((await request(server.http).get('/metrics').set('Authorization', `Bearer ${token(1, 1)}`)).status).toBe(403);
    const metrics = await request(server.http).get('/metrics').set('Authorization', `Bearer ${token(1, 1, 'Admin', { perms: ['ADMIN_ACCESS'] })}`);
    expect(metrics.status).toBe(200);
    expect(metrics.body.eventsProcessed).toBeGreaterThanOrEqual(2);
    expect(metrics.body.connections).toBeGreaterThan(0);
  });
});
