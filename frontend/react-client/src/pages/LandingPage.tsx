import { Link } from 'react-router-dom';
import {
  ArrowRight, Activity, BrainCircuit, GitBranch, Gauge, Radio, Scale, ShieldCheck, Sparkles, Workflow, Zap,
} from 'lucide-react';
import { HealthRing, Logo } from '../components/ui';

const FEATURES = [
  { icon: Workflow, title: 'Visual automation studio', body: 'Drag triggers, conditions and actions onto a canvas. NEXORA validates the graph, runs it on real events and keeps a step-by-step history.' },
  { icon: Gauge, title: 'Project health score', body: 'One number from 0 to 100, broken down into the six factors that moved it, so you know exactly what to fix first.' },
  { icon: BrainCircuit, title: 'Explainable risk detection', body: 'Delay forecasts from your real throughput, with plain-language reasons. Rules you can read, not a black box.' },
  { icon: Scale, title: 'Workload balancing', body: 'See who is over capacity across every project, and move work in one click to the teammate with the most room.' },
  { icon: Radio, title: 'Real-time collaboration', body: 'Boards, comments and notifications update live. See who else is on the board and who is typing.' },
  { icon: ShieldCheck, title: 'Enterprise-grade control', body: 'Roles and permissions, audit trails, plan limits and an admin console to run the whole platform.' },
];

