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

test('button ancestry classifies CTA copy and singular warnings use correct grammar', () => {
  const file = { name: 'Fixture', document: { children: [{id:'p',name:'Page',type:'CANVAS',children:[{id:'b',name:'Filled large button',type:'FRAME',visible:false,children:[{id:'t',name:'Text',type:'TEXT',characters:'Get Started',style:{fontSize:16}}]}]}] } }
  const result = parseFigmaDocument(file)
  assert.equal(result.content[0].role, 'Button')
  assert.ok(result.insights.warnings.some(warning => warning.startsWith('1 hidden layer was')))
  assert.ok(result.insights.warnings.some(warning => warning.startsWith('1 text layer uses')))
})
