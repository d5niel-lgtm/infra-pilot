# Feature 22: Serverless Functions (FaaS)

- **Plan ID:** #22
- **Category:** Advanced Infrastructure
- **Primary Service:** Orchestrator Agent
- **Effort:** Large (7-10 PT)
- **Dependencies:** Feature 19 (Kubernetes Cluster Manager), Feature 21 (Edge Compute Nodes)

## Overview

Knative/OpenFaaS integration enabling serverless function deployment from Git repositories. Functions auto-scale to zero when idle, scale up on demand, and are billed per-invocation. Supports multiple runtimes (Node.js, Python, Go, Rust, Java), event triggers (HTTP, Pub/Sub, cron), and seamless integration with the Infra Pilot ecosystem.

### Key Capabilities

| Capability | Description |
|---|---|
| Function Registry | Central registry for functions with versioning, tags, and metadata |
| Git-Based Deploy | Connect Git repos — auto-build and deploy on push via webhooks |
| Auto-Scaling to Zero | Scale down when idle (Knative/OpenFaaS), cold-start optimization |
| Per-Invocation Billing | Track invocations, duration, resource usage for granular billing |
| Multiple Runtimes | Node.js, Python, Go, Rust, Java, custom container images |
| Event Triggers | HTTP endpoints, CloudEvents, cron schedules, queue-based triggers |
| Invocation Metrics | Duration, memory, concurrency, error rates, cold start frequency |

---

## Architecture

### System Context

```
┌──────────────────────────────────────────────────────────────┐
│                   Infra Pilot FaaS Platform                    │
│                                                                │
│  ┌────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Panel     │    │ Orchestrator │    │   K8s Cluster    │  │
│  │  (React)    │───▶│   Agent      │───▶│  (Knative/OF)   │  │
│  └────────────┘    │              │    │                  │  │
│       │            │  ┌─────────┐ │    │  ┌────────────┐  │  │
│       │            │  │ Function│ │    │  │  Functions │  │  │
│       │            │  │ Manager │ │    │  │  (pods)    │  │  │
│       │            │  └────┬────┘ │    │  └────────────┘  │  │
│       │            │       │      │    │  ┌────────────┐  │  │
│       └────────────┼──┐ ┌──┘      │    │  │   Queue    │  │  │
│                    │  │ │         │    │  │  (NATS/Kafka)│  │  │
│  ┌────────────┐    │  │ │         │    │  └────────────┘  │  │
│  │   Git       │    │  │ │         │    └──────────────────┘  │
│  │  (Webhook)  │────┼──┘ │         │                         │
│  └────────────┘    │    │         │    ┌──────────────────┐  │
│                    │  ┌─▼───────┐ │    │   Billing Engine │  │
│  ┌────────────┐    │  │ Billing │ │    │  (per-invocation)│  │
│  │  Registry   │    │  │ Bridge  │ │    └──────────────────┘  │
│  │  (Docker)   │────┼──┤         │ │                         │
│  └────────────┘    │  └─────────┘ │    ┌──────────────────┐  │
│                    │              │    │   Metrics Store  │  │
│  ┌────────────┐    │  ┌─────────┐ │    │  (Prometheus)   │  │
│  │  Monitoring │    │  │ Metrics │ │    └──────────────────┘  │
│  │  (Grafana)  │    │  │ Exporter│ │                         │
│  └────────────┘    │  └─────────┘ │                         │
│                    └──────────────┘                         │
└──────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
┌──────────────────────────────────────────────────────┐
│              Function Manager (Orchestrator Agent)     │
├──────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────┐  ┌────────────────────────┐    │
│  │ Function Registry │  │ Git Integration        │    │
│  │                   │  │                        │    │
│  │ - CRUD functions  │  │ - Webhook receiver     │    │
│  │ - Version mgmt    │  │ - Auto-build pipeline  │    │
│  │ - Tags/aliases    │  │ - Deploy on push       │    │
│  └────────┬─────────┘  └───────────┬────────────┘    │
│           │                        │                  │
│  ┌────────▼────────────────────────▼────────────┐    │
│  │              Knative / OpenFaaS Adapter       │    │
│  │  (abstracts underlying FaaS engine)           │    │
│  └────────────────────┬─────────────────────────┘    │
│                       │                              │
│  ┌────────────────────▼─────────────────────────┐    │
│  │           Invocation Pipeline                  │    │
│  │                                                │    │
│  │  Ingress → Route → Auth → Rate Limit → Exec   │    │
│  └────────────────────┬─────────────────────────┘    │
│                       │                              │
│  ┌────────────────────▼─────────────────────────┐    │
│  │           Billing Collector                    │    │
│  │  (count invocations, duration, resources)     │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

### Interaction Flow

```
Git-Based Deploy:

    Developer pushes code to GitHub
        │
        ▼
    Git webhook → Orchestrator Agent
        │
        ▼
    1. Clone repository
    2. Detect runtime (Dockerfile, buildpack)
    3. Build image → push to registry
    4. Create/Update Knative Service
    5. Configure triggers (HTTP, cron, event)
    6. Update function status in registry
        │
        ▼
    Panel notification: "Function v2 deployed"

