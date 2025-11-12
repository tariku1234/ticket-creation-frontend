"use client"

import { useState } from "react"
import "../styles/TicketForm.css"

export default function TicketForm({ onSubmit, disabled }) {
  const [formData, setFormData] = useState({
    title: "",
    priority: "MEDIUM",
    category: "",
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.title.trim() && formData.category.trim()) {
      onSubmit(formData)
      setFormData({ title: "", priority: "MEDIUM", category: "" })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ticket-form">
      <div className="form-group">
        <label htmlFor="title">Title *</label>
        <input
          id="title"
          type="text"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Brief description"
          required
          disabled={disabled}
        />
      </div>

      <div className="form-group">
        <label htmlFor="category">Category *</label>
        <input
          id="category"
          type="text"
          name="category"
          value={formData.category}
          onChange={handleChange}
          placeholder="e.g., Bug, Feature, Support"
          required
          disabled={disabled}
        />
      </div>

      <div className="form-group">
        <label htmlFor="priority">Priority</label>
        <select id="priority" name="priority" value={formData.priority} onChange={handleChange} disabled={disabled}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </div>

      <button type="submit" disabled={disabled} className="submit-btn">
        Create Ticket
      </button>
    </form>
  )
}
