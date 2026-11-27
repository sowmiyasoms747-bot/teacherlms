/** SCORM package rules and validation.
 *
 *  SCORM_RULES mirrors the Admin Portal's shared SCORM upload rules (SCORM 1.2 / 2004, .zip, 500 MB).
 *  When an LMS API is configured (VITE_LMS_API_URL), `loadScormRules` replaces these with the
 *  server's effective values, so the form shows and enforces whatever the backend enforces.
 *  Without an API this module is the only source, and the same object drives both the text beside
 *  the drop zone and the size check, so the two cannot disagree. */
export type ScormVersion = 'SCORM 1.2' | 'SCORM 2004'
export type ScormRules = { versions: ScormVersion[]; extensions: string[]; maxBytes: number; source: 'server' | 'built-in' }

export const SCORM_RULES: ScormRules = { versions: ['SCORM 1.2', 'SCORM 2004'], extensions: ['.zip'], maxBytes: 500 * 1024 * 1024, source: 'built-in' }

export type ScormFailure = 'oversize' | 'wrong-type' | 'unreadable' | 'no-manifest' | 'nested-manifest' | 'invalid-manifest' | 'unsupported-version' | 'missing-launch'
export type ScormCheck =
  | { ok: true; title: string; version: ScormVersion; files: number; launch: string }
  | { ok: false; code: ScormFailure; reason: string }

const fail = (code: ScormFailure, reason: string): ScormCheck => ({ ok: false, code, reason })

/** Reads a .zip's central directory and its imsmanifest.xml in the browser. Nothing is uploaded. */
export async function checkScorm(file: Blob & { name?: string }, rules: ScormRules = SCORM_RULES): Promise<ScormCheck> {
  if (file.name && !rules.extensions.some(x => file.name!.toLowerCase().endsWith(x)))
    return fail('wrong-type', `${file.name} is not a ${rules.extensions.join(' or ')} file. Upload the SCORM ZIP exported from your authoring tool.`)
  if (file.size > rules.maxBytes)
    return fail('oversize', `This package is ${fileSize(file.size)}, over the ${fileSize(rules.maxBytes)} limit. Re-export it with compressed media, or split it into smaller modules.`)

  const unreadable = fail('unreadable', 'This file is not a readable .zip archive. Export the package again and retry.')
  const tail = new DataView(await file.slice(Math.max(0, file.size - 66_000)).arrayBuffer())
  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) return unreadable

  const size = tail.getUint32(eocd + 12, true), offset = tail.getUint32(eocd + 16, true)
  if (offset + size > file.size) return unreadable
  const dir = new DataView(await file.slice(offset, offset + size).arrayBuffer())
  const text = new TextDecoder()
  const names = new Set<string>()
  let nested = false, other = ''
  let manifest: { at: number; len: number; method: number } | null = null
  for (let p = 0; p + 46 <= dir.byteLength && dir.getUint32(p, true) === 0x02014b50;) {
    const nl = dir.getUint16(p + 28, true), xl = dir.getUint16(p + 30, true), cl = dir.getUint16(p + 32, true)
    if (p + 46 + nl > dir.byteLength) return unreadable
    const name = text.decode(new Uint8Array(dir.buffer, p + 46, nl))
    const lower = name.toLowerCase()
    if (!name.endsWith('/')) names.add(name)
    if (lower === 'imsmanifest.xml') manifest = { at: dir.getUint32(p + 42, true), len: dir.getUint32(p + 20, true), method: dir.getUint16(p + 10, true) }
    else if (lower.endsWith('/imsmanifest.xml')) nested = true
    else if (lower === 'tincan.xml' || lower === 'cmi5.xml') other = lower === 'cmi5.xml' ? 'cmi5' : 'xAPI (Tin Can)'
    p += 46 + nl + xl + cl
  }
  if (!names.size) return unreadable
  const supported = rules.versions.join(' or ')
  if (!manifest) {
    if (nested) return fail('nested-manifest', 'imsmanifest.xml is inside a folder. Zip the package contents, not the folder that holds them.')
    if (other) return fail('unsupported-version', `This is a ${other} package. Only ${supported} packages are supported. Export it from your authoring tool as ${supported}.`)
    return fail('no-manifest', `No imsmanifest.xml found, so this is not a SCORM package. Export it from your authoring tool as ${supported}.`)
  }

  let xml: string
  try {
    const head = new DataView(await file.slice(manifest.at, manifest.at + 30).arrayBuffer())
    if (head.getUint32(0, true) !== 0x04034b50) return unreadable
    const start = manifest.at + 30 + head.getUint16(26, true) + head.getUint16(28, true)
    const raw = file.slice(start, start + manifest.len)
    if (manifest.method === 0) xml = await raw.text()
    else if (manifest.method === 8) xml = await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()
    else return fail('invalid-manifest', 'imsmanifest.xml uses a compression method this check cannot read. Export the package again with standard ZIP compression.')
  } catch { return fail('invalid-manifest', 'imsmanifest.xml could not be read. Export the package again and retry.') }

  const r = readManifest(xml, names, rules)
  return r.ok ? { ...r, files: names.size } : r
}

