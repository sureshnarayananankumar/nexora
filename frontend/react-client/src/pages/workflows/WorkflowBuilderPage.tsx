import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Background, Controls, Handle, MiniMap, Position, ReactFlow, ReactFlowProvider, addEdge, useEdgesState, useNodesState,
  useReactFlow, type Connection, type Edge, type Node, type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Bell, Bot, Check, FlaskConical, GitBranch, MessageSquare, Play, Save, Trash2, UserCheck, Zap } from 'lucide-react';
import {
  useCatalog, useMyTasks, useProject, useProjects, useSaveWorkflow, useTasks, useTeam, useTestWorkflow, useWorkflow,
} from '../../api/queries';
import type { CatalogKind, Execution, NodeType, WorkflowEdgeDto, WorkflowNodeDto } from '../../api/types';
import { useAuth, can } from '../../stores/auth';
import { useUi } from '../../stores/ui';
import { ErrorState, Field, PageLoader, Spinner, errorMessage } from '../../components/ui';
import { PRIORITIES, STATUSES } from '../../lib/format';
import { ExecutionList, StepTrace } from './ExecutionList';
import { ApiError } from '../../api/client';

interface FlowData extends Record<string, unknown> {
  type: NodeType;
  kind: string;
  label: string;
  config: Record<string, unknown>;
  result?: string;
  summary?: string;
}
type FlowNode = Node<FlowData>;

const ICONS: Record<string, typeof Zap> = {
  SET_PRIORITY: Zap, SET_STATUS: Play, ASSIGN_USER: UserCheck, ASSIGN_LEAST_LOADED: Bot, NOTIFY_ASSIGNEE: Bell,
  NOTIFY_USER: Bell, NOTIFY_PROJECT_OWNER: Bell, ADD_COMMENT: MessageSquare,
};

