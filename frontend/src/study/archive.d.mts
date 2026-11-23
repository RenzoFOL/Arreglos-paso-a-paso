export type ArchiveEntry = {name:string;data:string|Uint8Array}
export type Sheet = {name:string;rows:unknown[][]}
export function zip(entries:ArchiveEntry[]):Uint8Array<ArrayBuffer>
export function workbook(sheets:Sheet[]):Uint8Array<ArrayBuffer>
export function susScore(answers:(number|null)[]|undefined):number|null
