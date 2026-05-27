# Feature 47: Secrets Management

- **Feature ID:** 47
- **Status:** Planned
- **Priority:** Critical
- **Primary Service:** Integration Service
- **Supporting Services:** Orchestrator Agent, API Gateway, Auth Service
- **Effort:** Medium (4–6 PT)
- **Dependencies:** Auth Service (RBAC), Orchestrator Agent (container injection)

---

## 1. Overview

Integrate HashiCorp Vault as the central secrets backend. Provide dynamic secrets (short-lived credentials), automated database credential rotation, and encrypted environment variable injection into containers at deployment time. All secret access is audited.

---

## 2. Architecture

```
                               ┌──────────────────────┐
                               │   HashiCorp Vault     │
                               │  ┌──────────────────┐ │
                               │  │ Transit Engine    │ │
                               │  │ KV Engine         │ │
                               │  │ Database Engine   │ │
                               │  │ PKI Engine        │ │
                               │  └──────────────────┘ │
                               └──────────┬───────────┘
                                          │
┌─────────────────────────────────────────┼──────────────────────────┐
│            Integration Service          │                           │
│  ┌──────────────────────┐  ┌───────────▼──────────┐              │
│  │  Vault Client SDK    │  │  Rotation Manager     │              │
│  │  • Token/Auth        │  │  • Schedule & detect   │              │
│  │  • Lease management  │  │  • Force rotation      │              │
│  │  • Dynamic secrets   │  │  • Notify consumers    │              │
│  └──────────────────────┘  └───────────────────────┘              │
│  ┌──────────────────────┐  ┌───────────────────────┐              │
│  │  Env Injection API   │  │  Audit Logger          │              │
│  │  • Encrypt env vars  │  │  • All access logged   │              │
│  │  • Container attach  │  │  • Immutable audit     │              │
│  │  • Sidecar inject    │  │  • SIEM export         │              │
│  └──────────────────────┘  └───────────────────────┘              │
└────────────────────────────────────────────────────────────────────┘
           │                              │
           ▼                              ▼
┌──────────────────────┐    ┌────────────────────────────┐
│  Orchestrator Agent   │    │     External Systems        │
│  • Inject secrets     │    │  • Databases (Postgres,    │
│  • Sidecar container  │    │    MySQL, MongoDB)          │
│  • Rotate on deploy   │    │  • Cloud APIs (AWS, GCP)   │
│  • Cleanup leases     │    │  • SMTP / LDAP             │
└──────────────────────┘    └────────────────────────────┘
```

**Data Flow:**

1. **Authentication** — Integration Service authenticates to Vault using Kubernetes service account JWT (or AppRole). A short-lived Vault token is issued.
2. **Dynamic Secret Request** — When a deployment is created, the Integration Service requests dynamic credentials from Vault (e.g., database user with a 24h TTL).
3. **Rotation** — The Rotation Manager monitors credential TTLs. When a secret is 25% from expiry, a rotation is triggered: new credentials are issued, the old ones are revoked after a cooldown window.
4. **Injection** — Secrets are encrypted with the Vault Transit Engine and injected into the deployment manifest as environment variables or volume mounts via a sidecar.
5. **Audit** — Every secret access is logged to the audit store. Logs include requester identity, secret path, operation type, and timestamp.

---

## 3. Implementation Plan

### Phase 1 — Vault Integration (2 PT)
| Step | Description |
|------|-------------|
| 1.1  | Deploy Vault cluster (HA mode with Raft backend) |
| 1.2  | Implement Vault client SDK wrapper (auth, CRUD, lease mgmt) |
| 1.3  | Set up Kubernetes auth method for pod-level authentication |
| 1.4  | Create KV engine for static secrets migration |

### Phase 2 — Dynamic Secrets (1.5 PT)
| Step | Description |
|------|-------------|
| 2.1  | Configure Vault Database engine for Postgres & MySQL |
| 2.2  | Implement dynamic secret request API |
| 2.3  | Add lease lifecycle management (renew, revoke) |

### Phase 3 — Rotation (1 PT)
| Step | Description |
|------|-------------|
| 3.1  | Rotation Manager — schedule-based and event-based triggers |
| 3.2  | Database credential rotation with connection draining |
| 3.3  | Rotation notification webhook |

### Phase 4 — Injection & Audit (1.5 PT)
| Step | Description |
|------|-------------|
| 4.1  | Encrypted env injection via Kubernetes Mutation Webhook |
| 4.2  | Vault Agent sidecar injector |
| 4.3  | Audit log pipeline (Vault audit → Kafka → S3 / SIEM) |
| 4.4  | Access control policies (path-based RBAC) |

---

## 4. API Design

### 4.1 Secret Operations

