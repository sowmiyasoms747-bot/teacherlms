import { useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ClipboardList, EllipsisVertical, Plus, Trash2 } from 'lucide-react'
import type { Assignment } from '../types'
import { type AState, cls, inClass, log, pendingOf, stateOf, uid, useDB, useStore } from '../store'
import { addDays, dueLabel, fmt, today } from '../dates'
import { Badge, Btn, ClassSelect, ClassTag, Confirm, Empty, Field, Menu, Modal, Page, Panel, Tabs } from '../ui'

const TONE = { Active: 'good', Upcoming: 'accent', Completed: 'neutral' } as const

export function AssignmentList({ items }: { items: Assignment[] }) {
  const { db, update, toast } = useStore()
  const [del, setDel] = useState<Assignment | null>(null)
  if (!items.length) return <Empty icon={ClipboardList} title="No assignments here" text="Assignments you set will appear here with submissions to review." action={<Btn kind="primary" icon={Plus} to="/assignments?new=1">Create assignment</Btn>} />
  return (
    <>
      <ul className="list">{items.map(a => {
        const st = stateOf(a), n = pendingOf(a), total = inClass(db, a.classId).length
        return (
          <li key={a.id} className="item">
            <span className="ico" data-hue={cls(db, a.classId).hue}><ClipboardList size={19} aria-hidden /></span>
            <div className="body"><Link to={`/assignments/${a.id}`}><strong>{a.title}</strong></Link><span className="meta"><ClassTag id={a.classId} /><span>{st === 'Upcoming' ? `Opens ${fmt(a.opens)}, due ${fmt(a.due)}` : dueLabel(a.due)}</span>{st !== 'Upcoming' && <span className="num">{a.submissions.length} of {total} submitted</span>}</span></div>
            {n > 0 && <Badge tone="warn">{n} to review</Badge>}
            <Badge tone={TONE[st]}>{st}</Badge>
            <Menu trigger={p => <button type="button" className="icon-btn" aria-label={`Actions for ${a.title}`} {...p}><EllipsisVertical size={18} /></button>} items={[
              { label: 'Open submissions', icon: ClipboardList, to: `/assignments/${a.id}` },
              { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDel(a) },
            ]} />
          </li>
        )
      })}</ul>
      {del && <Confirm title="Delete assignment?" text={`“${del.title}” and its ${del.submissions.length} submissions will be removed.`} action="Delete" onClose={() => setDel(null)} onYes={() => { update(d => { d.assignments = d.assignments.filter(x => x.id !== del.id) }); toast('Assignment deleted') }} />}
    </>
  )
}

export function Assignments() {
  const db = useDB()
  const [sp, setSp] = useSearchParams()
  const [tab, setTab] = useState<'All' | AState>('All')
  const [cl, setCl] = useState('all')
  const scope = db.assignments.filter(a => cl === 'all' || a.classId === cl)
  const list = scope.filter(a => tab === 'All' || stateOf(a) === tab)
  return (
    <Page title="Assignments" actions={<><ClassSelect all value={cl} onChange={setCl} /><Btn kind="primary" icon={Plus} onClick={() => setSp({ new: '1' })}>Create Assignment</Btn></>}>
      <Tabs label="Status" value={tab} onChange={setTab} items={(['All', 'Active', 'Upcoming', 'Completed'] as const).map(t => ({ id: t, label: t, count: t === 'All' ? scope.length : scope.filter(a => stateOf(a) === t).length }))} />
      <Panel flush><AssignmentList items={list} /></Panel>
      {sp.get('new') && <NewAssignment classId={sp.get('class')} onClose={() => setSp({})} />}
    </Page>
  )
}

function NewAssignment({ classId, onClose }: { classId: string | null; onClose: () => void }) {
  const { db, update, toast } = useStore()
  const [f, setF] = useState({ title: '', classId: db.classes.some(c => c.id === classId) ? classId! : db.classes[0].id, opens: today(), due: addDays(today(), 7), max: '10', instructions: '' })
  const [err, setErr] = useState<{ title?: string; due?: string; max?: string }>({})
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const bad: typeof err = {}
    if (!f.title.trim()) bad.title = 'Enter a title.'
    if (!f.opens || !f.due || f.due < f.opens) bad.due = 'The due date must be on or after the opening date.'
    if (!(Number(f.max) >= 1 && Number(f.max) <= 200)) bad.max = 'Enter marks between 1 and 200.'
    setErr(bad)
    if (Object.keys(bad).length) return
    update(d => {
      d.assignments.unshift({ id: uid(), title: f.title.trim(), classId: f.classId, opens: f.opens, due: f.due, maxMark: Number(f.max), instructions: f.instructions.trim(), submissions: [] })
      log(d, f.classId, 'assignment', `New assignment: ${f.title.trim()}`)
    })
    toast(`Assignment set for ${cls(db, f.classId).name}`)
    onClose()
  }
  return (
    <Modal title="Create assignment" onClose={onClose} wide>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="Title" required wide error={err.title}>{id => <input id={id} value={f.title} placeholder="Homework - Gauss’s Law" onChange={e => setF({ ...f, title: e.target.value })} />}</Field>
        <Field label="Class" required>{id => <ClassSelect id={id} value={f.classId} onChange={v => setF({ ...f, classId: v })} />}</Field>
        <Field label="Total marks" required error={err.max}>{id => <input id={id} type="number" min={1} max={200} value={f.max} onChange={e => setF({ ...f, max: e.target.value })} />}</Field>
        <Field label="Opens" required>{id => <input id={id} type="date" value={f.opens} onChange={e => setF({ ...f, opens: e.target.value })} />}</Field>
        <Field label="Due" required error={err.due}>{id => <input id={id} type="date" value={f.due} onChange={e => setF({ ...f, due: e.target.value })} />}</Field>
        <Field label="Instructions" wide>{id => <textarea id={id} value={f.instructions} onChange={e => setF({ ...f, instructions: e.target.value })} />}</Field>
        <div className="form-actions"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" type="submit">Create assignment</Btn></div>
      </form>
    </Modal>
  )
}

