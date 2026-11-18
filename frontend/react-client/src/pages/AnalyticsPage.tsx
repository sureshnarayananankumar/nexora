import { useMemo, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, GripVertical, LayoutGrid, Settings2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { updatePreferences, useAnalytics, usePortfolio, useProjects } from '../api/queries';
import type { AnalyticsOverview } from '../api/types';
import { useAuth } from '../stores/auth';
import { useUi } from '../stores/ui';
import { Avatar, ErrorState, HealthRing, Skeleton, Spinner, errorMessage } from '../components/ui';
import { PRIORITIES, STATUSES, riskTone } from '../lib/format';

const WIDGETS: Record<string, { title: string; wide?: boolean }> = {
  throughput: { title: 'Weekly throughput', wide: true },
  status: { title: 'Status distribution' },
  priority: { title: 'Open work by priority' },
  workload: { title: 'Team utilisation', wide: true },
  health: { title: 'Project health' },
  cycleTime: { title: 'Flow metrics' },
  createdVsCompleted: { title: 'Created vs completed', wide: true },
  topContributors: { title: 'Top contributors (30 days)' },
};
const DEFAULT_LAYOUT = ['throughput', 'status', 'workload', 'health', 'priority', 'topContributors'];

const tooltipStyle = { background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10, color: 'var(--text)', fontSize: 12 };

export default function AnalyticsPage() {
  const user = useAuth((s) => s.user)!;
  const toast = useUi((s) => s.toast);
  const [projectId, setProjectId] = useState<number | undefined>();
  const { data, isLoading, error, refetch } = useAnalytics(projectId);
  const { data: projects } = useProjects();
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<string[]>(() => (user.dashboardLayout?.length ? user.dashboardLayout : DEFAULT_LAYOUT).filter((w) => WIDGETS[w]));
  const [saving, setSaving] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    setLayout((l) => arrayMove(l, l.indexOf(String(e.active.id)), l.indexOf(String(e.over!.id))));
  };

  const saveLayout = async () => {
    setSaving(true);
    try {
      const me = await updatePreferences({ theme: user.theme, dashboardLayout: layout });
      useAuth.getState().setUser(me);
      setEditing(false);
      toast({ tone: 'success', title: 'Dashboard saved', body: 'Your layout follows you to any device.' });
    } catch (e) {
      toast({ tone: 'error', title: 'Couldn’t save layout', body: errorMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Analytics</h1><p className="muted">Delivery metrics across your projects. Drag widgets to arrange your dashboard.</p></div>
        <div className="row">
          <select className="select" style={{ width: 220 }} value={projectId ?? ''} onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : undefined)} aria-label="Project">
            <option value="">All my projects</option>
            {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {editing
            ? <button className="btn btn-primary" onClick={saveLayout} disabled={saving}>{saving ? <Spinner size={14} /> : <Check />} Save layout</button>
            : <button className="btn" onClick={() => setEditing(true)}><Settings2 /> Customize</button>}
        </div>
      </div>
      {editing && (
        <div className="card card-pad widget-picker">
          <LayoutGrid size={16} className="subtle" />
          {Object.entries(WIDGETS).map(([id, w]) => (
            <label key={id} className="checkbox">
              <input type="checkbox" checked={layout.includes(id)} onChange={(e) => setLayout((l) => (e.target.checked ? [...l, id] : l.filter((x) => x !== id)))} />
              {w.title}
            </label>
          ))}
        </div>
      )}
      {error && <ErrorState error={error} retry={refetch} />}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={layout} strategy={rectSortingStrategy}>
          <div className="widget-grid">
            {layout.map((id) => (
              <Widget key={id} id={id} editing={editing}>
                {isLoading || !data ? <Skeleton h={220} /> : <WidgetBody id={id} data={data} />}
              </Widget>
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {layout.length === 0 && <div className="card card-pad muted">All widgets are hidden. Choose some in Customize.</div>}
    </div>
  );
}

function Widget({ id, editing, children }: { id: string; editing: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const w = WIDGETS[id];
  return (
    <section ref={setNodeRef} className={`card widget ${w.wide ? 'wide' : ''} ${isDragging ? 'dragging' : ''} ${editing ? 'editing' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div className="card-header">
        <h3>{w.title}</h3>
        <button className="btn btn-ghost btn-icon btn-sm drag-handle" aria-label={`Move ${w.title}`} {...attributes} {...listeners}><GripVertical /></button>
      </div>
      <div className="card-body">{children}</div>
    </section>
  );
}

function WidgetBody({ id, data }: { id: string; data: AnalyticsOverview }) {
  const weeks = useMemo(() => data.throughput.map((w) => ({ ...w, label: format(parseISO(w.weekStart), 'd MMM') })), [data]);
  switch (id) {
    case 'throughput':
      return (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={weeks} margin={{ left: -20, right: 8, top: 8 }}>
            <defs><linearGradient id="tp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7c5cff" stopOpacity={0.5} /><stop offset="1" stopColor="#7c5cff" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area type="monotone" dataKey="completedPoints" name="Points completed" stroke="#7c5cff" strokeWidth={2.5} fill="url(#tp)" />
            <Area type="monotone" dataKey="completed" name="Tasks completed" stroke="#22d3ee" strokeWidth={2} fill="transparent" />
          </AreaChart>
        </ResponsiveContainer>
      );
    case 'createdVsCompleted':
      return (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={weeks} margin={{ left: -20, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="created" name="Created" stroke="#f59e0b" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      );
    case 'status': {
      const rows = STATUSES.map((s) => ({ name: s.label, value: data.statusDistribution[s.value] ?? 0, color: s.color })).filter((r) => r.value > 0);
      const total = rows.reduce((a, r) => a + r.value, 0);
      return (
        <div className="donut-wrap">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" innerRadius={58} outerRadius={84} paddingAngle={2} stroke="none">
                {rows.map((r) => <Cell key={r.name} fill={r.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center"><div className="stat-value" style={{ margin: 0 }}>{total}</div><div className="tiny subtle">tasks</div></div>
          <div className="legend">{rows.map((r) => <span key={r.name}><i style={{ background: r.color }} />{r.name} {r.value}</span>)}</div>
        </div>
      );
    }
    case 'priority': {
      const rows = PRIORITIES.map((p) => ({ name: p.label, value: data.priorityDistribution[p.value] ?? 0, color: p.color }));
      return (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows} margin={{ left: -20, right: 8, top: 8 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="value" name="Open tasks" radius={[6, 6, 0, 0]}>{rows.map((r) => <Cell key={r.name} fill={r.color} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    }
    case 'workload':
      return data.workload.length === 0 ? <p className="muted small">No assigned work yet.</p> : (
        <div className="stack" style={{ gap: 12 }}>
          {data.workload.map((m) => (
            <div key={m.userId} className="load-row">
              <Avatar user={{ fullName: m.name, avatarColor: m.avatarColor }} size={28} />
              <div className="grow">
                <div className="spread small"><span className="strong">{m.name}</span><span className={m.state === 'OVERLOADED' ? 'danger-text' : 'muted'}>{m.openPoints}/{m.capacity} pts · {m.utilization}%</span></div>
                <div className="load-bar"><span className={`load-${m.state.toLowerCase()}`} style={{ width: `${Math.min(m.utilization, 150) / 1.5}%` }} /><i style={{ left: `${100 / 1.5}%` }} /></div>
              </div>
            </div>
          ))}
        </div>
      );
    case 'health': return <HealthWidget />;
    case 'cycleTime':
      return (
        <div className="grid-2">
          <div><div className="stat-label">Avg. cycle time</div><div className="stat-value">{data.totals.avgCycleTimeDays}d</div><div className="stat-foot">in progress → done</div></div>
          <div><div className="stat-label">Avg. lead time</div><div className="stat-value">{data.totals.avgLeadTimeDays}d</div><div className="stat-foot">created → done</div></div>
          <div><div className="stat-label">Completion</div><div className="stat-value">{data.totals.completionRate}%</div><div className="stat-foot">{data.totals.done}/{data.totals.total} tasks</div></div>
          <div><div className="stat-label">Overdue</div><div className="stat-value" style={{ color: data.totals.overdue ? 'var(--danger)' : undefined }}>{data.totals.overdue}</div><div className="stat-foot">open past due</div></div>
        </div>
      );
    case 'topContributors':
      return data.topContributors.length === 0 ? <p className="muted small">No completed work in the last 30 days.</p> : (
        <ol className="leaderboard">
          {data.topContributors.map((c, i) => (
            <li key={c.userId}><span className="rank">{i + 1}</span><Avatar user={{ fullName: c.name, avatarColor: c.avatarColor }} size={26} /><span className="grow strong">{c.name}</span><span className="small muted">{c.completedTasks} tasks · <b>{c.completedPoints}</b> pts</span></li>
          ))}
        </ol>
      );
    default: return null;
  }
}

function HealthWidget() {
  const { data, isLoading } = usePortfolio();
  if (isLoading) return <Skeleton h={160} />;
  return (
    <ul className="list">
      {data?.map((p) => (
        <li key={p.projectId} className="list-row" style={{ cursor: 'default' }}>
          <HealthRing score={p.score} size={40} stroke={4} />
          <span className="grow truncate strong">{p.name}</span>
          <span className={`badge badge-${riskTone(p.risk)}`}>{p.risk.toLowerCase()}</span>
        </li>
      ))}
    </ul>
  );
}
