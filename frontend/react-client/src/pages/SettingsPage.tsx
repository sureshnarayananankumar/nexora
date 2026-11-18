import { useState } from 'react';
import { Building2, KeyRound, Palette, UserRound } from 'lucide-react';
import { changePassword, updatePreferences, updateProfile, useOrganization, useUpdateOrganization } from '../api/queries';
import type { Theme } from '../api/types';
import { useAuth, can } from '../stores/auth';
import { useUi } from '../stores/ui';
import { Avatar, Field, Spinner, errorMessage } from '../components/ui';

const COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
const ZONES = ['UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Muscat', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Singapore', 'Australia/Sydney'];

export default function SettingsPage() {
  return (
    <div style={{ maxWidth: 860 }} className="stack">
      <div className="page-header" style={{ marginBottom: 0 }}><div><h1>Settings</h1><p className="muted">Your profile, preferences and organisation.</p></div></div>
      <Profile />
      <Preferences />
      <Password />
      <Organization />
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return <section className="card"><div className="card-header"><h3 className="row">{icon}{title}</h3></div><div className="card-body stack">{children}</div></section>;
}

function Profile() {
  const user = useAuth((s) => s.user)!;
  const toast = useUi((s) => s.toast);
  const [f, setF] = useState({ fullName: user.fullName, jobTitle: user.jobTitle ?? '', avatarColor: user.avatarColor, timezone: user.timezone, capacityPoints: user.capacityPoints });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const zones = ZONES.includes(f.timezone) ? ZONES : [f.timezone, ...ZONES];
  const save = async () => {
    if (f.fullName.trim().length < 2) return setErr('Name must be at least 2 characters');
    if (f.capacityPoints < 1 || f.capacityPoints > 200) return setErr('Capacity must be 1–200');
    setErr(null); setBusy(true);
    try { useAuth.getState().setUser(await updateProfile({ ...f, jobTitle: f.jobTitle || undefined })); toast({ tone: 'success', title: 'Profile saved' }); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Section icon={<UserRound size={16} />} title="Profile">
      {err && <div className="alert alert-danger">{err}</div>}
      <div className="row-3"><Avatar user={{ fullName: f.fullName, avatarColor: f.avatarColor }} size={52} /><div><div className="strong">{user.email}</div><div className="small muted">{user.role.replace('_', ' ').toLowerCase()} at {user.organization.name}</div></div></div>
      <div className="grid-2">
        <Field label="Full name"><input className="input" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
        <Field label="Job title"><input className="input" value={f.jobTitle} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} /></Field>
        <Field label="Time zone"><select className="select" value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>{zones.map((z) => <option key={z}>{z}</option>)}</select></Field>
        <Field label="Weekly capacity (points)" hint="Drives your workload percentage"><input className="input" type="number" min={1} max={200} value={f.capacityPoints} onChange={(e) => setF({ ...f, capacityPoints: Number(e.target.value) })} /></Field>
      </div>
      <div className="field"><span className="label">Avatar colour</span><div className="row">{COLORS.map((c) => <button key={c} type="button" className={`swatch ${f.avatarColor.toUpperCase() === c ? 'on' : ''}`} style={{ background: c }} aria-label={c} onClick={() => setF({ ...f, avatarColor: c })} />)}</div></div>
      <div><button className="btn btn-primary" onClick={save} disabled={busy}>{busy && <Spinner size={14} />}Save profile</button></div>
    </Section>
  );
}

function Preferences() {
  const user = useAuth((s) => s.user)!;
  const { theme, setTheme } = useUi();
  const toast = useUi((s) => s.toast);
  const pick = async (t: Theme) => {
    setTheme(t);
    try { useAuth.getState().setUser(await updatePreferences({ theme: t, dashboardLayout: user.dashboardLayout ?? [] })); }
    catch (e) { toast({ tone: 'error', title: 'Couldn’t sync theme', body: errorMessage(e) }); }
  };
  return (
    <Section icon={<Palette size={16} />} title="Appearance">
      <div className="theme-cards">
        {(['light', 'dark', 'system'] as const).map((t) => (
          <button key={t} className={`theme-card ${theme === t ? 'on' : ''}`} onClick={() => pick(t)} aria-pressed={theme === t}>
            <span className={`theme-preview tp-${t}`}><i /><i /><i /></span>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
    </Section>
  );
}

function Password() {
  const toast = useUi((s) => s.toast);
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/.test(f.newPassword)) return setErr('Use 8–72 characters with a letter and a number');
    if (f.newPassword !== f.confirm) return setErr('Passwords don’t match');
    setErr(null); setBusy(true);
    try { await changePassword({ currentPassword: f.currentPassword, newPassword: f.newPassword }); setF({ currentPassword: '', newPassword: '', confirm: '' }); toast({ tone: 'success', title: 'Password changed', body: 'Other sessions were signed out.' }); }
    catch (e) { setErr(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <Section icon={<KeyRound size={16} />} title="Password">
      {err && <div className="alert alert-danger">{err}</div>}
      <div className="grid-3">
        <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /></Field>
        <Field label="New password"><input className="input" type="password" autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} /></Field>
        <Field label="Confirm new password"><input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
      </div>
      <div><button className="btn" onClick={save} disabled={busy || !f.currentPassword}>{busy && <Spinner size={14} />}Change password</button></div>
    </Section>
  );
}

function Organization() {
  const user = useAuth((s) => s.user)!;
  const { data: org } = useOrganization();
  const update = useUpdateOrganization();
  const toast = useUi((s) => s.toast);
  const [name, setName] = useState<string | null>(null);
  const [industry, setIndustry] = useState<string | null>(null);
  if (!org) return null;
  const editable = can(user, 'ORG_MANAGE');
  const usage = [['Seats', org.usage.users, org.plan.maxUsers], ['Active projects', org.usage.projects, org.plan.maxProjects], ['Workflows', org.usage.workflows, org.plan.maxWorkflows]] as const;
  return (
    <Section icon={<Building2 size={16} />} title="Organisation">
      <div className="grid-2">
        <Field label="Name"><input className="input" disabled={!editable} value={name ?? org.name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Industry"><input className="input" disabled={!editable} value={industry ?? org.industry ?? ''} onChange={(e) => setIndustry(e.target.value)} /></Field>
      </div>
      <div className="plan-box">
        <div className="spread"><div><div className="tiny subtle">CURRENT PLAN</div><div className="strong">{org.plan.name} · ${org.plan.priceMonthly}/month</div></div><span className="badge badge-accent">{org.plan.code}</span></div>
        <div className="grid-3" style={{ marginTop: 12 }}>
          {usage.map(([label, used, max]) => (
            <div key={label}><div className="spread small"><span className="muted">{label}</span><span>{used}/{max}</span></div><div className="progress" style={{ marginTop: 6 }}><span style={{ width: `${Math.min(100, (used / max) * 100)}%` }} /></div></div>
          ))}
        </div>
      </div>
      {editable && <div><button className="btn btn-primary" disabled={update.isPending} onClick={() => update.mutate({ name: (name ?? org.name).trim(), industry: (industry ?? org.industry ?? '') || undefined }, {
        onSuccess: () => toast({ tone: 'success', title: 'Organisation saved' }), onError: (e) => toast({ tone: 'error', title: 'Couldn’t save', body: errorMessage(e) }),
      })}>Save organisation</button></div>}
    </Section>
  );
}
