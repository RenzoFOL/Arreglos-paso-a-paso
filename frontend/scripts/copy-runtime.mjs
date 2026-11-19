import { mkdir, readdir, copyFile } from 'node:fs/promises'
const source = new URL('../node_modules/pyodide/', import.meta.url)
const target = new URL('../public/pyodide/', import.meta.url)
await mkdir(target, { recursive: true })
for (const name of await readdir(source)) {
  if (/\.(wasm|zip|mjs|js|json)$/.test(name)) await copyFile(new URL(name, source), new URL(name, target))
}
