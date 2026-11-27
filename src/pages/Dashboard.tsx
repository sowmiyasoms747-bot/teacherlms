import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck, ClipboardCheck, ClipboardList, ListChecks, MessageSquare, Send, TrendingUp, Upload } from 'lucide-react'
import type { CSSProperties } from 'react'
import { average, cls, inClass, notices, nowMins, pendingOf, pendingTotal, periodsOn, stateOf, useDB } from '../store'
import { clock, fmtLong, mins, now, today } from '../dates'
import { Btn, ClassMark, Empty, Panel } from '../ui'

const START = 8 * 60 + 30, END = 15 * 60 + 30
const pct = (m: number) => `${((m - START) / (END - START)) * 100}%`
const at = (m: number, len?: number) => ({ '--x': pct(m), ...(len ? { '--w': `${(len / (END - START)) * 100}%` } : {}) }) as CSSProperties
const pc = (v: number | null) => v === null ? '–' : `${v}%`
/** 10:15 – 11:15 AM: the first half-day mark is dropped when both match. */
const span = (a: string, b: string) => { const x = clock(a), y = clock(b); return `${x.slice(-2) === y.slice(-2) ? x.slice(0, -3) : x} – ${y}` }
const ICON = { review: ClipboardCheck, message: MessageSquare }

const QUICK = [
  { label: 'Upload Material', icon: Upload, to: '/library/upload' },
  { label: 'Create Assignment', icon: ClipboardList, to: '/assignments?new=1' },
  { label: 'Create Quiz', icon: ListChecks, to: '/quizzes/new' },
  { label: 'View Progress', icon: TrendingUp, to: '/progress' },
  { label: 'Send Message', icon: Send, to: '/messages?new=1' },
]

export default function Dashboard() {
  const db = useDB()
  const t = nowMins(), hr = now().getHours()
  const periods = periodsOn(db, now().getDay())
  const current = periods.find(p => mins(p.start) <= t && t < mins(p.end))
  const next = periods.find(p => mins(p.start) > t)
  const focus = current ?? next
  const list = notices(db)
  const hours = Array.from({ length: 7 }, (_, i) => 9 + i)

  return (
    <div className="page">
      <section className="day" aria-label="Today's schedule">
        <div className="day-head">
          <div>
            <h1>Good {hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening'}, {db.settings.name}</h1>
            <p className="muted" style={{ marginTop: 6 }}>{fmtLong(today())}. {periods.length ? `${periods.length} lessons today.` : 'No lessons today.'} <Link className="link" to="/schedule" style={{ marginLeft: 6 }}>View week <ArrowRight size={15} /></Link></p>
          </div>
          <div className="day-stats">
            <Link to="/classes"><b>{db.classes.length}</b><span>My Classes</span></Link>
            <Link to="/progress"><b>{db.students.length}</b><span>Total Students</span></Link>
            <Link to="/library"><b>{db.materials.length}</b><span>Materials</span></Link>
            <Link to="/assignments"><b>{pendingTotal(db)}</b><span>Pending Reviews</span></Link>
          </div>
        </div>
        <div className="strip">
          {hours.map(h => <span key={h} className="hours"><span className="hr" style={at(h * 60)}>{((h + 11) % 12) + 1}:00</span><span className="hl" style={at(h * 60)} /></span>)}
          {periods.map(p => {
            const c = cls(db, p.classId), past = mins(p.end) <= t, live = p === current
            return (
              <Link key={p.start} to={`/classes/${p.classId}`} className={`lesson ${past ? 'past' : ''}`} data-hue={c.hue} style={at(mins(p.start), mins(p.end) - mins(p.start))}>
                <strong>{c.name}</strong>
                <span>{span(p.start, p.end)}<br />{live ? 'On now' : past ? 'Finished' : c.room}</span>
              </Link>
            )
          })}
          {t > START && t < END && <span className="nowline" style={at(t)}><b>{clock(`${hr}:${now().getMinutes()}`)}</b></span>}
        </div>
        <div className="nowbar">
          {focus ? <>
            <p>{current ? <><strong>{cls(db, focus.classId).name} is on now.</strong> <span className="muted">Ends in {mins(focus.end) - t} minutes, {cls(db, focus.classId).room}.</span></> : <><strong>Next: {cls(db, focus.classId).name}</strong> <span className="muted">at {clock(focus.start)}, {cls(db, focus.classId).room}.</span></>}</p>
            <div className="row wrap"><Btn kind="primary" to={`/classes/${focus.classId}`}>Open class</Btn></div>
          </> : <p className="muted">No more lessons today.</p>}
        </div>
      </section>

      <div className="grid-2">
        <Panel title="Needs your attention" flush>
          {list.length ? (
            <ul className="list">
              {list.map(n => {
                const I = ICON[n.kind]
                return (
                  <li key={n.id} className="item">
                    <span className="ico"><I size={19} aria-hidden /></span>
                    <div className="body"><strong>{n.text}</strong><span className="muted small clip">{n.detail}</span></div>
                    <Btn small to={n.to}>{n.action}</Btn>
                  </li>
                )
              })}
            </ul>
          ) : <Empty icon={CircleCheck} title="All caught up" text="Work is reviewed and messages are read." />}
        </Panel>
        <Panel title="Quick actions">
          <div className="quick">{QUICK.map(q => <Link key={q.label} to={q.to}><q.icon size={21} aria-hidden />{q.label}</Link>)}</div>
        </Panel>
      </div>

      <section className="stack" style={{ gap: 12 }}>
        <div className="row between"><h2>Class pulse</h2><Link className="link" to="/reports">Full report <ArrowRight size={15} /></Link></div>
        <div className="pulse">
          {db.classes.map(c => {
            const n = db.assignments.filter(a => a.classId === c.id && stateOf(a) === 'Active').length
            return (
              <Link key={c.id} to={`/classes/${c.id}`} data-hue={c.hue}>
                <div className="row"><ClassMark c={c} /><div><strong>{c.name}</strong><div className="muted small">{inClass(db, c.id).length} students, {n || 'no'} active {n === 1 ? 'assignment' : 'assignments'}</div></div></div>
                <dl><div><dt>To review</dt><dd>{db.assignments.filter(a => a.classId === c.id).reduce((s, a) => s + pendingOf(a), 0)}</dd></div><div><dt>Latest test</dt><dd>{pc(average(inClass(db, c.id)))}</dd></div></dl>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
