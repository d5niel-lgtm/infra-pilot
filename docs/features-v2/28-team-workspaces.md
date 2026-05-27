# Feature 28: Team Workspaces

| Metadata | Value |
|----------|-------|
| Feature ID | 28 |
| Feature Name | Team Workspaces |
| Primary Service | Integration Service |
| Effort Estimate | Medium (4–6 PT) |
| Dependencies | Auth Service, Resource Manager, Approval Engine |
| Priority | High |

---

## 1. Overview

Team Workspaces provide isolated environments where teams manage their infrastructure resources collaboratively. Each workspace has its own member roster, resource quotas, activity audit trail, and sharing policies. Cross-workspace resource sharing is supported via an approval workflow.

### 1.1 Goals

- Enable multi-team isolation within a single Infra Pilot deployment
- Provide per-workspace resource quotas (servers, networks, etc.)
- Maintain a complete audit log of all workspace activity
- Support cross-workspace resource sharing with admin approval
- Simplify member management with role-based access

### 1.2 Non-Goals

- Hierarchical workspace nesting (flat model)
- Automatic resource rebalancing between workspaces
- Cross-workspace secret sharing
- Billing or cost allocation per workspace (future)

---

## 2. Architecture

### 2.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Gateway                                  │
└────────┬──────────┬──────────┬──────────┬───────────┬───────────────┘
         │          │          │          │           │
         ▼          ▼          ▼          ▼           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Integration Service                              │
│                                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐    │
│  │ Workspace    │  │ Membership   │  │ Cross-Workspace         │    │
│  │ Manager      │  │ Manager      │  │ Sharing Controller      │    │
│  │ - CRUD       │  │ - Invites    │  │ - Share requests        │    │
│  │ - Quotas     │  │ - Roles      │  │ - Approval routing      │    │
│  │ - Settings   │  │ - RBAC       │  │ - Revocation            │    │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬─────────────┘    │
│         │                 │                       │                  │
│         ▼                 ▼                       ▼                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Resource Binding Layer                                    │    │
│  │  Associates resources (servers, networks, etc.) with       │    │
│  │  a workspace. Enforces quota limits on creation.           │    │
│  └────────────────────────────────────────────────────────────┘    │
│         │                 │                       │                  │
└─────────┼─────────────────┼───────────────────────┼────────────────┘
          │                 │                       │
          ▼                 ▼                       ▼
┌─────────────┐  ┌──────────────────┐  ┌─────────────────────────┐
│  Database   │  │  Auth Service    │  │  Notification Service   │
│  - Metadata │  │  - Role checks   │  │  - Approval requests    │
│  - Audit    │  │  - Permission    │  │  - Member invites       │
│  - Quotas   │  │    resolution    │  │  - Quota alerts         │
└─────────────┘  └──────────────────┘  └─────────────────────────┘
```

### 2.2 Workspace Model

Each workspace is a top-level organizational unit:

```
Workspace
├── Members (users + roles)
│   ├── Owner (full control)
│   ├── Admin (manage members, modify settings)
│   ├── Member (create/manage own resources)
│   └── Viewer (read-only)
├── Resources
│   ├── Servers (bound to workspace)
│   ├── Networks (bound to workspace)
│   └── Other assets...
├── Quotas
│   ├── max_servers: 10
│   ├── max_cores: 32
│   ├── max_ram_gb: 128
│   └── max_networks: 5
├── Audit Log
│   └── entries: [timestamp, actor, action, detail]
└── Sharing
    ├── Incoming shares (resources shared TO this workspace)
    └── Outgoing shares (resources shared FROM this workspace)
