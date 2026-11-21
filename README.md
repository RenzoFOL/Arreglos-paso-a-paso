# Arreglos paso a paso

Primera versión funcional de una herramienta web para visualizar listas de Python, explorar ejemplos y resolver ejercicios. Basada en el prototipo navegable y los hallazgos formativos de la sesión 3. La evaluación se centra en la interacción; estos registros no demuestran aprendizaje.

## Estructura y arquitectura

- `frontend/`: React, TypeScript, Vite, CodeMirror 6 y Pyodide 314.0.8.
- `back/`: FastAPI, diez ejercicios en JSON y exportación XLSX opcional.
- Dos servicios por entorno y cuatro Dockerfiles: frontend/back, local/producción.
- Sin base de datos, cuentas, historial remoto ni ejecución de código del alumno en el servidor.
- Python corre en un Web Worker con recursos incluidos en el frontend. No requiere un CDN al usar la aplicación. `npm ci` y las imágenes iniciales sí requieren acceso a sus registros.

## Ejecutar con Docker

Instalar Docker Desktop con WSL 2 en Windows y ejecutar desde la raíz:

```bash
docker compose -f compose.local.yml up --build
```

Abrir `http://localhost:5173`. API y documentación: `http://localhost:8000/docs`. Este entorno activa evaluación y recarga de código. Se montan las carpetas fuente, sin ocultar las dependencias ni los recursos de Python instalados en la imagen.

Para probar las imágenes de producción, sin instrumentación:

```bash
docker compose -f compose.prod.yml up --build -d
```

Abrir `http://localhost:8080`. Para probar producción con evaluación, copiar `.env.example` como `.env`, descomentar `BUILD_MODE=study` y `STUDY_MODE=true`, y reconstruir. No basta cambiar una variable al arrancar: el modo del frontend se decide al compilar.

Para detener, usar `docker compose -f compose.local.yml down` o el archivo de producción correspondiente. No hay volúmenes de datos de estudiantes.

## Ejecutar sin Docker

Requisitos: Node 22.12 o posterior y Python 3.12.

Terminal 1, desde `back/`:

```bash
python -m venv .venv
# Windows PowerShell: .venv\Scripts\Activate.ps1
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
# Para exportar Excel en pruebas:
# PowerShell: $env:STUDY_MODE="true"
# Linux/macOS: export STUDY_MODE=true
uvicorn app.main:app --reload --port 8000
```

Terminal 2, desde `frontend/`:

```bash
npm ci
npm run dev -- --mode study
```

La interfaz estará en `http://localhost:5173`. Vite envía `/api` al puerto 8000. `npm run dev` usa la versión normal. Los recursos de Python se copian automáticamente en `postinstall`; no se incluyen en git.

## Uso del laboratorio

1. En **Ejemplos**, elegir uno de los cuatro casos. En **Laboratorio**, modificar directamente el código en CodeMirror; el laboratorio ya no tiene pestañas de casos.
2. Pulsar **Ejecutar código**. Se calcula la traza completa del código real.
3. Consultar el estado inicial y avanzar por los estados posteriores a cada línea. Cada paso indica la línea ejecutada y la siguiente, si existe.
4. Comparar los valores modificados, las referencias compartidas y la salida acumulada en ese momento.
5. Usar Anterior, Siguiente, Reproducir, Pausar o el selector de paso para revisar la traza. Retroceder consulta un estado guardado; no deshace la ejecución del motor.
6. En el laboratorio, desplegar **Consola interactiva** dentro de **Estado del arreglo** para consultar y modificar las variables de la última ejecución. Usa el editor para bloques de varias líneas. Ejecutar el editor empieza un contexto limpio; la consola lo conserva entre instrucciones.

La lectura va de izquierda a derecha: **Código Python → Operación actual → Estado del arreglo**. Los tres paneles tienen la misma altura en escritorio y se reorganizan en pantallas estrechas. Ejemplos y Laboratorio comparten un interlineado de 2.6 (36.4 px con fuente de 14 px).

