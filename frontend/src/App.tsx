import { useEffect, useRef, useState } from "react"
import Laboratory, { EditableExamples } from "./Laboratory"
import { api } from "./api"
import { signal } from "./events"

type Module = "Inicio" | "Teoría" | "Ejemplos" | "Laboratorio" | "Práctica"
type Scenario = "Modificar" | "Consultar" | "Recorrer" | "Caso con error"
const modules: Module[] = [
  "Inicio",
  "Teoría",
  "Ejemplos",
  "Laboratorio",
  "Práctica",
]
const initial = [8, 4, 12, 6]
function Icon({ name = "arrow", size = 20 }: { name?: string; size?: number }) {
  const paths: Record<string, string> = {
    arrow: "M5 12h14m-5-5 5 5-5 5",
    book: "M12 6v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z",
    code: "m8 7-5 5 5 5m8-10 5 5-5 5m-3-12-2 14",
    lab: "M9 3h6m-5 0v7L4 20q-1 1 1 1h14q2 0 1-1l-6-10V3M8 14h8",
    practice: "M8 4H5v17h14V4h-3M8 3h8v4H8Zm0 11 3 3 5-6",
    help: "M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20",
    close: "m6 6 12 12M6 18 18 6",
    chevron: "m6 9 6 6 6-6",
    reset: "M3 10a9 9 0 1 1 2 8M3 4v6h6",
    check: "m5 12 4 4L19 6",
    info: "M12 11v6m0-10h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20",
    home: "m3 10 9-7 9 7v11h-6v-7H9v7H3Z",
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.arrow} />
    </svg>
  )
}
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
}: {
  children: React.ReactNode
  onClick: () => void
  secondary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      className={`button ${secondary ? "secondary" : "primary"}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}
function ArrayView({
  values,
  selected = -1,
  onSelect,
  modified = false,
  range = false,
}: {
  values: number[]
  selected?: number
  onSelect?: (i: number) => void
  modified?: boolean
  range?: boolean
}) {
  return (
    <div className="array-wrap">
      <div className="array-grid">
        <div className="row-label">ÍNDICE</div>
        {values.map((_, i) => (
          <button
            key={`i${i}`}
            onClick={() => onSelect?.(i)}
            disabled={!onSelect}
            aria-label={`Índice ${i}, valor ${values[i]}`}
            className={`index-cell ${i === selected ? "selected" : ""} ${
              range ? "range" : ""
            }`}
          >
            {i}
          </button>
        ))}
        <div className="row-label">VALOR</div>
        {values.map((v, i) => (
          <button
            key={i}
            onClick={() => onSelect?.(i)}
            disabled={!onSelect}
            aria-label={`Valor ${v} en índice ${i}`}
            className={`value-cell ${
              i === selected ? `selected ${modified ? "modified" : ""}` : ""
            }`}
          >
            {v}
            {i === selected && (
              <span className="cell-mark">{modified ? "✓" : "↑"}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
const descriptions = [
  "Revisa qué son índice, valor y recorrido.",
  "Observa cómo una instrucción se relaciona con los cambios en un arreglo.",
  "Escribe Python y observa el estado de tus arreglos.",
  "Intenta un reto y comprueba qué ocurre.",
]
const concepts = [
  [
    "¿Qué es un arreglo?",
    "Un arreglo reúne varios valores bajo un mismo nombre. Aquí lo representamos con la estructura list de Python y contiene cuatro valores.",
  ],
  [
    "¿Qué son índice y valor?",
    "El índice indica la posición. En Python las posiciones comienzan en 0; el valor es el contenido de esa posición.",
  ],
  [
    "¿Cómo se consulta un elemento?",
    "valores[2] consulta el contenido de la posición 2. En este ejemplo es 12; consultar no cambia el arreglo.",
  ],
  [
    "¿Cómo se modifica un valor?",
    "valores[2] = 20 sustituye el contenido de la posición 2. El valor 12 pasa a ser 20.",
  ],
  [
    "¿Qué significa recorrer un arreglo?",
    "Recorrer un arreglo consiste en visitar sucesivamente sus elementos. Un for puede hacerlo de izquierda a derecha.",
  ],
]
function Theory({
  openExample,
  startConcept = 0,
}: {
  openExample: (s: Scenario) => void
  startConcept?: number
}) {
  const [concept, setConcept] = useState(startConcept)
  useEffect(() => { setConcept(startConcept) }, [startConcept])
  const [selection, setSelection] = useState(-1)
  const highlight =
    selection >= 0 ? selection : concept === 2 ? 2 : concept === 4 ? 0 : -1
  return (
    <>
      <div data-study-state={`theory:${concept}:${selection}`} />
      <PageTitle
        eyebrow="COMPRENDE LOS CONCEPTOS"
        title="Teoría"
        subtitle="Consulta un concepto y obsérvalo sobre el arreglo."
      />
      <div className="two-columns theory">
        <section className="panel">
          <div className="panel-heading">
            <Icon name="book" />
            <h2>Conceptos básicos</h2>
          </div>
          {concepts.map(([title, text], i) => (
            <div
              className={`accordion ${concept === i ? "open" : ""}`}
              key={title}
            >
              <button
                aria-expanded={concept === i}
                onClick={() => setConcept(concept === i ? -1 : i)}
              >
                <span className="concept-number">0{i + 1}</span>
                {title}
                <Icon name="chevron" />
              </button>
              {concept === i && (
                <div className="accordion-content">
                  <p>{text}</p>
                  {i >= 2 && (
                    <button
                      className="text-link"
                      onClick={() =>
                        openExample(
                          i === 2
                            ? "Consultar"
                            : i === 3
                              ? "Modificar"
                              : "Recorrer",
                        )
                      }
                    >
                      {i === 2
                        ? "Ver ejemplo de consulta"
                        : i === 3
                          ? "Ver ejemplo de modificación"
                          : "Ver recorrido paso a paso"}
                      <Icon />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
        <section className="panel representation">
          <div className="panel-heading">
            <Icon name="code" />
            <h2>Representación del arreglo</h2>
          </div>
          <div className="code-inline">valores = [8, 4, 12, 6]</div>
          <ArrayView
            values={initial}
            selected={highlight}
            onSelect={setSelection}
          />
          <div className="notice">
            <Icon name="info" />
            <p>
              {selection >= 0
                ? `Índice seleccionado: ${selection} · Valor almacenado: ${initial[selection]}`
                : concept === 2
                  ? "Consulta: 12 · El arreglo no cambia."
                  : "Selecciona una posición para ver su índice y su valor."}
            </p>
          </div>
          <div className="representation-note">
            <span className="tiny-dot" />
            Las posiciones empiezan en 0, no en 1.
          </div>
        </section>
      </div>
    </>
  )
}
function PageTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle: string
}) {
  return (
    <div className="page-title">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  )
}
type PracticeExercise = {
  category: string
  title: string
  instruction: string
  code: string
  options: string[]
  id: string
  explanation?: string
  hint: string
  values: number[]
  result?: number[]
  selected?: number
  modified?: boolean
  related: Scenario
}



function Practice({ openExample }: { openExample: (s: Scenario) => void }) {
  const [practiceExercises, setExercises] = useState<PracticeExercise[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [answer, setAnswer] = useState<{success:boolean; explanation:string; result:number[]} | null>(null)
  const load = () => { setLoading(true); setError(""); api<PracticeExercise[]>("/exercises").then(setExercises).catch(e => setError(e.message)).finally(() => setLoading(false)) }
  useEffect(load, [])
  const [exerciseIndex, setExerciseIndex] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const [hint, setHint] = useState(false)
  const [completed, setCompleted] = useState<boolean[]>(() =>
    Array(10).fill(false),
  )
  const exercise = practiceExercises[exerciseIndex]
  const success = checked && answer?.success === true
  const resetResponse = () => {
    setChoice(null)
    setChecked(false)
    setHint(false)
    setAnswer(null)
    setError("")
  }
  const goToExercise = (index: number) => {
    signal("practice_continue", String(index+1))
    setExerciseIndex(index)
    resetResponse()
  }
  const checkResponse = async () => {
    if (choice === null || checking) return
    setChecking(true); setError("")
    try {
      const result = await api<{success:boolean;explanation:string;result:number[]}>(`/exercises/${exercise.id}/check`, { choice })
      setAnswer(result); setChecked(true)
      signal("practice_checked", `${exercise.id}:${result.success ? "correct" : "incorrect"}`)
      if (result.success) setCompleted(current => current.map((value,index) => index === exerciseIndex ? true : value))
    } catch (e) { setError((e as Error).message) } finally { setChecking(false) }
  }
  if (loading) return <p role="status">Cargando ejercicios…</p>
  if (!exercise) return <section className="feedback error"><p>{error || "No hay ejercicios disponibles."}</p><button className="button primary" onClick={load}>Reintentar carga</button></section>
  return (
    <>
      <div data-study-state={`practice:${exerciseIndex}:${choice}:${checked}:${hint}`} />
      {error && <p className="feedback error" role="alert">{error}</p>}
      <PageTitle
        eyebrow="OBSERVA, ELIGE Y COMPRUEBA"
        title="Práctica con arreglos"
        subtitle="Resuelve 10 ejercicios. Recuerda: el índice identifica una posición; lo que puede cambiar es el valor almacenado en ella."
      />
      <section
        className="exercise-navigation"
        aria-label="Seleccionar ejercicio"
      >
        <div>
          <span className="small-label">TU PROGRESO</span>
          <strong>{completed.filter(Boolean).length} de 10 completados</strong>
        </div>
        <div className="exercise-progress">
          {practiceExercises.map((item, index) => (
            <button
              key={item.title}
              className={`${index === exerciseIndex ? "active" : ""} ${
                completed[index] ? "completed" : ""
              }`}
              disabled={checking}
              onClick={() => { signal("practice_select", String(index+1)); goToExercise(index) }}
              aria-label={`Ejercicio ${index + 1}: ${item.title}${
                completed[index] ? ", completado" : ""
              }`}
            >
              {completed[index] ? "✓" : index + 1}
            </button>
          ))}
        </div>
      </section>
      <div className="two-columns practice">
        <section className="panel practice-task">
          <div className="task-label">
            <Icon name="practice" />
            EJERCICIO {exerciseIndex + 1} DE 10 ·{" "}
            {exercise.category.toUpperCase()}
          </div>
          <h2>{exercise.title}</h2>
          <p className="practice-instruction">{exercise.instruction}</p>
          <pre className="code-inline">{exercise.code}</pre>
          <p className="option-label">Selecciona una respuesta:</p>
          <div
            className="options"
            role="radiogroup"
            aria-label={`Respuestas del ejercicio ${exerciseIndex + 1}`}
          >
            {exercise.options.map((option, index) => (
              <button
                role="radio"
                aria-checked={choice === index}
                tabIndex={choice === index || (choice === null && index === 0) ? 0 : -1}
                onKeyDown={event => {
                  if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return
                  event.preventDefault()
                  const next = (index + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : exercise.options.length - 1)) % exercise.options.length
                  setChoice(next); setChecked(false)
                  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button")
                  buttons?.[next]?.focus()
                }}
                className={choice === index ? "selected" : ""}
                key={option}
                disabled={success || checking}
                onClick={() => {
                  setChoice(index)
                  setChecked(false)
                }}
              >
                <span className="radio-dot" />
                <code>{option}</code>
                <span className="option-letter">
                  {String.fromCharCode(65 + index)}
                </span>
              </button>
            ))}
          </div>
          <div className="practice-actions">
            <Button
              disabled={choice === null || success || checking}
              onClick={checkResponse}
            >
              {checking ? "Comprobando…" : "Comprobar respuesta"}
              <Icon name="check" />
            </Button>
            <Button secondary disabled={checking} onClick={() => { if (window.confirm("¿Reiniciar la respuesta de este ejercicio?")) { resetResponse(); signal("practice_reset") } }}>
              <Icon name="reset" />
              Reiniciar ejercicio
            </Button>
          </div>
          {choice === null && (
            <p className="muted small">
              Elige una opción para habilitar la comprobación.
            </p>
          )}
        </section>
        <div className="practice-right">
          <section className="panel practice-state">
            <div className="panel-heading">
              <span className="list-icon">[ ]</span>
              <h2>
                {success
                  ? "Resultado del arreglo"
                  : "Arreglo antes de ejecutar"}
              </h2>
            </div>
            <ArrayView
              values={success ? answer!.result : exercise.values}
              selected={success ? (exercise.selected ?? -1) : -1}
              modified={success && exercise.modified}
            />
            <p className="muted small">
              {success
                ? answer?.explanation
                : "Comprueba tu respuesta para ver el resultado explicado."}
            </p>
          </section>
          <section className="panel hint-panel">
            <div>
              <Icon name="help" />
              <h3>¿Necesitas apoyo?</h3>
            </div>
            {hint && <p>{exercise.hint}</p>}
            <button className="text-link" onClick={() => { setHint(!hint); signal("practice_hint", String(exerciseIndex+1)) }}>
              {hint ? "Ocultar pista" : "Ver pista"}
              <Icon />
            </button>
          </section>
          {checked ? (
            <section
              className={`feedback ${success ? "success" : "error"}`}
              aria-live="polite"
            >
              <strong>
                <Icon name={success ? "check" : "info"} />
                {success ? "Respuesta correcta" : "Revisa tu respuesta"}
              </strong>
              <p>
                {success
                  ? answer?.explanation
                  : `La opción elegida no corresponde. ${exercise.hint}`}
              </p>
              {success ? (
                <>
                  <Button
                    secondary
                    onClick={() =>
                      goToExercise(
                        exerciseIndex === practiceExercises.length - 1
                          ? 0
                          : exerciseIndex + 1,
                      )
                    }
                  >
                    {exerciseIndex === practiceExercises.length - 1
                      ? "Volver al ejercicio 1"
                      : "Continuar al siguiente ejercicio"}
                    <Icon />
                  </Button>
                  <button
                    className="text-link"
                    onClick={() => openExample(exercise.related)}
                  >
                    Ver ejemplo relacionado
                    <Icon />
                  </button>
                </>
              ) : (
                <Button
                  secondary
                  onClick={() => {
                    setChoice(null)
                    setChecked(false)
                  }}
                >
                  Intentar de nuevo
                </Button>
              )}
            </section>
          ) : (
            <div className="feedback-placeholder">
              Aquí verás una explicación clara después de comprobar.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
function Modal({
  title,
  close,
  children,
}: {
  title: string
  close: () => void
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement
    ref.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
      if (e.key === "Tab") {
        const buttons = ref.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), [href], [tabindex='0']",
        )
        if (!buttons?.length) return
        const first = buttons[0],
          last = buttons[buttons.length - 1]
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener("keydown", handler)
    return () => {
      document.removeEventListener("keydown", handler)
      previous?.focus()
    }
  }, [])
  return (
    <div className="modal-backdrop" onClick={close}>
      <div
        className="modal"
        data-study-state={`dialog:${title}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-title">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label={`Cerrar ${
              title === "Ayuda rápida" ? "ayuda" : "comparación"
            }`}
            onClick={close}
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
export default function App() {
  const [module, setModule] = useState<Module>("Inicio")
  const [visited, setVisited] = useState<Module[]>(["Inicio"])
  const [returnTo, setReturnTo] = useState<Module>("Teoría")
  const [example, setExample] = useState<Scenario>("Modificar")
  const [concept, setConcept] = useState(0)
  const [help, setHelp] = useState(false)
  const go = (m: Module) => {
    setModule(m)
    setVisited(v => v.includes(m) ? v : [...v, m])
    signal("navigate", m)
    setHelp(false)
    window.scrollTo(0, 0)
  }
  const openExample = (s: Scenario) => {
    setReturnTo(module)
    go("Ejemplos")
    setExample(s)
  }
  return (
    <div className="app">
      <header className="app-header">
        <button className="brand" onClick={() => go("Inicio")}>
          <span className="brand-icon">
            <Icon name="code" size={23} />
          </span>
          Arreglos <span className="brand-light">paso a paso</span>
        </button>
        <nav aria-label="Navegación principal">
          {modules.map((m) => (
            <button
              className={module === m ? "active" : ""}
              aria-current={module === m ? "page" : undefined}
              data-study-id={`nav-${m}`}
              key={m}
              onClick={() => go(m)}
            >
              {m}
            </button>
          ))}
        </nav>
        <button className="help-button" onClick={() => { setHelp(true); signal("help_open") }}>
          <Icon name="help" />
          Ayuda / Glosario
        </button>
      </header>
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <main id="contenido" data-study-screen={module}>
        <div hidden={module !== "Inicio"}>
          <>
            <div className="home-hero">
              <div className="eyebrow">
                <span className="tiny-dot" />
                ARREGLOS EN PYTHON, PASO A PASO
              </div>
              <h1>
                Explora cómo funcionan
                <br />
                los arreglos en <span>Python</span>
              </h1>
              <p>Observa índices, valores y cambios paso a paso, a tu ritmo.</p>
              <div className="hero-buttons">
                <Button onClick={() => openExample("Modificar")}>
                  Ver un ejemplo
                  <Icon />
                </Button>
                <Button secondary onClick={() => go("Teoría")}>
                  <Icon name="book" />
                  Comenzar ruta sugerida
                </Button>
              </div>
              <div
                className="hero-array"
                aria-label="Ejemplo de arreglo: índices 0 a 3 y valores 8, 4, 12, 6"
              >
                <div className="hero-array-top">
                  <span className="code-file">
                    <Icon name="code" size={16} />
                    Un arreglo, cuatro posiciones
                  </span>
                  <span className="badge">Python</span>
                </div>
                <div className="hero-code">
                  valores = <span>[8, 4, 12, 6]</span>
                </div>
                <ArrayView values={initial} />
                <p>
                  <span className="tiny-dot" />
                  Cada índice señala un valor.
                </p>
              </div>
            </div>
            <div className="section-heading">
              <h2>¿Qué quieres explorar?</h2>
              <span>Elige un módulo. No necesitas seguir un orden.</span>
            </div>
            <div className="module-cards">
              {modules.slice(1).map((m, i) => (
                <button className="module-card" key={m} data-study-id={`card-${m}`} data-region="espacio" onClick={() => go(m)}>
                  <div data-region="icono" className={`module-icon icon-${i}`}>
                    <Icon
                      name={["book", "code", "lab", "practice"][i]}
                      size={25}
                    />
                  </div>
                  <div className="card-content">
                    <h2 data-region="titulo">{m}</h2>
                    <p data-region="descripcion">{descriptions[i]}</p>
                    <span className="text-link" data-region="enlace">
                      {
                        [
                          "Explorar conceptos",
                          "Ver ejemplos",
                          "Ir al laboratorio",
                          "Ir a práctica",
                        ][i]
                      }
                      <Icon />
                    </span>
                  </div>
                  <span className="card-number">0{i + 1}</span>
                </button>
              ))}
            </div>
            <section className="suggested-route">
              <div className="route-intro">
                <Icon name="info" />
                <div>
                  <h3>¿No sabes por dónde empezar?</h3>
                  <p>Esta ruta es una sugerencia. Tú eliges cómo explorar.</p>
                </div>
              </div>
              <div className="route-steps">
                {modules.slice(1).map((m, i) => (
                  <span key={m}>
                    <button onClick={() => go(m)}>
                      <span>{i + 1}</span>
                      {m}
                    </button>
                    {i < 3 && <Icon size={16} />}
                  </span>
                ))}
              </div>
              <button className="text-link" onClick={() => go("Teoría")}>
                Comenzar por Teoría
                <Icon />
              </button>
            </section>
          </>
        </div>
        <div hidden={module !== "Teoría"}>{visited.includes("Teoría") && <Theory openExample={openExample} startConcept={concept} />}</div>
        <div hidden={module !== "Práctica"}>{visited.includes("Práctica") && <Practice openExample={openExample} />}</div>
        <div hidden={module !== "Laboratorio"}>{visited.includes("Laboratorio") && <Laboratory />}</div>
        <div hidden={module !== "Ejemplos"}>{visited.includes("Ejemplos") && <><button className="text-link back-link" onClick={() => go(returnTo)}>← Volver a {returnTo}</button><EditableExamples initialExample={example} /></>}</div>
      </main>
      <footer>
        <span>
          Arreglos representados mediante la estructura list de Python.
        </span>
        <span>Explora a tu ritmo, sin crear una cuenta.</span>
      </footer>
      {help && (
        <Modal title="Ayuda rápida" close={() => setHelp(false)}>
          <p className="muted">Un glosario para acompañar tu exploración.</p>
          <dl>
            {[
              [
                "Arreglo",
                "Estructura que reúne elementos accesibles por su índice.",
              ],
              ["Índice", "Número que indica la posición, empezando en 0."],
              ["Valor", "Contenido de una posición."],
              ["Consultar", "Leer un valor sin modificar el arreglo."],
              ["Modificar", "Sustituir el valor de una posición."],
              ["Recorrer", "Visitar uno a uno los elementos."],
              ["Paso", "Momento de la demostración que estás observando."],
            ].map(([term, text]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
          <button
            className="text-link"
            onClick={() => {
              go("Teoría")
              setConcept(1)
            }}
          >
            Ver teoría sobre índices
            <Icon />
          </button>
          <Button onClick={() => setHelp(false)}>Volver a mi pantalla</Button>
        </Modal>
      )}
    </div>
  )
}
