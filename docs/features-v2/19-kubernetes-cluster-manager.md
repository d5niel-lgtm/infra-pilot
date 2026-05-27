# Feature 19: Kubernetes Cluster Manager

- **Plan ID:** #19
- **Category:** Advanced Infrastructure
- **Primary Service:** Orchestrator Agent
- **Effort:** Extra Large (11+ PT)
- **Dependencies:** Feature 16 (GitOps Sync), Feature 26 (Service Mesh)

## Overview

Deploy and manage K3s/K8s clusters through Infra Pilot. Users provision single-node or multi-node Kubernetes clusters, manage node pools, deploy workloads via Helm, access clusters through a Panel-based kubectl proxy, and configure pod auto-scaling. Supports both lightweight K3s for edge/small deployments and full K8s for production-grade clusters.

### Key Capabilities

| Capability | Description |
|---|---|
| Cluster Provisioning | One-click K3s/K8s cluster creation with configurable version, CNI, and storage backend |
| Node Pool Management | Dynamic add/remove of worker nodes with taints, labels, and instance sizing |
| kubectl Proxy | Browser-based kubectl terminal via the Panel with RBAC scoping |
| Helm Chart Repository | Built-in chart repository with versioning, one-click installs, and rollback |
| Pod Auto-Scaling | HPA/VPA configuration through Panel UI, custom metrics support |
| Cluster Monitoring | Prometheus/Grafana stack auto-deployment, node/pod metrics, alerting |
| Backup & Restore | Velero-based cluster backup to S3-compatible storage |

---

## Architecture

### System Context

```
┌─────────────────────────────────────────────────────────────┐
│                    Infra Pilot Platform                       │
│                                                               │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────────┐    │
│  │  Panel   │──▶│ Orchestrator │──▶│  K8s Cluster(s)     │    │
│  │ (React)  │   │ Agent        │   │                     │    │
│  └──────────┘   │              │   │  ┌───────────────┐  │    │
│       │         │  ┌─────────┐ │   │  │ K3s / K8s API │  │    │
│       │         │  │ Cluster │ │   │  └───────┬───────┘  │    │
│       │         │  │ Manager │─┼──│──────────▶│           │    │
│       │         │  └─────────┘ │   │          ▼           │    │
│       │         │  ┌─────────┐ │   │  ┌───────────────┐  │    │
│       └─────────┼──│ Helm    │ │   │  │ Node Pool(s)  │  │    │
│                 │  │ Proxy   │ │   │  └───────────────┘  │    │
│                 │  └─────────┘ │   │  ┌───────────────┐  │    │
│                 │  ┌─────────┐ │   │  │ Workloads     │  │    │
│                 │  │ Metrics │ │   │  └───────────────┘  │    │
│                 │  │ Bridge  │─┼──│──▶ Prometheus        │    │
│                 │  └─────────┘ │   └────────────────────┘    │
│                 └──────────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
┌──────────────────────────────────────────────────┐
│              Cluster Manager Module                │
│                   (Orchestrator Agent)             │
├──────────────────────────────────────────────────┤
│                                                    │
│  ┌─────────────────┐  ┌────────────────────────┐ │
│  │ Provisioning     │  │ Node Pool Controller   │ │
│  │ Engine           │  │                        │ │
│  │ - K3s installer  │  │ - Auto-scaling group   │ │
│  │ - K8s (kubeadm)  │  │ - Taint/label mgmt     │ │
│  │ - Multi-master   │  │ - Drain & cordon       │ │
│  └────────┬─────────┘  └───────────┬────────────┘ │
│           │                        │              │
│  ┌────────▼────────────────────────▼────────────┐ │
│  │            Cluster State Store               │ │
│  │  (PostgreSQL — cluster specs, node status)   │ │
│  └────────────────────┬─────────────────────────┘ │
│           │            │            │              │
│  ┌────────▼──┐ ┌──────▼──────┐ ┌──▼───────────┐ │
│  │ Helm      │ │ kubectl     │ │ Metrics       │ │
│  │ Proxy     │ │ Proxy       │ │ Collector     │ │
│  │           │ │ (WebSocket) │ │ (Prometheus)  │ │
│  └───────────┘ └─────────────┘ └──────────────┘ │
└──────────────────────────────────────────────────┘
```

