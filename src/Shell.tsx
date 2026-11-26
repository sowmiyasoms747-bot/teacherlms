import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CalendarCheck, CalendarDays, ChartColumn, Check, ClipboardList, LayoutDashboard, Library, ListChecks, Menu as MenuIcon, MessageSquare, Plus, Search, Send, Settings, TrendingUp, Upload, Users, type LucideIcon } from 'lucide-react'
import { notices, pendingTotal, useDB, useStore } from './store'
import { Avatar, Btn, Menu, useDismiss } from './ui'

const CREATE = [
  { label: 'Upload material', icon: Upload, to: '/library/upload' },
  { label: 'Create assignment', icon: ClipboardList, to: '/assignments?new=1' },
  { label: 'Create quiz', icon: ListChecks, to: '/quizzes/new' },
  { label: 'Send message', icon: Send, to: '/messages?new=1' },
]

function Item({ to, icon: I, label, n, end }: { to: string; icon: LucideIcon; label: string; n?: number; end?: boolean }) {
  return <NavLink to={to} end={end}><I size={18} aria-hidden />{label}{!!n && <span className="n" aria-label={`${n} waiting`}>{n}</span>}</NavLink>
}

function SearchBox() {
  const db = useDB()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const nav = useNavigate()
  useDismiss(ref, open, () => setOpen(false))
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(el.tagName)) { e.preventDefault(); input.current?.focus() }
    }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [])
  const t = q.trim().toLowerCase()
  const name = (id: string) => db.classes.find(c => c.id === id)?.name ?? ''
  const hits = !t ? [] : [
    ...db.classes.filter(c => `${c.name} ${c.id}`.toLowerCase().includes(t)).map(c => ({ id: c.id, label: c.name, kind: 'Class', to: `/classes/${c.id}` })),
    ...db.students.filter(s => s.name.toLowerCase().includes(t)).slice(0, 5).map(s => ({ id: s.id, label: s.name, kind: name(s.classId), to: `/classes/${s.classId}?tab=students&student=${s.id}` })),
    ...db.assignments.filter(a => a.title.toLowerCase().includes(t)).slice(0, 4).map(a => ({ id: a.id, label: a.title, kind: 'Assignment', to: `/assignments/${a.id}` })),
    ...db.quizzes.filter(a => a.title.toLowerCase().includes(t)).slice(0, 4).map(a => ({ id: a.id, label: a.title, kind: 'Quiz', to: `/quizzes/${a.id}` })),
    ...db.materials.filter(a => a.title.toLowerCase().includes(t)).slice(0, 4).map(a => ({ id: a.id, label: a.title, kind: a.type, to: `/library?q=${encodeURIComponent(a.title)}` })),
  ]
  const go = (to: string) => { setOpen(false); setQ(''); nav(to) }
  return (
    <div className="search" ref={ref} role="search">
      <Search size={17} aria-hidden />
      <input ref={input} type="search" aria-label="Search classes, students and work" placeholder="Search classes, students, work" value={q} onFocus={() => setOpen(true)} onChange={e => { setQ(e.target.value); setOpen(true) }} onKeyDown={e => { if (e.key === 'Enter' && hits[0]) go(hits[0].to) }} />
      {open && t && (
        <div className="pop">
          {hits.length ? hits.map(h => <a key={h.id} href={`#${h.to}`} onClick={e => { e.preventDefault(); go(h.to) }}><span className="clip">{h.label}</span><small>{h.kind}</small></a>) : <p className="muted" style={{ padding: 10 }}>No matches for “{q}”</p>}
        </div>
      )}
    </div>
  )
}

function Bells() {
  const db = useDB()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, open, () => setOpen(false))
  const list = notices(db)
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="icon-btn" aria-expanded={open} aria-label={`Notifications, ${list.length} waiting`} onClick={() => setOpen(o => !o)}><Bell size={20} />{list.length > 0 && <span className="pip">{list.length}</span>}</button>
      {open && (
        <div className="pop right notes">
          <h2>Notifications</h2>
          {list.length ? list.map(n => <Link key={n.id} to={n.to} onClick={() => setOpen(false)}><strong>{n.text}</strong><span className="muted small clip">{n.detail}</span></Link>) : <p className="muted" style={{ padding: '4px 10px 12px' }}>You are all caught up.</p>}
        </div>
      )}
    </div>
  )
}

export default function Shell({ children }: { children: ReactNode }) {
  const { db, toasts } = useStore()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [loc.pathname])
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [open])
  const unread = db.threads.filter(t => t.unread).length
  return (
    <div className="shell">
      <aside className={`rail ${open ? 'open' : ''}`} aria-label="Main">
        <Link className="brand" to="/"><img src="./favicon.svg" width={40} height={40} alt="" /><span><b>Learning Universe</b><span>Teacher Portal</span></span></Link>
        <nav className="nav"><Item to="/" end icon={LayoutDashboard} label="Dashboard" /><Item to="/schedule" icon={CalendarDays} label="Schedule" /><Item to="/messages" icon={MessageSquare} label="Messages" n={unread} /></nav>
        <nav className="nav" aria-label="Classes"><h3>Classes</h3><Item to="/classes" end icon={Users} label="My Classes" />{db.classes.map(c => <NavLink key={c.id} to={`/classes/${c.id}`} data-hue={c.hue}><i className="cdot" />{c.name}</NavLink>)}</nav>
        <nav className="nav" aria-label="Teach"><h3>Teach</h3><Item to="/library" icon={Library} label="Content Library" /><Item to="/assignments" icon={ClipboardList} label="Assignments" n={pendingTotal(db)} /><Item to="/quizzes" icon={ListChecks} label="Quizzes" /></nav>
        <nav className="nav" aria-label="Track"><h3>Track</h3><Item to="/attendance" icon={CalendarCheck} label="Attendance" /><Item to="/progress" icon={TrendingUp} label="Student Progress" /><Item to="/reports" icon={ChartColumn} label="Reports & Analytics" /></nav>
        <Link className="me" to="/settings"><Avatar name={db.settings.name} /><span className="grow"><strong className="clip" style={{ display: 'block', lineHeight: 1.25 }}>{db.settings.name}</strong><span className="s">Settings</span></span><Settings size={17} aria-hidden /></Link>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <div className="topbar">
          <button type="button" className="icon-btn only-sm" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><MenuIcon size={21} /></button>
          <SearchBox />
          <div className="end">
            <Bells />
            <Menu items={CREATE} trigger={p => <Btn kind="primary" icon={Plus} aria-label="Create" {...p}>Create</Btn>} />
          </div>
        </div>
        <main>{children}</main>
      </div>
      <nav className="dockbar" aria-label="Quick">
        <NavLink to="/" end><LayoutDashboard size={21} />Today</NavLink>
        <NavLink to="/classes"><Users size={21} />Classes</NavLink>
        <NavLink to="/attendance"><CalendarCheck size={21} />Register</NavLink>
        <NavLink to="/assignments"><ClipboardList size={21} />Work</NavLink>
        <NavLink to="/messages"><MessageSquare size={21} />Messages</NavLink>
      </nav>
      <div className="toasts" role="status" aria-live="polite">{toasts.map(t => <div key={t.id}><Check size={17} aria-hidden />{t.text}</div>)}</div>
    </div>
  )
}
