import pdfmake from 'pdfmake'
import roboto from 'pdfmake/fonts/Roboto.js'
import { pdfDefinition } from './report.js'
export { exportBlocks, toDocx } from './report.js'
pdfmake.addFonts(roboto)
export async function toPdf(doc) { return pdfmake.createPdf(pdfDefinition(doc)).getBuffer() }