/** Parses a manifest and checks its version and launch file against the files in the archive. */
export function readManifest(xml: string, names: Set<string>, rules: ScormRules = SCORM_RULES): { ok: true; title: string; version: ScormVersion; launch: string } | { ok: false; code: ScormFailure; reason: string } {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const root = doc.documentElement
  if (doc.getElementsByTagName('parsererror').length || !root || root.localName !== 'manifest')
    return { ok: false, code: 'invalid-manifest', reason: 'imsmanifest.xml is not valid XML, so the package cannot be read. Export the package again from your authoring tool.' }
  const all = (el: Element | Document, tag: string) => [...el.getElementsByTagNameNS('*', tag)]
  const attr = (el: Element, local: string) => [...el.attributes].find(a => a.localName.toLowerCase() === local.toLowerCase())?.value ?? ''

  const declared = all(doc, 'schemaversion')[0]?.textContent?.trim() ?? ''
  const spaces = [...root.attributes].map(a => a.value).join(' ')
  let version: ScormVersion | null = null
  if (/^1\.2$/.test(declared)) version = 'SCORM 1.2'
  else if (/^(CAM 1\.3|2004\b)/i.test(declared)) version = 'SCORM 2004'
  else if (!declared && /adlcp_rootv1p2/.test(spaces)) version = 'SCORM 1.2'
  else if (!declared && /adlcp_v1p3/.test(spaces)) version = 'SCORM 2004'
  const supported = rules.versions.join(' or ')
  if (!version || !rules.versions.includes(version))
    return { ok: false, code: 'unsupported-version', reason: `The manifest declares ${declared ? `“${declared}”` : 'no SCORM version'}. Only ${supported} packages are supported. Export it again as ${supported}.` }

  const orgs = all(doc, 'organizations')[0]
  const orgList = orgs ? all(orgs, 'organization') : []
  const org = orgList.find(o => attr(o, 'identifier') === attr(orgs!, 'default')) ?? orgList[0]
  const resources = all(doc, 'resource')
  const firstItem = org && all(org, 'item').find(i => attr(i, 'identifierref'))
  const res = (firstItem && resources.find(r => attr(r, 'identifier') === attr(firstItem, 'identifierref')))
    ?? resources.find(r => attr(r, 'scormtype').toLowerCase() === 'sco' && attr(r, 'href'))
  const href = res ? attr(res, 'href') : ''
  if (!res || !href) return { ok: false, code: 'missing-launch', reason: 'The manifest does not name a launch file for the module. Export the package again so it includes its launch page.' }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { ok: false, code: 'missing-launch', reason: `The launch file points outside the package (${href}). Packages must contain their own launch page.` }
  const base = [all(doc, 'resources')[0], res].map(e => e ? attr(e, 'base') : '').join('')
  const launch = normalise(base + href.split(/[?#]/)[0])
  let found = names.has(launch)
  if (!found) { try { found = names.has(decodeURIComponent(launch)) } catch { /* keep false */ } }
  if (!found) return { ok: false, code: 'missing-launch', reason: `The launch file ${launch} named in imsmanifest.xml is not in the ZIP. Check the export includes every file, then upload it again.` }

  const title = (org && [...org.children].find(c => c.localName === 'title')?.textContent?.trim()) || all(doc, 'title')[0]?.textContent?.trim() || ''
  return { ok: true, title, version, launch }
}

function normalise(path: string) {
  const out: string[] = []
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') out.pop(); else out.push(part)
  }
  return out.join('/')
}

export const fileSize = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : n < 1073741824 ? `${+(n / 1048576).toFixed(1)} MB` : `${+(n / 1073741824).toFixed(1)} GB`
