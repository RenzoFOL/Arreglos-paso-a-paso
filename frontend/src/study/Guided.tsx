import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as recorder from './recorder'
import type { Session, Result } from './model'
import type { StudyPreparation } from '../studyBridge'
import catalog from './catalog.json'
import questionnaires from './questionnaires.json'
import DownloadBundle from './DownloadBundle'
import { commentQuestions } from './exportBundle'
import './guided.css'
const tasks=catalog.tasks
const operations='valores = [8, 4, 12, 6]\nx = valores[2]\nvalores[1] = 10\nvalores.append(9)\neliminado = valores.pop(0)\ndel valores[2]\nprint(valores)\nprint(x, eliminado)'
const longSource='valores = [8, 4, 12, 6]\ncopia = valores.copy()\n'+Array.from({length:30},(_,i)=>`# Línea de lectura ${i+1}`).join('\n')+'\n'+Array.from({length:18},(_,i)=>`dato${i+1} = ${i+1}`).join('\n')+'\nvalores[1] = 10\nultimo = valores[-1]\nprint(valores)'
export function preparationFor(index:number):StudyPreparation {
 const n=index+1, token=crypto.randomUUID()
 if([1,2,6,19,20].includes(n))return {token,module:'Inicio'}
 if([7,8].includes(n))return {token,module:'Teoría'}
 if([5,9,10].includes(n))return {token,module:'Práctica',exercise:n===10?2:0}
 if([3,4,11,12,13].includes(n))return {token,module:'Ejemplos',example:n===13?'Recorrer':'Modificar',frame:n===12?'line2':n===13?'first':undefined}
 return {token,module:'Laboratorio',source:[14,15].includes(n)?operations:n===16?'valores = [8, 4, 12, 6]\nprint(valores[5])':n===17?longSource:undefined,frame:n===15?'last':undefined}
}
function Overlay({title,children}:{title:string;children:ReactNode}) {
 const ref=useRef<HTMLDivElement>(null)
 useEffect(()=>{
  const app=document.querySelector<HTMLElement>('.app');if(app)app.inert=true
  const before=document.activeElement as HTMLElement;ref.current?.focus()
  return()=>{if(app)app.inert=false;before?.focus()}
 },[])
 return <div className="guided-cover"><div className="guided-dialog" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onKeyDown={e=>{
  if(e.key!=='Tab')return
  const nodes=[...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea,select,a[href]')],first=nodes[0],last=nodes.at(-1)
  if(!first){e.preventDefault();return}
  if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last!.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }}><h1>{title}</h1>{children}</div></div>
}
const labels=['Totalmente en desacuerdo','En desacuerdo','Ni de acuerdo ni en desacuerdo','De acuerdo','Totalmente de acuerdo']
export default function Guided({session,onReview}:{session:Session;onReview:()=>void}) {
 const g=session.guided!, task=tasks[g.index], current=session.tasks.find(t=>t.id===task?.id)
 const [ready,setReady]=useState(false),[loadError,setLoadError]=useState(''),[retry,setRetry]=useState(0),[count,setCount]=useState(10),[answer,setAnswer]=useState(''),[help,setHelp]=useState('none'),[elapsed,setElapsed]=useState(0)
 const state=recorder.state(), phase=g.phase
 useEffect(()=>{
  if(phase!=='running'||current?.start==null)return
  const tick=()=>setElapsed(Math.max(0,((current.measurementEnd??(performance.timeOrigin+performance.now()-Date.parse(session.startedAt)))-current.start!-pauseDuration(session,current.start!))/1000))
  tick();const timer=setInterval(tick,250);return()=>clearInterval(timer)
 },[phase,current?.id,current?.start,current?.measurementEnd])
 const moveNext=()=>{ const next=g.index+1;setAnswer('');recorder.updateGuided({index:next,phase:next>=tasks.length?'sus':'instructions'}) }
 useEffect(()=>{document.body.classList.add('guided-active');return()=>document.body.classList.remove('guided-active')},[])
 useEffect(()=>{
  if(phase!=='countdown'||!state.active)return
  const tick=()=>{const left=Math.max(0,Math.ceil(((g.deadline||Date.now())-Date.now())/1000));setCount(left);if(!left)recorder.updateGuided({phase:'instructions'})}
  tick();const timer=setInterval(tick,200);return()=>clearInterval(timer)
 },[phase,g.deadline,state.active])
 useEffect(()=>{
  if(phase!=='instructions'||!state.active)return
  setReady(false);setLoadError('');const p=preparationFor(g.index)
  const listener=(e:globalThis.Event)=>{if((e as CustomEvent).detail===p.token){setReady(true);clearTimeout(timeout)}}
  window.addEventListener('study-ready',listener)
  const timeout=setTimeout(()=>setLoadError('La pantalla o el motor tardaron en prepararse. Puedes reintentar; este tiempo no se mide.'),35000)
  window.dispatchEvent(new CustomEvent('study-prepare',{detail:p}))
  return()=>{clearTimeout(timeout);window.removeEventListener('study-ready',listener)}
 },[phase,g.index,retry,state.active])
 useEffect(()=>{
  if(phase!=='running'||task?.kind!=='FC'||current?.measurementEnd!=null)return
  const timer=setInterval(()=>{
   const st=recorder.state(), t=st.session?.tasks.find(v=>v.id===task.id)
   if(!st.paused&&t?.start!=null&&performance.timeOrigin+performance.now()-Date.parse(session.startedAt)-t.start>=30000+pauseDuration(session,t.start)) {
    recorder.annotate(task.id,{outcome:'timeout',proposedResult:'SC'});recorder.finish(null,'Límite de primer clic sin clic registrado; revisar antes de validar SC.');moveNext()
   }
  },250);return()=>clearInterval(timer)
 },[phase,task?.id,current?.measurementEnd])
 const finish=(abandon:boolean)=>{
  if(!task||!current)return
  const first=session.events.find(e=>e.task===task.id&&e.type==='first_click')
  const allowed:Record<string,string[]>={T01:['card-Teoría','nav-Teoría','Comenzar ruta sugerida','Comenzar por Teoría','route-Teoría'],T02:['card-Laboratorio','nav-Laboratorio'],T03:['example-Caso con error'],T04:['example-Recorrer'],T05:['Ayuda / Glosario'],T06:['Accesibilidad']}
  const proposed:Result|null=task.kind==='FC'&&first?(allowed[task.id]?.includes(first.target)?'A':'N'):abandon&&task.kind!=='FC'?'NC':null
  recorder.annotate(task.id,{outcome:abandon?'abandoned':'finished',proposedResult:proposed})
  recorder.finish(null,abandon?'El participante decidió no realizar o abandonar la tarea.':'El participante marcó Finalizar. Pendiente de validación del objetivo y la ayuda.')
  window.dispatchEvent(new CustomEvent('study-freeze'))
  if(!abandon&&['T10','T11','T14','T17','T18'].includes(task.id)) recorder.updateGuided({phase:'response'})
  else moveNext()
 }
 const pause=()=>{recorder.pause();recorder.updateGuided({phase:'paused'});setHelp('none');window.dispatchEvent(new CustomEvent('study-freeze'))}
 const resume=()=>{
  if(help!=='none'&&task){recorder.record('assistance',{detail:help},true);recorder.annotate(task.id,{assistance:[...(current?.assistance||[]),help]})}
  if(recorder.state().paused)recorder.pause();recorder.updateGuided({phase:'running'})
 }
 if(!state.active&&!session.ended) return <Overlay title="Sesión recuperada"><p>Participante {session.participant}. Conservamos tus registros y respuestas.</p><p>Si había una tarea en curso, se cerrará como no evaluable porque hubo un intervalo sin registro. No se borrará ni contará como fracaso.</p><button className="button primary" onClick={()=>{
  const interrupted=session.tasks.find(t=>t.end===null)
  const lastKnown=interrupted?Math.max(interrupted.start??interrupted.prepared,...session.events.filter(e=>e.task===interrupted.id).map(e=>e.t)):0
  recorder.resume()
  if(state.session?.tasks.some(t=>t.end===null)) {const id=session.tasks.find(t=>t.end===null)!.id;recorder.annotate(id,{outcome:'interrupted',measurementEnd:lastKnown});recorder.finish('NE','Recarga o interrupción: intervalo sin registro. Medición acotada al último evento disponible.');moveNext()}
  else if(phase==='countdown')recorder.updateGuided({deadline:Date.now()+10000})
 }}>Continuar sesión recuperada</button><DownloadBundle session={session}/></Overlay>
 if(phase==='countdown')return <Overlay title="Preparando la evaluación"><p>Participante <strong>{session.participant}</strong></p><p className="guided-count" role="status">{count}</p><p>Después aparecerá la primera indicación. El tiempo de la tarea todavía no comienza.</p></Overlay>
 if(phase==='instructions'&&task)return <Overlay title={`${task.id} · Tarea ${g.index+1} de ${tasks.length}`}><p>Participante <strong>{session.participant}</strong></p><h2>{task.title}</h2><p className="guided-prompt">{task.prompt}</p><p>Lee con calma. El tiempo comienza cuando pulses Iniciar tarea.</p>{task.kind==='FC'&&<p>Esta tarea registra tu primer clic. Dispones de hasta 30 segundos después de iniciar.</p>}{session.tasks.at(-1)?.outcome==='timeout'&&<p role="status">La tarea anterior terminó al alcanzar 30 segundos sin clic. El intento quedó registrado para revisión.</p>}{g.index===0&&<p>✓ Finalizar: consideras que terminaste. ■ No realizar: decides dejar la tarea. Ⅱ Pausar: necesitas tiempo o asistencia.</p>}
 {loadError?<><p role="alert">{loadError}</p><button className="button secondary" onClick={()=>setRetry(v=>v+1)}>Reintentar preparación</button><button className="button secondary" onClick={()=>{recorder.prepare(task.id);recorder.annotate(task.id,{kind:task.kind,outcome:'interrupted'});recorder.finish('NE','La pantalla no pudo prepararse.');moveNext()}}>Evaluador: omitir por fallo técnico</button></>:!ready&&<p role="status">Preparando pantalla…</p>}
 <div className="guided-start"><button className="button primary" disabled={!ready} onClick={()=>{
  recorder.prepare(task.id);recorder.annotate(task.id,{kind:task.kind});recorder.updateGuided({phase:'running'});recorder.startTask()
  requestAnimationFrame(()=>{if(task.id==='T20')document.querySelector<HTMLButtonElement>('.app-header nav button')?.focus()})
 }}>Iniciar tarea</button></div></Overlay>
 if(phase==='running')return <>{current?.measurementEnd!=null&&<Overlay title="Primer clic registrado"><p>El primer clic de {task.id} quedó registrado. Pulsa Finalizar para continuar.</p><div className="guided-controls"><button className="guided-green" onClick={()=>finish(false)}>✓ Finalizar</button><button className="guided-red" onClick={()=>finish(true)}>■ No realizar</button><button className="guided-yellow" onClick={pause}>Ⅱ Pausar</button></div></Overlay>}
 {current?.measurementEnd==null&&<div className="guided-toolbar" role="region" aria-label="Controles de la evaluación"><span><strong>{session.participant} · {task.id}</strong> · {g.index+1}/20<br/><small>Tiempo activo: {Math.floor(elapsed/60)}:{String(Math.floor(elapsed%60)).padStart(2,'0')}{task.kind==='FC'?` · Primer clic: quedan ${Math.max(0,30-Math.floor(elapsed))} s`:null}</small></span><div className="guided-controls"><button className="guided-green" onClick={()=>finish(false)}>✓ Finalizar</button><button className="guided-red" onClick={()=>finish(true)}>■ No realizar</button><button className="guided-yellow" onClick={pause}>Ⅱ Pausar</button></div></div>}</>
 if(phase==='paused')return <Overlay title="Tarea pausada"><p>{session.participant} · {task.id}. El tiempo activo está detenido. Puedes solicitar asistencia al evaluador.</p><label>Antes de reanudar, indica qué ocurrió<select value={help} onChange={e=>setHelp(e.target.value)}><option value="none">Solo hice una pausa; no recibí ayuda</option><option value="IN">Me repitieron o aclararon la indicación</option><option value="HU">Recibí orientación para resolver la tarea</option><option value="TEC">Se atendió un problema técnico</option></select></label><button className="button primary" onClick={resume}>Reanudar tarea</button><DownloadBundle session={session}/></Overlay>
 if(phase==='response')return <Overlay title="Una respuesta breve"><p>El tiempo de {task.id} ya se detuvo.</p><p>{task.id==='T11'?'¿Qué línea, índice y valor viste resaltados?':task.id==='T14'?'¿Qué contienen valores, x y eliminado al final?':task.id==='T17'?'¿Qué valor encontraste en ultimo?':task.id==='T10'?'¿Se conservó tu avance al regresar a Práctica?':'¿Pudiste leer y utilizar los controles con los ajustes elegidos?'}</p><label>Respuesta (opcional)<textarea maxLength={3000} value={current?.response||answer} onChange={e=>{setAnswer(e.target.value);recorder.annotate(task.id,{response:e.target.value})}}/></label><button className="button primary" onClick={moveNext}>Continuar</button></Overlay>
 if(phase==='sus'||phase==='likert') {
  const sus=phase==='sus',items=sus?questionnaires.SUS:questionnaires.Likert.map(v=>v[1]),answers=sus?g.sus:g.likert
  return <Overlay title={sus?'Cuestionario SUS':'Cuestionario de la interfaz'}><p>Participante {session.participant}. Marca una respuesta por enunciado. Puedes dejar preguntas sin responder.</p><p>1 Totalmente en desacuerdo · 2 En desacuerdo · 3 Neutral · 4 De acuerdo · 5 Totalmente de acuerdo{!sus?' · NU No lo utilicé':''}</p>
   {items.map((q,i)=><fieldset key={`${phase}${i}`}><legend>{i+1}. {q}</legend><div className="guided-scale">{[1,2,3,4,5,...(sus?[]:['NU'])].map(v=><label key={v}><input type="radio" name={`${phase}${i}`} aria-label={`${v}: ${typeof v==='number'?labels[v-1]:'No lo utilicé'}`} checked={answers[i]===v} onChange={()=>{if(sus){const a=[...g.sus];a[i]=v as number;recorder.updateGuided({sus:a})}else{const a=[...g.likert];a[i]=v as number|'NU';recorder.updateGuided({likert:a})}}}/>{v}</label>)}<button className="text-link" onClick={()=>{if(sus){const a=[...g.sus];a[i]=null;recorder.updateGuided({sus:a})}else{const a=[...g.likert];a[i]=null;recorder.updateGuided({likert:a})}}}>Borrar respuesta</button></div></fieldset>)}
   {sus&&<p className="small">Sevilla-Gonzalez y colaboradores (2020), apéndice 2. © Los autores. <a href={questionnaires.SUS_source} target="_blank" rel="noreferrer">Fuente y atribución completa</a>. <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>. Enunciados sin modificar; cambia su presentación.</p>}
   <button className="button primary" onClick={()=>{const missing=answers.filter(v=>v==null).length;if(missing&&!window.confirm(`Hay ${missing} preguntas sin responder. ¿Continuar así?${sus?' Sin las 10 respuestas no se calculará el puntaje SUS.':''}`))return;recorder.updateGuided({phase:sus?'likert':'comments',questionCompleted:{...g.questionCompleted,[phase]:true}})}}>Continuar</button>
  </Overlay>
 }
 if(phase==='comments')return <Overlay title="Comentarios finales"><p>Las respuestas son opcionales. Evita incluir nombres o información personal.</p>{commentQuestions.map((q,i)=><label key={q}>{q}<textarea maxLength={3000} value={g.comments[i]} onChange={e=>{const answers=[...g.comments];answers[i]=e.target.value;recorder.updateGuided({comments:answers})}}/></label>)}<button className="button primary" onClick={()=>{recorder.updateGuided({phase:'done',questionCompleted:{...g.questionCompleted,comments:true}});recorder.end()}}>Finalizar evaluación</button></Overlay>
 return <Overlay title="Gracias por participar"><p>Terminaste la evaluación. Descarga el ZIP y avisa al evaluador para que lo copie a su memoria USB.</p><p>Incluye tareas, eventos, pausas, cuestionarios, comentarios y mapas disponibles. Conserva esta pestaña hasta comprobar la descarga.</p><DownloadBundle session={session}/><button className="button secondary" onClick={onReview}>Abrir herramientas del evaluador</button></Overlay>
}
function pauseDuration(s:Session,start:number) {let at:number|null=null,total=0;for(const e of s.events){if(e.t<start)continue;if(e.type==='pause')at=e.t;if(e.type==='resume'&&at!=null){total+=e.t-at;at=null}}return total}