La barra de ruta aparece al final de todos los módulos, indica la sección actual y ofrece el siguiente destino sin imponer un orden. En Inicio, la tarjeta del arreglo recorre sus cuatro posiciones cada 1.6 segundos; permite pausar o seleccionar un valor. Se detiene al salir de Inicio y respeta `prefers-reduced-motion`. Ayuda / Glosario usa un acento naranja y los controles tienen respuestas suaves al pasar el mouse y al enfocarlos con teclado.

Se admiten listas, escalares, condiciones, ciclos y operaciones básicas. Esta versión no admite módulos ni funciones/clases propias. La estructura utilizada es `list` de Python; no se presenta como un arreglo de tamaño fijo. Los límites son 200 líneas, 10 000 caracteres de código/salida, 1500 eventos de seguimiento y 3 s entre eventos; un vigilante externo termina el worker después de 8 s. No hay una cuota estricta de memoria por programa. Se visualizan hasta 30 variables y los primeros 100 elementos de cada lista.

La traza usa `sys.settrace`; la consola se basa en `pyodide.console.Console`. El tiempo incluye instrumentación y no representa un benchmark del lenguaje. Los límites sintácticos son de alcance didáctico; no deben reutilizarse como sandbox para ejecutar código en un servidor.

El código, progreso y estados se conservan al cambiar entre secciones durante la página abierta. Recargar la página reinicia el trabajo educativo. El respaldo temporal de evaluación conserva eventos, no el código del estudiante.

## Correcciones de interacción

| Evidencia | Implementación |
| --- | --- |
| FC01 | Conceptos con índice/valor, representación visual y ayuda contextual |
| FC07 | Entrada explícita «Ejemplo con error», separada de ejecutar |
| FC05 | Entrada «Recorrer un arreglo» |
| R01 | Resultado textual, acción de reintento o continuación |
| N01 | Enlace teoría–ejemplo y retorno conservando estado |
| Clics en espacios de tarjetas | Una sola superficie pulsable por tarjeta; icono, texto y fondo comparten destino |
| Expectativa de respuesta antes del clic | Hover, foco y presión; sección seleccionada persistente; movimiento reducido |

La paleta conserva fondo claro y azul; el naranja moderado señala el estado observado. El color se acompaña con texto. No se atribuye consenso a comentarios individuales sobre colores.

## Protocolo del modo de evaluación

Solo se incluye con `npm run build:study` o `--mode study`. En la versión normal no se importa el módulo de registro. FastAPI expone exportación XLSX únicamente con `STUDY_MODE=true`; no acepta ni guarda sesiones en la versión normal.

1. Abrir **Evaluación**. Usar un código como P01 y confirmar el consentimiento ya informado al participante. La casilla no sustituye el documento de consentimiento.
2. Preparar la pantalla y la consigna antes de armar cada tarea.
3. Indicar un código único (FC01, N01, R01…). **Preparar tarea y cerrar panel** registra el momento de habilitación. El inicio se fija en el primer movimiento de puntero o interacción de teclado/clic fuera de las herramientas.
4. El primer clic, los posteriores y la región de la tarjeta se conservan. Los controles del observador se excluyen de la captura. Los movimientos se muestrean cada 150 ms y el desplazamiento cada 250 ms. No se guarda texto escrito en el editor, video, audio ni contraseñas.
5. Al terminar, abrir las herramientas y clasificar la tarea. El fin se marca al pulsar **Terminar tarea**, por lo que puede incluir la demora del observador. Ajustarlo con el video en el análisis cuando corresponda. Nunca se interpreta inmovilidad como abandono automático.
6. Anotar ayuda, incidentes, localización sin pulsación y rutas alternativas. El sistema no decide éxito por el destino de un clic; la clasificación corresponde al observador y al protocolo.
7. Pausar explícitamente ante interrupciones. La pérdida de visibilidad se registra, pero no descuenta tiempo automáticamente.
8. Finalizar y descargar JSON completo. CSV y XLSX son complementos. El JSON conserva los eventos y esquemas para mapas; Excel incluye metadatos, tareas y eventos tabulados.
9. Eliminar la copia temporal antes de otro participante.

| Código | Uso |
| --- | --- |
| A | Primer clic aceptado |
| AU | Objetivo completado sin ayuda |
| N | Primer clic no favorable |
| NC | Intento evaluable sin cumplir el objetivo |
| SC | Sin clic; documentar si no se realizó la tarea |
| NE | No evaluable; registrar motivo |

