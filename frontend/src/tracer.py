"""Seguimiento educativo. Solo listas, escalares y control de flujo básico.

Las restricciones de sintaxis son de alcance didáctico, no un sandbox de servidor.
Se ejecuta exclusivamente en un worker del navegador, sin credenciales.
"""
import ast
import builtins
import json
import sys
import time
from pyodide.console import Console
from pyodide.code import CodeRunner

_safe_builtins = {name: getattr(builtins, name) for name in (
    'print', 'range', 'len', 'sum', 'min', 'max', 'enumerate', 'zip', 'list',
    'int', 'float', 'str', 'bool', 'abs', 'round', 'sorted', 'reversed')}
# Pyodide utiliza esta excepción interna para devolver expresiones de consola.
_safe_builtins['___EvalCodeResultException'] = builtins.___EvalCodeResultException
_namespace = {'__builtins__': _safe_builtins}
_output = ''
_frames = []
_last_line = None
_started = 0
_filename = 'arreglos.py'

def _write(text):
    global _output
    if len(_output) + len(text) > 10000:
        raise RuntimeError('Se alcanzó el límite de salida (10 000 caracteres).')
    _output += text

_console = Console(globals=_namespace, stdout_callback=_write, stderr_callback=_write)

def _value(value, depth=0):
    if type(value) in (str, int, float, bool, type(None)):
        if type(value) is str:
            return value[:200]
        if type(value) is float and not (-float('inf') < value < float('inf')):
            return str(value)
        if type(value) is int and value.bit_length() > 512:
            return '<entero muy grande>'
        return value
    if type(value) is list and depth < 2:
        return [_value(v, depth + 1) for v in value[:100]] + (['…'] if len(value) > 100 else [])
    return '<' + type(value).__name__ + '>'

def _snapshot(line, next_line=None, error=None):
    visible = {k: v for k, v in _namespace.items() if not k.startswith('_')}
    aliases = {}
    for name, value in visible.items():
        if type(value) is list:
            aliases[name] = [k for k, v in visible.items() if v is value]
    _frames.append({'line': line, 'nextLine': next_line,
                    'variables': {k: _value(v) for k, v in list(visible.items())[:30]},
                    'aliases': aliases, 'output': _output, 'error': error,
                    'elapsedMs': round((time.perf_counter() - _started) * 1000, 3)})

def _trace(frame, event, arg):
    global _last_line
    if frame.f_code.co_filename != _filename:
        return None
    if event == 'line':
        if len(_frames) >= 1500 or time.perf_counter() - _started > 3:
            raise RuntimeError('Se alcanzó el límite de ejecución. Revisa el recorrido o reduce el ejemplo.')
        _snapshot(_last_line, frame.f_lineno)
        _last_line = frame.f_lineno
    return _trace

def _validate(source):
    if len(source) > 10000 or len(source.splitlines()) > 200:
        raise ValueError('Usa hasta 200 líneas y 10 000 caracteres.')
    tree = ast.parse(source, filename=_filename)
    forbidden = (ast.Import, ast.ImportFrom, ast.FunctionDef, ast.AsyncFunctionDef,
                 ast.ClassDef, ast.Lambda, ast.With, ast.AsyncWith, ast.Try,
                 ast.Global, ast.Nonlocal, ast.Await, ast.Yield, ast.YieldFrom)
    for node in ast.walk(tree):
        if isinstance(node, forbidden):
            raise ValueError('Esta versión admite listas, variables, condiciones y ciclos; no módulos ni funciones propias.')
        if isinstance(node, ast.Name) and node.id.startswith('_'):
            raise ValueError('Usa nombres de variables sin guion bajo inicial.')
        if isinstance(node, ast.Attribute) and node.attr not in ('append', 'extend', 'insert', 'pop', 'remove', 'clear', 'reverse', 'sort', 'copy', 'count', 'index'):
            raise ValueError('Esta versión permite operaciones básicas de listas.')
    return tree

async def trace_source(source, interactive=False):
    global _output, _frames, _last_line, _started
    _output, _frames, _last_line = '', [], None
    _started = time.perf_counter()
    if not interactive:
        _namespace.clear()
        _namespace['__builtins__'] = _safe_builtins
    try:
        _validate(source)
        sys.settrace(_trace)
        if interactive:
            future = _console.runsource(source + '\n', filename=_filename)
            result = await future
            if result is not None:
                _write(repr(_value(result)) + "\n")
            if future.syntax_check == 'incomplete':
                raise ValueError('Completa la instrucción; para bloques de varias líneas utiliza el editor.')
        else:
            code = CodeRunner(source, filename=_filename, mode='exec', return_mode='none').compile()
            # Console.runcode redirige stdout/stderr y mantiene el contexto.
            await _console.runcode(source, code)
        sys.settrace(None)
        _snapshot(_last_line)
    except BaseException as exc:
        sys.settrace(None)
        line = getattr(exc, 'lineno', None) or _last_line
        explanation = str(exc)
        if isinstance(exc, IndexError):
            explanation = 'Ese índice no existe. Revisa la longitud de la lista; los índices positivos comienzan en 0.'
        elif isinstance(exc, NameError):
            explanation = 'La variable todavía no está definida. Revisa su nombre y ejecuta primero su asignación. ' + str(exc)
        elif isinstance(exc, SyntaxError):
            explanation = 'Revisa la sintaxis: corchetes, dos puntos y sangría. ' + str(exc)
        _snapshot(line, error=type(exc).__name__ + ': ' + explanation)
    return json.dumps({'frames': _frames, 'durationMs': round((time.perf_counter() - _started) * 1000, 3)}, ensure_ascii=False)
