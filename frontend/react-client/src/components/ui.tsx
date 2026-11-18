import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, X, Inbox } from 'lucide-react';
import { useUi } from '../stores/ui';
import { dueLabel, initials, priorityMeta, statusMeta } from '../lib/format';
import type { TaskPriority, TaskStatus, UserRef } from '../api/types';
import { ApiError } from '../api/client';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="nx-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C5CFF" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="var(--surface-2)" />
      <path d="M18 46V18l28 28V18" fill="none" stroke="url(#nx-g)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Avatar({ user, size = 28, online }: { user?: Pick<UserRef, 'fullName' | 'avatarColor'> | null; size?: number; online?: boolean }) {
  if (!user) {
    return <span className="avatar" style={{ ['--size' as string]: `${size}px`, background: 'var(--surface-3)', color: 'var(--text-3)' }} title="Unassigned">?</span>;
  }
  return (
    <span className={clsx('avatar', online && 'presence-dot')} title={user.fullName}
      style={{ ['--size' as string]: `${size}px`, background: user.avatarColor }}>
      {initials(user.fullName)}
    </span>
  );
}

export function AvatarStack({ users, max = 4, size = 26 }: { users: Pick<UserRef, 'fullName' | 'avatarColor'>[]; max?: number; size?: number }) {
  const shown = users.slice(0, max);
  return (
    <span className="avatar-stack">
      {shown.map((u, i) => <Avatar key={i} user={u} size={size} />)}
      {users.length > max && <span className="avatar" style={{ ['--size' as string]: `${size}px`, background: 'var(--surface-3)', color: 'var(--text-2)' }}>+{users.length - max}</span>}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const m = statusMeta(status);
  return <span className="badge badge-dot" style={{ color: m.color, background: `color-mix(in srgb, ${m.color} 14%, transparent)` }}>{m.label}</span>;
}

export function PriorityBadge({ priority, compact }: { priority: TaskPriority; compact?: boolean }) {
  const m = priorityMeta(priority);
  return (
    <span className="badge" title={`${m.label} priority`} style={{ color: m.color, background: `color-mix(in srgb, ${m.color} 14%, transparent)` }}>
      <PriorityIcon priority={priority} />{!compact && m.label}
    </span>
  );
}

export function PriorityIcon({ priority }: { priority: TaskPriority }) {
  const bars = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[priority];
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 3} y={9 - i * 2.5} width="2" height={3 + i * 2.5} rx="1" fill="currentColor" opacity={i < bars ? 1 : .25} />
      ))}
    </svg>
  );
}

export function DueBadge({ date, done }: { date?: string; done?: boolean }) {
  const d = dueLabel(date, done);
  if (!d) return null;
  return <span className={clsx('badge', d.tone === 'danger' && 'badge-danger', d.tone === 'warning' && 'badge-warning')}>{d.text}</span>;
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="Loading" />;
}

export function PageLoader() {
  return <div style={{ display: 'grid', placeItems: 'center', padding: 80 }}><Spinner size={26} /></div>;
}

export function Skeleton({ h = 16, w = '100%', r }: { h?: number; w?: number | string; r?: number }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r }} />;
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <Inbox size={22} />}</div>
      <h3>{title}</h3>
      {body && <p className="muted" style={{ maxWidth: 380 }}>{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const msg = error instanceof ApiError ? error.message : 'Something went wrong while loading this.';
  return (
    <div className="alert alert-danger" role="alert">
      <AlertTriangle size={18} />
      <div className="grow">{msg}</div>
      {retry && <button className="btn btn-sm" onClick={retry}>Retry</button>}
    </div>
  );
}

export function errorMessage(e: unknown) {
  if (e instanceof ApiError) {
    if (e.fieldErrors.length) return e.fieldErrors.map((f) => `${f.field}: ${f.message}`).join(' · ');
    return e.message;
  }
  return 'Something went wrong. Please try again.';
}

export function Modal({ title, onClose, children, footer, width }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">{children}</aside>
    </>,
    document.body,
  );
}

export function ConfirmDialog({ title, body, confirmLabel = 'Confirm', danger, busy, onConfirm, onClose }: {
  title: string; body: ReactNode; confirmLabel?: string; danger?: boolean; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose} width={440} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className={clsx('btn', danger ? 'btn-danger' : 'btn-primary')} disabled={busy} onClick={onConfirm}>{busy && <Spinner size={14} />}{confirmLabel}</button>
    </>}>
      <div className="muted">{body}</div>
    </Modal>
  );
}

export function Menu({ trigger, children, align = 'right' }: { trigger: (open: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {trigger(() => setOpen((v) => !v))}
      {open && <div className="menu" style={{ top: 'calc(100% + 6px)', [align]: 0 }}>{children(() => setOpen(false))}</div>}
    </div>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => {
        const tone = t.tone === 'success' ? 'success' : t.tone === 'error' ? 'danger' : 'accent';
        const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertTriangle : Info;
        return (
          <div key={t.id} className="toast" role="status">
            <div className="toast-icon" style={{ background: `var(--${tone}-soft)`, color: `var(--${tone === 'accent' ? 'accent-text' : tone})` }}><Icon /></div>
            <div className="grow">
              <div className="strong">{t.title}</div>
              {t.body && <div className="muted small" style={{ marginTop: 2 }}>{t.body}</div>}
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X /></button>
          </div>
        );
      })}
    </div>
  );
}

/** Animated health gauge used on dashboards and project overviews. */
export function HealthRing({ score, size = 76, stroke = 8, label = true }: { score: number; size?: number; stroke?: number; label?: boolean }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';
  const [shown, setShown] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setShown(score)); return () => cancelAnimationFrame(id); }, [score]);
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }} role="img" aria-label={`Health score ${score} of 100`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * shown) / 100} style={{ transition: 'stroke-dashoffset 900ms var(--ease)' }} />
      </svg>
      {label && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 750, fontSize: size * .28, letterSpacing: '-.03em' }}>
          {score}
        </div>
      )}
    </div>
  );
}

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}