Los resúmenes excluyen SC y NE conforme al criterio usado en la sesión 3. En esta implementación una identificación verbal sin clic requiere anotación del observador, no un evento de clic inventado. Definir previamente por tarea objetivo, rutas alternativas, ayuda permitida y criterio final. No comparar automáticamente tiempos de cohortes o consignas diferentes.

La copia temporal usa `sessionStorage`, solo en la pestaña de evaluación y después del consentimiento. Sobrevive a una recarga habitual, pero no garantiza recuperación al cerrar pestaña/navegador. No hay envío automático al servidor. Excel se procesa transitoriamente en FastAPI al solicitarlo, sin escritura de sesiones a disco. El navegador avisa si se intenta salir durante el registro y notifica errores de respaldo. Exportar después de cada participante; el límite es 30 000 eventos por sesión.

## Analizar resultados

En **Analizar archivos**, importar uno o varios JSON, o cargar una copia de la sesión actual. Filtrar participante y tarea. La tabla separa resultados, intentos excluidos y pendientes por tarea, sin una puntuación global mezclando pruebas distintas.

Se muestran tiempo total, tiempo sin pausas explícitas, clics y primer destino. Las correcciones de inicio/fin se indican en segundos desde el inicio de la sesión; se guardan en campos separados. Descargar el JSON anotado para conservarlas. No se modifica el archivo importado ni la captura original.

Los mapas muestran clics sobre un **esquema de los controles visibles**, no sobre una captura fotográfica. Agrupan versión, pantalla, estado, tamaño de ventana y desplazamiento; el rojo indica superposición de clics, no atención visual. Las activaciones de teclado se conservan como eventos, pero se excluyen del mapa de puntero. Hay filtro de primer clic y exportación PNG. La línea temporal incluye navegación, ayudas, desplazamiento y acciones del laboratorio. No existe reproducción de video ni seguimiento ocular.

## Publicación

### Proveedor que acepta Docker

Crear dos servicios desde este repositorio:

| Servicio | Contexto | Dockerfile | Configuración |
| --- | --- | --- | --- |
| API | `back` | `Dockerfile.prod` | `PORT` asignado por proveedor; `STUDY_MODE` según versión |
| Frontend | `frontend` | `Dockerfile.prod` | `PORT`; `API_UPSTREAM` con URL completa de la API |

El frontend sirve estáticos y reenvía `/api` con nginx; ese proxy evita requerir CORS entre navegador y API. `API_UPSTREAM` debe ser un origen, sin `/api` final. Para instrumentación compilar con argumento `BUILD_MODE=study`. No se requiere volumen persistente.

En Heroku, construir la imagen con `docker build -f Dockerfile.prod` desde cada contexto y usar el registro de contenedores para cada aplicación `web`. El proceso escucha `$PORT`. Los comandos de autenticación, nombres de aplicaciones y planes dependen de la cuenta; no están configurados ni publicados en esta entrega.

### Frontend en Vercel + FastAPI en otro servicio

Importar el repositorio, Root Directory `frontend`, instalar con `npm ci`, construir con `npm run build` y servir `dist`. Configurar `VITE_API_URL=https://ORIGEN-DE-LA-API` antes de compilar. En FastAPI, `CORS_ORIGINS=https://ORIGEN-DEL-FRONTEND`, sin barra final. Para evaluación usar `npm run build:study` y `STUDY_MODE=true` en la API. No subir Docker Compose a Vercel: esta ruta publica el frontend estático.

No se incluyen secretos ni resultados de participantes. Para las pruebas moderadas conviene el entorno local: no requiere publicar las herramientas de evaluación.

## Verificación

Desde `back`: `python -m unittest discover -s tests`.

Desde `frontend`:

```bash
npm test
npm run test:components
npm run build
npm run build:study
npx playwright install chromium
npm run test:e2e
```

Las pruebas del motor usan el mismo Pyodide y el mismo `tracer.py`. Playwright recorre tarjetas, práctica, laboratorio y una sesión de evaluación con exportación. La integración continua construye ambas variantes, prueba API y navegador y construye los cuatro Dockerfiles. Consultar `VALIDACION.md` para distinguir comprobaciones ejecutadas de las que requieren otro entorno.
