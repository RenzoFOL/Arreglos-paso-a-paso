// Interface only. Event hooks are removed from the normal build by Vite's flag.
export type StudyPreparation = { token:string; module:'Inicio'|'Teoría'|'Ejemplos'|'Laboratorio'|'Práctica'; example?:'Modificar'|'Consultar'|'Recorrer'|'Caso con error'; source?:string; frame?:'line2'|'first'|'last'; exercise?:number }
export function studyReady(preparation?:StudyPreparation) {
 if(import.meta.env.VITE_STUDY_MODE==='true'&&preparation) window.dispatchEvent(new CustomEvent('study-ready',{detail:preparation.token}))
}
