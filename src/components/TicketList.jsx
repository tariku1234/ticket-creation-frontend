import "../styles/TicketList.css"

export default function TicketList({ tickets }) {
  const getPriorityColor = (priority) => {
    switch (priority) {
      case "HIGH":
        return "high"
      case "MEDIUM":
        return "medium"
      case "LOW":
        return "low"
      default:
        return "medium"
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="ticket-list">
      {tickets.map((ticket) => (
        <div key={ticket.id} className="ticket-item">
          <div className="ticket-header">
            <h3 className="ticket-title">{ticket.title}</h3>
            <span className={`priority-badge ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
          </div>
          <div className="ticket-body">
            <p className="ticket-category">
              <strong>Category:</strong> {ticket.category}
            </p>
            <p className="ticket-date">
              <strong>Created:</strong> {formatDate(ticket.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
