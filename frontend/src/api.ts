const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export async function api<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(base + '/api' + path, {
    method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('No pudimos completar la solicitud. Revisa la conexión con el servidor e inténtalo de nuevo.')
  return response.json()
}
export async function exportWorkbook(data: unknown) {
  const response = await fetch(base + '/api/study/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error('No se pudo exportar Excel. Comprueba STUDY_MODE en la API. Puedes descargar JSON o CSV sin conexión.')
  return response.blob()
}
