export function taskMetrics(task, events) {
  const start = task.adjustedStart ?? task.start, end = task.adjustedEnd ?? task.measurementEnd ?? task.end
  const own = events.filter(e => e.task === task.id)
  const clicks = own.filter(e => e.type === 'click' || e.type === 'first_click')
  let pausedAt = null, pausedMs = 0
  if (start != null && end != null) {
    for (const e of events) {
      if (e.t > end) break
      if (e.type === 'pause') pausedAt = e.t
      if (e.type === 'resume' && pausedAt != null) { pausedMs += Math.max(0, Math.min(end,e.t)-Math.max(start,pausedAt)); pausedAt=null }
    }
    if (pausedAt != null) pausedMs += Math.max(0,end-Math.max(start,pausedAt))
  }
  const elapsed = start == null || end == null || end < start ? null : end-start
  return { elapsedMs: elapsed, activeMs: elapsed == null ? null : Math.max(0,elapsed-pausedMs), clicks: clicks.length, firstTarget: clicks[0]?.target ?? '', firstClickMs: start == null || !clicks.length ? null : Math.max(0,clicks[0].t-start), routes: own.filter(e => e.type === 'navigate').map(e => e.detail) }
}
export function resultSummary(tasks, modern = false) {
  return { favorable: tasks.filter(t => ['A','AU'].includes(t.result)).length, evaluable: tasks.filter(t => (modern ? ['A','AU','AS','N','NC','SC'] : ['A','AU','AS','N','NC']).includes(t.result)).length, excluded: tasks.filter(t => (modern ? ['NE'] : ['SC','NE']).includes(t.result)).length, pending: tasks.filter(t => !t.result).length }
}
