# Feature 16: GitOps Sync

- **Feature #:** 16
- **Category:** Developer Ecosystem & API
- **Primary Service:** Orchestrator Agent
- **Supporting Services:** Integration Service, Management Panel
- **Effort:** Large (7-10 PT)
- **Dependencies:** Feature #13 (Webhook Event Bus), Feature #14 (API Gateway & Rate Limiting)

---

## 1. Overview

GitOps Sync establishes a two-way reconciliation loop between Git repositories and Infra Pilot infrastructure state. Configuration changes committed to a Git repository are automatically applied to servers; manual edits made in the Management Panel create pull requests back to the repository. This enables Git-as-source-of-truth workflows compatible with ArgoCD and Flux patterns.

### Goals

- Bi-directional sync: Git → Infra (auto-apply) and Infra → Git (PR creation)
- Drift detection: periodic reconciliation with alerting on divergence
- Commit signing and verification for supply-chain security
- Branch/tag filters to scope sync to specific environments
- Dry-run mode to preview changes before application
- Compatible with GitHub, GitLab, Bitbucket, and self-hosted Gitea

### Non-Goals

- Full Git UI (file browser, commit history viewer) — delegate to Git hosting platform
- Multi-repo orchestration (DAG of dependent repos) — future feature
- Terraform/Crossplane state management — separate IaC tooling (Feature #12)

---

## 2. Architecture

### High-Level Component Diagram

```
┌──────────────────┐       ┌───────────────────────────────────────┐
│   Git Provider   │       │           Orchestrator Agent          │
│   (GitHub/GitLab)│       │                                       │
│                  │       │  ┌─────────────────────────────────┐  │
│   ┌──────────┐   │       │  │      GitOps Sync Engine         │  │
│   │  Repo    │   │◄──────┼──┤                                 │  │
│   │  (YAML)  │   │       │  │  ┌──────────┐  ┌────────────┐  │  │
│   └────┬─────┘   │       │  │  │  Git     │  │  Drift     │  │  │
│        │         │       │  │  │  Watcher │  │  Detector  │  │  │
│        │ Push/   │       │  │  └────┬─────┘  └──────┬─────┘  │  │
│        │ Webhook │       │  │       │               │         │  │
│        ▼         │       │  │       ▼               ▼         │  │
│   ┌──────────┐   │       │  │  ┌──────────────────────────┐   │  │
│   │ Webhooks │   │───────┼──┼──►  Reconciliation Loop     │   │  │
│   └──────────┘   │       │  │  │  (diff → apply → report) │   │  │
└──────────────────┘       │  │  └────────────┬─────────────┘   │  │
                           │  └───────────────┼─────────────────┘  │
                           │                  │                    │
                           │                  ▼                    │
                           │  ┌─────────────────────────────────┐  │
                           │  │   Config Translator             │  │
                           │  │   (YAML/JSON → API calls)       │  │
                           │  └────────────┬────────────────────┘  │
                           └───────────────┼───────────────────────┘
                                           │
                                           ▼
                           ┌───────────────────────────────────────┐
                           │        Infrastructure State           │
                           │  (Servers, Databases, DNS, Firewalls) │
                           └───────────────────────────────────────┘
                                           ▲
                                           │
┌──────────────────┐       ┌───────────────┼───────────────────────┐
│ Management Panel │       │  Integration Service                   │
│                  │       │                                       │
│  User edits      │──────►│  ┌─────────────────────────────────┐  │
│  server config   │       │  │  PR Creator                     │  │
│                  │       │  │  (branch → commit → push → PR)  │  │
└──────────────────┘       │  └─────────────────────────────────┘  │
                           └───────────────────────────────────────┘
```

### Sync Flow

```
Git Push (or poll interval)
       │
       ▼
Git Watcher detects change
       │
       ▼
Clone/Fetch repo at target ref
       │
       ▼
Config Translator parses YAML/JSON
       │
       ▼
Diff against current infrastructure state
       │
       ├── No diff → Report "in sync"
       │
       └── Diff found → Generate plan
              │
              ▼
         Auto-apply enabled?
              │
       ┌──────┴──────┐
       ▼              ▼
      Yes            No
       │              │
       ▼              ▼
  Apply changes   Create PR
  (dry-run first)  (user reviews)
       │              │
       ▼              ▼
  Report result   Update status
```

### Panel Edit → PR Flow

```
User edits server config in Panel UI
       │
       ▼
Integration Service creates branch (gitops/srv-abc-20260520)
       │
       ▼
Commit config change with signed commit
       │
       ▼
Push branch to remote
       │
       ▼
Create pull request with description
       │
       ▼
Update Panel UI with PR link
       │
       ▼
User merges PR → Git watcher picks up → auto-applies
```

---

## 3. Data Model

### GitOps Sync Configuration (per-tenant)

```json
{
  "id": "gitops_abc123",
  "tenant_id": "tnt_001",
  "name": "production-cluster",
  "repository": {
    "url": "https://github.com/myorg/infrapilot-config.git",
    "branch": "main",
    "path": "clusters/prod/",
    "auth_method": "deploy_key",
    "deploy_key_id": "key_001",
    "commit_signing_key_id": "gpg_001"
  },
  "sync": {
    "direction": "bidirectional",
    "auto_apply": true,
    "create_pr_on_panel_edit": true,
    "pr_base_branch": "main",
    "pr_label": "infrapilot-sync"
  },
  "schedule": {
    "poll_interval_secs": 300,
    "webhook_enabled": true,
    "webhook_secret_id": "secret_002"
  },
  "filters": {
    "include_paths": ["clusters/prod/**/*.yaml"],
    "exclude_paths": ["clusters/prod/secrets/**"],
    "resource_types": ["server", "database", "dns_record", "firewall_rule"]
  },
  "drift_detection": {
    "enabled": true,
    "alert_on_drift": true,
    "auto_remediate": false,
    "alert_severity": "warning"
  },
  "status": {
    "last_sync": "2026-05-20T12:00:00Z",
    "last_sync_commit": "a1b2c3d4",
    "last_sync_result": "success",
    "current_drift_count": 0,
    "in_sync": true
  }
}
```

### Drift Record

```json
{
  "id": "drift_001",
  "gitops_config_id": "gitops_abc123",
  "resource_type": "server",
  "resource_id": "srv_prod_web_01",
  "diff": {
    "expected": {
      "cpu_cores": 4,
      "memory_mb": 8192,
      "disk_gb": 100
    },
    "actual": {
      "cpu_cores": 4,
      "memory_mb": 4096,
      "disk_gb": 100
    }
  },
  "severity": "high",
  "status": "unresolved",
  "detected_at": "2026-05-20T12:05:00Z",
  "remediated_at": null
}
```

### Git Snapshot (cached state for diffing)

```json
{
  "id": "snap_001",
  "gitops_config_id": "gitops_abc123",
  "commit_sha": "a1b2c3d4e5f6...",
  "commit_message": "feat: scale web-01 to 8GB RAM",
  "committer": "Infra Pilot Bot",
  "timestamp": "2026-05-20T12:00:00Z",
  "resources": {
    "server": [
      {
        "id": "srv_prod_web_01",
        "name": "web-01",
        "spec": {
          "cpu_cores": 4,
          "memory_mb": 8192,
          "disk_gb": 100
        }
      }
    ],
    "dns_record": [...],
    "firewall_rule": [...]
  }
}
```

### SQL Schema

```sql
CREATE TABLE gitops_configs (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL,
    name            TEXT NOT NULL,
    repo_url        TEXT NOT NULL,
    repo_branch     TEXT NOT NULL DEFAULT 'main',
    repo_path       TEXT NOT NULL DEFAULT '/',
    auth_method     TEXT NOT NULL CHECK(auth_method IN ('deploy_key','personal_token','app_installation')),
    auth_credential_id TEXT,
    commit_signing_key_id TEXT,
    direction       TEXT NOT NULL DEFAULT 'bidirectional' CHECK(direction IN ('git_to_infra','bidirectional')),
    auto_apply      BOOLEAN NOT NULL DEFAULT false,
    create_pr_on_panel_edit BOOLEAN NOT NULL DEFAULT true,
    poll_interval_secs INT NOT NULL DEFAULT 300,
    webhook_secret  TEXT,
    filters_json    JSONB NOT NULL DEFAULT '{}',
    drift_config_json JSONB NOT NULL DEFAULT '{}',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    last_sync_at    TIMESTAMPTZ,
    last_sync_commit TEXT,
    last_sync_result TEXT,
    in_sync         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE drift_records (
    id              TEXT PRIMARY KEY,
    gitops_config_id TEXT NOT NULL REFERENCES gitops_configs(id) ON DELETE CASCADE,
    resource_type   TEXT NOT NULL,
    resource_id     TEXT NOT NULL,
    diff_json       JSONB NOT NULL,
    severity        TEXT NOT NULL CHECK(severity IN ('low','medium','high','critical')),
    status          TEXT NOT NULL DEFAULT 'unresolved' CHECK(status IN ('unresolved','acknowledged','remediated','ignored')),
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    remediated_at   TIMESTAMPTZ,
    acknowledged_by TEXT REFERENCES users(id)
);

CREATE TABLE git_snapshots (
    id              TEXT PRIMARY KEY,
    gitops_config_id TEXT NOT NULL REFERENCES gitops_configs(id) ON DELETE CASCADE,
    commit_sha      TEXT NOT NULL,
    commit_message  TEXT,
    committer       TEXT,
    resources_json  JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4. API Design

### GitOps Configuration API (Orchestrator Agent)

All endpoints prefixed with `/api/v2/gitops`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/configs` | List GitOps sync configs |
| `POST` | `/configs` | Create new GitOps sync config |
| `GET` | `/configs/{id}` | Get sync config details |
| `PUT` | `/configs/{id}` | Update sync config |
| `DELETE` | `/configs/{id}` | Remove sync config |
| `POST` | `/configs/{id}/sync` | Trigger immediate sync |
| `POST` | `/configs/{id}/dry-run` | Preview changes without applying |
| `GET` | `/configs/{id}/drifts` | List drift records |
| `POST` | `/configs/{id}/drifts/{drift_id}/acknowledge` | Acknowledge drift |

### Panel Edit → PR API (Integration Service)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v2/gitops/pr` | Create PR from Panel edit |
| `GET` | `/api/v2/gitops/pr/{pr_id}` | Get PR status / link |

### Webhook Receiver (Orchestrator Agent)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v2/gitops/webhook` | Receive push event from Git provider |

### Config Translation Format

Example Git repository structure:

```
clusters/
├── prod/
│   ├── servers.yaml
│   ├── databases.yaml
│   ├── dns.yaml
│   └── firewall.yaml
└── staging/
    ├── servers.yaml
    └── databases.yaml
```

Example `servers.yaml`:

```yaml
apiVersion: infrapilot.io/v1
kind: Server
metadata:
  name: web-01
spec:
  provider: hetzner
  region: fsn1
  plan: CX42
  cpu_cores: 4
  memory_mb: 8192
  disk_gb: 100
  image: ubuntu-24.04
  tags:
    - production
    - web
  firewall:
    - name: web-traffic
      rules:
        - protocol: tcp
          port: 443
          source: "0.0.0.0/0"
        - protocol: tcp
          port: 80
          source: "0.0.0.0/0"
---
apiVersion: infrapilot.io/v1
kind: Server
metadata:
  name: db-01
spec:
  provider: hetzner
  region: fsn1
  plan: CX62
  cpu_cores: 8
  memory_mb: 16384
  disk_gb: 200
  image: ubuntu-24.04
  tags:
    - production
    - database
```

### Webhook Payload (GitHub Example)

```json
{
  "ref": "refs/heads/main",
  "commits": [
    {
      "id": "a1b2c3d4e5f6...",
      "message": "feat: scale web-01 to 8GB RAM",
      "timestamp": "2026-05-20T12:00:00Z",
      "added": ["clusters/prod/servers.yaml"],
      "modified": [],
      "removed": []
    }
  ],
  "repository": {
    "clone_url": "https://github.com/myorg/infrapilot-config.git",
    "default_branch": "main"
  }
}
```

---

## 5. Implementation Plan

### Phase 1: Git Watcher & Sync Engine (Weeks 1-3, 4 PT)

| Task | Service | Description |
|------|---------|-------------|
| 1.1 | Orchestrator Agent | Git client abstraction layer (go-git / libgit2 bindings) |
| 1.2 | Orchestrator Agent | Poll-based watcher with configurable interval |
| 1.3 | Orchestrator Agent | Webhook receiver (GitHub/GitLab/Bitbucket) |
| 1.4 | Orchestrator Agent | Config translator — parse YAML → internal resource model |
| 1.5 | Orchestrator Agent | Diff engine — compare desired vs actual state |
| 1.6 | Orchestrator Agent | Reconciliation loop — apply diff in correct order |
| 1.7 | Orchestrator Agent | Dry-run mode — plan output without mutation |

**Deliverables:** Single-direction Git-to-Infra sync operational with webhook and poll modes.

### Phase 2: Drift Detection & Alerting (Weeks 3-4, 2 PT)

| Task | Service | Description |
|------|---------|-------------|
| 2.1 | Orchestrator Agent | Periodic state snapshots and comparison |
| 2.2 | Orchestrator Agent | Drift severity classification (low/medium/high/critical) |
| 2.3 | Orchestrator Agent | Alert integration via Webhook Event Bus (Feature #13) |
| 2.4 | Management Panel | Drift dashboard — list, filter, acknowledge drifts |
| 2.5 | Orchestrator Agent | Auto-remediation for low-severity drifts |

**Deliverables:** Drift detection operational with alerting and dashboard.

### Phase 3: Panel-to-Git PR Flow (Weeks 4-6, 2 PT)

| Task | Service | Description |
|------|---------|-------------|
| 3.1 | Integration Service | Git provider API client (create branch, commit, push, PR) |
| 3.2 | Management Panel | Config editor integration — auto-generate PR on save |
| 3.3 | Integration Service | Commit signing via GPG/key management |
| 3.4 | Integration Service | PR status tracking (open, merged, closed) |
| 3.5 | Management Panel | PR link display in notification toast |

**Deliverables:** Panel edits create signed commits and pull requests.

### Phase 4: Config Management & Filters (Weeks 6-7, 1 PT)

| Task | Service | Description |
|------|---------|-------------|
| 4.1 | Orchestrator Agent | Path-based include/exclude filters |
| 4.2 | Orchestrator Agent | Resource-type filters |
| 4.3 | Management Panel | GitOps config CRUD UI |
| 4.4 | Management Panel | Sync status dashboard (commit SHA, last sync time, drift count) |

**Deliverables:** Full configuration UI and filtering capabilities.

### Phase 5: Security & Hardening (Week 7, 1 PT)

| Task | Service | Description |
|------|---------|-------------|
| 5.1 | Orchestrator Agent | Deploy key management (generate, rotate, revoke) |
| 5.2 | Orchestrator Agent | Commit signature verification on sync |
| 5.3 | Integration Service | Encryption for stored tokens/keys |
| 5.4 | Shared | Audit logging for all sync operations |
| 5.5 | Shared | Rate limiting for webhook and sync triggers |

**Deliverables:** Production-ready security controls.

---

## 6. Service Assignments

| Service | Responsibilities |
|---------|-----------------|
| **Orchestrator Agent** | Git watcher (poll + webhook), config translator, diff engine, reconciliation loop, drift detector, deploy key management, commit verification |
| **Integration Service** | Git provider API client (branch/commit/push/PR), commit signing, PR status tracking, token encryption |
| **Management Panel** | GitOps config CRUD UI, drift dashboard, sync status display, config editor PR integration |

---

## 7. Configuration Example

**infrapilot.yaml** (Global GitOps configuration):

```yaml
gitops:
  enabled: true
  default_poll_interval: 300
  max_concurrent_syncs: 5
  commit_signing:
    enabled: true
    key_type: gpg
    key_storage: vault
  drift:
    enabled: true
    check_interval: 600
    auto_remediate: false
    default_severity: medium
  providers:
    github:
      app_id: 12345
      private_key_path: /etc/infrapilot/github-app-key.pem
    gitlab:
      url: https://gitlab.com
      token_env_var: GITLAB_TOKEN
```

**Per-sync config example** (via API or Panel UI):

```yaml
name: production-cluster
repository:
  url: https://github.com/myorg/infrapilot-config.git
  branch: main
  path: clusters/prod/
  auth_method: deploy_key
sync:
  direction: bidirectional
  auto_apply: true
  create_pr_on_panel_edit: true
schedule:
  poll_interval_secs: 300
  webhook_enabled: true
filters:
  resource_types:
    - server
    - database
  include_paths:
    - clusters/prod/**/*.yaml
```

---

## 8. Effort Estimate

| Phase | PT | Dependencies |
|-------|----|-------------|
| Phase 1: Git Watcher & Sync Engine | 4.0 | Feature #14 (API Gateway) |
| Phase 2: Drift Detection & Alerting | 2.0 | Feature #13 (Webhook Event Bus) |
| Phase 3: Panel-to-Git PR Flow | 2.0 | Phase 1 |
| Phase 4: Config Management & Filters | 1.0 | Phase 1 |
| Phase 5: Security & Hardening | 1.0 | Phase 1 |
| **Buffer (15%)** | **1.5** | — |
| **Total** | **~11.5 PT** | — |

### Risk Factors

- **Git client performance:** Large monorepos with deep history require shallow clone optimizations
- **Conflict resolution:** Concurrent Panel edits and Git pushes can cause merge conflicts — need rebase strategy
- **Provider API differences:** GitHub vs GitLab vs Bitbucket webhook payloads and PR APIs vary significantly
- **Commit signing key management:** GPG key rotation and HSM integration adds operational complexity

---

## 9. Security & Compliance

- All stored tokens encrypted at rest (AES-256-GCM)
- Deploy keys scoped to single repository (principle of least privilege)
- Webhook payloads validated via HMAC signatures
- Commit signing enforced for all bot-generated commits
- Audit log records: sync triggered, plan generated, changes applied, drift detected
- RBAC: separate permissions for viewing GitOps configs vs triggering syncs vs creating PRs
