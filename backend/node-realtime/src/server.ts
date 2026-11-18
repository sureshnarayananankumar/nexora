import express from 'express';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import type { Logger } from 'pino';
import { verifyAccessToken, type SocketUser } from './auth.js';
import type { PresenceStore, PresenceUser } from './presence.js';
import type { ProjectAccessChecker } from './access.js';
import { roomsFor, type StreamEvent } from './router.js';
import { Metrics } from './metrics.js';

export interface RealtimeDeps {
  jwtSecret: string;
  corsOrigins: string[];
  presence: PresenceStore;
  canAccessProject: ProjectAccessChecker;
  log: Logger;
  isReady?: () => boolean;
}

interface SocketData {
  user: SocketUser;
  token: string;
  projects: Set<number>;
}

type Ack = (reply: { ok: boolean; error?: string; users?: PresenceUser[] }) => void;

export interface ClientToServerEvents {
  'project:join': (msg: { projectId: number }, ack?: Ack) => void;
  'project:leave': (msg: { projectId: number }) => void;
  typing: (msg: { projectId: number; taskId: number; typing: boolean }) => void;
}

export interface DomainEventMessage {
  type: string;
  projectId: number | null;
  payload: unknown;
  emittedAt: string;
}

export interface ServerToClientEvents {
  'presence:project': (msg: { projectId: number; users: PresenceUser[] }) => void;
  'presence:org': (msg: { users: PresenceUser[] }) => void;
  typing: (msg: { projectId: number; taskId: number; typing: boolean; user: PresenceUser }) => void;
  /** Domain events use their type as the event name, e.g. "task.updated". */
  [event: string]: (msg: never) => void;
}

type NexoraIo = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type NexoraSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

export interface RealtimeServer {
  http: HttpServer;
  io: NexoraIo;
  metrics: Metrics;
  dispatch: (e: StreamEvent) => void;
  close: () => Promise<void>;
}

const orgScope = (orgId: number) => `org:${orgId}`;
const projectScope = (projectId: number) => `project:${projectId}`;

export function createRealtimeServer(deps: RealtimeDeps): RealtimeServer {
  const metrics = new Metrics();
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    const ready = deps.isReady ? deps.isReady() : true;
    res.status(ready ? 200 : 503).json({ status: ready ? 'UP' : 'DEGRADED', connections: metrics.connections });
  });
  // Operational metrics are for platform admins only (the admin console sends its access token).
  app.get('/metrics', (req, res) => {
    try {
      const header = req.header('authorization') ?? '';
      const user = verifyAccessToken(header.startsWith('Bearer ') ? header.slice(7) : undefined, deps.jwtSecret);
      if (!user.permissions.includes('ADMIN_ACCESS')) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Admin access required' });
        return;
      }
    } catch {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    res.json(metrics.snapshot());
  });

  const http = createServer(app);
  const io: NexoraIo = new Server(http, {
    path: '/socket.io',
    cors: { origin: deps.corsOrigins, credentials: true },
    pingInterval: 20_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 64 * 1024,
  });

  io.use((socket, next) => {
    try {
      const token = String((socket.handshake.auth as Record<string, unknown>)?.token ?? '');
      const user = verifyAccessToken(token, deps.jwtSecret);
      socket.data.user = user;
      socket.data.token = token;
      socket.data.projects = new Set();
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  const broadcastProjectPresence = async (projectId: number) => {
    io.to(`project:${projectId}`).emit('presence:project', {
      projectId,
      users: await deps.presence.list(projectScope(projectId)),
    });
  };
  const broadcastOrgPresence = async (orgId: number) => {
    io.to(`org:${orgId}`).emit('presence:org', { users: await deps.presence.list(orgScope(orgId)) });
  };

  io.on('connection', async (socket: NexoraSocket) => {
    const { user } = socket.data;
    metrics.connected();
    socket.join([`user:${user.id}`, `org:${user.orgId}`]);
    await deps.presence.join(orgScope(user.orgId), { id: user.id, name: user.name }).catch(() => undefined);
    void broadcastOrgPresence(user.orgId);

    // Disconnect when the access token expires; the client reconnects with a fresh one.
    const msLeft = user.exp * 1000 - Date.now();
    const expiry = setTimeout(() => socket.disconnect(true), Math.max(msLeft, 0) + 1000);

    socket.on('project:join', async (msg, ack) => {
      const projectId = Number(msg?.projectId);
      if (!Number.isInteger(projectId) || projectId <= 0) return ack?.({ ok: false, error: 'invalid project' });
      if (!(await deps.canAccessProject(projectId, socket.data.token))) return ack?.({ ok: false, error: 'forbidden' });
      if (!socket.data.projects.has(projectId)) {
        socket.data.projects.add(projectId);
        socket.join(`project:${projectId}`);
        await deps.presence.join(projectScope(projectId), { id: user.id, name: user.name }).catch(() => undefined);
      }
      await broadcastProjectPresence(projectId);
      return ack?.({ ok: true, users: await deps.presence.list(projectScope(projectId)) });
    });

    socket.on('project:leave', async (msg) => {
      const projectId = Number(msg?.projectId);
      if (!socket.data.projects.delete(projectId)) return;
      socket.leave(`project:${projectId}`);
      await deps.presence.leave(projectScope(projectId), user.id).catch(() => undefined);
      await broadcastProjectPresence(projectId);
    });

    socket.on('typing', (msg) => {
      const projectId = Number(msg?.projectId);
      if (!socket.data.projects.has(projectId)) return; // only rooms the user was authorised to join
      socket.to(`project:${projectId}`).emit('typing', {
        projectId,
        taskId: Number(msg?.taskId),
        typing: Boolean(msg?.typing),
        user: { id: user.id, name: user.name },
      });
    });

    socket.on('disconnect', async () => {
      clearTimeout(expiry);
      metrics.disconnected();
      for (const projectId of socket.data.projects) {
        await deps.presence.leave(projectScope(projectId), user.id).catch(() => undefined);
        void broadcastProjectPresence(projectId);
      }
      await deps.presence.leave(orgScope(user.orgId), user.id).catch(() => undefined);
      void broadcastOrgPresence(user.orgId);
    });
  });

  const dispatch = (e: StreamEvent) => {
    const rooms = roomsFor(e);
    if (rooms.length === 0) return;
    const message: DomainEventMessage = { type: e.type, projectId: e.projectId, payload: e.payload, emittedAt: e.emittedAt };
    // Domain event names are dynamic, so emit through the untyped server API.
    (io as unknown as Server).to(rooms).emit(e.type, message);
    metrics.event(e.type);
  };

  const close = () => new Promise<void>((resolve) => {
    io.close(() => resolve());
  });

  return { http, io, metrics, dispatch, close };
}
