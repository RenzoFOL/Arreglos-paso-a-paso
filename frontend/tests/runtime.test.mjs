import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadPyodide } from 'pyodide'
import { taskMetrics, resultSummary } from '../src/study/metrics.mjs'
const py = await loadPyodide()
await py.runPythonAsync(await readFile(new URL('../src/tracer.py',import.meta.url),'utf8'))
async function run(source, interactive=false) { py.globals.set('_test_source',source); return JSON.parse(await py.runPythonAsync(`await trace_source(_test_source, ${interactive?'True':'False'})`)) }
test('estado después de cada línea, salida y aliases reales', async()=>{
 const {frames}=await run('a = [1,2]\nb = a\nb[0] = 7\nprint(a)')
 assert.deepEqual(frames.find(f=>f.line===1).variables.a,[1,2])
 assert.deepEqual(frames.find(f=>f.line===3).variables.a,[7,2])
 assert.equal(frames.at(-1).output,'[7, 2]\n')
 assert.equal(frames.at(-1).error,null)
 assert.deepEqual(frames.at(-1).aliases.a,['a','b'])
})
test('consola existente conserva variables y devuelve expresiones', async()=>{
 await run('a = [3,4]')
 const result=await run('a[1]',true)
 assert.equal(result.frames.at(-1).error,null)
 assert.equal(result.frames.at(-1).output,'4\n')
 await run('a.append(9)',true)
 assert.deepEqual((await run('a',true)).frames.at(-1).variables.a,[3,4,9])
})
test('recorrido, última iteración y errores con línea correcta', async()=>{
 const result=await run('a = [3,4]\nfor x in a:\n    print(x)')
 assert.equal(result.frames.at(-1).output,'3\n4\n')
 const bad=await run('a = [1]\nprint(a[4])')
 assert.equal(bad.frames.at(-1).line,2)
 assert.match(bad.frames.at(-1).error,/IndexError/)
 const syntax=await run('a = [')
 assert.match(syntax.frames.at(-1).error,/SyntaxError/)
})
test('bucle infinito y salida excesiva se interrumpen', async()=>{
 assert.match((await run('while True:\n    x = 1')).frames.at(-1).error,/límite/)
 assert.match((await run('print("x" * 10001)')).frames.at(-1).error,/límite/)
 assert.match((await run('import os')).frames.at(-1).error,/versión/)
})
test('tiempos no inventan inicio y descuentan pausas explícitas',()=>{
 const task={id:'N01',start:100,end:1000,result:'AU'}
 const events=[{t:150,type:'first_click',task:'N01',target:'Teoría'},{t:200,type:'pause'},{t:400,type:'resume'}]
 assert.deepEqual(taskMetrics(task,events),{elapsedMs:900,activeMs:700,clicks:1,firstTarget:'Teoría',firstClickMs:50,routes:[]})
 assert.equal(taskMetrics({...task,start:null},events).elapsedMs,null)
 assert.equal(taskMetrics({...task,adjustedStart:300,adjustedEnd:900},events).activeMs,500)
 assert.deepEqual(resultSummary([{result:'A'},{result:'N'},{result:'SC'},{result:'NE'},{result:null}]),{favorable:1,evaluable:2,excluded:2,pending:1})
})
