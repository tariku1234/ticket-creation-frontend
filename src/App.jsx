"use client"

import { useState, useEffect, useRef } from "react"
import TicketForm from "./components/TicketForm"
import TicketList from "./components/TicketList"
import {
  initDB,
  getAllTickets,
  addTicket,
  getSyncQueue,
  addToSyncQueue,
  removeFromSyncQueue,
  deleteTicket,
} from "./db/indexedDB"
import "./App.css"

function App() {
  const [tickets, setTickets] = useState([])
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ priority: "", search: "" })
  const eventSourceRef = useRef(null)
  const createdTicketIdsRef = useRef(new Set()) // track locally-created tickets

  // Initialize database and load tickets
  useEffect(() => {
    const init = async () => {
      try {
        await initDB()
        const cachedTickets = await getAllTickets()
        setTickets(cachedTickets)
        setLoading(false)
      } catch (error) {
        console.error("Failed to initialize database:", error)
        setLoading(false)
      }
    }

    init()
  }, [])

  // Setup online/offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      console.log("Back online - syncing...")
      syncWithServer()
    }

    const handleOffline = () => {
      setIsOnline(false)
      console.log("Went offline - using cached data")
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Setup SSE connection for live updates
  useEffect(() => {
    if (!isOnline) return

    const connectSSE = () => {
      try {
        eventSourceRef.current.onmessage = async (event) => {
          const data = JSON.parse(event.data)
          if (data.type === "new-ticket" && data.ticket) {
            // Check against both real IDs and temp IDs
            if (createdTicketIdsRef.current.has(data.ticket.id)) {
              createdTicketIdsRef.current.delete(data.ticket.id)
              return
            }

            // Ignore tickets that have a temp ID equivalent
            if (tickets.some((t) => t.title === data.ticket.title && t.id.startsWith("temp-"))) {
              // remove temp ticket
              setTickets((prev) => prev.filter((t) => !t.id.startsWith("temp-")))
            }

            await addTicket(data.ticket)
            setTickets((prev) => {
              const exists = prev.some((t) => t.id === data.ticket.id)
              if (exists) return prev
              return [data.ticket, ...prev]
            })
          }
        }

        eventSourceRef.current.onerror = () => {
          eventSourceRef.current?.close()
          // Attempt reconnect after 5 seconds
          setTimeout(connectSSE, 5000)
        }
      } catch (error) {
        console.error("SSE connection error:", error)
      }
    }

    connectSSE()

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [isOnline])

  // Fetch tickets from backend
  const fetchTickets = async () => {
    if (!isOnline) return

    try {
      const params = new URLSearchParams()
      if (filter.priority) params.append("priority", filter.priority)
      if (filter.search) params.append("q", filter.search)

      const response = await fetch(`http://localhost:3001/tickets?${params}`)
      if (!response.ok) throw new Error("Failed to fetch")

      const data = await response.json()
      setTickets(data)

      // Cache all tickets
      for (const ticket of data) {
        await addTicket(ticket)
      }
    } catch (error) {
      console.error("Error fetching tickets:", error)
    }
  }

  // Sync offline queue with server
  const syncWithServer = async () => {
    try {
      const syncQueue = await getSyncQueue()
      if (syncQueue.length === 0) {
        fetchTickets()
        return
      }

      console.log(`Syncing ${syncQueue.length} tickets...`)
      for (const ticket of syncQueue) {
        try {
          // Extract only the data needed for POST (exclude offline ID)
          const ticketData = {
            title: ticket.title,
            priority: ticket.priority,
            category: ticket.category,
          }

          const response = await fetch("http://localhost:3001/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ticketData),
          })

          if (response.ok) {
            const createdTicket = await response.json()
            // Add the real ticket
            await addTicket(createdTicket)

            await deleteTicket(ticket.id)
            await removeFromSyncQueue(ticket.id)

            // Update state to show real ticket instead of offline one
            setTickets((prev) => prev.map((t) => (t.id === ticket.id ? createdTicket : t)))
          }
        } catch (error) {
          console.error("Failed to sync ticket:", error)
        }
      }

      // Refresh to get any server-side updates
      fetchTickets()
    } catch (error) {
      console.error("Sync error:", error)
    }
  }

  // Handle new ticket submission
  const handleAddTicket = async (ticketData) => {
    if (isOnline) {
      try {
        const tempId = `temp-${Date.now()}-${Math.random()}`
        createdTicketIdsRef.current.add(tempId)

        const response = await fetch("http://localhost:3001/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ticketData),
        })

        if (response.ok) {
          const newTicket = await response.json()
          createdTicketIdsRef.current.delete(tempId)
          createdTicketIdsRef.current.add(newTicket.id)

          await addTicket(newTicket)
          setTickets((prev) => {
            const filtered = prev.filter((t) => t.id !== tempId)
            return [newTicket, ...filtered]
          })
        }
      } catch (error) {
        console.error("Error creating ticket:", error)
      }
    } else {
      const offlineTicket = {
        id: `offline-${Date.now()}`,
        ...ticketData,
        createdAt: new Date().toISOString(),
      }
      // Add to both stores so it appears in UI immediately
      await addTicket(offlineTicket)
      await addToSyncQueue(offlineTicket)
      setTickets((prev) => [offlineTicket, ...prev])
    }
  }

  const filteredTickets = tickets.filter((ticket) => {
    const priorityMatch = !filter.priority || ticket.priority === filter.priority
    const searchMatch =
      !filter.search ||
      ticket.title.toLowerCase().includes(filter.search.toLowerCase()) ||
      ticket.category.toLowerCase().includes(filter.search.toLowerCase())
    return priorityMatch && searchMatch
  })

  return (
    <div className="app">
      <header className="header">
        <h1>Service Desk Queue</h1>
        <div className="status">
          <span className={`connection-status ${isOnline ? "online" : "offline"}`}>
            {isOnline ? "✓ Online" : "✗ Offline"}
          </span>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <section className="form-section">
            <h2>Create Ticket</h2>
            <TicketForm onSubmit={handleAddTicket} disabled={loading} />
          </section>

          <section className="filters-section">
            <h2>Tickets</h2>
            <div className="filters">
              <input
                type="text"
                placeholder="Search tickets..."
                value={filter.search}
                onChange={(e) => setFilter((prev) => ({ ...prev, search: e.target.value }))}
                className="search-input"
              />
              <select
                value={filter.priority}
                onChange={(e) => setFilter((prev) => ({ ...prev, priority: e.target.value }))}
                className="priority-select"
              >
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <button onClick={fetchTickets} disabled={!isOnline} className="refresh-btn">
                Refresh
              </button>
            </div>
          </section>

          <section className="list-section">
            {loading ? (
              <p className="loading">Loading tickets...</p>
            ) : filteredTickets.length === 0 ? (
              <p className="empty">No tickets found</p>
            ) : (
              <TicketList tickets={filteredTickets} />
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
