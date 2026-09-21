import test from 'node:test'
import assert from 'node:assert/strict'
import { parseFigmaUrl } from '../src/figma.js'
import { parseFigmaDocument, toMarkdown } from '../src/parser.js'
import { demoFigmaFile } from '../src/demo.js'

test('parseFigmaUrl extracts a design key and selected node', () => {
  assert.deepEqual(parseFigmaUrl('https://www.figma.com/design/AbC_123/My-file?node-id=2-45'), {
    fileKey: 'AbC_123', nodeId: '2:45',
  })
})

test('parseFigmaUrl rejects non-Figma URLs', () => {
  assert.throws(() => parseFigmaUrl('https://example.com/file/abc'), /figma.com/)
})

test('parser produces structured content and tokens', () => {
  const result = parseFigmaDocument(demoFigmaFile, 'Demo')
  assert.equal(result.summary.pages, 2)
  assert.equal(result.summary.textItems, 8)
  assert.ok(result.tokens.colors.length >= 3)
  assert.equal(result.content[0].role, 'Heading')
})

test('markdown export includes pages and content', () => {
  const result = parseFigmaDocument(demoFigmaFile, 'Demo')
  const markdown = toMarkdown(result)
  assert.match(markdown, /# Orbit Banking/)
  assert.match(markdown, /Banking that moves with you/)
  assert.match(markdown, /## Design tokens/)
})
