// Preserve every selected node in tree order, including hidden and non-text nodes.
export function layerInventory(document) {
  const layers = []
  function visit(node, parentId, path, depth, ancestorVisible) {
    const visible = ancestorVisible && node.visible !== false
    const currentPath = [...path, node.name || node.type]
    if (!['DOCUMENT', 'CANVAS'].includes(node.type)) {
      const properties = Object.fromEntries(Object.entries(node).filter(([key]) => !['children', 'id', 'name', 'type'].includes(key)))
      layers.push({ id: node.id, parentId, name: node.name || node.type, type: node.type,
        path: currentPath.join(' / '), depth: Math.max(0, depth - 2), visible,
        childIds: (node.children || []).map(child => child.id), properties })
    }
    for (const child of node.children || []) visit(child, node.id, currentPath, depth + 1, visible)
  }
  visit(document, null, [], 0, true)
  return layers
}
const label = key => key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase())
function describe(value) {
  if (value === null) return 'None'
  if (Array.isArray(value)) return value.length ? value.map((item, index) => `${index + 1}. ${describe(item)}`).join('\n') : 'None'
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${label(key)}: ${describe(item)}`).join('\n') || 'None'
  return String(value)
}
export function layerBlocks(layers = []) {
  if (!layers.length) return []
  const blocks = [{ kind: 'h1', text: 'Complete layer inventory' }, { kind: 'body', text: `${layers.length} layers in the selected scope, including nested frames, groups, shapes, text and hidden layers. Coordinates and dimensions use Figma design units. Image references identify assets, not public download URLs. Preview limits do not limit this inventory.` }]
  for (const [index, layer] of layers.entries()) {
    blocks.push({ kind: 'h2', text: `${index + 1}. ${layer.name}` }, { kind: 'meta', text: layer.path })
    const rows = [['Layer ID', layer.id], ['Type', layer.type], ['Parent ID', layer.parentId || 'None'], ['Depth', String(layer.depth)], ['Visible including ancestors', String(layer.visible)], ['Child IDs', layer.childIds.join(', ') || 'None'], ...Object.entries(layer.properties).map(([key, value]) => [label(key), describe(value)])]
    // Split large property strings into paragraphs so a single table row cannot overflow a page.
    const short = rows.filter(([, value]) => value.length <= 1200)
    blocks.push({kind:'table', reference:true, headers:['Property','Value'], widths:[32,68], rows:short})
    for (const [key, value] of rows.filter(([, value]) => value.length > 1200)) blocks.push({kind:'h3',text:key},{kind:'body',text:value})
  }
  return blocks
}
