/** Builds real .zip archives for tests (stored or deflated entries, standard central directory). */
export async function makeZip(entries: Record<string, string>, deflate = false): Promise<Blob> {
  const enc = new TextEncoder()
  const local: Uint8Array[] = [], central: Uint8Array[] = []
  let offset = 0
  for (const [name, body] of Object.entries(entries)) {
    const raw = enc.encode(body), n = enc.encode(name)
    const data = deflate ? new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()) : raw
    const crc = crc32(raw), method = deflate ? 8 : 0
    const lh = new DataView(new ArrayBuffer(30))
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(8, method, true)
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, raw.length, true); lh.setUint16(26, n.length, true)
    local.push(new Uint8Array(lh.buffer), n, data)
    const ch = new DataView(new ArrayBuffer(46))
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(10, method, true)
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, raw.length, true); ch.setUint16(28, n.length, true); ch.setUint32(42, offset, true)
    central.push(new Uint8Array(ch.buffer), n)
    offset += 30 + n.length + data.length
  }
  const size = central.reduce((a, b) => a + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, Object.keys(entries).length, true); end.setUint16(10, Object.keys(entries).length, true)
  end.setUint32(12, size, true); end.setUint32(16, offset, true)
  return new Blob([...local, ...central, new Uint8Array(end.buffer)] as BlobPart[])
}

function crc32(b: Uint8Array) {
  let c = ~0
  for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)) }
  return ~c >>> 0
}

export const manifest12 = (href = 'index.html') => `<?xml version="1.0"?>
<manifest identifier="m" version="1" xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schema>ADL SCORM</schema><schemaversion>1.2</schemaversion></metadata>
  <organizations default="org"><organization identifier="org"><title>Electric Charges 1.2</title><item identifier="i1" identifierref="r1"><title>Lesson</title></item></organization></organizations>
  <resources><resource identifier="r1" type="webcontent" adlcp:scormtype="sco" href="${href}"><file href="index.html"/></resource></resources>
</manifest>`

export const manifest2004 = (href = 'content/launch.html', version = '2004 4th Edition') => `<?xml version="1.0"?>
<manifest identifier="m" version="1" xmlns="http://www.imsglobal.org/xsd/imscp_v1p1" xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3">
  <metadata><schema>ADL SCORM</schema><schemaversion>${version}</schemaversion></metadata>
  <organizations default="org"><organization identifier="org"><title>Electric Charges 2004</title><item identifier="i1" identifierref="r1"><title>Lesson</title></item></organization></organizations>
  <resources><resource identifier="r1" type="webcontent" adlcp:scormType="sco" href="${href}"/></resources>
</manifest>`
