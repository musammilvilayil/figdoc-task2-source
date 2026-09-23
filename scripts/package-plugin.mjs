import { readFile, mkdir, writeFile } from 'node:fs/promises'
import JSZip from 'jszip'
import './build-plugin.mjs'
const root = new URL('../', import.meta.url)
const zip = new JSZip()
for (const name of ['manifest.json', 'code.js', 'ui.html', 'README.md']) zip.file(`figdoc-plugin/${name}`, await readFile(new URL(`figma-plugin/${name}`, root)))
await mkdir(new URL('client/public/', root), { recursive: true })
await writeFile(new URL('client/public/figdoc-plugin.zip', root), await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
console.log('Packaged client/public/figdoc-plugin.zip')
