import tracer from './tracer.py?raw'
let runtime: any
let loading: Promise<any> | undefined
async function boot() {
  if (!loading) loading = (async () => {
    const url = new URL('/pyodide/pyodide.mjs', self.location.origin).href
    const { loadPyodide } = await import(/* @vite-ignore */ url)
    runtime = await loadPyodide({ indexURL: new URL('/pyodide/', self.location.origin).href })
    await runtime.runPythonAsync(tracer)
    return runtime
  })()
  return loading
}
self.onmessage = async ({ data }) => {
  try {
    const py = await boot()
    if (data.type === 'boot') { self.postMessage({ type: 'ready' }); return }
    py.globals.set('_source_input', data.source)
    py.globals.set('_interactive_input', Boolean(data.interactive))
    const result = await py.runPythonAsync('await trace_source(_source_input, _interactive_input)')
    self.postMessage({ type: 'result', ...JSON.parse(result) })
  } catch (error) {
    self.postMessage({ type: 'failure', message: String(error) })
  }
}
