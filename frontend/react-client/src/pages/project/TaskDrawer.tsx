import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send, Trash2, X, Zap } from 'lucide-react';
import { useAddComment, useComments, useDeleteComment, useDeleteTask, useTask, useTasks, useUpdateTask } from '../../api/queries';
import type { ProjectDetail, Task } from '../../api/types';
import { ago, PRIORITIES, STATUSES } from '../../lib/format';
import { Avatar, ConfirmDialog, Drawer, ErrorState, Field, PageLoader, Spinner, StatusBadge, errorMessage } from '../../components/ui';
import { ActivityFeed } from '../../features/ActivityFeed';
import { useSocket } from '../../hooks/realtime';
import { useAuth } from '../../stores/auth';
import { NO_USERS, useUi } from '../../stores/ui';

const schema = z.object({
  title: z.string().trim().min(1, 'Give the task a title').max(200),
  description: z.string().max(10000).optional(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  assigneeId: z.string(),
  milestoneId: z.string(),
  storyPoints: z.string().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= 100), '0–100'),
  dueDate: z.string(),
  blockedReason: z.string().max(255),
  dependsOn: z.array(z.number()),
}).refine((v) => v.status !== 'BLOCKED' || v.blockedReason.trim().length > 0, { path: ['blockedReason'], message: 'Say what is blocking this task' });

type FormValues = z.infer<typeof schema>;

const toForm = (t: Task): FormValues => ({
  title: t.title, description: t.description ?? '', status: t.status, priority: t.priority,
  assigneeId: t.assignee ? String(t.assignee.id) : '', milestoneId: t.milestoneId ? String(t.milestoneId) : '',
  storyPoints: t.storyPoints != null ? String(t.storyPoints) : '', dueDate: t.dueDate ?? '', blockedReason: t.blockedReason ?? '', dependsOn: t.dependsOn,
});

export function TaskDrawer({ taskId, detail, canWrite, onClose }: { taskId: number; detail: ProjectDetail; canWrite: boolean; onClose: () => void }) {
  const { data: task, isLoading, error } = useTask(taskId);
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');
  return (
    <Drawer onClose={onClose}>
      <div className="drawer-head">
        <span className="key">{task?.key}</span>
        {task && <StatusBadge status={task.status} />}
        <span className="grow" />
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X /></button>
      </div>
      <div className="drawer-body">
        {isLoading && <PageLoader />}
        {error && <ErrorState error={error} />}
        {task && <TaskForm key={task.id} task={task} detail={detail} canWrite={canWrite} onDeleted={onClose} />}
        {task && (
          <>
            <div className="tabs" style={{ marginTop: 24 }}>
              <button className={`tab ${tab === 'comments' ? 'active' : ''}`} onClick={() => setTab('comments')}>Comments</button>
              <button className={`tab ${tab === 'activity' ? 'active' : ''}`} onClick={() => setTab('activity')}>Activity</button>
            </div>
            {tab === 'comments' ? <Comments task={task} /> : <ActivityFeed projectId={task.projectId} taskId={task.id} compact />}
          </>
        )}
      </div>
    </Drawer>
  );
}

