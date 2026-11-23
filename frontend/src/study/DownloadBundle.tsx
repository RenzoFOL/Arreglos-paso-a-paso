import { useState } from 'react'
import { buildBundle } from './exportBundle'
import { download, type Session } from './model'
export default function DownloadBundle({session}:{session:Session}) {
 const [busy,setBusy]=useState(false),[status,setStatus]=useState(''),[error,setError]=useState('')
 return <div className="bundle-download"><button className="button primary" disabled={busy} onClick={async()=>{
  if(busy)return
  setBusy(true);setError('')
  try { const result=await buildBundle(structuredClone(session),setStatus);download(result.blob,result.name);setStatus(`Descarga solicitada: ${result.name}. Verifica el archivo en Descargas y cópialo a tu memoria USB.`) }
  catch(e){setError(`No se pudo generar el ZIP: ${(e as Error).message}. La copia temporal se conserva; puedes reintentar.`);setStatus('')}
  finally{setBusy(false)}
 }}>{busy?'Preparando descarga…':'Descargar todo (.zip)'}</button><p role="status">{status}</p>{error&&<p role="alert" className="feedback error">{error}</p>}</div>
}
