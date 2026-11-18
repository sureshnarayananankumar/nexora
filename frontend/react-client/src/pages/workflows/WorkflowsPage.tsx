import { useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Plus, Trash2, Workflow as WorkflowIcon, Zap } from 'lucide-react';
import { useDeleteWorkflow, useOrganization, useToggleWorkflow, useWorkflows } from '../../api/queries';
import { useAuth, can } from '../../stores/auth';
import { useUi } from '../../stores/ui';
import { ConfirmDialog, EmptyState, ErrorState, Skeleton, errorMessage } from '../../components/ui';
import { ago } from '../../lib/format';
import { ExecutionList } from './ExecutionList';

export const TRIGGER_LABEL: Record<string, string> = {
  TASK_CREATED: 'Task created', TASK_STATUS_CHANGED: 'Status changed', TASK_ASSIGNED: 'Task assigned',
  COMMENT_ADDED: 'Comment added', TASK_OVERDUE: 'Task overdue',
};

export default function WorkflowsPage() {
  const me = useAuth((s) => s.user);
  const manage = can(me, 'WORKFLOW_MANAGE');
  const { data, isLoading, error, refetch } = useWorkflows();
  const { data: org } = useOrganization();
  const toggle = useToggleWorkflow();
  const remove = useDeleteWorkflow();
  const toast = useUi((s) => s.toast);
  const [tab, setTab] = useState<'workflows' | 'history'>('workflows');
  const [deleting, setDeleting] = useState<{ id: number; name: string } | null>(null);
  const atLimit = org ? org.usage.workflows >= org.plan.maxWorkflows : false;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Automation studio</h1>
          <p className="muted">Visual workflows that run on real task events. {org && <span className="subtle">{org.usage.workflows}/{org.plan.maxWorkflows} on the {org.plan.name} plan.</span>}</p>
        </div>
        {manage && (atLimit
          ? <span className="badge badge-warning">Workflow limit reached. Upgrade your plan.</span>
          : <Link to="/workflows/new" className="btn btn-primary"><Plus /> New workflow</Link>)}
      </div>
      <div className="tabs">
        <button className={`tab ${tab === 'workflows' ? 'active' : ''}`} onClick={() => setTab('workflows')}><WorkflowIcon /> Workflows</button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}><History /> Execution history</button>
      </div>
      {tab === 'history' ? <ExecutionList /> : (
        <>
          {isLoading && <div className="grid-2">{[0, 1].map((i) => <Skeleton key={i} h={150} r={16} />)}</div>}
          {error && <ErrorState error={error} retry={refetch} />}
          {data?.length === 0 && (
            <div className="card"><EmptyState icon={<Zap size={22} />} title="No automations yet"
              body="Start from a template, like auto-assigning new work to whoever has the most capacity."
              action={manage && <Link to="/workflows/new" className="btn btn-primary"><Plus /> Create a workflow</Link>} /></div>
          )}
          <div className="grid-2">
            {data?.map((w) => (
              <article key={w.id} className={`card workflow-card ${w.enabled ? '' : 'disabled'}`}>
                <div className="spread">
                  <Link to={`/workflows/${w.id}`} className="row" style={{ color: 'inherit', minWidth: 0 }}>
                    <span className="wf-icon"><Zap size={16} /></span>
                    <h3 className="truncate">{w.name}</h3>
                  </Link>
                  {manage ? (
                    <label className="switch" title={w.enabled ? 'Enabled' : 'Disabled'}>
                      <input type="checkbox" checked={w.enabled} aria-label={`Enable ${w.name}`}
                        onChange={(e) => toggle.mutate({ id: w.id, enabled: e.target.checked }, { onError: (err) => toast({ tone: 'error', title: 'Couldn’t update', body: errorMessage(err) }) })} />
                      <span />
                    </label>
                  ) : <span className={`badge ${w.enabled ? 'badge-success' : ''}`}>{w.enabled ? 'On' : 'Off'}</span>}
                </div>
                {w.description && <p className="small muted" style={{ marginTop: 8 }}>{w.description}</p>}
                <div className="row wrap small" style={{ marginTop: 12 }}>
                  <span className="badge badge-accent">When: {TRIGGER_LABEL[w.triggerType] ?? w.triggerType}</span>
                  <span className="badge">{w.projectName ?? 'All projects'}</span>
                  <span className="badge">{w.nodeCount} blocks</span>
                </div>
                <div className="spread small subtle" style={{ marginTop: 14 }}>
                  <span>{w.runCount} runs{w.lastRunAt ? ` · last ${ago(w.lastRunAt)}` : ''}</span>
                  <div className="row">
                    <Link to={`/workflows/${w.id}`} className="btn btn-sm">{manage ? 'Edit' : 'View'}</Link>
                    {manage && <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Delete ${w.name}`} onClick={() => setDeleting({ id: w.id, name: w.name })}><Trash2 /></button>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
      {deleting && <ConfirmDialog title={`Delete “${deleting.name}”?`} danger confirmLabel="Delete workflow" busy={remove.isPending}
        body="The workflow and its execution history will be removed."
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => { setDeleting(null); toast({ tone: 'success', title: 'Workflow deleted' }); }, onError: (e) => toast({ tone: 'error', title: 'Couldn’t delete', body: errorMessage(e) }) })} />}
    </div>
  );
}
