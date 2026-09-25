import test from 'node:test'
import assert from 'node:assert/strict'
import { layerInventory, layerBlocks } from './layer-inventory.js'
import { componentBlocks } from './component-report.js'
test('inventory preserves nested non-text and hidden layers with exact properties', () => {
 const root={id:'d',type:'DOCUMENT',children:[{id:'p',type:'CANVAS',children:[{id:'f',type:'FRAME',name:'Screen',visible:false,width:320,layoutMode:'VERTICAL',paddingTop:0,children:[{id:'v',type:'VECTOR',name:'Icon',opacity:0,fills:[{type:'SOLID',color:{r:1,g:0,b:0}}]},{id:'t',type:'TEXT',name:'Copy',characters:'Full copy',textSegments:[{start:0,end:4,fontSize:16}]}]}]}]}
 const layers=layerInventory(root)
 assert.deepEqual(layers.map(l=>l.id),['f','v','t'])
 assert.equal(layers[1].visible,false)
 assert.equal(layers[1].parentId,'f')
 assert.equal(layers[1].properties.opacity,0)
 assert.equal(layers[0].properties.paddingTop,0)
 assert.equal(layers[2].properties.characters,'Full copy')
 assert.ok(!('children' in layers[0].properties))
 const blocks=componentBlocks({source:{name:'Shapes'},content:[],layers})
 assert.ok(!blocks.some(b=>b.text==='Complete layer inventory'))
 assert.ok(blocks.some(b=>b.text==='Layout and appearance'))
 assert.equal(layers[1].properties.opacity,0)
 assert.ok(layerBlocks([{...layers[2],properties:{characters:'x'.repeat(5000)}}]).some(b=>b.kind==='body'&&b.text.length===5000))
})
