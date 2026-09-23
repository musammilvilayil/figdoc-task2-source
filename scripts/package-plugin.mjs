import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises'
import JSZip from 'jszip'
import './build-plugin.mjs'
const root = new URL('../', import.meta.url)
const zip = new JSZip()
for (const name of ['manifest.json', 'code.js', 'ui.html', 'README.md']) zip.file(`figdoc-plugin/${name}`, await readFile(new URL(`figma-plugin/${name}`, root)))
await mkdir(new URL('client/public/', root), { recursive: true })
const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
await writeFile(new URL('client/public/figdoc-plugin.zip', root), archive)
await writeFile(new URL('figma-plugin/figdoc.zip', root), archive)
for (const directory of ['client/public/figdoc-plugin/figdoc/', 'client/public/figdoc-plugin/figdoc-plugin/']) {
  await mkdir(new URL(directory, root), { recursive: true })
  for (const name of ['manifest.json', 'code.js', 'ui.html', 'README.md']) await copyFile(new URL(`figma-plugin/${name}`, root), new URL(directory + name, root))
}
console.log('Packaged client/public/figdoc-plugin.zip')