Function Invocation:

    Client
        │
        ▼
    HTTPS → API Gateway → Orchestrator Agent
        │
        ├── Rate limit check
        ├── Auth validation
        ├── Route to function
        │
        ▼
    Knative/OpenFaaS
        │
        ├── Cold start? → Scale from 0 → allocate pod
        ├── Execute function
        ├── Capture: duration, memory, status
        │
        ▼
    Response → Client
        │
        ▼
    Billing: record invocation (function_id, user_id, duration_ms, mem_mb)
```

---

## Implementation Plan

### Phase 1: Function Registry & CRUD (2 PT)

| Task | Description |
|---|---|
| 1.1 | Function metadata model and database schema |
| 1.2 | CRUD API for functions (create, read, update, delete, list) |
| 1.3 | Function versioning (semver tags, alias management) |
| 1.4 | Runtime detection and validation (supported runtimes, buildpacks) |
| 1.5 | Secrets and environment variable management for functions |

### Phase 2: Git Integration (2 PT)

| Task | Description |
|---|---|
| 2.1 | Git webhook receiver (GitHub/GitLab/Bitbucket) |
| 2.2 | Auto-build pipeline integration (Docker build, buildpacks, source-to-image) |
| 2.3 | Deploy-on-push workflow with status callbacks (commit status checks) |
| 2.4 | Rollback to previous version on deploy failure |

### Phase 3: Knative/OpenFaaS Adapter (1.5 PT)

| Task | Description |
|---|---|
| 3.1 | Abstraction layer for FaaS engine (Knative Serving, OpenFaaS) |
| 3.2 | Service creation/deletion/update via K8s API |
| 3.3 | Auto-scaling configuration (concurrency, scale-to-zero, cooldown) |
| 3.4 | Domain and TLS management for function endpoints |

### Phase 4: Event Triggers (1 PT)

| Task | Description |
|---|---|
| 4.1 | HTTP trigger with path/header routing |
| 4.2 | Cron/schedule trigger (Kubernetes CronJob → invoke function) |
| 4.3 | Pub/Sub trigger (CloudEvents, NATS/Kafka integration) |
| 4.4 | Custom event source registration API |

### Phase 5: Billing & Metrics (1.5 PT)

| Task | Description |
|---|---|
| 5.1 | Invocation counting and duration tracking middleware |
| 5.2 | Per-invocation billing calculator (price per GB-second) |
| 5.3 | Monthly usage aggregation and invoice generation |
| 5.4 | Invocation monitoring dashboard (Grafana) |
| 5.5 | Cold start optimization (pre-warm pools, provisioned concurrency) |

---

## API Design

### Endpoints

All endpoints are prefixed with `/api/v2/faas`.

#### Functions

```
GET    /api/v2/faas/functions                    — List functions
POST   /api/v2/faas/functions                    — Create function
GET    /api/v2/faas/functions/{function_id}       — Get function details
PATCH  /api/v2/faas/functions/{function_id}       — Update function config
DELETE /api/v2/faas/functions/{function_id}       — Delete function
POST   /api/v2/faas/functions/{function_id}/deploy  — Trigger deploy
POST   /api/v2/faas/functions/{function_id}/rollback — Rollback to version
```

#### Versions

```
GET    /api/v2/faas/functions/{function_id}/versions     — List versions
GET    /api/v2/faas/functions/{function_id}/versions/{v} — Get version details
```

#### Triggers

```
GET    /api/v2/faas/triggers                       — List triggers
POST   /api/v2/faas/triggers                       — Create trigger
GET    /api/v2/faas/triggers/{trigger_id}           — Get trigger
PATCH  /api/v2/faas/triggers/{trigger_id}           — Update trigger
DELETE /api/v2/faas/triggers/{trigger_id}           — Delete trigger
```

#### Invocations

```
GET    /api/v2/faas/invocations                    — List invocations
GET    /api/v2/faas/invocations/{invocation_id}    — Get invocation details
GET    /api/v2/faas/stats                          — Aggregate statistics
```

#### Billing

```
GET    /api/v2/faas/billing/usage                  — Current billing period usage
GET    /api/v2/faas/billing/usage?start=X&end=Y    — Usage for date range
GET    /api/v2/faas/billing/invoices               — List invoices
GET    /api/v2/faas/billing/invoices/{invoice_id}  — Invoice details
```

#### Git Integration

```
POST   /api/v2/faas/git/webhook                    — Receive git webhook payload
GET    /api/v2/faas/git/repos                      — List connected repos
POST   /api/v2/faas/git/repos                      — Connect git repo
DELETE /api/v2/faas/git/repos/{repo_id}            — Disconnect repo
```

### Request/Response Examples

#### Create Function

```json
POST /api/v2/faas/functions

