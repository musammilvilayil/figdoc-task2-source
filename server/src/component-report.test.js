import test from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { componentBlocks, assetFilename } from './component-report.js'
import { importPlugin } from './plugin-import.js'
import { toDocx, pdfDefinition } from './report.js'
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE5kAAAAASUVORK5CYII='
test('component template preserves editable copy, previews and explicit heading/link metadata', async () => {
 const payload = { format: 'figdoc-plugin', version: 1, file: { name: 'Demo', document: { id: '0', type: 'DOCUMENT', children: [{ id: '1', type: 'CANVAS', name: 'Page', children: [{ id: '2', type: 'FRAME', name: 'Hero', children: [{ id: '3', type: 'TEXT', name: 'H1 title', characters: 'Actual heading', style: {} }, { id: '4', type: 'TEXT', name: 'CTA', characters: 'Explore', style: { hyperlink: { type: 'URL', url: 'https://example.com/' } } }] }] }] } }, previews: [{ id: '2', name: 'Hero', page: 'Page', width: 1, height: 1, data: png }] }
 const doc = importPlugin(payload)
 const blocks = componentBlocks(doc)
 const rows = blocks.filter(b => b.kind === 'table').flatMap(b => b.rows)
 assert.ok(rows.some(r => r[0] === 'Semantic role' && r[1] === 'H1'))
 assert.ok(rows.some(r => r[0] === 'Link URL' && r[1] === 'https://example.com/'))
 assert.ok(!blocks.some(b => b.text === 'SEO Metadata'))
 assert.ok(blocks.some(b => b.text === 'Website documentation'))
 assert.ok(blocks.some(b => b.text === 'Open items and completion checklist'))
 assert.ok(!blocks.some(b => b.text === 'Design tokens'))
 const zip = await JSZip.loadAsync(await toDocx(doc, false, blocks))
 assert.match(await zip.file('word/document.xml').async('string'), /Actual heading/)
 assert.ok(Object.keys(zip.files).some(name => name.startsWith('word/media/') && name.endsWith('.png')))
 assert.ok(pdfDefinition(doc, blocks).content.flatMap(b => b.stack || [b]).some(b => b.image === png))
 assert.throws(() => importPlugin({ ...payload, previews: [{ ...payload.previews[0], data: 'https://example.com/image.png' }] }))
})


test('empty selections cannot generate a template-only document', () => {
 assert.throws(() => componentBlocks({ source: { name: 'Empty' }, content: [], previews: [] }), /No text or previews/)
})


test('nested image picture appears directly alongside its layer details', async () => {
 const doc = {source:{name:'Pictures'},content:[],layers:[{id:'image',name:'Product photo',path:'Frame / Product photo',type:'RECTANGLE',parentId:'frame',depth:1,visible:true,childIds:[],properties:{}}],previews:[{id:'image',name:'Product photo',page:'Page',kind:'image-layer',width:400,height:200,data:png}]}
 const blocks=componentBlocks(doc)
 const heading=blocks.findIndex(block=>block.text==='Product photo')
 assert.equal(blocks[heading+1].kind,'image')
 assert.equal(blocks[heading+1].data,png)
 const zip=await JSZip.loadAsync(await toDocx(doc,false,blocks))
 assert.match(await zip.file('word/document.xml').async('string'),/01-Product-photo.png/)
 assert.ok(pdfDefinition(doc,blocks).content.flatMap(b => b.stack || [b]).some(item=>item.image===png || item.table?.body?.[0]?.[0]?.image===png))
})


test('website documentation keeps sections separate and unknown requirements explicit', () => {
 const layers=[{id:'a',name:'Home',type:'FRAME',parentId:'page',visible:true,properties:{width:1200,height:800}},{id:'b',name:'Home',type:'FRAME',parentId:'page',visible:true,properties:{width:375,height:800}}]
 const doc={source:{name:'Site'},layers,content:[{id:'t1',sectionId:'a',name:'CTA',content:'Buy',role:'Button'},{id:'t2',sectionId:'b',name:'Title',content:'Mobile',role:'Heading'}]}
 layers.push({id:'t1',parentId:'a',name:'CTA',type:'TEXT',visible:true,properties:{}},{id:'t2',parentId:'b',name:'Title',type:'TEXT',visible:true,properties:{}})
 const blocks=componentBlocks(doc)
 assert.equal(blocks.filter(b=>b.kind==='body'&&b.text==='Buy').length,1)
 assert.equal(blocks.filter(b=>b.kind==='body'&&b.text==='Mobile').length,1)
 assert.ok(blocks.some(b=>b.rows?.some(row=>row.includes('Missing destinations'))))
 assert.ok(!blocks.some(b=>/Developer specification|Manager review|Complete layer inventory|SEO Metadata/.test(b.text || '')))
 assert.notEqual(assetFilename({name:'Image'},0),assetFilename({name:'Image'},1))
 assert.equal(assetFilename({name:'../photo'},0),'01--photo.png')
})
