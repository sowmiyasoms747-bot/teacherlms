import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Atom, Dna, FlaskConical, FileText, Link as LinkIcon, Microscope, Package, Presentation, Video, X, type LucideIcon } from 'lucide-react'
import type { ClassRoom, MaterialType } from './types'
import { useDB, cls } from './store'

export const CLASS_ICON: Record<ClassRoom['icon'], LucideIcon> = { atom: Atom, flask: FlaskConical, microscope: Microscope, dna: Dna }
export const TYPE_ICON: Record<MaterialType, LucideIcon> = { SCORM: Package, PDF: FileText, Video, Slides: Presentation, Link: LinkIcon }

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'soft' | 'plain' | 'danger'; icon?: LucideIcon; to?: string; small?: boolean }
export function Btn({ kind = 'soft', icon: I, to, small, children, className = '', ...rest }: BtnProps) {
  const c = `btn btn-${kind} ${small ? 'btn-sm' : ''} ${className}`
  const body = <>{I && <I size={small ? 15 : 17} aria-hidden />}{children && <span>{children}</span>}</>
  return to ? <Link className={c} to={to}>{body}</Link> : <button type="button" className={c} {...rest}>{body}</button>
}

export function Page({ title, sub, back, actions, children }: { title: ReactNode; sub?: ReactNode; back?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <header className="page-head">
        <div className="page-title">
          {back && <Link className="icon-btn" to={back} aria-label="Back"><ArrowLeft size={18} /></Link>}
          <div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
        </div>
        {actions && <div className="row wrap">{actions}</div>}
      </header>
      {children}
    </div>
  )
}

export function Panel({ title, action, children, className = '', flush }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`panel ${flush ? 'flush' : ''} ${className}`}>
      {title && <header className="panel-head"><h2>{title}</h2>{action}</header>}
      {children}
    </section>
  )
}