{
  "name": "image-resizer",
  "description": "Resize images on-the-fly",
  "runtime": "python3.11",
  "source": {
    "type": "git",
    "repo": "https://github.com/acme/image-resizer",
    "branch": "main",
    "build": {
      "method": "dockerfile",
      "dockerfile_path": "Dockerfile"
    }
  },
  "resources": {
    "memory_limit_mb": 512,
    "cpu_limit": 1.0,
    "timeout_seconds": 30,
    "max_concurrency": 100
  },
  "scaling": {
    "min_replicas": 0,
    "max_replicas": 10,
    "target_concurrency": 10,
    "scale_down_delay_seconds": 300
  },
  "env": {
    "QUALITY": "85",
    "MAX_WIDTH": "2048"
  },
  "secrets": ["storage-api-key"],
  "triggers": [
    {
      "type": "http",
      "config": {
        "path": "/resize",
        "methods": ["POST"],
        "auth_required": true
      }
    }
  ]
}
```

Response:

```json
{
  "function_id": "fn-imgresize-a1b2",
  "name": "image-resizer",
  "version": "1.0.0",
  "status": "creating",
  "endpoint": "https://faas.infra-pilot.io/resize",
  "created_at": "2026-05-27T10:30:00Z"
}
```

#### Invocation Record

```json
GET /api/v2/faas/invocations/inv-xyz789

{
  "invocation_id": "inv-xyz789",
  "function_id": "fn-imgresize-a1b2",
  "function_version": "1.0.0",
  "trigger_type": "http",
  "status": "success",
  "duration_ms": 1247,
  "memory_used_mb": 256,
  "cpu_used_cores": 0.45,
  "cold_start": false,
  "request_size_bytes": 102400,
  "response_size_bytes": 51200,
  "status_code": 200,
  "init_time_ms": null,
  "invoked_by": "usr-abc123",
  "region": "eu-west-1",
  "started_at": "2026-05-27T12:00:00.123Z",
  "completed_at": "2026-05-27T12:00:01.370Z"
}
```

---

## Data Model

### Function

```sql
CREATE TABLE faas_functions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(128) NOT NULL UNIQUE,
    description     TEXT,
    runtime         VARCHAR(32) NOT NULL,
    source_config   JSONB NOT NULL,
    resources       JSONB NOT NULL,
    scaling         JSONB NOT NULL DEFAULT '{"min_replicas":0,"max_replicas":10}',
    env_encrypted   TEXT,
    secrets         TEXT[],  -- references to secret store
    endpoint        VARCHAR(512),
    current_version VARCHAR(32),
    status          VARCHAR(20) NOT NULL DEFAULT 'creating'
                    CHECK (status IN ('creating', 'active', 'deploying',
                                      'degraded', 'disabled', 'error', 'deleting')),
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Function Version

