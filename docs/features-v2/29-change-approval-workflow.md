# Feature 29: Change Approval Workflow

| Metadata | Value |
|----------|-------|
| Feature ID | 29 |
| Feature Name | Change Approval Workflow |
| Primary Service | Management Panel |
| Effort Estimate | Medium (4–6 PT) |
| Dependencies | Auth Service, Notification Service, Slack/Discord Bot |
| Priority | High |

---

## 1. Overview

The Change Approval Workflow introduces a mandatory second-person approval gate for destructive or sensitive infrastructure actions. When a user attempts an action covered by policy (e.g., deleting a server, modifying a firewall, restarting a production service), a change request is created and routed to designated approvers via Slack or Discord interactive buttons. An emergency break-glass mechanism bypasses approval for critical incidents.

### 1.1 Goals

- Prevent accidental destructive actions via mandatory peer review
- Support flexible approval policies (action-based, resource-based, tag-based)
- Integrate approvals into Slack/Discord where operators already work
- Maintain a complete, immutable audit trail of all change requests
- Provide emergency break-glass with justification logging

### 1.2 Non-Goals

- Replace CI/CD pipelines or change management systems (ServiceNow, etc.)
- Support multi-step or sequential approval chains (single approval required)
- Automated rollback on approval denial
- Approval based on scheduled maintenance windows

---

## 2. Architecture

### 2.1 High-Level Diagram

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────┐
│   User       │     │  Management      │     │  Approver    │
│   (Browser)  │     │  Panel           │     │  (Slack/DM)  │
└──────┬───────┘     └──────┬───────────┘     └──────┬────────┘
       │                    │                         │
       │  1. Destructive    │                         │
       │     action request │                         │
       │───────────────────►│                         │
       │                    │  2. Check policy        │
       │                    │  ───────►               │
       │                    │                         │
       │                    │  3. If requires approval│
       │                    │  ┌─────────────────┐    │
       │                    │  │ Change Request   │    │
       │                    │  │ Engine           │    │
       │                    │  │  - Create ticket │    │
       │                    │  │  - Route to      │    │
       │                    │  │    approver(s)   │    │
       │                    │  │  - Set status    │    │
       │                    │  │    = pending     │    │
       │                    │  └────────┬────────┘    │
       │                    │           │              │
       │                    │           │  4. Notification
       │                    │           │  (Slack/Discord)
       │                    │           │────────────►│
       │                    │           │              │
       │                    │           │  5. Approve/Reject
       │                    │           │  (button click)
       │                    │           │◄─────────────│
       │                    │           │              │
       │                    │  6. Webhook callback     │
       │                    │  ◄────────               │
       │                    │                          │
       │  7. Execute/Deny   │                          │
       │◄───────────────────┤                          │
       │                    │                          │
```

### 2.2 Component Descriptions

| Component | Role | Technology |
|-----------|------|------------|
| Policy Engine | Evaluates whether an action requires approval | Go / Node.js rules engine |
| Change Request Engine | Manages request lifecycle (create, approve, reject, cancel) | Management Panel |
| Notification Adapter | Sends approval requests to Slack/Discord via webhooks | Integration Service |
| Interactive Message Handler | Receives button-clicks from Slack/Discord | Webhook endpoint |
| Break-Glass Controller | Handles emergency bypass with justification | Management Panel |
| Audit Recorder | Immutable log of all change requests and decisions | Database |

### 2.3 Approval Policy Model

Policies are evaluated in order. The first matching policy determines the action:

```yaml
policies:
  - name: "block-prod-server-delete"
    match:
      action: "server.delete"
      resource_tags:
        environment: "production"
    requires_approval: true
    approver_roles: ["admin", "owner"]
    notification_channels: ["slack", "discord"]
    cooldown_seconds: 300  # Re-approval needed within this window

  - name: "block-firewall-modify"
    match:
      action: "firewall.modify"
    requires_approval: true
    approver_roles: ["admin"]
    notification_channels: ["slack"]

  - name: "block-prod-restart"
    match:
      action: "server.restart"
      resource_tags:
        environment: "production"
        criticality: "high"
    requires_approval: true
    approver_roles: ["admin", "owner"]
    notification_channels: ["slack", "discord"]