### Interaction Flow

```
Panel User                    Orchestrator Agent              Target Node(s)
    │                              │                              │
    │  POST /k8s/cluster/create    │                              │
    │─────────────────────────────▶│                              │
    │                              │  Generate join token/config  │
    │                              │  ssh user@node -- script.sh  │
    │                              │─────────────────────────────▶│
    │                              │  Install containerd + K3s    │
    │                              │◀─────────────────────────────│
    │                              │  Health check (kubectl get   │
    │                              │  nodes --wait-ready)         │
    │                              │◀─────────────────────────────│
    │  {"cluster_id": "kc-a1b2",   │                              │
    │   "status": "running",       │                              │
    │   "kubeconfig": "...",       │                              │
    │   "api_endpoint": "..."}     │                              │
    │◀─────────────────────────────│                              │
    │                              │                              │
    │  Panel opens kubectl proxy   │                              │
    │  WebSocket tunnel            │                              │
    │══════════════════════════════╪═══════════════════▶│          │
    │  kubectl get pods -A        │                              │
    │◀═════════════════════════════╪════════════════════│          │
```

---

## Implementation Plan

### Phase 1: Core Cluster Provisioning (4 PT)

| Task | Description |
|---|---|
| 1.1 | Implement K3s installation driver (SSH-based, cloud-init, Ansible) |
| 1.2 | Implement K8s installation driver (kubeadm wrapper) |
| 1.3 | Cluster creation API endpoint with async workflow |
| 1.4 | Cluster state machine (provisioning → running → error → deleting) |
| 1.5 | TLS certificate management for cluster API access |

### Phase 2: Node Pool Management (2 PT)

| Task | Description |
|---|---|
| 2.1 | Node pool CRUD operations (add/drain/remove worker nodes) |
| 2.2 | Auto-scaling group integration (cloud provider ASGs) |
| 2.3 | Taint, label, and toleration management UI |
| 2.4 | Node health monitoring and auto-replacement |

### Phase 3: kubectl Proxy & Panel Integration (2 PT)

| Task | Description |
|---|---|
| 3.1 | WebSocket-based kubectl proxy in Orchestrator Agent |
| 3.2 | Browser-based terminal component in Panel (xterm.js) |
| 3.3 | RBAC scoping (kubeconfig generation with limited permissions) |
| 3.4 | Audit logging of all kubectl commands executed via proxy |

### Phase 4: Helm Integration (2 PT)

| Task | Description |
|---|---|
| 4.1 | Helm SDK integration in Orchestrator Agent |
| 4.2 | Built-in chart repository (OCI-compatible, S3-backed) |
| 4.3 | One-click chart install/upgrade/rollback from Panel |
| 4.4 | Chart versioning and dependency resolution |

### Phase 5: Auto-Scaling & Monitoring (2 PT)

| Task | Description |
|---|---|
| 5.1 | HPA/VPA configuration API and Panel form |
| 5.2 | Custom metrics adapter for HPA |
| 5.3 | Auto-deploy Prometheus + Grafana stack per cluster |
| 5.4 | Cluster-level dashboards and alert rules |

### Phase 6: Backup & Security (1 PT)

| Task | Description |
|---|---|
| 6.1 | Velero integration for cluster backup/restore |
| 6.2 | Scheduled backups with retention policy |
| 6.3 | Cluster upgrade workflow (K8s/K3s version bump) |
| 6.4 | Security scanning (CIS benchmark, Trivy on node images) |

---

## API Design

### Endpoints

All endpoints are prefixed with `/api/v2/k8s`.

#### Clusters

