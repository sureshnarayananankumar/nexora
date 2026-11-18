import { Zap } from 'lucide-react';
import { useActivities } from '../api/queries';
import { ago } from '../lib/format';
import { Avatar, EmptyState, ErrorState, Skeleton } from '../components/ui';

export function ActivityFeed({ projectId, taskId, size = 20, compact }: { projectId?: number; taskId?: number; size?: number; compact?: boolean }) {
  const { data, isLoading, error, refetch } = useActivities({ projectId, taskId, size });
  if (isLoading) return <div className="stack">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={36} />)}</div>;
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (!data?.content.length) return <EmptyState title="No activity yet" body="Changes to projects and tasks will show up here as they happen." />;
  return (
    <ol className={`timeline ${compact ? 'compact' : ''}`}>
      {data.content.map((a) => (
        <li key={a.id} className="timeline-item">
          {a.actor ? <Avatar user={a.actor} size={26} /> : <span className="auto-avatar" title="Automation"><Zap size={13} /></span>}
          <div className="grow">
            <div className="timeline-text">{a.summary}</div>
            <div className="tiny subtle">{ago(a.createdAt)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
