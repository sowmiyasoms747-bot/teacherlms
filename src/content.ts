/** Shared Content Library rules: who may manage a material, where it may be published,
 *  whether a SCORM item can be previewed, and the client for the LMS content API.
 *
 *  This repository has no backend. Every check here also has to run on the server (see
 *  docs/scorm-integration.md); the client copy only keeps the UI honest about what will be allowed. */
import type { DB, Material, Student } from './types'
import { SCORM_RULES, type ScormRules } from './scorm'

/** The sections this teacher is assigned to, each with the subjects they teach there. */
export const teaching = (db: DB) => db.classes.map(c => ({ classId: c.id, subjects: [c.subject] }))
export const subjectsFor = (db: DB, classId: string) => teaching(db).find(t => t.classId === classId)?.subjects ?? []

/** null when the teacher may publish to this section and subject, otherwise the reason they may not. */
export function targetError(db: DB, classId: string, subject: string): string | null {
  const t = teaching(db).find(x => x.classId === classId)
  if (!t) return 'You are not assigned to this section. Choose one of your classes.'
  if (!t.subjects.includes(subject)) return `You do not teach ${subject || 'that subject'} in this section. Choose ${t.subjects.join(' or ')}.`
  return null
}
export const canManage = (db: DB, m: Material) => targetError(db, m.classId, m.subject) === null

/** Which published materials a learner receives: their own section only, never drafts. */
export const visibleTo = (db: DB, s: Student) => db.materials.filter(m => m.visible && m.classId === s.classId)

export type Readiness = { ok: true; version: string; launch: string } | { ok: false; reason: string; recover?: 'replace' }
export function previewReadiness(m: Material): Readiness {
  if (m.type !== 'SCORM') return { ok: false, reason: 'Preview as Student is available for SCORM modules.' }
  if (!m.file) return { ok: false, reason: 'The package file is missing. Upload the SCORM ZIP again to restore it.', recover: 'replace' }
  const p = m.package
  if (!p || p.status === 'pending') return { ok: false, reason: 'This package has not been validated yet, so it cannot launch. Upload the ZIP again to validate it now.', recover: 'replace' }
  if (p.status === 'failed') return { ok: false, reason: `This package failed validation: ${p.reason ?? 'the manifest could not be read.'} Replace the ZIP to fix it.`, recover: 'replace' }
  if (!p.version || !p.launch) return { ok: false, reason: 'The package has no detected SCORM version or launch file. Replace the ZIP to validate it again.', recover: 'replace' }
  return { ok: true, version: p.version, launch: p.launch }
}

/** Only same-app paths, so a crafted link cannot send the teacher to another site after the preview. */
export const safeBack = (raw: string | null | undefined, fallback = '/library') => raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes('\\') ? raw : fallback
export const previewPath = (m: Material, back: string) => `/library/${encodeURIComponent(m.id)}/preview?back=${encodeURIComponent(back)}`

/* ---------- LMS content API ---------- */
const env = import.meta.env as Record<string, string | undefined>
export const API = (env.VITE_LMS_API_URL ?? '').replace(/\/+$/, '')
export const PLAYER_ORIGIN = env.VITE_STUDENT_PLAYER_ORIGIN ?? ''
export const playerConnected = () => Boolean(API && PLAYER_ORIGIN)

/** The server's effective SCORM rules, or the shared built-in rules when no API is configured. */
export async function loadScormRules(fetcher: typeof fetch = fetch): Promise<ScormRules> {
  if (!API) return SCORM_RULES
  try {
    const r = await fetcher(`${API}/teacher/scorm/rules`, { credentials: 'include' })
    if (!r.ok) return SCORM_RULES
    const j = await r.json() as Partial<ScormRules>
    if (!Array.isArray(j.versions) || typeof j.maxBytes !== 'number' || j.maxBytes <= 0) return SCORM_RULES
    return { versions: j.versions, extensions: j.extensions?.length ? j.extensions : ['.zip'], maxBytes: j.maxBytes, source: 'server' }
  } catch { return SCORM_RULES }
}

export type PreviewStart =
  | { kind: 'started'; attemptId: string; launchUrl: string }
  | { kind: 'unavailable' }
  | { kind: 'forbidden' }
  | { kind: 'not-ready'; reason: string }
  | { kind: 'error'; reason: string }

/** Asks the server to open an isolated staff-preview attempt in the Student Portal's player.
 *  The server must check the teacher manages this material, and must keep the attempt out of
 *  student progress, attempts, grades, reports and completion totals. It must not change visibility. */
export async function startPreview(materialId: string, fetcher: typeof fetch = fetch): Promise<PreviewStart> {
  if (!playerConnected()) return { kind: 'unavailable' }
  try {
    const r = await fetcher(`${API}/teacher/content/${encodeURIComponent(materialId)}/preview-attempts`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'staff-preview' }),
    })
    if (r.status === 401 || r.status === 403 || r.status === 404) return { kind: 'forbidden' }
    const j = await r.json().catch(() => ({})) as { attemptId?: string; launchUrl?: string; reason?: string }
    if (r.status === 409) return { kind: 'not-ready', reason: j.reason ?? 'The package is not ready to launch.' }
    if (!r.ok || !j.attemptId || !j.launchUrl) return { kind: 'error', reason: 'The preview could not be started. Try again in a moment.' }
    if (new URL(j.launchUrl, PLAYER_ORIGIN).origin !== new URL(PLAYER_ORIGIN).origin) return { kind: 'error', reason: 'The player address returned by the server is not the Student Portal player.' }
    return { kind: 'started', attemptId: j.attemptId, launchUrl: j.launchUrl }
  } catch { return { kind: 'error', reason: 'The LMS could not be reached. Check your connection and try again.' } }
}

export type PreviewResult = { completion: string; success?: string; score?: number | null }
/** What the preview attempt has reported so far, as recorded by the player on the server. */
export async function previewResult(attemptId: string, fetcher: typeof fetch = fetch): Promise<PreviewResult | null> {
  if (!API) return null
  try {
    const r = await fetcher(`${API}/teacher/preview-attempts/${encodeURIComponent(attemptId)}`, { credentials: 'include' })
    return r.ok ? await r.json() as PreviewResult : null
  } catch { return null }
}
