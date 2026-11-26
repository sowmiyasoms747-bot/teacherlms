import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowRight, Download, Send } from 'lucide-react'
import type { DB, Student } from '../types'
import { attendancePct, average, bandOf, bands, cls, downloadCsv, inClass, latest, mean, subjectAverages, useDB } from '../store'
import { lastSchoolDays, parse } from '../dates'
import { Avatar, Badge, BandBar, BandLegend, Btn, ClassSelect, ClassTag, Columns, Lines, Modal, Page, Panel, Spark, Tabs } from '../ui'

const TONE = { Excellent: 'accent', Good: 'neutral', 'Needs attention': 'warn' } as const
export function BandBadge({ s }: { s: Student }) {
  const b = bandOf(s)
  return b ? <Badge tone={TONE[b]}>{b}</Badge> : <span className="muted small">No scores yet</span>
}

export function StudentModal({ s, onClose }: { s: Student; onClose: () => void }) {
  const db = useDB()
  const a = attendancePct(db, s.classId, s.id)
  return (
    <Modal title={s.name} onClose={onClose} wide>
      <div className="row wrap between"><div className="row"><Avatar name={s.name} size={48} /><div><ClassTag id={s.classId} /><div className="muted small">Roll {s.roll}. {s.guardian}{s.phone && `, ${s.phone}`}</div></div></div><BandBadge s={s} /></div>
      <div className="facts" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
        <div><span>Latest physics test</span><b>{latest(s) === null ? '–' : `${latest(s)}%`}</b>{s.tests.length > 1 && <Spark values={s.tests} />}</div>
        <div><span>Attendance, 10 school days</span><b>{a === null ? '–' : `${a}%`}</b></div>
      </div>
      {s.tests.length > 0 && <div><h3>Score by subject, latest test (%)</h3><Columns label={`${s.name} by subject`} data={subjectAverages([s])} highlight={cls(db, s.classId).subject} /></div>}
      <div className="form-actions"><Btn kind="primary" icon={Send} to={`/messages?new=1&to=${s.id}`}>Message guardian</Btn></div>
    </Modal>
  )
}

export function Progress() {
  const db = useDB()
  const [sp, setSp] = useSearchParams()
  const classId = db.classes.some(c => c.id === sp.get('class')) ? sp.get('class')! : db.classes[0].id
  const [sort, setSort] = useState<'roll' | 'low' | 'high'>('low')
  const [pick, setPick] = useState<Student | null>(null)
  const c = cls(db, classId)
  const list = inClass(db, classId)
  const rows = [...list].sort((a, b) => sort === 'roll' ? a.roll - b.roll : ((latest(a) ?? -1) - (latest(b) ?? -1)) * (sort === 'low' ? 1 : -1))
  return (
    <Page title="Student Progress" actions={<ClassSelect value={classId} onChange={v => setSp({ class: v })} />}>
      <div className="grid-even">
        <Panel title="Average by subject, latest test (%)"><Columns label={`${c.name} average by subject`} data={subjectAverages(list)} highlight={c.subject} /></Panel>
        <Panel title="Where students stand in physics" action={<Btn small kind="plain" to="/reports">View detailed report <ArrowRight size={15} style={{ verticalAlign: -2 }} aria-hidden /></Btn>}>
          <BandBar data={bands(list)} label={c.name} /><BandLegend data={bands(list)} />
          <table><thead><tr><th>Band</th><th>Score</th><th className="r">Students</th></tr></thead><tbody>{bands(list).map((b, i) => <tr key={b.label}><td className="strong">{b.label}</td><td className="muted">{['75% and above', '50 to 74%', 'Below 50%'][i]}</td><td className="r num">{b.value}</td></tr>)}</tbody></table>
        </Panel>
      </div>
      <Panel flush title={`${list.length} students`} action={<select aria-label="Sort students" value={sort} onChange={e => setSort(e.target.value as typeof sort)}><option value="low">Lowest score first</option><option value="high">Highest score first</option><option value="roll">Roll number</option></select>}>
        <div className="scroll"><table>
          <thead><tr><th>Roll</th><th>Student</th><th>Last 5 tests</th><th className="r">Latest</th><th className="r">Change</th><th className="r">Attendance</th><th>Band</th></tr></thead>
          <tbody>{rows.map(s => {
            const ch = s.tests.length > 1 ? s.tests.at(-1)! - s.tests.at(-2)! : null
            const a = attendancePct(db, classId, s.id)
            return <tr key={s.id} className="click"><td className="num muted">{s.roll}</td><td><button type="button" className="name-btn" onClick={() => setPick(s)}>{s.name}</button></td><td><Spark values={s.tests} /></td><td className="r num strong">{latest(s) === null ? '–' : `${latest(s)}%`}</td><td className="r num">{ch === null ? '–' : ch > 0 ? `+${ch}` : ch < 0 ? `−${-ch}` : '0'}</td><td className="r num">{a === null ? '–' : `${a}%`}</td><td><BandBadge s={s} /></td></tr>
          })}</tbody>
        </table></div>
      </Panel>
      {pick && <StudentModal s={pick} onClose={() => setPick(null)} />}
    </Page>
  )
}

