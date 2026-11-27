import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleAlert, CircleCheck, EllipsisVertical, Eye, EyeOff, Library as LibraryIcon, MonitorPlay, Search, ShieldX, Trash2, Upload as UploadIcon, X } from 'lucide-react'
import type { Material, MaterialType } from '../types'
import { cls, log, uid, useDB, useStore } from '../store'
import { fmt, today } from '../dates'
import { SCORM_RULES, checkScorm, fileSize, type ScormCheck } from '../scorm'
import { canManage, loadScormRules, previewPath, safeBack, subjectsFor, targetError, teaching } from '../content'
import { Badge, Btn, ClassSelect, ClassTag, Confirm, Empty, Field, Menu, Page, Panel, TYPE_ICON, type MenuItem } from '../ui'

const TYPES: MaterialType[] = ['SCORM', 'PDF', 'Video', 'Slides', 'Link']

export function MaterialList({ items }: { items: Material[] }) {
  const { db, update, toast } = useStore()
  const here = useLocation()
  const [del, setDel] = useState<Material | null>(null)
  if (!items.length) return <Empty icon={LibraryIcon} title="No materials here" text="Upload a SCORM module, PDF, video or slides to share with students." action={<Btn kind="primary" icon={UploadIcon} to="/library/upload">Upload material</Btn>} />
  return (
    <>
      <ul className="list">{items.map(m => {
        const I = TYPE_ICON[m.type]
        const actions: MenuItem[] = [
          { label: m.visible ? 'Hide from students' : 'Show to students', icon: m.visible ? EyeOff : Eye, onClick: () => { update(d => { const x = d.materials.find(x => x.id === m.id); if (x) x.visible = !m.visible }); toast(m.visible ? 'Hidden from students' : 'Visible to students') } },
          { label: 'Delete', icon: Trash2, danger: true, onClick: () => setDel(m) },
        ]
        if (m.type === 'SCORM' && canManage(db, m)) actions.unshift({ label: 'Preview as Student', icon: MonitorPlay, to: previewPath(m, here.pathname + here.search) })
        return (
          <li key={m.id} className="item">
            <span className="ico" data-hue={cls(db, m.classId).hue}><I size={19} aria-hidden /></span>
            <div className="body"><strong>{m.title}</strong><span className="small muted">{m.description}</span><span className="meta"><ClassTag id={m.classId} /><span>{m.type === 'SCORM' ? `SCORM module${m.package?.version ? ` (${m.package.version})` : ''}` : m.type}{m.size !== m.type && `, ${m.size}`}</span><span>{fmt(m.date)}</span></span></div>
            {m.type === 'SCORM' && m.package?.status === 'failed' ? <Badge tone="bad">Needs new ZIP</Badge> : <Badge tone={m.visible ? 'good' : 'neutral'}>{m.visible ? 'Visible' : 'Draft'}</Badge>}
            <Menu trigger={p => <button type="button" className="icon-btn" aria-label={`Actions for ${m.title}`} {...p}><EllipsisVertical size={18} /></button>} items={actions} />
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
  // Filters live in the address so returning from a preview restores the same view.
  const q = sp.get('q') ?? ''
  const rawType = sp.get('type') as MaterialType
  const type: 'All' | MaterialType = TYPES.includes(rawType) ? rawType : 'All'
  const cl = db.classes.some(c => c.id === sp.get('class')) ? sp.get('class')! : 'all'
  const set = (k: string, v: string) => setSp(p => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n }, { replace: true })
  const list = db.materials.filter(m => (type === 'All' || m.type === type) && (cl === 'all' || m.classId === cl) && m.title.toLowerCase().includes(q.toLowerCase()))
  return (
    <Page title="Content Library" sub={`${db.materials.length} materials across ${db.classes.length} classes`} actions={<Btn kind="primary" icon={UploadIcon} to="/library/upload">Upload material</Btn>}>
      <div className="filters">
        <div className="search"><Search size={17} aria-hidden /><input type="search" aria-label="Search materials" placeholder="Search materials" value={q} onChange={e => set('q', e.target.value)} /></div>
        <ClassSelect all value={cl} onChange={v => set('class', v === 'all' ? '' : v)} />
        <div className="seg" role="group" aria-label="Type">{(['All', ...TYPES] as const).map(t => <button key={t} type="button" aria-pressed={type === t} onClick={() => set('type', t === 'All' ? '' : t)}>{t}</button>)}</div>
      </div>
      <Panel flush>{list.length || !db.materials.length ? <MaterialList items={list} /> : <Empty icon={Search} title="No materials match" text="Clear the search or choose another class or type." action={<Btn onClick={() => setSp({})}>Clear filters</Btn>} />}</Panel>
    </Page>
  )
}

const ACCEPT: Record<MaterialType, string> = { SCORM: '.zip', PDF: '.pdf', Video: '.mp4,.webm,.mov', Slides: '.ppt,.pptx,.odp', Link: '' }

export function Upload() {
  const { db, update, toast } = useStore()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const back = safeBack(sp.get('back'))
  const replaceId = sp.get('replace')
  const replacing = replaceId ? db.materials.find(m => m.id === replaceId && m.type === 'SCORM' && canManage(db, m)) : undefined
  const mine = teaching(db)
  const startClass = replacing?.classId ?? (mine.some(t => t.classId === sp.get('class')) ? sp.get('class')! : mine[0]?.classId ?? '')
  const [rules, setRules] = useState(SCORM_RULES)
  const [type, setType] = useState<MaterialType>('SCORM')
  const [f, setF] = useState({ title: replacing?.title ?? '', classId: startClass, subject: replacing?.subject ?? subjectsFor(db, startClass)[0] ?? '', description: replacing?.description ?? '', url: '', visible: replacing?.visible ?? true })
  const [file, setFile] = useState<File | null>(null)
  const [check, setCheck] = useState<ScormCheck | null>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [err, setErr] = useState<{ title?: string; target?: string; file?: string; url?: string }>({})
  const pick = useRef<HTMLInputElement>(null)
  const run = useRef(0)
  useEffect(() => { let on = true; void loadScormRules().then(r => { if (on) setRules(r) }); return () => { on = false } }, [])
  const clear = () => { run.current++; setFile(null); setCheck(null); setBusy(false); if (pick.current) pick.current.value = '' }

  if (replaceId && !replacing) return <Page title="Replace SCORM package" back={back}><Empty icon={ShieldX} title="You can't replace this package" text="The material doesn't exist, isn't a SCORM module, or belongs to a section you aren't assigned to." action={<Btn to={back}>Back</Btn>} /></Page>

  const take = async (x: File | undefined) => {
    if (!x) return
    clear()
    setErr(e => ({ ...e, file: undefined }))
    if (type !== 'SCORM') {
      const ok = ACCEPT[type].split(',').some(ext => x.name.toLowerCase().endsWith(ext))
      if (!ok) return setErr(e => ({ ...e, file: `${x.name} is not a ${type} file. Choose ${ACCEPT[type].replaceAll(',', ', ')}.` }))
      return setFile(x)
    }
    setFile(x)
    const mine = run.current
    setBusy(true)
    let r: ScormCheck
    try { r = await checkScorm(x, rules) } catch { r = { ok: false, code: 'unreadable', reason: 'The file could not be read. Export the package again and retry.' } }
    if (mine !== run.current) return
    setBusy(false); setCheck(r)
    if (r.ok && r.title) setF(v => v.title ? v : { ...v, title: r.title })
  }

  const setClass = (classId: string) => {
    const subs = subjectsFor(db, classId)
    setF({ ...f, classId, subject: subs.includes(f.subject) ? f.subject : subs[0] ?? '' })
    setErr(e => ({ ...e, target: undefined }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const bad: typeof err = {}
    if (!f.title.trim()) bad.title = 'Give the material a title students will recognise.'
    const target = targetError(db, f.classId, f.subject)
    if (target) bad.target = target
    if (type === 'Link') { if (!/^https?:\/\/\S+\.\S+/.test(f.url.trim())) bad.url = 'Enter a full web address starting with https://' }
    else if (!file) bad.file = `Choose a ${type === 'SCORM' ? 'SCORM .zip' : type} file to upload.`
    else if (busy) bad.file = 'Wait for the package check to finish.'
    else if (type === 'SCORM' && (!check || !check.ok)) bad.file = 'Fix the package problem above, then try again. Your other details are kept.'
    setErr(bad)
    if (Object.keys(bad).length) return
    const pkg = type === 'SCORM' && check?.ok ? { status: 'ready' as const, version: check.version, launch: check.launch, files: check.files } : undefined
    const fields = { title: f.title.trim(), classId: f.classId, subject: f.subject, description: f.description.trim(), size: file ? fileSize(file.size) : 'Link', file: file?.name ?? f.url.trim(), visible: f.visible, date: today() }
    update(d => {
      // Re-check inside the write so a stale form can never publish to a section the teacher doesn't teach.
      if (targetError(d, fields.classId, fields.subject)) return
      const old = replacing && d.materials.find(x => x.id === replacing.id)
      if (old) Object.assign(old, fields, { package: pkg })
      else d.materials.unshift({ id: uid(), type, ...fields, ...(pkg && { package: pkg }) })
      log(d, f.classId, 'material', `${old ? 'SCORM package replaced' : `Material ${f.visible ? 'uploaded' : 'saved as draft'}`}: ${fields.title}`)
    })
    toast(replacing ? 'Package replaced' : f.visible ? `Published to ${cls(db, f.classId).name}` : 'Saved as draft')
    nav(back)
  }

  const subjects = subjectsFor(db, f.classId)
  const scorm = type === 'SCORM'
  return (
    <Page title={replacing ? 'Replace SCORM Package' : 'Upload Material'} back={back}>
      <form className="grid-2" onSubmit={submit} noValidate>
        <Panel title="Details">
          <div className="form">
            {!replacing && <div className="field wide"><label id="mt">Material Type</label><div className="types" role="group" aria-labelledby="mt">{TYPES.map(t => { const I = TYPE_ICON[t]; return <button key={t} type="button" aria-pressed={type === t} onClick={() => { setType(t); clear(); setErr({}) }}><I size={22} aria-hidden />{t}</button> })}</div>{scorm && <p className="hint">Interactive module exported from a tool such as Articulate, Captivate or iSpring.</p>}</div>}
            <Field label="Title" required wide error={err.title}>{id => <input id={id} value={f.title} placeholder="Electric Charges - Interactive Module" onChange={e => setF({ ...f, title: e.target.value })} />}</Field>
            <Field label="Class" required error={err.target} hint="Only the sections you're assigned to.">{id => <ClassSelect id={id} ids={mine.map(t => t.classId)} value={f.classId} onChange={setClass} />}</Field>
            <Field label="Subject" required hint={subjects.length === 1 ? `The subject you teach in ${cls(db, f.classId).name}.` : undefined}>{id => <select id={id} value={f.subject} onChange={e => { setF({ ...f, subject: e.target.value }); setErr(x => ({ ...x, target: undefined })) }}>{subjects.map(s => <option key={s}>{s}</option>)}</select>}</Field>
            <Field label="Description" wide>{id => <textarea id={id} value={f.description} placeholder="What students will do with this" onChange={e => setF({ ...f, description: e.target.value })} />}</Field>
          </div>
        </Panel>
        <div className="stack">
          <Panel title={type === 'Link' ? 'Web address' : `Upload ${scorm ? 'SCORM File' : type}`}>
            {type === 'Link'
              ? <Field label="Address" required error={err.url}>{id => <input id={id} inputMode="url" value={f.url} placeholder="https://" onChange={e => setF({ ...f, url: e.target.value })} />}</Field>
              : <>
                <div className={`drop ${over ? 'over' : ''}`} onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]) }}>
                  {(() => { const I = TYPE_ICON[type]; return <I size={40} strokeWidth={1.5} aria-hidden /> })()}
                  <strong>Drag and drop your {scorm ? 'SCORM .zip' : type} file here</strong>
                  <span className="muted small">or</span>
                  <Btn onClick={() => pick.current?.click()} aria-describedby={scorm ? 'scorm-rules' : undefined}>Choose File</Btn>
                  <input ref={pick} type="file" hidden accept={scorm ? rules.extensions.join(',') : ACCEPT[type]} onChange={e => void take(e.target.files?.[0])} />
                </div>
                {scorm && <div className="rules" id="scorm-rules">
                  <ul className="rule-list">
                    <li><span className="muted">Supported</span><strong>{rules.versions.join(', ')}</strong></li>
                    <li><span className="muted">Format</span><strong>{rules.extensions.join(', ')}</strong></li>
                    <li><span className="muted">Maximum size</span><strong>{fileSize(rules.maxBytes)}</strong></li>
                  </ul>
                  <p className="small muted">Upload the ZIP your authoring tool exports for SCORM. <code>imsmanifest.xml</code> and the module’s launch files must be at the top level of the ZIP, so zip the package contents, not the folder that holds them.</p>
                </div>}
                {file && <div className={`file ${check ? (check.ok ? 'good' : 'bad') : ''}`}>
                  {check && !check.ok ? <CircleAlert size={22} color="var(--bad)" aria-hidden /> : <CircleCheck size={22} color={busy ? 'var(--ink-2)' : 'var(--good)'} aria-hidden />}
                  <div className="grow"><strong className="clip" style={{ display: 'block' }}>{file.name}</strong><span className="small muted" role="status">{busy ? 'Checking package…' : check?.ok ? `${check.version} detected, ${check.files} files. Launches ${check.launch}. Ready to launch.` : check ? check.reason : fileSize(file.size)}</span></div>
                  <span className="small muted num">{check || busy ? fileSize(file.size) : ''}</span>
                  <button type="button" className="icon-btn" aria-label="Remove file" onClick={clear}><X size={17} /></button>
                </div>}
                {err.file && <p className="err" role="alert">{err.file}</p>}
              </>}
          </Panel>
          <Panel title="Visibility">
            <label className="radio"><input type="radio" name="vis" checked={f.visible} onChange={() => setF({ ...f, visible: true })} /><span>Show to Students<br /><span className="muted small">Available to {cls(db, f.classId).name} students only, as soon as you {replacing ? 'save' : 'publish'}.</span></span></label>
            <label className="radio"><input type="radio" name="vis" checked={!f.visible} onChange={() => setF({ ...f, visible: false })} /><span>Hide (Draft)<br /><span className="muted small">Only you can see it.</span></span></label>
            <div className="form-actions"><Btn to={back}>Cancel</Btn><Btn kind="primary" type="submit">{replacing ? 'Replace package' : f.visible ? 'Publish' : 'Save draft'}</Btn></div>
          </Panel>
        </div>
      </form>
    </Page>
  )
}