function TaskForm({ task, detail, canWrite, onDeleted }: { task: Task; detail: ProjectDetail; canWrite: boolean; onDeleted: () => void }) {
  const update = useUpdateTask();
  const remove = useDeleteTask(task.projectId);
  const { data: allTasks } = useTasks(task.projectId);
  const toast = useUi((s) => s.toast);
  const [confirm, setConfirm] = useState(false);
  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isDirty, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema), defaultValues: toForm(task),
  });
  const status = watch('status');
  const deps = watch('dependsOn');
  const [stale, setStale] = useState(false);
  const loadedVersion = useRef(task.version);

  // Live updates: refresh the form when someone else saves, unless the user has unsaved edits.
  useEffect(() => {
    if (task.version === loadedVersion.current) return;
    if (isDirty) setStale(true);
    else { reset(toForm(task)); loadedVersion.current = task.version; }
  }, [task, isDirty, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      const saved = await update.mutateAsync({
        id: task.id, version: loadedVersion.current, title: v.title, description: v.description || undefined, status: v.status, priority: v.priority,
        assigneeId: v.assigneeId ? Number(v.assigneeId) : null, milestoneId: v.milestoneId ? Number(v.milestoneId) : null,
        storyPoints: v.storyPoints === '' ? null : Number(v.storyPoints), dueDate: v.dueDate || null,
        blockedReason: v.status === 'BLOCKED' ? v.blockedReason : null, dependsOn: v.dependsOn,
      });
      loadedVersion.current = saved.version;
      setStale(false);
      reset(toForm(saved));
      toast({ tone: 'success', title: `${saved.key} saved` });
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t save the task', body: errorMessage(e) });
    }
  });

  const candidates = (allTasks ?? []).filter((t) => t.id !== task.id && !deps.includes(t.id));

  return (
    <form onSubmit={onSubmit} noValidate className="stack">
      {stale && (
        <div className="alert alert-warning">
          <span className="grow">Someone else just updated this task.</span>
          <button type="button" className="btn btn-sm" onClick={() => { reset(toForm(task)); loadedVersion.current = task.version; setStale(false); }}>Load their changes</button>
        </div>
      )}
      <textarea className="title-input" rows={1} disabled={!canWrite} aria-label="Title" {...register('title')} />
      {errors.title && <span className="field-error">{errors.title.message}</span>}
      <div className="prop-grid">
        <label>Status</label>
        <select className="select" disabled={!canWrite} {...register('status')}>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
        <label>Priority</label>
        <select className="select" disabled={!canWrite} {...register('priority')}>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
        <label>Assignee</label>
        <select className="select" disabled={!canWrite} {...register('assigneeId')}>
          <option value="">Unassigned</option>
          {detail.members.filter((m) => m.projectRole !== 'VIEWER').map((m) => <option key={m.user.id} value={m.user.id}>{m.user.fullName}</option>)}
        </select>
        <label>Due date</label>
        <input type="date" className="input" disabled={!canWrite} {...register('dueDate')} />
        <label>Story points</label>
        <div>
          <input className="input" inputMode="numeric" disabled={!canWrite} aria-invalid={!!errors.storyPoints} {...register('storyPoints')} />
          {errors.storyPoints && <span className="field-error">{errors.storyPoints.message}</span>}
        </div>
        <label>Milestone</label>
        <select className="select" disabled={!canWrite} {...register('milestoneId')}>
          <option value="">None</option>
          {detail.milestones.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {status === 'BLOCKED' && (<>
          <label>Blocked by</label>
          <div>
            <input className="input" placeholder="What is blocking this?" disabled={!canWrite} aria-invalid={!!errors.blockedReason} {...register('blockedReason')} />
            {errors.blockedReason && <span className="field-error">{errors.blockedReason.message}</span>}
          </div>
        </>)}
        <label>Depends on</label>
        <div className="col">
          <div className="row wrap">
            {deps.map((id) => {
              const d = allTasks?.find((t) => t.id === id);
              return (
                <span key={id} className="chip on">{d?.key ?? `#${id}`}{canWrite && <button type="button" className="chip-x" aria-label="Remove dependency" onClick={() => setValue('dependsOn', deps.filter((x) => x !== id), { shouldDirty: true })}><X size={12} /></button>}</span>
              );
            })}
            {deps.length === 0 && <span className="small subtle">Nothing</span>}
          </div>
          {canWrite && candidates.length > 0 && (
            <select className="select" value="" onChange={(e) => e.target.value && setValue('dependsOn', [...deps, Number(e.target.value)], { shouldDirty: true })} aria-label="Add dependency">
              <option value="">Add a dependency…</option>
              {candidates.map((t) => <option key={t.id} value={t.id}>{t.key} · {t.title}</option>)}
            </select>
          )}
        </div>
      </div>
      <Field label="Description">
        <textarea className="textarea" rows={5} disabled={!canWrite} placeholder="Add context, acceptance criteria or links…" {...register('description')} />
      </Field>
      <div className="small subtle">Reported by {task.reporter?.fullName ?? 'unknown'} · created {ago(task.createdAt)} · updated {ago(task.updatedAt)}</div>
      {canWrite && (
        <div className="spread">
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirm(true)}><Trash2 /> Delete</button>
          <div className="row">
            {isDirty && <button type="button" className="btn" onClick={() => reset(toForm(task))}>Discard</button>}
            <button className="btn btn-primary" disabled={!isDirty || isSubmitting}>{isSubmitting && <Spinner size={14} />}Save changes</button>
          </div>
        </div>
      )}
      {confirm && (
        <ConfirmDialog title={`Delete ${task.key}?`} danger confirmLabel="Delete task" busy={remove.isPending}
          body="This removes the task, its comments and dependencies. It can’t be undone."
          onClose={() => setConfirm(false)}
          onConfirm={async () => {
            try { await remove.mutateAsync(task.id); toast({ tone: 'success', title: `${task.key} deleted` }); onDeleted(); }
            catch (e) { toast({ tone: 'error', title: 'Couldn’t delete', body: errorMessage(e) }); }
          }} />
      )}
    </form>
  );
}

