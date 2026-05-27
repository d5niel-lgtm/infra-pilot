# Feature 27: Collaborative Terminal

| Metadata | Value |
|----------|-------|
| Feature ID | 27 |
| Feature Name | Collaborative Terminal |
| Primary Service | Management Panel |
| Effort Estimate | Large (7–10 PT) |
| Dependencies | WebSocket Gateway, tmux, Auth Service |
| Priority | High |

---

## 1. Overview

The Collaborative Terminal enables multiple users to share a single terminal session in real time. Users can invite peers via a shareable URL, observe peer cursors, and communicate via an embedded chat panel — all within a tmux-backed session managed by the Management Panel.

### 1.1 Goals

- Allow ad-hoc pair debugging and collaborative troubleshooting
- Provide shared terminal access without granting SSH credentials
- Support read-only and read-write participation modes
- Include in-session chat to reduce context-switching
- Persist session history for post-session review

### 1.2 Non-Goals

- Replace SSH or full remote desktop solutions
- Support concurrent shell job isolation (all participants share one tmux session)
- File transfer (handled by separate feature)
- Recording/playback of keystrokes (future enhancement)

---

## 2. Architecture

### 2.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (User A)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Collaborative Terminal UI (React)                        │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ Terminal    │  │ Peer Cursor   │  │ Chat Panel      │  │  │
│  │  │ (xterm.js)  │  │ Overlay       │  │ (WebSocket)     │  │  │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  │  │
│  └─────────┼───────────────┼───────────────────┼─────────────┘  │
└────────────┼───────────────┼───────────────────┼────────────────┘
             │               │                   │
             │   WebSocket   │   WebSocket       │   WebSocket
             │   (/ws/term)  │   (/ws/cursor)    │   (/ws/chat)
             ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Management Panel Backend                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  WebSocket Multiplexer                                   │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │  │
│  │  │ Terminal    │  │ Cursor Sync  │  │ Chat Broker     │  │  │
│  │  │ Manager     │  │ Engine       │  │                 │  │  │
│  │  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘  │  │
│  └─────────┼────────────────┼───────────────────┼─────────────┘  │
│            │                │                   │                │
│            ▼                ▼                   ▼                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Session Manager                                          │  │
│  │  - Create/destroy sessions                                │  │
│  │  - Auth & permissions                                     │  │
│  │  - Share URL generation                                   │  │
│  │  - Session history                                        │  │
│  └──────────────────────────┬────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
              ┌─────────────────────────────┐
              │  tmux (on target host)       │
              │  - Session: collab-<uuid>    │
              │  - Control mode: -CC         │
              │  - Pipe I/O via stdio        │
              └─────────────────────────────┘
```

### 2.2 Component Descriptions

| Component | Role | Technology |
|-----------|------|------------|
| Terminal UI | Renders terminal emulator in browser | xterm.js |
| Peer Cursor Overlay | Shows other users' cursor positions | Canvas overlay |
| Chat Panel | Real-time chat alongside terminal | React + WebSocket |
| WebSocket Multiplexer | Routes messages between clients and tmux | Go / Node.js |
| Session Manager | CRUD for collaborative sessions | Management Panel |
| tmux | Terminal multiplexer on target host | tmux 3.x |

### 2.3 Data Flow

1. **Host** clicks "Share Terminal" → Management Panel creates a tmux session on the target host
2. Panel generates a shareable URL: `https://panel.example.com/collab/<session-id>?token=<jwt>`
3. **Guest** opens URL → WebSocket connection established to `/ws/term/<session-id>`
4. All keystrokes are forwarded to the tmux session via its control mode (`-CC`)
5. tmux output is broadcast to all connected clients
6. Cursor positions are synchronized via separate WebSocket channel
7. Chat messages are brokered through the Chat Broker and persisted to DB

---

## 3. Implementation Plan

### Phase 1: Foundation (PT 2–3)

| Task | Description |
|------|-------------|
| 1.1 | Implement tmux control-mode wrapper: spawn, attach, pipe I/O |
| 1.2 | Build WebSocket endpoint `/ws/term/:sessionId` with JWT auth |
| 1.3 | Integrate xterm.js with WebSocket feed (single-user test) |
| 1.4 | Session CRUD API (create, get, delete) |

### Phase 2: Multi-User (PT 3–4)

| Task | Description |
|------|-------------|
| 2.1 | Implement message fan-out: broadcast output to all peers |
| 2.2 | Input locking: only one writer at a time (request/grant model) |
| 2.3 | Peer cursor synchronization over WebSocket |
| 2.4 | Share link generation with expiring JWT tokens |
| 2.5 | Read-only vs. read-write permission enforcement |

### Phase 3: Chat & Polish (PT 2–3)

| Task | Description |
|------|-------------|
| 3.1 | In-terminal chat panel UI + WebSocket broker |
| 3.2 | Session history recording (log all output to DB) |
| 3.3 | Session replay viewer (read-only playback of history) |
| 3.4 | Disconnect handling, reconnection, session heartbeat |
| 3.5 | Admin controls: force-remove participant, terminate session |

---

## 4. API Design

### 4.1 REST Endpoints

```
POST   /api/v2/collab/sessions                Create session
GET    /api/v2/collab/sessions                 List user's sessions
GET    /api/v2/collab/sessions/:id             Get session details
DELETE /api/v2/collab/sessions/:id             Terminate session
POST   /api/v2/collab/sessions/:id/invite     Generate share link
GET    /api/v2/collab/sessions/:id/history    Get session log
```

