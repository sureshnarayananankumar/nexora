import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, isToday, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { useCalendar } from '../api/queries';
import { ErrorState, Skeleton } from '../components/ui';
import { isoDate } from '../lib/format';

export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }), [month]);
  const from = isoDate(days[0]);
  const to = isoDate(days[days.length - 1]);
  const { data, isLoading, error, refetch } = useCalendar(from, to);
  const byDay = useMemo(() => {
    const m = new Map<string, NonNullable<typeof data>>();
    (data ?? []).forEach((i) => m.set(i.date, [...(m.get(i.date) ?? []), i]));
    return m;
  }, [data]);

  return (
    <div>
      <div className="page-header">
        <div><h1>Calendar</h1><p className="muted">Task deadlines and milestones across your projects.</p></div>
        <div className="row">
          <button className="btn btn-icon" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month"><ChevronLeft /></button>
          <button className="btn" onClick={() => setMonth(startOfMonth(new Date()))}>Today</button>
          <button className="btn btn-icon" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month"><ChevronRight /></button>
          <h2 style={{ minWidth: 170, textAlign: 'right' }}>{format(month, 'MMMM yyyy')}</h2>
        </div>
      </div>
      {error && <ErrorState error={error} retry={refetch} />}
      <div className="calendar card">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-head">{d}</div>)}
        {days.map((d) => {
          const key = isoDate(d);
          const items = byDay.get(key) ?? [];
          return (
            <div key={key} className={`cal-day ${isSameMonth(d, month) ? '' : 'out'} ${isToday(d) ? 'today' : ''}`}>
              <div className="cal-num">{format(d, 'd')}</div>
              {isLoading ? <Skeleton h={14} /> : items.slice(0, 4).map((i) => (
                <Link key={`${i.kind}-${i.id}`} to={i.kind === 'TASK' ? `/projects/${i.projectId}/board?task=${i.id}` : `/projects/${i.projectId}/milestones`}
                  className={`cal-item ${i.kind === 'MILESTONE' ? 'ms' : ''} ${i.completed ? 'done' : ''}`} style={{ ['--c' as string]: i.projectColor }} title={i.title}>
                  {i.kind === 'MILESTONE' && <Flag size={11} />}<span className="truncate">{i.title}</span>
                </Link>
              ))}
              {items.length > 4 && <div className="tiny subtle">+{items.length - 4} more</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
