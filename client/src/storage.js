let database
function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('figdoc', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('documents', { keyPath: 'localId' })
      request.result.createObjectStore('settings')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { database = null; reject(request.error) }
  })
  return database
}
export async function readLibrary() {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['documents', 'settings'], 'readonly')
    const docs = tx.objectStore('documents').getAll()
    const active = tx.objectStore('settings').get('active')
    tx.oncomplete = () => resolve({ documents: docs.result, active: active.result })
    tx.onerror = () => reject(tx.error)
  })
}
export async function saveDocument(document) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['documents', 'settings'], 'readwrite')
    tx.objectStore('documents').put(document)
    tx.objectStore('settings').put(document.localId, 'active')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Saving was interrupted.'))
  })
}
