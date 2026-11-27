import { describe, expect, it, vi } from 'vitest'
import { seed } from './seed'
import type { DB, Material } from './types'
import { canManage, loadScormRules, previewPath, previewReadiness, safeBack, startPreview, targetError, visibleTo } from './content'

const db = (): DB => seed()
const scorm = (d: DB, id = 'm2') => d.materials.find(m => m.id === id)!

describe('section targeting (TCH-02)', () => {
  it('lets the Class 12-A teacher target their section and subject', () => expect(targetError(db(), '12-a', 'Physics')).toBeNull())
  it('rejects an unassigned section', () => expect(targetError(db(), '10-c', 'Physics')).toMatch(/not assigned/))
  it('rejects a subject the teacher does not teach in that section', () => expect(targetError(db(), '12-a', 'Biology')).toMatch(/do not teach Biology/))
})

describe('audience (TCH-02)', () => {
  it('a material published to 12-A reaches 12-A learners only, and drafts reach nobody', () => {
    const d = db()
    d.materials = [
      { ...scorm(d), id: 'pub', classId: '12-a', visible: true },
      { ...scorm(d), id: 'draft', classId: '12-a', visible: false },
    ]
    const a = d.students.find(s => s.classId === '12-a')!, b = d.students.find(s => s.classId === '12-b')!
    expect(visibleTo(d, a).map(m => m.id)).toEqual(['pub'])
    expect(visibleTo(d, b)).toEqual([])
  })
})

describe('preview authorization and readiness (TCH-01)', () => {
  it('allows preview of a published and a draft item the teacher manages', () => {
    const d = db(), pub = scorm(d), draft: Material = { ...pub, id: 'd', visible: false }
    expect(canManage(d, pub) && canManage(d, draft)).toBe(true)
    expect(previewReadiness(pub)).toMatchObject({ ok: true, version: 'SCORM 2004' })
    expect(previewReadiness(draft).ok).toBe(true)
  })
  it('refuses preview of a material in a section the teacher is not assigned to', () => {
    const d = db()
    expect(canManage(d, { ...scorm(d), classId: '10-c' })).toBe(false)
  })
  it('blocks launch with a recovery action when the file is missing, pending or failed', () => {
    const m = scorm(db())
    expect(previewReadiness({ ...m, file: '' })).toMatchObject({ ok: false, recover: 'replace' })
    expect(previewReadiness({ ...m, package: undefined })).toMatchObject({ ok: false, recover: 'replace' })
    expect(previewReadiness({ ...m, package: { status: 'pending' } })).toMatchObject({ ok: false, recover: 'replace' })
    const failed = previewReadiness({ ...m, package: { status: 'failed', reason: 'No imsmanifest.xml found.' } })
    expect(failed).toMatchObject({ ok: false, recover: 'replace' })
    if (!failed.ok) expect(failed.reason).toContain('No imsmanifest.xml found.')
  })
  it('keeps the library view in the preview link and refuses off-site return addresses', () => {
    expect(previewPath(scorm(db()), '/library?type=SCORM&class=12-a')).toBe('/library/m2/preview?back=%2Flibrary%3Ftype%3DSCORM%26class%3D12-a')
    expect(safeBack('/library?type=SCORM')).toBe('/library?type=SCORM')
    for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', '', null]) expect(safeBack(bad)).toBe('/library')
  })
})

describe('preview tracking isolation (TCH-01, client side)', () => {
  it('without a connected player, does not call the network and changes nothing', async () => {
    const d = db(), before = structuredClone(d), fetcher = vi.fn()
    expect(await startPreview('m2', fetcher as unknown as typeof fetch)).toEqual({ kind: 'unavailable' })
    expect(fetcher).not.toHaveBeenCalled()
    expect(d).toEqual(before)
  })
  it('falls back to the shared rules when no API is configured', async () => {
    const fetcher = vi.fn()
    expect((await loadScormRules(fetcher as unknown as typeof fetch)).source).toBe('built-in')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
