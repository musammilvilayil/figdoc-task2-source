// Website documentation, using only extracted evidence.
const num = value => typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value * 100) / 100) : null
const px = value => num(value) === null ? 'Not captured' : num(value) + ' px'
const hex = color => color && ['r', 'g', 'b'].every(k => typeof color[k] === 'number') ? '#' + ['r', 'g', 'b'].map(k => Math.round(Math.max(0, Math.min(1, color[k])) * 255).toString(16).padStart(2, '0')).join('').toUpperCase() : ''
const table = (headers, rows, widths) => ({ kind: 'table', reference: true, headers, rows: rows.map(row => row.map(value => String(value ?? 'Decision needed'))), widths })
const paint = fills => (Array.isArray(fills) ? fills : []).filter(f => f.visible !== false).map(f => f.type === 'SOLID' ? hex(f.color) + (f.opacity !== undefined && f.opacity !== 1 ? ` at ${num(f.opacity * 100)}%` : '') : f.type?.startsWith('GRADIENT') ? `${f.type.replaceAll('_', ' ')}: ${(f.gradientStops || []).map(s => hex(s.color) + ' at ' + num(s.position * 100) + '%').join(', ')}` : f.type === 'IMAGE' ? 'Image fill' : f.type).filter(Boolean).join('; ')
export function assetFilename(preview, index) { return String(index + 1).padStart(2, '0') + '-' + (preview.name || 'image').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 70) + '.png' }
function picture(preview) {
 const scale = Math.min(600 / preview.width, 350 / preview.height, 1)
 return {kind:'image',data:preview.data,width:Math.max(1,Math.round(preview.width*scale)),height:Math.max(1,Math.round(preview.height*scale))}
}
function spec(p) {
 const parts=[]
 const fills=paint(p.fills); if(fills) parts.push('Fill: '+fills)
 const strokes=paint(p.strokes); if(strokes) parts.push('Border: '+px(p.strokeWeight)+' '+strokes)
 if(p.opacity !== undefined && p.opacity !== 1) parts.push('Opacity: '+num(p.opacity*100)+'%')
 if(p.cornerRadius > 0) parts.push('Radius: '+px(p.cornerRadius))
 if(p.clipsContent) parts.push('Clip overflow')
 if(p.layoutMode && p.layoutMode !== 'NONE') {
  parts.push('Auto layout: '+p.layoutMode.toLowerCase())
  if(p.itemSpacing !== undefined) parts.push('Gap: '+px(p.itemSpacing))
  parts.push('Padding T/R/B/L: '+['paddingTop','paddingRight','paddingBottom','paddingLeft'].map(k=>num(p[k]) ?? '?').join(' / '))
  if(p.primaryAxisAlignItems) parts.push('Main axis: '+p.primaryAxisAlignItems)
  if(p.counterAxisAlignItems) parts.push('Cross axis: '+p.counterAxisAlignItems)
 }
 for(const e of p.effects || []) if(e.visible !== false) parts.push(`${e.type.replaceAll('_',' ')}: ${px(e.radius)}${e.color ? ', '+hex(e.color) : ''}${e.offset ? ', offset '+num(e.offset.x)+' / '+num(e.offset.y) : ''}`)
 if(p.rotation) parts.push('Rotation: '+num(p.rotation)+' degrees')
 return parts.join('\n') || 'No additional visual treatment captured'
}
export function componentBlocks(doc) {
 const layers=doc.layers || [], content=doc.content || [], previews=doc.previews || []
 if(!layers.length && !content.length && !previews.length) throw new Error('No text or previews were captured. Select an app screen frame and prepare again.')
 const byId=new Map(layers.map(l=>[l.id,l]))
 const roots=layers.filter(l=>!byId.has(l.parentId))
 const sections=roots.length ? roots : [{id:null,name:'Selected content'}]
 const blocks=[]
 const add=(kind,text)=>blocks.push({kind,text})
 add('title',doc.source.name)
 add('subtitle','Website documentation')
 add('body',`This document covers ${roots.length || 1} selected root(s), ${layers.length} layers and ${content.length} text items. It documents the supplied design scope, not necessarily the complete website. Review open requirements before implementation signoff.`)
 if(doc.source.url) add('meta','Figma source: '+doc.source.url)
 add('h1','Overview and readiness')
 blocks.push(table(['Area','Current position'],[
 ['Design evidence',`${previews.length} previews and ${content.length} text items captured. Values below are observed design measurements.`],
 ['Implementation','Partial specification. Responsive rules, intended interactions and wider website scope require confirmation.'],
 ['Approval','Draft for review. Exporting does not approve content or implementation.']],[25,75]))
 add('body','Observed means extracted from Figma. Proposed guidance must be reviewed. Decision needed identifies information the export cannot establish. Coordinates are relative to each immediate parent; dimensions are design units, not approved CSS breakpoints.')
 for(const root of sections) {
  const within=l=>{ let current=l; const seen=new Set(); while(current && !seen.has(current.id)){ if(current.id===root.id)return true; seen.add(current.id);current=byId.get(current.parentId) }return false }
  const members=root.id ? layers.filter(within) : layers
  const ids=new Set(members.map(l=>l.id))
  const copy=root.id ? content.filter(c=>ids.has(c.id) || (!c.id && ids.has(c.sectionId))) : content
  add('h1',root.name || 'Selected section')
  const cover=previews.find(p=>p.id===root.id) || (!root.id ? previews.find(p=>p.kind!=='image-layer') : null)
  if(cover){blocks.push(picture(cover));add('meta','Observed design preview')}
  const p=root.properties || {}
  add('body',`Observed scope: ${members.length} layers${p.width !== undefined ? '; canvas '+px(p.width)+' x '+px(p.height) : ''}. ${members.filter(l=>!l.visible).length} hidden layers are retained in the technical JSON.`)
  add('h2','Layout and appearance')
  const visible=members.filter(l=>l.visible!==false)
  if(visible.length) blocks.push(table(['Element and parent','Position / size','Visual and layout details'],visible.map(l=>{
   const v=l.properties, box=v.absoluteBoundingBox || {}
   const position=v.x !== undefined ? `Parent: ${num(v.x)}, ${num(v.y) ?? '?'}` : box.x !== undefined ? `Canvas: ${num(box.x)}, ${num(box.y)}` : 'Position not captured'
   return [l.name+'\n'+l.type+' | '+(byId.get(l.parentId)?.name || 'Selected root'),position+'\n'+px(v.width ?? box.width)+' x '+px(v.height ?? box.height),spec(v)]
  }),[29,24,47]))
  else add('body','No visible layers in this scope. Confirm whether the hidden design should be implemented.')
  add('h2','Exact copy and typography')
  if(copy.length) for(const item of copy) {
   add('h3',item.name || 'Text')
   add('body',item.content)
   const style=item.style || {}, raw=byId.get(item.id)?.properties || {}, typography=raw.style || {}
   blocks.push(table(['Specification','Observed value'],[
    ['Font',[style.family || typography.fontFamily || 'Not captured',style.weight || typography.fontWeight || ''].filter(Boolean).join(' | ')],
    ['Size / line height',px(style.size ?? typography.fontSize)+' / '+px(typography.lineHeightPx)],
    ['Text treatment',paint(raw.fills) || style.color || 'Not captured'],
    ['Semantic role',item.headingLevel || (item.role || 'Text')+' (inferred; review)'],
    ...(item.linkUrl ? [['Link URL',item.linkUrl]] : [])
   ],[28,72]))
   if(raw.textSegments?.length > 1) {
    add('meta','Mixed text styles detected. Full run-level styling is preserved in technical JSON.')
    blocks.push(table(['Text run','Font and size'],raw.textSegments.map(run=>[run.characters || '',`${run.fontName?.family || 'Mixed'} ${run.fontName?.style || ''} | ${px(run.fontSize)}`]),[60,40]))
   }
  } else add('body','No editable copy captured. Image lettering is not an editable text layer.')
  const actions=members.filter(l=>l.properties.reactions?.length || l.properties.interactions?.length)
  if(actions.length){add('h2','Prototype interactions');for(const l of actions){add('h3',l.name);const interactions=l.properties.reactions || l.properties.interactions; for(const interaction of interactions){const actions=interaction.actions || (interaction.action ? [interaction.action] : []); for(const action of actions) add('body',`${interaction.trigger?.type || 'Trigger not captured'}: ${action.type || 'Action'}${action.url ? ' -> '+action.url : ''}${action.destinationId ? ' -> '+(byId.get(action.destinationId)?.name || 'Destination outside selected scope') : ''}${action.navigation ? ' ('+action.navigation+')' : ''}`)};add('meta','Observed prototype metadata. Translate into website behavior and confirm routing before implementation.')}}
 }
 add('h1','Images and visual assets')
 const images=previews.filter(p=>p.kind==='image-layer')
 if(!images.length)add('body','No individual image previews were captured. Confirm whether separate assets are required.')
 images.forEach((image,index)=>{
  add('h2',image.name);blocks.push({...picture(image), background:'202020'})
  add('meta','Export filename: '+assetFilename(image,index))
  const layer=byId.get(image.id),p=layer?.properties || {}
  blocks.push(table(['Use','Usage and requirements'],[
   ['Placement',layer?.path || image.page || 'Selected design'],
   ['Design size',px(p.width ?? p.absoluteBoundingBox?.width)+' x '+px(p.height ?? p.absoluteBoundingBox?.height)],
   ['Delivery','Rendered PNG available in Download images ZIP. This reproduces the layer appearance and may be downscaled; obtain original assets if needed for production.'],
   ['Decision needed','Confirm final crop, asset permission, image purpose and alternative text.']],[25,75]))
 })
 add('h1','Behavior and responsive requirements')
 add('body','Proposed: build reusable sections from the named design groups, keep copy as live text, and use separate image assets. Validate the observed sizes and clipping at the reference viewport before adapting the layout.')
 blocks.push(table(['Topic','Evidence and required decision'],[
 ['Responsive layout','Captured dimensions do not establish breakpoints. Confirm which selected frames are viewport variants and approve stacking, crop and type scaling.'],
 ['Actions and states','Review captured links and prototype actions. Confirm remaining navigation, hover, focus, loading, empty and error states; do not invent destinations.'],
 ['Accessibility','Review semantic headings, contrast, image purpose, alt text and keyboard behavior. These are not approved by export.'],
 ['Scope and metadata','Confirm remaining pages, header/footer, final URLs and SEO copy separately.']],[27,73]))
 add('h1','Open items and completion checklist')
 const missingLinks=content.filter(c=>c.role==='Button'&&!c.linkUrl).length
 blocks.push(table(['Review item','Status','Next action','Suggested role'],[
 ['Website scope','Decision needed','Confirm selected-scope completeness and remaining pages.','Product lead'],
 ['Copy','Needs review',`Approve ${content.length} text items and their semantic roles.`,'Content reviewer'],
 ['Images','Needs review',`Review ${images.length} image previews, production quality and usage permission.`,'Design / brand'],
 ['Fonts','Needs input','Confirm web fonts, rights and fallback choices.','Design / developer'],
 ['Mobile behavior','Decision needed','Approve viewport mappings, breakpoints and responsive behavior.','Design lead'],
 ['Links and actions',missingLinks ? 'Missing destinations' : 'Needs review',missingLinks ? `${missingLinks} button text item(s) have no URL. Check prototype navigation and provide intended website behavior.` : 'Confirm extracted links and intended interactions.','Product lead'],
 ['Accessibility','Needs review','Review headings, image purpose, contrast and keyboard behavior.','Developer / QA'],
 ['Final signoff','Not approved','Check implementation against the agreed design.','Manager']
 ],[21,20,41,18]))
 add('h2','Acceptance checks')
 for(const line of ['Layout, copy and images match the approved reference viewport.','Text is selectable and semantic; images preserve the agreed crop and aspect ratio.','Approved responsive sizes remain readable and usable.','Links and keyboard behavior work as specified.','Open requirements have named owners and resolutions before production signoff.']) add('body','- '+line)
 add('h2','Review record')
 blocks.push(table(['Field','To complete'],[['Reviewer and date',''],['Named owners and due dates',''],['Requested changes',''],['Decision','Approve / Revise / Hold']],[35,65]))
 if(doc.previewWarnings?.length){add('h2','Capture notes');for(const warning of doc.previewWarnings)add('body',warning)}
 add('meta','Full IDs, transforms, hidden layers and raw properties remain in Download technical JSON. This document presents implementation and review information without the raw layer dump.')
 return blocks
}
