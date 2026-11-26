import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CircleAlert, CircleCheck, EllipsisVertical, Eye, EyeOff, Library as LibraryIcon, Search, Trash2, Upload as UploadIcon, X } from 'lucide-react'
import type { Material, MaterialType } from '../types'
import { cls, log, uid, useDB, useStore } from '../store'
import { fmt, today } from '../dates'
import { checkScorm, fileSize, type ScormCheck } from '../scorm'
import { Badge, Btn, ClassSelect, ClassTag, Confirm, Empty, Field, Menu, Page, Panel, TYPE_ICON } from '../ui'

const TYPES: MaterialType[] = ['SCORM', 'PDF', 'Video', 'Slides', 'Link']

export function MaterialList({ items }: { items: Material[] }) {
  const { db, update, toast } = useStore()
  const [del, setDel] = useState<Material | null>(null)
  if (!items.length) return <Empty icon={LibraryIcon} title="No materials here" text="Upload a SCORM module, PDF, video or slides to share with students." action={<Btn kind="primary" icon={UploadIcon} to="/library/upload">Upload material</Btn>} />
  return (
    <>
      <ul className="list">{items.map(m => {
        const I = TYPE_ICON[m.type]
        return (
          <li key={m.id} className="item">
            <span className="ico" data-hue={cls(db, m.classId).hue}><I size={19} aria-hidden /></span>
            <div className="body"><strong>{m.title}</strong><span className="small muted">{m.description}</span><span className="meta"><ClassTag id={m.classId} /><span>{m.type === 'SCORM' ? 'SCORM module' : m.type}{m.size !== m.type && `, ${m.size}`}</span><span>{fmt(m.date)}</span></span></div>
            <Badge tone={m.visible ? 'good' : 'neutral'}>{m.visible ? 'Visible' : 'Draft'}</Badge>
            <Menu trigger={p => <button type="button" className="icon-btn" aria-label={`Actions for ${m.title}`} {...p}><EllipsisVertical size={18} /></button>} items={[
              { label: m.visible ? 'Hide from students' : 'Show to students', icon: m.visible ? EyeOff : Eye, onClick: () => { update(d => { const x = d.materials.find(x => x.id === m.id); if (x) x.visible = !m.visible }); toast(m.visible ? 'Hidden from students' : 'Visible to students') } },
              { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDel(m) },
            ]} />
          </li>
        )
      })}</ul>
      {del && <Confirm title="Delete material?" text={`“${del.title}” will be removed from ${cls(db, del.classId).name}.`} action="Delete" onClose={() => setDel(null)} onYes={() => { update(d => { d.materials = d.materials.filter(x => x.id !== del.id) }); toast('Material deleted') }} />}
    </>
  )
}

export function Library() {
  const db = useDB()
  const [sp, setSp] = useSearchParams()
  const q = sp.get('q') ?? ''
  const [type, setType] = useState<'All' | MaterialType>('All')
  const [cl, setCl] = useState('all')
  const list = db.materials.filter(m => (type === 'All' || m.type === type) && (cl === 'all' || m.classId === cl) && m.title.toLowerCase().includes(q.toLowerCase()))
  return (
    <Page title="Content Library" sub={`${db.materials.length} materials across ${db.classes.length} classes`} actions={<Btn kind="primary" icon={UploadIcon} to="/library/upload">Upload material</Btn>}>
      <div className="filters">
        <div className="search"><Search size={17} aria-hidden /><input type="search" aria-label="Search materials" placeholder="Search materials" value={q} onChange={e => setSp(e.target.value ? { q: e.target.value } : {}, { replace: true })} /></div>
        <ClassSelect all value={cl} onChange={setCl} />
        <div className="seg" role="group" aria-label="Type">{(['All', ...TYPES] as const).map(t => <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)}>{t}</button>)}</div>
      </div>
      <Panel flush>{list.length || !db.materials.length ? <MaterialList items={list} /> : <Empty icon={Search} title="No materials match" text="Clear the search or choose another class or type." action={<Btn onClick={() => { setSp({}); setType('All'); setCl('all') }}>Clear filters</Btn>} />}</Panel>
    </Page>
  )
}

const ACCEPT: Record<MaterialType, string> = { SCORM: '.zip', PDF: '.pdf', Video: '.mp4,.webm,.mov', Slides: '.ppt,.pptx,.odp', Link: '' }

