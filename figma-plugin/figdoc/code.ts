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
    const children = []
    for (const node of roots) {
      const result = await node.exportAsync({ format: 'JSON_REST_V1' }) as { document?: unknown }
      if (!result.document) throw new Error('Figma could not export this selection.')
      children.push(result.document)
    }
    const payload = {
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

