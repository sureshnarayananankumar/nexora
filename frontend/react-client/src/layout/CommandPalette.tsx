import { useMemo, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CornerDownLeft, FileText, FolderKanban, Search } from 'lucide-react';
import { useMyTasks, useProjects } from '../api/queries';

interface Item { id: string; label: string; hint: string; to: string; kind: 'page' | 'project' | 'task' }

const PAGES: Item[] = [
  ['Dashboard', '/dashboard'], ['Projects', '/projects'], ['Automation studio', '/workflows'], ['New workflow', '/workflows/new'],
  ['Analytics', '/analytics'], ['Calendar', '/calendar'], ['Team & workload', '/team'], ['Notifications', '/notifications'], ['Settings', '/settings'],
].map(([label, to]) => ({ id: `p:${to}`, label, hint: 'Page', to, kind: 'page' as const }));

/** ⌘K quick navigation across pages, projects and my tasks. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const { data: tasks } = useMyTasks();

  const items = useMemo(() => {
    const all: Item[] = [
      ...PAGES,
      ...(projects ?? []).map((p) => ({ id: `pr:${p.id}`, label: p.name, hint: p.key, to: `/projects/${p.id}/board`, kind: 'project' as const })),
      ...(tasks ?? []).map((t) => ({ id: `t:${t.id}`, label: t.title, hint: t.key, to: `/projects/${t.projectId}/board?task=${t.id}`, kind: 'task' as const })),
    ];
    const needle = q.trim().toLowerCase();
    return (needle ? all.filter((i) => `${i.label} ${i.hint}`.toLowerCase().includes(needle)) : all).slice(0, 12);
  }, [q, projects, tasks]);

  const go = (i?: Item) => {
    if (!i) return;
    navigate(i.to);
    onClose();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter') go(items[active]);
    if (e.key === 'Escape') onClose();
  };

  return createPortal(
    <div className="modal-backdrop" style={{ placeItems: 'start center', paddingTop: '12vh' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal palette" role="dialog" aria-label="Command palette">
        <div className="palette-input">
          <Search size={18} />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKey}
            placeholder="Jump to a project, task or page…" aria-label="Search" />
        </div>
        <div className="palette-list" role="listbox">
          {items.length === 0 && <div className="subtle" style={{ padding: 18 }}>No matches for “{q}”</div>}
          {items.map((i, idx) => {
            const Icon = i.kind === 'project' ? FolderKanban : i.kind === 'task' ? FileText : ArrowRight;
            return (
              <button key={i.id} role="option" aria-selected={idx === active} className={`palette-item ${idx === active ? 'on' : ''}`}
                onMouseEnter={() => setActive(idx)} onClick={() => go(i)}>
                <Icon size={16} /><span className="grow truncate">{i.label}</span><span className="key">{i.hint}</span>
                {idx === active && <CornerDownLeft size={14} className="subtle" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
