# Feature 45: Bulk Operations Manager

- **Feature ID:** 45
- **Status:** Planned
- **Priority:** High
- **Primary Service:** Management Panel
- **Effort Estimate:** Medium (4–6 PT)
- **Dependencies:** Feature 43 (keyboard navigation for multi-select)

---

## 1. Overview

Provide a guided workflow that lets operators select multiple servers (or other
resources) and apply a batch action — start, stop, reboot, backup, tag, change
plan, or decommission. The feature includes a persistent progress tracker,
per-item status reporting, undo/rollback capability, and a full audit trail.

### Goals

1. Support batch actions on up to 500 servers in a single operation.
2. Real-time progress (Server-Sent Events or WebSocket push).
3. Rollback of failed/cancelled operations where the target action supports it.
4. Full action history visible in the Management Panel.

---

## 2. Architecture & Component Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Management Panel (Frontend)                     │
│                                                                     │
│  ┌──────────────────────┐   ┌──────────────────────────────────┐   │
│  │  ServerTable          │   │  BulkActionBar                   │   │
│  │  (multi-select rows)  │   │  [Start] [Stop] [Backup] […]    │   │
│  │  checkbox per row     │   │  Shows "N selected"              │   │
│  └──────────┬───────────┘   └────────────┬─────────────────────┘   │
│             │                            │                          │
│  ┌──────────▼────────────────────────────▼──────────────────────┐  │
│  │  ConfirmationDialog                                           │  │
│  │  • summary of what will happen                                │  │
│  │  • "Apply to N servers — proceed?"                            │  │
│  │  • optional dry-run preview                                   │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                        │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │  ProgressPanel (persistent drawer / page)                     │  │
│  │  • SSE / WS connection → live per-server status               │  │
│  │  • progress bar (completed / failed / total)                  │  │
│  │  • expandable row list: ✓ serverA, ✗ serverB (error), …      │  │
│  │  • "Rollback" button for reversible actions                   │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                        │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │  ActionHistory (tab in settings)                              │  │
│  │  • table of past bulk operations                              │  │
│  │  • filter by action, date, status                             │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Backend (API Gateway + Worker)                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  POST /api/v2/bulk/actions  →  returns bulkOperationId        │ │
│  │  GET  /api/v2/bulk/actions/:id  →  status + per-item results  │ │
│  │  POST /api/v2/bulk/actions/:id/rollback                       │ │
│  │  GET  /api/v2/bulk/actions/history  →  paginated history      │ │
│  │  WS   /api/v2/bulk/actions/:id/stream  →  live events         │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Plan

### Phase 1 — Backend API & Worker (2 PT)

1. **Bulk Operation model & table** (see §5).
2. **POST `/api/v2/bulk/actions`**
   - Accepts `{ action, resourceType, resourceIds, params }`.
   - Validates that all resources exist and are in a valid state for the
     action (e.g., cannot "start" an already-running server).
   - Creates a `bulk_operations` row with status `pending`.
   - Enqueues an async job (Redis queue / in-process goroutine).
3. **Worker**
   - Pulls job, iterates over `resourceIds`.
   - For each item: calls the relevant service (e.g., `compute.start(serverId)`,
     `backup.create(serverId, params)`) and records result.
   - Updates progress counters in DB every N items.
   - On failure: continues remaining items (no fail-fast unless
     `failFast: true` flag is set).
   - On completion: sets `completed_at` and final status.
4. **GET endpoint** returns current progress, per-item results array.
5. **WebSocket** endpoint pushes `BulkProgressEvent` to connected clients.

### Phase 2 — Multi-Select UI & Action Bar (1–1.5 PT)

1. Extend `ServerTable` with per-row `<input type="checkbox">`.
2. Add a "Select all" checkbox in the header (toggles current page; option
   "Select all N items across all pages").
3. **BulkActionBar** — a sticky bar that appears when ≥ 1 item is selected.
   - Shows count ("3 servers selected").
   - Dropdown of applicable actions (filtered by resource state).
   - "Select all matching" button for cross-page selection.
4. **ConfirmationDialog** — shows summary of the action; allows optional
   parameters (e.g., backup retention days). Provides a "dry-run" toggle
   that lists items that would fail validation.

### Phase 3 — Progress & Rollback (1 PT)

1. **ProgressPanel** — a right-side drawer (or full-page route) opened
   automatically after confirmation.
   - Overall progress bar: `(completed + failed) / total`.
   - Per-item table: server name, status (pending / running / success /
     failed), error message.
   - Status colours with ARIA labels (F43 compliance).
2. **Rollback**
   - POST to `/rollback` triggers a new bulk operation that reverses the
     original actions (e.g., stop → start, tag-add → tag-remove).
   - Rollback operation is linked to the original via `rolled_back_from`.
   - Only available for actions that define a `revert` handler.

