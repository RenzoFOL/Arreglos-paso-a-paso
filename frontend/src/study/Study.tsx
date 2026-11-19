import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as recorder from './recorder'
import { csv, download, isClick, keyOf, validateSession, type Session, type Task, type Result, type Event } from './model'
import { taskMetrics, resultSummary } from './metrics.mjs'
import { exportWorkbook } from '../api'
const resultNames: Record<Result, string> = { A:'Primer clic aceptado', AU:'Objetivo sin ayuda', N:'Primer clic no favorable', NC:'Objetivo no cumplido', SC:'Sin clic', NE:'No evaluable' }
const secs = (v:number|null|undefined) => v == null ? '—' : (v/1000).toFixed(2)
function saveJson(s:Session) { download(new Blob([JSON.stringify(s,null,2)],{type:'application/json'}),`${s.participant}-${s.id}.json`) }
function saveCsv(s:Session) {
  const rows:unknown[][] = [['participante','tarea','resultado','inicio_ms','fin_ms','inicio_ajustado_ms','fin_ajustado_ms','duracion_ms','tiempo_sin_pausas_ms','clics','primer_destino','nota']]
  s.tasks.forEach(t => { const m=taskMetrics(t,s.events); rows.push([s.participant,t.id,t.result,t.start,t.end,t.adjustedStart,t.adjustedEnd,m.elapsedMs,m.activeMs,m.clicks,m.firstTarget,t.note]) })
  download(new Blob([csv(rows)],{type:'text/csv;charset=utf-8'}),`${s.participant}-tareas.csv`)
}
function MapCanvas({ events, firstOnly }: {events:Event[]; firstOnly:boolean}) {
  const ref=useRef<HTMLCanvasElement>(null)
  const points=events.filter(e => isClick(e) && e.detail !== 'activación por teclado; excluir de mapas de puntero' && (!firstOnly || e.type === 'first_click') && e.x != null && e.y != null)
  useEffect(() => {
    const canvas=ref.current!, ctx=canvas.getContext('2d')!, base=events[0]
    canvas.width=base?.width || 1200; canvas.height=base?.height || 700
    ctx.fillStyle='#f8fafc';ctx.fillRect(0,0,canvas.width,canvas.height)
    const layout=events.find(e => e.layout)?.layout || []
    ctx.font='12px Arial';ctx.textBaseline='middle'
    layout.forEach(r => { ctx.fillStyle='#fff';ctx.fillRect(r.x,r.y,r.w,r.h);ctx.strokeStyle='#cbd5e1';ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.save();ctx.beginPath();ctx.rect(r.x,r.y,r.w,r.h);ctx.clip();ctx.fillStyle='#475569';ctx.fillText(r.text,r.x+5,r.y+r.h/2);ctx.restore() })
    for(const p of points) { const g=ctx.createRadialGradient(p.x!,p.y!,0,p.x!,p.y!,28);g.addColorStop(0,'rgba(220,38,38,0.7)');g.addColorStop(0.5,'rgba(249,115,22,0.3)');g.addColorStop(1,'rgba(249,115,22,0)');ctx.fillStyle=g;ctx.fillRect(p.x!-28,p.y!-28,56,56) }
  },[events,firstOnly])
  return <><p>{points.length} clics de puntero. Fondo: esquema de controles, no fotografía de la pantalla. Mayor intensidad indica superposición de clics.</p><canvas ref={ref} className="heatmap" aria-label="Mapa de concentración de clics sobre esquema de controles" /><button className="button secondary" onClick={() => ref.current?.toBlob(blob => blob && download(blob,'mapa-clics.png'))}>Descargar mapa PNG</button></>
}
function Analysis({ current }: { current:Session|null }) {
  const [sessions,setSessions]=useState<Session[]>([]),[selected,setSelected]=useState('all'),[taskFilter,setTaskFilter]=useState('all'),[mapKey,setMapKey]=useState(''),[firstOnly,setFirstOnly]=useState(false),[error,setError]=useState('')
  const filtered=sessions.filter(s => selected==='all'||s.id===selected)
  const groups=useMemo(() => {
    const map=new Map<string,Event[]>()
    filtered.forEach(s => s.events.forEach(e => { if(taskFilter!=='all'&&e.task!==taskFilter) return; const key=`${s.appVersion} | ${keyOf(e)}`; const values=map.get(key)||[];values.push(e);map.set(key,values) }))
    return map
  },[sessions,selected,taskFilter])
  const effectiveKey=groups.has(mapKey)?mapKey:(groups.keys().next().value || '')
  const rows=filtered.flatMap(s => s.tasks.filter(t => taskFilter==='all'||t.id===taskFilter).map(t => ({s,t,m:taskMetrics(t,s.events)})))
  const taskIds=[...new Set(sessions.flatMap(s => s.tasks.map(t => t.id)))]
  const correctTime=(sessionId:string,taskId:string,field:'adjustedStart'|'adjustedEnd',value:string) => {
    const n=value===''?null:Number(value)*1000
    if(n!==null&&(!Number.isFinite(n)||n<0)) return
    setSessions(ss=>ss.map(s=>s.id===sessionId?{...s,tasks:s.tasks.map(t=>t.id===taskId?{...t,[field]:n}:t)}:s))
  }
  return <div className="analysis"><h2>Análisis de sesiones</h2><p>Importa archivos JSON. Se procesan en este navegador. Las correcciones se guardan en la exportación nueva; los eventos originales se conservan.</p>
    <div className="study-actions"><label className="button secondary">Importar sesiones<input type="file" accept=".json,application/json" multiple onChange={async e => { try { const imported:Session[]=[];for(const file of Array.from(e.target.files||[])) { if(file.size>8_000_000) throw new Error('Cada sesión debe pesar menos de 8 MB.'); imported.push(validateSession(JSON.parse(await file.text()))) };setSessions(old=>[...old.filter(s=>!imported.some(i=>i.id===s.id)),...imported]);setError('') } catch(err) { setError((err as Error).message) } }} /></label>{current&&<button className="button secondary" onClick={()=>setSessions(old=>[...old.filter(s=>s.id!==current.id),structuredClone(current)])}>Cargar sesión actual</button>}</div>
    {error&&<p role="alert" className="feedback error">{error}</p>}
    <div className="study-filters"><label>Participante<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="all">Todos</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.participant} · {s.startedAt}</option>)}</select></label><label>Tarea<select value={taskFilter} onChange={e=>setTaskFilter(e.target.value)}><option value="all">Todas</option>{taskIds.map(id=><option key={id}>{id}</option>)}</select></label></div>
    <div className="table-scroll"><table><caption>Resultados por tarea. SC y NE se excluyen conforme al protocolo; documenta el motivo.</caption><thead><tr><th>Tarea</th><th>Favorables / evaluables</th><th>Excluidas</th><th>Pendientes</th></tr></thead><tbody>{taskIds.filter(id=>taskFilter==='all'||id===taskFilter).map(id=>{const summary=resultSummary(rows.filter(r=>r.t.id===id).map(r=>r.t));return <tr key={id}><td>{id}</td><td>{summary.favorable} / {summary.evaluable}</td><td>{summary.excluded}</td><td>{summary.pending}</td></tr>})}</tbody></table></div>
    <div className="table-scroll"><table><thead><tr><th>Participante / tarea</th><th>Resultado</th><th>Tiempo total / sin pausas (s)</th><th>Clics / primer destino</th><th>Inicio / fin ajustados (s desde inicio de sesión)</th><th>Observación</th></tr></thead><tbody>{rows.map(({s,t,m})=><tr key={s.id+t.id}><td>{s.participant} / {t.id}</td><td>{t.result||'Pendiente'}</td><td>{secs(m.elapsedMs)} / {secs(m.activeMs)}</td><td>{m.clicks} / {m.firstTarget||'—'}</td><td><input aria-label={`Inicio ajustado ${s.participant} ${t.id}`} type="number" min="0" step="0.01" placeholder={secs(t.start)} value={t.adjustedStart==null?'':t.adjustedStart/1000} onChange={e=>correctTime(s.id,t.id,'adjustedStart',e.target.value)} /><input aria-label={`Fin ajustado ${s.participant} ${t.id}`} type="number" min="0" step="0.01" placeholder={secs(t.end)} value={t.adjustedEnd==null?'':t.adjustedEnd/1000} onChange={e=>correctTime(s.id,t.id,'adjustedEnd',e.target.value)} />{(t.adjustedEnd??t.end??0)<(t.adjustedStart??t.start??0)&&<span role="alert">El fin debe ser posterior al inicio.</span>}</td><td><textarea aria-label={`Observación ${s.participant} ${t.id}`} maxLength={3000} value={t.note} onChange={e=>setSessions(ss=>ss.map(item=>item.id===s.id?{...item,tasks:item.tasks.map(task=>task.id===t.id?{...task,note:e.target.value}:task)}:item))} /></td></tr>)}</tbody></table></div>
    {filtered.map(s=><div key={s.id} className="study-actions"><strong>{s.participant}</strong><button onClick={()=>saveJson(s)}>JSON con anotaciones</button><button onClick={()=>saveCsv(s)}>CSV de tareas</button><button onClick={async()=>{try{download(await exportWorkbook(s),`${s.participant}-sesion.xlsx`)}catch(e){setError((e as Error).message)}}}>Excel</button></div>)}
    <h3>Mapas de clics</h3><label>Versión, pantalla, estado y ventana<select value={effectiveKey} onChange={e=>setMapKey(e.target.value)}>{[...groups.keys()].map(k=><option key={k}>{k}</option>)}</select></label><label className="check-label"><input type="checkbox" checked={firstOnly} onChange={e=>setFirstOnly(e.target.checked)} /> Solo primer clic</label>
    {groups.size>0?<MapCanvas events={groups.get(effectiveKey)||[]} firstOnly={firstOnly}/>:<p>Importa una sesión para generar mapas.</p>}
    <details><summary>Línea temporal y recorridos</summary><p>Los movimientos del puntero y la inactividad no determinan atención, confusión ni fracaso.</p><div className="table-scroll timeline"><table><thead><tr><th>Participante</th><th>Tiempo (s)</th><th>Tarea</th><th>Evento</th><th>Pantalla / destino / detalle</th></tr></thead><tbody>{filtered.flatMap(s=>s.events.filter(e=>e.type!=='pointer'&&(taskFilter==='all'||e.task===taskFilter)).map(e=><tr key={s.id+e.seq}><td>{s.participant}</td><td>{secs(e.t)}</td><td>{e.task}</td><td>{e.type}</td><td>{e.route} · {e.target} · {e.detail}{e.type==='scroll'?` · ${e.scrollY}px`:''}</td></tr>))}</tbody></table></div></details>
  </div>
}
export default function Study() {
  useSyncExternalStore(recorder.subscribe,recorder.version)
  const {session,active,paused,activeTask,backupWarning,countLimit}=recorder.state()
  const [open,setOpen]=useState(false),[tab,setTab]=useState('capture'),[participant,setParticipant]=useState('P01'),[consent,setConsent]=useState(false),[task,setTask]=useState('FC01'),[result,setResult]=useState<Result>('AU'),[note,setNote]=useState(''),[error,setError]=useState('')
  const act=(fn:()=>void)=>{try{fn();setError('')}catch(e){setError((e as Error).message)}}
  useEffect(()=>{try{recorder.restore()}catch(e){setError((e as Error).message)}return recorder.install()},[])
  return <aside data-study-ui className="study-root"><button className="study-launcher" onClick={()=>setOpen(v=>!v)}>{active?(paused?'Evaluación pausada':`Registrando ${session?.participant}${activeTask?' · '+activeTask:''}`):'Evaluación'} {open?'−':'+'}</button>
    {open&&<section className="study-panel" aria-label="Herramientas del observador"><div className="study-heading"><h2>Modo de evaluación</h2><button onClick={()=>setOpen(false)} aria-label="Cerrar herramientas">Cerrar</button></div><div className="tabs"><button className={tab==='capture'?'active':''} onClick={()=>setTab('capture')}>Registrar</button><button className={tab==='analysis'?'active':''} onClick={()=>setTab('analysis')}>Analizar archivos</button></div>
      {(error||backupWarning||countLimit)&&<p className="feedback error" role="alert">{error||backupWarning||(countLimit?'Se alcanzó el límite de eventos; descarga la sesión.':'')}</p>}
      {tab==='analysis'?<Analysis current={session}/>:<>
        {!session?<><p>Registra clics, movimientos muestreados, navegación y tiempos. No graba video, audio ni texto escrito en el editor. Copia temporal en esta pestaña; descarga antes de cerrarla.</p><label>Participante<input value={participant} maxLength={5} onChange={e=>setParticipant(e.target.value.toUpperCase())}/></label><label className="check-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> El participante recibió la información y otorgó su consentimiento para esta prueba.</label><button className="button primary" disabled={!consent} onClick={()=>act(()=>recorder.begin(participant))}>Iniciar sesión</button></>:<>
          <p><strong>{session.participant}</strong> · {session.events.length} eventos · {session.tasks.length} tareas</p>
          {!active&&!session.ended&&<><p>Sesión recuperada. El intervalo sin registro debe revisarse; las tareas incompletas conservan sus datos.</p><button onClick={()=>act(recorder.resume)}>Reanudar registro</button></>}
          {active&&<><button className="button secondary" onClick={recorder.pause}>{paused?'Reanudar':'Pausar registro'}</button><div className="study-task"><label>Código de tarea<input disabled={!!activeTask} value={task} maxLength={80} onChange={e=>setTask(e.target.value)}/></label><button className="button primary" disabled={!!activeTask||paused} onClick={()=>act(()=>{recorder.prepare(task);setOpen(false)})}>Preparar tarea y cerrar panel</button><p>El tiempo comienza con el primer movimiento o interacción fuera de estas herramientas.</p></div>
          {activeTask&&<><p>Tarea activa: <strong>{activeTask}</strong></p><label>Resultado del observador<select value={result} onChange={e=>setResult(e.target.value as Result)}>{Object.entries(resultNames).map(([k,v])=><option key={k} value={k}>{k} · {v}</option>)}</select></label><label>Observación / ayuda / motivo de exclusión<textarea maxLength={3000} value={note} onChange={e=>setNote(e.target.value)}/></label><button className="button primary" onClick={()=>act(()=>{recorder.finish(result,note);setNote('')})}>Terminar tarea</button></>}
          <button className="button secondary" disabled={!!activeTask} onClick={()=>act(recorder.end)}>Finalizar sesión</button></>}
          <div className="study-actions"><button onClick={()=>saveJson(session)}>Descargar JSON completo</button><button onClick={()=>saveCsv(session)}>Descargar CSV</button><button onClick={async()=>{try{download(await exportWorkbook(session),`${session.participant}-sesion.xlsx`)}catch(e){setError((e as Error).message)}}}>Descargar Excel</button></div>
          <button className="danger-link" onClick={()=>{if(window.confirm('¿Eliminar la copia temporal? Confirma que descargaste los resultados.'))act(recorder.discard)}}>Eliminar copia temporal y preparar otro participante</button>
        </>}
      </>}
    </section>}
  </aside>
}
