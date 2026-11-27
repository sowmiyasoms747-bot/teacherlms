import { useState, type FormEvent } from 'react'
import { RotateCcw } from 'lucide-react'
import type { Settings as S } from '../types'
import { useStore } from '../store'
import { Btn, Confirm, Field, Page, Panel } from '../ui'

const NOTIFY: { id: keyof S['notify']; label: string; text: string }[] = [
  { id: 'submissions', label: 'Work to review', text: 'When students submit assignments' },
  { id: 'messages', label: 'New messages', text: 'From guardians and staff' },
]

export default function Settings() {
  const { db, update, reset, toast } = useStore()
  const [name, setName] = useState(db.settings.name)
  const [email, setEmail] = useState(db.settings.email)
  const [err, setErr] = useState<{ name?: string; email?: string }>({})
  const [ask, setAsk] = useState(false)
  const save = (e: FormEvent) => {
    e.preventDefault()
    const bad: typeof err = {}
    if (!name.trim()) bad.name = 'Enter the name students see.'
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) bad.email = 'Enter a full email address.'
    setErr(bad)
    if (Object.keys(bad).length) return
    update(d => { d.settings.name = name.trim(); d.settings.email = email.trim() })
    toast('Profile saved')
  }
  return (
    <Page title="Settings">
      <div className="grid-even">
        <Panel title="Profile">
          <form className="stack" onSubmit={save} noValidate>
            <Field label="Display name" required error={err.name}>{id => <input id={id} value={name} onChange={e => setName(e.target.value)} />}</Field>
            <Field label="School email" error={err.email}>{id => <input id={id} type="email" value={email} onChange={e => setEmail(e.target.value)} />}</Field>
            <div><Btn kind="primary" type="submit">Save profile</Btn></div>
          </form>
        </Panel>
        <div className="stack">
          <Panel title="Notifications"><div>{NOTIFY.map(n => <div key={n.id} className="set"><div><strong>{n.label}</strong><div className="muted small">{n.text}</div></div><button type="button" role="switch" className="switch" aria-label={n.label} aria-checked={db.settings.notify[n.id]} onClick={() => update(d => { d.settings.notify[n.id] = !d.settings.notify[n.id] })} /></div>)}</div></Panel>
          <Panel title="Appearance"><div><div className="seg" role="group" aria-label="Theme">{(['system', 'light', 'dark'] as const).map(t => <button key={t} type="button" aria-pressed={db.settings.theme === t} onClick={() => update(d => { d.settings.theme = t })}>{t === 'system' ? 'Match device' : t === 'light' ? 'Light' : 'Dark'}</button>)}</div></div></Panel>
          <Panel title="Sample data"><p className="muted">Changes are kept in this browser. Reset to bring back the original classes, marks and messages.</p><div><Btn icon={RotateCcw} onClick={() => setAsk(true)}>Reset sample data</Btn></div></Panel>
        </div>
      </div>
      {ask && <Confirm title="Reset sample data?" text="Everything you added or changed in this browser will be removed." action="Reset" onClose={() => setAsk(false)} onYes={() => { reset(); setName('Ms. Nandhini'); setEmail(''); toast('Sample data restored') }} />}
    </Page>
  )
}
