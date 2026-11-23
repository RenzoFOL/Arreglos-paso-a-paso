import { workbook, zip, susScore, type ArchiveEntry, type Sheet } from './archive.mjs'
import { type Session, type Event, keyOf, isClick } from './model'
import { taskMetrics } from './metrics.mjs'
import instruments from './questionnaires.json'
import catalog from './catalog.json'
const sec=(ms:number|null|undefined)=>ms==null?null:Math.round(ms)/1000
const sheet=(name:string,rows:unknown[][]):Sheet=>({name,rows})
export function dataFiles(s:Session):ArchiveEntry[] {
 const g=s.guided, prefix=s.participant, files:ArchiveEntry[]=[]
 const add=(name:string,sheets:Sheet[])=>files.push({name:`Excel/${prefix}_${name}.xlsx`,data:workbook(sheets)})
 add('Sesion',[sheet('Contexto',[
 ['Campo','Valor'],['Participante',s.participant],['Sesión',s.id],['Inicio ISO',s.startedAt],['Versión aplicación',s.appVersion],['Protocolo',s.protocol||'Registro manual v1'],['Semestre',g?.semester],['Navegador',s.environment?.userAgent],['Idioma',s.environment?.language],['Zona horaria',s.environment?.timezone],['Consentimiento',s.consent?'Sí':'No'],['Finalizada',s.ended?'Sí':'No'],['Fase',g?.phase||'manual'],['Tareas registradas',s.tasks.length],['Eventos registrados',s.events.length],['Captura truncada por límite',s.captureTruncated?'Sí: revisar antes de analizar':'No'],['Puntaje SUS 0–100',susScore(g?.sus)],['SUS enviado',g?.questionCompleted?.sus?'Sí':'No'],['Likert enviado',g?.questionCompleted?.likert?'Sí':'No'],['Comentarios enviados',g?.questionCompleted?.comments?'Sí':'No'],['Revisión','Finalizar es autoinforme. Resultado propuesto y validado se conservan por separado.']])])
 add('Tareas',[sheet('Resultados',[
 ['Participante','Sesión','Tarea','Tipo','Cierre declarado','Resultado validado','Propuesta automática','Inicio s','Fin medición s','Cierre s','Tiempo bruto s','Tiempo activo s','Pausa s','Primera interacción s','Primer clic s desde inicio','Clics','Primer destino','Ayudas declaradas','Respuesta breve','Observación','Inicio ajustado s','Fin ajustado s'],
 ...s.tasks.map(t=>{const m=taskMetrics(t,s.events);return[s.participant,s.id,t.id,t.kind,t.outcome,t.result,t.proposedResult,sec(t.start),sec(t.measurementEnd??t.end),sec(t.end),sec(m.elapsedMs),sec(m.activeMs),m.elapsedMs==null||m.activeMs==null?null:sec(m.elapsedMs-m.activeMs),sec(t.firstInteraction),sec(m.firstClickMs),m.clicks,m.firstTarget,t.assistance?.join('; '),t.response,t.note,sec(t.adjustedStart),sec(t.adjustedEnd)]})]),sheet('Consignas',[['Tarea','Tipo','Indicación','Criterio del evaluador'],...catalog.tasks.map(t=>[t.id,t.kind,t.prompt,t.success])])])
 add('Eventos',[sheet('Eventos',[
 ['Participante','Sesión','Secuencia','Instante s','Tarea','Evento','Pantalla','Estado','Destino','Zona','X viewport','Y viewport','Ancho','Alto','Scroll página','Contexto zoom y paneles','Detalle'],
 ...s.events.map(e=>[s.participant,s.id,e.seq,sec(e.t),e.task,e.type,e.route,e.state,e.target,e.region,e.x,e.y,e.width,e.height,e.scrollY,e.context,e.detail])])])
 add('Pausas',[sheet('Pausas y visibilidad',[['Participante','Tarea','Instante s','Evento','Detalle'],...s.events.filter(e=>['pause','resume','visibility','session_resumed','assistance'].includes(e.type)).map(e=>[s.participant,e.task,sec(e.t),e.type,e.detail])])])
 add('SUS',[sheet('Respuestas',[['Participante','Reactivo','Enunciado','Respuesta 1–5','Contribución 0–4'],...instruments.SUS.map((q,i)=>{const v=g?.sus[i];return[s.participant,`S${i+1}`,q,v,v==null?null:i%2?5-v:v-1]})]),sheet('Puntuacion',[['Participante','Respuestas válidas','SUS 0–100','Interpretación'],[s.participant,g?.sus.filter(v=>v!=null).length||0,susScore(g?.sus),'No es porcentaje de éxito. Si falta una respuesta, no se calcula.']]),sheet('Fuente',[['Fuente','Licencia'],[instruments.SUS_source,instruments.SUS_license],['Sevilla-Gonzalez y colaboradores (2020). Spanish Version of the System Usability Scale for the Assessment of Electronic Tools: Development and Validation.','Reactivos conservados, apéndice 2.']])])
 add('Likert',[sheet('Respuestas',[['Participante','Reactivo','Enunciado','Respuesta 1–5 o NU','Tareas relacionadas'],...instruments.Likert.map(([id,q,t],i)=>[s.participant,id,q,g?.likert[i],t])]),sheet('Escala',[['Valor','Significado'],[1,'Totalmente en desacuerdo'],[2,'En desacuerdo'],[3,'Ni de acuerdo ni en desacuerdo'],[4,'De acuerdo'],[5,'Totalmente de acuerdo'],['NU','No lo utilicé'],['Vacío','Sin respuesta'],['Análisis','Cuestionario específico del estudio; no sumar con SUS.']])])
 add('Comentarios',[sheet('Comentarios',[['Participante','Pregunta','Respuesta'],...commentQuestions.map((q,i)=>[s.participant,q,g?.comments[i]])])])
 files.push({name:`Datos/${prefix}_sesion_completa.json`,data:JSON.stringify(s,null,2)})
 return files
}
export const commentQuestions=['¿En qué momento no supiste qué hacer o qué estaba ocurriendo?','¿Qué elemento esperabas que reaccionara de otra manera al pasar el mouse o hacer clic?','¿Qué cambiarías primero para usar la herramienta con mayor comodidad?']
function mapGroups(s:Session) {
 const groups=new Map<string,Event[]>()
 for(const e of s.events) { if(!e.task)continue;const k=keyOf(e);const group=groups.get(k)||[];group.push(e);groups.set(k,group) }
 return [...groups].filter(([,events])=>events.some(e=>isClick(e)&&e.detail!=='activación por teclado; excluir de mapas de puntero'&&e.x!=null&&e.y!=null))
}
async function renderMap(events:Event[], first:boolean):Promise<Uint8Array> {
 const base=events[0], canvas=document.createElement('canvas'), scale=Math.min(1,1600/Math.max(base.width,base.height,1))
 canvas.width=Math.max(1,Math.round(base.width*scale));canvas.height=Math.max(1,Math.round(base.height*scale))+60
 const c=canvas.getContext('2d');if(!c)throw new Error('El navegador no permite generar los mapas. Los datos permanecen en esta pestaña.')
 c.fillStyle='#f8fafc';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#172554';c.font='13px Arial';c.fillText(`${base.task} · ${first?'Primer clic':'Todos los clics'} · ${base.route}`,12,22);c.font='11px Arial';c.fillText('Esquema de controles. Intensidad = superposición de clics; no mide mirada.',12,43)
 c.translate(0,60);c.scale(scale,scale)
 const layout=events.find(e=>e.layout)?.layout||[]
 c.font='12px Arial'
 for(const r of layout){c.fillStyle='#fff';c.fillRect(r.x,r.y,r.w,r.h);c.strokeStyle='#cbd5e1';c.strokeRect(r.x,r.y,r.w,r.h);c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();c.fillStyle='#475569';c.fillText(r.text,r.x+4,r.y+r.h/2);c.restore()}
 for(const p of events.filter(e=>isClick(e)&&(!first||e.type==='first_click')&&e.detail!=='activación por teclado; excluir de mapas de puntero'&&e.x!=null&&e.y!=null)) {
  const gradient=c.createRadialGradient(p.x!,p.y!,0,p.x!,p.y!,28);gradient.addColorStop(0,'rgba(220,38,38,.75)');gradient.addColorStop(.5,'rgba(249,115,22,.35)');gradient.addColorStop(1,'rgba(249,115,22,0)');c.fillStyle=gradient;c.fillRect(p.x!-28,p.y!-28,56,56)
 }
 const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('No se pudo generar un mapa PNG.')),'image/png'))
 canvas.width=canvas.height=1
 return new Uint8Array(await blob.arrayBuffer())
}
export async function buildBundle(s:Session, progress:(text:string)=>void=()=>{}) {
 progress('Preparando archivos Excel…');await new Promise(r=>setTimeout(r,0))
 const files=dataFiles(s), groups=mapGroups(s), index:unknown[][]=[['Archivo','Tarea','Tipo','Pantalla','Estado','Ancho original','Alto original','Scroll','Contexto','Clics de puntero']]
 for(let i=0;i<groups.length;i++) {
  progress(`Generando mapas ${i+1} de ${groups.length}…`)
  const [,events]=groups[i],base=events[0]
  for(const first of [false,true]) {
   const n=events.filter(e=>isClick(e)&&(!first||e.type==='first_click')&&e.detail!=='activación por teclado; excluir de mapas de puntero'&&e.x!=null&&e.y!=null).length
   if(!n)continue
   const name=`Mapas/${base.task!.replace(/[^\w-]/g,'_')}_${String(i+1).padStart(4,'0')}_${first?'primer_clic':'clics'}.png`
   files.push({name,data:await renderMap(events,first)});index.push([name,base.task,first?'Primer clic':'Todos',base.route,base.state,base.width,base.height,base.scrollY,base.context,n])
  }
 }
 files.push({name:`Excel/${s.participant}_Indice_mapas.xlsx`,data:workbook([sheet('Mapas',index)])})
 files.push({name:'LEEME.txt',data:`ARREGLOS PASO A PASO — ${s.participant}\nSesión: ${s.id}\nProtocolo: ${s.protocol||'manual'}\nExportación: ${new Date().toISOString()}\nCaptura truncada por límite: ${s.captureTruncated?'SÍ, revisar datos incompletos':'No'}\n\nExcel: contexto, tareas, eventos, pausas, SUS, Likert, comentarios e índice de mapas.\nDatos: JSON íntegro para importar en el panel de análisis.\nMapas: PNG de concentración sobre un esquema de controles (no captura de pantalla). Se separan por tarea, pantalla, estado, tamaño, zoom, preferencias y scroll de página/paneles. Solo se generan para vistas con clics de puntero; las tareas sin clics siguen en los Excel. No representan mirada ni atención.\nNo hay datos inventados: vacío significa ausente o pendiente. Finalizar es un autoinforme; el resultado validado puede quedar pendiente. Las propuestas automáticas requieren revisión.\nSUS: 0–100, no porcentaje de éxito. Incompleto: sin puntuación. Likert se analiza por reactivo, separado de SUS.\nLos archivos son locales: copia este ZIP a tu memoria USB y verifica que abre antes de borrar la sesión. No se incluye audio ni video porque la aplicación no los graba.\n`})
 progress('Empaquetando ZIP…')
 return {blob:new Blob([zip(files)],{type:'application/zip'}),name:`${s.participant}_${s.startedAt.slice(0,10)}_${s.id.replace(/[^\w-]/g,'').slice(0,8)}.zip`}
}
