import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import type { TaskPriority, TaskStatus } from '../api/types';

export const STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'BACKLOG', label: 'Backlog', color: 'var(--status-backlog)' },
  { value: 'TODO', label: 'To do', color: 'var(--status-todo)' },
  { value: 'IN_PROGRESS', label: 'In progress', color: 'var(--status-progress)' },
  { value: 'IN_REVIEW', label: 'In review', color: 'var(--status-review)' },
  { value: 'BLOCKED', label: 'Blocked', color: 'var(--status-blocked)' },
  { value: 'DONE', label: 'Done', color: 'var(--status-done)' },
];
export const statusMeta = (s: TaskStatus) => STATUSES.find((x) => x.value === s)!;

export const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'LOW', label: 'Low', color: 'var(--prio-low)' },
  { value: 'MEDIUM', label: 'Medium', color: 'var(--prio-medium)' },
  { value: 'HIGH', label: 'High', color: 'var(--prio-high)' },
  { value: 'CRITICAL', label: 'Critical', color: 'var(--prio-critical)' },
];
export const priorityMeta = (p: TaskPriority) => PRIORITIES.find((x) => x.value === p)!;

export const ago = (iso?: string) => (iso ? formatDistanceToNowStrict(parseISO(iso), { addSuffix: true }) : '');
export const day = (iso?: string) => (iso ? format(parseISO(iso), 'd MMM') : '');
export const fullDay = (iso?: string) => (iso ? format(parseISO(iso), 'EEE, d MMM yyyy') : '');
export const isoDate = (d: Date) => format(d, 'yyyy-MM-dd');

export function dueLabel(iso?: string, done = false): { text: string; tone: 'danger' | 'warning' | 'muted' } | null {
  if (!iso) return null;
  const d = differenceInCalendarDays(parseISO(iso), new Date());
  if (done) return { text: day(iso), tone: 'muted' };
  if (d < 0) return { text: `${-d}d overdue`, tone: 'danger' };
  if (d === 0) return { text: 'Due today', tone: 'warning' };
  if (d === 1) return { text: 'Tomorrow', tone: 'warning' };
  if (d <= 7) return { text: `In ${d} days`, tone: 'muted' };
  return { text: day(iso), tone: 'muted' };
}

export const initials = (name?: string) =>
  (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');

export const riskTone = (risk: 'LOW' | 'MEDIUM' | 'HIGH') => (risk === 'LOW' ? 'success' : risk === 'MEDIUM' ? 'warning' : 'danger');
export const scoreColor = (score: number) => (score >= 75 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)');

/** Fractional index between two neighbours, so a move only updates the moved card. */
export function positionBetween(before?: number, after?: number) {
  if (before === undefined && after === undefined) return 1024;
  if (before === undefined) return after! - 1024;
  if (after === undefined) return before + 1024;
  return (before + after) / 2;
}
