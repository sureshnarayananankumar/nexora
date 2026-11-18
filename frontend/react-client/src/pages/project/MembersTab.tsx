import { useState } from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import { useProjectMembers, useTeam } from '../../api/queries';
import type { ProjectDetail, ProjectRole } from '../../api/types';
import { Avatar, ConfirmDialog, errorMessage } from '../../components/ui';
import { ago } from '../../lib/format';
import { useUi } from '../../stores/ui';

export function MembersTab({ detail, canManage }: { detail: ProjectDetail; canManage: boolean }) {
  const { add, update, remove } = useProjectMembers(detail.project.id);
  const team = useTeam();
  const toast = useUi((s) => s.toast);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<ProjectRole>('CONTRIBUTOR');
  const [removing, setRemoving] = useState<{ id: number; name: string } | null>(null);
  const memberIds = new Set(detail.members.map((m) => m.user.id));
  const candidates = (team.data ?? []).filter((u) => !memberIds.has(u.id) && u.status === 'ACTIVE');
  const fail = (title: string) => (e: unknown) => toast({ tone: 'error', title, body: errorMessage(e) });

  return (
    <div className="stack">
      {canManage && (
        <div className="card card-pad row wrap">
          <UserPlus size={18} className="subtle" />
          <select className="select" style={{ maxWidth: 260 }} value={userId} onChange={(e) => setUserId(e.target.value)} aria-label="Person to add">
            <option value="">Add someone from your organisation…</option>
            {candidates.map((u) => <option key={u.id} value={u.id}>{u.fullName} · {u.jobTitle ?? u.role}</option>)}
          </select>
          <select className="select" style={{ maxWidth: 160 }} value={role} onChange={(e) => setRole(e.target.value as ProjectRole)} aria-label="Project role">
            <option value="CONTRIBUTOR">Contributor</option><option value="VIEWER">Viewer</option><option value="OWNER">Owner</option>
          </select>
          <button className="btn btn-primary" disabled={!userId || add.isPending}
            onClick={() => add.mutate({ userId: Number(userId), projectRole: role }, { onSuccess: () => { setUserId(''); toast({ tone: 'success', title: 'Member added' }); }, onError: fail('Couldn’t add member') })}>Add</button>
        </div>
      )}
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Member</th><th>Project role</th><th>Capacity</th><th>Joined</th>{canManage && <th />}</tr></thead>
          <tbody>
            {detail.members.map((m) => (
              <tr key={m.user.id}>
                <td><div className="row"><Avatar user={m.user} size={30} /><div><div className="strong">{m.user.fullName}</div><div className="tiny subtle">{m.user.email}</div></div></div></td>
                <td>
                  {canManage && m.user.id !== detail.project.owner.id ? (
                    <select className="select" style={{ width: 150, height: 32 }} value={m.projectRole} aria-label={`Role for ${m.user.fullName}`}
                      onChange={(e) => update.mutate({ userId: m.user.id, projectRole: e.target.value as ProjectRole }, { onError: fail('Couldn’t change role') })}>
                      <option value="OWNER">Owner</option><option value="CONTRIBUTOR">Contributor</option><option value="VIEWER">Viewer</option>
                    </select>
                  ) : <span className="badge badge-accent">{m.projectRole.toLowerCase()}</span>}
                </td>
                <td className="muted">{m.capacityPoints} pts/week</td>
                <td className="muted small">{ago(m.joinedAt)}</td>
                {canManage && <td style={{ textAlign: 'right' }}>{m.user.id !== detail.project.owner.id &&
                  <button className="btn btn-ghost btn-sm" onClick={() => setRemoving({ id: m.user.id, name: m.user.fullName })}><UserMinus /> Remove</button>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {removing && <ConfirmDialog title={`Remove ${removing.name}?`} danger confirmLabel="Remove" busy={remove.isPending}
        body="Their open tasks in this project will become unassigned."
        onClose={() => setRemoving(null)}
        onConfirm={() => remove.mutate(removing.id, { onSuccess: () => setRemoving(null), onError: fail('Couldn’t remove member') })} />}
    </div>
  );
}
