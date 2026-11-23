import { keyOf, type Session, type Event, type Result, type GuidedState, type Task, validateSession } from './model'
const STORAGE = 'arreglos-study-v1'
let session: Session | null = null, active = false, paused = false, activeTask: string | null = null
let revision = 0, timer: ReturnType<typeof setTimeout> | undefined
let backupWarning = '', countLimit = false
const listeners = new Set<() => void>(), layouts = new Set<string>()
const notify = () => { revision++; listeners.forEach(fn => fn()) }
export const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export const version = () => revision
export const state = () => ({ session, active, paused, activeTask, backupWarning, countLimit })
const now = () => session ? Math.max(0, performance.timeOrigin + performance.now() - Date.parse(session.startedAt)) : 0
function persist() {
  if (!session) return
  try { sessionStorage.setItem(STORAGE, JSON.stringify(session)); backupWarning = '' } catch { backupWarning = 'No se pudo guardar la copia temporal. Descarga los resultados antes de salir.'; notify() }
}
function changed() { notify(); if (!timer) timer = setTimeout(() => { timer = undefined; persist() }, 800) }
function screen() {
  const nodes = [...document.querySelectorAll<HTMLElement>('[data-study-state]')].filter(el => !el.closest('[hidden]'))
  return { route: document.querySelector<HTMLElement>('[data-study-screen]')?.dataset.studyScreen || 'Inicio', state: nodes.map(n => n.dataset.studyState).join(';').slice(0,500), width: innerWidth, height: innerHeight, scrollY: Math.round(scrollY), context: JSON.stringify({dpr:devicePixelRatio, scale:window.visualViewport?.scale || 1, motion:document.documentElement.dataset.motion, contrast:document.documentElement.dataset.contrast, text:document.documentElement.style.getPropertyValue('--text-scale'), spacing:document.documentElement.style.getPropertyValue('--code-line-height'), panels:[...document.querySelectorAll<HTMLElement>('.cm-scroller,.variables-content,.operation-content')].filter(n=>!n.closest('[hidden]')).map(n=>[n.className,Math.round(n.scrollTop),Math.round(n.scrollLeft)])}) }
}
function layout() {
  return [...document.querySelectorAll<HTMLElement>('button,a,input,summary,[role="radio"]')].filter(el => !el.closest('[hidden],[data-study-ui]') && el.getClientRects().length).map(el => {
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height, text: (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0,65) }
  }).filter(r => r.y < innerHeight && r.y + r.h > 0).slice(0,150)
}
export function record(type: string, partial: Partial<Event> = {}, force = false) {
  if (!session || !active || (paused && !force)) return
  if (session.events.length >= 30000) { if(!countLimit) { countLimit=true;session.captureTruncated=true;changed();persist() }; return }
  const e: Event = { seq: session.events.length, t: now(), type, task: activeTask, ...screen(), target: '', region: '', detail: '', ...partial }
  const key = keyOf(e)
  if (!layouts.has(key)) { e.layout = layout(); layouts.add(key) }
  session.events.push(e); changed()
}
export function begin(participant: string) {
  if (!/^P\d{2,4}$/.test(participant)) throw new Error('Usa un identificador como P01.')
  session = { schemaVersion: 1, appVersion: '0.2.0-study', id: crypto.randomUUID(), participant, startedAt: new Date().toISOString(), consent: true, tasks: [], events: [] }
  active = true; paused = false; activeTask = null; countLimit = false; layouts.clear(); record('session_start'); persist()
}
export function restore() {
  const raw = sessionStorage.getItem(STORAGE)
  if (!raw) return
  session = validateSession(JSON.parse(raw)); countLimit=!!session.captureTruncated; active = false; paused = false; activeTask = null; changed()
}
export function resume() {
  if (!session || session.ended) return
  active = true; paused = false; activeTask = session.tasks.find(t => t.end === null)?.id || null; record('session_resumed', { detail: 'Recuperación tras recarga. Revisar intervalo sin registro.' })
}
export function prepare(id: string) {
  if (!session || !active || paused || activeTask) throw new Error('Inicia la sesión y termina la tarea anterior antes de preparar otra.')
  if (!id.trim() || id.length > 80 || session.tasks.some(t => t.id === id)) throw new Error('Usa un código de tarea único, de hasta 80 caracteres.')
  if (session.tasks.length >= 200) throw new Error('Límite de 200 tareas por sesión.')
  activeTask = id.trim(); session.tasks.push({ id: activeTask, prepared: now(), start: null, end: null, result: null, note: '' }); record('task_prepared'); persist()
}
export function startTask() {
  const task = session?.tasks.find(t => t.id === activeTask)
  if (active && !paused && task && task.start === null) { task.start = now(); record('task_start'); persist() }
}
export function finish(result: Result | null, note: string) {
  const task = session?.tasks.find(t => t.id === activeTask)
  if (!task) throw new Error('No hay tarea activa.')
  task.end = now(); task.result = result; task.note = note
  record('task_end', { detail: result || 'pendiente de revisión' }, true); activeTask = null; changed(); persist()
}
export function pause() { if (!active) return; if (paused) { paused = false; record('resume') } else { record('pause'); paused = true }; changed(); persist() }
export function end() {
  if (activeTask) throw new Error('Clasifica y termina la tarea activa antes de cerrar la sesión.')
  record('session_end', {}, true); active = false; if (session) session.ended = true; changed(); persist()
}
export function discard() { clearTimeout(timer); timer = undefined; session = null; active = false; activeTask = null; paused = false; sessionStorage.removeItem(STORAGE); changed() }
export function updateGuided(change: Partial<GuidedState>) {
  if (!session?.guided) return
  Object.assign(session.guided, change); changed(); persist()
}
export function beginGuided(participant: string, semester: string) {
  begin(participant)
  session!.protocol = 'S4-v1.1-digital'
  session!.guided = { index:0, phase:'countdown', deadline:Date.now()+10000, sus:Array(10).fill(null), likert:Array(10).fill(null), comments:['','',''], semester }
  changed(); persist()
}
export function annotate(id: string, change: Partial<Task>) {
  const task = session?.tasks.find(t=>t.id===id)
  if (task) { Object.assign(task,change); changed(); persist() }
}
function captureAllowed() { return !session?.guided || session.guided.phase === 'running' && !!activeTask && !session.tasks.find(t=>t.id===activeTask)?.measurementEnd }
function interaction() {
  startTask()
  const task = session?.tasks.find(t=>t.id===activeTask)
  if (task && task.firstInteraction == null) { task.firstInteraction=now(); record('first_interaction') }
}
export function install() {
  let lastMove = 0, lastScroll = 0
  const outsidePanel = (e: globalThis.Event) => !(e.target as HTMLElement | null)?.closest?.('[data-study-ui]')
  const click = (e: MouseEvent) => {
    if (!outsidePanel(e) || !active || paused || !captureAllowed()) return
    interaction()
    const el = e.target as HTMLElement, control = el.closest<HTMLElement>('button,a,input,summary,[role="radio"],[contenteditable]')
    const first = activeTask && !session?.events.some(v => v.task === activeTask && (v.type === 'first_click' || v.type === 'click'))
    record(first ? 'first_click' : 'click', { x: e.clientX, y: e.clientY, target: control?.matches('[contenteditable]') ? 'editor-codigo' : (control?.dataset.studyId || control?.getAttribute('aria-label') || control?.textContent || el.tagName).trim().slice(0,200), region: el.closest<HTMLElement>('[data-region]')?.dataset.region || '', detail: e.detail === 0 ? 'activación por teclado; excluir de mapas de puntero' : 'puntero' })
    const task=session?.tasks.find(t=>t.id===activeTask)
    if (session?.guided && first && task?.kind === 'FC') { task.measurementEnd=now(); changed(); persist() }
  }
  const move = (e: PointerEvent) => { if (!outsidePanel(e) || !activeTask || !active || paused || !captureAllowed()) return; interaction(); if (performance.now() - lastMove < 150) return; lastMove = performance.now(); record('pointer', { x:e.clientX,y:e.clientY }) }
  const key = (e: KeyboardEvent) => { if (!outsidePanel(e) || e.repeat || !active || paused || !captureAllowed()) return; interaction(); if (['Tab','Enter','Escape','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) record('key', { detail:e.key }) }
  const scroll = (e: globalThis.Event) => { if (!outsidePanel(e) || !captureAllowed()) return; if (performance.now()-lastScroll < 250) return; lastScroll = performance.now(); record('scroll', { detail: (e.target as HTMLElement)?.className?.toString().slice(0,100) || 'document' }) }
  const visibility = () => { record('visibility', { detail: document.visibilityState }, true); if (document.hidden && session?.guided?.phase === 'running' && active && !paused) { pause(); updateGuided({phase:'paused'}); window.dispatchEvent(new CustomEvent('study-freeze')) } }
  const semantic = (e: globalThis.Event) => { const d=(e as CustomEvent).detail; if (session?.guided && !['running','paused'].includes(session.guided.phase)) return; record(d.type,{detail:d.detail},paused&&/^execution_/.test(d.type)) }
  const unload = (e: BeforeUnloadEvent) => { persist(); if (active) { e.preventDefault(); e.returnValue='' } }
  document.addEventListener('click',click,true); document.addEventListener('pointermove',move); document.addEventListener('keydown',key,true)
  document.addEventListener('scroll',scroll,{passive:true,capture:true}); document.addEventListener('visibilitychange',visibility); window.addEventListener('study-event',semantic); window.addEventListener('beforeunload',unload)
  return () => { document.removeEventListener('click',click,true); document.removeEventListener('pointermove',move); document.removeEventListener('keydown',key,true); document.removeEventListener('scroll',scroll,true); document.removeEventListener('visibilitychange',visibility); window.removeEventListener('study-event',semantic); window.removeEventListener('beforeunload',unload) }
}
