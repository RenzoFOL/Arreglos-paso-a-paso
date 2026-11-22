import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { signal } from './events'

type Preferences = {
  motion: 'system' | 'full' | 'reduced'
  autoplay: boolean
  text: 'normal' | 'large' | 'larger'
  contrast: 'normal' | 'high'
  spacing: 'compact' | 'comfortable' | 'wide'
}
const defaults: Preferences = { motion: 'system', autoplay: true, text: 'normal', contrast: 'normal', spacing: 'comfortable' }
const key = 'arreglos-preferences-v1'
function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}')
    return {
      motion: ['system', 'full', 'reduced'].includes(saved.motion) ? saved.motion : defaults.motion,
      autoplay: typeof saved.autoplay === 'boolean' ? saved.autoplay : defaults.autoplay,
      text: ['normal', 'large', 'larger'].includes(saved.text) ? saved.text : defaults.text,
      contrast: ['normal', 'high'].includes(saved.contrast) ? saved.contrast : defaults.contrast,
      spacing: ['compact', 'comfortable', 'wide'].includes(saved.spacing) ? saved.spacing : defaults.spacing,
    }
  } catch { return { ...defaults } }
}
const AccessibilityContext = createContext<{
  preferences: Preferences
  reducedMotion: boolean
  update: (change: Partial<Preferences>) => void
  reset: () => void
} | null>(null)

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readPreferences)
  const [systemReduced, setSystemReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const update = () => setSystemReduced(media?.matches ?? false)
    media?.addEventListener('change', update)
    return () => media?.removeEventListener('change', update)
  }, [])
  const reducedMotion = preferences.motion === 'reduced' || (preferences.motion === 'system' && systemReduced)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.motion = reducedMotion ? 'reduced' : 'full'
    root.dataset.contrast = preferences.contrast
    root.style.setProperty('--text-scale', { normal: '1', large: '1.15', larger: '1.3' }[preferences.text])
    root.style.setProperty('--code-line-height', { compact: '1.8', comfortable: '2.6', wide: '3.1' }[preferences.spacing])
    try { localStorage.setItem(key, JSON.stringify(preferences)) } catch { /* La aplicación sigue funcionando sin almacenamiento. */ }
    return () => {
      delete root.dataset.motion; delete root.dataset.contrast
      root.style.removeProperty('--text-scale'); root.style.removeProperty('--code-line-height')
    }
  }, [preferences, reducedMotion])
  return <AccessibilityContext.Provider value={{ preferences, reducedMotion, update: change => { setPreferences(p => ({ ...p, ...change })); signal('accessibility_change', JSON.stringify(change)) }, reset: () => { setPreferences({ ...defaults }); signal('accessibility_reset') } }}>{children}</AccessibilityContext.Provider>
}
export function useAccessibility() {
  const context = useContext(AccessibilityContext)
  if (!context) throw new Error('Se requiere AccessibilityProvider')
  return context
}
export function AccessibilitySettings() {
  const { preferences, reducedMotion, update, reset } = useAccessibility()
  return <div className="accessibility-settings">
    <p className="muted">Personaliza la lectura y el movimiento. Tus preferencias se conservan en este navegador.</p>
    <label>Animaciones y transiciones<select value={preferences.motion} onChange={e => update({ motion: e.target.value as Preferences['motion'] })}>
      <option value="system">Usar preferencia del sistema</option><option value="full">Activadas</option><option value="reduced">Reducidas</option>
    </select></label>
    <p className="preference-status" role="status">{reducedMotion ? 'Movimiento reducido: sin animaciones decorativas ni recorrido automático.' : 'Animaciones activas en tarjetas, botones y cambios del arreglo.'}</p>
    <label className="preference-checkbox"><input type="checkbox" checked={preferences.autoplay} onChange={e => update({ autoplay: e.target.checked })} />Recorrido automático en Inicio</label>
    <label>Tamaño del texto<select value={preferences.text} onChange={e => update({ text: e.target.value as Preferences['text'] })}>
      <option value="normal">Normal (100 %)</option><option value="large">Grande (115 %)</option><option value="larger">Muy grande (130 %)</option>
    </select></label>
    <label>Separación entre líneas de código<select value={preferences.spacing} onChange={e => update({ spacing: e.target.value as Preferences['spacing'] })}>
      <option value="compact">Compacta</option><option value="comfortable">Cómoda</option><option value="wide">Amplia</option>
    </select></label>
    <label>Contraste<select value={preferences.contrast} onChange={e => update({ contrast: e.target.value as Preferences['contrast'] })}>
      <option value="normal">Original</option><option value="high">Alto contraste</option>
    </select></label>
    <button className="button secondary" onClick={reset}>Restablecer preferencias</button>
  </div>
}
