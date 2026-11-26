import { Link } from 'react-router-dom'
import { clock, mins, now, today, addDays, fmt } from '../dates'
import { cls, periodsOn, useDB } from '../store'
import { Page } from '../ui'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const S = 8 * 60 + 30, E = 15 * 60 + 30
const y = (m: number) => `${((m - S) / (E - S)) * 100}%`

export default function Schedule() {
  const db = useDB()
  const wd = now().getDay()
  const monday = addDays(today(), 1 - (wd || 7))
  return (
    <Page title="Schedule" sub={`Week of ${fmt(monday)}`} back="/">
      <div className="panel"><div className="scroll"><div className="week">
        <span />
        {DAYS.map((d, i) => <div key={d} className={`dh ${wd === i + 1 ? 'on' : ''}`}>{d} {Number(addDays(monday, i).slice(8))}</div>)}
        <div className="lane" style={{ border: 0 }}>{Array.from({ length: 7 }, (_, i) => 9 + i).map(h => <span key={h} className="t" style={{ top: y(h * 60) }}>{((h + 11) % 12) + 1} {h < 12 ? 'AM' : 'PM'}</span>)}</div>
        {DAYS.map((d, i) => (
          <div key={d} className={`lane ${wd === i + 1 ? 'on' : ''}`}>
            {periodsOn(db, i + 1).map(p => {
              const c = cls(db, p.classId)
              return <Link key={p.start} to={`/classes/${c.id}`} className="wl" data-hue={c.hue} style={{ top: y(mins(p.start)), height: `${((mins(p.end) - mins(p.start)) / (E - S)) * 100}%` }}><strong>{c.name}</strong>{clock(p.start)}</Link>
            })}
          </div>
        ))}
      </div></div></div>
    </Page>
  )
}
