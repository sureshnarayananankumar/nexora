import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateTask } from '../../api/queries';
import type { ProjectDetail } from '../../api/types';
import { Field, Modal, Spinner, errorMessage } from '../../components/ui';
import { PRIORITIES, STATUSES } from '../../lib/format';
import { useUi } from '../../stores/ui';

const schema = z.object({
  title: z.string().trim().min(1, 'Give the task a title').max(200),
  description: z.string().max(10000),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  assigneeId: z.string(),
  milestoneId: z.string(),
  storyPoints: z.string().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 100), '0–100'),
  dueDate: z.string(),
});

export function NewTaskModal({ detail, onClose, onCreated }: { detail: ProjectDetail; onClose: () => void; onCreated: (id: number) => void }) {
  const create = useCreateTask(detail.project.id);
  const toast = useUi((s) => s.toast);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', status: 'TODO', priority: 'MEDIUM', assigneeId: '', milestoneId: '', storyPoints: '', dueDate: '' },
  });
  const onSubmit = handleSubmit(async (v) => {
    try {
      const t = await create.mutateAsync({
        title: v.title, description: v.description || undefined, status: v.status, priority: v.priority,
        assigneeId: v.assigneeId ? Number(v.assigneeId) : null, milestoneId: v.milestoneId ? Number(v.milestoneId) : null,
        storyPoints: v.storyPoints === '' ? null : Number(v.storyPoints), dueDate: v.dueDate || null,
      });
      toast({ tone: 'success', title: `${t.key} created` });
      onCreated(t.id);
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t create task', body: errorMessage(e) });
    }
  });
  return (
    <Modal title={`New task in ${detail.project.name}`} onClose={onClose} width={620} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={onSubmit} disabled={isSubmitting}>{isSubmitting && <Spinner size={14} />}Create task</button>
    </>}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Field label="Title" error={errors.title?.message} htmlFor="ttitle"><input id="ttitle" className="input" autoFocus aria-invalid={!!errors.title} {...register('title')} /></Field>
        <Field label="Description" htmlFor="tdesc"><textarea id="tdesc" className="textarea" rows={3} {...register('description')} /></Field>
        <div className="grid-3">
          <Field label="Status" htmlFor="tstatus"><select id="tstatus" className="select" {...register('status')}>{STATUSES.filter((s) => s.value !== 'BLOCKED').map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
          <Field label="Priority" htmlFor="tprio"><select id="tprio" className="select" {...register('priority')}>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Field>
          <Field label="Story points" error={errors.storyPoints?.message} htmlFor="tpts"><input id="tpts" className="input" inputMode="numeric" {...register('storyPoints')} /></Field>
        </div>
        <div className="grid-3">
          <Field label="Assignee" hint="Leave empty to let automations decide" htmlFor="tassignee">
            <select id="tassignee" className="select" {...register('assigneeId')}>
              <option value="">Unassigned</option>
              {detail.members.filter((m) => m.projectRole !== 'VIEWER').map((m) => <option key={m.user.id} value={m.user.id}>{m.user.fullName}</option>)}
            </select>
          </Field>
          <Field label="Due date" htmlFor="tdue"><input id="tdue" type="date" className="input" {...register('dueDate')} /></Field>
          <Field label="Milestone" htmlFor="tms">
            <select id="tms" className="select" {...register('milestoneId')}>
              <option value="">None</option>
              {detail.milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}