export function Tabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (v: T) => void; items: readonly { id: T; label: string; count?: number }[]; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-selected=true]')
    if (el && ref.current) ref.current.scrollTo({ left: el.offsetLeft - 24 })
  }, [value])
  return (
    <div className="tabs" role="tablist" aria-label={label} ref={ref} onKeyDown={e => {
      const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (!step) return
      const i = items.findIndex(x => x.id === value)
      const next = items[(i + step + items.length) % items.length]
      onChange(next.id)
      ref.current?.querySelector<HTMLElement>(`[data-id="${next.id}"]`)?.focus()
    }}>
      {items.map(t => (
        <button key={t.id} data-id={t.id} type="button" role="tab" aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1} onClick={() => onChange(t.id)}>
          {t.label}{t.count !== undefined && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** A class is always shown as colour + name, never colour alone. */
export function ClassTag({ id }: { id: string }) {
  const c = cls(useDB(), id)
  return <span className="class-tag" data-hue={c.hue}><i />{c.name}</span>
}

export function ClassMark({ c, size = 40 }: { c: ClassRoom; size?: number }) {
  const I = CLASS_ICON[c.icon]
  return <span className="class-mark" data-hue={c.hue} style={{ width: size, height: size }}><I size={size * 0.52} aria-hidden /></span>
}

export function Badge({ tone = 'neutral', children }: { tone?: 'good' | 'warn' | 'bad' | 'neutral' | 'accent'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const parts = name.replace(/^(Ms|Mr|Mrs|Dr)\.\s*/, '').split(/\s+/)
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>{(parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')}</span>
}

export function Empty({ icon: I, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return <div className="empty"><I size={28} aria-hidden /><strong>{title}</strong><p className="muted">{text}</p>{action}</div>
}

export function Field({ label, required, hint, error, children, wide }: { label: string; required?: boolean; hint?: string; error?: string; children: (id: string) => ReactNode; wide?: boolean }) {
  const id = useId()
  return (
    <div className={`field ${wide ? 'wide' : ''} ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}{required && <span className="req" aria-hidden> *</span>}</label>
      {children(id)}
      {error ? <p className="err" role="alert">{error}</p> : hint && <p className="hint">{hint}</p>}
    </div>
  )
}

export function ClassSelect({ id, value, onChange, all }: { id?: string; value: string; onChange: (v: string) => void; all?: boolean }) {
  const db = useDB()
  return (
    <select id={id} aria-label={id ? undefined : 'Class'} value={value} onChange={e => onChange(e.target.value)}>
      {all && <option value="all">All classes</option>}
      {db.classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal() }, [])
  return (
    <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-labelledby={id} onClose={onClose} onMouseDown={e => { if (e.target === ref.current) onClose() }}>
      <div className="modal-body">
        <header className="modal-head"><h2 id={id}>{title}</h2><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button></header>
        {children}
      </div>
    </dialog>
  )
}

export function Confirm({ title, text, action, onYes, onClose }: { title: string; text: string; action: string; onYes: () => void; onClose: () => void }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted">{text}</p>
      <div className="form-actions"><Btn onClick={onClose}>Cancel</Btn><Btn kind="danger" onClick={() => { onYes(); onClose() }}>{action}</Btn></div>
    </Modal>
  )
}

export type MenuItem = { label: string; icon?: LucideIcon; to?: string; onClick?: () => void; danger?: boolean }
export function Menu({ trigger, items, align = 'right' }: { trigger: (p: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu' }) => ReactNode; items: MenuItem[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const nav = useNavigate()
  useDismiss(ref, open, () => setOpen(false))
  useEffect(() => { if (open) ref.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus() }, [open])
  return (
    <div className="menu-wrap" ref={ref}>
      {trigger({ onClick: () => setOpen(o => !o), 'aria-expanded': open, 'aria-haspopup': 'menu' })}
      {open && (
        <div className={`pop menu ${align}`} role="menu" onKeyDown={e => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
          e.preventDefault()
          const all = [...ref.current!.querySelectorAll<HTMLElement>('[role=menuitem]')]
          all[(all.indexOf(document.activeElement as HTMLElement) + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length]?.focus()
        }}>
          {items.map(i => (
            <button key={i.label} type="button" role="menuitem" className={i.danger ? 'danger' : ''} onClick={() => { setOpen(false); if (i.to) nav(i.to); i.onClick?.() }}>
              {i.icon && <i.icon size={16} aria-hidden />}{i.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function useDismiss(ref: React.RefObject<HTMLElement | null>, open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close() }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); ref.current?.querySelector<HTMLElement>('button')?.focus() } }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  })
}

/* ---------- charts ---------- */

export function Columns({ data, highlight, max = 100, label }: { data: { label: string; value: number }[]; highlight?: string; max?: number; label: string }) {
  const ticks = [0, 25, 50, 75, 100].filter(t => t <= max)
  return (
    <figure className="columns" role="img" aria-label={`${label}: ${data.map(d => `${d.label} ${d.value}%`).join(', ')}`}>
      <div className="plot" aria-hidden>
        {ticks.map(t => <span key={t} className="tick" style={{ bottom: `${(t / max) * 100}%` }}><b>{t}</b></span>)}
        <div className="bars">
          {data.map(d => (
            <div key={d.label} className="col" title={`${d.label}: ${d.value}%`}>
              <span className="val" style={{ bottom: `${(d.value / max) * 100}%` }}>{d.value}</span>
              <span className={`bar ${highlight && d.label !== highlight ? 'quiet' : ''}`} style={{ height: `${(d.value / max) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="x" aria-hidden>{data.map(d => <span key={d.label} className={d.label === highlight ? 'strong' : ''}>{d.label}</span>)}</div>
    </figure>
  )
}

/** Whole percentages that always add up to 100. */
function shares(values: number[], total: number) {
  const out = values.map(v => Math.floor((v / total) * 100))
  const order = values.map((v, i) => ({ i, f: (v / total) * 100 - out[i] })).sort((a, b) => b.f - a.f)
  for (let k = 0, left = 100 - out.reduce((a, b) => a + b, 0); k < left; k++) out[order[k].i]++
  return out
}

const BAND_CLASS = ['b1', 'b2', 'b3']
export function BandBar({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const total = data.reduce((n, d) => n + d.value, 0)
  if (!total) return <p className="muted">No scores yet</p>
  const pct = shares(data.map(d => d.value), total)
  return (
    <div className="bandbar" role="img" aria-label={`${label}: ${data.map(d => `${d.label} ${d.value} of ${total}`).join(', ')}`}>
      {data.map((d, i) => d.value > 0 && (
        <span key={d.label} className={BAND_CLASS[i]} style={{ flexGrow: d.value }} title={`${d.label}: ${d.value} students`}>
          {d.value / total > 0.09 ? `${pct[i]}%` : ''}
        </span>
      ))}
    </div>
  )
}
export function BandLegend({ data }: { data: { label: string; value: number }[] }) {
  return <ul className="legend">{data.map((d, i) => <li key={d.label}><i className={BAND_CLASS[i]} />{d.label}</li>)}</ul>
}

export function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const w = 92, h = 28, lo = Math.min(...values) - 4, hi = Math.max(...values) + 4
  const pts = values.map((v, i) => [4 + (i / (values.length - 1)) * (w - 8), h - 3 - ((v - lo) / (hi - lo)) * (h - 6)])
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Last ${values.length} tests: ${values.join(', ')}`}>
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" /><circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="4" />
    </svg>
  )
}

export function Lines({ series, labels, label, unit = '%' }: { series: { name: string; hue: number; values: number[] }[]; labels: string[]; label: string; unit?: string }) {
  const [at, setAt] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const ro = new ResizeObserver(e => setW(Math.max(280, e[0].contentRect.width)))
    if (box.current) ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  // Scale starts at the 20-point step below the lowest value, so close lines stay readable.
  const min = Math.max(0, Math.floor((Math.min(...series.flatMap(s => s.values)) - 1) / 20) * 20)
  const H = 260, L = 34, R = 14, T = 14, B = 28
  const x = (i: number) => L + (i / (labels.length - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - min) / (100 - min)) * (H - T - B)
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((100 - min) / 4) * i)
  const every = W < 480 ? 2 : 1
  const move = (px: number) => setAt(Math.max(0, Math.min(labels.length - 1, Math.round(((px - L) / (W - L - R)) * (labels.length - 1)))))
  return (
    <div className="lines">
      <ul className="legend">{series.map(s => <li key={s.name} data-hue={s.hue}><i className="hue-dot" />{s.name}</li>)}</ul>
      <div className="lines-plot" ref={box} tabIndex={0} role="img" aria-label={`${label}. ${series.map(s => `${s.name} from ${s.values[0]}${unit} to ${s.values.at(-1)}${unit}`).join('; ')}`}
        onPointerMove={e => move(e.clientX - e.currentTarget.getBoundingClientRect().left)} onPointerLeave={() => setAt(null)} onBlur={() => setAt(null)}
        onKeyDown={e => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); setAt(a => Math.max(0, Math.min(labels.length - 1, (a ?? labels.length - 1) + d))) } }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden>
          {ticks.map(t => <g key={t}><line className="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text x={L - 8} y={y(t) + 4} textAnchor="end">{t}</text></g>)}
          {labels.map((l, i) => i % every === (labels.length - 1) % every && <text key={l} x={x(i)} y={H - 8} textAnchor={i === labels.length - 1 ? 'end' : 'middle'}>{l}</text>)}
          {at !== null && <line className="cross" x1={x(at)} x2={x(at)} y1={T} y2={H - B} />}
          {series.map(s => (
            <g key={s.name} data-hue={s.hue}>
              <polyline className="line" points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
              <circle className="dot" cx={x(at ?? labels.length - 1)} cy={y(s.values[at ?? labels.length - 1])} r="5" />
            </g>
          ))}
        </svg>
        {at !== null && (
          <div className="tip" style={{ left: Math.min(W - 170, Math.max(0, x(at) + (x(at) > W / 2 ? -172 : 12))) }}>
            <strong>{labels[at]}</strong>
            {[...series].sort((a, b) => b.values[at] - a.values[at]).map(s => <span key={s.name} data-hue={s.hue}><i className="hue-dot" />{s.name}<b>{s.values[at]}{unit}</b></span>)}
          </div>
        )}
      </div>
    </div>
  )
}
