# Feature 21: Edge Compute Nodes

- **Plan ID:** #21
- **Category:** Advanced Infrastructure
- **Primary Service:** Orchestrator Agent
- **Effort:** Large (7-10 PT)
- **Dependencies:** Feature 19 (Kubernetes Cluster Manager), Feature 23 (CDN & WAF Integration)

## Overview

Deploy lightweight functions and containers at distributed edge locations for low-latency execution. Edge nodes run small-footprint compute workloads close to end users — ideal for game logic processing, geolocated caching, real-time data transformation, and IoT message handling.

### Key Capabilities

| Capability | Description |
|---|---|
| Edge Node Registration | Auto-registration of edge nodes with capability discovery |
| Function Deployment | Deploy lightweight containers/functions to edge nodes |
| Geo-Routing | Route requests to nearest healthy edge node via DNS/latency-based routing |
| Latency Monitoring | Real-time latency metrics from edge nodes to end users |
| Edge Caching | Distributed caching layer at edge (Redis, CDN-style content cache) |
| Node Lifecycle | Remote management, OTA updates, health reporting |

---

## Architecture

### System Context

```
                         ┌──────────────────┐
                         │  Infra Pilot      │
                         │  Control Plane    │
                         │                   │
                         │  ┌─────────────┐  │
                         │  │ Edge Manager │  │
                         │  └──────┬──────┘  │
                         └─────────┼──────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
     ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
     │ Edge Node       │  │ Edge Node       │  │ Edge Node       │
     │ (US-East)       │  │ (EU-West)       │  │ (AP-Southeast)  │
     │                 │  │                 │  │                 │
     │ ┌───────────┐   │  │ ┌───────────┐   │  │ ┌───────────┐   │
     │ │ Functions │   │  │ │ Functions │   │  │ │ Functions │   │
     │ ├───────────┤   │  │ ├───────────┤   │  │ ├───────────┤   │
     │ │ Containers│   │  │ │ Containers│   │  │ │ Containers│   │
     │ ├───────────┤   │  │ ├───────────┤   │  │ ├───────────┤   │
     │ │ Cache     │   │  │ │ Cache     │   │  │ │ Cache     │   │
     │ └───────────┘   │  │ └───────────┘   │  │ └───────────┘   │
     └────────────────┘  └────────────────┘  └────────────────┘
              │                    │                    │
              └────────────────────┼────────────────────┘
                                   │
                         ┌─────────▼──────────┐
                         │  Global DNS/LB      │
                         │  (Geo-Routing)      │
                         └────────────────────┘
                                   │
                         ┌─────────▼──────────┐
                         │  End Users          │
                         └────────────────────┘
```

### Component Architecture

```
┌────────────────────────────────────────────────────┐
│              Edge Manager (Orchestrator Agent)       │
├────────────────────────────────────────────────────┤
│                                                      │
│  ┌───────────────────┐  ┌───────────────────────┐  │
│  │ Node Registry      │  │ Deployment Controller │  │
│  │                    │  │                       │  │
│  │ - Heartbeat recv   │  │ - Container dispatch  │  │
│  │ - Capability store │  │ - Function scheduler  │  │
│  │ - Health tracker   │  │ - Image pull mgmt    │  │
│  └─────────┬─────────┘  └───────────┬───────────┘  │
│            │                        │               │
│  ┌─────────▼────────────────────────▼───────────┐  │
│  │              Edge Node Agent                   │  │
│  │  (runs ON each edge node, connects to CP)      │  │
│  │                                                 │  │
│  │  ┌───────────┐  ┌──────────┐  ┌─────────────┐ │  │
│  │  │ Workload  │  │ Cache    │  │ Latency      │ │  │
│  │  │ Runner    │  │ Daemon   │  │ Reporter     │ │  │
│  │  │ (contain'd)│  │ (Redis)  │  │              │ │  │
│  │  └───────────┘  └──────────┘  └─────────────┘ │  │
│  └────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### Interaction Flow

```
Edge Node Registration:

    Edge Node                       Control Plane
        │                                │
        │  POST /edge/nodes/register     │
        │  { hostname, ip, capabilities, │
        │    region, geo_coordinates }   │
        │───────────────────────────────▶│
        │                                │  Validate + store
        │                                │  Assign node_id
        │  { node_id, config, token }    │
        │◀───────────────────────────────│
        │                                │
        │  Periodic heartbeat (30s)      │
        │  { status, load, uptime }      │
        │───────────────────────────────▶│