```

---

## 3. Implementation Plan

### Phase 1: Policy Engine & Change Request CRUD (PT 1.5–2)

| Task | Description |
|------|-------------|
| 1.1 | Design data models for approval policies and change requests |
| 1.2 | Implement policy definition CRUD (YAML/JSON stored in DB) |
| 1.3 | Build policy evaluation engine (action + resource attributes → match) |
| 1.4 | Implement change request lifecycle (create, get, list, cancel) |
| 1.5 | Add approval interceptor middleware in Management Panel action execution |

### Phase 2: Slack/Discord Integration (PT 1.5–2)

| Task | Description |
|------|-------------|
| 2.1 | Build Slack Block Kit message builder for approval requests |
| 2.2 | Build Discord embed builder for approval requests |
| 2.3 | Implement interactive webhook endpoint (Slack `interactivity` + Discord `interaction`) |
| 2.4 | Map button clicks to approve/reject/cancel actions |
| 2.5 | Handle notification failures (timeout, fallback to in-app approval) |

### Phase 3: Audit, Break-Glass & UI (PT 1–2)

| Task | Description |
|------|-------------|
| 3.1 | Immutable audit log for all change requests + decisions |
| 3.2 | Break-glass mechanism: justification form → bypass → audit record |
| 3.3 | In-app approval dashboard (pending/approved/rejected requests) |
| 3.4 | Policy management UI (create/edit/test policies) |
| 3.5 | Cooldown/cache layer to prevent duplicate approvals within window |

---

## 4. API Design

### 4.1 Approval Policy Endpoints

```
POST   /api/v2/approval-policies                 Create policy
GET    /api/v2/approval-policies                  List policies
GET    /api/v2/approval-policies/:id              Get policy details
PUT    /api/v2/approval-policies/:id              Update policy
DELETE /api/v2/approval-policies/:id              Delete policy
POST   /api/v2/approval-policies/:id/test         Dry-run: test action against policy
```

### 4.2 Change Request Endpoints

```
POST   /api/v2/change-requests                   Create change request (auto-triggered)
GET    /api/v2/change-requests                    List user's change requests
GET    /api/v2/change-requests/:id                Get request details
POST   /api/v2/change-requests/:id/approve        Approve
POST   /api/v2/change-requests/:id/reject         Reject
POST   /api/v2/change-requests/:id/cancel         Cancel own request
POST   /api/v2/change-requests/:id/break-glass    Emergency bypass
```

### 4.3 Slack/Discord Webhook Endpoints

```
POST   /api/v2/webhooks/slack/interactive         Slack interactivity payload
POST   /api/v2/webhooks/discord/interaction       Discord interaction payload
```

### 4.4 Request/Response Examples

**Create Change Request (auto-triggered by middleware):**
```json
POST /api/v2/change-requests
{
  "action": "server.delete",
  "resource_id": "srv-prod-api-01",
  "resource_type": "server",
  "resource_tags": {
    "environment": "production",
    "team": "platform"
  },
  "requested_by": "u_bob",
  "policy_id": "pol_block_prod_server_delete",
  "justification": "Decommissioning old API server after migration to v2"
}

Response 201:
{
  "id": "cr_a1b2c3",
  "status": "pending",
  "policy_name": "block-prod-server-delete",
  "approvers": ["u_alice", "u_carol"],
  "created_at": "2026-05-27T12:00:00Z",
  "notification_sent": true,
  "channels": ["slack", "discord"]
}
```

**Slack Interactive Payload (incoming webhook):**
```json
POST /api/v2/webhooks/slack/interactive
{
  "type": "block_actions",
  "team": { "id": "T12345" },
  "user": { "id": "U67890", "name": "alice" },
  "actions": [
    {
      "action_id": "approve_cr_a1b2c3",
      "block_id": "cr_a1b2c3",
      "value": "approve"
    }
  ]
}
```

**Slack Message (sent to approvers):**
```json
{
  "blocks": [
    { "type": "header", "text": { "type": "plain_text", "text": "🔒 Approval Required" } },
    { "type": "section", "text": { "type": "mrkdwn", "text": "*User:* Bob\n*Action:* Delete Server\n*Resource:* `srv-prod-api-01`\n*Justification:* Decommissioning after migration to v2" } },
    { "type": "actions", "elements": [
      { "type": "button", "text": { "type": "plain_text", "text": "✅ Approve" }, "style": "primary", "action_id": "approve_cr_a1b2c3", "value": "approve" },
      { "type": "button", "text": { "type": "plain_text", "text": "❌ Reject" }, "style": "danger", "action_id": "reject_cr_a1b2c3", "value": "reject" },
      { "type": "button", "text": { "type": "plain_text", "text": "🔍 View Details" }, "url": "https://panel.example.com/change-requests/cr_a1b2c3" }
    ]}
  ]
}
```

**Approve Request:**
```json
POST /api/v2/change-requests/cr_a1b2c3/approve
{
  "approved_by": "u_alice",
  "comment": "Migration confirmed complete, proceed with decommission"
}

Response 200:
{
  "id": "cr_a1b2c3",
  "status": "approved",
  "approved_by": "u_alice",
  "approved_at": "2026-05-27T12:05:00Z"
}
```

**Break-Glass:**
```json
POST /api/v2/change-requests/cr_a1b2c3/break-glass
{
  "bypassed_by": "u_bob",
  "incident_id": "inc_20260527_001",
  "justification": "Production outage - need immediate server recycle",
  "acknowledged_risk": true
}

