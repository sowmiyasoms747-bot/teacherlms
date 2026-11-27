import { beforeAll, describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { SCORM_RULES, checkScorm, fileSize } from './scorm'
import { makeZip, manifest12, manifest2004 } from './test/zip'

beforeAll(() => { globalThis.DOMParser = new JSDOM().window.DOMParser })
const zip = async (entries: Record<string, string>, name = 'pkg.zip', deflate = false) => new File([await makeZip(entries, deflate)], name)

describe('SCORM upload rules (TCH-02)', () => {
  it('matches the Admin rules: SCORM 1.2 / 2004, .zip, 500 MB', () => {
    expect(SCORM_RULES.versions).toEqual(['SCORM 1.2', 'SCORM 2004'])
    expect(SCORM_RULES.extensions).toEqual(['.zip'])
    expect(SCORM_RULES.maxBytes).toBe(500 * 1024 * 1024)
    expect(fileSize(SCORM_RULES.maxBytes)).toBe('500 MB')
  })
})

describe('checkScorm (TCH-02)', () => {
  it('accepts a SCORM 1.2 package and reports version and launch file', async () => {
    const r = await checkScorm(await zip({ 'imsmanifest.xml': manifest12(), 'index.html': '<html/>' }))
    expect(r).toEqual({ ok: true, title: 'Electric Charges 1.2', version: 'SCORM 1.2', launch: 'index.html', files: 2 })
  })

  it('accepts a deflated SCORM 2004 package with a launch file in a subfolder', async () => {
    const r = await checkScorm(await zip({ 'imsmanifest.xml': manifest2004(), 'content/launch.html': '<html/>' }, 'pkg.zip', true))
    expect(r).toMatchObject({ ok: true, version: 'SCORM 2004', launch: 'content/launch.html' })
  })

  it('reads 2004 "CAM 1.3" as SCORM 2004', async () => {
    const r = await checkScorm(await zip({ 'imsmanifest.xml': manifest2004('a.html', 'CAM 1.3'), 'a.html': '' }))
    expect(r).toMatchObject({ ok: true, version: 'SCORM 2004' })
  })

  const failure = async (entries: Record<string, string>, name?: string) => { const r = await checkScorm(await zip(entries, name)); if (r.ok) throw new Error('expected failure'); return r }

  it('rejects oversize files before reading them', async () => {
    const r = await checkScorm(await zip({ 'imsmanifest.xml': manifest12(), 'index.html': 'x'.repeat(2000) }), { ...SCORM_RULES, maxBytes: 1024 })
    expect(r).toMatchObject({ ok: false, code: 'oversize' })
    if (!r.ok) expect(r.reason).toContain('1 KB limit')
  })
  it('rejects non-zip files', async () => expect((await failure({ 'a': '' }, 'module.rar')).code).toBe('wrong-type'))
  it('rejects unreadable archives', async () => expect((await checkScorm(new File(['not a zip at all'], 'pkg.zip'))).ok ? 'ok' : 'unreadable').toBe('unreadable'))
  it('rejects a package with no manifest', async () => expect((await failure({ 'index.html': '' })).code).toBe('no-manifest'))
  it('explains a manifest zipped inside a folder', async () => expect((await failure({ 'Module/imsmanifest.xml': manifest12(), 'Module/index.html': '' })).code).toBe('nested-manifest'))
  it('rejects malformed manifest XML', async () => expect((await failure({ 'imsmanifest.xml': '<manifest><broken', 'index.html': '' })).code).toBe('invalid-manifest'))
  it('rejects unsupported SCORM versions', async () => {
    const r = await failure({ 'imsmanifest.xml': manifest2004('a.html', '1.1'), 'a.html': '' })
    expect(r.code).toBe('unsupported-version')
    expect(r.reason).toContain('SCORM 1.2 or SCORM 2004')
  })
  it('names xAPI packages as unsupported', async () => expect((await failure({ 'tincan.xml': '<tincan/>', 'index.html': '' })).code).toBe('unsupported-version'))
  it('rejects a manifest whose launch file is missing from the ZIP', async () => {
    const r = await failure({ 'imsmanifest.xml': manifest12('story.html') })
    expect(r.code).toBe('missing-launch')
    expect(r.reason).toContain('story.html')
  })
  it('rejects a launch file outside the package', async () => expect((await failure({ 'imsmanifest.xml': manifest12('https://example.com/x.html'), 'index.html': '' })).code).toBe('missing-launch'))
})
