import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useExecutions } from '../../api/queries';
import type { Execution } from '../../api/types';
import { EmptyState, ErrorState, Skeleton } from '../../components/ui';
import { ago } from '../../lib/format';

const tone = (s: string) => (s === 'SUCCESS' ? 'success' : s === 'FAILED' ? 'danger' : '');

export function ExecutionList({ workflowId }: { workflowId?: number }) {
  const { data, isLoading, error, refetch } = useExecutions(workflowId);
  const [open, setOpen] = useState<number | null>(null);
  if (isLoading) return <Skeleton h={160} r={14} />;
  if (error) return <ErrorState error={error} retry={refetch} />;
  if (!data?.content.length) return <div className="card"><EmptyState title="No runs yet" body="Executions appear here as soon as a trigger fires. Use “Test run” in the builder to try one safely." /></div>;
  return (
    <div className="card">
      {data.content.map((e) => (
        <div key={e.id} className="exec">
          <button className="exec-row" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
            <ChevronRight size={15} style={{ transform: open === e.id ? 'rotate(90deg)' : undefined, transition: 'transform var(--t-fast)' }} />
            <span className={`badge badge-dot badge-${tone(e.status)}`}>{e.status.toLowerCase()}</span>
            {e.dryRun && <span className="badge badge-info">dry run</span>}
            <span className="strong truncate grow">{e.workflowName}</span>
            <span className="small subtle hide-sm">{e.triggerEvent.replaceAll('_', ' ').toLowerCase()}{e.taskId ? ` · task #${e.taskId}` : ''}</span>
            <span className="small subtle">{e.durationMs} ms · {ago(e.startedAt)}</span>
          </button>
          {open === e.id && <StepTrace execution={e} />}
        </div>
      ))}
    </div>
  );
}

export function StepTrace({ execution }: { execution: Execution }) {
  return (
    <ol className="trace">
      {execution.steps.map((s, i) => (
        <li key={i} className={`trace-step r-${s.result.toLowerCase()}`}>
          <span className="trace-dot" />
          <div className="grow">
            <div className="row small"><span className="strong">{s.label ?? s.node}</span><span className="badge">{s.result}</span>{s.ms != null && <span className="tiny subtle">{s.ms} ms</span>}</div>
            <div className="small muted">{s.message}</div>
          </div>
        </li>
      ))}
      {execution.errorMessage && <li className="trace-step r-error"><span className="trace-dot" /><div className="small danger-text">{execution.errorMessage}</div></li>}
    </ol>
  );
}
