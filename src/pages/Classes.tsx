import { useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, CalendarCheck, ChevronDown, ClipboardList, FileText, ListChecks, Plus, Search, Send, Upload, UserPlus, Users } from 'lucide-react'
import type { Activity, ChapterState, ClassRoom } from '../types'
import { average, bands, bandOf, cls, inClass, latest, periodsOn, subjectAverages, uid, useDB, useStore } from '../store'
import { newStudent } from '../seed'
import { clock, mins, now } from '../dates'
import { nowMins } from '../store'
import { BandBar, BandLegend, Btn, CLASS_ICON, ClassMark, Columns, Empty, Field, Menu, Modal, Page, Panel, Tabs } from '../ui'
import { AssignmentList } from './Assignments'
import { QuizList } from './Quizzes'
import { MaterialList } from './Library'
import { BandBadge, StudentModal } from './Insights'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function nextLesson(db: ReturnType<typeof useDB>, id: string) {
  for (let i = 0; i < 7; i++) {
    const day = (now().getDay() + i) % 7
    const p = periodsOn(db, day).find(p => p.classId === id && (i > 0 || mins(p.end) > nowMins()))
    if (p) return i === 0 && mins(p.start) <= nowMins() ? 'On now' : `${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAYS[day]}, ${clock(p.start)}`
  }
  return 'Not on timetable'
}