### 4.2 WebSocket Endpoints

```
/ws/v2/collab/term/:sessionId       Terminal I/O stream
/ws/v2/collab/cursor/:sessionId     Cursor position sync
/ws/v2/collab/chat/:sessionId       Chat message broker
```

### 4.3 Request/Response Examples

**Create Session:**
```json
POST /api/v2/collab/sessions
{
  "host_id": "srv-prod-01",
  "user": "ssh-user",
  "initial_command": "/bin/bash",
  "session_name": "debug-session-20260527"
}

Response 201:
{
  "id": "cs_abc123",
  "ws_url": "wss://panel.example.com/ws/v2/collab/term/cs_abc123",
  "share_url": "https://panel.example.com/collab/cs_abc123?token=eyJhbGci...",
  "tmux_session": "collab-cs_abc123",
  "created_at": "2026-05-27T12:00:00Z",
  "participants": []
}
```

**Invite:**
```json
POST /api/v2/collab/sessions/cs_abc123/invite
{
  "permission": "read_write",   // "read_only" | "read_write"
  "expires_in_minutes": 60
}

Response 200:
{
  "share_url": "https://panel.example.com/collab/cs_abc123?token=eyJhbGci...",
  "expires_at": "2026-05-27T13:00:00Z"
}
```

**WebSocket Message (Terminal I/O):**
```json
// Client → Server (keystroke)
{ "type": "input", "data": "ls -la\r", "seq": 42 }

// Server → Client (output)
{ "type": "output", "data": "\u001b[01;32mtotal 128\n...", "seq": 42 }

// Server → Client (participant update)
{ "type": "participant_join", "user_id": "u_456", "cursor": {"row": 12, "col": 5} }
```

**WebSocket Message (Cursor):**
```json
// Client → Server
{ "type": "cursor_move", "row": 24, "col": 15 }

// Server → Client (broadcast)
{ "type": "cursor_update", "user_id": "u_456", "display_name": "Alice", "row": 24, "col": 15 }
```

**WebSocket Message (Chat):**
```json
// Client → Server
{ "type": "chat_message", "text": "Run apt-get update first" }

// Server → Client (broadcast)
{ "type": "chat_message", "user_id": "u_456", "display_name": "Alice", "text": "Run apt-get update first", "ts": "2026-05-27T12:05:00Z" }
```

---

## 5. Data Model

### 5.1 `collab_sessions`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Unique session identifier |
| host_id | VARCHAR(64) | Target server/VM identifier |
| ssh_user | VARCHAR(64) | SSH user on target |
| initial_command | TEXT | Default shell/command |
| tmux_session_name | VARCHAR(128) | tmux session identifier on host |
| status | ENUM | `active`, `terminated`, `expired` |
| created_by | UUID (FK → users) | Session creator |
| created_at | TIMESTAMPTZ | Creation timestamp |
| terminated_at | TIMESTAMPTZ | When session ended |
| max_participants | INT | Default: 10 |

### 5.2 `collab_participants`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Unique participant ID |
| session_id | UUID (FK) | Associated session |
| user_id | UUID (FK → users) | Participant |
| permission | ENUM | `read_only`, `read_write` |
| connected_at | TIMESTAMPTZ | Join timestamp |
| disconnected_at | TIMESTAMPTZ | Leave timestamp (nullable) |
| is_currently_connected | BOOLEAN | Live presence flag |

### 5.3 `collab_chat_messages`

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL (PK) | Auto-increment |
| session_id | UUID (FK) | Associated session |
| user_id | UUID (FK → users) | Sender |
| message | TEXT | Message content |
| created_at | TIMESTAMPTZ | Timestamp |

### 5.4 `collab_session_logs`

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL (PK) | Auto-increment |
| session_id | UUID (FK) | Associated session |
| log_entry | TEXT | Raw terminal output at interval |
| offset_bytes | BIGINT | Byte offset in stream |
| captured_at | TIMESTAMPTZ | Timestamp |

---

## 6. Service Assignments

| Service | Responsibilities |
|---------|-----------------|
| **Management Panel** (primary) | WebSocket multiplexer, session CRUD, tmux wrapper, chat broker, history storage |
| **Auth Service** | JWT generation for share links, permission validation |
| **Target Host** | tmux installation, SSH access, session isolation |
| **Database** | Session metadata, participant tracking, chat history, logs |

---

## 7. Security & Permissions

| Aspect | Implementation |
|--------|---------------|
| Share link expiry | JWT with `exp` claim, default 60 min |
| Session isolation | Each session runs in its own tmux instance |
| Read-only enforcement | Server refuses `input` messages from read-only participants |
| Host access control | Only users with `server:ssh` permission can create sessions |
| Invite control | Only session host can generate share links |
| Rate limiting | Max 5 concurrent sessions per user |

---

## 8. Effort Estimate

| Phase | Person-Days |
|-------|-------------|
| Phase 1: Foundation | 2–3 PT |
| Phase 2: Multi-User | 3–4 PT |
| Phase 3: Chat & Polish | 2–3 PT |
| **Total** | **7–10 PT** |

---

## 9. Future Enhancements

- Session recording with playback scrubber
- Encrypted terminal I/O (E2EE)
- Multi-tab sessions (multiple tmux windows)
- File drag-and-drop into terminal
- Integration with runbook automation
