import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { EditorView, Decoration } from '@codemirror/view'
import { EditorState, StateEffect, StateField, Compartment } from '@codemirror/state'
import { python } from '@codemirror/lang-python'
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
  const host = useRef<HTMLDivElement>(null), view = useRef<EditorView | null>(null)
  const editable = useRef(new Compartment())
  const change = useRef(onChange); change.current = onChange
  useEffect(() => {
    view.current = new EditorView({ parent: host.current!, state: EditorState.create({ doc: source, extensions: [basicSetup, python(), lineField, editable.current.of(EditorState.readOnly.of(disabled)),
      EditorView.contentAttributes.of({ 'aria-label': 'Código Python', 'data-study-id': 'python-editor' }),
      EditorView.updateListener.of(update => { if (update.docChanged) change.current(update.state.doc.toString()) }),
      EditorView.theme({ '&': { fontSize: '14px' }, '.cm-content': { minHeight: '230px' }, '.cm-scroller': { overflow: 'auto' } }),
    ] }) })
    return () => { view.current?.destroy(); view.current = null }
  }, [])
  useEffect(() => { const v = view.current; if (v && v.state.doc.toString() !== source) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: source } }) }, [source])
  useEffect(() => { view.current?.dispatch({ effects: highlight.of(line) }) }, [line])
  useEffect(() => { view.current?.dispatch({ effects: editable.current.reconfigure(EditorState.readOnly.of(disabled)) }) }, [disabled])
  return <div className={`code-editor ${disabled ? 'editor-busy' : ''}`} ref={host} />
}
