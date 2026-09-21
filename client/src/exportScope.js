export function scopeDocument(document, scope, filtered, includeInventories = true) {
  if (scope === 'all') return document
  let content
  if (scope === 'filtered') content = filtered
  else if (scope.startsWith('page:')) content = document.content.filter(item => item.page === scope.slice(5))
  else {
    const [, page, section] = scope.match(/^section:(.*?)::(.*)$/) || []
    content = document.content.filter(item => item.page === page && item.section === section)
  }
  const names = new Set(content.map(item => item.page))
  const pages = document.pages.filter(page => names.has(page.name)).map(page => ({ ...page, textCount: content.filter(item => item.page === page.name).length }))
  const tokens = includeInventories ? document.tokens : { colors: [], typography: [] }
  const components = includeInventories ? document.components : []
  return {
    ...document,
    source: { ...document.source, name: `${document.source.name} - ${scope === 'filtered' ? 'Filtered content' : scope.startsWith('page:') ? scope.slice(5) : scope.slice(scope.indexOf('::') + 2)}` },
    content, pages, tokens, components,
    summary: { ...document.summary, pages: pages.length, textItems: content.length, colors: tokens.colors.length, components: components.length },
    insights: { duplicateCopy: [], warnings: [includeInventories ? 'Copy is limited to the selected scope. Design tokens and components describe the entire imported file.' : 'This export contains only the selected copy. Design tokens and components are excluded.'] },
  }
}