Response 200:
{
  "id": "cr_a1b2c3",
  "status": "break_glass_bypassed",
  "bypassed_at": "2026-05-27T12:10:00Z",
  "audit_recorded": true
}
```

---

## 5. Data Model

### 5.1 `approval_policies`

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(64) (PK) | Human-readable slug |
| name | VARCHAR(128) | Policy display name |
| enabled | BOOLEAN | Whether policy is active |
| match_conditions | JSONB | Action + resource attribute matchers |
| requires_approval | BOOLEAN | Whether approval is required |
| approver_roles | TEXT[] | Roles eligible to approve |
| notification_channels | TEXT[] | `slack`, `discord`, `in_app` |
| cooldown_seconds | INT | Re-approval window |
| created_by | UUID (FK → users) | Policy creator |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last modification |

### 5.2 `change_requests`

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(64) (PK) | e.g., `cr_a1b2c3` |
| policy_id | VARCHAR(64) (FK) | Matched policy |
| action | VARCHAR(64) | e.g., `server.delete` |
| resource_id | VARCHAR(128) | Target resource |
| resource_type | VARCHAR(64) | e.g., `server` |
| resource_tags | JSONB | Tags at time of request |
| requested_by | UUID (FK → users) | Requester |
| justification | TEXT | Why the action is needed |
| status | ENUM | `pending`, `approved`, `rejected`, `cancelled`, `break_glass_bypassed`, `expired` |
| approved_by | UUID (FK → users, nullable) | Approver |
| approved_at | TIMESTAMPTZ | Approval timestamp |
| rejected_by | UUID (FK → users, nullable) | Rejector |
| rejected_at | TIMESTAMPTZ | Rejection timestamp |
| rejected_reason | TEXT | Reason for rejection |
| break_glass_by | UUID (FK → users, nullable) | Who bypassed |
| break_glass_at | TIMESTAMPTZ | When bypassed |
| break_glass_reason | TEXT | Justification for bypass |
| incident_id | VARCHAR(64) | Associated incident (break-glass) |
| notification_sent | BOOLEAN | Whether Slack/Discord was notified |
| created_at | TIMESTAMPTZ | Creation |
| updated_at | TIMESTAMPTZ | Last update |
| expires_at | TIMESTAMPTZ | Auto-expiry (default: 1 hour) |

### 5.3 `approval_audit_log`

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL (PK) | Auto-increment |
| change_request_id | VARCHAR(64) (FK) | Related CR |
| action | VARCHAR(32) | `created`, `approved`, `rejected`, `cancelled`, `break_glass` |
| actor_id | UUID (FK → users) | Who performed the action |
| detail | JSONB | Additional context |
| ip_address | INET | Originating IP |
| created_at | TIMESTAMPTZ | Immutable timestamp |

---

## 6. Service Assignments

| Service | Responsibilities |
|---------|-----------------|
| **Management Panel** (primary) | Policy engine, change request lifecycle, approval interceptor middleware, break-glass controller, audit recorder |
| **Auth Service** | Role resolution for approver matching |
| **Notification Service** | Slack/Discord message delivery |
| **Slack Bot** | Interactive button handling, webhook endpoint |
| **Discord Bot** | Interaction handling, webhook endpoint |
| **Database** | Policy storage, change requests, audit log |

---

## 7. Approval Flow (Detailed)

```
1. User initiates destructive action in Management Panel
2. Middleware intercepts action before execution
3. Policy engine evaluates action + resource attributes
   ├── No matching policy → action proceeds normally
   └── Policy matched → approval required
        ├── Check cooldown: if < cooldown_seconds since last approval for same resource → skip
        └── Create change request (status: pending)
             ├── Determine eligible approvers (role-based)
             ├── Send notification to Slack/Discord with interactive buttons
             └── Return 202 Accepted with change request ID to requester

4. Approver clicks "Approve" in Slack/Discord
   └── Webhook received → validate user is eligible approver
        ├── Yes → update status to "approved", execute original action
        └── No → return error notification

5. If no response within expiry (default 1 hour):
   └── Status → "expired", requester notified to resubmit

6. Emergency:
   └── Break-glass bypass → records justification, updates status, executes action
       └── Alert all admins: break-glass was used
```

---

## 8. Effort Estimate

| Phase | Person-Days |
|-------|-------------|
| Phase 1: Policy Engine & Change Request CRUD | 1.5–2 PT |
| Phase 2: Slack/Discord Integration | 1.5–2 PT |
| Phase 3: Audit, Break-Glass & UI | 1–2 PT |
| **Total** | **4–6 PT** |

---

## 9. Future Enhancements

- Multi-step approval chains (N of M approvers)
- Time-based policies (require approval only during off-hours)
- Integration with PagerDuty on-call for approver routing
- Webhook notifications for external change management tools
- Scheduled change requests with automatic execution window