export function LandingPage() {
  return (
    <div className="landing">
      <div className="aurora" aria-hidden />
      <header className="lp-nav">
        <div className="brand"><Logo /> NEXORA</div>
        <nav className="lp-links">
          <a href="#features">Features</a>
          <a href="#automation">Automation</a>
          <a href="#insights">Insights</a>
          <a href="#stack">Architecture</a>
        </nav>
        <div className="row">
          <Link to="/login" className="btn btn-ghost">Log in</Link>
          <Link to="/register" className="btn btn-primary">Start free <ArrowRight /></Link>
        </div>
      </header>

      <section className="lp-hero">
        <span className="pill"><Sparkles size={14} /> Intelligent workflow &amp; collaboration ecosystem</span>
        <h1 className="lp-title">Run every project like<br /><span className="grad-text">it’s your only one.</span></h1>
        <p className="lp-sub">
          NEXORA combines Kanban, automation and explainable project intelligence in one workspace,
          so teams spot risk early, balance the load and let the busywork run itself.
        </p>
        <div className="row" style={{ justifyContent: 'center', gap: 12, marginTop: 28 }}>
          <Link to="/register" className="btn btn-primary btn-lg">Create your workspace <ArrowRight /></Link>
          <Link to="/login" className="btn btn-lg">Explore the demo</Link>
        </div>
        <HeroPreview />
      </section>

      <section id="features" className="lp-section">
        <div className="lp-eyebrow">Everything in one place</div>
        <h2 className="lp-h2">Built for teams juggling many projects at once</h2>
        <div className="lp-features">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <article key={title} className="lp-feature card glow-border">
              <div className="lp-feature-icon"><Icon size={20} /></div>
              <h3>{title}</h3>
              <p className="muted">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="automation" className="lp-section lp-split">
        <div>
          <div className="lp-eyebrow">Automation studio</div>
          <h2 className="lp-h2 left">If this, then that,<br />for your whole delivery process.</h2>
          <ul className="lp-list">
            <li><Zap size={16} /> Triggers: task created, moved, assigned, commented or overdue</li>
            <li><GitBranch size={16} /> Yes/No conditions on status, priority, due date, title or owner</li>
            <li><Activity size={16} /> Actions that assign, escalate, notify and comment, with a dry-run tester</li>
          </ul>
        </div>
        <FlowIllustration />
      </section>

      <section id="insights" className="lp-section lp-split reverse">
        <div className="card lp-insight">
          <div className="row-3">
            <HealthRing score={62} size={88} />
            <div>
              <div className="strong">Atlas Mobile App</div>
              <div className="badge badge-warning" style={{ marginTop: 6 }}>Medium risk</div>
              <div className="small muted" style={{ marginTop: 6 }}>Projected 6 days late at 1.4 points/day</div>
            </div>
          </div>
          <div className="divider" />
          {[['Schedule slip', 14, 25, '64% of the timeline has passed, 41% of points are done'], ['Overdue work', 8, 30, '3 of 11 open tasks are past due'], ['Team overload', 4, 10, '1 member above 100% capacity'], ['Stale work', 2, 10, '1 in-progress task untouched for 7+ days']].map(([l, p, m, d]) => (
            <div key={l as string} className="lp-factor">
              <div className="spread small"><span className="strong">{l}</span><span className="danger-text">−{p}</span></div>
              <div className="progress" style={{ height: 5 }}><span style={{ width: `${((p as number) / (m as number)) * 100}%`, background: 'var(--danger)' }} /></div>
              <div className="tiny subtle">{d}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="lp-eyebrow">Explainable insights</div>
          <h2 className="lp-h2 left">Know why a project is at risk, not just that it is.</h2>
          <p className="muted lp-p">
            Health scores, delay forecasts, priority recommendations and workload suggestions are calculated from
            transparent rules over your live data. Every number comes with the reason behind it.
          </p>
        </div>
      </section>

      <section id="stack" className="lp-section">
        <div className="lp-eyebrow">Under the hood</div>
        <h2 className="lp-h2">A real microservice architecture</h2>
        <div className="lp-stack">
          {[['React + TypeScript', 'Product app'], ['Angular', 'Admin console'], ['Spring Boot', 'Core API & engines'], ['Node.js + Socket.IO', 'Real-time gateway'], ['MySQL', 'System of record'], ['Redis Streams', 'Events & presence'], ['Nginx', 'Edge proxy'], ['Docker + Actions', 'Delivery']].map(([t, s]) => (
            <div key={t} className="lp-stack-item card"><div className="strong">{t}</div><div className="small muted">{s}</div></div>
          ))}
        </div>
      </section>

      <section className="lp-cta card glow-border">
        <h2 className="lp-h2">Ready to see your projects clearly?</h2>
        <p className="muted">Create a workspace in under a minute. Free for teams of up to five.</p>
        <Link to="/register" className="btn btn-primary btn-lg" style={{ marginTop: 18 }}>Get started <ArrowRight /></Link>
      </section>

      <footer className="lp-footer">
        <div className="brand" style={{ padding: 0 }}><Logo size={22} /> NEXORA</div>
        <span className="subtle small">© {new Date().getFullYear()} NEXORA · A portfolio project by Suresh Kumar N</span>
      </footer>
    </div>
  );
}

function HeroPreview() {
  const cols: [string, string, { t: string; k: string; p: string }[]][] = [
    ['To do', 'var(--status-todo)', [{ t: 'Conflict resolution for edits', k: 'ATL-3', p: 'var(--prio-high)' }, { t: 'Push notifications', k: 'ATL-4', p: 'var(--prio-medium)' }]],
    ['In progress', 'var(--status-progress)', [{ t: 'Background sync engine', k: 'ATL-2', p: 'var(--prio-critical)' }, { t: 'Job map with clustering', k: 'ATL-7', p: 'var(--prio-high)' }]],
    ['Done', 'var(--status-done)', [{ t: 'SSO with identity provider', k: 'ATL-15', p: 'var(--prio-high)' }]],
  ];
  return (
    <div className="hero-preview glass glow-border" aria-hidden>
      <div className="hp-bar"><span /><span /><span /><div className="hp-url">app.nexora.dev/projects/atlas/board</div></div>
      <div className="hp-body">
        <div className="hp-board">
          {cols.map(([name, color, cards]) => (
            <div key={name} className="hp-col">
              <div className="hp-col-head"><i style={{ background: color }} />{name}<b>{cards.length}</b></div>
              {cards.map((c, i) => (
                <div key={c.k} className="hp-card" style={{ animationDelay: `${i * 0.2}s` }}>
                  <div className="tiny key">{c.k}</div>
                  <div className="small strong">{c.t}</div>
                  <div className="row" style={{ marginTop: 6 }}><i className="hp-prio" style={{ background: c.p }} /><span className="hp-av" /></div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="hp-side">
          <div className="card hp-mini"><HealthRing score={81} size={64} stroke={7} /><div><div className="small strong">Helios Data</div><div className="tiny subtle">On track</div></div></div>
          <div className="card hp-mini col" style={{ alignItems: 'stretch' }}>
            <div className="tiny subtle">Live activity</div>
            <div className="hp-feed"><span className="hp-dot" />Diego moved ATL-2 to In review</div>
            <div className="hp-feed"><span className="hp-dot" style={{ background: 'var(--brand-2)' }} />⚡ Auto-assign ran on ATL-17</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowIllustration() {
  return (
    <div className="flow-illus card glow-border" aria-hidden>
      <svg viewBox="0 0 520 260" width="100%">
        <defs>
          <linearGradient id="fl" x1="0" x2="1"><stop offset="0" stopColor="#7C5CFF" /><stop offset="1" stopColor="#22D3EE" /></linearGradient>
        </defs>
        {[['M120 130 C170 130 170 130 210 130', 0], ['M330 120 C370 120 370 60 410 60', .4], ['M330 140 C370 140 370 200 410 200', .8]].map(([d, delay]) => (
          <g key={d as string}>
            <path d={d as string} stroke="var(--border-strong)" strokeWidth="2" fill="none" />
            <path d={d as string} stroke="url(#fl)" strokeWidth="2.5" fill="none" className="flow-dash" style={{ animationDelay: `${delay}s` }} />
          </g>
        ))}
        {[[20, 105, 'TRIGGER', 'Task created', '#7C5CFF'], [210, 105, 'CONDITION', 'Title has “bug”', '#F59E0B'], [410, 35, 'ACTION', 'Priority → High', '#22D3EE'], [410, 175, 'ACTION', 'Notify owner', '#22D3EE']].map(([x, y, t, l, c]) => (
          <g key={l as string} transform={`translate(${x} ${y})`}>
            <rect width="110" height="50" rx="12" fill="var(--surface-2)" stroke={c as string} strokeOpacity=".6" />
            <text x="12" y="20" fontSize="9" fill={c as string} fontWeight="700" letterSpacing=".08em">{t}</text>
            <text x="12" y="37" fontSize="11.5" fill="var(--text)" fontWeight="600">{l}</text>
          </g>
        ))}
        <text x="352" y="100" fontSize="10" fill="var(--success)" fontWeight="700">YES</text>
      </svg>
    </div>
  );
}
