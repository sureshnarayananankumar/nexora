import { useState } from 'react';
import { Flag, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeleteMilestone, useSaveMilestone } from '../../api/queries';
import type { MilestoneDto, ProjectDetail } from '../../api/types';
import { ConfirmDialog, EmptyState, Field, Modal, Spinner, errorMessage } from '../../components/ui';
import { dueLabel, fullDay, isoDate } from '../../lib/format';
import { useUi } from '../../stores/ui';

export function MilestonesTab({ detail, canManage }: { detail: ProjectDetail; canManage: boolean }) {
  const [editing, setEditing] = useState<MilestoneDto | 'new' | null>(null);
  const [deleting, setDeleting] = useState<MilestoneDto | null>(null);
  const remove = useDeleteMilestone(detail.project.id);
  const toast = useUi((s) => s.toast);
  return (
    <div className="stack">
      {canManage && <div><button className="btn btn-primary" onClick={() => setEditing('new')}><Plus /> Add milestone</button></div>}
      {detail.milestones.length === 0 && <div className="card"><EmptyState icon={<Flag size={22} />} title="No milestones yet" body="Milestones group tasks around a date and feed the priority recommendations." /></div>}
      <div className="milestone-track">
        {detail.milestones.map((m) => {
          const pct = m.totalTasks ? Math.round((m.doneTasks / m.totalTasks) * 100) : 0;
          const due = dueLabel(m.dueDate, m.completed);
          return (
            <div key={m.id} className={`card milestone ${m.completed ? 'done' : ''}`}>
              <div className="milestone-pin"><Flag size={14} /></div>
              <div className="grow">
                <div className="spread">
                  <h3>{m.name}</h3>
                  <div className="row">
                    {m.completed ? <span className="badge badge-success">Completed</span> : due && <span className={`badge ${due.tone === 'danger' ? 'badge-danger' : due.tone === 'warning' ? 'badge-warning' : ''}`}>{due.text}</span>}
                    {canManage && <>
                      <button className="btn btn-ghost btn-icon btn-sm" aria-label="Edit milestone" onClick={() => setEditing(m)}><Pencil /></button>
                      <button className="btn btn-ghost btn-icon btn-sm" aria-label="Delete milestone" onClick={() => setDeleting(m)}><Trash2 /></button>
                    </>}
                  </div>
                </div>
                {m.description && <p className="small muted" style={{ marginTop: 4 }}>{m.description}</p>}
                <div className="row small muted" style={{ marginTop: 10 }}><span>{fullDay(m.dueDate)}</span><span>·</span><span>{m.doneTasks}/{m.totalTasks} tasks</span></div>
                <div className="progress" style={{ marginTop: 8 }}><span style={{ width: `${pct}%` }} /></div>
              </div>
            </div>
          );
        })}
      </div>
      {editing && <MilestoneModal projectId={detail.project.id} milestone={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {deleting && <ConfirmDialog title={`Delete “${deleting.name}”?`} danger confirmLabel="Delete" busy={remove.isPending}
        body="Tasks in this milestone stay, they just won’t belong to a milestone anymore."
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null), onError: (e) => toast({ tone: 'error', title: 'Couldn’t delete', body: errorMessage(e) }) })} />}
    </div>
  );
}

function MilestoneModal({ projectId, milestone, onClose }: { projectId: number; milestone?: MilestoneDto; onClose: () => void }) {
  const save = useSaveMilestone(projectId);
  const toast = useUi((s) => s.toast);
  const [name, setName] = useState(milestone?.name ?? '');
  const [description, setDescription] = useState(milestone?.description ?? '');
  const [dueDate, setDueDate] = useState(milestone?.dueDate ?? isoDate(new Date()));
  const [completed, setCompleted] = useState(milestone?.completed ?? false);
  const [err, setErr] = useState<string | null>(null);
  const submit = () => {
    if (!name.trim()) return setErr('Give the milestone a name');
    if (!dueDate) return setErr('Pick a due date');
    save.mutate({ id: milestone?.id, name: name.trim(), description: description || undefined, dueDate, completed }, {
      onSuccess: () => { toast({ tone: 'success', title: milestone ? 'Milestone updated' : 'Milestone added' }); onClose(); },
      onError: (e) => setErr(errorMessage(e)),
    });
  };
  return (
    <Modal title={milestone ? 'Edit milestone' : 'New milestone'} onClose={onClose} width={480} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={submit} disabled={save.isPending}>{save.isPending && <Spinner size={14} />}Save</button>
    </>}>
      <div className="stack">
        {err && <div className="alert alert-danger">{err}</div>}
        <Field label="Name" htmlFor="mname"><input id="mname" className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Description" htmlFor="mdesc"><textarea id="mdesc" className="textarea" rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label="Due date" htmlFor="mdue"><input id="mdue" type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
        <label className="checkbox"><input type="checkbox" checked={completed} onChange={(e) => setCompleted(e.target.checked)} /> Completed</label>
      </div>
    </Modal>
  );
}
