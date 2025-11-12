"use client"

import { useState, useEffect, useRef } from "react"
import TicketForm from "@/client/src/components/TicketForm"
import TicketList from "@/client/src/components/TicketList"
import { initDB, getAllTickets, addTicket, getSyncQueue } from "@/client/src/db/indexedDB"
import "@/client/src/App.css"

export default function Page() {
  const [tickets, setTickets] = useState([])
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ priority: "", search: "" })
  const eventSourceRef = useRef(null)

  // Initialize database and load tickets
  useEffect(() => {
    const init = async () => {
      try {
        if (typeof window !== "undefined") {
          await initDB()
          const cachedTickets = await getAllTickets()
          setTickets(cachedTickets)
        }
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

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline)
      window.addEventListener("offline", handleOffline)

      return () => {
        window.removeEventListener("online", handleOnline)
        window.removeEventListener("offline", handleOffline)
      }
    }
  }, [])

  // Setup SSE connection for live updates
  useEffect(() => {
    if (!isOnline || typeof window === "undefined") return

    const connectSSE = () => {
      try {
        eventSourceRef.current = new EventSource("http://localhost:3001/events")

        eventSourceRef.current.onmessage = async (event) => {
          const data = JSON.parse(event.data)
          if (data.type === "new-ticket" && data.ticket) {
            // Add new ticket to cache and state
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
          const response = await fetch("http://localhost:3001/tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ticket),
          })

          if (response.ok) {
            const createdTicket = await response.json()
            await addTicket(createdTicket) // Update with server ID
          }
        } catch (error) {
          console.error("Failed to sync ticket:", error)
        }
      }

      fetchTickets()
    } catch (error) {
      console.error("Sync error:", error)
    }
  }

  // Handle new ticket submission
  const handleAddTicket = async (ticketData) => {
    if (isOnline) {
      try {
        const response = await fetch("http://localhost:3001/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ticketData),
        })

        if (response.ok) {
          const newTicket = await response.json()
          await addTicket(newTicket)
          setTickets((prev) => [newTicket, ...prev])
        }
      } catch (error) {
        console.error("Error creating ticket:", error)
      }
    } else {
      // Queue ticket offline
      const offlineTicket = {
        id: `offline-${Date.now()}`,
        ...ticketData,
        createdAt: new Date().toISOString(),
      }
      await addTicket(offlineTicket)
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
