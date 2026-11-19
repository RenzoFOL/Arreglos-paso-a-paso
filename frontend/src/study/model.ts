export type Result = 'A' | 'AU' | 'N' | 'NC' | 'SC' | 'NE'
export type Task = { id: string; prepared: number; start: number | null; end: number | null; result: Result | null; note: string; adjustedStart?: number | null; adjustedEnd?: number | null }
export type Layout = { x: number; y: number; w: number; h: number; text: string }[]
export type Event = { seq: number; t: number; type: string; task: string | null; route: string; state: string; target: string; region: string; width: number; height: number; scrollY: number; x?: number; y?: number; detail: string; layout?: Layout }
export type Session = { schemaVersion: 1; appVersion: string; id: string; participant: string; startedAt: string; consent: true; events: Event[]; tasks: Task[]; ended?: boolean }
export const keyOf = (e: Event) => `${e.route} | ${e.state} | ${e.width}×${e.height} | scroll ${e.scrollY}`
export const isClick = (e: Event) => e.type === 'click' || e.type === 'first_click'
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a')
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function csv(rows: unknown[][]) {
  return '\uFEFF' + rows.map(row => row.map(value => {
    let s = value == null ? '' : String(value)
    if (/^[=+@-]/.test(s)) s = "'" + s
    return '"' + s.replaceAll('"', '""') + '"'
  }).join(',')).join('\r\n')
}
export function validateSession(value: unknown): Session {
  const s = value as Session
  if (!s || s.schemaVersion !== 1 || s.consent !== true || !/^P\d{2,4}$/.test(s.participant) || typeof s.id !== 'string' || typeof s.appVersion !== 'string' || !Number.isFinite(Date.parse(s.startedAt)) || !Array.isArray(s.events) || !Array.isArray(s.tasks) || s.events.length > 30000 || s.tasks.length > 200) throw new Error('El archivo no es una sesión compatible.')
  for (const e of s.events) {
    if (!Number.isFinite(e.t) || e.t < 0 || !Number.isInteger(e.seq) || typeof e.type !== 'string' || typeof e.route !== 'string' || typeof e.state !== 'string' || typeof e.target !== 'string' || typeof e.detail !== 'string' || !Number.isFinite(e.width) || !Number.isFinite(e.height) || e.width < 0 || e.width > 30000 || e.height < 0 || e.height > 30000 || !Number.isFinite(e.scrollY)) throw new Error('Un evento contiene datos inválidos.')
    if (e.layout && (!Array.isArray(e.layout) || e.layout.length > 150 || e.layout.some(r => ![r.x,r.y,r.w,r.h].every(Number.isFinite) || typeof r.text !== 'string'))) throw new Error('El esquema de pantalla es inválido.')
    if ((e.x != null && !Number.isFinite(e.x)) || (e.y != null && !Number.isFinite(e.y))) throw new Error('Coordenadas inválidas.')
  }
  for (const t of s.tasks) if (typeof t.id !== 'string' || typeof t.note !== 'string' || !Number.isFinite(t.prepared) || ![null,'A','AU','N','NC','SC','NE'].includes(t.result) || [t.start,t.end,t.adjustedStart,t.adjustedEnd].some(v => v != null && (!Number.isFinite(v) || v < 0))) throw new Error('Una tarea contiene datos inválidos.')
  return s
}
