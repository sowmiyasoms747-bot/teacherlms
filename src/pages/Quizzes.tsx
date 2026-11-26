import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { EllipsisVertical, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Question, Quiz } from '../types'
import { cls, inClass, log, uid, useDB, useStore } from '../store'
import { Badge, Btn, ClassSelect, ClassTag, Confirm, Empty, Field, Menu, Page, Panel, Tabs } from '../ui'

export function QuizList({ items }: { items: Quiz[] }) {
  const { db, update, toast } = useStore()
  const [del, setDel] = useState<Quiz | null>(null)
  if (!items.length) return <Empty icon={ListChecks} title="No quizzes here" text="Write questions once and publish them to a class when ready." action={<Btn kind="primary" icon={Plus} to="/quizzes/new">Create quiz</Btn>} />
  return (
    <>
      <ul className="list">{items.map(q => (
        <li key={q.id} className="item">
          <span className="ico" data-hue={cls(db, q.classId).hue}><ListChecks size={19} aria-hidden /></span>
          <div className="body"><Link to={`/quizzes/${q.id}`}><strong>{q.title}</strong></Link><span className="meta"><ClassTag id={q.classId} /><span>{q.published ? `${q.questions.length} Questions` : `${q.questions.length} of ${q.planned} questions written`}</span><span>{q.minutes} min</span>{q.published && <span>{q.attempts} of {inClass(db, q.classId).length} attempted{q.average !== null && `, average ${q.average}%`}</span>}</span></div>
          <Badge tone={q.published ? 'good' : 'neutral'}>{q.published ? 'Active' : 'Draft'}</Badge>
          <Menu trigger={p => <button type="button" className="icon-btn" aria-label={`Actions for ${q.title}`} {...p}><EllipsisVertical size={18} /></button>} items={[
            { label: q.published ? 'View questions' : 'Edit questions', icon: Pencil, to: `/quizzes/${q.id}` },
            { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDel(q) },
          ]} />
        </li>
      ))}</ul>
      {del && <Confirm title="Delete quiz?" text={`“${del.title}” and its ${del.questions.length} questions will be removed.`} action="Delete" onClose={() => setDel(null)} onYes={() => { update(d => { d.quizzes = d.quizzes.filter(x => x.id !== del.id) }); toast('Quiz deleted') }} />}
    </>
  )
}

export function Quizzes() {
  const db = useDB()
  const [tab, setTab] = useState<'All' | 'Draft' | 'Published'>('All')
  const of = (t: typeof tab) => db.quizzes.filter(q => t === 'All' || q.published === (t === 'Published'))
  return (
    <Page title="Quizzes" actions={<Btn kind="primary" icon={Plus} to="/quizzes/new">Create Quiz</Btn>}>
      <Tabs label="Status" value={tab} onChange={setTab} items={(['All', 'Draft', 'Published'] as const).map(t => ({ id: t, label: t, count: of(t).length }))} />
      <Panel flush><QuizList items={of(tab)} /></Panel>
    </Page>
  )
}

const blank = (): Question => ({ text: '', options: ['', '', '', ''], answer: 0 })

export function QuizEditor() {
  const { id = 'new' } = useParams()
  const db = useDB()
  const found = db.quizzes.find(q => q.id === id)
  if (id !== 'new' && !found) return <Page title="Quiz not found" back="/quizzes"><Empty icon={ListChecks} title="This quiz does not exist" text="It may have been deleted." action={<Btn to="/quizzes">All quizzes</Btn>} /></Page>
  return found?.published ? <QuizView q={found} /> : <Editor key={id} found={found} />
}

function QuizView({ q }: { q: Quiz }) {
  return (
    <Page title={q.title} back="/quizzes" sub={<span className="row wrap"><ClassTag id={q.classId} /><span>{q.questions.length} questions, {q.minutes} minutes</span><Badge tone="good">Active</Badge></span>}>
      <Panel title="Questions and answers">{q.questions.map((x, i) => (
        <div key={i} className="q"><strong>{i + 1}. {x.text}</strong><ol>{x.options.map((o, j) => <li key={j} className={j === x.answer ? 'ok' : ''}><span>{'ABCD'[j]}.</span><span>{o}{j === x.answer && <span className="small"> (correct)</span>}</span></li>)}</ol></div>
      ))}</Panel>
    </Page>
  )
}

