import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../../src/App'
import Study from '../../src/study/Study'
import * as recorder from '../../src/study/recorder'
import { csv,validateSession } from '../../src/study/model'
import exercises from '../../../back/app/exercises.json'
vi.mock('../../src/Laboratory',()=>({default:()=> <div>Laboratorio</div>,EditableExamples:()=> <div>Ejemplos</div>}))
beforeEach(()=>{
 vi.stubGlobal('scrollTo',()=>{})
 vi.stubGlobal('fetch',vi.fn(async(url:string,opts?:RequestInit)=>{
   if(url.endsWith('/exercises'))return {ok:true,json:async()=>exercises.map(({correct,result,explanation,...e})=>e)}
   const id=url.match(/exercises\/(\d+)\/check/)?.[1],item=exercises.find(e=>e.id===id)!
   const success=JSON.parse(opts!.body as string).choice===item.correct
   return {ok:true,json:async()=>({success,explanation:success?item.explanation:item.hint,result:success?item.result:item.values})}
 }))
})
afterEach(()=>{cleanup();recorder.discard();vi.useRealTimers();vi.unstubAllGlobals()})
describe('recorridos funcionales',()=>{
 it('la ruta acompaña la navegación y conserva el destino contextual',()=>{
   render(<App/>)
   const route=screen.getByRole('region',{name:'Ruta sugerida'})
   fireEvent.click(within(route).getByRole('button',{name:'2 Ejemplos'}))
   expect(within(route).getByRole('button',{name:'2 Ejemplos'}).getAttribute('aria-current')).toBe('step')
   fireEvent.click(within(route).getByRole('button',{name:'Continuar a Laboratorio'}))
   expect(within(route).getByRole('button',{name:'3 Laboratorio'}).getAttribute('aria-current')).toBe('step')
   fireEvent.click(within(route).getByRole('button',{name:'1 Teoría'}))
   expect(screen.getByRole('heading',{name:'Teoría',exact:true})).toBeTruthy()
   expect(within(route).getByRole('button',{name:'Continuar a Ejemplos'})).toBeTruthy()
 })
 it('el recorrido automático se puede pausar y respeta movimiento reducido',()=>{
   vi.useFakeTimers()
   let motionChange:()=>void=()=>{}
   const media={matches:false,addEventListener:(_type:string,listener:()=>void)=>{motionChange=listener},removeEventListener:()=>{}}
   vi.stubGlobal('matchMedia',()=>media)
   render(<App/>)
   act(()=>{vi.advanceTimersByTime(1600)})
   expect(screen.getByText('Índice 1 → valor 4')).toBeTruthy()
   fireEvent.click(screen.getByRole('button',{name:'Pausar recorrido'}))
   act(()=>{vi.advanceTimersByTime(3200)})
   expect(screen.getByText('Índice 1 → valor 4')).toBeTruthy()
   fireEvent.click(screen.getByRole('button',{name:'Valor 12 en índice 2',exact:true}))
   expect(screen.getByText('Índice 2 → valor 12')).toBeTruthy()
   fireEvent.click(screen.getByRole('button',{name:'Reanudar recorrido'}))
   act(()=>{media.matches=true;motionChange()})
   act(()=>{vi.advanceTimersByTime(3200)})
   expect(screen.getByText('Índice 2 → valor 12')).toBeTruthy()
   expect(screen.queryByRole('button',{name:'Pausar recorrido'})).toBeNull()
 })
 it('clic en fondo de tarjeta navega y mantiene progreso al volver',async()=>{
   render(<App/>);fireEvent.click(document.querySelector('[data-study-id="card-Teoría"]')!)
   expect(screen.getByRole('heading',{name:'Teoría',exact:true})).toBeTruthy()
   const nav=screen.getByRole('navigation')
   fireEvent.click(within(nav).getByRole('button',{name:'Práctica',exact:true}))
   await screen.findByRole('heading',{name:'Reemplaza el tercer valor'})
   fireEvent.click(screen.getByRole('radio',{name:/valores\[2\] = 15/}))
   fireEvent.click(screen.getByRole('button',{name:'Comprobar respuesta'}))
   await screen.findByText('Respuesta correcta',{exact:true})
   fireEvent.click(screen.getByRole('button',{name:'Continuar al siguiente ejercicio'}))
   fireEvent.click(within(nav).getByRole('button',{name:'Teoría',exact:true}))
   fireEvent.click(within(nav).getByRole('button',{name:'Práctica',exact:true}))
   expect(screen.getByRole('heading',{name:'Identifica dónde se reemplaza el valor'})).toBeTruthy()
 })
 it('error de red muestra recuperación sin inventar resultado',async()=>{
   vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('Sin conexión')}))
   render(<App/>);fireEvent.click(document.querySelector('[data-study-id="card-Práctica"]')!)
   expect(await screen.findByRole('button',{name:'Reintentar carga'})).toBeTruthy()
   expect(screen.queryByText('Respuesta correcta',{exact:true})).toBeNull()
 })
 it('captura solo tras consentimiento y conserva primer clic y destino',async()=>{
   render(<><App/><Study/></>)
   fireEvent.click(screen.getByRole('button',{name:'Evaluación +'}))
   expect((screen.getByRole('button',{name:'Iniciar sesión'}) as HTMLButtonElement).disabled).toBe(true)
   fireEvent.click(screen.getByLabelText(/El participante recibió/))
   fireEvent.click(screen.getByRole('button',{name:'Iniciar sesión'}))
   fireEvent.click(screen.getByRole('button',{name:'Preparar tarea y cerrar panel'}))
   expect(recorder.state().session!.tasks[0].start).toBeNull()
   fireEvent.click(document.querySelector('[data-study-id="card-Teoría"]')!,{clientX:100,clientY:200,detail:1})
   const session=recorder.state().session!
   expect(session.events.find(e=>e.type==='first_click')?.target).toBe('card-Teoría')
   expect(session.events.some(e=>e.type==='navigate'&&e.detail==='Teoría')).toBe(true)
   expect(session.tasks[0].start).not.toBeNull()
   fireEvent.click(screen.getByRole('button',{name:/Registrando P01/}))
   fireEvent.change(screen.getByLabelText('Resultado del observador'),{target:{value:'A'}})
   fireEvent.click(screen.getByRole('button',{name:'Terminar tarea'}))
   fireEvent.click(screen.getByRole('button',{name:'Finalizar sesión'}))
   expect(session.tasks[0].result).toBe('A');expect(session.ended).toBe(true)
   const serialized=JSON.parse(JSON.stringify(session));expect(validateSession(serialized).participant).toBe('P01')
   expect(session.events.filter(e=>e.type==='click'||e.type==='first_click')).toHaveLength(1)
 })
 it('pausa impide captura y recuperación exige reanudar',()=>{
   recorder.begin('P02');recorder.prepare('N01');const remove=recorder.install()
   recorder.pause();const count=recorder.state().session!.events.length
   fireEvent.click(document.body);expect(recorder.state().session!.events.length).toBe(count)
   recorder.pause();recorder.finish('NE','Interrupción');recorder.end();remove()
   recorder.restore();expect(recorder.state().active).toBe(false)
 })
 it('protege hojas de cálculo y rechaza importaciones inválidas',()=>{
   expect(csv([['=HYPERLINK("bad")']])).toContain("'=HYPERLINK")
   expect(()=>validateSession({schemaVersion:1,consent:false})).toThrow()
 })
})