Function Deployment:

    Panel User                      Control Plane                   Edge Node
        │                                │                              │
        │  POST /edge/deploy             │                              │
        │  { function, image, routing }  │                              │
        │───────────────────────────────▶│                              │
        │                                │  Select edge nodes (geo)    │
        │                                │──────────────────────────────▶│
        │                                │  Pull image, start workload │
        │                                │◀─────────────────────────────│
        │  { status: "running",          │                              │
        │    endpoints: [...] }          │                              │
        │◀───────────────────────────────│                              │

Geo-Routed Request:

    End User ──▶ DNS (latency-based) ──▶ Edge Node (US-East)
                │                           │
                │                           ├── If cached → respond
                │                           ├── Else → function executes
                │                           └── Return result
```

---

## Implementation Plan

### Phase 1: Edge Node Agent (2 PT)

| Task | Description |
|---|---|
| 1.1 | Build edge node agent binary (Go/Rust — minimal footprint) |
| 1.2 | Registration handshake with control plane (mTLS, token-based auth) |
| 1.3 | Heartbeat and health reporting protocol (gRPC streaming) |
| 1.4 | Capability discovery (CPU arch, available runtimes, GPU, storage) |
| 1.5 | OTA update mechanism for edge agent itself |

### Phase 2: Workload Deployment (2.5 PT)

| Task | Description |
|---|---|
| 2.1 | Container workload runner (containerd/podman integration) |
| 2.2 | Function workload runner (isolated process per invocation) |
| 2.3 | Image/function registry integration (pull, cache, verify signatures) |
| 2.4 | Resource isolation (cgroups, namespace limits per workload) |
| 2.5 | Workload lifecycle management (start, stop, restart, migrate) |

### Phase 3: Geo-Routing & Latency Monitoring (2 PT)

| Task | Description |
|---|---|
| 3.1 | Latency probe network (ICMP/HTTP probes from edge nodes to users) |
| 3.2 | Geo-DNS integration (Route53 latency routing, Cloudflare geo-steering) |
| 3.3 | Request routing at edge node level (reverse proxy with affinity) |
| 3.4 | Latency dashboard in Panel (heatmap, percentile charts) |

### Phase 4: Edge Caching (1.5 PT)

| Task | Description |
|---|---|
| 4.1 | Edge cache daemon (Redis-based distributed cache) |
| 4.2 | Cache invalidation propagation (control plane broadcasts invalidation) |
| 4.3 | Read-through / write-through cache policies |
| 4.4 | Cache hit ratio monitoring and optimization suggestions |

### Phase 5: Panel & Management UI (1 PT)

| Task | Description |
|---|---|
| 5.1 | Edge node inventory and status dashboard |
| 5.2 | Workload deployment form (image, resources, geo-targeting) |
| 5.3 | Edge function logs viewer (streaming logs per node) |
| 5.4 | Geo-latency heatmap visualization |

---

## API Design

### Endpoints

All endpoints are prefixed with `/api/v2/edge`.

#### Node Management

```
GET    /api/v2/edge/nodes                       — List all edge nodes
POST   /api/v2/edge/nodes/register              — Register new edge node
GET    /api/v2/edge/nodes/{node_id}              — Get node details
PATCH  /api/v2/edge/nodes/{node_id}              — Update node config
DELETE /api/v2/edge/nodes/{node_id}              — Deregister node
POST   /api/v2/edge/nodes/{node_id}/upgrade      — Trigger OTA upgrade
```

#### Workloads

```
GET    /api/v2/edge/workloads                   — List deployed workloads
POST   /api/v2/edge/workloads                   — Deploy workload
GET    /api/v2/edge/workloads/{workload_id}      — Get workload details
PATCH  /api/v2/edge/workloads/{workload_id}      — Update workload config
DELETE /api/v2/edge/workloads/{workload_id}      — Remove workload
POST   /api/v2/edge/workloads/{workload_id}/restart  — Restart workload
```

#### Routing

```
GET    /api/v2/edge/routing/rules               — List geo-routing rules
POST   /api/v2/edge/routing/rules               — Create routing rule
PATCH  /api/v2/edge/routing/rules/{rule_id}     — Update rule
DELETE /api/v2/edge/routing/rules/{rule_id}     — Delete rule
```

#### Cache

```
GET    /api/v2/edge/cache/stats                 — Global cache statistics
POST   /api/v2/edge/cache/invalidate            — Invalidate cache keys
GET    /api/v2/edge/cache/keys                  — List cached keys
```

#### Latency

```
GET    /api/v2/edge/latency                     — Current latency map
GET    /api/v2/edge/latency/{node_id}           — Node-specific latency
GET    /api/v2/edge/latency/history?window=24h  — Latency history
```

### Request/Response Examples

#### Register Edge Node

```json
POST /api/v2/edge/nodes/register

