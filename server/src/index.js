import 'dotenv/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { parseFigmaUrl, fetchFigmaFile } from './figma.js'
import { parseFigmaDocument, toMarkdown } from './parser.js'
import { toDocx, toPdf } from './exports.js'
import { listDocuments, saveDocument } from './library.js'

const app = express()
const port = Number(process.env.PORT) || 5000
const root = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.resolve(root, '../../client/dist')

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }))
app.use('/api/export', express.json({ limit: '50mb' }))
app.use(express.json({ limit: '10mb' }))
app.use('/api', rateLimit({ windowMs: 60_000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false }))

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'figdoc-api' }))

app.get('/api/documents', async (_req, res, next) => {
  try { res.json(await listDocuments()) } catch (error) { next(error) }
})

app.put('/api/documents/:localId', async (req, res, next) => {
  try {
    if (req.params.localId !== req.body?.localId) return res.status(400).json({ error: 'Document IDs do not match.' })
    res.json(await saveDocument(req.body))
  } catch (error) { next(error) }
})

app.post('/api/analyze', async (req, res, next) => {
  try {
    const { figmaUrl, token: requestToken } = req.body || {}
    const token = requestToken?.trim() || process.env.FIGMA_ACCESS_TOKEN?.trim()
    if (!token) return res.status(400).json({ error: 'A Figma personal access token is required.' })

    const { fileKey, nodeId } = parseFigmaUrl(figmaUrl)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), Number(process.env.FIGMA_IMPORT_TIMEOUT_MS) || 180_000)
    let file
    try {
      file = await fetchFigmaFile({ fileKey, nodeId, token, signal: controller.signal })
    } finally {
      clearTimeout(timeout)
    }
    res.json(parseFigmaDocument(file, figmaUrl))
  } catch (error) {
    if (error.name === 'AbortError') {
      error.status = 504
      error.message = 'Import exceeded 90 seconds. Try importing a selected page or frame.'
    }
    next(error)
  }
})

app.post('/api/export/markdown', (req, res, next) => {
  try {
    const document = req.body?.document
    if (!document?.source || !Array.isArray(document.content)) {
      return res.status(400).json({ error: 'A valid content document is required.' })
    }
    const safeName = (document.source.name || 'figma-content').replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName || 'figma-content'}.md"`)
    res.send(toMarkdown(document))
  } catch (error) {
    next(error)
  }
})

for (const [format, mime, generate] of [
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', toDocx],
  ['pdf', 'application/pdf', toPdf],
]) {
  app.post(`/api/export/${format}`, async (req, res, next) => {
    try {
      const document = req.body?.document
      const buffer = await generate(document)
      const safeName = document.source.name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'figma-content'
      res.setHeader('Content-Type', mime)
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}.${format}"`)
      res.send(buffer)
    } catch (error) { next(error) }
  })
}

app.use(express.static(clientDist))
app.get('/{*splat}', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  res.sendFile(path.join(clientDist, 'index.html'), (error) => error && next(error))
})

app.use((error, _req, res, _next) => {
  if (error.type === 'entity.too.large') return res.status(413).json({ error: 'This request exceeds 50 MB. Choose one page, section, or filtered content and try again.' })
  console.error(error)
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Something went wrong while processing the file.' })
})

app.listen(port, () => console.log(`Figdoc API listening on http://localhost:${port}`))


