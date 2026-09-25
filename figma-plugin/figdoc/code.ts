let busy = false
function selectionStatus() {
  figma.ui.postMessage({ type: 'selection', count: figma.currentPage.selection.length, selection: figma.currentPage.id + ':' + figma.currentPage.selection.map(node => node.id).sort().join(',') })
}

figma.on('selectionchange', selectionStatus)
figma.ui.onmessage = async (message: { type: string }) => {
  if (message.type === 'ready') return selectionStatus()
  if (message.type !== 'export' || busy) return
  busy = true
  try {
    const page = figma.currentPage
    const selection = [...page.selection]
    const selectionKey = page.id + ':' + selection.map(node => node.id).sort().join(',')
    if (!selection.length) throw new Error('Select at least one frame or layer in Figma.')
    const ids = new Set(selection.map(node => node.id))
    const roots = selection.filter(node => {
      for (let parent: BaseNode | null = node.parent; parent; parent = parent.parent) {
        if (ids.has(parent.id)) return false
      }
      return true
    })
    // Repair missing text/children from live nodes rather than silently exporting an empty tree.
    function hydrate(raw: any, live: SceneNode): any {
      const result = { ...raw, id: live.id, name: live.name || raw?.name, type: live.type || raw?.type }
      const properties = ['visible', 'locked', 'opacity', 'blendMode', 'x', 'y', 'width', 'height', 'rotation',
        'absoluteBoundingBox', 'relativeTransform', 'constraints', 'fills', 'strokes', 'strokeWeight', 'strokeAlign',
        'strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight', 'dashPattern',
        'cornerRadius', 'topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius',
        'effects', 'layoutMode', 'layoutWrap', 'layoutSizingHorizontal', 'layoutSizingVertical',
        'primaryAxisAlignItems', 'counterAxisAlignItems', 'itemSpacing', 'counterAxisSpacing',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'layoutAlign', 'layoutGrow',
        'layoutPositioning', 'clipsContent', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
        'componentProperties', 'variantProperties', 'reactions', 'boundVariables', 'exportSettings',
        'description', 'isMask', 'maskType', 'booleanOperation', 'textAlignHorizontal', 'textAlignVertical',
        'textAutoResize', 'letterSpacing', 'lineHeight', 'paragraphSpacing', 'textCase', 'textDecoration']
      const unavailable: string[] = []
      for (const key of properties) {
        if (!(key in live)) continue
        try {
          const value = (live as any)[key]
          if (typeof value === 'symbol') { unavailable.push(key + ': mixed values'); continue }
          if (value !== undefined) result[key] = JSON.parse(JSON.stringify(value))
        } catch { unavailable.push(key + ': unavailable') }
      }
      if (unavailable.length) result.extractionNotes = unavailable
      if (live.type === 'TEXT') {
        result.characters = live.characters
        if (typeof live.getStyledTextSegments === 'function') {
          try { result.textSegments = live.getStyledTextSegments(['fontName', 'fontSize', 'fontWeight', 'fills', 'textDecoration', 'textCase', 'letterSpacing', 'lineHeight', 'hyperlink']) }
          catch { result.extractionNotes = [...(result.extractionNotes || []), 'Styled text segments unavailable'] }
        }
        const font = live.fontName
        result.style = { ...raw?.style,
          ...(typeof live.fontSize === 'number' ? { fontSize: live.fontSize } : {}),
          ...(font && typeof font === 'object' ? { fontFamily: font.family } : {}),
          ...(live.hyperlink && typeof live.hyperlink === 'object' ? { hyperlink: live.hyperlink } : {}) }
      }
      if ('children' in live) result.children = live.children.map(child => hydrate(raw?.children?.find((item: any) => item.id === child.id), child))
      return result
    }
    const children = []
    for (const node of roots) {
      const result = await node.exportAsync({ format: 'JSON_REST_V1' }) as { document?: unknown }
      if (!result.document) throw new Error('Figma could not export this selection.')
      children.push(hydrate(result.document, node))
    }
    const previews: { id: string, name: string, page: string, width: number, height: number, data: string, kind?: string }[] = []
    const imageAssets: { id: string, name: string, sectionId: string }[] = []
    const previewWarnings: string[] = []
    let imageBytes = 0
    async function collect(node: SceneNode, sectionId: string, imagesOnly: boolean) {
      const structural = ['FRAME', 'SECTION', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'GROUP'].includes(node.type)
      const owner = structural || roots.includes(node) ? node.id : sectionId
      const isImage = 'fills' in node && Array.isArray(node.fills) && node.fills.some(paint => paint.type === 'IMAGE')
      if (isImage && imagesOnly) imageAssets.push({ id: node.id, name: node.name, sectionId: owner })
      if ((imagesOnly ? isImage : (structural || roots.includes(node)) && !isImage) && 'exportAsync' in node && node.width > 0 && node.height > 0) {
        if (previews.length < 40 && imageBytes < 5 * 1024 * 1024) {
          try {
            const scale = Math.min(900 / node.width, 650 / node.height, 1)
            const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale } })
            if (imageBytes + bytes.length <= 5 * 1024 * 1024) {
              imageBytes += bytes.length
              previews.push({ id: node.id, name: node.name, page: page.name, width: node.width * scale, height: node.height * scale, data: 'data:image/png;base64,' + figma.base64Encode(bytes), kind: isImage ? 'image-layer' : 'component' })
            } else {
              if (isImage) throw new Error('Image size limit reached. Select fewer frames so every image can be included.')
              previewWarnings.push('Preview omitted due to export size: ' + node.name)
            }
          } catch (error) {
            if (isImage) throw new Error('Could not include picture for ' + node.name + '. Select fewer layers or check that this image layer can be exported. ' + (error instanceof Error ? error.message : ''))
            previewWarnings.push('Preview unavailable: ' + node.name)
          }
        } else {
          if (isImage) throw new Error('Image limit reached. Export fewer frames at a time to include every picture.')
          previewWarnings.push('Preview omitted due to export limit: ' + node.name)
        }
      }
      if ('children' in node) for (const child of node.children) await collect(child, owner, imagesOnly)
    }
    for (const node of roots) await collect(node, node.id, true)
    for (const node of roots) await collect(node, node.id, false)
    const payload = {
      previews, imageAssets, previewWarnings,
      format: 'figdoc-plugin', version: 1,
      file: { name: figma.root.name, document: { id: 'document', type: 'DOCUMENT', children: [
        { id: page.id, name: page.name, type: 'CANVAS', children }
      ] } }
    }
    figma.ui.postMessage({ type: 'result', selection: selectionKey, json: JSON.stringify(payload), name: figma.root.name })
  } catch (error) {
    figma.ui.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Export failed. Try a smaller selection.' })
  } finally { busy = false }
}

figma.showUI(__html__, { width: 380, height: 560, themeColors: true })
selectionStatus()