```
GET    /api/v2/k8s/clusters                          — List clusters
POST   /api/v2/k8s/clusters                          — Create cluster
GET    /api/v2/k8s/clusters/{cluster_id}              — Get cluster details
PATCH  /api/v2/k8s/clusters/{cluster_id}              — Update cluster (scale, upgrade)
DELETE /api/v2/k8s/clusters/{cluster_id}              — Delete cluster
POST   /api/v2/k8s/clusters/{cluster_id}/kubeconfig   — Generate kubeconfig
POST   /api/v2/k8s/clusters/{cluster_id}/upgrade      — Trigger cluster upgrade
POST   /api/v2/k8s/clusters/{cluster_id}/backup       — Trigger manual backup
```

#### Node Pools

```
GET    /api/v2/k8s/clusters/{cluster_id}/nodepools           — List node pools
POST   /api/v2/k8s/clusters/{cluster_id}/nodepools           — Create node pool
GET    /api/v2/k8s/clusters/{cluster_id}/nodepools/{pool_id} — Get node pool
PATCH  /api/v2/k8s/clusters/{cluster_id}/nodepools/{pool_id} — Update node pool
DELETE /api/v2/k8s/clusters/{cluster_id}/nodepools/{pool_id} — Delete node pool
```

#### Helm Charts

```
GET    /api/v2/k8s/helm/repos                  — List chart repos
POST   /api/v2/k8s/helm/repos                  — Add chart repo
DELETE /api/v2/k8s/helm/repos/{repo_id}        — Remove repo
GET    /api/v2/k8s/helm/charts                 — Search available charts
POST   /api/v2/k8s/clusters/{cluster_id}/helm/install  — Install chart
POST   /api/v2/k8s/clusters/{cluster_id}/helm/upgrade   — Upgrade release
POST   /api/v2/k8s/clusters/{cluster_id}/helm/rollback  — Rollback release
```

#### Proxy

```
WS     /api/v2/k8s/clusters/{cluster_id}/proxy/ws   — WebSocket kubectl proxy
```

#### Auto-Scaling

```
GET    /api/v2/k8s/clusters/{cluster_id}/hpa                  — List HPA rules
POST   /api/v2/k8s/clusters/{cluster_id}/hpa                  — Create HPA rule
PATCH  /api/v2/k8s/clusters/{cluster_id}/hpa/{hpa_id}         — Update HPA rule
DELETE /api/v2/k8s/clusters/{cluster_id}/hpa/{hpa_id}         — Delete HPA rule
```

### Request/Response Examples

#### Create Cluster

```json
POST /api/v2/k8s/clusters

{
  "name": "production-eu-1",
  "type": "k3s",
  "version": "v1.30.0+k3s1",
  "region": "eu-west-1",
  "high_availability": true,
  "control_plane": {
    "count": 3,
    "instance_type": "c6i.xlarge"
  },
  "node_pools": [
    {
      "name": "workers",
      "instance_type": "c6i.2xlarge",
      "min_size": 3,
      "max_size": 10,
      "desired_size": 3,
      "taints": [],
      "labels": {
        "workload": "general"
      }
    }
  ],
  "networking": {
    "cni": "cilium",
    "pod_cidr": "10.42.0.0/16",
    "service_cidr": "10.43.0.0/16"
  },
  "storage": {
    "backend": "longhorn",
    "replica_count": 3
  }
}
```

Response:

```json
{
  "cluster_id": "kc-euprod-7f2a",
  "status": "provisioning",
  "api_endpoint": "https://api.kc-euprod-7f2a.infra-pilot.io:6443",
  "created_at": "2026-05-27T10:30:00Z",
  "estimated_ready": "2026-05-27T10:35:00Z"
}
```

#### Install Helm Chart

```json
POST /api/v2/k8s/clusters/kc-euprod-7f2a/helm/install

{
  "chart": "nginx-ingress/ingress-nginx",
  "version": "4.10.0",
  "release_name": "ingress",
  "namespace": "ingress-nginx",
  "values": {
    "controller": {
      "replicaCount": 2,
      "service": {
        "type": "LoadBalancer"
      }
    }
  }
}
```

Response:

```json
{
  "release_name": "ingress",
  "namespace": "ingress-nginx",
  "status": "deployed",
  "chart": "nginx-ingress/ingress-nginx",
  "version": "4.10.0",
  "updated_at": "2026-05-27T10:35:00Z"
}
```

