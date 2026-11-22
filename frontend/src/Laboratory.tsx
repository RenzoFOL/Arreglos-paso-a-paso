import { useEffect, useRef, useState } from 'react'
import CodeEditor from './CodeEditor'
import { signal } from './events'
export const examples = {
  Modificar: 'valores = [8, 4, 12, 6]\nvalores[1] = 10\nprint(valores)',
  Consultar: 'valores = [8, 4, 12, 6]\nx = valores[2]\nprint(x)',
  Recorrer: 'valores = [8, 4, 12, 6]\nfor indice in range(len(valores)):\n    print(valores[indice])',
  'Caso con error': 'valores = [8, 4, 12, 6]\nprint(valores[5])',
}
type Example = keyof typeof examples
type Frame = { line: number | null; nextLine: number | null; variables: Record<string, unknown>; aliases: Record<string, string[]>; output: string; error?: string; elapsedMs: number }
const display = (value: unknown) => JSON.stringify(value)
function Experience({ initialExample = 'Modificar', guided = false }: { initialExample?: Example; guided?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [example, setExample] = useState<Example>(initialExample)
  const [source, setSource] = useState(examples[initialExample])
  const [frames, setFrames] = useState<Frame[]>([]), [cursor, setCursor] = useState(0)
  const [status, setStatus] = useState('Preparando Python'), [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false), [message, setMessage] = useState('')
  const [command, setCommand] = useState(''), [history, setHistory] = useState<string[]>([])
  const [traceSource, setTraceSource] = useState(''), [consoleTrace, setConsoleTrace] = useState(false)
  const [duration, setDuration] = useState(0), [playing, setPlaying] = useState(false)
  const worker = useRef<Worker | null>(null), timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pending = useRef(''), frame = frames[cursor], previous = frames[cursor - 1]
  const boot = () => {
    worker.current?.terminate(); clearTimeout(timeout.current)
    setReady(false); setBusy(false); setStatus('Preparando Python')
    const w = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })
    worker.current = w
    timeout.current = setTimeout(() => { w.terminate(); setStatus('No se pudo cargar Python'); setMessage('Pulsa Reiniciar motor para volver a intentarlo.'); setBusy(false) }, 30000)
    w.onmessage = ({ data }) => {
      clearTimeout(timeout.current)
      if (data.type === 'ready') { setReady(true); setStatus('Listo'); return }
      setBusy(false)
      if (data.type === 'result') {
        setFrames(data.frames); setCursor(0); setDuration(data.durationMs)
        const error = data.frames.at(-1)?.error
        setStatus(error ? 'Ejecución con error' : 'Traza lista')
        setMessage(error || '')
        if (pending.current) setHistory(h => [...h.slice(-19), '>>> ' + pending.current + '\n' + (error || data.frames.at(-1)?.output || 'Sin salida')])
        pending.current = ''
        signal('execution_complete', error ? 'error' : 'ok')
      } else {
        setReady(false); setStatus('Error del motor'); setMessage('Reinicia el motor para volver a intentarlo. ' + data.message)
      }
    }
    w.onerror = () => { clearTimeout(timeout.current); setReady(false); setBusy(false); setStatus('Error al cargar Python'); setMessage('Comprueba los archivos del motor y pulsa Reiniciar motor.') }
    w.postMessage({ type: 'boot' })
  }
  useEffect(() => { boot(); return () => { worker.current?.terminate(); clearTimeout(timeout.current) } }, [])
  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => setCursor(c => {
      if (c >= frames.length - 1) { setPlaying(false); return c }
      signal('trace_step', String(c + 1)); return c + 1
    }), 900)
    return () => clearInterval(timer)
  }, [playing, frames.length])
  useEffect(() => { if (initialExample !== example) select(initialExample) }, [initialExample])
  const select = (next: Example) => {
    if (source !== examples[example] && !window.confirm('Cambiar el ejemplo reemplazará el código editado. ¿Continuar?')) return
    setExample(next); setSource(examples[next]); setFrames([]); setPlaying(false); setMessage(''); setStatus(ready ? 'Listo' : 'Preparando Python'); signal('example_select', next)
  }
  const run = (interactive = false) => {
    if (!ready || busy) return
    setBusy(true); setPlaying(false); setMessage(''); setStatus('Ejecutando'); setFrames([])
    setTraceSource(interactive ? command : source); setConsoleTrace(interactive)
    pending.current = interactive ? command : ''
    worker.current!.postMessage({ type: 'run', source: interactive ? command : source, interactive })
    if (interactive) setCommand('')
    signal('execution_start', interactive ? 'console' : 'editor')
    timeout.current = setTimeout(() => {
      worker.current?.terminate(); setBusy(false); setReady(false); setStatus('Ejecución detenida por límite'); setMessage('El ejemplo tardó demasiado. Reinicia el motor y reduce el código.'); signal('execution_timeout')
    }, 8000)
  }
  const stop = () => { clearTimeout(timeout.current); worker.current?.terminate(); setBusy(false); setReady(false); setStatus('Detenido'); setMessage('El código se conserva. Reinicia el motor para continuar.'); signal('execution_stop') }
  const step = (amount: number) => { setPlaying(false); setCursor(c => Math.min(frames.length - 1, Math.max(0, c + amount))); signal('trace_step', String(amount)) }
  return <section data-study-state={`${guided ? 'examples' : 'lab'}:${example}:${cursor}:${status}:${expanded ? 'wide' : 'columns'}`}>
    <div className="page-title"><div className="eyebrow">{guided ? 'DEL CÓDIGO AL ARREGLO' : 'ESCRIBE, EJECUTA Y OBSERVA'}</div><h1>{guided ? 'Ejemplos paso a paso' : 'Laboratorio visual'}</h1><p>{guided ? 'Elige un ejemplo, ejecútalo y revisa qué cambia en cada línea.' : 'Modifica el código Python y observa sus variables, listas y salida.'}</p></div>
    {guided && <div className="tabs" aria-label="Ejemplos Python">{Object.keys(examples).map(key => <button key={key} data-study-id={`example-${key}`} disabled={busy} aria-pressed={key === example} className={key === example ? 'active' : ''} onClick={() => select(key as Example)}>{key === 'Caso con error' ? 'Ejemplo con error' : key === 'Recorrer' ? 'Recorrer un arreglo' : key}</button>)}</div>}
    <div className="lab-status" role="status"><span className={`status-dot ${busy ? 'running' : ''}`} /><strong>{status}</strong><span>Python real · listas unidimensionales</span></div>
    <div id={guided ? 'examples-workspace' : 'lab-workspace'} className={`lab-grid ${expanded ? 'editor-expanded' : ''}`}>
      <section className="panel console-editor" aria-label="Editor de código"><div className="panel-heading"><h2>Código Python</h2><span className="badge">Editable</span><button className="expand-editor" aria-label={expanded ? 'Restaurar editor en columnas' : 'Ampliar editor a todo el ancho'} title={expanded ? 'Restaurar distribución en columnas' : 'Código arriba; operación y resultados debajo'} aria-pressed={expanded} aria-controls={guided ? 'examples-workspace' : 'lab-workspace'} onClick={() => { setExpanded(value => !value); signal('editor_layout', expanded ? 'columns' : 'wide') }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={expanded ? 'M9 3v6H3m12-6v6h6M9 21v-6H3m12 6v-6h6' : 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6'} /></svg></button></div>
        <div className="editor-file"><span className="status-dot" />arreglos.py<span>Escribe aquí</span></div>
        <CodeEditor source={source} disabled={busy} onChange={s => { if (s !== source) { setSource(s); setFrames([]); setPlaying(false); setMessage(''); setStatus(ready ? 'Listo' : status) } }} line={!consoleTrace ? frame?.line || frame?.nextLine || 0 : 0} />
        <div className="console-toolbar"><button className="button primary" data-study-id="run" disabled={!ready || busy || !source.trim()} onClick={() => run()}>Ejecutar código</button><button className="button secondary" disabled={!busy} onClick={stop}>Detener</button><button className="text-link" onClick={() => { if (!window.confirm('Se borrarán las variables y la consola; tu código se conservará. ¿Reiniciar motor?')) return; setFrames([]); setHistory([]); setPlaying(false); setMessage(''); boot(); signal('engine_reset') }}>Reiniciar motor</button></div>
        <p className="inset-note">Ejecuta el código y usa Siguiente paso para observar cada cambio.</p>
      </section>
      <section className="panel operation-panel" aria-label="Seguimiento de la ejecución">
        <div className="panel-heading"><h2>Operación actual</h2></div>
        <div className="operation-content" tabIndex={0} role="region" aria-label="Detalle de la operación, desplazable">
          <span className="step-pill">{frames.length ? `Paso ${cursor + 1} de ${frames.length}` : 'Sin ejecución'}</span>
          <pre className="current-instruction"><code>{frame ? traceSource.split('\n')[(frame.line || frame.nextLine || 1) - 1] || '# Fin de la ejecución' : '# Esperando instrucción'}</code></pre>
          <p className="step-announcement" aria-live="polite">{frame ? (frame.error ? `Error en línea ${frame.line ?? '—'}` : frame.line ? `Después de la línea ${frame.line}${frame.nextLine ? ` · siguiente: ${frame.nextLine}` : ' · fin'}` : `Antes de la línea ${frame.nextLine}`) : 'Ejecuta el código para observar los cambios.'}</p>
          {consoleTrace && frame && <p className="muted small">Instrucción de la consola interactiva.</p>}
          <div className="trace-controls"><button className="button secondary" disabled={!frames.length || cursor === 0} onClick={() => step(-1)}>Anterior</button><button className="button primary" data-study-id="next-step" disabled={!frames.length || cursor === frames.length - 1} onClick={() => step(1)}>Siguiente paso</button><button className="button secondary" disabled={!frames.length || cursor === frames.length - 1} onClick={() => setPlaying(p => !p)}>{playing ? 'Pausar' : 'Reproducir'}</button></div>
          {frames.length > 0 && <label className="trace-range">Revisar paso <input type="range" min="0" max={frames.length - 1} value={cursor} onChange={e => { setPlaying(false); setCursor(Number(e.target.value)); signal('trace_seek', e.target.value) }} /></label>}
          <p className="small">El código resaltado corresponde al estado que ves en Estado del arreglo. Puedes avanzar o volver a un paso anterior.</p>
        </div>
      </section>
      <section className="panel variables-panel" aria-label="Resultados de la ejecución"><div className="panel-heading"><h2>Estado del arreglo</h2></div>
        <div className="variables-content" tabIndex={0} role="region" aria-label="Variables y salida, desplazables">
          <div className="small-label">VARIABLES Y RESULTADOS</div>
          {!frame && <p className="empty-state">Los resultados aparecerán al ejecutar el código.</p>}
          {frame && Object.keys(frame.variables).length === 0 && <p className="empty-state">Todavía no hay variables visibles.</p>}
          {Object.entries(frame?.variables || {}).map(([name, value]) => <div className="variable-block" key={name}><strong>{name}</strong>{Array.isArray(value) ? <div className="live-array">{value.map((v, i) => { const old = previous?.variables[name]; const changed = Array.isArray(old) && display(old[i]) !== display(v); return <div className={`live-cell ${changed ? 'changed' : ''}`} key={i}><span>Índice {i}</span><b>{display(v)}</b>{changed && <small>{display(old[i]) ?? 'nuevo'} → {display(v)}</small>}</div> })}{value.length === 0 && <span>Lista vacía []</span>}</div> : <code>{display(value)}</code>}{frame?.aliases[name]?.length > 1 && <small>Comparte lista con {frame.aliases[name].filter(n => n !== name).join(', ')}</small>}</div>)}
          <div className="small-label console-output-label">SALIDA EN ESTE PASO</div><pre className="console-output">{frame?.output || 'Sin salida todavía'}</pre>
          {frame?.error && <div className="feedback error" role="alert">{frame.error}<p>Corrige el código y vuelve a ejecutarlo.</p></div>}
          {message && !frame?.error && <div className="feedback error" role="alert">{message}</div>}
          {!guided && <details className="repl"><summary>Consola interactiva</summary><p>Consulta o modifica las variables de la última ejecución. Para ciclos de varias líneas usa el editor.</p><pre className="console-output">{history.join('\n\n') || 'Ejemplo: valores o print(valores[0])'}</pre><form onSubmit={e => { e.preventDefault(); run(true) }}><label htmlFor="command">Instrucción Python</label><input id="command" value={command} onChange={e => setCommand(e.target.value)} autoComplete="off" spellCheck={false} disabled={busy} /><button className="button primary" disabled={!ready || busy || !command.trim()}>Enviar instrucción</button></form></details>}
        </div>
      </section>
    </div>
    <details className="technical-details"><summary>Alcance y tiempo de ejecución</summary><p>Admite listas, variables, if, for, while y operaciones básicas. No incluye módulos ni funciones propias. Hasta 200 líneas, 1500 eventos de seguimiento y salida de 10 000 caracteres. Listas visualizadas: primeros 100 elementos. Tiempo con seguimiento: {duration.toFixed(2)} ms; incluye instrumentación, no la animación ni el tiempo de la tarea.</p></details>
  </section>
}
export default function Laboratory() { return <Experience /> }
export function EditableExamples({ initialExample }: { initialExample?: Example }) { return <Experience guided initialExample={initialExample} /> }