{
  "hostname": "edge-fra1-01",
  "ip_address": "203.0.113.45",
  "region": "eu-central-1",
  "coordinates": {
    "lat": 50.1109,
    "lon": 8.6821
  },
  "capabilities": {
    "architecture": "x86_64",
    "cpu_cores": 4,
    "memory_mb": 8192,
    "disk_mb": 102400,
    "runtimes": ["docker", "wasm"],
    "gpu": false,
    "network_bandwidth_mbps": 1000
  },
  "labels": {
    "tier": "compute",
    "provider": "hetzner"
  }
}
```

Response:

```json
{
  "node_id": "edge-fra1-01-a1b2",
  "status": "registered",
  "agent_version": "1.0.0",
  "config": {
    "heartbeat_interval_sec": 30,
    "max_workloads": 10,
    "cache_limit_mb": 2048
  },
  "auth_token": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

#### Deploy Workload

```json
POST /api/v2/edge/workloads

{
  "name": "game-lobby-router",
  "type": "container",
  "image": "infrapilot/game-lobby:v2.1.0",
  "command": ["--config", "/etc/config.yaml"],
  "resources": {
    "cpu_limit": 1.0,
    "memory_limit_mb": 512,
    "disk_mb": 1024
  },
  "targeting": {
    "regions": ["eu-central-1", "eu-west-1"],
    "min_nodes": 2,
    "max_nodes": 10,
    "node_selector": {
      "labels": {"tier": "compute"}
    }
  },
  "routing": {
    "domain": "lobby.game.infra-pilot.io",
    "path": "/ws",
    "protocol": "websocket",
    "health_check": {
      "path": "/health",
      "interval_sec": 10
    }
  },
  "env": {
    "LOG_LEVEL": "info",
    "REDIS_URL": "redis://cache.internal:6379"
  },
  "ports": [
    {"container": 8080, "protocol": "tcp"}
  ]
}
```

Response:

```json
{
  "workload_id": "wl-game-lobby-eu",
  "status": "deploying",
  "target_nodes": [
    {"node_id": "edge-fra1-01-a1b2", "status": "pulling_image"},
    {"node_id": "edge-fra1-02-c3d4", "status": "pulling_image"},
    {"node_id": "edge-ams1-01-e5f6", "status": "pending"}
  ],
  "routing_domain": "lobby.game.infra-pilot.io",
  "created_at": "2026-05-27T12:00:00Z"
}
```

#### Edge Function (FaaS-style)

```json
POST /api/v2/edge/workloads

{
  "name": "player-lookup",
  "type": "function",
  "runtime": "nodejs18",
  "source": "https://github.com/infrapilot/edge-functions/player-lookup",
  "handler": "index.handler",
  "memory_limit_mb": 128,
  "timeout_sec": 10,
  "targeting": {
    "regions": ["*"]
  },
  "routing": {
    "domain": "api.game.infra-pilot.io",
    "path": "/players/:id"
  }
}
```

---

## Data Model

### Edge Node

```sql
CREATE TABLE edge_nodes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hostname        VARCHAR(256) NOT NULL UNIQUE,
    ip_address      INET NOT NULL,
    agent_version   VARCHAR(32) NOT NULL,
    region          VARCHAR(64) NOT NULL,
    coordinates     JSONB,  -- {"lat": 50.11, "lon": 8.68}
    capabilities    JSONB NOT NULL,
    labels          JSONB DEFAULT '{}',
    status          VARCHAR(20) NOT NULL DEFAULT 'registered'
                    CHECK (status IN ('registered', 'online', 'offline',
                                      'degraded', 'upgrading', 'deregistered')),
    auth_token_hash VARCHAR(128) NOT NULL,
    tls_cert        TEXT,
    last_heartbeat  TIMESTAMPTZ,
    workload_count  INTEGER DEFAULT 0,
    load_avg_1m     DECIMAL(5,2),
    memory_used_mb  INTEGER,
    disk_used_mb    INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_edge_nodes_region ON edge_nodes (region);
CREATE INDEX idx_edge_nodes_status ON edge_nodes (status);
```

### Workload

```sql
CREATE TABLE edge_workloads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(128) NOT NULL,
    type            VARCHAR(10) NOT NULL CHECK (type IN ('container', 'function')),
    image           VARCHAR(512),
    runtime         VARCHAR(32),
    source_repo     VARCHAR(512),
    handler         VARCHAR(256),
    resources       JSONB NOT NULL,
    targeting       JSONB NOT NULL,
    routing         JSONB NOT NULL,
    env_encrypted   TEXT,
    ports           JSONB DEFAULT '[]',
    status          VARCHAR(20) NOT NULL DEFAULT 'creating'
                    CHECK (status IN ('creating', 'running', 'updating',
                                      'degraded', 'stopped', 'error', 'deleting')),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Workload Deployment (Node Assignment)

```sql
CREATE TABLE edge_workload_deployments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workload_id     UUID NOT NULL REFERENCES edge_workloads(id) ON DELETE CASCADE,
    node_id         UUID NOT NULL REFERENCES edge_nodes(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'pulling', 'running',
                                      'stopped', 'error', 'evicted')),
    container_id    VARCHAR(128),
    port_mappings   JSONB DEFAULT '[]',
    started_at      TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workload_id, node_id)
);
```

### Geo-Routing Rules

```sql
CREATE TABLE edge_routing_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workload_id     UUID NOT NULL REFERENCES edge_workloads(id) ON DELETE CASCADE,
    domain          VARCHAR(256) NOT NULL,
    path            VARCHAR(256) DEFAULT '/',
    protocol        VARCHAR(20) DEFAULT 'http',
    strategy        VARCHAR(20) NOT NULL DEFAULT 'latency'
                    CHECK (strategy IN ('latency', 'geo', 'weighted', 'custom')),
    rule_config     JSONB NOT NULL DEFAULT '{}',
    health_check    JSONB,
    tls_config      JSONB,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Edge Cache

