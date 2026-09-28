import test from 'node:test'
import assert from 'node:assert/strict'
import { documentationRoots, pngDimensions } from '../../figma-plugin/selection.js'
test('child selections share a containing screen and use document order',()=>{
 const page={type:'CANVAS',children:[]},a={id:'a',type:'FRAME',parent:page,children:[]},b={id:'b',type:'FRAME',parent:page,children:[]}
 page.children=[a,b]
 const group={id:'g',type:'GROUP',parent:a,children:[]},one={id:'one',type:'TEXT',parent:group},two={id:'two',type:'RECTANGLE',parent:a}
 group.children=[one];a.children=[group,two]
 assert.deepEqual(documentationRoots([b,two,one,a]).map(n=>n.id),['a','b'])
 const section={id:'s',type:'SECTION',parent:page,children:[a,b]};a.parent=section;b.parent=section
 assert.deepEqual(documentationRoots([one]).map(n=>n.id),['a'])
})
test('PNG sizes use actual encoded integer pixels',()=>{
 const bytes=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE5kAAAAASUVORK5CYII=','base64'))
 assert.deepEqual(pngDimensions(bytes,900,530.635),{width:1,height:1})
})
