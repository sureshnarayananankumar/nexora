import { ArrowRight, CheckCircle2, Info, Scale, Sparkles, TrendingUp } from 'lucide-react';
import { useApplyRebalance, useApplyRecommendation, useHealth, useRecommendations, useWorkload } from '../../api/queries';
import { ErrorState, EmptyState, HealthRing, PriorityBadge, Skeleton, Avatar, errorMessage } from '../../components/ui';
import { fullDay, riskTone } from '../../lib/format';
import { useUi } from '../../stores/ui';

export function OverviewTab({ projectId, canWrite, canManage }: { projectId: number; canWrite: boolean; canManage: boolean }) {
  return (
    <div className="overview-grid">
      <HealthPanel projectId={projectId} />
      <RecommendationsPanel projectId={projectId} canWrite={canWrite} />
      <WorkloadPanel projectId={projectId} canManage={canManage} />
    </div>
  );
}

function HealthPanel({ projectId }: { projectId: number }) {
  const { data, isLoading, error, refetch } = useHealth(projectId);
  if (isLoading) return <section className="card card-pad span-2"><Skeleton h={220} /></section>;
  if (error || !data) return <section className="card card-pad span-2"><ErrorState error={error} retry={refetch} /></section>;
  const s = data.stats;
  return (
    <section className="card card-pad span-2 health-panel">
      <div className="health-hero">
        <HealthRing score={data.score} size={132} stroke={12} />
        <div className="stack" style={{ gap: 10 }}>
          <div className="row"><h2>Project health</h2><span className={`badge badge-${riskTone(data.risk)}`}>{data.risk.toLowerCase()} risk</span></div>
          <div className="forecast"><TrendingUp size={16} /> {data.forecast.message}</div>
          <div className="row wrap small muted" style={{ gap: 16 }}>
            <span><b>{s.progressPercent}%</b> of points done</span>
            {s.elapsedPercent != null && <span><b>{s.elapsedPercent}%</b> of timeline elapsed</span>}
            <span><b>{data.forecast.velocityPerDay}</b> pts/day (14-day velocity)</span>
            {data.forecast.projectedFinish && <span>Finish ≈ <b>{fullDay(data.forecast.projectedFinish)}</b></span>}
          </div>
          <div className="dual-progress" title="Points done vs. timeline elapsed">
            <div className="progress"><span style={{ width: `${s.progressPercent}%` }} /></div>
            {s.elapsedPercent != null && <div className="elapsed-marker" style={{ left: `${s.elapsedPercent}%` }} />}
          </div>
        </div>
      </div>
      <div className="factor-grid">
        {data.factors.map((f) => (
          <div key={f.code} className={`factor ${f.penalty > 0 ? 'hit' : ''}`}>
            <div className="spread">
              <span className="strong small">{f.label}</span>
              <span className={`small ${f.penalty > 0 ? 'danger-text' : 'success-text'}`}>{f.penalty > 0 ? `−${f.penalty}` : <CheckCircle2 size={14} />}</span>
            </div>
            <div className="progress" style={{ height: 4 }}><span style={{ width: `${(f.penalty / f.maxPenalty) * 100}%`, background: 'var(--danger)' }} /></div>
            <div className="tiny muted">{f.detail}</div>
          </div>
        ))}
      </div>
      <p className="tiny subtle row" style={{ marginTop: 12 }}><Info size={12} /> Score = 100 − penalties. Rule-based and explainable; see docs/architecture.md §5.</p>
    </section>
  );
}