```sql
CREATE TABLE edge_cache_stats (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id         UUID NOT NULL REFERENCES edge_nodes(id) ON DELETE CASCADE,
    keys_count      INTEGER NOT NULL DEFAULT 0,
    memory_used_mb  INTEGER NOT NULL DEFAULT 0,
    hit_count       BIGINT NOT NULL DEFAULT 0,
    miss_count      BIGINT NOT NULL DEFAULT 0,
    hit_ratio       DECIMAL(5,4),
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE edge_cache_keys (
    key_hash        VARCHAR(64) PRIMARY KEY,
    key_name        VARCHAR(512) NOT NULL,
    workload_id     UUID REFERENCES edge_workloads(id) ON DELETE CASCADE,
    size_bytes      INTEGER NOT NULL,
    ttl_seconds     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);
```

---

## Service Assignments

| Component | Service | Responsibilities |
|---|---|---|
| Edge Manager | **Orchestrator Agent** | Node registry, deployment controller, workload scheduler |
| Edge Node Agent | **Orchestrator Agent** (new subcomponent) | Agent binary on each edge node, runs workloads |
| Geo-Routing Controller | **Orchestrator Agent** | DNS integration, latency routing, request routing |
| Edge Cache Daemon | **Orchestrator Agent** (new subcomponent) | Redis-based distributed cache per edge node |
| Monitoring & Latency | **Orchestrator Agent** | Latency probes, metrics collection, reporting |
| Edge UI | **Management Panel** | Node dashboard, workload deploy, latency heatmap |
| CDN Integration | **Integration Service** (+ Feature 23) | CDN + WAF rules for edge endpoints |
| Auth & Secrets | **Integration Service** (+ Feature 47) | Edge node auth tokens, workload secrets |

