import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, BarChart3, CalendarDays, FolderKanban, LayoutDashboard, LogOut, Menu as MenuIcon, Monitor, Moon,
  Settings, Sun, Users, Workflow, Search, Wifi, WifiOff,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../stores/auth';
import { useUi } from '../stores/ui';
import { RealtimeProvider } from '../hooks/realtime';
import { useProjects, usePublicConfig, useUnreadCount, updatePreferences } from '../api/queries';
import { Avatar, AvatarStack, Logo, Menu } from '../components/ui';
import { CommandPalette } from './CommandPalette';
import type { Theme } from '../api/types';

export function AppShell() {
  return (
    <RealtimeProvider>
      <Shell />
    </RealtimeProvider>
  );
}

function Shell() {
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const { data: config } = usePublicConfig();
  useEffect(() => setNavOpen(false), [location.pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shell">
      <Sidebar open={navOpen} />
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}
      <div className="main">
        {config?.announcement && <div className="announcement">{config.announcement}</div>}
        <Topbar onMenu={() => setNavOpen(true)} onSearch={() => setPaletteOpen(true)} />
        <main className="content" id="main">
          <Outlet />
        </main>
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}

function Sidebar({ open }: { open: boolean }) {
  const { data: projects } = useProjects();
  const links = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/projects', icon: FolderKanban, label: 'Projects' },
    { to: '/workflows', icon: Workflow, label: 'Automation' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/calendar', icon: CalendarDays, label: 'Calendar' },
    { to: '/team', icon: Users, label: 'Team' },
  ];
  return (
    <nav className={`sidebar ${open ? 'open' : ''}`} aria-label="Main">
      <div className="brand"><Logo /> NEXORA</div>
      {links.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon /> {label}
        </NavLink>
      ))}
      <div className="nav-section">Projects</div>
      {(projects ?? []).slice(0, 8).map((p) => (
        <NavLink key={p.id} to={`/projects/${p.id}/board`} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="nav-project-dot" style={{ background: p.color }} />
          <span className="truncate">{p.name}</span>
        </NavLink>
      ))}
      {projects && projects.length === 0 && <div className="subtle small" style={{ padding: '4px 10px' }}>No projects yet</div>}
      <div style={{ flex: 1 }} />
      <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Settings /> Settings</NavLink>
    </nav>
  );
}

function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const user = useAuth((s) => s.user)!;
  const online = useUi((s) => s.orgOnline);
  const connected = useUi((s) => s.realtimeConnected);
  const { theme, setTheme } = useUi();
  const { data: unread } = useUnreadCount();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const changeTheme = async (t: Theme) => {
    setTheme(t);
    try {
      const me = await updatePreferences({ theme: t, dashboardLayout: user.dashboardLayout ?? [] });
      useAuth.getState().setUser(me);
    } catch { /* theme still applies locally */ }
  };

  const logout = async () => {
    await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    useAuth.getState().clear();
    qc.clear();
    navigate('/login');
  };

  const others = online.filter((u) => u.id !== user.id);
  return (
    <header className="topbar">
      <button className="btn btn-ghost btn-icon mobile-only" onClick={onMenu} aria-label="Open navigation"><MenuIcon /></button>
      <button className="search-trigger" onClick={onSearch}>
        <Search size={16} /> <span>Search projects, tasks, pages…</span> <kbd>⌘K</kbd>
      </button>
      <div className="grow" />
      <span className="row small subtle" title={connected ? 'Live updates connected' : 'Reconnecting…'}>
        {connected ? <Wifi size={15} color="var(--success)" /> : <WifiOff size={15} />}
      </span>
      {others.length > 0 && (
        <span className="row small muted hide-sm" title={others.map((u) => u.name).join(', ')}>
          <AvatarStack users={others.map((u) => ({ fullName: u.name, avatarColor: colorFor(u.id) }))} max={3} size={24} />
          <span>{others.length} online</span>
        </span>
      )}
      <button className="btn btn-ghost btn-icon bell" onClick={() => navigate('/notifications')} aria-label={`Notifications (${unread?.count ?? 0} unread)`}>
        <Bell />
        {!!unread?.count && <span className="bell-count">{unread.count > 9 ? '9+' : unread.count}</span>}
      </button>
      <Menu trigger={(toggle) => (
        <button className="btn btn-ghost" style={{ padding: '0 6px' }} onClick={toggle} aria-label="Account menu"><Avatar user={user} size={30} /></button>
      )}>
        {(close) => (
          <>
            <div style={{ padding: '8px 10px 10px' }}>
              <div className="strong">{user.fullName}</div>
              <div className="small subtle">{user.email}</div>
              <div className="row" style={{ marginTop: 8 }}>
                <span className="badge badge-accent">{user.role.replace('_', ' ')}</span>
                <span className="badge">{user.organization.name}</span>
              </div>
            </div>
            <div className="divider" style={{ margin: '4px 0' }} />
            <div className="theme-switch" role="radiogroup" aria-label="Theme">
              {([['light', Sun], ['dark', Moon], ['system', Monitor]] as const).map(([t, Icon]) => (
                <button key={t} role="radio" aria-checked={theme === t} className={theme === t ? 'on' : ''} onClick={() => changeTheme(t)}>
                  <Icon size={14} /> {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <button className="menu-item" onClick={() => { close(); navigate('/settings'); }}><Settings /> Settings</button>
            <button className="menu-item" onClick={logout}><LogOut /> Log out</button>
          </>
        )}
      </Menu>
    </header>
  );
}

const PALETTE = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
export const colorFor = (id: number) => PALETTE[id % PALETTE.length];