---

## Data Model

### Cluster

```sql
CREATE TABLE k8s_clusters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(128) NOT NULL UNIQUE,
    type            VARCHAR(10) NOT NULL CHECK (type IN ('k3s', 'k8s')),
    version         VARCHAR(32) NOT NULL,
    region          VARCHAR(64) NOT NULL,
    high_availability BOOLEAN DEFAULT FALSE,
    status          VARCHAR(20) NOT NULL DEFAULT 'provisioning'
                    CHECK (status IN ('provisioning','running','upgrading',
                                      'degraded','error','deleting')),
    api_endpoint    VARCHAR(512),
    kubeconfig_encrypted TEXT,
    cluster_ca_cert TEXT,
    config          JSONB NOT NULL DEFAULT '{}',
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE k8s_node_pools (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id      UUID NOT NULL REFERENCES k8s_clusters(id) ON DELETE CASCADE,
    name            VARCHAR(128) NOT NULL,
    instance_type   VARCHAR(64) NOT NULL,
    min_size        INTEGER NOT NULL DEFAULT 1,
    max_size        INTEGER NOT NULL DEFAULT 10,
    desired_size    INTEGER NOT NULL,
    current_size    INTEGER NOT NULL DEFAULT 0,
    taints          JSONB DEFAULT '[]',
    labels          JSONB DEFAULT '{}',
    status          VARCHAR(20) NOT NULL DEFAULT 'creating',
    provider_data   JSONB DEFAULT '{}',  -- cloud ASG / instance IDs
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cluster_id, name)
);

CREATE TABLE k8s_helm_releases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id      UUID NOT NULL REFERENCES k8s_clusters(id) ON DELETE CASCADE,
    release_name    VARCHAR(128) NOT NULL,
    namespace       VARCHAR(128) NOT NULL DEFAULT 'default',
    chart_name      VARCHAR(256) NOT NULL,
    chart_version   VARCHAR(64) NOT NULL,
    values_encrypted TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','deployed','failed',
                                      'superseded','uninstalled')),
    revision        INTEGER NOT NULL DEFAULT 1,
    installed_by    UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cluster_id, release_name, namespace)
);

CREATE TABLE k8s_hpa_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id      UUID NOT NULL REFERENCES k8s_clusters(id) ON DELETE CASCADE,
    name            VARCHAR(128) NOT NULL,
    target_kind     VARCHAR(32) NOT NULL DEFAULT 'Deployment',
    target_name     VARCHAR(256) NOT NULL,
    namespace       VARCHAR(128) NOT NULL DEFAULT 'default',
    min_replicas    INTEGER NOT NULL DEFAULT 1,
    max_replicas    INTEGER NOT NULL,
    metrics         JSONB NOT NULL,  -- [{type, resource/target}]
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE k8s_backups (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cluster_id      UUID NOT NULL REFERENCES k8s_clusters(id) ON DELETE CASCADE,
    type            VARCHAR(10) NOT NULL CHECK (type IN ('manual', 'scheduled')),
    status          VARCHAR(20) NOT NULL DEFAULT 'running',
    storage_path    VARCHAR(1024),
    size_bytes      BIGINT,
    includes_resources TEXT[],
    excludes_resources TEXT[],
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    triggered_by    UUID REFERENCES users(id)
);
```

### State Machine

```
                ┌──────────────────────────────────────┐
                │                                      │
                ▼                                      │
        ┌──────────────┐                              │
        │ provisioning │                              │
        └──────┬───────┘                              │
               │                                      │
        ┌──────▼───────┐                              │
        │   running    │──────────────────────────┐   │
        └──────┬───────┘                         │   │
               │                                  │   │
     ┌─────────┼─────────┐                       │   │
     │         │         │                       │   │
     ▼         ▼         ▼                       │   │
┌────────┐ ┌────────┐ ┌────────┐                │   │
│upgrad- │ │degraded│ │scaling │                │   │
│ing     │ │        │ │        │                │   │
└───┬────┘ └───┬────┘ └───┬────┘                │   │
    │          │          │                     │   │
    └──────────┼──────────┘                     │   │
               │                                │   │
        ┌──────▼───────┐                        │   │
        │   running    │◀───────────────────────┘   │
        └──────┬───────┘                            │
               │                                    │
        ┌──────▼───────┐                            │
        │   deleting   │                            │
        └──────┬───────┘                            │
               │                                    │
               ▼                                    │
          [deleted]                                 │
               │                                    │
               └────────────────────────────────────┘
```

