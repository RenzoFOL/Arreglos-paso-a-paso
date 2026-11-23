import React from 'react'
import { beforeEach,afterEach,it,expect,vi } from 'vitest'
import { act,cleanup,fireEvent,render,screen,waitFor,within } from '@testing-library/react'
import { writeFileSync,mkdirSync } from 'node:fs'
import App from '../../src/App'
import Study from '../../src/study/Study'
import * as recorder from '../../src/study/recorder'
import { dataFiles } from '../../src/study/exportBundle'
import { susScore,zip } from '../../src/study/archive.mjs'
import exercises from '../../../back/app/exercises.json'
vi.mock('../../src/CodeEditor',()=>({default:({source,onChange}:{source:string;onChange:(s:string)=>void})=><textarea aria-label="Código de prueba" value={source} onChange={e=>onChange(e.target.value)}/>}))
beforeEach(()=>{
 localStorage.clear();sessionStorage.clear();recorder.discard()
 vi.stubGlobal('scrollTo',()=>{})
 vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>exercises})))
 class FakeWorker {
  onmessage:((v:{data:object})=>void)|null=null
  terminate(){}
  postMessage(data:{type:string;source?:string}){queueMicrotask(()=>this.onmessage?.({data:data.type==='boot'?{type:'ready'}:{type:'result',durationMs:1,frames:[{line:null,nextLine:1,variables:{},aliases:{},output:''},{line:1,nextLine:2,variables:{valores:[8,4,12,6]},aliases:{},output:''},{line:2,nextLine:null,variables:{valores:[8,10,12,6]},aliases:{},output:''}]}}))}
 }
 vi.stubGlobal('Worker',FakeWorker)
})
afterEach(()=>{cleanup();recorder.discard();vi.useRealTimers();vi.unstubAllGlobals()})
async function start(){render(<><App/><Study/></>);fireEvent.click(screen.getByRole('button',{name:'Evaluación +'}));fireEvent.click(screen.getByLabelText(/El participante recibió/));fireEvent.click(screen.getByRole('button',{name:'Iniciar evaluación de 20 tareas'}));expect(screen.getByRole('dialog',{name:'Preparando la evaluación'})).toBeTruthy();await act(async()=>recorder.updateGuided({phase:'instructions'}))}
it('recorre 20 tareas y conserva cuestionarios y archivos Excel separados',async()=>{
 await start()
 for(let n=1;n<=20;n++){
  await screen.findByRole('dialog',{name:`T${String(n).padStart(2,'0')} · Tarea ${n} de 20`})
  await waitFor(()=>expect((screen.getByRole('button',{name:'Iniciar tarea',exact:true}) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button',{name:'Iniciar tarea',exact:true}))
  if(n===1){fireEvent.click(document.querySelector('[data-study-id="card-Teoría"]')!,{clientX:80,clientY:120,detail:1});expect(screen.getByRole('dialog',{name:'Primer clic registrado'})).toBeTruthy();fireEvent.click(screen.getByRole('button',{name:'✓ Finalizar'}))}
  else {
   if(n===2){fireEvent.click(screen.getByRole('button',{name:'Ⅱ Pausar'}));fireEvent.change(screen.getByLabelText('Antes de reanudar, indica qué ocurrió'),{target:{value:'HU'}});fireEvent.click(screen.getByRole('button',{name:'Reanudar tarea'}))}
   fireEvent.click(screen.getByRole('button',{name:'■ No realizar'}))
  }
 }
 expect(screen.getByRole('dialog',{name:'Cuestionario SUS'})).toBeTruthy()
 for(const f of screen.getAllByRole('group'))fireEvent.click(within(f).getByRole('radio',{name:/^3:/}))
 fireEvent.click(screen.getByRole('button',{name:'Continuar',exact:true}))
 for(const f of screen.getAllByRole('group'))fireEvent.click(within(f).getByRole('radio',{name:/^NU:/}))
 fireEvent.click(screen.getByRole('button',{name:'Continuar',exact:true}))
 fireEvent.change(screen.getByLabelText('¿En qué momento no supiste qué hacer o qué estaba ocurriendo?'),{target:{value:'=SUM(1,2)'}})
 fireEvent.click(screen.getByRole('button',{name:'Finalizar evaluación'}))
 expect(screen.getByRole('button',{name:'Descargar todo (.zip)'})).toBeTruthy()
 const session=recorder.state().session!
 expect(session.tasks).toHaveLength(20);expect(session.tasks[0].proposedResult).toBe('A');expect(session.tasks[0].result).toBe(null);expect(session.tasks[1].assistance).toEqual(['HU']);expect(session.ended).toBe(true)
 expect(session.events.filter(e=>e.type==='first_click')).toHaveLength(1)
 expect(session.events.some(e=>e.target.includes('Iniciar tarea')||e.target.includes('Finalizar'))).toBe(false)
 expect(susScore(session.guided!.sus)).toBe(50)
 const files=dataFiles(session);expect(files.filter(f=>f.name.endsWith('.xlsx'))).toHaveLength(7)
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/component-data-synthetic.zip',zip(files));writeFileSync('test-results/component-session-synthetic.json',JSON.stringify(session))
},20000)
it('preparación y lectura no inician la tarea; recarga cierra NE sin contabilizar el intervalo perdido',async()=>{
 await start();expect(recorder.state().session!.tasks).toHaveLength(0)
 await waitFor(()=>expect((screen.getByRole('button',{name:'Iniciar tarea',exact:true}) as HTMLButtonElement).disabled).toBe(false))
 fireEvent.click(screen.getByRole('button',{name:'Iniciar tarea',exact:true}))
 const last=recorder.state().session!.events.at(-1)!.t
 cleanup();render(<><App/><Study/></>)
 expect(await screen.findByRole('dialog',{name:'Sesión recuperada'})).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Continuar sesión recuperada'}))
 expect(await screen.findByRole('dialog',{name:'T02 · Tarea 2 de 20'})).toBeTruthy()
 const task=recorder.state().session!.tasks[0];expect(task.result).toBe('NE');expect(task.measurementEnd).toBe(last)
})
