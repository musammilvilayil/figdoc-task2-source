import { build } from 'esbuild'
import { mkdir, copyFile } from 'node:fs/promises'
await mkdir(new URL('../auth-dist/', import.meta.url), { recursive: true })
for (const file of ['index.html', 'style.css']) await copyFile(new URL('../auth-site/' + file, import.meta.url), new URL('../auth-dist/' + file, import.meta.url))
await build({ entryPoints: ['auth-site/login.js'], outfile: 'auth-dist/login.js', bundle: true, minify: true, platform: 'browser', target: 'es2020' })