function RecommendationsPanel({ projectId, canWrite }: { projectId: number; canWrite: boolean }) {
  const { data, isLoading, error, refetch } = useRecommendations(projectId);
  const apply = useApplyRecommendation(projectId);
  const toast = useUi((s) => s.toast);
  return (
    <section className="card">
      <div className="card-header"><h3><Sparkles size={16} style={{ verticalAlign: -3 }} /> Priority recommendations</h3><span className="badge">{data?.length ?? 0}</span></div>
      <div className="card-body">
        {isLoading && <Skeleton h={120} />}
        {error && <ErrorState error={error} retry={refetch} />}
        {data?.length === 0 && <EmptyState icon={<CheckCircle2 size={22} />} title="Priorities look right" body="No task needs a different priority based on deadlines, dependencies and age." />}
        <ul className="list">
          {data?.slice(0, 8).map((r) => (
            <li key={r.taskId} className="rec">
              <div className="spread">
                <div style={{ minWidth: 0 }}><span className="key">{r.key}</span> <span className="strong">{r.title}</span></div>
                <span className="tiny subtle" title="Recommendation score">{r.score}</span>
              </div>
              <div className="row small" style={{ margin: '6px 0' }}>
                <PriorityBadge priority={r.current} /><ArrowRight size={14} className="subtle" /><PriorityBadge priority={r.recommended} />
              </div>
              <ul className="reasons">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>
              {canWrite && (
                <button className="btn btn-sm" disabled={apply.isPending} onClick={() => apply.mutate(r.taskId, {
                  onSuccess: () => toast({ tone: 'success', title: `${r.key} set to ${r.recommended.toLowerCase()}` }),
                  onError: (e) => toast({ tone: 'error', title: 'Couldn’t apply', body: errorMessage(e) }),
                })}>Apply</button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function WorkloadPanel({ projectId, canManage }: { projectId: number; canManage: boolean }) {
  const { data, isLoading, error, refetch } = useWorkload(projectId);
  const apply = useApplyRebalance(projectId);
  const toast = useUi((s) => s.toast);
  return (
    <section className="card">
      <div className="card-header"><h3><Scale size={16} style={{ verticalAlign: -3 }} /> Team workload</h3><span className="tiny subtle">open points ÷ weekly capacity</span></div>
      <div className="card-body stack">
        {isLoading && <Skeleton h={120} />}
        {error && <ErrorState error={error} retry={refetch} />}
        {data?.members.map((m) => (
          <div key={m.userId} className="load-row">
            <Avatar user={{ fullName: m.name, avatarColor: m.avatarColor }} size={28} />
            <div className="grow">
              <div className="spread small"><span className="strong">{m.name}</span><span className={m.state === 'OVERLOADED' ? 'danger-text' : 'muted'}>{m.openPoints}/{m.capacity} pts · {m.utilization}%</span></div>
              <div className="load-bar"><span className={`load-${m.state.toLowerCase()}`} style={{ width: `${Math.min(m.utilization, 150) / 1.5}%` }} /><i style={{ left: `${100 / 1.5}%` }} /></div>
            </div>
          </div>
        ))}
        {data && data.suggestions.length > 0 && (
          <div className="suggestions">
            <div className="tiny subtle strong">SUGGESTED REASSIGNMENTS</div>
            {data.suggestions.map((s) => (
              <div key={`${s.taskId}-${s.toUserId}`} className="suggestion">
                <div className="small"><span className="key">{s.taskKey}</span> {s.taskTitle} <span className="badge">{s.points} pts</span></div>
                <div className="tiny muted">{s.reason}</div>
                <div className="row small" style={{ marginTop: 6 }}>
                  <span>{s.fromName}</span><ArrowRight size={13} /><span className="strong">{s.toName}</span>
                  <span className="grow" />
                  {canManage && <button className="btn btn-sm" disabled={apply.isPending} onClick={() => apply.mutate({ taskId: s.taskId, toUserId: s.toUserId }, {
                    onSuccess: () => toast({ tone: 'success', title: `${s.taskKey} moved to ${s.toName}` }),
                    onError: (e) => toast({ tone: 'error', title: 'Couldn’t reassign', body: errorMessage(e) }),
                  })}>Reassign</button>}
                </div>
              </div>
            ))}
          </div>
        )}
        {data && data.suggestions.length === 0 && data.members.some((m) => m.state === 'OVERLOADED') && (
          <p className="small muted">Someone is overloaded, but nobody else on this project has room for their not-yet-started tasks.</p>
        )}
      </div>
    </section>
  );
}