```
POST   /api/v1/secrets                   → Create / store a static secret
GET    /api/v1/secrets/{path}            → Read secret (audited)
PUT    /api/v1/secrets/{path}            → Update secret
DELETE /api/v1/secrets/{path}            → Delete / revoke secret
POST   /api/v1/secrets/{path}/rotate     → Force rotation
```

### 4.2 Dynamic Secrets

```
POST   /api/v1/secrets/dynamic           → Request dynamic credentials
  Body: { engine: "database"|"aws"|"pki", ttl: "24h", role: "readonly" }

POST   /api/v1/secrets/dynamic/{id}/renew    → Renew lease
POST   /api/v1/secrets/dynamic/{id}/revoke   → Revoke immediately
```

### 4.3 Injection

```
POST   /api/v1/secrets/inject            → Inject secrets into deployment manifest
  Body: { deployment_id, secrets: [{ path, env_var }] }
```

### 4.4 Audit

```
GET    /api/v1/secrets/audit             → Query audit log
  Params: secret_path, user_id, start_date, end_date, page, limit
```

### 4.5 Example: Request Dynamic Database Credentials

```json
POST /api/v1/secrets/dynamic
{
  "engine": "database",
  "role": "app_readwrite",
  "ttl": "24h",
  "metadata": {
    "app_id": "user-service",
    "environment": "production"
  }
}

Response 201:
{
  "lease_id": "db/app_readwrite/a1b2c3d4",
  "credentials": {
    "username": "v-app-uuid-abc123",
    "password": "********",
    "host": "postgres-primary.internal:5432",
    "database": "app_production"
  },
  "lease_duration": "24h",
  "renewable": true,
  "expires_at": "2026-05-28T12:00:00Z"
}
```

---

## 5. Data Model

### 5.1 Secret

```yaml
Secret:
  path: string                            # "kv/app/production/db-password"
  type: string                            # "static" | "dynamic" | "pki"
  engine: string                          # "kv-v2" | "database" | "transit" | "pki"
  metadata:
    created_by: string
    rotation_policy: string               # "never" | "30d" | "90d"
    last_rotated: timestamp
  version: integer
  created_at: timestamp
  updated_at: timestamp
```

### 5.2 Lease

```yaml
Lease:
  id: string                              # Vault lease ID
  secret_path: string
  type: string                            # "database" | "aws" | "pki"
  ttl: duration
  renewable: boolean
  issued_at: timestamp
  expires_at: timestamp
  last_renewed_at: timestamp
  status: string                          # "active" | "expiring" | "revoked"
```

### 5.3 Audit Entry

```yaml
AuditEntry:
  id: string (uuid)
  timestamp: timestamp
  user_id: string
  service_account: string
  secret_path: string
  operation: string                       # "read" | "write" | "delete" | "rotate" | "renew"
  allowed: boolean
  client_ip: string
  request_id: string
  metadata: object
```

### 5.4 Rotation Policy

```yaml
RotationPolicy:
  id: string (uuid)
  secret_path_pattern: string             # "db/*/production/*"
  schedule: string                        # "0 0 */30 * *" (cron) or "75%"
  max_ttl: duration
  cooldown: duration                       # Grace period before revoking old creds
  notify_on_rotation: list<string>        # Email/webhook targets
```

---

## 6. Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Integration Service** | Vault client SDK, dynamic secret lifecycle, rotation manager, audit logging |
| **Orchestrator Agent** | Vault sidecar injector, Kubernetes MutatingWebhookConfiguration for env injection |
| **API Gateway** | Route /api/v1/secrets/*, enforce mTLS between services and Vault |
| **Auth Service** | Vault Kubernetes auth integration, path-based access policies |
| **Compliance (Feature 46)** | Consume audit logs for SOC 2 CC6.1 (Logical and Physical Access Control) evidence |

---

## 7. Effort Estimate

| Phase | PT | Dependencies |
|-------|----|--------------|
| Vault Integration | 2 | Cluster deployment, client SDK, auth methods |
| Dynamic Secrets | 1.5 | Database engine, lease lifecycle |
| Rotation | 1 | Rotation manager, connection draining |
| Injection & Audit | 1.5 | Webhook injector, audit pipeline |
| **Total** | **6** | Ranges 4–6 depending on Vault HA complexity |

---

## 8. Open Questions

- Should we support cloud-native secret stores (AWS Secrets Manager / GCP Secret Manager) as a fallback?
- What is the strategy for Vault unsealing in production (auto-unseal with KMS vs Shamir)?
- How do we handle cross-cluster secret replication for DR?
- Should the rotation manager force rotation on security incidents (e.g., credential leak)?
- What is the performance impact of the MutatingWebhook on deployment latency?
