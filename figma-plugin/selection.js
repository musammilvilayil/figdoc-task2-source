// Expand child selections to their containing screen while preserving document order.
export function documentationRoots(selection) {
 const candidates = selection.map(node => {
  let root = node
  for (let parent = node.parent; parent && !['CANVAS', 'DOCUMENT', 'SECTION'].includes(parent.type); parent = parent.parent) {
   if (['FRAME', 'COMPONENT', 'INSTANCE', 'COMPONENT_SET'].includes(parent.type)) root = parent
  }
  return root
 })
 const ids = new Set(candidates.map(node => node.id))
 const roots = [...new Map(candidates.map(node => [node.id, node])).values()].filter(node => {
  for (let parent = node.parent; parent; parent = parent.parent) if (ids.has(parent.id)) return false
  return true
 })
 const order = node => { const path = []; for (let n = node; n.parent; n = n.parent) path.unshift(n.parent.children?.indexOf(n) ?? 0); return path }
 return roots.sort((a,b) => { const x=order(a),y=order(b); for(let i=0;i<Math.min(x.length,y.length);i++) if(x[i]!==y[i])return x[i]-y[i];return x.length-y.length })
}
export function pngDimensions(bytes, fallbackWidth, fallbackHeight) {
 if(bytes.length>=24 && bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71) {
  const read = offset => bytes[offset]*16777216+bytes[offset+1]*65536+bytes[offset+2]*256+bytes[offset+3]
  const width=read(16),height=read(20)
  if(width>0&&height>0)return {width,height}
 }
 return {width:Math.max(1,Math.round(fallbackWidth)),height:Math.max(1,Math.round(fallbackHeight))}
}

// Figma Sections organize screens; they are not website screens themselves.
export function pageDocumentationRoots(page) {
 const roots=[]
 function visit(node) {
  if(node.visible===false)return
  if(node.type==='SECTION') { for(const child of node.children || [])visit(child) }
  else roots.push(node)
 }
 for(const child of page.children || [])visit(child)
 return roots
}
