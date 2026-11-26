/** Reads a .zip's directory in the browser and checks it is a SCORM package:
 *  imsmanifest.xml must sit at the root of the archive. Nothing is uploaded. */
export type ScormCheck = { ok: true; title: string; version: string; files: number } | { ok: false; reason: string }

export async function checkScorm(file: Blob): Promise<ScormCheck> {
  const bad: ScormCheck = { ok: false, reason: 'This file is not a readable .zip archive. Export the package again and retry.' }
  const tail = new DataView(await file.slice(Math.max(0, file.size - 66_000)).arrayBuffer())
  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) return bad

  const size = tail.getUint32(eocd + 12, true), offset = tail.getUint32(eocd + 16, true)
  const dir = new DataView(await file.slice(offset, offset + size).arrayBuffer())
  const text = new TextDecoder()
  let files = 0, nested = false
  let manifest: { at: number; len: number; method: number } | null = null
  for (let p = 0; p + 46 <= dir.byteLength && dir.getUint32(p, true) === 0x02014b50;) {
    const nl = dir.getUint16(p + 28, true), xl = dir.getUint16(p + 30, true), cl = dir.getUint16(p + 32, true)
    if (p + 46 + nl > dir.byteLength) return bad
    const name = text.decode(new Uint8Array(dir.buffer, p + 46, nl)).toLowerCase()
    if (!name.endsWith('/')) files++
    if (name === 'imsmanifest.xml') manifest = { at: dir.getUint32(p + 42, true), len: dir.getUint32(p + 20, true), method: dir.getUint16(p + 10, true) }
    else if (name.endsWith('/imsmanifest.xml')) nested = true
    p += 46 + nl + xl + cl
  }
  if (!manifest) return { ok: false, reason: nested ? 'imsmanifest.xml is inside a folder. Zip the package contents, not the folder that holds them.' : 'No imsmanifest.xml found, so this is not a SCORM package. Export it from your authoring tool as SCORM 1.2 or 2004.' }

  let title = '', version = 'SCORM'
  try {
    const head = new DataView(await file.slice(manifest.at, manifest.at + 30).arrayBuffer())
    const start = manifest.at + 30 + head.getUint16(26, true) + head.getUint16(28, true)
    const raw = file.slice(start, start + manifest.len)
    const xml = manifest.method === 0 ? await raw.text() : await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()
    const doc = new DOMParser().parseFromString(xml, 'text/xml')
    title = doc.getElementsByTagName('title')[0]?.textContent?.trim() ?? ''
    const v = doc.getElementsByTagName('schemaversion')[0]?.textContent?.trim() ?? ''
    if (v) version = /1\.2/.test(v) ? 'SCORM 1.2' : 'SCORM 2004'
  } catch { /* manifest present but unreadable: still a package */ }
  return { ok: true, title, version, files }
}

export const fileSize = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`