```sql
CREATE TABLE faas_function_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_id     UUID NOT NULL REFERENCES faas_functions(id) ON DELETE CASCADE,
    version         VARCHAR(32) NOT NULL,
    image           VARCHAR(512) NOT NULL,
    image_digest    VARCHAR(128),
    source_commit   VARCHAR(64),
    build_log       TEXT,
    config_snapshot JSONB NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'building'
                    CHECK (status IN ('building', 'ready', 'failed', 'rolled_back')),
    built_by        UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (function_id, version)
);
```

### Trigger

```sql
CREATE TABLE faas_triggers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_id     UUID NOT NULL REFERENCES faas_functions(id) ON DELETE CASCADE,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('http', 'cron', 'pubsub', 'custom')),
    name            VARCHAR(128),
    config          JSONB NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Invocation

```sql
CREATE TABLE faas_invocations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_id     UUID NOT NULL REFERENCES faas_functions(id),
    function_version VARCHAR(32) NOT NULL,
    trigger_type    VARCHAR(20) NOT NULL,
    status          VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'throttled')),
    duration_ms     INTEGER NOT NULL,
    memory_used_mb  INTEGER,
    cpu_used_cores  DECIMAL(5,2),
    cold_start      BOOLEAN DEFAULT FALSE,
    init_time_ms    INTEGER,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    status_code     INTEGER,
    invoked_by      VARCHAR(256),
    region          VARCHAR(64),
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_faas_invocations_func_time
    ON faas_invocations (function_id, started_at DESC);

CREATE INDEX idx_faas_invocations_date
    ON faas_invocations (started_at);
