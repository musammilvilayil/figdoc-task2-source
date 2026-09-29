import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const root = new URL('../', import.meta.url)
const bundle = await build({ entryPoints: [fileURLToPath(new URL('figma-plugin/ui-entry.js', root))], bundle: true, write: false, minify: true, platform: 'browser', target: 'es2020' })
const template = await readFile(new URL('figma-plugin/ui-template.html', root), 'utf8')
const html = template.replace('/* FIGDOC_BUNDLE */', () => bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script'))
const code = await build({ entryPoints: [fileURLToPath(new URL('figma-plugin/figdoc/code.ts', root))], bundle: true, write: false, target: 'es2020' })
for (const dir of ['figma-plugin/', 'figma-plugin/figdoc/']) {
  await writeFile(new URL(dir + 'ui.html', root), html)
  await writeFile(new URL(dir + 'code.js', root), code.outputFiles[0].text)
  const manifestUrl = new URL(dir + 'manifest.json', root)
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'))
  manifest.id = '1684128110132396628'
  manifest.networkAccess = { allowedDomains: ['none'] }
  await writeFile(manifestUrl, JSON.stringify(manifest, null, 2) + '\n')
}
console.log('Built both plugin folders with shared Figdoc report engine.')
