# Service Desk Queue - Offline-First PWA

A complete offline-first ticket queue system built with React 19, Node.js/Express, and Service Workers + IndexedDB for offline support.

## Architecture Overview

\`\`\`
┌─────────────────────────────────────────────────────────────┐
│                        Browser Client                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  React App (Ticket UI + Form)                         │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │ reads/writes                         │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │  IndexedDB (Local Cache)                              │   │
│  │  - Tickets store                                      │   │
│  │  - Sync queue store (offline submissions)             │   │
│  └────────────────────┬─────────────────────────────────┘   │
│                       │ intercepts fetch                     │
│  ┌────────────────────▼─────────────────────────────────┐   │
│  │  Service Worker                                       │   │
│  │  - Offline caching strategy                           │   │
│  │  - Cache-first for static assets                      │   │
│  │  - Network-first for API calls                        │   │
│  └────────────────┬──────────────────────┬──────────────┘   │
└───────────────────┼──────────────────────┼──────────────────┘
                    │ (online)             │ (offline)
                    │                      └─ cached responses
         ┌──────────▼───────────┐
         │  Backend Express API │
         │  ─────────────────── │
         │  POST /tickets       │
         │  GET /tickets        │
         │  GET /events (SSE)   │
         └──────────┬───────────┘
                    │
         ┌──────────▼───────────┐
         │  Data Store          │
         │  (tickets.json)      │
         └──────────────────────┘
\`\`\`

## Features

- **✓ Offline-First**: Works completely offline using IndexedDB
- **✓ Real-time Updates**: SSE endpoint for live ticket notifications
- **✓ Auto-Sync**: Automatically syncs offline submissions when online
- **✓ PWA Ready**: Installable on mobile with app icons and shortcuts
- **✓ Responsive Design**: Works seamlessly on mobile and desktop
- **✓ Simple Stack**: No complex auth or database setup needed

## Tech Stack

### Frontend
- **React 19** - UI components and state management
- **Vite** - Fast development server and bundling
- **Service Workers** - Offline support and caching
- **IndexedDB** - Client-side persistent storage
- **Fetch API** - Network communication

### Backend
- **Node.js** - JavaScript runtime
- **Express** - REST API framework
- **SSE** - Server-Sent Events for live updates
- **JSON** - Simple persistent storage (upgradeable to SQLite)

## Setup & Installation

### Backend Setup

\`\`\`bash
cd server
npm install
npm run dev
\`\`\`

Backend runs on `http://localhost:3001`

**Endpoints:**
- `GET /tickets` - Fetch all tickets (with filters)
- `POST /tickets` - Create a new ticket
- `GET /events` - Connect to SSE stream

### Frontend Setup

\`\`\`bash
cd client
npm install
npm run dev
\`\`\`

Frontend runs on `http://localhost:3000`

## Usage

### Creating Tickets

1. **Online**: Fill the form and submit - ticket is created immediately and cached
2. **Offline**: Fill the form and submit - ticket is stored in IndexedDB sync queue
3. **Back Online**: The app automatically syncs queued tickets with the server

### Filtering Tickets

- Search by title or category
- Filter by priority (Low, Medium, High)
- Results are cached locally

### Live Updates

When online, the app subscribes to the SSE `/events` endpoint and receives real-time notifications when new tickets are created by other users.

### Testing Offline Behavior

1. Create a few tickets while online
2. Open DevTools → Network and set status to "Offline"
3. Create new tickets - they will be stored locally
4. Go back online - tickets will auto-sync
5. New tickets from other users appear via SSE

## Data Model

