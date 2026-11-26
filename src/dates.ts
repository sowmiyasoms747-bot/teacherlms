/** The sample data is built around one school morning, so the app's clock is pinned here.
 *  When a real backend is connected, return `new Date()` instead. */
export const now = () => new Date(2026, 10, 26, 10, 40)

export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const today = () => iso(now())
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const fmt = (s: string) => parse(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
export const fmtLong = (s: string) => parse(s).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
export const isWeekend = (s: string) => [0, 6].includes(parse(s).getDay())
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d) }
export const stepSchoolDay = (s: string, dir: 1 | -1) => {
  let d = addDays(s, dir)
  while (isWeekend(d)) d = addDays(d, dir)
  return d
}
export const lastSchoolDays = (n: number, end = today()) => {
  const out: string[] = []
  let d = isWeekend(end) ? stepSchoolDay(end, -1) : end
  while (out.length < n) { out.unshift(d); d = stepSchoolDay(d, -1) }
  return out
}
export const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
export const clock = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }
export const nowStamp = () => { const d = now(); return `Today, ${clock(`${d.getHours()}:${d.getMinutes()}`)}` }
export const dueLabel = (s: string) => {
  const days = Math.round((parse(s).getTime() - parse(today()).getTime()) / 864e5)
  return days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : days > 0 ? `Due ${fmt(s)}` : `Closed ${fmt(s)}`
}
