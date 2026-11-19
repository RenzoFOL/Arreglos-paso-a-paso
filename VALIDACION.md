# Estado de verificación — 18 de noviembre de 2026

Esta es una primera implementación funcional. No se declara validada con participantes ni lista para una sesión formal sin piloto.

| Comprobación ejecutada | Resultado |
| --- | --- |
| TypeScript y compilación Vite normal | Correctos |
| TypeScript y compilación Vite de estudio | Correctos |
| Exclusión del módulo de captura/panel en los JS normales | Verificada |
| Ruta de exportación ausente en FastAPI normal | Verificada: 404 |
| 5 pruebas del motor y métricas con Pyodide real | Correctas |
| 5 pruebas de componentes e instrumentación en DOM simulado | Correctas |
| 4 pruebas de API y Excel | Correctas |

Las pruebas del motor comprueban estados posteriores a cada línea, referencias compartidas, consola persistente, salida, recorridos, errores de índice/sintaxis, límites de ejecución y tiempos con pausas.

Las pruebas de componentes comprueban clic en el fondo de la tarjeta, conservación del progreso al cambiar de sección, recuperación ante error de API, consentimiento, inicio de tarea, primer clic, navegación registrada, cierre de tarea/sesión y exclusión de controles del observador. No sustituyen una revisión visual: el laboratorio se prueba separadamente con Pyodide real y las llamadas de red de esos componentes usan respuestas controladas.

Las pruebas de API comprueban las 30 combinaciones de respuesta de los diez ejercicios, validación de entradas, omisión de respuestas en el catálogo y un Excel que conserva las notas como texto (sin ejecutarlas como fórmulas).

## Comprobaciones preparadas, todavía pendientes en navegador y Docker

- Playwright incluye tres recorridos completos: tarjetas/práctica, worker/consola y sesión con JSON/PNG. Se intentaron ejecutar, pero Chromium no pudo iniciar en el entorno de desarrollo: `socket() failed: Operation not permitted`. La descarga de su navegador empaquetado también falló. No se presentan estas pruebas como aprobadas.
- Docker no está instalado en este entorno. Los cuatro Dockerfiles y los dos Compose están preparados; su construcción y arranque quedan pendientes. El workflow de GitHub incluye esas comprobaciones y una solicitud a `/api/health` a través del proxy de producción.
- Falta revisar visualmente el diseño a 1366×768, 1920×1080 y ancho reducido, el contraste efectivo, el foco, las transiciones y las descargas reales.
- Falta el piloto moderado: contrastar el intervalo capturado con un video y comprobar recuperación tras recarga, clasificación, JSON, CSV, Excel y mapas. Los mapas usan un esquema de controles, no capturas de pantalla.

## Límites conocidos

- La copia temporal de evaluación está en la pestaña y no sustituye descargar cada sesión.
- Terminar una tarea requiere al observador; el tiempo puede ajustarse al video sin borrar la marca original.
- El motor registra trazas para reproducción posterior; no es un depurador con pausa real en cada línea.
- Sin cuota estricta de memoria por programa. El motor limita pasos/salida/tiempo, y el worker puede terminarse.
- El seguimiento y la captura de variables agregan coste a la ejecución; no usar sus tiempos para comparar rendimiento de Python.
- No se ha publicado ni configurado un servicio externo de hosting.