\`\`\`typescript
interface Ticket {
  id: string;           // UUID
  title: string;        // Ticket title
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  category: string;     // Bug, Feature, Support, etc.
  createdAt: string;    // ISO-8601 timestamp
}
\`\`\`

## API Reference

### GET /tickets

Fetch all tickets with optional filtering.

**Query Parameters:**
- `priority` (optional): Filter by priority
- `q` (optional): Search query

**Example:**
\`\`\`bash
GET http://localhost:3001/tickets?priority=HIGH&q=urgent
\`\`\`

**Response:**
\`\`\`json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Database connection issue",
    "priority": "HIGH",
    "category": "Bug",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
]
\`\`\`

### POST /tickets

Create a new ticket.

**Request Body:**
\`\`\`json
{
  "title": "Screen freezes on load",
  "priority": "MEDIUM",
  "category": "Bug"
}
\`\`\`

**Response:** Returns the created ticket with generated ID and timestamp.

### GET /events

Server-Sent Events endpoint for live updates.

**Connection:** Keep open for receiving `new-ticket` events.

**Event Format:**
\`\`\`json
{
  "type": "new-ticket",
  "ticket": {
    "id": "uuid",
    "title": "string",
    "priority": "string",
    "category": "string",
    "createdAt": "ISO-8601"
  }
}
\`\`\`

## Duplicate Ticket Prevention

1.The app tracks locally created tickets using temp IDs and offline IDs.

2.When a new ticket comes from SSE or sync, it is only added if it doesn’t already exist in state.

3.Any temp tickets that match a server-confirmed ticket are removed automatically.

## Sync Strategy Update

1.Tickets created offline → stored with offline-{timestamp} IDs

2.Tickets created online → stored temporarily with temp-{timestamp} IDs

3.When back online → offline tickets are submitted to server

4.Server generates real UUIDs and timestamps

5.Client replaces offline/temp tickets with server versions

6.Duplicates avoided by checking IDs in the client state

## Ticket Creation & Duplicate Handling

                        ┌───────────────┐
                        │  User submits │
                        │   Ticket      │
                        └───────┬───────┘
                                │
                        ┌───────▼────────┐
                        │ Is Online?     │
                        └───────┬────────┘
                  Yes           │           No
                  │             │
       ┌──────────▼────────┐    │
       │ Assign temp ID     │    │
       │ temp-{timestamp}   │    │
       └──────────┬────────┘    │
                  │             │
      Send to server            ┌▼─────────────────┐
      ┌──────────▼────────┐     │ Assign offline ID │
      │ Server generates  │     │ offline-{timestamp}│
      │ real UUID & ts    │     └───────┬──────────┘
      └──────────┬────────┘             │
                 │                      │
         Replace temp ID                │
         with server ID                 │
                 │                      │
                 └───────────────► Add to UI
                                   immediately
                                           │
                                   Add to IndexedDB
                                   & sync queue
                                           │
                                ┌──────────▼───────────┐
                                │ Back Online?         │
                                └──────────┬───────────┘
                                           │
                                Sync offline tickets
                                ┌──────────▼───────────┐
                                │ Replace offline IDs   │
                                │ with server-confirmed │
                                │ tickets               │
                                └──────────┬───────────┘
                                           │
                                  UI is now
                                consistent & duplicate-free
                                           │
                                ┌──────────▼───────────┐
                                │ SSE updates arrive    │
                                │ Check ID before adding│
                                │ to prevent duplicates │
                                └──────────────────────┘


## Offline → Online Sync Strategy

**Policy: Last Write Wins**

1. Tickets created offline are stored in IndexedDB with `offline-{timestamp}` IDs
2. When connection is restored, they are submitted to the backend
3. Server generates real UUIDs and timestamps
4. Client replaces offline tickets with server versions
5. Conflict resolution: Server timestamp is authoritative

**Sync Queue Structure:**
\`\`\`javascript
{
  "offline-1705330200000": {
    "title": "Urgent fix needed",
    "priority": "HIGH",
    "category": "Bug",
    "createdAt": "2024-01-15T11:30:00.000Z"
  }
}
\`\`\`

## Caching Strategy

### Service Worker Cache Layers

1. **Static Assets** (Cache-First)
   - HTML, CSS, JS bundles
   - Served from cache, falls back to network

2. **API Calls** (Network-First)
   - `/tickets` and `/events` endpoints
   - Tries network first, falls back to cache
   - Successful responses are cached for offline fallback

3. **IndexedDB Cache**
   - All fetched tickets stored locally
   - Synced when online
   - Persistent across sessions

## Performance Considerations

- **Initial Load**: ~200ms (cached)
- **API Response**: ~50ms (local) to 200ms (network)
- **Sync Operation**: Batch queue processing, one ticket per request
- **Storage**: ~1KB per ticket in IndexedDB (supports thousands)

## Future Enhancements

- SQLite backend for larger deployments
- WebSocket support for bidirectional updates
- Authentication and role-based access
- Ticket status tracking (Open, In Progress, Closed)
- User avatars and assignees
- Rich text descriptions and attachments
- Real-time collaboration indicators

## Troubleshooting

### Service Worker not registering?
- Check browser console for errors
- Ensure service-worker.js is in public folder
- Clear site data and refresh

### Tickets not syncing offline?
- Open DevTools → Application → IndexedDB
- Verify tickets are stored in "ServiceDeskDB"
- Check sync queue in the second store

### SSE connection failing?
- Verify backend is running on port 3001
- Check CORS headers in browser console
- Ensure EventSource API is supported

### Offline form submissions not appearing?
- Confirm browser is actually offline
- Check if tickets are in sync queue
- Try going back online to trigger auto-sync

## License

MIT