---

## Service Assignments

| Component | Service | Responsibilities |
|---|---|---|
| Cluster Manager Core | **Orchestrator Agent** | Cluster lifecycle, node pool management, Helm operations |
| kubectl Proxy | **Orchestrator Agent** | WebSocket proxy, kubeconfig generation, audit logging |
| Metrics Bridge | **Orchestrator Agent** | Prometheus auto-deploy, metric scraping, HPA config |
| Cluster UI | **Management Panel** | Cluster dashboard, kubectl terminal, chart browser |
| Backup Controller | **Orchestrator Agent** | Velero integration, backup scheduling, restore workflows |
| Notification Events | **Integration Service** | Cluster status alerts, backup completion, scaling events |
| GitOps Sync | **Orchestrator Agent** (+ Feature 16) | Config-as-code via Git repositories |
| Service Mesh | **Integration Service** (+ Feature 26) | mTLS, traffic splitting for canary deployments |

---

## Effort Estimate

| Phase | Tasks | PT |
|---|---|---|
| Phase 1: Core Provisioning | 1.1–1.5 | 4 |
| Phase 2: Node Pool Management | 2.1–2.4 | 2 |
| Phase 3: kubectl Proxy & Panel | 3.1–3.4 | 2 |
| Phase 4: Helm Integration | 4.1–4.4 | 2 |
| Phase 5: Auto-Scaling & Monitoring | 5.1–5.4 | 2 |
| Phase 6: Backup & Security | 6.1–6.4 | 1 |
| **Total** | **24 tasks** | **13 PT** |

### Risk Factors

| Risk | Mitigation |
|---|---|
| K8s version fragmentation across clusters | Pin supported versions, automate ugprade testing |
| Multi-cloud node provisioning complexity | Abstract via cloud provider factory pattern |
| Long-running cluster operations (upgrade, backup) | Fully async workflows with status streaming |
| Security — kubectl proxy privilege escalation | RBAC scoping per user, audit log all commands |
| Helm chart compatibility issues | Chart validation sandbox, pre-install dry-run |

---

## Monitoring & Observability

### Prometheus Metrics (Cluster Manager)

```python
# Cluster-level
k8s_clusters_total{status}         # Gauge — cluster count by status
k8s_cluster_provision_duration     # Histogram — time to provision
k8s_cluster_upgrade_duration       # Histogram — upgrade duration

# Node pools
k8s_node_pool_nodes{cluster,pool}  # Gauge — node count per pool
k8s_node_pool_capacity{resource}   # Gauge — allocatable CPU/memory

# Helm
k8s_helm_releases_total{status}    # Counter — releases by status
k8s_helm_install_duration          # Histogram — install time

# Proxy
k8s_proxy_commands_total{action}   # Counter — kubectl commands proxied
k8s_proxy_active_sessions          # Gauge — active proxy connections
```

### Logging

```json
{
  "event": "cluster.created",
  "cluster_id": "kc-euprod-7f2a",
  "type": "k3s",
  "version": "v1.30.0+k3s1",
  "duration_ms": 185000,
  "created_by": "usr-abc123"
}
```

---

## Related Documents

- [Architecture Overview](../architecture/overview.md)
- [Orchestrator Agent Architecture](../architecture/orchestrator-agent.md)
- [Feature 16: GitOps Sync](16-gitops-sync.md)
- [Feature 26: Service Mesh](26-service-mesh.md)
- [Implementation Plan v2](../feature-implementation-plan-v2.md)

---

**Last Updated:** May 2026
