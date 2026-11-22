import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { EditorView, Decoration } from '@codemirror/view'
import { EditorState, StateEffect, StateField, Compartment } from '@codemirror/state'
import { python } from '@codemirror/lang-python'
import { useAccessibility } from './Accessibility'
const highlight = StateEffect.define<number>()
const lineField = StateField.define({
  create: () => Decoration.none,
  update(value, tr) {
    value = value.map(tr.changes)
    for (const e of tr.effects) if (e.is(highlight)) {
      value = e.value > 0 && e.value <= tr.state.doc.lines ? Decoration.set([Decoration.line({ class: 'traced-line' }).range(tr.state.doc.line(e.value).from)]) : Decoration.none
    }
    return value
  },
  provide: field => EditorView.decorations.from(field),
})
export default function CodeEditor({ source, onChange, line, disabled }: { source: string; onChange: (s: string) => void; line: number; disabled: boolean }) {
  const { preferences } = useAccessibility()
  const host = useRef<HTMLDivElement>(null), view = useRef<EditorView | null>(null)
  const editable = useRef(new Compartment())
  const change = useRef(onChange); change.current = onChange
  useEffect(() => {
    view.current = new EditorView({ parent: host.current!, state: EditorState.create({ doc: source, extensions: [basicSetup, python(), lineField, editable.current.of(EditorState.readOnly.of(disabled)),
      EditorView.contentAttributes.of({ 'aria-label': 'Código Python', 'data-study-id': 'python-editor' }),
      EditorView.updateListener.of(update => { if (update.docChanged) change.current(update.state.doc.toString()) }),
      EditorView.theme({
        '&': { fontSize: 'calc(14px * var(--text-scale, 1))', height: '100%' },
        '.cm-content': { padding: '16px 0' },
        '.cm-scroller': { overflow: 'auto', lineHeight: 'var(--code-line-height, 2.6)' },
        '.cm-line': { padding: '0 16px' },
        '.cm-gutterElement': { padding: '0 8px' },
      }),
    ] }) })
    return () => { view.current?.destroy(); view.current = null }
  }, [])
  useEffect(() => { const v = view.current; if (v && v.state.doc.toString() !== source) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: source } }) }, [source])
  useEffect(() => {
    const editor = view.current
    if (!editor) return
    const effects: StateEffect<unknown>[] = [highlight.of(line)]
    if (line > 0 && line <= editor.state.doc.lines) effects.push(EditorView.scrollIntoView(editor.state.doc.line(line).from, { y: 'nearest', yMargin: 30 }))
    editor.dispatch({ effects })
  }, [line])
  useEffect(() => { view.current?.dispatch({ effects: editable.current.reconfigure(EditorState.readOnly.of(disabled)) }) }, [disabled])
  useEffect(() => { view.current?.requestMeasure() }, [preferences.text, preferences.spacing])
  return <div className={`code-editor ${disabled ? 'editor-busy' : ''}`} ref={host} />
}
