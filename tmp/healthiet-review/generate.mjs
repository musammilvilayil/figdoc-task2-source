import { readFile,writeFile } from 'node:fs/promises'
import { toPdf,toDocx } from '../../server/src/exports.js'
const docs=JSON.parse(await readFile('server/figdoc-library.json','utf8'))
const doc=docs.find(d=>/healthiet/i.test(d.source.name))
if(!doc) throw Error('Healthiet source not found')
await writeFile('tmp/healthiet-review/improved.pdf',await toPdf(doc))
await writeFile('tmp/healthiet-review/improved.docx',await toDocx(doc))
