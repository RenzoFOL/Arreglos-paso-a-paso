import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Laboratory from '../../src/Laboratory'
import { AccessibilityProvider } from '../../src/Accessibility'

vi.mock('../../src/CodeEditor', () => ({ default: ({ source, onChange }: { source: string; onChange: (value: string) => void }) => <textarea aria-label="Código Python" value={source} onChange={e => onChange(e.target.value)} /> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear() })
it('ampliar y restaurar conserva código, paso y motor de ejecución', async () => {
  const terminate = vi.fn(), run = vi.fn()
  const frame = (line: number | null, nextLine: number | null, variables: object) => ({ line, nextLine, variables, aliases: {}, output: '', elapsedMs: 1 })
  class FakeWorker {
    onmessage: ((event: { data: object }) => void) | null = null
    terminate = terminate
    postMessage(data: { type: string }) {
      if (data.type === 'run') run()
      queueMicrotask(() => this.onmessage?.({ data: data.type === 'boot' ? { type: 'ready' } : { type: 'result', durationMs: 2, frames: [frame(null, 1, {}), frame(1, 2, { valores: [1, 2] }), frame(2, null, { valores: [1, 9] })] } }))
    }
  }
  vi.stubGlobal('Worker', FakeWorker)
  render(<AccessibilityProvider><Laboratory /></AccessibilityProvider>)
  const source = 'valores = [1, 2]\nvalores[1] = 9'
  fireEvent.change(screen.getByLabelText('Código Python'), { target: { value: source } })
  await waitFor(() => expect((screen.getByRole('button', { name: 'Ejecutar código' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: 'Ejecutar código' }))
  await screen.findByText('Traza lista')
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente paso' }))
  expect(screen.getByText('Paso 2 de 3')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Ampliar editor a todo el ancho' }))
  expect(screen.getByRole('button', { name: 'Restaurar editor en columnas' }).getAttribute('aria-pressed')).toBe('true')
  expect((screen.getByLabelText('Código Python') as HTMLTextAreaElement).value).toBe(source)
  expect(screen.getByText('Paso 2 de 3')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Restaurar editor en columnas' }))
  expect(screen.getByText('Paso 2 de 3')).toBeTruthy()
  expect(run).toHaveBeenCalledTimes(1)
  expect(terminate).not.toHaveBeenCalled()
})
