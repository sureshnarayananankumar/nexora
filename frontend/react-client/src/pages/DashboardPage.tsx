import { Link } from 'react-router-dom';
import { addDays } from 'date-fns';
import { AlertTriangle, CheckCircle2, CircleDot, Flag, Gauge, ListTodo, Timer } from 'lucide-react';
import { useAnalytics, useCalendar, useMyTasks, usePortfolio } from '../api/queries';
import { useAuth } from '../stores/auth';
import { ActivityFeed } from '../features/ActivityFeed';
import { DueBadge, EmptyState, ErrorState, HealthRing, PriorityBadge, Skeleton, StatusBadge } from '../components/ui';
import { fullDay, isoDate, riskTone } from '../lib/format';

export default function DashboardPage() {
  const user = useAuth((s) => s.user)!;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const analytics = useAnalytics();
  const t = analytics.data?.totals;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="page-header">
        <div>
          <h1>{greeting}, {user.fullName.split(' ')[0]}</h1>
          <p className="muted">Here’s what needs your attention across {user.organization.name}.</p>
        </div>
      </div>

      <div className="grid-4">
        <Stat icon={<ListTodo />} label="Open tasks" value={t?.open} foot={`${t?.total ?? 0} total`} loading={analytics.isLoading} />
        <Stat icon={<AlertTriangle />} label="Overdue" value={t?.overdue} foot="across visible projects" tone={t && t.overdue > 0 ? 'danger' : undefined} loading={analytics.isLoading} />
        <Stat icon={<CheckCircle2 />} label="Completion" value={t ? `${t.completionRate}%` : undefined} foot={`${t?.done ?? 0} tasks done`} loading={analytics.isLoading} />
        <Stat icon={<Timer />} label="Avg. cycle time" value={t ? `${t.avgCycleTimeDays}d` : undefined} foot="start → done, last 60 days" loading={analytics.isLoading} />
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="card-header"><h3>My open work</h3><Link className="small" to="/projects">All projects</Link></div>
          <div className="card-body"><MyTasks /></div>
        </section>
        <section className="card">
          <div className="card-header"><h3><Gauge size={16} style={{ verticalAlign: -3 }} /> Portfolio health</h3><span className="tiny subtle">riskiest first</span></div>
          <div className="card-body"><Portfolio /></div>
        </section>
        <section className="card">
          <div className="card-header"><h3>Upcoming two weeks</h3><Link className="small" to="/calendar">Calendar</Link></div>
          <div className="card-body"><Upcoming /></div>
        </section>
        <section className="card">
          <div className="card-header"><h3>Team activity</h3><span className="live-dot">Live</span></div>
          <div className="card-body" style={{ maxHeight: 420, overflow: 'auto' }}><ActivityFeed size={15} compact /></div>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, foot, tone, loading }: { icon: React.ReactNode; label: string; value?: number | string; foot?: string; tone?: 'danger'; loading?: boolean }) {
  return (
    <div className="card stat">
      <div className="stat-label">{icon}{label}</div>
      {loading ? <Skeleton h={34} w={80} /> : <div className="stat-value" style={tone ? { color: 'var(--danger)' } : undefined}>{value ?? 0}</div>}
      <div className="stat-foot">{foot}</div>
    </div>
  );
}

function MyTasks() {
  const { data, isLoading, error, refetch } = useMyTasks();
  if (isLoading) return <div className="stack">{[0, 1, 2].map((i) => <Skeleton key={i} h={44} />)}</div>;
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (!data?.length) return <EmptyState icon={<CheckCircle2 size={22} />} title="You’re all caught up" body="Nothing is assigned to you right now." />;
  return (
    <ul className="list">
      {data.slice(0, 8).map((task) => (
        <li key={task.id}>
          <Link to={`/projects/${task.projectId}/board?task=${task.id}`} className="list-row">
            <PriorityBadge priority={task.priority} compact />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="truncate strong">{task.title}</div>
              <div className="key">{task.key}</div>
            </div>
            <StatusBadge status={task.status} />
            <DueBadge date={task.dueDate} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Portfolio() {
  const { data, isLoading, error, refetch } = usePortfolio();
  if (isLoading) return <div className="stack">{[0, 1, 2].map((i) => <Skeleton key={i} h={64} />)}</div>;
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (!data?.length) return <EmptyState title="No projects yet" body="Create a project to see its health score here." action={<Link className="btn btn-primary btn-sm" to="/projects">Create a project</Link>} />;
  return (
    <ul className="list">
      {data.map((p) => (
        <li key={p.projectId}>
          <Link to={`/projects/${p.projectId}/overview`} className="list-row">
            <HealthRing score={p.score} size={46} stroke={5} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row"><span className="nav-project-dot" style={{ background: p.color, margin: 0 }} /><span className="strong truncate">{p.name}</span></div>
              <div className="tiny subtle truncate">{p.forecast}</div>
            </div>
            <span className={`badge badge-${riskTone(p.risk)}`}>{p.risk.toLowerCase()} risk</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Upcoming() {
  const from = isoDate(new Date());
  const to = isoDate(addDays(new Date(), 14));
  const { data, isLoading, error, refetch } = useCalendar(from, to);
  if (isLoading) return <div className="stack">{[0, 1, 2].map((i) => <Skeleton key={i} h={36} />)}</div>;
  if (error) return <ErrorState error={error} retry={refetch} />;
  const items = (data ?? []).filter((i) => !i.completed).slice(0, 8);
  if (!items.length) return <EmptyState title="A quiet fortnight" body="No open deadlines or milestones in the next 14 days." />;
  return (
    <ul className="list">
      {items.map((i) => (
        <li key={`${i.kind}-${i.id}`}>
          <Link className="list-row" to={i.kind === 'TASK' ? `/projects/${i.projectId}/board?task=${i.id}` : `/projects/${i.projectId}/milestones`}>
            {i.kind === 'MILESTONE' ? <Flag size={16} color={i.projectColor} /> : <CircleDot size={16} color={i.projectColor} />}
            <span className="grow truncate">{i.title}</span>
            <span className="small subtle">{fullDay(i.date)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
