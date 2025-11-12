const DB_NAME = "ServiceDeskDB"
const STORE_NAME = "tickets"
const SYNC_STORE = "syncQueue"
const DB_VERSION = 1

let db = null

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = event.target.result

      // Create tickets store
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" })
      }

      // Create sync queue store
      if (!database.objectStoreNames.contains(SYNC_STORE)) {
        database.createObjectStore(SYNC_STORE, { keyPath: "id" })
      }
    }
  })
}

export const getAllTickets = () => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const tickets = request.result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      resolve(tickets)
    }
  })
}

export const addTicket = (ticket) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put(ticket)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(ticket)
  })
}

export const deleteTicket = (ticketId) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite")
    const store = transaction.objectStore(STORE_NAME)
    const request = store.delete(ticketId)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export const getSyncQueue = () => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_STORE], "readonly")
    const store = transaction.objectStore(SYNC_STORE)
    const request = store.getAll()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const queue = request.result.filter((item) => item.id.startsWith("offline-"))
      resolve(queue)
    }
  })
}

export const addToSyncQueue = (ticket) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_STORE], "readwrite")
    const store = transaction.objectStore(SYNC_STORE)
    const request = store.add(ticket)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

export const clearSyncQueue = () => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_STORE], "readwrite")
    const store = transaction.objectStore(SYNC_STORE)
    const request = store.clear()

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export const removeFromSyncQueue = (ticketId) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_STORE], "readwrite")
    const store = transaction.objectStore(SYNC_STORE)
    const request = store.delete(ticketId)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
}

export const getDB = () => {
  return db
}
