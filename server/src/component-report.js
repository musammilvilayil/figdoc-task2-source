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
 const contentDocument=doc.exportScope?.mode==='page'
 const byId=new Map(layers.map(l=>[l.id,l])), images=previews.filter(p=>p.kind==='image-layer')
 const roots=layers.filter(l=>!byId.has(l.parentId))
 const blocks=[], usedCopy=new Set(), usedImages=new Set(), usedPreviews=new Set()
 const add=(kind,text)=>blocks.push({kind,text})
 const fields=rows=>blocks.push({...table(['Property','Details'],rows,[28,72]),keepTogether:rows.length<=12&&rows.every(row=>row.every(value=>String(value).length<200))})
 const within=(layer,root)=>{const seen=new Set();while(layer&&!seen.has(layer.id)){if(layer.id===root.id)return true;seen.add(layer.id);layer=byId.get(layer.parentId)}return false}
 const visible=layer=>{const seen=new Set();while(layer&&!seen.has(layer.id)){if(layer.visible===false)return false;seen.add(layer.id);layer=byId.get(layer.parentId)}return true}
 const backgroundFor=preview=>{
  let layer=byId.get(preview.id);const seen=new Set()
  while(layer&&!seen.has(layer.id)){
   seen.add(layer.id)
   const fill=(layer.properties?.fills || []).find(f=>f.visible!==false&&f.type==='SOLID'&&(f.opacity??1)===1)
   const color=hex(fill?.color);if(color)return color.slice(1)
   layer=byId.get(layer.parentId)
  }
  return 'FFFFFF'
 }
 const showImage=image=>{
  usedImages.add(image);usedPreviews.add(image)
  add('h3',image.name || 'Image');blocks.push({...picture(image),background:backgroundFor(image)})
  const p=byId.get(image.id)?.properties || {},fill=(p.fills || []).find(f=>f.type==='IMAGE'&&f.visible!==false)
  fields([['Image file',assetFilename(image,images.indexOf(image))],['Alt text',p.altText || 'To add'],['Design size',px(p.width ?? p.absoluteBoundingBox?.width)+' x '+px(p.height ?? p.absoluteBoundingBox?.height)],['Image sizing',fill?.scaleMode || 'Not captured'],['Export size',Math.round(image.width)+' x '+Math.round(image.height)+' px'],['Image source',p.imageUrl || 'Included in images ZIP']])
 }
 const showCopy=item=>{
  usedCopy.add(item)
  const raw=byId.get(item.id)?.properties || {},style=item.style || {},type=raw.style || {},button=item.role==='Button',heading=item.role==='Heading'||item.headingLevel
  add('h3',(!contentDocument && item.name && item.name.trim().replace(/\s+/g,' ')!==item.content.trim().replace(/\s+/g,' ')) ? item.name : (heading ? 'Heading' : button ? 'Button' : item.role==='Label' ? 'Label' : 'Description'));add('body',item.content);blocks[blocks.length-1].keepWithMeta=true
  const link=item.linkUrl || raw.hyperlink?.url
  if(contentDocument){
   add('meta',[item.headingLevel || item.role || 'Text',[style.family || type.fontFamily || 'Font not captured',style.weight || type.fontWeight || ''].filter(Boolean).join(' '),px(style.size ?? type.fontSize),paint(raw.fills) || style.color || '',type.lineHeightPx ? 'Line height: '+px(type.lineHeightPx) : '',type.letterSpacing ? 'Tracking: '+px(type.letterSpacing) : '',type.textAlignHorizontal || '',link ? 'Link: '+link : button ? 'Link: To add' : ''].filter(Boolean).join(' | '))
   if(raw.textSegments?.length>1)blocks.push(table(['Text run','Font and size'],raw.textSegments.map(run=>[run.characters || '',`${run.fontName?.family || 'Mixed'} ${run.fontName?.style || ''} | ${px(run.fontSize)}${run.hyperlink?.url ? ' | '+run.hyperlink.url : ''}`]),[60,40]))
   return
  }
  fields([['Content type',heading ? 'Heading' : button ? 'Button' : item.role || 'Text'],...(heading ? [['Heading level',item.headingLevel || 'To add']] : []),...(button || link ? [['Link URL',link || 'To add'],['Target',item.target || 'To add'],['Accessibility label',item.ariaLabel || 'To add']] : []),['Font',[style.family || type.fontFamily || raw.fontName?.family || 'Not captured',style.weight || type.fontWeight || raw.fontName?.style || ''].filter(Boolean).join(' | ')],['Font size',px(style.size ?? type.fontSize ?? raw.fontSize)],['Line height',px(type.lineHeightPx ?? style.lineHeight ?? (raw.lineHeight?.unit==='PIXELS' ? raw.lineHeight.value : undefined))],['Text color',paint(raw.fills) || style.color || 'Not captured'],...(type.letterSpacing!==undefined ? [['Letter spacing',px(type.letterSpacing)]] : []),...(type.textAlignHorizontal ? [['Text alignment',type.textAlignHorizontal]] : [])])
  if(raw.textSegments?.length>1)blocks.push(table(['Text run','Font and size'],raw.textSegments.map(run=>[run.characters || '',`${run.fontName?.family || 'Mixed'} ${run.fontName?.style || ''} | ${px(run.fontSize)}`]),[60,40]))
 }
 const showSection=(name,members,copy,sectionImages,cover,level='h2')=>{
  add(level,name || 'Section')
  if(cover&&!usedPreviews.has(cover)&&cover.kind!=='image-layer'){blocks.push({...picture(cover),background:backgroundFor(cover)});usedPreviews.add(cover)}
  for(const image of sectionImages)if(!usedImages.has(image))showImage(image)
  for(const item of copy)if(!usedCopy.has(item))showCopy(item)
  const layoutMembers=contentDocument ? members.filter((l,i)=>i===0 || (l.parentId===members[0]?.id&&['FRAME','INSTANCE','COMPONENT'].includes(l.type))) : members
  if(layoutMembers.length){add('h3','Layout and appearance');blocks.push(table(['Element and parent','Position and size','Design details'],layoutMembers.map(l=>{
   const p=l.properties || {},box=p.absoluteBoundingBox || {},position=p.x!==undefined ? `Parent: ${num(p.x)}, ${num(p.y) ?? '?'}` : box.x!==undefined ? `Canvas: ${num(box.x)}, ${num(box.y)}` : 'Position not captured'
   return [l.name+'\n'+(byId.get(l.parentId)?.name || 'Selected root'),position+'\n'+px(p.width ?? box.width)+' x '+px(p.height ?? box.height),spec(p)]
  }),[29,24,47]))}
  const interactions=[]
  for(const l of members)for(const interaction of l.properties?.reactions || l.properties?.interactions || [])for(const action of interaction.actions || (interaction.action ? [interaction.action] : []))interactions.push([l.name,interaction.trigger?.type || 'Not captured',`${action.type || 'Action'}${action.url ? ': '+action.url : ''}${action.destinationId ? ': '+(byId.get(action.destinationId)?.name || 'Frame outside selection') : ''}${action.navigation ? ' / '+action.navigation : ''}`])
  if(interactions.length){add('h3','Interactions');blocks.push(table(['Element','Trigger','Action'],interactions,[28,22,50]))}
 }
 add('title',doc.source.name);add('subtitle','Website documentation')
 if(doc.exportScope?.mode==='page')add('body','Current Figma page: '+doc.exportScope.pageName+'. All visible screens on this page are included; other Figma pages are not included.')
 add('body','Sections follow the Figma layer order. Pictures, exact copy, links and design details are grouped together. To add marks information not supplied by the design; it does not request a design change.')
 fields([['Figma source',doc.source.url || 'Not supplied'],['Website URL',doc.source.websiteUrl || 'To add']])
 add('h1','Page metadata')
 fields([['Page title',doc.seo?.title || 'To add'],['Meta description',doc.seo?.description || 'To add'],['Canonical URL',doc.seo?.canonicalUrl || 'To add'],['Social share title',doc.seo?.socialTitle || 'To add'],['Social share description',doc.seo?.socialDescription || 'To add'],['Social share image',doc.seo?.socialImage || 'To add']])
 add('meta','Dimensions are captured design values; positions are relative to the named parent unless marked Canvas. PNG assets match the filenames in the images ZIP and may be downscaled. Website breakpoints are not inferred from frame sizes.')
 for(const root of roots.filter(visible)){
  const all=layers.filter(l=>within(l,root)&&visible(l)),ids=new Set(all.map(l=>l.id)),ownCopy=content.filter(c=>ids.has(c.id)||(!byId.has(c.id)&&ids.has(c.sectionId))),ownImages=images.filter(i=>ids.has(i.id))
  let groupParent=root
  if(contentDocument){const seen=new Set();while(!seen.has(groupParent.id)){seen.add(groupParent.id);const children=all.filter(l=>l.parentId===groupParent.id);if(children.length!==1||!['FRAME','GROUP'].includes(children[0].type))break;groupParent=children[0]}}
  const groups=all.filter(l=>l.parentId===groupParent.id&&['FRAME','GROUP','COMPONENT','INSTANCE','COMPONENT_SET','SECTION'].includes(l.type))
  if(!groups.length){showSection(root.name,all,ownCopy,ownImages,previews.find(p=>p.id===root.id),'h1');continue}
  add('h1',root.name)
  const cover=previews.find(p=>p.id===root.id&&p.kind!=='image-layer');if(cover){blocks.push({...picture(cover),background:backgroundFor(cover)});usedPreviews.add(cover)}
  const assigned=new Set(groups.flatMap(g=>all.filter(l=>within(l,g)).map(l=>l.id)))
  showSection('Frame layout',all.filter(l=>!assigned.has(l.id)),ownCopy.filter(c=>!assigned.has(c.id)&&!assigned.has(c.sectionId)),ownImages.filter(i=>!assigned.has(i.id)))
  for(const group of groups){const members=all.filter(l=>within(l,group)),memberIds=new Set(members.map(l=>l.id));showSection(group.name,members,ownCopy.filter(c=>memberIds.has(c.id)||(!byId.has(c.id)&&memberIds.has(c.sectionId))),ownImages.filter(i=>memberIds.has(i.id)),previews.find(p=>p.id===group.id))}
 }
 // Keep legacy content without a layer inventory, grouped by its saved section.
 const remainingCopy=content.filter(c=>!usedCopy.has(c)&&(!byId.has(c.id)||visible(byId.get(c.id))))
 const remainingImages=images.filter(i=>!usedImages.has(i)&&(!byId.has(i.id)||visible(byId.get(i.id))))
 const remainingPreviews=previews.filter(p=>p.kind!=='image-layer'&&!usedPreviews.has(p)&&!byId.has(p.id))
 const keys=[...new Set([...remainingCopy.map(c=>c.sectionId || c.section || 'Selected content'),...remainingImages.map(i=>i.sectionId || i.id),...remainingPreviews.map(p=>p.id)])]
 for(const key of keys){const copy=remainingCopy.filter(c=>(c.sectionId || c.section || 'Selected content')===key),imgs=remainingImages.filter(i=>(i.sectionId || i.id)===key),cover=remainingPreviews.find(p=>p.id===key);showSection(copy[0]?.section || cover?.name || imgs[0]?.name || 'Selected content',[],copy,imgs,cover,'h1')}
 if(doc.previewWarnings?.length){add('h2','Capture notes');for(const warning of doc.previewWarnings)add('body',warning)}
 return blocks
}
