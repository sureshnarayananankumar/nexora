import { useMemo, useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GitBranch, MessageSquare, Plus, Search, X } from 'lucide-react';
import { useCreateTask, useMoveTask, useTasks } from '../../api/queries';
import type { ProjectDetail, Task, TaskPriority, TaskStatus } from '../../api/types';
import { PRIORITIES, STATUSES, positionBetween } from '../../lib/format';
import { Avatar, DueBadge, ErrorState, PriorityBadge, Skeleton, errorMessage } from '../../components/ui';
import { NO_USERS, useUi } from '../../stores/ui';

export function BoardTab({ detail, canWrite, onOpen }: { detail: ProjectDetail; canWrite: boolean; onOpen: (taskId: number) => void }) {
  const projectId = detail.project.id;
  const { data: tasks, isLoading, error, refetch } = useTasks(projectId);
  const move = useMoveTask(projectId);
  const toast = useUi((s) => s.toast);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [assignee, setAssignee] = useState<number | 'all' | 'none'>('all');
  const [priority, setPriority] = useState<TaskPriority | 'all'>('all');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtered = useMemo(() => (tasks ?? []).filter((t) =>
    (!q || `${t.key} ${t.title}`.toLowerCase().includes(q.toLowerCase()))
    && (assignee === 'all' || (assignee === 'none' ? !t.assignee : t.assignee?.id === assignee))
    && (priority === 'all' || t.priority === priority)), [tasks, q, assignee, priority]);

  const columns = useMemo(() => {
    const map = new Map<TaskStatus, Task[]>(STATUSES.map((s) => [s.value, []]));
    filtered.forEach((t) => map.get(t.status)!.push(t));
    map.forEach((list) => list.sort((a, b) => a.position - b.position));
    return map;
  }, [filtered]);

  const active = tasks?.find((t) => t.id === activeId) ?? null;

  const onDragStart = (e: DragStartEvent) => setActiveId(Number(e.active.id));

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active: a, over } = e;
    if (!over || !tasks) return;
    const task = tasks.find((t) => t.id === Number(a.id));
    if (!task) return;
    const overId = String(over.id);
    let status: TaskStatus;
    let index: number;
    if (overId.startsWith('col:')) {
      status = overId.slice(4) as TaskStatus;
      index = columns.get(status)!.filter((t) => t.id !== task.id).length;
    } else {
      const overTask = tasks.find((t) => t.id === Number(overId));
      if (!overTask) return;
      status = overTask.status;
      const list = columns.get(status)!.filter((t) => t.id !== task.id);
      index = list.findIndex((t) => t.id === overTask.id);
      // Dropping below the hovered card when moving down within the same column.
      const oldList = columns.get(status)!;
      if (task.status === status && oldList.indexOf(task) < oldList.indexOf(overTask)) index += 1;
    }
    const list = columns.get(status)!.filter((t) => t.id !== task.id);
    const position = positionBetween(list[index - 1]?.position, list[index]?.position);
    if (task.status === status && Math.abs(task.position - position) < 1e-9) return;
    move.mutate({ id: task.id, status, position }, {
      onError: (err) => toast({ tone: 'error', title: 'Move failed', body: errorMessage(err) }),
    });
  };

  if (isLoading) return <div className="board">{STATUSES.map((s) => <div key={s.value} className="board-col"><Skeleton h={300} r={14} /></div>)}</div>;
  if (error) return <ErrorState error={error} retry={refetch} />;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="board-toolbar">
        <div className="input-icon">
          <Search size={15} />
          <input className="input" placeholder="Filter tasks…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter tasks" />
        </div>
        <select className="select" style={{ width: 180 }} value={String(assignee)} onChange={(e) => setAssignee(e.target.value === 'all' || e.target.value === 'none' ? e.target.value : Number(e.target.value))} aria-label="Filter by assignee">
          <option value="all">Everyone</option>
          <option value="none">Unassigned</option>
          {detail.members.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.fullName}</option>)}
        </select>
        <select className="select" style={{ width: 150 }} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority | 'all')} aria-label="Filter by priority">
          <option value="all">Any priority</option>
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {(q || assignee !== 'all' || priority !== 'all') && <button className="btn btn-ghost btn-sm" onClick={() => { setQ(''); setAssignee('all'); setPriority('all'); }}><X /> Clear</button>}
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
        <div className="board">
          {STATUSES.map((s) => (
            <Column key={s.value} status={s.value} label={s.label} color={s.color} tasks={columns.get(s.value)!}
              projectId={projectId} canWrite={canWrite} onOpen={onOpen} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
          {active ? <CardView task={active} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ status, label, color, tasks, projectId, canWrite, onOpen }: {
  status: TaskStatus; label: string; color: string; tasks: Task[]; projectId: number; canWrite: boolean; onOpen: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}`, disabled: !canWrite });
  const [adding, setAdding] = useState(false);
  const points = tasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0);
  return (
    <section className={`board-col ${isOver ? 'over' : ''}`} aria-label={`${label} column`}>
      <header className="board-col-head">
        <span className="col-dot" style={{ background: color }} />
        <span className="strong">{label}</span>
        <span className="count">{tasks.length}</span>
        <span className="grow" />
        <span className="tiny subtle" title="Story points">{points} pts</span>
        {canWrite && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setAdding(true)} aria-label={`Add task to ${label}`}><Plus /></button>}
      </header>
      <div ref={setNodeRef} className="board-col-body">
        {adding && <QuickAdd projectId={projectId} status={status} onDone={() => setAdding(false)} />}
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => <SortableCard key={t.id} task={t} disabled={!canWrite} onOpen={onOpen} />)}
        </SortableContext>
        {tasks.length === 0 && !adding && <div className="col-empty">Drop tasks here</div>}
      </div>
    </section>
  );
}

function SortableCard({ task, disabled, onOpen }: { task: Task; disabled: boolean; onOpen: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes} {...listeners} onClick={() => onOpen(task.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(task.id); listeners?.onKeyDown?.(e); }}>
      <CardView task={task} />
    </div>
  );
}

function CardView({ task, dragging }: { task: Task; dragging?: boolean }) {
  const typing = useUi((s) => s.typing[task.id] ?? NO_USERS);
  return (
    <article className={`task-card ${dragging ? 'dragging' : ''} prio-${task.priority.toLowerCase()}`}>
      <div className="spread">
        <span className="key">{task.key}</span>
        <PriorityBadge priority={task.priority} compact />
      </div>
      <div className="task-title">{task.title}</div>
      {task.status === 'BLOCKED' && task.blockedReason && <div className="blocked-note">⛔ {task.blockedReason}</div>}
      <div className="task-meta">
        <DueBadge date={task.dueDate} done={task.status === 'DONE'} />
        {task.storyPoints != null && <span className="badge" title="Story points">{task.storyPoints}</span>}
        {task.dependsOn.length > 0 && <span className="badge" title="Depends on other tasks"><GitBranch size={11} />{task.dependsOn.length}</span>}
        {task.commentCount > 0 && <span className="badge"><MessageSquare size={11} />{task.commentCount}</span>}
        <span className="grow" />
        {typing.length > 0 && <span className="typing-dots" title={`${typing[0].name} is typing`}><i /><i /><i /></span>}
        <Avatar user={task.assignee} size={24} />
      </div>
    </article>
  );
}

function QuickAdd({ projectId, status, onDone }: { projectId: number; status: TaskStatus; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const create = useCreateTask(projectId);
  const toast = useUi((s) => s.toast);
  const submit = async () => {
    if (!title.trim()) return onDone();
    try {
      await create.mutateAsync({ title: title.trim(), status, priority: 'MEDIUM' });
      setTitle('');
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t create task', body: errorMessage(e) });
    }
  };
  return (
    <div className="task-card quick-add">
      <textarea className="textarea" autoFocus rows={2} placeholder="What needs doing? Enter to add, Esc to close" value={title}
        onChange={(e) => setTitle(e.target.value)} maxLength={200}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); }
          if (e.key === 'Escape') onDone();
        }} style={{ minHeight: 56 }} />
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
        <button className="btn btn-sm" onClick={onDone}>Close</button>
        <button className="btn btn-primary btn-sm" onClick={() => void submit()} disabled={create.isPending}>Add</button>
      </div>
    </div>
  );
}
