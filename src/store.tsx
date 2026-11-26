import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Activity, Assignment, DB, Mark, Student } from './types'
import { SUBJECTS, seed } from './seed'
import { lastSchoolDays, mins, now, nowStamp, today } from './dates'

const KEY = 'learning-universe-v1'
type Toast = { id: number; text: string }
type Store = { db: DB; update: (fn: (draft: DB) => void) => void; reset: () => void; toast: (t: string) => void; toasts: Toast[] }
const Ctx = createContext<Store | null>(null)
export const useStore = () => useContext(Ctx)!
export const useDB = () => useStore().db

function load(): DB {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as DB } catch { /* storage blocked or corrupt: start fresh */ }
  return seed()
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load)
  const [toasts, setToasts] = useState<Toast[]>([])
  const n = useRef(0)
  const touched = useRef(false)

  const update = useCallback((fn: (d: DB) => void) => {
    touched.current = true
    setDb(prev => { const next = structuredClone(prev); fn(next); return next })
  }, [])
  const reset = useCallback(() => {
    touched.current = false
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    setDb(seed())
  }, [])
  const toast = useCallback((text: string) => {
    const id = ++n.current
    setToasts(t => [...t.slice(-2), { id, text }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3600)
  }, [])

  useEffect(() => { if (touched.current) try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ignore */ } }, [db])
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => { document.documentElement.dataset.theme = db.settings.theme === 'system' ? (mq.matches ? 'dark' : 'light') : db.settings.theme }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [db.settings.theme])

  const value = useMemo(() => ({ db, update, reset, toast, toasts }), [db, update, reset, toast, toasts])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/* ---------- derived values: every number on screen comes from here ---------- */
export const uid = () => Math.random().toString(36).slice(2, 9)
export const cls = (db: DB, id: string) => db.classes.find(c => c.id === id) ?? db.classes[0]
export const inClass = (db: DB, id: string) => db.students.filter(s => s.classId === id)
export const pendingOf = (a: Assignment) => a.submissions.filter(s => s.mark === null).length
export const pendingTotal = (db: DB) => db.assignments.reduce((n, a) => n + pendingOf(a), 0)
export type AState = 'Active' | 'Upcoming' | 'Completed'
export const stateOf = (a: Assignment): AState => a.opens > today() ? 'Upcoming' : a.due < today() ? 'Completed' : 'Active'
export const mean = (xs: number[]) => xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null
export const latest = (s: Student) => s.tests.at(-1) ?? null
const scored = (list: Student[]) => list.filter(s => s.tests.length)
export const average = (list: Student[]) => mean(scored(list).map(s => s.tests.at(-1)!))
export const subjectAverages = (list: Student[]) => SUBJECTS.map(label => ({ label, value: mean(scored(list).map(s => s.subjects[label])) ?? 0 }))
export const BANDS = ['Excellent', 'Good', 'Needs attention'] as const
export const bandOf = (s: Student) => { const x = latest(s); return x === null ? null : x >= 75 ? BANDS[0] : x >= 50 ? BANDS[1] : BANDS[2] }
export const bands = (list: Student[]) => BANDS.map(label => ({ label, value: list.filter(s => bandOf(s) === label).length }))
export const tally = (marks: Record<string, Mark> | undefined) => {
  const v = Object.values(marks ?? {})
  return { P: v.filter(x => x === 'P').length, A: v.filter(x => x === 'A').length, L: v.filter(x => x === 'L').length, total: v.length }
}
/** Late counts as attended. */
export function attendancePct(db: DB, classId: string, studentId?: string) {
  let here = 0, total = 0
  for (const d of lastSchoolDays(10)) {
    const rec = db.attendance[`${classId}:${d}`]
    if (!rec) continue
    for (const [id, m] of Object.entries(rec)) if (!studentId || id === studentId) { total++; if (m !== 'A') here++ }
  }
  return total ? Math.round((here / total) * 100) : null
}
export const periodsOn = (db: DB, day: number) => db.timetable.filter(p => p.day === day).sort((a, b) => mins(a.start) - mins(b.start))
export const log = (d: DB, classId: string, kind: Activity['kind'], text: string) => { d.activity.unshift({ id: uid(), classId, kind, text, at: nowStamp() }) }
export const nowMins = () => now().getHours() * 60 + now().getMinutes()
/** Today's lessons that have started but have no register yet. */
export const unmarked = (db: DB) => periodsOn(db, now().getDay()).filter(p => mins(p.start) <= nowMins() && !db.attendance[`${p.classId}:${today()}`])

export type Notice = { id: string; kind: 'register' | 'review' | 'message'; text: string; detail: string; action: string; to: string }
export function notices(db: DB): Notice[] {
  const on = db.settings.notify
  const out: Notice[] = []
  if (on.attendance) for (const p of unmarked(db)) out.push({ id: `reg-${p.classId}`, kind: 'register', text: `${cls(db, p.classId).name} register not marked`, detail: `Lesson started at ${p.start.replace(/^0/, '')}`, action: 'Mark now', to: `/attendance?class=${p.classId}` })
  if (on.submissions) for (const a of db.assignments) { const n = pendingOf(a); if (n) out.push({ id: `rev-${a.id}`, kind: 'review', text: `${n} ${n === 1 ? 'submission' : 'submissions'} to review`, detail: `${a.title}, ${cls(db, a.classId).name}`, action: 'Review', to: `/assignments/${a.id}` }) }
  if (on.messages) for (const t of db.threads) if (t.unread) out.push({ id: `msg-${t.id}`, kind: 'message', text: t.name, detail: t.messages.at(-1)!.text, action: 'Reply', to: `/messages?t=${t.id}` })
  return out
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  // A leading = + - @ would run as a formula when the file is opened in a spreadsheet.
  const cell = (v: string | number) => { let s = String(v); if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const blob = new Blob(['﻿' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
