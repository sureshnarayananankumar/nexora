import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useCreateProject, useTeam, useUpdateProject } from '../api/queries';
import type { ProjectSummary } from '../api/types';
import { errorMessage, Field, Modal, Spinner } from '../components/ui';
import { useUi } from '../stores/ui';
import { isoDate } from '../lib/format';

const COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

const schema = z.object({
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9]{1,5}$/, '2–6 letters/digits, starting with a letter'),
  name: z.string().trim().min(2, 'At least 2 characters').max(120),
  description: z.string().max(4000).optional(),
  color: z.string(),
  status: z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']),
  startDate: z.string().min(1, 'Pick a start date'),
  dueDate: z.string().optional(),
  memberIds: z.array(z.number()),
}).refine((v) => !v.dueDate || v.dueDate >= v.startDate, { path: ['dueDate'], message: 'Due date must be after the start date' });

type FormValues = z.infer<typeof schema>;

export function ProjectFormModal({ project, onClose }: { project?: ProjectSummary; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useUi((s) => s.toast);
  const team = useTeam();
  const create = useCreateProject();
  const update = useUpdateProject(project?.id ?? 0);
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      key: project?.key ?? '', name: project?.name ?? '', description: project?.description ?? '', color: project?.color ?? COLORS[0],
      status: project?.status ?? 'ACTIVE', startDate: project?.startDate ?? isoDate(new Date()), dueDate: project?.dueDate ?? '', memberIds: [],
    },
  });
  const color = watch('color');
  const memberIds = watch('memberIds');

  const onSubmit = handleSubmit(async (v) => {
    try {
      const input = { ...v, key: v.key.toUpperCase(), dueDate: v.dueDate || null };
      if (project) {
        await update.mutateAsync(input);
        toast({ tone: 'success', title: 'Project updated' });
        onClose();
      } else {
        const d = await create.mutateAsync(input);
        toast({ tone: 'success', title: `${d.project.name} created`, body: 'Add tasks or set up an automation next.' });
        onClose();
        navigate(`/projects/${d.project.id}/board`);
      }
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t save the project', body: errorMessage(e) });
    }
  });

  return (
    <Modal title={project ? 'Project settings' : 'New project'} onClose={onClose} width={620} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn btn-primary" onClick={onSubmit} disabled={isSubmitting}>{isSubmitting && <Spinner size={14} />}{project ? 'Save changes' : 'Create project'}</button>
    </>}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="grid-2" style={{ gridTemplateColumns: '120px 1fr' }}>
          <Field label="Key" error={errors.key?.message} htmlFor="pkey">
            <input id="pkey" className="input mono" maxLength={6} disabled={!!project} style={{ textTransform: 'uppercase' }} aria-invalid={!!errors.key} {...register('key')} />
          </Field>
          <Field label="Name" error={errors.name?.message} htmlFor="pname">
            <input id="pname" className="input" aria-invalid={!!errors.name} {...register('name')} />
          </Field>
        </div>
        <Field label="Description" error={errors.description?.message} htmlFor="pdesc">
          <textarea id="pdesc" className="textarea" rows={3} {...register('description')} />
        </Field>
        <div className="grid-3">
          <Field label="Start date" error={errors.startDate?.message} htmlFor="pstart"><input id="pstart" type="date" className="input" {...register('startDate')} /></Field>
          <Field label="Due date" error={errors.dueDate?.message} htmlFor="pdue"><input id="pdue" type="date" className="input" aria-invalid={!!errors.dueDate} {...register('dueDate')} /></Field>
          {project ? (
            <Field label="Status" htmlFor="pstatus">
              <select id="pstatus" className="select" {...register('status')}>
                <option value="ACTIVE">Active</option><option value="ON_HOLD">On hold</option><option value="COMPLETED">Completed</option><option value="ARCHIVED">Archived</option>
              </select>
            </Field>
          ) : <div />}
        </div>
        <div className="field">
          <span className="label">Colour</span>
          <div className="row">
            {COLORS.map((c) => (
              <button key={c} type="button" className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} aria-label={`Colour ${c}`} onClick={() => setValue('color', c)} />
            ))}
          </div>
        </div>
        {!project && (
          <div className="field">
            <span className="label">Members</span>
            <div className="chip-picker">
              {(team.data ?? []).filter((m) => m.status === 'ACTIVE').map((m) => {
                const on = memberIds.includes(m.id);
                return (
                  <button type="button" key={m.id} className={`chip ${on ? 'on' : ''}`}
                    onClick={() => setValue('memberIds', on ? memberIds.filter((x) => x !== m.id) : [...memberIds, m.id])}>
                    <span className="avatar" style={{ ['--size' as string]: '18px', background: m.avatarColor }}>{m.fullName[0]}</span>{m.fullName}
                  </button>
                );
              })}
            </div>
            <span className="field-hint">You’re added as the owner automatically.</span>
          </div>
        )}
      </form>
    </Modal>
  );
}
