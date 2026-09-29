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
 assert.ok(rows.some(r => r[0] === 'Heading level' && r[1] === 'H1'))
 assert.ok(rows.some(r => r[0] === 'Link URL' && r[1] === 'https://example.com/'))
 assert.ok(!blocks.some(b => b.text === 'SEO Metadata'))
 assert.ok(blocks.some(b => b.text === 'Website documentation'))
 assert.ok(blocks.some(b => b.text === 'Page metadata'))
 assert.ok(!blocks.some(b => b.text === 'Design tokens'))
 const zip = await JSZip.loadAsync(await toDocx(doc, false, blocks))
 assert.match(await zip.file('word/document.xml').async('string'), /Actual heading/)
 assert.ok(Object.keys(zip.files).some(name => name.startsWith('word/media/') && name.endsWith('.png')))
 assert.ok(pdfDefinition(doc, blocks).content.flatMap(b => b.stack || [b]).some(b => b.image === png || b.table?.body?.[0]?.[0]?.image === png))
 assert.throws(() => importPlugin({ ...payload, previews: [{ ...payload.previews[0], data: 'https://example.com/image.png' }] }))
})


test('empty selections cannot generate a template-only document', () => {
 assert.throws(() => componentBlocks({ source: { name: 'Empty' }, content: [], previews: [] }), /No text or previews/)
})


test('nested image picture appears directly alongside its layer details', async () => {
 const doc = {source:{name:'Pictures'},content:[],layers:[{id:'image',name:'Product photo',path:'Frame / Product photo',type:'RECTANGLE',parentId:'frame',depth:1,visible:true,childIds:[],properties:{}}],previews:[{id:'image',name:'Product photo',page:'Page',kind:'image-layer',width:400,height:200,data:png}]}
 const blocks=componentBlocks(doc)
 const heading=blocks.findIndex(block=>block.kind==='h3'&&block.text==='Product photo')
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
 assert.ok(blocks.some(b=>b.rows?.some(row=>row[0]==='Link URL'&&row[1]==='To add')))
 assert.ok(!blocks.some(b=>/Developer specification|Manager review|Complete layer inventory|SEO Metadata/.test(b.text || '')))
 assert.notEqual(assetFilename({name:'Image'},0),assetFilename({name:'Image'},1))
 assert.equal(assetFilename({name:'../photo'},0),'01--photo.png')
})


test('reference sections keep matching pictures and copy together without review boilerplate', () => {
 const layer=(id,parentId,type,name,visible=true)=>({id,parentId,type,name,visible,properties:{width:100,height:50}})
 const doc={source:{name:'Home'},layers:[layer('root','page','FRAME','Desktop'),layer('hero','root','FRAME','Hero'),layer('photo','hero','RECTANGLE','Hero photo'),layer('title','hero','TEXT','Title'),layer('cards','root','FRAME','Cards'),layer('cardText','cards','TEXT','Card title'),layer('hidden','cards','GROUP','Hidden',false),layer('hiddenText','hidden','TEXT','Hidden copy')],content:[{id:'title',content:'Hero text',role:'Heading'},{id:'cardText',content:'Card text',role:'Body'},{id:'hiddenText',content:'Do not publish',role:'Body'}],previews:[{id:'photo',name:'Hero photo',kind:'image-layer',width:100,height:50,data:png}]}
 const blocks=componentBlocks(doc),hero=blocks.findIndex(b=>b.kind==='h2'&&b.text==='Hero'),cards=blocks.findIndex(b=>b.kind==='h2'&&b.text==='Cards')
 assert.ok(hero>=0&&cards>hero)
 assert.ok(blocks.slice(hero,cards).some(b=>b.kind==='image'))
 assert.ok(blocks.slice(hero,cards).some(b=>b.text==='Hero text'))
 assert.ok(!blocks.slice(hero,cards).some(b=>b.text==='Card text'))
 assert.equal(blocks.filter(b=>b.text==='Hero text').length,1)
 assert.ok(blocks.slice(cards).some(b=>b.text==='Card text'))
 assert.ok(!JSON.stringify(blocks).includes('Do not publish'))
 assert.ok(!JSON.stringify(blocks).match(/Needs review|Not approved|Open items and completion|Review record|Decision needed/))
})

test('current-page report unwraps screen wrappers and keeps each copy item in its section', () => {
 const layer=(id,parentId,type,name)=>({id,parentId,type,name,visible:true,properties:{width:1200,height:400}})
 const doc={source:{name:'Site'},exportScope:{mode:'page',pageName:'Page 1'},layers:[layer('root','page','FRAME','Home'),layer('wrapper','root','FRAME','Wrapper'),layer('hero','wrapper','FRAME','Hero'),layer('text','hero','TEXT','Headline'),layer('cards','wrapper','FRAME','Cards'),layer('cardText','cards','TEXT','Card title'),layer('decor','cards','VECTOR','Decoration')],content:[{id:'text',name:'Headline',content:'Build something',role:'Heading',headingLevel:'H1',style:{family:'Inter',size:32}},{id:'cardText',name:'Card title',content:'Explore features',role:'Body',style:{family:'Inter',size:16}}],previews:[{id:'hero',name:'Hero',kind:'component',width:1200,height:400,data:png}]}
 const blocks=componentBlocks(doc),hero=blocks.findIndex(b=>b.kind==='h2'&&b.text==='Hero'),cards=blocks.findIndex(b=>b.kind==='h2'&&b.text==='Cards')
 assert.ok(hero>=0&&cards>hero)
 assert.ok(blocks.slice(hero,cards).some(b=>b.kind==='image'))
 for(const copy of doc.content)assert.equal(blocks.filter(b=>b.kind==='body'&&b.text===copy.content).length,1)
 assert.ok(blocks.slice(hero,cards).some(b=>b.kind==='meta'&&b.text.includes('Inter')&&b.text.includes('32 px')))
 assert.ok(!blocks.some(b=>b.rows?.some(r=>r[0]==='Content type'||r[0].includes('Decoration'))))
 assert.ok(blocks.some(b=>b.text?.includes('Current Figma page: Page 1')))
})

test('transparent section previews inherit the screen background',()=>{
 const doc={source:{name:'Site'},layers:[{id:'root',name:'Screen',type:'FRAME',properties:{fills:[{type:'SOLID',color:{r:1,g:1,b:1}}]}},{id:'hero',parentId:'root',name:'Hero',type:'FRAME',properties:{}}],content:[],previews:[{id:'hero',name:'Hero',kind:'component',width:100,height:50,data:png}]}
 assert.equal(componentBlocks(doc).find(b=>b.kind==='image').background,'FFFFFF')
 doc.layers[0].properties.fills[0].color={r:0,g:0,b:0}
 assert.equal(componentBlocks(doc).find(b=>b.kind==='image').background,'000000')
})