function Editor({ found }: { found?: Quiz }) {
  const { db, update, toast } = useStore()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [f, setF] = useState({ title: found?.title ?? '', classId: found?.classId ?? (db.classes.some(c => c.id === sp.get('class')) ? sp.get('class')! : db.classes[0].id), minutes: String(found?.minutes ?? 20), planned: String(found?.planned ?? 10) })
  const [qs, setQs] = useState<Question[]>(found?.questions.length ? structuredClone(found.questions) : [blank()])
  const [edit, setEdit] = useState<number | null>(found?.questions.length ? null : 0)
  const [err, setErr] = useState<{ title?: string; minutes?: string; qs?: string }>({})
  const patch = (i: number, p: Partial<Question>) => setQs(x => x.map((q, j) => j === i ? { ...q, ...p } : q))
  const written = (q: Question) => q.text.trim() && q.options.every(o => o.trim())

  const save = (publish: boolean) => {
    const bad: typeof err = {}
    if (!f.title.trim()) bad.title = 'Enter a title.'
    if (!(Number(f.minutes) >= 1)) bad.minutes = 'Enter at least 1 minute.'
    const used = qs.filter(q => q.text.trim() || q.options.some(o => o.trim()))
    const gap = qs.findIndex(q => used.includes(q) && !written(q))
    if (publish && !used.length) bad.qs = 'Add at least one question before publishing.'
    else if (publish && gap >= 0) { bad.qs = `Question ${gap + 1} needs its text and all four options.`; setEdit(gap) }
    setErr(bad)
    if (Object.keys(bad).length) return
    const planned = Math.max(Number(f.planned) || 0, used.length)
    update(d => {
      const q: Quiz = { id: found?.id ?? uid(), title: f.title.trim(), classId: f.classId, minutes: Number(f.minutes), planned: publish ? used.length : planned, questions: used, published: publish, attempts: 0, average: null }
      const i = d.quizzes.findIndex(x => x.id === q.id)
      if (i >= 0) d.quizzes[i] = q; else d.quizzes.unshift(q)
      if (publish) log(d, q.classId, 'quiz', `Quiz published: ${q.title}`)
    })
    toast(publish ? `Quiz published to ${cls(db, f.classId).name}` : 'Draft saved')
    nav('/quizzes')
  }

  return (
    <Page title={found ? 'Edit Quiz' : 'Create Quiz'} back="/quizzes" actions={<><Btn onClick={() => save(false)}>Save draft</Btn><Btn kind="primary" onClick={() => save(true)}>Publish</Btn></>}>
      {err.qs && <p className="err" role="alert">{err.qs}</p>}
      <div className="grid-2">
        <Panel title={`Questions (${qs.filter(written).length} of ${Math.max(Number(f.planned) || 0, qs.length)})`}>
          {qs.map((q, i) => edit === i ? (
            <div key={i} className="q">
              <Field label={`Question ${i + 1}`}>{id => <textarea id={id} value={q.text} onChange={e => patch(i, { text: e.target.value })} />}</Field>
              <div className="q-opts"><span className="small muted">Select the correct option.</span>{q.options.map((o, j) => <div key={j}><input type="radio" name={`ans-${i}`} aria-label={`Option ${'ABCD'[j]} is correct`} checked={q.answer === j} onChange={() => patch(i, { answer: j })} /><input type="text" aria-label={`Option ${'ABCD'[j]}`} placeholder={`Option ${'ABCD'[j]}`} value={o} onChange={e => patch(i, { options: q.options.map((x, k) => k === j ? e.target.value : x) })} /></div>)}</div>
              <div className="row between"><Btn small kind="plain" icon={Trash2} onClick={() => { setQs(x => x.filter((_, j) => j !== i)); setEdit(null) }}>Remove</Btn><Btn small onClick={() => setEdit(null)}>Done</Btn></div>
            </div>
          ) : (
            <div key={i} className="q"><div className="row between" style={{ alignItems: 'flex-start' }}><strong>{i + 1}. {q.text || 'Untitled question'}</strong><button type="button" className="icon-btn" aria-label={`Edit question ${i + 1}`} onClick={() => setEdit(i)}><Pencil size={16} /></button></div>{!written(q) && <div><Badge tone="warn">Incomplete</Badge></div>}</div>
          ))}
          <div><Btn icon={Plus} onClick={() => { setEdit(qs.length); setQs(x => [...x, blank()]) }}>Add question</Btn></div>
        </Panel>
        <Panel title="Quiz settings">
          <Field label="Title" required error={err.title}>{id => <input id={id} value={f.title} placeholder="Chapter 02 - Quick Quiz" onChange={e => setF({ ...f, title: e.target.value })} />}</Field>
          <Field label="Class" required>{id => <ClassSelect id={id} value={f.classId} onChange={v => setF({ ...f, classId: v })} />}</Field>
          <Field label="Time limit (minutes)" required error={err.minutes}>{id => <input id={id} type="number" min={1} value={f.minutes} onChange={e => setF({ ...f, minutes: e.target.value })} />}</Field>
          <Field label="Planned questions">{id => <input id={id} type="number" min={1} value={f.planned} onChange={e => setF({ ...f, planned: e.target.value })} />}</Field>
        </Panel>
      </div>
    </Page>
  )
}