// ── Canvas nodes ────────────────────────────────────────────────────────────
function BlockNode({ data, selected }: NodeProps<FlowNode>) {
  const Icon = data.type === 'TRIGGER' ? Zap : data.type === 'CONDITION' ? GitBranch : (ICONS[data.kind] ?? Zap);
  return (
    <div className={`wf-node t-${data.type.toLowerCase()} ${selected ? 'sel' : ''} ${data.result ? `r-${data.result.toLowerCase()}` : ''}`}>
      {data.type !== 'TRIGGER' && <Handle type="target" position={Position.Top} />}
      <div className="wf-node-type"><Icon size={12} /> {data.type === 'TRIGGER' ? 'When' : data.type === 'CONDITION' ? 'If' : 'Then'}</div>
      <div className="wf-node-label">{data.label}</div>
      {data.summary && <div className="wf-node-sum">{data.summary}</div>}
      {data.result && <div className="wf-node-result">{data.result}</div>}
      {data.type === 'CONDITION' ? (
        <>
          <Handle type="source" id="TRUE" position={Position.Bottom} style={{ left: '28%' }} className="h-true" />
          <Handle type="source" id="FALSE" position={Position.Bottom} style={{ left: '72%' }} className="h-false" />
          <span className="h-label yes">Yes</span><span className="h-label no">No</span>
        </>
      ) : <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
const nodeTypes = { block: BlockNode };

// ── Templates ───────────────────────────────────────────────────────────────
type Template = { id: string; name: string; description: string; nodes: WorkflowNodeDto[]; edges: WorkflowEdgeDto[] };
const TEMPLATES: Template[] = [
  { id: 'blank', name: 'Blank canvas', description: 'Start with just a trigger', nodes: [{ key: 'n1', type: 'TRIGGER', kind: 'TASK_CREATED', label: 'Task created', config: {}, x: 220, y: 40 }], edges: [] },
  {
    id: 'assign', name: 'Auto-assign unowned work', description: 'Give new unassigned tasks to whoever has the most room',
    nodes: [
      { key: 'n1', type: 'TRIGGER', kind: 'TASK_CREATED', label: 'Task created', config: {}, x: 220, y: 20 },
      { key: 'n2', type: 'CONDITION', kind: 'IS_UNASSIGNED', label: 'Is unassigned', config: {}, x: 220, y: 160 },
      { key: 'n3', type: 'ACTION', kind: 'ASSIGN_LEAST_LOADED', label: 'Assign least-loaded', config: {}, x: 80, y: 310 },
      { key: 'n4', type: 'ACTION', kind: 'ADD_COMMENT', label: 'Explain the choice', config: { text: 'Auto-assigned to {assignee} based on workload.' }, x: 80, y: 450 },
    ],
    edges: [{ source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3', branch: 'TRUE' }, { source: 'n3', target: 'n4' }],
  },
  {
    id: 'escalate', name: 'Escalate urgent bugs', description: 'Raise priority on bug reports and alert the owner',
    nodes: [
      { key: 'n1', type: 'TRIGGER', kind: 'TASK_CREATED', label: 'Task created', config: {}, x: 220, y: 20 },
      { key: 'n2', type: 'CONDITION', kind: 'TITLE_CONTAINS', label: 'Title mentions “bug”', config: { text: 'bug' }, x: 220, y: 160 },
      { key: 'n3', type: 'ACTION', kind: 'SET_PRIORITY', label: 'Priority → High', config: { priority: 'HIGH' }, x: 80, y: 310 },
      { key: 'n4', type: 'ACTION', kind: 'NOTIFY_PROJECT_OWNER', label: 'Alert owner', config: { message: 'New bug {task}: {title}' }, x: 80, y: 450 },
    ],
    edges: [{ source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3', branch: 'TRUE' }, { source: 'n3', target: 'n4' }],
  },
  {
    id: 'overdue', name: 'Overdue nudge', description: 'Escalate overdue high-priority work, note the rest',
    nodes: [
      { key: 'n1', type: 'TRIGGER', kind: 'TASK_OVERDUE', label: 'Task overdue', config: {}, x: 220, y: 20 },
      { key: 'n2', type: 'CONDITION', kind: 'PRIORITY_AT_LEAST', label: 'Priority ≥ High', config: { priority: 'HIGH' }, x: 220, y: 160 },
      { key: 'n3', type: 'ACTION', kind: 'NOTIFY_ASSIGNEE', label: 'Nudge assignee', config: { message: '{task} is overdue. Can you update the plan?' }, x: 60, y: 310 },
      { key: 'n4', type: 'ACTION', kind: 'ADD_COMMENT', label: 'Leave a note', config: { text: 'This task is past its due date.' }, x: 380, y: 310 },
    ],
    edges: [{ source: 'n1', target: 'n2' }, { source: 'n2', target: 'n3', branch: 'TRUE' }, { source: 'n2', target: 'n4', branch: 'FALSE' }],
  },
];

const toFlowNodes = (nodes: WorkflowNodeDto[]): FlowNode[] => nodes.map((n) => ({
  id: n.key, type: 'block', position: { x: n.x, y: n.y },
  data: { type: n.type, kind: n.kind, label: n.label || n.kind, config: n.config ?? {} },
}));
const edgeStyle = (branch?: string | null) => ({
  animated: true,
  label: branch === 'TRUE' ? 'Yes' : branch === 'FALSE' ? 'No' : undefined,
  className: branch === 'TRUE' ? 'e-true' : branch === 'FALSE' ? 'e-false' : undefined,
});
const toFlowEdges = (edges: WorkflowEdgeDto[]): Edge[] => edges.map((e) => ({
  id: `${e.source}-${e.target}`, source: e.source, target: e.target, sourceHandle: e.branch ?? undefined, ...edgeStyle(e.branch),
}));

export default function WorkflowBuilderPage() {
  const { workflowId } = useParams();
  const id = workflowId ? Number(workflowId) : null;
  const { data, isLoading, error } = useWorkflow(id);
  const [template, setTemplate] = useState<Template | null>(null);

  if (id && isLoading) return <PageLoader />;
  if (id && error) return <ErrorState error={error} />;
  if (!id && !template) return <TemplatePicker onPick={setTemplate} />;

  const initial = id && data
    ? { name: data.workflow.name, description: data.workflow.description ?? '', projectId: data.workflow.projectId ?? null, enabled: data.workflow.enabled, nodes: data.nodes, edges: data.edges }
    : { name: template!.id === 'blank' ? 'Untitled workflow' : template!.name, description: template!.description, projectId: null, enabled: true, nodes: template!.nodes, edges: template!.edges };

  return (
    <ReactFlowProvider>
      <Builder key={id ?? template!.id} workflowId={id} initial={initial} />
    </ReactFlowProvider>
  );
}

function TemplatePicker({ onPick }: { onPick: (t: Template) => void }) {
  return (
    <div>
      <div className="page-header"><div><Link to="/workflows" className="small row"><ArrowLeft size={14} /> Automation</Link><h1 style={{ marginTop: 8 }}>New workflow</h1><p className="muted">Start from a template or a blank canvas.</p></div></div>
      <div className="grid-2">
        {TEMPLATES.map((t) => (
          <button key={t.id} className="card template-card" onClick={() => onPick(t)}>
            <div className="template-mini">
              {t.nodes.map((n) => <span key={n.key} className={`tm-${n.type.toLowerCase()}`} />)}
            </div>
            <h3>{t.name}</h3>
            <p className="small muted">{t.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

interface Initial { name: string; description: string; projectId: number | null; enabled: boolean; nodes: WorkflowNodeDto[]; edges: WorkflowEdgeDto[] }

function Builder({ workflowId, initial }: { workflowId: number | null; initial: Initial }) {
  const me = useAuth((s) => s.user)!;
  const manage = can(me, 'WORKFLOW_MANAGE');
  const orgWideAllowed = me.role === 'ORG_ADMIN' || me.role === 'SUPER_ADMIN';
  const navigate = useNavigate();
  const toast = useUi((s) => s.toast);
  const { data: catalog } = useCatalog();
  const { data: projects } = useProjects();
  const { data: team } = useTeam();
  const save = useSaveWorkflow();
  const { screenToFlowPosition, fitView } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(toFlowNodes(initial.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(toFlowEdges(initial.edges));
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [projectId, setProjectId] = useState<number | null>(initial.projectId ?? (orgWideAllowed ? null : projects?.[0]?.id ?? null));
  const [enabled, setEnabled] = useState(initial.enabled);
  const [selected, setSelected] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [panel, setPanel] = useState<'config' | 'test' | 'history'>('config');
  const [dirty, setDirty] = useState(false);

  useEffect(() => { if (!projectId && !orgWideAllowed && projects?.length) setProjectId(projects[0].id); }, [projects, projectId, orgWideAllowed]);
  useEffect(() => { const t = setTimeout(() => fitView({ padding: 0.2, maxZoom: 1, duration: 300 }), 50); return () => clearTimeout(t); }, [fitView]);
  const themePref = useUi((s) => s.theme);
  const resolvedTheme: 'light' | 'dark' = themePref === 'system'
    ? (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : themePref;

  const kinds = catalog?.kinds ?? [];
  const kindOf = useCallback((type: string, kind: string) => kinds.find((k) => k.type === type && k.kind === kind), [kinds]);

  // Keep a one-line summary of each node's config on the canvas.
  const people = useMemo(() => new Map((team ?? []).map((u) => [u.id, u.fullName])), [team]);
  const displayNodes = useMemo(() => nodes.map((n) => ({ ...n, data: { ...n.data, summary: summarize(n.data, people) } })), [nodes, people]);

  const onConnect = useCallback((c: Connection) => {
    setDirty(true);
    const source = nodes.find((n) => n.id === c.source);
    const branch = source?.data.type === 'CONDITION' ? (c.sourceHandle as 'TRUE' | 'FALSE') : null;
    setEdges((eds) => addEdge({ ...c, id: `${c.source}-${c.target}`, ...edgeStyle(branch) }, eds.filter((e) =>
      // a condition branch can only lead to one place
      !(branch && e.source === c.source && e.sourceHandle === c.sourceHandle))));
  }, [nodes, setEdges]);

  const addNode = (k: CatalogKind, position?: { x: number; y: number }) => {
    if (k.type === 'TRIGGER' && nodes.some((n) => n.data.type === 'TRIGGER')) {
      toast({ tone: 'info', title: 'One trigger per workflow', body: 'Select the trigger to change what starts it.' });
      return;
    }
    const nid = `n${Date.now().toString(36)}`;
    const last = nodes[nodes.length - 1];
    setNodes((ns) => [...ns, {
      id: nid, type: 'block', position: position ?? { x: last?.position.x ?? 220, y: (last?.position.y ?? 0) + 140 },
      data: { type: k.type, kind: k.kind, label: k.label, config: {} },
    }]);
    setSelected(nid);
    setPanel('config');
    setDirty(true);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/nexora-node');
    if (!raw) return;
    const k = JSON.parse(raw) as CatalogKind;
    addNode(k, screenToFlowPosition({ x: e.clientX - 90, y: e.clientY - 30 }));
  };

  const updateNode = (nid: string, patch: Partial<FlowData>) => {
    setNodes((ns) => ns.map((n) => (n.id === nid ? { ...n, data: { ...n.data, ...patch } } : n)));
    setDirty(true);
  };

  const removeNode = (nid: string) => {
    setNodes((ns) => ns.filter((n) => n.id !== nid));
    setEdges((es) => es.filter((e) => e.source !== nid && e.target !== nid));
    setSelected(null);
    setDirty(true);
  };

  const payload = () => ({
    name: name.trim(), description: description.trim() || undefined, projectId, enabled,
    nodes: nodes.map((n) => ({ key: n.id, type: n.data.type, kind: n.data.kind, label: n.data.label, config: n.data.config, x: Math.round(n.position.x), y: Math.round(n.position.y) })),
    edges: edges.map((e) => {
      const src = nodes.find((n) => n.id === e.source);
      return { source: e.source, target: e.target, branch: src?.data.type === 'CONDITION' ? ((e.sourceHandle as 'TRUE' | 'FALSE') ?? null) : null };
    }),
  });

  const onSave = async () => {
    setErrors([]);
    const p = payload();
    const local = localValidate(p.name, p.nodes, p.edges, kinds);
    if (local.length) { setErrors(local); return; }
    try {
      const d = await save.mutateAsync({ id: workflowId ?? undefined, ...p });
      setDirty(false);
      toast({ tone: 'success', title: workflowId ? 'Workflow saved' : 'Workflow created', body: enabled ? 'It will run on the next matching event.' : 'It is disabled until you turn it on.' });
      if (!workflowId) navigate(`/workflows/${d.workflow.id}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INVALID_WORKFLOW') setErrors(e.message.split(' · '));
      else toast({ tone: 'error', title: 'Couldn’t save', body: errorMessage(e) });
    }
  };

  const showResult = (ex: Execution | null) => {
    const byNode = new Map(ex?.steps.map((s) => [s.node, s.result]) ?? []);
    setNodes((ns) => ns.map((n) => ({ ...n, data: { ...n.data, result: byNode.get(n.id) } })));
  };

  const sel = nodes.find((n) => n.id === selected) ?? null;

  return (
    <div className="builder">
      <div className="builder-top">
        <Link to="/workflows" className="btn btn-ghost btn-icon" aria-label="Back to workflows"><ArrowLeft /></Link>
        <input className="builder-name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} maxLength={120} aria-label="Workflow name" disabled={!manage} />
        <select className="select" style={{ width: 210 }} value={projectId ?? ''} disabled={!manage} aria-label="Scope"
          onChange={(e) => { setProjectId(e.target.value ? Number(e.target.value) : null); setDirty(true); }}>
          {orgWideAllowed && <option value="">All projects (organisation)</option>}
          {projects?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <label className="switch" title={enabled ? 'Enabled' : 'Disabled'}>
          <input type="checkbox" checked={enabled} disabled={!manage} onChange={(e) => { setEnabled(e.target.checked); setDirty(true); }} aria-label="Enabled" /><span />
        </label>
        <span className="grow" />
        {dirty && <span className="tiny subtle hide-sm">Unsaved changes</span>}
        {workflowId && <button className="btn" onClick={() => setPanel('test')}><FlaskConical /> Test run</button>}
        {manage && <button className="btn btn-primary" onClick={onSave} disabled={save.isPending}>{save.isPending ? <Spinner size={14} /> : <Save />} Save</button>}
      </div>

      {errors.length > 0 && (
        <div className="alert alert-danger builder-errors" role="alert">
          <div><div className="strong">Fix these before saving</div><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>
        </div>
      )}

      <div className="builder-body">
        {manage && (
          <aside className="palette-panel" aria-label="Blocks">
            {(['TRIGGER', 'CONDITION', 'ACTION'] as const).map((type) => (
              <div key={type}>
                <div className="nav-section" style={{ paddingLeft: 4 }}>{type === 'TRIGGER' ? 'Triggers' : type === 'CONDITION' ? 'Conditions' : 'Actions'}</div>
                {kinds.filter((k) => k.type === type).map((k) => (
                  <button key={k.kind} className={`palette-block t-${type.toLowerCase()}`} draggable title={k.description}
                    onDragStart={(e) => { e.dataTransfer.setData('application/nexora-node', JSON.stringify(k)); e.dataTransfer.effectAllowed = 'move'; }}
                    onClick={() => addNode(k)}>
                    <span className="pb-dot" />{k.label}
                  </button>
                ))}
              </div>
            ))}
            <p className="tiny subtle" style={{ padding: 6 }}>Drag blocks onto the canvas, then connect the dots. Conditions have Yes and No outputs.</p>
          </aside>
        )}
        <div className="canvas" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={onDrop}>
          <ReactFlow
            nodes={displayNodes} edges={edges} nodeTypes={nodeTypes}
            onNodesChange={(c) => { onNodesChange(c); if (c.some((x) => x.type === 'position' || x.type === 'remove')) setDirty(true); }}
            onEdgesChange={(c) => { onEdgesChange(c); if (c.some((x) => x.type === 'remove')) setDirty(true); }}
            onConnect={onConnect} onNodeClick={(_, n) => { setSelected(n.id); setPanel('config'); }} onPaneClick={() => setSelected(null)}
            nodesDraggable={manage} nodesConnectable={manage} elementsSelectable deleteKeyCode={manage ? ['Backspace', 'Delete'] : null}
            fitView fitViewOptions={{ padding: 0.2, maxZoom: 1 }} colorMode={resolvedTheme} proOptions={{ hideAttribution: true }} minZoom={0.3} maxZoom={1.6}>
            <Background gap={22} size={1.2} />
            <MiniMap pannable zoomable className="minimap" style={{ width: 150, height: 96 }} nodeColor={(n) => ((n.data as FlowData).type === 'TRIGGER' ? '#7c5cff' : (n.data as FlowData).type === 'CONDITION' ? '#f59e0b' : '#22d3ee')} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
        <aside className="inspector" aria-label="Inspector">
          <div className="segmented" style={{ margin: 12 }}>
            <button className={panel === 'config' ? 'on' : ''} onClick={() => setPanel('config')}>Block</button>
            {workflowId && <button className={panel === 'test' ? 'on' : ''} onClick={() => setPanel('test')}>Test</button>}
            {workflowId && <button className={panel === 'history' ? 'on' : ''} onClick={() => setPanel('history')}>Runs</button>}
          </div>
          <div className="inspector-body">
            {panel === 'config' && (sel
              ? <NodeConfig key={sel.id} node={sel} kind={kindOf(sel.data.type, sel.data.kind)} kinds={kinds} readOnly={!manage}
                  projectId={projectId} onChange={(p) => updateNode(sel.id, p)} onRemove={() => removeNode(sel.id)} placeholders={catalog?.placeholders ?? []} />
              : <WorkflowMeta description={description} setDescription={(v) => { setDescription(v); setDirty(true); }} readOnly={!manage} nodes={nodes.length} edges={edges.length} />)}
            {panel === 'test' && workflowId && <TestPanel workflowId={workflowId} projectId={projectId} dirty={dirty} onResult={showResult} />}
            {panel === 'history' && workflowId && <ExecutionList workflowId={workflowId} />}
          </div>
        </aside>
      </div>
    </div>
  );
}

function WorkflowMeta({ description, setDescription, readOnly, nodes, edges }: { description: string; setDescription: (v: string) => void; readOnly: boolean; nodes: number; edges: number }) {
  return (
    <div className="stack">
      <Field label="Description"><textarea className="textarea" rows={3} maxLength={500} value={description} disabled={readOnly} onChange={(e) => setDescription(e.target.value)} /></Field>
      <div className="small muted">{nodes} blocks · {edges} connections</div>
      <div className="hint-card small">
        <div className="strong">How it runs</div>
        <ol>
          <li>The trigger fires on a real task event.</li>
          <li>Conditions route the task down their Yes or No path.</li>
          <li>Actions run in order. If one fails, the whole run is rolled back and logged.</li>
        </ol>
        Select a block to configure it.
      </div>
    </div>
  );
}

function NodeConfig({ node, kind, kinds, readOnly, projectId, onChange, onRemove, placeholders }: {
  node: FlowNode; kind?: CatalogKind; kinds: CatalogKind[]; readOnly: boolean; projectId: number | null;
  onChange: (p: Partial<FlowData>) => void; onRemove: () => void; placeholders: string[];
}) {
  const { data: team } = useTeam();
  const { data: project } = useProjectMembersFor(projectId);
  const people = project ?? team?.map((u) => ({ id: u.id, name: u.fullName })) ?? [];
  const cfg = node.data.config;
  const set = (k: string, v: unknown) => onChange({ config: { ...cfg, [k]: v } });
  return (
    <div className="stack">
      <div className="row"><span className={`badge t-badge-${node.data.type.toLowerCase()}`}>{node.data.type.toLowerCase()}</span><span className="small muted">{kind?.description}</span></div>
      <Field label="Block type">
        <select className="select" value={node.data.kind} disabled={readOnly}
          onChange={(e) => { const k = kinds.find((x) => x.kind === e.target.value)!; onChange({ kind: k.kind, label: k.label, config: {} }); }}>
          {kinds.filter((k) => k.type === node.data.type).map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
        </select>
      </Field>
      <Field label="Label"><input className="input" value={node.data.label} maxLength={120} disabled={readOnly} onChange={(e) => onChange({ label: e.target.value })} /></Field>
      {kind?.fields.map((f) => {
        const v = cfg[f.name];
        const label = `${f.label}${f.required ? '' : ' (optional)'}`;
        if (f.type === 'status') return (
          <Field key={f.name} label={label}><select className="select" disabled={readOnly} value={String(v ?? '')} onChange={(e) => set(f.name, e.target.value || undefined)}>
            <option value="">{f.required ? 'Choose…' : 'Any'}</option>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></Field>
        );
        if (f.type === 'priority') return (
          <Field key={f.name} label={label}><select className="select" disabled={readOnly} value={String(v ?? '')} onChange={(e) => set(f.name, e.target.value || undefined)}>
            <option value="">Choose…</option>{PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Field>
        );
        if (f.type === 'user') return (
          <Field key={f.name} label={label} hint={node.data.kind === 'ASSIGN_USER' ? 'Must be a member of the project' : undefined}>
            <select className="select" disabled={readOnly} value={String(v ?? '')} onChange={(e) => set(f.name, e.target.value ? Number(e.target.value) : undefined)}>
              <option value="">Choose a person…</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        );
        if (f.type === 'number') return (
          <Field key={f.name} label={label}><input className="input" type="number" min={0} max={365} disabled={readOnly} value={String(v ?? '')} onChange={(e) => set(f.name, e.target.value === '' ? undefined : Number(e.target.value))} /></Field>
        );
        return (
          <Field key={f.name} label={label} hint={`Placeholders: ${placeholders.join(' ')}`}>
            <textarea className="textarea" rows={3} maxLength={500} disabled={readOnly} value={String(v ?? '')} onChange={(e) => set(f.name, e.target.value)} />
          </Field>
        );
      })}
      {!readOnly && <button className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onRemove}><Trash2 /> Remove block</button>}
    </div>
  );
}

/** People offered in "person" fields: project members for project workflows, the whole team otherwise. */
function useProjectMembersFor(projectId: number | null) {
  const { data } = useProject(projectId ?? 0);
  return { data: projectId ? data?.members.map((m) => ({ id: m.user.id, name: m.user.fullName })) : undefined };
}

function TestPanel({ workflowId, projectId, dirty, onResult }: { workflowId: number; projectId: number | null; dirty: boolean; onResult: (e: Execution | null) => void }) {
  const projectTasks = useTasks(projectId ?? 0);
  const mine = useMyTasks();
  const options = projectId ? projectTasks.data : mine.data;
  const [taskId, setTaskId] = useState('');
  const test = useTestWorkflow(workflowId);
  const [result, setResult] = useState<Execution | null>(null);
  const toast = useUi((s) => s.toast);
  useEffect(() => () => onResult(null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const run = () => test.mutate(Number(taskId), {
    onSuccess: (ex) => { setResult(ex); onResult(ex); },
    onError: (e) => toast({ tone: 'error', title: 'Test failed', body: errorMessage(e) }),
  });
  return (
    <div className="stack">
      <p className="small muted">A dry run evaluates the saved workflow against a real task. Conditions are checked for real; actions are only described, nothing changes.</p>
      {dirty && <div className="alert alert-warning">Save first. Tests run the saved version.</div>}
      <Field label="Task">
        <select className="select" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <option value="">Choose a task…</option>
          {options?.map((t) => <option key={t.id} value={t.id}>{t.key} · {t.title}</option>)}
        </select>
      </Field>
      <button className="btn btn-primary" disabled={!taskId || test.isPending} onClick={run}>{test.isPending ? <Spinner size={14} /> : <FlaskConical />} Run test</button>
      {result && (
        <div className="card card-pad">
          <div className="row" style={{ marginBottom: 8 }}><Check size={16} /><span className="strong">Result: {result.status.toLowerCase()}</span><span className="tiny subtle">{result.durationMs} ms</span></div>
          <StepTrace execution={result} />
        </div>
      )}
    </div>
  );
}

function summarize(d: FlowData, people: Map<number, string>): string | undefined {
  const c = d.config;
  const person = (v: unknown) => people.get(Number(v)) ?? 'someone';
  switch (d.kind) {
    case 'TASK_STATUS_CHANGED': return c.toStatus ? `to ${String(c.toStatus).replace('_', ' ').toLowerCase()}` : 'any column';
    case 'STATUS_IS': return c.status ? String(c.status).replace('_', ' ').toLowerCase() : undefined;
    case 'PRIORITY_AT_LEAST': case 'SET_PRIORITY': return c.priority ? String(c.priority).toLowerCase() : undefined;
    case 'SET_STATUS': return c.status ? `→ ${String(c.status).replace('_', ' ').toLowerCase()}` : undefined;
    case 'DUE_WITHIN_DAYS': return c.days != null ? `≤ ${c.days} days` : undefined;
    case 'TITLE_CONTAINS': return c.text ? `“${c.text}”` : undefined;
    case 'ASSIGN_USER': case 'NOTIFY_USER': return c.userId ? person(c.userId) : undefined;
    case 'NOTIFY_ASSIGNEE': case 'NOTIFY_PROJECT_OWNER': return c.message ? String(c.message).slice(0, 40) : undefined;
    case 'ADD_COMMENT': return c.text ? String(c.text).slice(0, 40) : undefined;
    default: return undefined;
  }
}

/** Mirrors GraphValidator.java for instant feedback; the server re-validates on save. */
export function localValidate(name: string, nodes: WorkflowNodeDto[], edges: WorkflowEdgeDto[], kinds: CatalogKind[]): string[] {
  const errors: string[] = [];
  if (!name) errors.push('Give the workflow a name');
  const triggers = nodes.filter((n) => n.type === 'TRIGGER');
  if (triggers.length !== 1) errors.push(`A workflow needs exactly one trigger (found ${triggers.length})`);
  if (!nodes.some((n) => n.type === 'ACTION')) errors.push('Add at least one action');
  for (const n of nodes) {
    const k = kinds.find((x) => x.type === n.type && x.kind === n.kind);
    k?.fields.filter((f) => f.required).forEach((f) => {
      const v = n.config[f.name];
      if (v === undefined || v === null || String(v).trim() === '') errors.push(`“${n.label || n.kind}” needs a value for ${f.label}`);
    });
    if (n.type === 'CONDITION' && !edges.some((e) => e.source === n.key)) errors.push(`Condition “${n.label}” isn't connected to anything`);
  }
  if (triggers.length === 1) {
    const reach = new Set<string>();
    const stack = [triggers[0].key];
    while (stack.length) {
      const k = stack.pop()!;
      if (reach.has(k)) continue;
      reach.add(k);
      edges.filter((e) => e.source === k).forEach((e) => stack.push(e.target));
    }
    nodes.filter((n) => !reach.has(n.key)).forEach((n) => errors.push(`“${n.label || n.kind}” isn't reachable from the trigger`));
  }
  return errors;
}
