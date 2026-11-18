import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, MessageSquare, UserPlus, Zap, CalendarClock, CheckCircle2 } from 'lucide-react';
import { useMarkRead, useNotifications } from '../api/queries';
import type { Notification } from '../api/types';
import { EmptyState, ErrorState, Skeleton } from '../components/ui';
import { ago } from '../lib/format';

const ICON: Record<string, typeof Bell> = { TASK_ASSIGNED: UserPlus, COMMENT_ADDED: MessageSquare, WORKFLOW: Zap, DUE_SOON: CalendarClock, TASK_COMPLETED: CheckCircle2 };

export default function NotificationsPage() {
  const [unread, setUnread] = useState(false);
  const { data, isLoading, error, refetch } = useNotifications(unread);
  const mark = useMarkRead();
  const navigate = useNavigate();
  const open = (n: Notification) => {
    if (!n.read) mark.one.mutate(n.id);
    if (n.link) navigate(n.link);
  };
  return (
    <div style={{ maxWidth: 820 }}>
      <div className="page-header">
        <div><h1>Notifications</h1><p className="muted">Assignments, comments, reminders and automation alerts, delivered live.</p></div>
        <div className="row">
          <div className="segmented">
            <button className={!unread ? 'on' : ''} onClick={() => setUnread(false)}>All</button>
            <button className={unread ? 'on' : ''} onClick={() => setUnread(true)}>Unread</button>
          </div>
          <button className="btn" onClick={() => mark.all.mutate()} disabled={mark.all.isPending}><CheckCheck /> Mark all read</button>
        </div>
      </div>
      {isLoading && <Skeleton h={240} r={16} />}
      {error && <ErrorState error={error} retry={refetch} />}
      {data?.content.length === 0 && <div className="card"><EmptyState icon={<Bell size={22} />} title={unread ? 'No unread notifications' : 'Nothing yet'} body="You’ll be notified when work is assigned to you, someone comments, or an automation needs you." /></div>}
      {!!data?.content.length && (
        <div className="card">
          {data.content.map((n) => {
            const Icon = ICON[n.type] ?? Bell;
            return (
              <button key={n.id} className={`notif ${n.read ? '' : 'unread'}`} onClick={() => open(n)}>
                <span className="notif-icon"><Icon size={16} /></span>
                <div className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                  <div className="strong truncate">{n.title}</div>
                  {n.body && <div className="small muted truncate">{n.body}</div>}
                </div>
                <span className="tiny subtle">{ago(n.createdAt)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
