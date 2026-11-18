import { useState } from 'react';
import { Copy, Pencil, UserPlus, Users } from 'lucide-react';
import { useInvite, useOrganization, useTeam, useUpdateMember } from '../api/queries';
import type { TeamMember } from '../api/types';
import { useAuth, can } from '../stores/auth';
import { useUi } from '../stores/ui';
import { Avatar, EmptyState, ErrorState, Field, Modal, Skeleton, Spinner, errorMessage } from '../components/ui';
import { ago } from '../lib/format';

const ROLES = [['ORG_ADMIN', 'Org admin'], ['MANAGER', 'Manager'], ['MEMBER', 'Member']] as const;

export default function TeamPage() {
  const me = useAuth((s) => s.user)!;
  const manage = can(me, 'USER_MANAGE');
  const { data, isLoading, error, refetch } = useTeam();
  const { data: org } = useOrganization();
  const online = new Set(useUi((s) => s.orgOnline).map((u) => u.id));
  const [inviting, setInviting] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const totals = (data ?? []).filter((m) => m.status === 'ACTIVE').reduce((a, m) => ({ cap: a.cap + m.capacityPoints, load: a.load + m.openPoints }), { cap: 0, load: 0 });
  const atLimit = org ? org.usage.users >= org.plan.maxUsers : false;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Team &amp; workload</h1>
          <p className="muted">{data?.length ?? 0} people · {totals.load}/{totals.cap} points of weekly capacity in use{org && <span className="subtle"> · {org.usage.users}/{org.plan.maxUsers} seats</span>}</p>
        </div>
        {manage && <button className="btn btn-primary" disabled={atLimit} title={atLimit ? 'Seat limit reached' : undefined} onClick={() => setInviting(true)}><UserPlus /> Add teammate</button>}
      </div>
      {isLoading && <Skeleton h={300} r={16} />}
      {error && <ErrorState error={error} retry={refetch} />}
      {data?.length === 0 && <EmptyState icon={<Users size={22} />} title="Just you so far" />}
      {data && data.length > 0 && (
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Person</th><th>Role</th><th style={{ width: '32%' }}>Workload</th><th>Last active</th>{manage && <th />}</tr></thead>
            <tbody>
              {data.map((m) => {
                const util = Math.round((m.openPoints / Math.max(m.capacityPoints, 1)) * 100);
                const state = util > 100 ? 'overloaded' : util >= 60 ? 'balanced' : 'available';
                return (
                  <tr key={m.id} style={m.status === 'SUSPENDED' ? { opacity: 0.55 } : undefined}>
                    <td>
                      <div className="row-3">
                        <Avatar user={m} size={34} online={online.has(m.id)} />
                        <div style={{ minWidth: 0 }}>
                          <div className="strong">{m.fullName} {m.id === me.id && <span className="badge">You</span>}</div>
                          <div className="tiny subtle">{m.jobTitle ?? '—'} · {m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-accent">{m.role.replace('_', ' ').toLowerCase()}</span>{m.status === 'SUSPENDED' && <span className="badge badge-danger" style={{ marginLeft: 6 }}>suspended</span>}</td>
                    <td>
                      <div className="spread tiny"><span className="muted">{m.openTasks} tasks · {m.openPoints}/{m.capacityPoints} pts</span><span className={state === 'overloaded' ? 'danger-text strong' : 'muted'}>{util}%</span></div>
                      <div className="load-bar"><span className={`load-${state}`} style={{ width: `${Math.min(util, 150) / 1.5}%` }} /><i style={{ left: `${100 / 1.5}%` }} /></div>
                    </td>
                    <td className="small muted">{online.has(m.id) ? <span className="success-text">Online now</span> : m.lastLoginAt ? ago(m.lastLoginAt) : 'Never'}</td>
                    {manage && <td style={{ textAlign: 'right' }}>{m.role !== 'SUPER_ADMIN' && <button className="btn btn-ghost btn-sm" onClick={() => setEditing(m)}><Pencil /> Edit</button>}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {inviting && <InviteModal onClose={() => setInviting(false)} />}
      {editing && <EditMemberModal member={editing} self={editing.id === me.id} onClose={() => setEditing(null)} />}
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const invite = useInvite();
  const toast = useUi((s) => s.toast);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'MEMBER', jobTitle: '' });
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ name: string; email: string; password: string } | null>(null);
  const submit = () => {
    if (form.fullName.trim().length < 2) return setErr('Enter their full name');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setErr('Enter a valid email');
    setErr(null);
    invite.mutate({ ...form, jobTitle: form.jobTitle || undefined }, {
      onSuccess: (r) => setCreated({ name: r.member.fullName, email: r.member.email, password: r.temporaryPassword }),
      onError: (e) => setErr(errorMessage(e)),
    });
  };
  if (created) {
    return (
      <Modal title="Teammate added" onClose={onClose} width={480} footer={<button className="btn btn-primary" onClick={onClose}>Done</button>}>
        <div className="stack">
          <p className="muted">Share these sign-in details with {created.name} privately. The temporary password is shown only once; they can change it under Settings.</p>
          <div className="secret-box">
            <div><span className="tiny subtle">EMAIL</span><div className="mono">{created.email}</div></div>
            <div><span className="tiny subtle">TEMPORARY PASSWORD</span><div className="mono">{created.password}</div></div>
            <button className="btn btn-sm" onClick={() => { void navigator.clipboard?.writeText(`${created.email}\n${created.password}`); toast({ tone: 'success', title: 'Copied to clipboard' }); }}><Copy /> Copy</button>
          </div>
        </div>
      </Modal>
    );
  }
  return (
    <Modal title="Add a teammate" onClose={onClose} width={520} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit} disabled={invite.isPending}>{invite.isPending && <Spinner size={14} />}Add teammate</button>
    </>}>
      <div className="stack">
        {err && <div className="alert alert-danger" role="alert">{err}</div>}
        <div className="grid-2">
          <Field label="Full name" htmlFor="ifn"><input id="ifn" className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
          <Field label="Job title" htmlFor="ijt"><input id="ijt" className="input" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></Field>
        </div>
        <Field label="Work email" htmlFor="iem"><input id="iem" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Role" htmlFor="irole" hint="Managers can create projects and workflows. Members work on tasks.">
          <select id="irole" className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Field>
      </div>
    </Modal>
  );
}

function EditMemberModal({ member, self, onClose }: { member: TeamMember; self: boolean; onClose: () => void }) {
  const update = useUpdateMember();
  const toast = useUi((s) => s.toast);
  const [role, setRole] = useState(member.role);
  const [status, setStatus] = useState(member.status);
  const [capacity, setCapacity] = useState(member.capacityPoints);
  const [jobTitle, setJobTitle] = useState(member.jobTitle ?? '');
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    if (capacity < 1 || capacity > 200) return setErr('Capacity must be between 1 and 200 points');
    update.mutate({ id: member.id, role, status, capacityPoints: capacity, jobTitle: jobTitle || undefined }, {
      onSuccess: () => { toast({ tone: 'success', title: `${member.fullName} updated` }); onClose(); },
      onError: (e) => setErr(errorMessage(e)),
    });
  };
  return (
    <Modal title={`Edit ${member.fullName}`} onClose={onClose} width={480} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit} disabled={update.isPending}>{update.isPending && <Spinner size={14} />}Save</button>
    </>}>
      <div className="stack">
        {err && <div className="alert alert-danger" role="alert">{err}</div>}
        <Field label="Job title"><input className="input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} /></Field>
        <div className="grid-2">
          <Field label="Role" hint={self ? 'You can’t change your own role' : undefined}>
            <select className="select" value={role} disabled={self} onChange={(e) => setRole(e.target.value)}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
          </Field>
          <Field label="Status">
            <select className="select" value={status} disabled={self} onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'SUSPENDED')}><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option></select>
          </Field>
        </div>
        <Field label="Weekly capacity (story points)" hint="Used by workload balancing and the health score">
          <input className="input" type="number" min={1} max={200} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
        </Field>
      </div>
    </Modal>
  );
}
