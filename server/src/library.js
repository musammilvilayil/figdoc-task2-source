import fs from 'node:fs/promises'
import path from 'node:path'

const libraryPath = path.resolve(process.env.FIGDOC_DATA_DIR || '.', 'figdoc-library.json')

async function readRecords() {
  try {
    const data = JSON.parse(await fs.readFile(libraryPath, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

async function writeRecords(records) {
  await fs.mkdir(path.dirname(libraryPath), { recursive: true })
  const temporaryPath = `${libraryPath}.tmp`
  await fs.writeFile(temporaryPath, JSON.stringify(records), 'utf8')
  await fs.rename(temporaryPath, libraryPath)
}

export async function listDocuments() {
  return (await readRecords()).sort((left, right) => String(right.savedAt).localeCompare(String(left.savedAt)))
}

export async function saveDocument(document) {
  if (!document?.localId || !document.source || !Array.isArray(document.content)) {
    throw Object.assign(new Error('A valid content document is required.'), { status: 400 })
  }
  const records = await readRecords()
  const next = { ...document, savedAt: new Date().toISOString() }
  const index = records.findIndex(item => item.localId === next.localId)
  if (index === -1) records.push(next)
  else records[index] = next
  await writeRecords(records)
  return next
}