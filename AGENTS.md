# Arreglos paso a paso

Frontend React/TypeScript en `frontend/`; API FastAPI sin base de datos en `back/`.
Conservar el nombre y el diseño claro del prototipo. Los requisitos de interacción están en README.md.
Nunca guardar registros de participantes, credenciales ni exportaciones en git.
La compilación normal debe excluir la captura de evaluación. La ejecución de código del alumno ocurre en Pyodide en un worker, nunca mediante exec en FastAPI.
Verificar frontend con npm run build y npm run build:study; API con python -m unittest discover -s tests desde back.