```

### Billing

```sql
CREATE TABLE faas_billing_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_id     UUID NOT NULL REFERENCES faas_functions(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    invocation_id   UUID NOT NULL REFERENCES faas_invocations(id),
    duration_seconds DECIMAL(10,3) NOT NULL,
    memory_gb       DECIMAL(10,3) NOT NULL,
    gb_seconds      DECIMAL(15,6) NOT NULL,
    price_per_gb_sec DECIMAL(10,8) NOT NULL,
    cost            DECIMAL(20,10) NOT NULL,
    billed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE faas_billing_invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    total_invocations BIGINT NOT NULL,
    total_gb_seconds DECIMAL(15,6) NOT NULL,
    total_cost      DECIMAL(12,4) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Git Repositories

```sql
CREATE TABLE faas_git_repos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    function_id     UUID NOT NULL REFERENCES faas_functions(id) ON DELETE CASCADE,
    repo_url        VARCHAR(512) NOT NULL,
    branch          VARCHAR(128) NOT NULL DEFAULT 'main',
    webhook_secret  VARCHAR(128),
    last_commit     VARCHAR(64),
    last_build_at   TIMESTAMPTZ,
    status          VARCHAR(20) NOT NULL DEFAULT 'connected',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (function_id, repo_url, branch)
);
```

---

## Service Assignments

| Component | Service | Responsibilities |
|---|---|---|
| Function Manager | **Orchestrator Agent** | Function CRUD, versioning, deployment workflow |
| Git Integration | **Orchestrator Agent** | Webhook receiver, build pipeline, commit status |
| Knative/OpenFaaS Adapter | **Orchestrator Agent** | FaaS engine abstraction, service lifecycle, scaling |
| Invocation Router | **Integration Service** | API gateway, auth, rate limiting, request routing |
| Billing Engine | **Integration Service** | Usage tracking, cost calculation, invoicing |
| Metrics Collector | **Orchestrator Agent** | Prometheus metrics, invocation logs |
| Function UI | **Management Panel** | Function editor, deploy UI, invocation log viewer |
| Event Bus | **Integration Service** (+ Feature 13) | Pub/Sub triggers, event source management |
| Secret Store | **Integration Service** (+ Feature 47) | Encrypted env vars, function secrets |

---

## Effort Estimate

| Phase | Tasks | PT |
|---|---|---|
| Phase 1: Function Registry & CRUD | 1.1–1.5 | 2 |
| Phase 2: Git Integration | 2.1–2.4 | 2 |
| Phase 3: Knative/OpenFaaS Adapter | 3.1–3.4 | 1.5 |
| Phase 4: Event Triggers | 4.1–4.4 | 1 |
| Phase 5: Billing & Metrics | 5.1–5.5 | 1.5 |
| **Total** | **22 tasks** | **8 PT** |

### Risk Factors

| Risk | Mitigation |
|---|---|
| Cold start latency for infrequent functions | Provisioned concurrency (always-on replicas), pre-warm pools, Wasm for sub-100ms startups |
| Knative/OpenFaaS complexity for users | Abstract via unified Infra Pilot FaaS layer; hide K8s details |
| Billing accuracy at high throughput | Atomic counters in Redis, batch-write to PostgreSQL, reconciliation jobs |
| Resource contention under scale | Per-function resource quotas, namespace isolation, cluster autoscaler |
| Function build pipeline security | Container image scanning (Trivy), signature verification, sandboxed builds |

---

## Monitoring & Observability

### Prometheus Metrics

```python
# Functions
faas_functions_total{status}                   # Gauge — function count
faas_function_build_duration_seconds{status}   # Histogram — build time
faas_function_deploy_duration_seconds{status}  # Histogram — deploy time

# Invocations
faas_invocations_total{function,status}        # Counter — invocations
faas_invocation_duration_seconds{function}     # Histogram — execution time
faas_invocation_memory_bytes{function}         # Histogram — memory used
faas_invocation_cold_start_seconds{function}   # Histogram — cold start init
faas_cold_start_ratio{function}                # Gauge — cold start percentage

# Scaling
faas_active_replicas{function}                 # Gauge — current replica count
faas_scaling_events_total{function,direction}  # Counter — scale up/down events

# Billing
faas_gb_seconds_total{function}                # Counter — compute usage
faas_invocations_billed_total{status}          # Counter — billed invocations
faas_billing_cost_total{function}              # Counter — accumulated cost

# Triggers
faas_trigger_executions_total{type,status}     # Counter — trigger executions
faas_trigger_latency_seconds{type}             # Histogram — trigger delivery latency
```

### Logging

```json
{
  "event": "faas.function.created",
  "function_id": "fn-imgresize-a1b2",
  "name": "image-resizer",
  "runtime": "python3.11",
  "created_by": "usr-abc123"
}

{
  "event": "faas.function.deployed",
  "function_id": "fn-imgresize-a1b2",
  "version": "2.1.0",
  "commit": "a1b2c3d4",
  "build_duration_ms": 45000,
  "image": "registry.infra-pilot.io/fn-imgresize:v2.1.0"
}

{
  "event": "faas.invocation.completed",
  "invocation_id": "inv-xyz789",
  "function_id": "fn-imgresize-a1b2",
  "duration_ms": 1247,
  "memory_mb": 256,
  "cold_start": false,
  "status": "success"
}
```

---

## Related Documents

- [Architecture Overview](../architecture/overview.md)
- [Orchestrator Agent Architecture](../architecture/orchestrator-agent.md)
- [Feature 19: Kubernetes Cluster Manager](19-kubernetes-cluster-manager.md)
- [Feature 21: Edge Compute Nodes](21-edge-compute-nodes.md)
- [Feature 13: Webhook Event Bus](13-webhook-event-bus.md)
- [Feature 47: Secrets Management](47-secrets-management.md)
- [Implementation Plan v2](../feature-implementation-plan-v2.md)

---

**Last Updated:** May 2026
