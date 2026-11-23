import test from 'node:test'
import assert from 'node:assert/strict'
import { zip, workbook, susScore } from '../src/study/archive.mjs'
import { taskMetrics, resultSummary } from '../src/study/metrics.mjs'
export function unzipStored(bytes) {
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength), result=new Map();let p=0
 while(view.getUint32(p,true)===0x04034b50) {assert.equal(view.getUint16(p+8,true),0);const size=view.getUint32(p+18,true),n=view.getUint16(p+26,true),extra=view.getUint16(p+28,true),start=p+30+n+extra;result.set(new TextDecoder().decode(bytes.slice(p+30,p+30+n)),bytes.slice(start,start+size));p=start+size}
 assert.equal(view.getUint32(p,true),0x02014b50);assert.equal(view.getUint32(bytes.length-22,true),0x06054b50)
 return result
}
test('ZIP conserva nombres UTF-8 y bytes binarios',()=>{const result=unzipStored(zip([{name:'P01/índice.txt',data:'índice ñ'},{name:'mapa.png',data:new Uint8Array([0,255,12])}]));assert.equal(new TextDecoder().decode(result.get('P01/índice.txt')),'índice ñ');assert.deepEqual(result.get('mapa.png'),new Uint8Array([0,255,12]))})
test('Excel conserva números, vacíos y texto peligroso como texto sin fórmulas',()=>{
 const entries=unzipStored(workbook([{name:'Resultados',rows:[['Número','Comentario','Vacío'],[12,'=HYPERLINK("https://ejemplo.test")',null],[0,'<xml>& ñ',undefined]]}]))
 const xml=new TextDecoder().decode(entries.get('xl/worksheets/sheet1.xml'))
 assert.match(xml,/<v>12<\/v>/);assert.match(xml,/<v>0<\/v>/);assert.match(xml,/t="inlineStr"><is><t xml:space="preserve">=HYPERLINK/);assert.doesNotMatch(xml,/<f>/);assert.match(xml,/&lt;xml&gt;&amp; ñ/)
 assert.ok(entries.has('[Content_Types].xml'));assert.ok(entries.has('xl/styles.xml'))
})
test('SUS 100, 0, 50 e incompleto; no convertir ausencia a cero',()=>{assert.equal(susScore([5,1,5,1,5,1,5,1,5,1]),100);assert.equal(susScore([1,5,1,5,1,5,1,5,1,5]),0);assert.equal(susScore(Array(10).fill(3)),50);assert.equal(susScore([null,...Array(9).fill(3)]),null);assert.equal(susScore([0,...Array(9).fill(3)]),null)})
test('primer clic termina medición antes del botón verde; pausas descontadas',()=>{const t={id:'T01',start:100,end:1200,measurementEnd:900};const m=taskMetrics(t,[{task:'T01',type:'pause',t:200},{task:'T01',type:'resume',t:500},{task:'T01',type:'first_click',t:900,target:'card-Teoría'}]);assert.equal(m.elapsedMs,800);assert.equal(m.activeMs,500);assert.equal(m.firstClickMs,800);assert.equal(m.clicks,1)})
test('SC se cuenta solo con criterio digital; AS se incluye, no como autónomo',()=>{const tasks=[{result:'SC'},{result:'AS'},{result:'AU'},{result:null},{result:'NE'}];assert.deepEqual(resultSummary(tasks,true),{favorable:1,evaluable:3,excluded:1,pending:1});assert.deepEqual(resultSummary(tasks),{favorable:1,evaluable:2,excluded:2,pending:1})})
