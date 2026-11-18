import { useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Activity, Flag, Gauge, KanbanSquare, Plus, Settings2, Users } from 'lucide-react';
import { useProject } from '../../api/queries';
import { useProjectRoom } from '../../hooks/realtime';
import { useAuth, can } from '../../stores/auth';
import { NO_USERS, useUi } from '../../stores/ui';
import { AvatarStack, ErrorState, PageLoader } from '../../components/ui';
import { BoardTab } from './BoardTab';
import { OverviewTab } from './OverviewTab';
import { MilestonesTab } from './MilestonesTab';
import { MembersTab } from './MembersTab';
import { TaskDrawer } from './TaskDrawer';
import { NewTaskModal } from './NewTaskModal';
import { ActivityFeed } from '../../features/ActivityFeed';
import { ProjectFormModal } from '../../features/ProjectFormModal';
import { colorFor } from '../../layout/AppShell';
import { day } from '../../lib/format';

const TABS = [
  { id: 'board', label: 'Board', icon: KanbanSquare },
  { id: 'overview', label: 'Insights', icon: Gauge },
  { id: 'timeline', label: 'Timeline', icon: Activity },
  { id: 'milestones', label: 'Milestones', icon: Flag },
  { id: 'members', label: 'Members', icon: Users },
] as const;

export default function ProjectPage() {
  const params = useParams();
  const projectId = Number(params.projectId);
  const tab = params.tab ?? 'board';
  const [search, setSearch] = useSearchParams();
  const me = useAuth((s) => s.user)!;
  const viewers = useUi((s) => s.projectViewers[projectId] ?? NO_USERS);
  const { data, isLoading, error, refetch } = useProject(projectId);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  useProjectRoom(projectId);

  if (!TABS.some((t) => t.id === tab)) return <Navigate to={`/projects/${projectId}/board`} replace />;
  if (isLoading) return <PageLoader />;
  if (error || !data) return <ErrorState error={error} retry={refetch} />;

  const p = data.project;
  const orgWide = me.role === 'ORG_ADMIN' || me.role === 'SUPER_ADMIN';
  const archived = p.status === 'ARCHIVED';
  const canWrite = !archived && can(me, 'TASK_WRITE') && (orgWide || p.myRole !== 'VIEWER');
  const canManage = can(me, 'PROJECT_MANAGE') && (orgWide || p.myRole === 'OWNER' || me.role === 'MANAGER');
  const openTask = Number(search.get('task')) || null;
  const setOpenTask = (id: number | null) => {
    const next = new URLSearchParams(search);
    if (id) next.set('task', String(id)); else next.delete('task');
    setSearch(next, { replace: true });
  };

  return (
    <div>
      <div className="project-head">
        <div className="project-icon" style={{ background: `linear-gradient(135deg, ${p.color}, color-mix(in srgb, ${p.color} 40%, #22d3ee))` }}>{p.key.slice(0, 2)}</div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row"><h1 className="truncate">{p.name}</h1>{p.status !== 'ACTIVE' && <span className="badge">{p.status.replace('_', ' ').toLowerCase()}</span>}</div>
          <div className="row small muted wrap" style={{ marginTop: 4 }}>
            <span className="key">{p.key}</span><span>·</span><span>Owner {p.owner.fullName}</span>
            {p.dueDate && <><span>·</span><span>Due {day(p.dueDate)}</span></>}
            <span>·</span><span>{p.doneTasks}/{p.totalTasks} done</span>
          </div>
        </div>
        {viewers.length > 0 && (
          <div className="row small muted" title={`Viewing now: ${viewers.map((v) => v.name).join(', ')}`}>
            <AvatarStack users={viewers.map((v) => ({ fullName: v.name, avatarColor: colorFor(v.id) }))} max={4} size={26} />
            <span className="hide-sm">viewing</span>
          </div>
        )}
        {canManage && <button className="btn" onClick={() => setEditing(true)}><Settings2 /> Settings</button>}
        {canWrite && <button className="btn btn-primary" onClick={() => setCreating(true)}><Plus /> New task</button>}
      </div>
      {archived && <div className="alert alert-warning" style={{ marginBottom: 16 }}>This project is archived and read-only.{canManage && ' Restore it from Settings to make changes.'}</div>}
      <nav className="tabs" aria-label="Project sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Link key={id} to={`/projects/${projectId}/${id}`} className={`tab ${tab === id ? 'active' : ''}`}><Icon /> {label}</Link>
        ))}
      </nav>
      {tab === 'board' && <BoardTab detail={data} canWrite={canWrite} onOpen={setOpenTask} />}
      {tab === 'overview' && <OverviewTab projectId={projectId} canWrite={canWrite} canManage={canManage} />}
      {tab === 'timeline' && <div className="card card-pad" style={{ maxWidth: 860 }}><ActivityFeed projectId={projectId} size={50} /></div>}
      {tab === 'milestones' && <MilestonesTab detail={data} canManage={canManage} />}
      {tab === 'members' && <MembersTab detail={data} canManage={canManage} />}
      {openTask && <TaskDrawer taskId={openTask} detail={data} canWrite={canWrite} onClose={() => setOpenTask(null)} />}
      {creating && <NewTaskModal detail={data} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpenTask(id); }} />}
      {editing && <ProjectFormModal project={p} onClose={() => setEditing(false)} />}
    </div>
  );
}