```

---

## 3. Implementation Plan

### Phase 1: Core Workspace CRUD (PT 1.5–2)

| Task | Description |
|------|-------------|
| 1.1 | Define data models and migrations (workspaces, memberships, roles) |
| 1.2 | Implement workspace CRUD endpoints |
| 1.3 | Implement member management (add, remove, role change) |
| 1.4 | RBAC enforcement on all workspace-scoped operations |
| 1.5 | Workspace-scoped resource creation (bind resource to workspace) |

### Phase 2: Quotas & Audit (PT 1.5–2)

| Task | Description |
|------|-------------|
| 2.1 | Quota definition and enforcement middleware |
| 2.2 | Quota usage tracking (aggregated counts per resource type) |
| 2.3 | Audit log ingestion pipeline (intercept create/update/delete) |
| 2.4 | Audit log query API with filters (actor, action, time range) |
| 2.5 | Quota alerting (warn at 80%, block at 100%) |

### Phase 3: Cross-Workspace Sharing (PT 1–2)

| Task | Description |
|------|-------------|
| 3.1 | Share request API (source workspace → target workspace) |
| 3.2 | Approval workflow integration (target workspace admin approves) |
| 3.3 | Resource access delegation at the IAM/cloud level |
| 3.4 | Share revocation and cleanup |
| 3.5 | UI: sharing dashboard, pending requests, shared resources view |

---

## 4. API Design

### 4.1 Workspace Endpoints

```
POST   /api/v2/workspaces                          Create workspace
GET    /api/v2/workspaces                           List user's workspaces
GET    /api/v2/workspaces/:id                       Get workspace details
PUT    /api/v2/workspaces/:id                       Update workspace settings
DELETE /api/v2/workspaces/:id                       Delete workspace (empty only)

POST   /api/v2/workspaces/:id/members               Add member
GET    /api/v2/workspaces/:id/members               List members
PUT    /api/v2/workspaces/:id/members/:userId       Change role
DELETE /api/v2/workspaces/:id/members/:userId       Remove member

GET    /api/v2/workspaces/:id/quotas                Get quota limits & usage
PUT    /api/v2/workspaces/:id/quotas                Update quota limits (admin)

GET    /api/v2/workspaces/:id/audit                 Query audit log
```

### 4.2 Cross-Workspace Sharing Endpoints

```
POST   /api/v2/workspace-shares                     Create share request
GET    /api/v2/workspace-shares                      List shares (in/out)
GET    /api/v2/workspace-shares/:id                  Get share details
PUT    /api/v2/workspace-shares/:id/approve          Approve share
PUT    /api/v2/workspace-shares/:id/reject           Reject share
DELETE /api/v2/workspace-shares/:id                  Revoke/withdraw share
```

### 4.3 Request/Response Examples

**Create Workspace:**
```json
POST /api/v2/workspaces
{
  "name": "production-sre",
  "display_name": "Production SRE Team",
  "description": "Workspace for the Production SRE squad",
  "settings": {
    "default_resource_ttl_hours": 48,
    "require_approval_for_destructive_actions": true
  }
}

Response 201:
{
  "id": "ws_prod_sre",
  "name": "production-sre",
  "display_name": "Production SRE Team",
  "created_by": "u_admin",
  "created_at": "2026-05-27T12:00:00Z",
  "member_count": 1,
  "quota_usage": { "servers": 0, "cores": 0, "ram_gb": 0 }
}
```

**Add Member:**
```json
POST /api/v2/workspaces/ws_prod_sre/members
{
  "user_id": "u_alice",
  "role": "member"
}

Response 201:
{
  "workspace_id": "ws_prod_sre",
  "user_id": "u_alice",
  "role": "member",
  "added_by": "u_admin",
  "added_at": "2026-05-27T12:05:00Z"
}
```

**Create Share Request:**
```json
POST /api/v2/workspace-shares
{
  "source_workspace_id": "ws_dev_team",
  "target_workspace_id": "ws_prod_sre",
  "resource_type": "server",
  "resource_id": "srv-dev-db-01",
  "permissions": ["read"],
  "reason": "Production SRE needs read access to debug DB latency",
  "expires_at": "2026-06-27T00:00:00Z"
}

Response 201:
{
  "id": "share_xyz789",
  "status": "pending_approval",
  "requested_by": "u_bob",
  "created_at": "2026-05-27T12:10:00Z"
}
```

**List Audit Log:**
```json
GET /api/v2/workspaces/ws_prod_sre/audit?limit=10&offset=0