const dayAttendance = (db: DB, id: string, d: string) => { const v = Object.values(db.attendance[`${id}:${d}`] ?? {}); return v.length ? Math.round((v.filter(m => m !== 'A').length / v.length) * 100) : null }

export function Reports() {
  const db = useDB()
  const [tab, setTab] = useState<'performance' | 'engagement'>('performance')
  const all = bands(db.students)
  const scored = all.reduce((n, b) => n + b.value, 0)
  const ok = scored ? Math.round(((all[0].value + all[1].value) / scored) * 100) : 0
  const submitted = (id: string) => {
    const as = db.assignments.filter(a => a.classId === id && a.opens <= lastSchoolDays(1)[0])
    const due = as.length * inClass(db, id).length
    return due ? Math.round((as.reduce((n, a) => n + a.submissions.length, 0) / due) * 100) : null
  }
  const quizAvg = (id: string) => mean(db.quizzes.filter(q => q.classId === id && q.average !== null).map(q => q.average!))
  const p = (v: number | null) => v === null ? '–' : `${v}%`
  const days = lastSchoolDays(11).slice(0, 10)
  const series = db.classes.map(c => ({ name: c.name, hue: c.hue, values: days.map(d => dayAttendance(db, c.id, d)) })).filter(s => s.values.every(v => v !== null)) as { name: string; hue: number; values: number[] }[]
  const csv = () => downloadCsv('teacher-report.csv', [['Class', 'Students', 'Latest test average %', 'Excellent', 'Good', 'Needs attention', 'Attendance %', 'Submitted %', 'Quiz average %'], ...db.classes.map(c => { const l = inClass(db, c.id); return [c.name, l.length, average(l) ?? '', ...bands(l).map(b => b.value), attendancePct(db, c.id) ?? '', submitted(c.id) ?? '', quizAvg(c.id) ?? ''] })])
  return (
    <Page title="Reports & Analytics" actions={<Btn icon={Download} onClick={csv}>Download Report</Btn>}>
      <Tabs label="Report" value={tab} onChange={setTab} items={[{ id: 'performance', label: 'Performance' }, { id: 'engagement', label: 'Engagement' }]} />
      {tab === 'performance' ? <>
        <Panel>
          <div><span style={{ font: '700 3.2rem/1 var(--body)', letterSpacing: '-.03em' }}>{ok}%</span><p className="muted" style={{ marginTop: 6 }}>of {scored} students scored Excellent or Good in the latest physics test</p></div>
          <BandBar data={all} label="All classes" /><BandLegend data={all} />
        </Panel>
        <Panel title="By class">
          <div className="band-rows">{db.classes.map(c => { const l = inClass(db, c.id); return <div key={c.id} className="band-row"><ClassTag id={c.id} /><BandBar data={bands(l)} label={c.name} /><span className="num small"><b>{p(average(l))}</b> <span className="muted">average</span></span></div> })}</div>
        </Panel>
        <Panel flush title="Score table"><div className="scroll"><table>
          <thead><tr><th>Class</th><th className="r">Students</th><th className="r">Average</th><th className="r">Excellent</th><th className="r">Good</th><th className="r">Needs attention</th></tr></thead>
          <tbody>{db.classes.map(c => { const l = inClass(db, c.id); return <tr key={c.id}><td><ClassTag id={c.id} /></td><td className="r num">{l.length}</td><td className="r num">{p(average(l))}</td>{bands(l).map(b => <td key={b.label} className="r num">{b.value}</td>)}</tr> })}</tbody>
        </table></div></Panel>
      </> : <>
        <Panel title="Daily attendance by class (%)">{series.length > 0 && <Lines label="Daily attendance by class" series={series} labels={days.map(d => parse(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }))} />}</Panel>
        <Panel flush title="Participation"><div className="scroll"><table>
          <thead><tr><th>Class</th><th className="r">Attendance, 10 days</th><th className="r">Work submitted</th><th className="r">Quiz average</th><th className="r">Materials shared</th></tr></thead>
          <tbody>{db.classes.map(c => <tr key={c.id}><td><ClassTag id={c.id} /></td><td className="r num">{p(attendancePct(db, c.id))}</td><td className="r num">{p(submitted(c.id))}</td><td className="r num">{p(quizAvg(c.id))}</td><td className="r num">{db.materials.filter(m => m.classId === c.id && m.visible).length}</td></tr>)}</tbody>
        </table></div></Panel>
      </>}
    </Page>
  )
}
