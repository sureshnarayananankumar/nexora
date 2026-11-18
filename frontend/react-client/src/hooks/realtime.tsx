import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../stores/auth';
import { useUi, type PresenceUser } from '../stores/ui';
import { invalidateTaskViews, keys } from '../api/queries';
import type { Comment, Notification, Task } from '../api/types';

interface DomainMessage<T = unknown> { type: string; projectId: number | null; payload: T; emittedAt: string }

const RealtimeContext = createContext<Socket | null>(null);

/**
 * One Socket.IO connection per signed-in session. Server events patch the React Query cache,
 * so every open screen updates live without polling.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  const me = useAuth((s) => s.user);
  const qc = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  useEffect(() => {
    if (!me) return;
    const s = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({ token: tokenRef.current }),
      reconnectionDelayMax: 8000,
    });
    const ui = useUi.getState();

    s.on('connect', () => ui.setRealtimeConnected(true));
    s.on('disconnect', () => ui.setRealtimeConnected(false));
    s.on('presence:org', (m: { users: PresenceUser[] }) => ui.setOrgOnline(m.users));
    s.on('presence:project', (m: { projectId: number; users: PresenceUser[] }) => ui.setProjectViewers(m.projectId, m.users));
    s.on('typing', (m: { taskId: number; typing: boolean; user: PresenceUser }) => {
      ui.setTyping(m.taskId, m.user, m.typing);
      if (m.typing) setTimeout(() => useUi.getState().setTyping(m.taskId, m.user, false), 6000);
    });

    const upsertTask = (task: Task) => {
      qc.setQueryData<Task[]>(keys.tasks(task.projectId), (old) => {
        if (!old) return old;
        const exists = old.some((t) => t.id === task.id);
        return exists ? old.map((t) => (t.id === task.id ? task : t)) : [...old, task];
      });
      qc.setQueryData(keys.task(task.id), task);
      invalidateTaskViews(qc, task.projectId);
    };
    s.on('task.created', (m: DomainMessage<Task>) => upsertTask(m.payload));
    s.on('task.updated', (m: DomainMessage<Task>) => upsertTask(m.payload));
    s.on('task.deleted', (m: DomainMessage<{ id: number; projectId: number }>) => {
      qc.setQueryData<Task[]>(keys.tasks(m.payload.projectId), (old) => old?.filter((t) => t.id !== m.payload.id));
      invalidateTaskViews(qc, m.payload.projectId);
    });
    s.on('comment.created', (m: DomainMessage<Comment>) => {
      qc.setQueryData<Comment[]>(keys.comments(m.payload.taskId), (old) =>
        old && !old.some((c) => c.id === m.payload.id) ? [...old, m.payload] : old);
      if (m.projectId) qc.invalidateQueries({ queryKey: keys.tasks(m.projectId) });
    });
    s.on('comment.deleted', (m: DomainMessage<{ id: number; taskId: number }>) => {
      qc.setQueryData<Comment[]>(keys.comments(m.payload.taskId), (old) => old?.filter((c) => c.id !== m.payload.id));
    });
    s.on('activity.created', () => qc.invalidateQueries({ queryKey: ['activities'] }));
    s.on('project.changed', () => { qc.invalidateQueries({ queryKey: keys.projects }); qc.invalidateQueries({ queryKey: keys.portfolio }); });
    s.on('workflow.executed', () => { qc.invalidateQueries({ queryKey: ['executions'] }); qc.invalidateQueries({ queryKey: keys.workflows }); });
    s.on('notification.created', (m: DomainMessage<Notification>) => {
      qc.invalidateQueries({ queryKey: keys.notifications });
      useUi.getState().toast({ tone: 'info', title: m.payload.title, body: m.payload.body });
    });

    setSocket(s);
    return () => {
      s.close();
      setSocket(null);
      useUi.getState().setRealtimeConnected(false);
    };
  }, [me?.id, qc]); // eslint-disable-line react-hooks/exhaustive-deps

  return <RealtimeContext.Provider value={socket}>{children}</RealtimeContext.Provider>;
}

export const useSocket = () => useContext(RealtimeContext);

/** Joins a project room while the component is mounted (for live board updates and presence). */
export function useProjectRoom(projectId: number) {
  const socket = useSocket();
  useEffect(() => {
    if (!socket || !projectId) return;
    const join = () => socket.emit('project:join', { projectId }, (r: { ok: boolean; users?: PresenceUser[] }) => {
      if (r?.ok && r.users) useUi.getState().setProjectViewers(projectId, r.users);
    });
    if (socket.connected) join();
    socket.on('connect', join);
    return () => {
      socket.off('connect', join);
      socket.emit('project:leave', { projectId });
    };
  }, [socket, projectId]);
}
