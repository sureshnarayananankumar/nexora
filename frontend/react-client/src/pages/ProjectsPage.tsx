import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolderKanban, Plus } from 'lucide-react';
import { useProjects, usePortfolio } from '../api/queries';
import { useAuth, can } from '../stores/auth';
import { AvatarStack, EmptyState, ErrorState, HealthRing, Skeleton } from '../components/ui';
import { ProjectFormModal } from '../features/ProjectFormModal';
import { day, riskTone } from '../lib/format';

export default function ProjectsPage() {
  const user = useAuth((s) => s.user);
  const { data, isLoading, error, refetch } = useProjects();
  const { data: portfolio } = usePortfolio();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED'>('ALL');
  const health = new Map(portfolio?.map((p) => [p.projectId, p]));
  const list = (data ?? []).filter((p) => filter === 'ALL' || p.status === filter);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="muted">Every project you’re part of, with live health and progress.</p>
        </div>
        {can(user, 'PROJECT_CREATE') && <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus /> New project</button>}
      </div>
      <div className="segmented" role="tablist" style={{ marginBottom: 20 }}>
        {(['ALL', 'ACTIVE', 'ON_HOLD', 'COMPLETED'] as const).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
            {f === 'ALL' ? 'All' : f === 'ON_HOLD' ? 'On hold' : f[0] + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      {isLoading && <div className="grid-3">{[0, 1, 2].map((i) => <Skeleton key={i} h={190} r={16} />)}</div>}
      {error && <ErrorState error={error} retry={refetch} />}
      {data && list.length === 0 && (
        <div className="card"><EmptyState icon={<FolderKanban size={22} />} title="No projects here yet"
          body={can(user, 'PROJECT_CREATE') ? 'Create your first project to start planning work.' : 'Ask a manager to add you to a project.'}
          action={can(user, 'PROJECT_CREATE') && <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus /> New project</button>} /></div>
      )}
      <div className="grid-3">
        {list.map((p) => {
          const h = health.get(p.id);
          return (
            <Link key={p.id} to={`/projects/${p.id}/board`} className="card project-card">
              <div className="project-card-accent" style={{ background: p.color }} />
              <div className="spread">
                <div style={{ minWidth: 0 }}>
                  <div className="key">{p.key}</div>
                  <h3 className="truncate" style={{ marginTop: 2 }}>{p.name}</h3>
                </div>
                {h && <HealthRing score={h.score} size={50} stroke={5} />}
              </div>
              <p className="muted small project-card-desc">{p.description || 'No description yet.'}</p>
              <div className="spread small" style={{ marginTop: 'auto' }}>
                <span className="muted">{p.doneTasks}/{p.totalTasks} done</span>
                {h && <span className={`badge badge-${riskTone(h.risk)}`}>{h.risk.toLowerCase()} risk</span>}
              </div>
              <div className="progress"><span style={{ width: `${p.progress}%` }} /></div>
              <div className="spread small">
                <AvatarStack users={[p.owner]} size={22} />
                <span className="subtle">{p.memberCount} members{p.dueDate ? ` · due ${day(p.dueDate)}` : ''}</span>
              </div>
            </Link>
          );
        })}
      </div>
      {creating && <ProjectFormModal onClose={() => setCreating(false)} />}
    </div>
  );
}
