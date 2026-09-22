import { writeFile } from 'node:fs/promises'
import { toPdf, toDocx } from '../../server/src/exports.js'
import { parseFigmaDocument } from '../../server/src/parser.js'
import { demoFigmaFile } from '../../server/src/demo.js'
const document = parseFigmaDocument(demoFigmaFile, 'Demo file')
await writeFile('tmp/export-qa/detailed.pdf', await toPdf(document))
await writeFile('tmp/export-qa/detailed.docx', await toDocx(document))
