import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Download, Users } from 'lucide-react'
import type { Mark } from '../types'
import { attendancePct, cls, downloadCsv, inClass, log, tally, unmarked, useDB, useStore } from '../store'
import { fmt, fmtLong, lastSchoolDays, stepSchoolDay, today } from '../dates'
import { Badge, Btn, ClassSelect, Empty, Page, Panel } from '../ui'

const NEXT: Record<Mark, Mark> = { P: 'A', A: 'L', L: 'P' }
const WORD: Record<Mark, string> = { P: 'Present', A: 'Absent', L: 'Late' }

export default function Attendance() {
  const db = useDB()
  const [sp, setSp] = useSearchParams()
  const classId = sp.get('class') ?? unmarked(db)[0]?.classId ?? '12-a'
  const view = sp.get('view') === 'report' ? 'report' : 'register'
  const go = (patch: Record<string, string>) => setSp({ class: classId, view, ...patch })
  return (
    <Page title="Attendance" sub={view === 'register' ? 'Tap a student to switch between present, absent and late.' : undefined}
      actions={<><ClassSelect value={classId} onChange={v => go({ class: v })} /><div className="seg" role="group" aria-label="View">{(['register', 'report'] as const).map(v => <button key={v} type="button" aria-pressed={view === v} onClick={() => go({ view: v })}>{v === 'register' ? 'Register' : 'Report'}</button>)}</div></>}>
      {view === 'register' ? <Register key={classId} classId={classId} /> : <AttendanceReport classId={classId} />}
    </Page>
  )
}

export function Register({ classId }: { classId: string }) {
  const { db, update, toast } = useStore()
  const [date, setDate] = useState(today())
  const list = useMemo(() => inClass(db, classId), [db, classId])
  const key = `${classId}:${date}`
  const saved = db.attendance[key]
  const [marks, setMarks] = useState<Record<string, Mark>>({})
  useEffect(() => { setMarks(saved ?? {}) }, [key, saved])
  const t = tally(marks)
  const dirty = JSON.stringify(marks) !== JSON.stringify(saved ?? {})
  const left = list.length - list.filter(s => marks[s.id]).length
  const all = () => setMarks(m => Object.fromEntries(list.map(s => [s.id, m[s.id] ?? 'P'])))
  const save = () => {
    update(d => { const first = !d.attendance[key]; d.attendance[key] = marks; if (first) log(d, classId, 'attendance', `Attendance marked for ${fmt(date)}`) })
    toast(`Register saved: ${t.P + t.L} in class, ${t.A} absent`)
  }
  if (!list.length) return <Empty icon={Users} title="No students in this class" text="Add students to take attendance." action={<Btn kind="primary" to={`/classes/${classId}?tab=students`}>Go to students</Btn>} />
  return (
    <>
      <div className="row wrap between">
        <div className="row wrap">
          <div className="datebar">
            <button type="button" className="icon-btn" aria-label="Previous school day" onClick={() => setDate(d => stepSchoolDay(d, -1))}><ArrowLeft size={17} /></button>
            <b className="num">{fmt(date)}</b>
            <button type="button" className="icon-btn" aria-label="Next school day" disabled={date >= today()} onClick={() => setDate(d => stepSchoolDay(d, 1))}><ArrowRight size={17} /></button>
          </div>
          {saved ? <Badge tone="good"><Check size={13} aria-hidden />Saved</Badge> : <Badge tone="warn">Not marked</Badge>}
        </div>
        {left > 0 && <Btn icon={Check} onClick={all}>{left === list.length ? 'Mark all present' : `Mark remaining ${left} present`}</Btn>}
      </div>
      <div className="register">
        {list.map(s => {
          const m = marks[s.id]
          return (
            <button key={s.id} type="button" className="seat" data-m={m} aria-label={`${s.roll}. ${s.name}: ${m ? WORD[m] : 'not marked'}`} onClick={() => setMarks(x => ({ ...x, [s.id]: m ? NEXT[m] : 'P' }))}>
              <span className="roll">{s.roll}</span><span className="nm">{s.name}</span><span className="m">{m ?? '–'}</span>
            </button>
          )
        })}
      </div>
      <div className="savebar">
        <div className="tally"><span><b>{t.P}</b>Present</span><span><b>{t.A}</b>Absent</span><span><b>{t.L}</b>Late</span>{left > 0 && <span className="muted"><b>{left}</b>Not marked</span>}</div>
        <Btn kind="primary" disabled={!dirty || left > 0} onClick={save}>{left > 0 ? 'Mark everyone to save' : dirty ? 'Save register' : 'Saved'}</Btn>
      </div>
    </>
  )
}

export function AttendanceReport({ classId }: { classId: string }) {
  const db = useDB()
  const days = lastSchoolDays(10)
  const list = inClass(db, classId)
  const get = (d: string, id: string) => db.attendance[`${classId}:${d}`]?.[id]
  const overall = attendancePct(db, classId)
  const low = list.filter(s => (attendancePct(db, classId, s.id) ?? 100) < 80)
  const csv = () => downloadCsv(`attendance-${classId}.csv`, [['Roll', 'Student', ...days, 'Attendance %'], ...list.map(s => [s.roll, s.name, ...days.map(d => get(d, s.id) ?? ''), attendancePct(db, classId, s.id) ?? ''])])
  return (
    <Panel flush title={`${cls(db, classId).name}, last 10 school days`} action={<Btn small icon={Download} onClick={csv}>Download CSV</Btn>}>
      <p className="muted" style={{ padding: '0 20px' }}>{overall === null ? 'No registers yet.' : `${overall}% attended. `}{low.length ? `${low.length} ${low.length === 1 ? 'student is' : 'students are'} below 80%.` : ''} P present, A absent, L late.</p>
      <div className="scroll"><table>
        <thead><tr><th>Student</th>{days.map(d => <th key={d} title={fmtLong(d)} style={{ padding: '8px 5px', textAlign: 'center' }}>{Number(d.slice(8))}</th>)}<th className="r">Attended</th></tr></thead>
        <tbody>{list.map(s => {
          const p = attendancePct(db, classId, s.id)
          return <tr key={s.id}><td style={{ whiteSpace: 'nowrap' }}><span className="strong">{s.name}</span></td>{days.map(d => { const m = get(d, s.id); return <td key={d} style={{ padding: '4px 5px', textAlign: 'center' }}><span className="hm" data-m={m} title={`${fmtLong(d)}: ${m ? WORD[m] : 'not marked'}`}>{m ?? '·'}</span></td> })}<td className="r num">{p === null ? '–' : p < 80 ? <Badge tone="bad">{p}%</Badge> : `${p}%`}</td></tr>
        })}</tbody>
      </table></div>
    </Panel>
  )
}
