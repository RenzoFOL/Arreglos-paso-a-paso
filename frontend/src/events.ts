// Sin listeners ni persistencia en la versión normal. El módulo study se importa solo en modo estudio.
export function signal(type: string, detail = '') {
  if (import.meta.env.VITE_STUDY_MODE === 'true') window.dispatchEvent(new CustomEvent('study-event', { detail: { type, detail } }))
}
