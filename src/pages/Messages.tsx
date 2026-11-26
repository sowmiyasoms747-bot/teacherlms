import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, MessageSquare, PenLine, Send } from 'lucide-react'
import type { DB } from '../types'
import { cls, inClass, uid, useStore } from '../store'
import { nowStamp } from '../dates'
import { Avatar, Btn, ClassMark, Empty, Field, Modal, Page } from '../ui'

function recipient(db: DB, id: string) {
  const c = db.classes.find(x => x.id === id)
  if (c) return { name: c.name, about: `${inClass(db, id).length} students` }
  const s = db.students.find(x => x.id === id)
  return s ? { name: s.guardian, about: `${s.name}, ${cls(db, s.classId).name}` } : null
}

export default function Messages() {
  const { db, update } = useStore()
  const [sp, setSp] = useSearchParams()
  const [text, setText] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const picked = db.threads.find(t => t.id === sp.get('t'))
  const thread = picked ?? db.threads[0]
  const pickedUnread = picked?.unread ? picked.id : null
  useEffect(() => { if (pickedUnread) update(d => { const t = d.threads.find(x => x.id === pickedUnread); if (t) t.unread = false }) }, [pickedUnread, update])
  useEffect(() => { const b = end.current?.parentElement; if (b) b.scrollTop = b.scrollHeight; }, [thread?.id, thread?.messages.length])
  useEffect(() => { setText('') }, [thread?.id])
  const send = (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || !thread) return
    update(d => {
      const t = d.threads.find(x => x.id === thread.id)
      if (!t) return
      t.messages.push({ from: 'me', text: body, at: nowStamp() })
      t.unread = false
      d.threads = [t, ...d.threads.filter(x => x.id !== t.id)]
    })
    setSp({ t: thread.id })
    setText('')
  }
  return (
    <Page title="Messages" actions={<Btn kind="primary" icon={PenLine} onClick={() => setSp({ new: '1' })}>New message</Btn>}>
      <div className={`inbox ${picked ? 'open' : ''}`}>
        <div className="threads">{db.threads.map(t => (
          <button key={t.id} type="button" aria-current={thread?.id === t.id} onClick={() => setSp({ t: t.id })}>
            {(() => { const c = db.classes.find(x => x.name === t.name); return c ? <ClassMark c={c} /> : <Avatar name={t.name.replace('Parent of ', '')} size={40} /> })()}
            <span className="grow"><span className="clip strong" style={{ display: 'block' }}>{t.name}</span><span className="clip muted small" style={{ display: 'block' }}>{t.messages.at(-1)?.text}</span></span>
            {t.unread && <span className="new" role="img" aria-label="Unread" />}
          </button>
        ))}</div>
        {thread ? <div className="convo">
          <header><button type="button" className="icon-btn only-sm" aria-label="All messages" onClick={() => setSp({})}><ArrowLeft size={18} /></button><div><h2>{thread.name}</h2><span className="muted small">{thread.about}</span></div></header>
          <div className="bubbles" tabIndex={0} aria-label="Conversation">{thread.messages.map((m, i) => <div key={i} className={`bubble ${m.from === 'me' ? 'me' : ''}`}>{m.text}<small>{m.at}</small></div>)}<div ref={end} /></div>
          <form className="composer" onSubmit={send}><input aria-label={`Message to ${thread.name}`} placeholder="Write a message" value={text} onChange={e => setText(e.target.value)} /><Btn kind="primary" type="submit" icon={Send} disabled={!text.trim()}>Send</Btn></form>
        </div> : <Empty icon={MessageSquare} title="No messages" text="Start a conversation with a class or a parent." />}
      </div>
      {sp.get('new') && <NewMessage to={sp.get('to')} preset={sp.get('text') ?? ''} onClose={() => setSp({})} onSent={id => setSp({ t: id })} />}
    </Page>
  )
}

function NewMessage({ to, preset, onClose, onSent }: { to: string | null; preset: string; onClose: () => void; onSent: (id: string) => void }) {
  const { db, update, toast } = useStore()
  const [who, setWho] = useState(to && recipient(db, to) ? to : db.classes[0].id)
  const [text, setText] = useState(preset)
  const [err, setErr] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const body = text.trim(), r = recipient(db, who)
    if (!body || !r) return setErr('Write a message before sending.')
    // One conversation per class or guardian: reuse it when it already exists.
    const student = db.students.find(s => s.id === who)
    const old = db.threads.find(t => t.name === r.name && (!student || t.about === r.about || t.about === cls(db, student.classId).name))
    const id = old?.id ?? uid()
    update(d => {
      const t = d.threads.find(x => x.id === id) ?? { id, ...r, unread: false, messages: [] }
      t.messages.push({ from: 'me', text: body, at: nowStamp() })
      d.threads = [t, ...d.threads.filter(x => x.id !== id)]
    })
    toast(`Message sent to ${r.name}`)
    onSent(id)
  }
  return (
    <Modal title="New message" onClose={onClose}>
      <form className="form" onSubmit={submit} noValidate>
        <Field label="To" wide>{id => <select id={id} value={who} onChange={e => setWho(e.target.value)}><optgroup label="Whole class">{db.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>{db.classes.map(c => <optgroup key={c.id} label={`${c.name} guardians`}>{inClass(db, c.id).map(s => <option key={s.id} value={s.id}>{s.name} (guardian)</option>)}</optgroup>)}</select>}</Field>
        <Field label="Message" required wide error={err}>{id => <textarea id={id} value={text} onChange={e => { setText(e.target.value); setErr('') }} />}</Field>
        <div className="form-actions"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" type="submit" icon={Send}>Send</Btn></div>
      </form>
    </Modal>
  )
}
