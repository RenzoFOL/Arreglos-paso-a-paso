// ZIP STORE + a small OOXML writer: local export, no server or CDN dependency.
const encoder = new TextEncoder()
const bytes = value => typeof value === 'string' ? encoder.encode(value) : value
const crcTable = Array.from({length:256},(_,i)=>{ let c=i; for(let k=0;k<8;k++) c=c&1?0xedb88320^(c>>>1):c>>>1; return c>>>0 })
function crc32(data) { let c=0xffffffff; for(const b of data)c=crcTable[(c^b)&255]^(c>>>8); return (c^0xffffffff)>>>0 }
function header(size) { const data=new Uint8Array(size); return [data,new DataView(data.buffer)] }
export function zip(entries) {
  if(entries.length>65535)throw new Error('Demasiados archivos para exportar.')
  const parts=[], central=[]; let offset=0
  for(const entry of entries) {
    const name=bytes(entry.name), data=bytes(entry.data), crc=crc32(data)
    const [local,l]=header(30); l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint16(12,33,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,name.length,true)
    const [record,r]=header(46);r.setUint32(0,0x02014b50,true);r.setUint16(4,20,true);r.setUint16(6,20,true);r.setUint16(8,0x800,true);r.setUint16(14,33,true);r.setUint32(16,crc,true);r.setUint32(20,data.length,true);r.setUint32(24,data.length,true);r.setUint16(28,name.length,true);r.setUint32(42,offset,true)
    parts.push(local,name,data);central.push(record,name);offset+=local.length+name.length+data.length
  }
  const centralSize=central.reduce((sum,p)=>sum+p.length,0), [end,e]=header(22)
  e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true)
  const result=new Uint8Array(offset+centralSize+22);let at=0
  for(const part of [...parts,...central,end]) {result.set(part,at);at+=part.length}
  return result
}
const xml = s => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;')
function col(i) {let s='';for(i++;i;i=Math.floor((i-1)/26))s=String.fromCharCode(65+(i-1)%26)+s;return s}
export function workbook(sheets) {
  const files=[], ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main', rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
  files.push({name:'[Content_Types].xml',data:`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`})
  files.push({name:'_rels/.rels',data:`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`})
  files.push({name:'xl/workbook.xml',data:`<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name.slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`})
  files.push({name:'xl/_rels/workbook.xml.rels',data:`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${rel}/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="${rel}/styles" Target="styles.xml"/></Relationships>`})
  files.push({name:'xl/styles.xml',data:`<styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF243B53"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`})
  sheets.forEach((sheet,i)=>{
    const n=Math.max(1,...sheet.rows.map(r=>r.length)),last=`${col(n-1)}${Math.max(1,sheet.rows.length)}`
    files.push({name:`xl/worksheets/sheet${i+1}.xml`,data:`<worksheet xmlns="${ns}"><dimension ref="A1:${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${Array.from({length:n},(_,j)=>`<col min="${j+1}" max="${j+1}" width="${Math.min(65,Math.max(16,...sheet.rows.slice(0,60).map(r=>String(r[j]??'').length+2)))}" customWidth="1"/>`).join('')}</cols><sheetData>${sheet.rows.map((row,r)=>`<row r="${r+1}">${row.map((v,c)=>{const ref=`${col(c)}${r+1}`,style=r===0?1:0;return typeof v==='number'&&Number.isFinite(v)?`<c r="${ref}" s="${style}"><v>${v}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(String(v??'').slice(0,32767))}</t></is></c>`}).join('')}</row>`).join('')}</sheetData><autoFilter ref="A1:${last}"/></worksheet>`})
  })
  return zip(files)
}
export function susScore(answers) {return answers?.length===10 && answers.every(v=>Number.isInteger(v)&&v>=1&&v<=5)?answers.reduce((sum,v,i)=>sum+(i%2?5-v:v-1),0)*2.5:null}