---

## Effort Estimate

| Phase | Tasks | PT |
|---|---|---|
| Phase 1: Edge Node Agent | 1.1–1.5 | 2 |
| Phase 2: Workload Deployment | 2.1–2.5 | 2.5 |
| Phase 3: Geo-Routing & Latency Monitoring | 3.1–3.4 | 2 |
| Phase 4: Edge Caching | 4.1–4.4 | 1.5 |
| Phase 5: Panel & Management UI | 5.1–5.4 | 1 |
| **Total** | **23 tasks** | **9 PT** |

### Risk Factors

| Risk | Mitigation |
|---|---|
| Edge node hardware diversity | Capability discovery at registration, workload scheduling respects constraints |
| Network partitions | Store-and-forward for heartbeats; agent runs autonomously for defined period |
| Cache inconsistency across nodes | Centralized invalidation broadcast via control plane; short TTL fallback |
| Cold start latency for functions | Pre-warm pools for critical functions; Wasm-based runtimes for sub-millisecond startup |
| Agent compromise at edge | mTLS with short-lived certs, workload isolation, resource limits, audit logging |

---

## Monitoring & Observability

### Prometheus Metrics

```python
# Nodes
edge_nodes_total{status,region}              # Gauge — node count
edge_node_uptime_seconds{node}               # Gauge — node uptime
edge_node_load_1m{node}                      # Gauge — CPU load avg
edge_node_memory_used_bytes{node}            # Gauge — memory usage
edge_node_disk_used_bytes{node}              # Gauge — disk usage

# Workloads
edge_workloads_total{type,status}            # Gauge — workload count
edge_workload_cpu_usage{workload,node}       # Gauge — CPU usage per workload
edge_workload_memory_usage{workload,node}    # Gauge — memory usage

# Routing
edge_routing_request_count{domain,status}    # Counter — routed requests
edge_routing_latency_ms{domain,node}         # Histogram — request latency

# Cache
edge_cache_hit_ratio{node}                   # Gauge — hit ratio
edge_cache_keys_count{node}                  # Gauge — cache keys
edge_cache_memory_used_bytes{node}           # Gauge — cache memory

# Latency
edge_latency_ms{source_node,target_region}   # Gauge — inter-node latency
```

### Logging

```json
{
  "event": "edge.node.registered",
  "node_id": "edge-fra1-01-a1b2",
  "hostname": "edge-fra1-01",
  "region": "eu-central-1",
  "agent_version": "1.0.0"
}

{
  "event": "edge.workload.deployed",
  "workload_id": "wl-game-lobby-eu",
  "type": "container",
  "node_id": "edge-fra1-01-a1b2",
  "duration_ms": 3400
}

{
  "event": "edge.latency.spike",
  "node_id": "edge-ams1-01-e5f6",
  "target_region": "us-west-2",
  "latency_ms": 345,
  "threshold_ms": 200,
  "severity": "warning"
}
```

---

## Related Documents

- [Architecture Overview](../architecture/overview.md)
- [Orchestrator Agent Architecture](../architecture/orchestrator-agent.md)
- [Feature 19: Kubernetes Cluster Manager](19-kubernetes-cluster-manager.md)
- [Feature 22: Serverless Functions (FaaS)](22-serverless-functions-faas.md)
- [Feature 23: CDN & WAF Integration](23-cdn-waf-integration.md)
- [Implementation Plan v2](../feature-implementation-plan-v2.md)

---

**Last Updated:** May 2026
