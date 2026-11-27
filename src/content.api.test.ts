import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Client contract with the LMS API. These use a stubbed fetch, so they prove what the Teacher
 *  app sends and how it handles answers, not that a real server or player behaves correctly. */
const load = async () => { vi.resetModules(); return import('./content') }
const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

beforeEach(() => {
  vi.stubEnv('VITE_LMS_API_URL', 'https://api.lms.test/')
  vi.stubEnv('VITE_STUDENT_PLAYER_ORIGIN', 'https://learn.lms.test')
})

describe('startPreview request (TCH-01)', () => {
  it('asks for an isolated staff-preview attempt for that material only', async () => {
    const { startPreview } = await load()
    const f = reply(201, { attemptId: 'pa_1', launchUrl: 'https://learn.lms.test/player/pa_1' })
    expect(await startPreview('m2', f as unknown as typeof fetch)).toEqual({ kind: 'started', attemptId: 'pa_1', launchUrl: 'https://learn.lms.test/player/pa_1' })
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.lms.test/teacher/content/m2/preview-attempts')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(JSON.parse(init.body as string)).toEqual({ mode: 'staff-preview' })
  })
  it('treats a server refusal as not authorized, including for a direct link', async () => {
    const { startPreview } = await load()
    for (const s of [401, 403, 404]) expect(await startPreview('other', reply(s, {}) as unknown as typeof fetch)).toEqual({ kind: 'forbidden' })
  })
  it('shows the server reason when the package is not ready', async () => {
    const { startPreview } = await load()
    expect(await startPreview('m2', reply(409, { reason: 'Validation pending' }) as unknown as typeof fetch)).toEqual({ kind: 'not-ready', reason: 'Validation pending' })
  })
  it('refuses to frame a launch URL that is not the Student Portal player', async () => {
    const { startPreview } = await load()
    const r = await startPreview('m2', reply(201, { attemptId: 'x', launchUrl: 'https://evil.test/p' }) as unknown as typeof fetch)
    expect(r.kind).toBe('error')
  })
})

describe('loadScormRules (TCH-02)', () => {
  it('uses the server limit when the API provides one', async () => {
    const { loadScormRules } = await load()
    const r = await loadScormRules(reply(200, { versions: ['SCORM 1.2', 'SCORM 2004'], extensions: ['.zip'], maxBytes: 262144000 }) as unknown as typeof fetch)
    expect(r).toMatchObject({ maxBytes: 262144000, source: 'server' })
  })
  it('keeps the shared rules when the server answer is unusable', async () => {
    const { loadScormRules } = await load()
    expect((await loadScormRules(reply(500, {}) as unknown as typeof fetch)).source).toBe('built-in')
  })
})
