// A small promise wrapper around IndexedDB, the browser's built-in database.
// Unlike localStorage it can hold binary files (Blobs) such as uploaded
// animations, audio and recorded video, and it is not limited to a few MB.
//
// Every store keeps objects with an `id` field as the key.
//   animations  uploaded animation files
//   audio       uploaded audio files
//   spells      only read once, to move spells made before spells became files
//   takes       unused (recordings are files in recordings/, see projectApi.js)

const DB_NAME = 'gesture-spells'
const DB_VERSION = 1
const STORES = ['animations', 'audio', 'spells', 'takes']

let dbPromise = null

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      // Runs the first time, and whenever DB_VERSION goes up.
      request.onupgradeneeded = () => {
        const db = request.result
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  return dbPromise
}

async function run(storeName, mode, action) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const request = action(transaction.objectStore(storeName))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export const getAll = (store) => run(store, 'readonly', (s) => s.getAll())
export const put = (store, record) => run(store, 'readwrite', (s) => s.put(record))
export const remove = (store, id) => run(store, 'readwrite', (s) => s.delete(id))

// Asks the browser not to clear this site's data when disk space runs low.
export function requestPersistentStorage() {
  return navigator.storage?.persist?.().catch(() => false)
}