function Comments({ task }: { task: Task }) {
  const me = useAuth((s) => s.user)!;
  const { data, isLoading, error } = useComments(task.id);
  const add = useAddComment(task.id);
  const remove = useDeleteComment(task.id);
  const socket = useSocket();
  const typingAll = useUi((s) => s.typing[task.id] ?? NO_USERS);
  const typing = typingAll.filter((u) => u.id !== me.id);
  const toast = useUi((s) => s.toast);
  const [body, setBody] = useState('');
  const typingTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const endRef = useRef<HTMLDivElement>(null);

  // Scroll to new comments as they arrive, but not on first load (that would jump the drawer to the bottom).
  const seen = useRef<number | null>(null);
  useEffect(() => {
    const n = data?.length;
    if (n === undefined) return;
    if (seen.current !== null && n > seen.current) endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    seen.current = n;
  }, [data?.length]);

  const sendTyping = (isTyping: boolean) => socket?.emit('typing', { projectId: task.projectId, taskId: task.id, typing: isTyping });
  const onChange = (v: string) => {
    setBody(v);
    if (!typingTimer.current) sendTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { sendTyping(false); typingTimer.current = undefined; }, 2500);
  };

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    try {
      await add.mutateAsync(text);
      setBody('');
      clearTimeout(typingTimer.current);
      typingTimer.current = undefined;
      sendTyping(false);
    } catch (e) {
      toast({ tone: 'error', title: 'Comment not posted', body: errorMessage(e) });
    }
  };

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorState error={error} />;
  return (
    <div className="stack">
      {data?.length === 0 && <p className="small subtle">No comments yet. Start the conversation.</p>}
      {data?.map((c) => (
        <div key={c.id} className={`comment ${c.automated ? 'automated' : ''}`}>
          {c.automated ? <span className="auto-avatar"><Zap size={13} /></span> : <Avatar user={c.author} size={28} />}
          <div className="grow">
            <div className="row small"><span className="strong">{c.automated ? 'Automation' : c.author?.fullName}</span><span className="subtle">{ago(c.createdAt)}</span>
              {(c.author?.id === me.id && !c.automated) && <button className="btn btn-ghost btn-icon btn-sm" style={{ marginLeft: 'auto' }} aria-label="Delete comment" onClick={() => remove.mutate(c.id)}><Trash2 size={13} /></button>}
            </div>
            <div className="comment-body">{c.body}</div>
          </div>
        </div>
      ))}
      <div ref={endRef} />
      <div className="typing-line" aria-live="polite">{typing.length > 0 && <><span className="typing-dots"><i /><i /><i /></span>{typing.map((u) => u.name).join(', ')} {typing.length === 1 ? 'is' : 'are'} typing…</>}</div>
      <div className="comment-box">
        <textarea className="textarea" rows={2} placeholder="Write a comment… (⌘/Ctrl + Enter to send)" value={body} maxLength={5000}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(); } }} />
        <button className="btn btn-primary btn-icon" onClick={() => void submit()} disabled={!body.trim() || add.isPending} aria-label="Send comment"><Send /></button>
      </div>
    </div>
  );
}