### Phase 4 — Action History (0.5 PT)

1. **History page/panel** — paginated table of past bulk operations.
2. Columns: date, action name, resource count, status (success / partial /
   failed), duration, rollback link.
3. Allows re-execution of the same action on the same resource set.

---

## 4. API Design

### Endpoints

| Method   | Path                                       | Description                         |
|----------|--------------------------------------------|-------------------------------------|
| `POST`   | `/api/v2/bulk/actions`                     | Start a new bulk operation          |
| `GET`    | `/api/v2/bulk/actions/:id`                 | Get operation status + results      |
| `POST`   | `/api/v2/bulk/actions/:id/cancel`          | Cancel a running operation          |
| `POST`   | `/api/v2/bulk/actions/:id/rollback`        | Rollback a completed/failed op      |
| `GET`    | `/api/v2/bulk/actions/history`             | List past operations (paginated)    |
| `WS`     | `/api/v2/bulk/actions/:id/stream`          | Live progress events                |

### Start Operation — Request

```json
POST /api/v2/bulk/actions
{
  "action": "start",
  "resourceType": "server",
  "resourceIds": ["srv-001", "srv-002", "srv-003"],
  "params": {},
  "failFast": false
}
```

### Start Operation — Response

```json
HTTP 202
{
  "id": "bulk-a1b2c3d4",
  "status": "pending",
  "total": 3,
  "completed": 0,
  "failed": 0,
  "createdAt": "2026-05-27T10:00:00Z"
}
```

### Progress Stream (WebSocket Event)

```json
{
  "type": "BulkProgressEvent",
  "operationId": "bulk-a1b2c3d4",
  "itemId": "srv-002",
  "status": "success",
  "completed": 2,
  "failed": 0,
  "total": 3,
  "timestamp": "2026-05-27T10:00:05Z"
}
```

---

## 5. Data Model

### PostgreSQL

```sql
CREATE TYPE bulk_action AS ENUM (
  'start', 'stop', 'reboot', 'backup',
  'tag', 'change_plan', 'decommission'
);

CREATE TYPE bulk_status AS ENUM (
  'pending', 'running', 'completed',
  'partial', 'failed', 'cancelled'
);

CREATE TABLE bulk_operations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action        bulk_action NOT NULL,
  resource_type VARCHAR(64) NOT NULL,
  resource_ids  UUID[] NOT NULL,
  params        JSONB NOT NULL DEFAULT '{}',
  status        bulk_status NOT NULL DEFAULT 'pending',
  progress      JSONB NOT NULL DEFAULT '{}',
  -- progress example: { "completed": 5, "failed": 1, "total": 50, "items": [{ "id": "srv-001", "status": "success" }, ...] }
  fail_fast     BOOLEAN NOT NULL DEFAULT false,
  rolled_back_from UUID REFERENCES bulk_operations(id),
  created_by    UUID NOT NULL REFERENCES users(id),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bulk_ops_created_by ON bulk_operations (created_by, created_at DESC);
```

### Per-Item Result (embedded in `progress.items`)

```typescript
interface BulkItemResult {
  resourceId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  error?: string;
  startedAt?: string;     // ISO
  completedAt?: string;   // ISO
  result?: unknown;       // action-specific payload
}
```

---

## 6. Service Assignments

| Service           | Role                                                              |
|-------------------|-------------------------------------------------------------------|
| Management Panel  | Multi-select UI, confirmation dialog, progress panel, history     |
| API Gateway       | Bulk action CRUD endpoints, WebSocket upgrade                     |
| Worker (async)    | Processes bulk operations sequentially per item                   |
| Database          | `bulk_operations` table                                           |
| Compute / Backup  | Target services that execute individual actions (called by worker)|

---

## 7. Effort Estimate

| Phase                         | Person-days |
|-------------------------------|-------------|
| Backend API & worker           | 2          |
| Multi-select UI & action bar   | 1–1.5      |
| Progress panel & rollback      | 1          |
| Action history                 | 0.5        |
| **Total**                      | **4–6**    |

---

## 8. Acceptance Criteria

1. [ ] User can select multiple servers via checkboxes (including "select all
       across pages").
2. [ ] Bulk action bar appears when ≥ 1 item is selected with valid actions.
3. [ ] Confirmation dialog shows action summary and accepts/rejects.
4. [ ] Progress panel updates in real-time via WebSocket.
5. [ ] Per-item success/failure is displayed.
6. [ ] Rollback is available for supported actions and creates a linked
       inverse operation.
7. [ ] Action history page lists all past operations with filtering.
8. [ ] Bulk operations can be cancelled while running.
9. [ ] Maximum tested scale: 500 servers per operation.