export function Upload() {
  const { db, update, toast } = useStore()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const [type, setType] = useState<MaterialType>('SCORM')
  const [f, setF] = useState({ title: '', classId: db.classes.some(c => c.id === sp.get('class')) ? sp.get('class')! : db.classes[0].id, subject: 'Physics', description: '', url: '', visible: true })
  const [file, setFile] = useState<File | null>(null)
  const [check, setCheck] = useState<ScormCheck | null>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [err, setErr] = useState<{ title?: string; file?: string; url?: string }>({})
  const pick = useRef<HTMLInputElement>(null)
  const run = useRef(0)
  const clear = () => { run.current++; setFile(null); setCheck(null); setBusy(false); if (pick.current) pick.current.value = '' }

  const take = async (x: File | undefined) => {
    if (!x) return
    clear()
    setErr(e => ({ ...e, file: undefined }))
    const ok = ACCEPT[type].split(',').some(ext => x.name.toLowerCase().endsWith(ext))
    if (!ok) return setErr(e => ({ ...e, file: `${x.name} is not a ${type} file. Choose ${ACCEPT[type].replaceAll(',', ', ')}.` }))
    setFile(x)
    if (type !== 'SCORM') return
    const mine = run.current
    setBusy(true)
    let r: ScormCheck
    try { r = await checkScorm(x) } catch { r = { ok: false, reason: 'The file could not be read. Export the package again and retry.' } }
    if (mine !== run.current) return
    setBusy(false); setCheck(r)
    if (r.ok && r.title) setF(v => v.title ? v : { ...v, title: r.title })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const bad: typeof err = {}
    if (!f.title.trim()) bad.title = 'Give the material a title students will recognise.'
    if (type === 'Link') { if (!/^https?:\/\/\S+\.\S+/.test(f.url.trim())) bad.url = 'Enter a full web address starting with https://' }
    else if (!file) bad.file = `Choose a ${type === 'SCORM' ? 'SCORM .zip' : type} file to upload.`
    else if (busy) bad.file = 'Wait for the package check to finish.'
    else if (type === 'SCORM' && check && !check.ok) bad.file = 'Fix the package problem above, then publish.'
    setErr(bad)
    if (Object.keys(bad).length) return
    update(d => {
      d.materials.unshift({ id: uid(), title: f.title.trim(), classId: f.classId, subject: f.subject, type, description: f.description.trim(), size: file ? fileSize(file.size) : 'Link', file: file?.name ?? f.url.trim(), visible: f.visible, date: today() })
      log(d, f.classId, 'material', `Material ${f.visible ? 'uploaded' : 'saved as draft'}: ${f.title.trim()}`)
    })
    toast(f.visible ? `Published to ${cls(db, f.classId).name}` : 'Saved as draft')
    nav('/library')
  }

  return (
    <Page title="Upload Material" back="/library">
      <form className="grid-2" onSubmit={submit} noValidate>
        <Panel title="Details">
          <div className="form">
            <div className="field wide"><label id="mt">Material Type</label><div className="types" role="group" aria-labelledby="mt">{TYPES.map(t => { const I = TYPE_ICON[t]; return <button key={t} type="button" aria-pressed={type === t} onClick={() => { setType(t); clear(); setErr({}) }}><I size={22} aria-hidden />{t}</button> })}</div>{type === 'SCORM' && <p className="hint">Interactive module exported from a tool such as Articulate, Captivate or iSpring.</p>}</div>
            <Field label="Title" required wide error={err.title}>{id => <input id={id} value={f.title} placeholder="Electric Charges - Interactive Module" onChange={e => setF({ ...f, title: e.target.value })} />}</Field>
            <Field label="Class" required>{id => <ClassSelect id={id} value={f.classId} onChange={v => setF({ ...f, classId: v })} />}</Field>
            <Field label="Subject" required>{id => <select id={id} value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })}>{['Physics', 'Chemistry', 'Maths', 'Biology', 'English'].map(s => <option key={s}>{s}</option>)}</select>}</Field>
            <Field label="Description" wide>{id => <textarea id={id} value={f.description} placeholder="What students will do with this" onChange={e => setF({ ...f, description: e.target.value })} />}</Field>
          </div>
        </Panel>
        <div className="stack">
          <Panel title={type === 'Link' ? 'Web address' : `Upload ${type === 'SCORM' ? 'SCORM File' : type}`}>
            {type === 'Link'
              ? <Field label="Address" required error={err.url}>{id => <input id={id} inputMode="url" value={f.url} placeholder="https://" onChange={e => setF({ ...f, url: e.target.value })} />}</Field>
              : <>
                <div className={`drop ${over ? 'over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]) }}>
                  {(() => { const I = TYPE_ICON[type]; return <I size={40} strokeWidth={1.5} aria-hidden /> })()}
                  <strong>Drag and drop your {type === 'SCORM' ? '.zip' : type} file here</strong>
                  <span className="muted small">or</span>
                  <Btn onClick={() => pick.current?.click()}>Choose File</Btn>
                  <input ref={pick} type="file" hidden accept={ACCEPT[type]} onChange={e => void take(e.target.files?.[0])} />
                </div>
                {file && <div className={`file ${check ? (check.ok ? 'good' : 'bad') : ''}`}>
                  {check && !check.ok ? <CircleAlert size={22} color="var(--bad)" /> : <CircleCheck size={22} color={busy ? 'var(--ink-2)' : 'var(--good)'} />}
                  <div className="grow"><strong className="clip" style={{ display: 'block' }}>{file.name}</strong><span className="small muted" role="status">{busy ? 'Checking package…' : check?.ok ? `${check.version}, ${check.files} files, manifest found` : check ? check.reason : fileSize(file.size)}</span></div>
                  <span className="small muted num">{check || busy ? fileSize(file.size) : ''}</span>
                  <button type="button" className="icon-btn" aria-label="Remove file" onClick={clear}><X size={17} /></button>
                </div>}
                {err.file && <p className="err" role="alert">{err.file}</p>}
              </>}
          </Panel>
          <Panel title="Visibility">
            <label className="radio"><input type="radio" name="vis" checked={f.visible} onChange={() => setF({ ...f, visible: true })} /><span>Show to Students<br /><span className="muted small">Available to {cls(db, f.classId).name} as soon as you publish.</span></span></label>
            <label className="radio"><input type="radio" name="vis" checked={!f.visible} onChange={() => setF({ ...f, visible: false })} /><span>Hide (Draft)<br /><span className="muted small">Only you can see it.</span></span></label>
            <div className="form-actions"><Btn to="/library">Cancel</Btn><Btn kind="primary" type="submit">{f.visible ? 'Publish' : 'Save draft'}</Btn></div>
          </Panel>
        </div>
      </form>
    </Page>
  )
}