export function AssignmentDetail() {
  const { id } = useParams()
  const { db, update, toast } = useStore()
  const a = db.assignments.find(x => x.id === id)
  if (!a) return <Page title="Assignment not found" back="/assignments"><Empty icon={ClipboardList} title="This assignment does not exist" text="It may have been deleted." action={<Btn to="/assignments">All assignments</Btn>} /></Page>
  const list = inClass(db, a.classId)
  const rows = a.submissions.map(x => ({ x, s: list.find(s => s.id === x.studentId) })).filter(r => r.s).sort((p, q) => Number(p.x.mark !== null) - Number(q.x.mark !== null) || p.s!.roll - q.s!.roll)
  const missing = list.filter(s => !a.submissions.some(x => x.studentId === s.id))
  const graded = a.submissions.filter(x => x.mark !== null)
  const avg = graded.length ? (graded.reduce((n, x) => n + x.mark!, 0) / graded.length).toFixed(1) : '–'
  const setMark = (sid: string, v: string) => {
    if (v !== '' && !(Number(v) >= 0 && Number(v) <= a.maxMark)) { toast(`Marks must be between 0 and ${a.maxMark}`); return false }
    const cur = a.submissions.find(y => y.studentId === sid)?.mark ?? null
    const next = v === '' ? null : Number(v)
    if (cur === next) return true
    update(d => { const x = d.assignments.find(y => y.id === a.id)?.submissions.find(y => y.studentId === sid); if (x) x.mark = next })
    return true
  }
  return (
    <Page title={a.title} back="/assignments" sub={<span className="meta row wrap"><ClassTag id={a.classId} /><span>{dueLabel(a.due)}</span><Badge tone={TONE[stateOf(a)]}>{stateOf(a)}</Badge></span>}>
      {a.instructions && <p style={{ maxWidth: '65ch' }}>{a.instructions}</p>}
      <div className="facts">
        <div><b>{a.submissions.length}/{list.length}</b><span>Submitted</span></div>
        <div><b>{pendingOf(a)}</b><span>To review</span></div>
        <div><b>{avg}</b><span>Average, out of {a.maxMark}</span></div>
        <div><b>{missing.length}</b><span>Not submitted</span></div>
      </div>
      <div className="grid-2">
        <Panel flush title="Submissions">
          {rows.length ? <div className="scroll"><table>
            <thead><tr><th>Roll</th><th>Student</th><th>Submitted</th><th className="r">Marks out of {a.maxMark}</th><th>Status</th></tr></thead>
            <tbody>{rows.map(({ x, s }) => (
              <tr key={x.studentId}><td className="num muted">{s!.roll}</td><td className="strong" style={{ whiteSpace: 'nowrap' }}>{s!.name}</td><td className="muted small" style={{ whiteSpace: 'nowrap' }}>{x.at}</td>
                <td className="r"><input className="mark-input" type="number" min={0} max={a.maxMark} step="0.5" aria-label={`Marks for ${s!.name}`} defaultValue={x.mark ?? ''} onBlur={e => { if (!setMark(x.studentId, e.target.value)) e.target.value = String(x.mark ?? '') }} onKeyDown={e => { if (e.key === 'Enter') { const all = [...document.querySelectorAll<HTMLInputElement>('.mark-input')]; const next = all[all.indexOf(e.currentTarget) + 1]; if (next) next.focus(); else e.currentTarget.blur() } }} /></td>
                <td>{x.mark === null ? <Badge tone="warn">To review</Badge> : <Badge tone="good">Graded</Badge>}</td></tr>
            ))}</tbody>
          </table></div> : <Empty icon={ClipboardList} title="No submissions yet" text={stateOf(a) === 'Upcoming' ? `Students can submit from ${fmt(a.opens)}.` : 'Work will appear here as students submit it.'} />}
        </Panel>
        {stateOf(a) !== 'Upcoming' && <Panel title={`Not submitted (${missing.length})`}>
          {missing.length ? <><p>{missing.map(s => s.name).join(', ')}</p><div><Btn small to={`/messages?new=1&to=${a.classId}&text=${encodeURIComponent(`Reminder: “${a.title}” is due ${fmt(a.due)}. Please submit your work.`)}`}>Send reminder to class</Btn></div></> : <p className="muted">Everyone has submitted.</p>}
        </Panel>}
      </div>
    </Page>
  )
}