Response 200:
{
  "entries": [
    {
      "timestamp": "2026-05-27T12:05:00Z",
      "actor": "u_admin",
      "action": "member.add",
      "detail": { "target_user": "u_alice", "role": "member" }
    },
    {
      "timestamp": "2026-05-27T11:00:00Z",
      "actor": "u_admin",
      "action": "workspace.create",
      "detail": { "name": "production-sre" }
    }
  ],
  "total": 2
}
```

---

## 5. Data Model

### 5.1 `workspaces`

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(32) (PK) | Human-readable slug (e.g., `ws_prod_sre`) |
| name | VARCHAR(128) | Display name |
| description | TEXT | Optional description |
| settings | JSONB | Feature flags, TTLs, policies |
| created_by | UUID (FK → users) | Creator |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last modification |
| deleted_at | TIMESTAMPTZ | Soft delete (nullable) |

### 5.2 `workspace_members`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| workspace_id | VARCHAR(32) (FK) | Parent workspace |
| user_id | UUID (FK → users) | Member |
| role | ENUM | `owner`, `admin`, `member`, `viewer` |
| invited_by | UUID (FK → users) | Who invited |
| joined_at | TIMESTAMPTZ | When membership was activated |
| updated_at | TIMESTAMPTZ | Role change timestamp |

### 5.3 `workspace_quotas`

| Column | Type | Description |
|--------|------|-------------|
| workspace_id | VARCHAR(32) (PK/FK) | Parent workspace |
| max_servers | INT | Default: 10 |
| max_cores | INT | Default: 32 |
| max_ram_gb | INT | Default: 128 |
| max_networks | INT | Default: 5 |
| max_storage_gb | INT | Default: 500 |
| updated_by | UUID (FK → users) | Last modifier |
| updated_at | TIMESTAMPTZ | Last modification |

### 5.4 `workspace_audit_log`

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL (PK) | Auto-increment |
| workspace_id | VARCHAR(32) (FK) | Parent workspace |
| actor_id | UUID (FK → users) | Who performed the action |
| action | VARCHAR(64) | e.g., `workspace.create`, `member.add`, `resource.delete` |
| detail | JSONB | Action-specific payload |
| ip_address | INET | Originating IP |
| created_at | TIMESTAMPTZ | When action occurred |

### 5.5 `workspace_shares`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| source_workspace_id | VARCHAR(32) (FK) | Owning workspace |
| target_workspace_id | VARCHAR(32) (FK) | Receiving workspace |
| resource_type | VARCHAR(64) | e.g., `server`, `network` |
| resource_id | VARCHAR(128) | Identifier of shared resource |
| permissions | TEXT[] | Array of granted permissions |
| status | ENUM | `pending_approval`, `approved`, `rejected`, `revoked` |
| requested_by | UUID (FK → users) | Requester |
| approved_by | UUID (FK → users, nullable) | Approver |
| approved_at | TIMESTAMPTZ | When approved |
| expires_at | TIMESTAMPTZ | When share auto-revokes |
| reason | TEXT | Justification for share |
| created_at | TIMESTAMPTZ | Creation timestamp |

---

## 6. Service Assignments

| Service | Responsibilities |
|---------|-----------------|
| **Integration Service** (primary) | Workspace CRUD, member management, quota enforcement, audit pipeline, cross-workspace sharing logic |
| **Auth Service** | Role resolution, permission checks for workspace-scoped actions |
| **Resource Manager** | Resource-to-workspace binding, quota validation on resource creation |
| **Notification Service** | Invite emails, approval request notifications, quota warning alerts |
| **Database** | All workspace metadata, membership, quotas, audit log, share records |

---

## 7. Quota Enforcement Flow

```
Request: Create Server in Workspace "ws_prod_sre"
  │
  ▼
1. Resource Manager calls Integration Service: check_quota(ws_prod_sre, "server")
  │
  ▼
2. Integration Service reads current usage:
     SELECT COUNT(*) FROM resources WHERE workspace_id = 'ws_prod_sre' AND type = 'server'
  │
  ▼
3. Compare against workspace_quotas.max_servers for ws_prod_sre
  │
  ▼
4. If usage < quota → allow; else → return 403 with quota_exceeded error
```

---

## 8. Effort Estimate

| Phase | Person-Days |
|-------|-------------|
| Phase 1: Core Workspace CRUD | 1.5–2 PT |
| Phase 2: Quotas & Audit | 1.5–2 PT |
| Phase 3: Cross-Workspace Sharing | 1–2 PT |
| **Total** | **4–6 PT** |

---

## 9. Future Enhancements

- Hierarchical workspaces (sub-workspaces with inherited quotas)
- Usage dashboards with billing/cost allocation
- Workspace templates (pre-configured quotas + member roles)
- SAML/SCIM group sync for workspace membership
- Automated resource cleanup based on TTL policies
