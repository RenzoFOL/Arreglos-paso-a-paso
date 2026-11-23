export type Result = 'A' | 'AU' | 'AS' | 'N' | 'NC' | 'SC' | 'NE'
export type Task = { id: string; prepared: number; start: number | null; end: number | null; result: Result | null; note: string; kind?: string; outcome?: 'finished' | 'abandoned' | 'interrupted' | 'timeout'; assistance?: string[]; response?: string; proposedResult?: Result | null; measurementEnd?: number; firstInteraction?: number; adjustedStart?: number | null; adjustedEnd?: number | null }
export type Layout = { x: number; y: number; w: number; h: number; text: string }[]
export type Event = { seq: number; t: number; type: string; task: string | null; route: string; state: string; target: string; region: string; width: number; height: number; scrollY: number; x?: number; y?: number; detail: string; layout?: Layout; context?: string }
export type Session = { schemaVersion: 1; appVersion: string; id: string; participant: string; startedAt: string; consent: true; events: Event[]; tasks: Task[]; ended?: boolean; captureTruncated?: boolean; environment?: { userAgent:string; language:string; timezone:string }; protocol?: string; guided?: GuidedState }
export type GuidedState = { index: number; phase: 'countdown' | 'instructions' | 'running' | 'paused' | 'response' | 'sus' | 'likert' | 'comments' | 'done'; deadline?: number; sus: (number | null)[]; likert: (number | 'NU' | null)[]; comments: string[]; semester: string; questionCompleted?: { sus?: boolean; likert?: boolean; comments?: boolean } }
export const keyOf = (e: Event) => `${e.task || "sin tarea"} | ${e.context || "legacy"} | ${e.route} | ${e.state} | ${e.width}×${e.height} | scroll ${e.scrollY}`
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
  for (const t of s.tasks) if (typeof t.id !== 'string' || typeof t.note !== 'string' || !Number.isFinite(t.prepared) || ![null,'A','AU','AS','N','NC','SC','NE'].includes(t.result) || [t.start,t.end,t.adjustedStart,t.adjustedEnd,t.measurementEnd,t.firstInteraction].some(v => v != null && (!Number.isFinite(v) || v < 0))) throw new Error('Una tarea contiene datos inválidos.')
  if (s.guided) {
    const g = s.guided
    if (g.index === 20 && ['instructions','running','paused','response'].includes(g.phase) || g.deadline != null && !Number.isFinite(g.deadline)) throw new Error('Progreso de evaluación inválido.')
    if (!Number.isInteger(g.index) || g.index < 0 || g.index > 20 || !['countdown','instructions','running','paused','response','sus','likert','comments','done'].includes(g.phase) || !Array.isArray(g.sus) || g.sus.length !== 10 || !g.sus.every(v => v === null || Number.isInteger(v) && v! >= 1 && v! <= 5) || !Array.isArray(g.likert) || g.likert.length !== 10 || !g.likert.every(v => v === null || v === 'NU' || Number.isInteger(v) && v! >= 1 && v! <= 5) || !Array.isArray(g.comments) || g.comments.length !== 3 || !g.comments.every(v => typeof v === 'string' && v.length <= 3000)) throw new Error('Cuestionarios o progreso inválidos.')
  }
  return s
}
