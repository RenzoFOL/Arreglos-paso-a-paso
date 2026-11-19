"""API sin persistencia. Nunca ejecuta código recibido del navegador."""
import io
import json
import os
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, ConfigDict

EXERCISES = json.loads(Path(__file__).with_name('exercises.json').read_text())
app = FastAPI(title='Arreglos paso a paso', version='0.1.0')
app.add_middleware(CORSMiddleware, allow_origins=os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:8080').split(','), allow_methods=['GET', 'POST'], allow_headers=['Content-Type'])

@app.middleware('http')
async def limit_body(request: Request, call_next):
    if request.method == 'POST':
        chunks, size = [], 0
        async for chunk in request.stream():
            size += len(chunk)
            if size > 8_000_000:
                return JSONResponse({'detail': 'El archivo supera 8 MB; exporta sesiones individuales.'}, status_code=413)
            chunks.append(chunk)
        request._body = b''.join(chunks)
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    return response

@app.get('/api/health')
def health():
    return {'status': 'ok', 'version': '0.1.0'}

@app.get('/api/exercises')
def exercises():
    # La respuesta y su explicación se entregan al comprobar.
    return [{k: v for k, v in item.items() if k not in ('correct', 'result', 'explanation')} for item in EXERCISES]

class Answer(BaseModel):
    model_config = ConfigDict(extra='forbid')
    choice: int = Field(ge=0, le=2, strict=True)

@app.post('/api/exercises/{exercise_id}/check')
def check(exercise_id: str, answer: Answer):
    exercise = next((e for e in EXERCISES if e['id'] == exercise_id), None)
    if exercise is None:
        raise HTTPException(404, 'Ejercicio no encontrado')
    success = answer.choice == exercise['correct']
    return {'success': success, 'explanation': exercise['explanation'] if success else 'Revisa tu respuesta. ' + exercise['hint'], 'result': exercise['result'] if success else exercise['values']}

class Event(BaseModel):
    model_config = ConfigDict(extra='ignore')
    seq: int = Field(ge=0)
    t: float = Field(ge=0, allow_inf_nan=False)
    type: str = Field(max_length=80)
    task: str | None = Field(default=None, max_length=80)
    route: str = Field(max_length=100)
    state: str = Field(default='', max_length=500)
    target: str = Field(default='', max_length=200)
    region: str = Field(default='', max_length=80)
    x: float | None = None
    y: float | None = None
    width: int = Field(default=0, ge=0, le=30000)
    height: int = Field(default=0, ge=0, le=30000)
    scrollY: float = 0
    detail: str = Field(default='', max_length=3000)

class Task(BaseModel):
    id: str = Field(max_length=80)
    prepared: float
    start: float | None = None
    end: float | None = None
    result: Literal['A', 'AU', 'N', 'NC', 'SC', 'NE'] | None = None
    note: str = Field(default='', max_length=3000)
    adjustedStart: float | None = None
    adjustedEnd: float | None = None

class Session(BaseModel):
    schemaVersion: Literal[1]
    appVersion: str = Field(max_length=80)
    id: str = Field(max_length=80)
    participant: str = Field(pattern=r'^P[0-9]{2,4}$')
    startedAt: str = Field(max_length=60)
    consent: Literal[True]
    events: list[Event] = Field(max_length=30000)
    tasks: list[Task] = Field(max_length=200)

def cell(value):
    if value is None:
        return ''
    # Evitar fórmulas inyectadas en notas/importaciones.
    if isinstance(value, str) and value.startswith(('=', '+', '-', '@')):
        return "'" + value
    return value

if os.getenv('STUDY_MODE', 'false').lower() == 'true':
    @app.post('/api/study/export')
    def export(session: Session):
        from openpyxl import Workbook
        from openpyxl.styles import Font
        book = Workbook()
        meta = book.active
        meta.title = 'Sesion'
        for k in ('id', 'participant', 'startedAt', 'appVersion', 'consent'):
            meta.append([k, cell(getattr(session, k))])
        for name, records, model in [('Tareas', session.tasks, Task), ('Eventos', session.events, Event)]:
            sheet = book.create_sheet(name)
            fields = list(model.model_fields)
            sheet.append(fields)
            for record in records:
                sheet.append([cell(getattr(record, key)) for key in fields])
            sheet.freeze_panes = 'A2'
            sheet.auto_filter.ref = sheet.dimensions
            for c in sheet[1]:
                c.font = Font(bold=True)
            for col in sheet.columns:
                sheet.column_dimensions[col[0].column_letter].width = min(55, max(15, len(str(col[0].value)) + 3))
        output = io.BytesIO()
        book.save(output)
        return Response(output.getvalue(), media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', headers={'Content-Disposition': f'attachment; filename="{session.participant}-sesion.xlsx"'})
