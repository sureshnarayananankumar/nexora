import { create } from 'zustand';
import type { Theme } from '../api/types';

export interface Toast { id: number; tone: 'success' | 'error' | 'info'; title: string; body?: string }
export interface PresenceUser { id: number; name: string }

interface UiState {
  theme: Theme;
  toasts: Toast[];
  orgOnline: PresenceUser[];
  projectViewers: Record<number, PresenceUser[]>;
  typing: Record<number, PresenceUser[]>;
  realtimeConnected: boolean;
  setTheme: (t: Theme) => void;
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: number) => void;
  setOrgOnline: (u: PresenceUser[]) => void;
  setProjectViewers: (projectId: number, u: PresenceUser[]) => void;
  setTyping: (taskId: number, user: PresenceUser, typing: boolean) => void;
  setRealtimeConnected: (v: boolean) => void;
}

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('nexora-theme', theme); } catch { /* storage unavailable */ }
}

let nextId = 1;

/** Stable empty list so selectors don't return a new array on every render. */
export const NO_USERS: PresenceUser[] = [];

export const useUi = create<UiState>((set, getState) => ({
  theme: ((): Theme => {
    try { return (localStorage.getItem('nexora-theme') as Theme) || 'system'; } catch { return 'system'; }
  })(),
  toasts: [],
  orgOnline: [],
  projectViewers: {},
  typing: {},
  realtimeConnected: false,
  setTheme: (theme) => { applyTheme(theme); set({ theme }); },
  toast: (t) => {
    const id = nextId++;
    set({ toasts: [...getState().toasts, { ...t, id }].slice(-4) });
    setTimeout(() => getState().dismiss(id), t.tone === 'error' ? 7000 : 4500);
  },
  dismiss: (id) => set({ toasts: getState().toasts.filter((t) => t.id !== id) }),
  setOrgOnline: (orgOnline) => set({ orgOnline }),
  setProjectViewers: (projectId, users) => set({ projectViewers: { ...getState().projectViewers, [projectId]: users } }),
  setTyping: (taskId, user, typing) => {
    const cur = (getState().typing[taskId] ?? []).filter((u) => u.id !== user.id);
    set({ typing: { ...getState().typing, [taskId]: typing ? [...cur, user] : cur } });
  },
  setRealtimeConnected: (realtimeConnected) => set({ realtimeConnected }),
}));