export function Classes() {
  const db = useDB()
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const list = db.classes.filter(c => `${c.name} ${c.subject}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <Page title="My Classes" sub={`${db.classes.length} classes, ${db.students.length} students`} actions={<div className="search" style={{ minWidth: 260 }}><Search size={17} aria-hidden /><input type="search" aria-label="Search classes" placeholder="Search classes" value={q} onChange={e => setQ(e.target.value)} /></div>}>
      <div className="books">
        {list.map(c => {
          const I = CLASS_ICON[c.icon]
          return (
            <Link key={c.id} to={`/classes/${c.id}`} className="book" data-hue={c.hue}>
              <I size={170} strokeWidth={1.3} aria-hidden />
              <div className="plate"><strong>{c.name}</strong><span><b>{c.subject}</b>{c.room}</span></div>
              <div className="foot"><div><strong>{inClass(db, c.id).length} Students</strong><br />{nextLesson(db, c.id)}</div><span className="go"><ArrowRight size={18} aria-hidden /></span></div>
            </Link>
          )
        })}
        {!q && <button type="button" className="add-book" onClick={() => setAdding(true)}><Plus size={26} aria-hidden />Add Class</button>}
      </div>
      {q && !list.length && <Empty icon={Users} title="No class matches" text={`Nothing found for “${q}”. Try a grade such as 12 or a section letter.`} />}
      {adding && <AddClass onClose={() => setAdding(false)} />}
    </Page>
  )
}

function AddClass({ onClose }: { onClose: () => void }) {
  const { db, update, toast } = useStore()
  const [f, setF] = useState({ grade: '10', section: '', subject: 'Physics', room: '' })
  const [err, setErr] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const sec = f.section.trim().toUpperCase()
    const id = `${f.grade}-${sec.toLowerCase()}`
    if (!/^[A-Z]$/.test(sec)) return setErr('Enter a single letter, such as A.')
    if (db.classes.some(c => c.id === id)) return setErr(`Class ${f.grade} - ${sec} already exists.`)
    const n = db.classes.length
    const icons: ClassRoom['icon'][] = ['atom', 'flask', 'microscope', 'dna']
    update(d => {
      d.classes.push({ id, name: `Class ${f.grade} - ${sec}`, subject: f.subject.trim() || 'Physics', room: f.room.trim() || 'Room not set', icon: icons[n % 4], hue: ((n % 4) + 1) as ClassRoom['hue'] })
      d.syllabus[id] = []
    })
    toast(`Class ${f.grade} - ${sec} added`)
    onClose()
  }
  return (
    <Modal title="Add class" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Grade" required>{id => <select id={id} value={f.grade} onChange={e => setF({ ...f, grade: e.target.value })}>{[6, 7, 8, 9, 10, 11, 12].map(g => <option key={g}>{g}</option>)}</select>}</Field>
        <Field label="Section" required error={err}>{id => <input id={id} maxLength={1} value={f.section} onChange={e => { setF({ ...f, section: e.target.value }); setErr('') }} />}</Field>
        <Field label="Subject">{id => <input id={id} value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} />}</Field>
        <Field label="Room">{id => <input id={id} value={f.room} placeholder="Room 204" onChange={e => setF({ ...f, room: e.target.value })} />}</Field>
        <div className="form-actions"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" type="submit">Add class</Btn></div>
      </form>
    </Modal>
  )
}

function AddStudent({ classId, onClose }: { classId: string; onClose: () => void }) {
  const { update, toast } = useStore()
  const [name, setName] = useState('')
  const [guardian, setG] = useState('')
  const [err, setErr] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const n = name.trim()
    if (!n) return setErr('Enter the student’s name.')
    update(d => {
      const roll = Math.max(0, ...d.students.filter(s => s.classId === classId).map(s => s.roll)) + 1
      const s = newStudent(classId, roll, n, uid())
      if (guardian.trim()) s.guardian = guardian.trim()
      d.students.push(s)
    })
    toast(`${n} added`)
    onClose()
  }
  return (
    <Modal title="Add student" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Student name" required wide error={err}>{id => <input id={id} value={name} onChange={e => { setName(e.target.value); setErr('') }} />}</Field>
        <Field label="Guardian name" wide>{id => <input id={id} value={guardian} onChange={e => setG(e.target.value)} />}</Field>
        <div className="form-actions"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" type="submit">Add student</Btn></div>
      </form>
    </Modal>
  )
}

const TABS = ['overview', 'students', 'syllabus', 'materials', 'assignments', 'quizzes', 'performance'] as const
type Tab = (typeof TABS)[number]
const ACT: Record<Activity['kind'], typeof FileText> = { assignment: ClipboardList, material: FileText, attendance: CalendarCheck, quiz: ListChecks }

export function ClassDetails() {
  const { id = '' } = useParams()
  const db = useDB()
  const [sp, setSp] = useSearchParams()
  const [adding, setAdding] = useState(false)
  const c = db.classes.find(x => x.id === id)
  if (!c) return <Page title="Class not found" back="/classes"><Empty icon={Users} title="This class does not exist" text="It may have been removed." action={<Btn to="/classes">My Classes</Btn>} /></Page>
  const raw = sp.get('tab') as Tab
  const tab: Tab = TABS.includes(raw) ? raw : 'overview'
  const setTab = (t: Tab) => setSp(t === 'overview' ? {} : { tab: t })
  const students = inClass(db, id)
  const picked = db.students.find(s => s.id === sp.get('student'))
  const mats = db.materials.filter(m => m.classId === id), work = db.assignments.filter(a => a.classId === id), quizzes = db.quizzes.filter(q => q.classId === id)
  return (
    <div className="page" data-hue={c.hue}>
      <div className="crumbs"><Link to="/classes">My Classes</Link><span>/</span><span>{c.name}</span></div>
      <header className="class-hero">
        <div className="row" style={{ gap: 16 }}><ClassMark c={c} size={60} /><div><h1>{c.name}</h1><p className="muted">{c.subject}, {c.room}. {nextLesson(db, id) === 'On now' ? 'Lesson on now.' : `Next lesson: ${nextLesson(db, id)}.`}</p></div></div>
        <Menu trigger={p => <Btn kind="primary" {...p}>Class Actions <ChevronDown size={16} style={{ verticalAlign: -3 }} aria-hidden /></Btn>} items={[
          { label: 'Upload material', icon: Upload, to: `/library/upload?class=${id}` },
          { label: 'Create assignment', icon: ClipboardList, to: `/assignments?new=1&class=${id}` },
          { label: 'Create quiz', icon: ListChecks, to: `/quizzes/new?class=${id}` },
          { label: 'Message class', icon: Send, to: `/messages?new=1&to=${id}` },
          { label: 'Add student', icon: UserPlus, onClick: () => setAdding(true) },
        ]} />
      </header>
      <Tabs label="Class sections" value={tab} onChange={setTab} items={TABS.map(t => ({ id: t, label: t[0].toUpperCase() + t.slice(1) }))} />

      {tab === 'overview' && <>
        <div className="facts">
          <button type="button" onClick={() => setTab('students')}><b>{students.length}</b><span>{students.length === 1 ? 'Student' : 'Students'}</span></button>
          <button type="button" onClick={() => setTab('materials')}><b>{mats.length}</b><span>{mats.length === 1 ? 'Material' : 'Materials'}</span></button>
          <button type="button" onClick={() => setTab('assignments')}><b>{work.length}</b><span>{work.length === 1 ? 'Assignment' : 'Assignments'}</span></button>
          <button type="button" onClick={() => setTab('quizzes')}><b>{quizzes.length}</b><span>{quizzes.length === 1 ? 'Quiz' : 'Quizzes'}</span></button>
        </div>
        <div className="grid-2">
          <div className="stack">
            <Panel title="How the class is doing" action={<button className="link" type="button" onClick={() => setTab('performance')}>Performance <ArrowRight size={15} /></button>}>
              <BandBar data={bands(students)} label={c.name} /><BandLegend data={bands(students)} />
              <p className="muted">{average(students) === null ? 'No test scores yet. ' : `Average ${average(students)}% in the latest test. `}</p>
            </Panel>
            <Panel flush title="Students to check in with"><CheckIn id={id} onPick={s => setSp({ student: s })} /></Panel>
          </div>
          <Panel flush title="Recent Activity">
            <ul className="list">{db.activity.filter(a => a.classId === id && a.kind !== 'attendance').slice(0, 6).map(a => { const I = ACT[a.kind]; return <li key={a.id} className="item"><span className="ico" data-hue={c.hue}><I size={18} aria-hidden /></span><div className="body"><strong>{a.text}</strong><span className="muted small">{a.at}</span></div></li> })}</ul>
            {!db.activity.some(a => a.classId === id && a.kind !== 'attendance') && <Empty icon={ListChecks} title="Nothing yet" text="Uploads, assignments and quizzes for this class will appear here." />}
          </Panel>
        </div>
      </>}
      {tab === 'students' && <Panel flush title={`${students.length} Students`} action={<Btn small icon={UserPlus} onClick={() => setAdding(true)}>Add student</Btn>}>
        {students.length ? <div className="scroll"><table>
          <thead><tr><th>Roll</th><th>Student</th><th className="r">Latest test</th><th>Band</th></tr></thead>
          <tbody>{students.map(s => { return <tr key={s.id} className="click"><td className="num muted">{s.roll}</td><td><button type="button" className="name-btn" onClick={() => setSp({ tab: 'students', student: s.id })}>{s.name}</button></td><td className="r num">{latest(s) ?? '–'}{latest(s) !== null && '%'}</td><td><BandBadge s={s} /></td></tr> })}</tbody>
        </table></div> : <Empty icon={Users} title="No students yet" text="Add students to track their progress." />}
      </Panel>}
      {tab === 'syllabus' && <Syllabus id={id} />}
      {tab === 'materials' && <Panel flush title="Materials" action={<Btn small icon={Upload} to={`/library/upload?class=${id}`}>Upload material</Btn>}><MaterialList items={mats} /></Panel>}
      {tab === 'assignments' && <Panel flush title="Assignments" action={<Btn small icon={Plus} to={`/assignments?new=1&class=${id}`}>Create assignment</Btn>}><AssignmentList items={work} /></Panel>}
      {tab === 'quizzes' && <Panel flush title="Quizzes" action={<Btn small icon={Plus} to={`/quizzes/new?class=${id}`}>Create quiz</Btn>}><QuizList items={quizzes} /></Panel>}
      {tab === 'performance' && <div className="grid-even">
        <Panel title="Average by subject, latest test (%)"><Columns label={`${c.name} average by subject`} data={subjectAverages(students)} highlight={c.subject} /></Panel>
        <Panel title="Score bands"><BandBar data={bands(students)} label={c.name} /><BandLegend data={bands(students)} /><table><thead><tr><th>Band</th><th className="r">Students</th></tr></thead><tbody>{bands(students).map(b => <tr key={b.label}><td>{b.label}</td><td className="r num">{b.value}</td></tr>)}</tbody></table></Panel>
      </div>}
      {adding && <AddStudent classId={id} onClose={() => setAdding(false)} />}
      {picked && <StudentModal s={picked} onClose={() => setSp(tab === 'overview' ? {} : { tab })} />}
    </div>
  )
}

function CheckIn({ id, onPick }: { id: string; onPick: (s: string) => void }) {
  const db = useDB()
  const rows = inClass(db, id).filter(s => bandOf(s) === 'Needs attention').sort((x, y) => (latest(x) ?? 0) - (latest(y) ?? 0)).slice(0, 5)
  if (!rows.length) return <p className="muted" style={{ padding: '4px 20px 14px' }}>No one is below 50% in the latest test.</p>
  return <ul className="list">{rows.map(s => <li key={s.id} className="item"><div className="body"><button type="button" className="name-btn" onClick={() => onPick(s.id)}>{s.name}</button><span className="muted small">Latest test {latest(s) ?? '–'}%</span></div><Btn small icon={Send} to={`/messages?new=1&to=${s.id}`}>Message</Btn></li>)}</ul>
}

const STATES: { id: ChapterState; label: string }[] = [{ id: 'todo', label: 'Not started' }, { id: 'doing', label: 'In progress' }, { id: 'done', label: 'Done' }]
function Syllabus({ id }: { id: string }) {
  const { db, update } = useStore()
  const [title, setTitle] = useState('')
  const list = db.syllabus[id] ?? []
  const done = list.filter(c => c.state === 'done').length
  const total = list.reduce((n, c) => n + c.periods, 0)
  const add = (e: FormEvent) => { e.preventDefault(); if (!title.trim()) return; update(d => { (d.syllabus[id] ??= []).push({ title: title.trim(), periods: 10, state: 'todo' }) }); setTitle('') }
  return (
    <Panel flush title={`${cls(db, id).subject} syllabus`} action={<span className="muted">{done} of {list.length} chapters done, {total} periods planned</span>}>
      {list.length > 0 && <div style={{ padding: '0 20px' }}><div className="meter"><span style={{ width: `${(done / list.length) * 100}%` }} /></div></div>}
      <ol className="list">{list.map((ch, i) => (
        <li key={i} className="item"><span className="muted num" style={{ width: 22 }}>{i + 1}</span><div className="body"><strong>{ch.title}</strong><span className="muted small">{ch.periods} periods</span></div>
          <select aria-label={`Status of ${ch.title}`} value={ch.state} onChange={e => update(d => { d.syllabus[id][i].state = e.target.value as ChapterState })}>{STATES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></li>
      ))}</ol>
      <form className="row" style={{ padding: '8px 20px 14px' }} onSubmit={add}><input className="grow" aria-label="New chapter" placeholder="Add a chapter" value={title} onChange={e => setTitle(e.target.value)} /><Btn type="submit" icon={Plus}>Add</Btn></form>
    </Panel>
  )
}
