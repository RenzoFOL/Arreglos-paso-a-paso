import type {Task, Event} from './model'
export function taskMetrics(task:Task, events:Event[]): {elapsedMs:number|null;activeMs:number|null;clicks:number;firstTarget:string;firstClickMs:number|null;routes:string[]}
export function resultSummary(tasks:Task[], modern?:boolean): {favorable:number;evaluable:number;excluded:number;pending:number}
