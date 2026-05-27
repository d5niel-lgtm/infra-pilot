# Feature 26: Service Mesh Integration

| Metadata | Value |
|----------|-------|
| Feature ID | 26 |
| Feature Name | Service Mesh Integration |
| Primary Service | Integration Service |
| Effort Estimate | Large (7–10 PT) |
| Status | Planned |

---

## 1. Overview

Deep integration with **Istio** and **Linkerd** service meshes, providing zero-trust mTLS between all services, fine-grained traffic splitting for canary deployments, and comprehensive observability dashboards — all managed from the Panel with a simplified UX that abstracts mesh complexity.

### Goals

- Enable mTLS with one click — no manual certificate management
- Simplify canary deployments via traffic weight / header / mirror rules
- Provide unified telemetry (golden signals: latency, traffic, errors, saturation)
- Support multi-cluster mesh federation (future)
- Reduce operational overhead with pre-built mesh profiles (dev, staging, prod)

---

## 2. Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                            Panel (UI)                                   │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐ │
│  │ Mesh Dashboard  │  │ Traffic Manager  │  │ Observability Explorer  │ │
│  │ (overview,     │  │ (routing rules,  │  │ (Jaeger, Grafana, Kiali)│ │
│  │  status)       │  │  canary config)  │  │                          │ │
│  └───────┬────────┘  └────────┬────────┘  └────────────┬─────────────┘ │
└──────────┼────────────────────┼────────────────────────┼───────────────┘
           │                    │                        │
           ▼                    ▼                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Integration Service                              │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    Mesh Abstraction Layer                         │   │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │   │
│  │  │   Istio Adapter   │  │   Linkerd Adapter│  │  (Future:    │  │   │
│  │  │   (istio.io/v1)   │  │   (linkerd.io)   │  │  Consul,     │  │   │
│  │  │                   │  │                  │  │  Kuma…)      │  │   │
│  │  └────────┬─────────┘  └────────┬─────────┘  └───────┬───────┘  │   │
│  └───────────┼─────────────────────┼────────────────────┼───────────┘   │
│              │                     │                    │               │
│  ┌───────────┴─────────────────────┴────────────────────┴───────────┐   │
│  │                    Mesh Operator                                   │   │
│  │  ┌──────────────┐ ┌────────────────┐ ┌────────────────────────┐   │   │
│  │  │ Sidecar      │ │ mTLS / Security│ │ Traffic Management    │   │   │
│  │  │ Injector     │ │ Manager        │ │ (VS, DR, GW CRDs)     │   │   │
│  │  └──────────────┘ └────────────────┘ └────────────────────────┘   │   │
│  │  ┌──────────────┐ ┌────────────────┐ ┌────────────────────────┐   │   │
│  │  │ Telemetry    │ │ Canary         │ │ Dashboard / Export    │   │   │
│  │  │ Collector    │ │ Controller     │ │ (Prometheus, Grafana) │   │   │
│  │  └──────────────┘ └────────────────┘ └────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
           │                    │                        │
           ▼                    ▼                        ▼
┌──────────────┐    ┌──────────────────┐    ┌───────────────────────┐
│ Kubernetes   │    │ Istio / Linkerd  │    │ Prometheus / Jaeger   │
│ API Server   │    │ Control Plane    │    │ / Grafana / Kiali     │
│ (CRDs)       │    │ (istiod /       │    │                       │
│              │    │  linkerd-cp)    │    │                       │
└──────────────┘    └──────────────────┘    └───────────────────────┘
```

### Component Responsibilities

| Component | Role |
|-----------|------|
| Panel | Mesh dashboard, traffic manager UI, canary wizard, observability explorer |
| Integration Service | Provider abstraction, CRD generation, telemetry aggregation |
| Istio / Linkerd Adapter | Translates Panel config into provider-specific CRDs (VirtualService, DestinationRule, ServiceEntry, etc.) |
| Sidecar Injector | Manages automatic sidecar injection via namespace labels and annotations |
| mTLS Manager | Configures peer authentication, destination rules, and certificate rotation |
| Traffic Manager | Creates and updates VirtualService / DestinationRule / ServiceEntry resources |
| Canary Controller | Manages progressive traffic shifting with automated rollback gates |
| Telemetry Collector | Aggregates Prometheus metrics and Jaeger traces for the dashboard |

---

## 3. Data Model

### `mesh_profiles`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| environment_id | UUID | FK → environments.id |
| name | VARCHAR | e.g. "production-mesh" |
| provider | ENUM | "istio", "linkerd" |
| version | VARCHAR | e.g. "1.20.2" |
| status | ENUM | installing, active, degraded, removed |
| mTLS | ENUM | "disabled", "permissive", "strict" |
| config | JSONB | Provider-specific mesh config |
| telemetry_enabled | BOOLEAN | |
| tracing_enabled | BOOLEAN | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `mesh_namespaces`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| profile_id | UUID | FK → mesh_profiles.id |
| namespace | VARCHAR | Kubernetes namespace |
| sidecar_injection | ENUM | "enabled", "disabled", "inherit" |
| mTLS_mode | ENUM | "inherit", "strict", "permissive" |
| created_at | TIMESTAMPTZ | |

### `mesh_traffic_rules`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| profile_id | UUID | FK → mesh_profiles.id |
| name | VARCHAR | Rule name |
| rule_type | ENUM | "routing", "canary", "mirroring", "timeout", "retry", "fault_injection" |
| source_service | VARCHAR | |
| destination_service | VARCHAR | |
| config | JSONB | Type-specific configuration |
| enabled | BOOLEAN | |
| priority | INT | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `mesh_canary_releases`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| profile_id | UUID | FK → mesh_profiles.id |
| name | VARCHAR | e.g. "api-v2-canary" |
| target_service | VARCHAR | |
| target_namespace | VARCHAR | |
| baseline_version | VARCHAR | |
| canary_version | VARCHAR | |
| strategy | ENUM | "weighted", "header_based", "mirror_based" |
| steps | JSONB | Traffic weight progression e.g. `[{"weight":5, "duration":"10m"}, {"weight":25, ...}]` |
| metrics_gates | JSONB | Success rate, latency, error budget thresholds |
| current_step | INT | |
| status | ENUM | running, promoted, rolled_back, failed, completed |
| started_at | TIMESTAMPTZ | |
| promoted_at | TIMESTAMPTZ | |

### `mesh_telemetry`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| profile_id | UUID | FK → mesh_profiles.id |
| source_service | VARCHAR | |
| destination_service | VARCHAR | |
| metric | VARCHAR | "request_count", "error_rate", "p50_latency", "p99_latency" |
| value | FLOAT | |
| timestamp | TIMESTAMPTZ | |

---

## 4. API Design

### Mesh Profiles

```
POST   /api/v2/mesh/profiles                   — Install / create mesh profile
GET    /api/v2/mesh/profiles                    — List mesh profiles
GET    /api/v2/mesh/profiles/:id                — Get profile details
PUT    /api/v2/mesh/profiles/:id                — Update mesh configuration
DELETE /api/v2/mesh/profiles/:id                — Uninstall mesh
GET    /api/v2/mesh/profiles/:id/status         — Detailed health status
```

### Namespace Management

```
GET    /api/v2/mesh/profiles/:id/namespaces     — List mesh-enabled namespaces
POST   /api/v2/mesh/profiles/:id/namespaces     — Enable mesh for a namespace
PUT    /api/v2/mesh/profiles/:id/namespaces/:nid — Update namespace config
DELETE /api/v2/mesh/profiles/:id/namespaces/:nid — Disable mesh for namespace
```

### Traffic Rules

```
GET    /api/v2/mesh/profiles/:id/rules          — List traffic rules
POST   /api/v2/mesh/profiles/:id/rules          — Create traffic rule
PUT    /api/v2/mesh/profiles/:id/rules/:rid     — Update traffic rule
DELETE /api/v2/mesh/profiles/:id/rules/:rid     — Delete traffic rule
POST   /api/v2/mesh/profiles/:id/rules/simulate — Simulate rule before applying
```

### Canary Releases

```
GET    /api/v2/mesh/profiles/:id/canaries       — List canary releases
POST   /api/v2/mesh/profiles/:id/canaries       — Start canary release
GET    /api/v2/mesh/profiles/:id/canaries/:cid   — Get canary details
POST   /api/v2/mesh/profiles/:id/canaries/:cid/promote  — Promote canary to 100%
POST   /api/v2/mesh/profiles/:id/canaries/:cid/rollback — Rollback canary
```

### mTLS & Security

```
GET    /api/v2/mesh/profiles/:id/mtls           — Get mTLS status
PUT    /api/v2/mesh/profiles/:id/mtls           — Update mTLS mode (strict/permissive/disabled)
POST   /api/v2/mesh/profiles/:id/mtls/rotate    — Rotate mTLS certificates
```

### Telemetry

```
GET    /api/v2/mesh/profiles/:id/telemetry      — Service graph + golden signals
GET    /api/v2/mesh/profiles/:id/telemetry/services/:svc — Per-service metrics
GET    /api/v2/mesh/profiles/:id/telemetry/topology     — Service dependency graph
GET    /api/v2/mesh/profiles/:id/telemetry/traces      — Recent traces (Jaeger-backed)
```

---

## 5. Implementation Plan

### Phase 1 — Mesh Provider Abstraction & Profile Management (2 PT)

1. Define `MeshAdapter` interface:
   - `installMesh(config)` → provisions mesh control plane via Helm
   - `uninstallMesh(profileId)` → removes mesh
   - `enableSidecarInjection(namespace)`, `disableSidecarInjection(namespace)`
   - `createVirtualService(rule)`, `createDestinationRule(rule)`
   - `getMeshStatus()` → health + version

2. Implement Istio adapter (generates `VirtualService`, `DestinationRule`, `PeerAuthentication`, `ServiceEntry` CRDs)
3. Implement Linkerd adapter (generates `HTTPRoute`, `ServiceProfile`, `TrafficSplit` CRDs)
4. Build `mesh_profiles` CRUD + Helm-based install/uninstall workflow

### Phase 2 — Sidecar Injection & mTLS (1.5 PT)

1. Namespace-level sidecar injection management (enable/disable via labels)
2. mTLS mode configuration (`STRICT` / `PERMISSIVE` / `DISABLE`)
3. Certificate rotation endpoint
4. mTLS status dashboard (percentage of traffic encrypted)

### Phase 3 — Traffic Management (2 PT)

1. Routing rules CRUD (VirtualService / ServiceProfile generation)
2. Fault injection rules (delay, abort)
3. Timeout and retry rule configuration
4. Mirroring (shadow traffic to a new version)
5. Rule validation + dry-run simulation

### Phase 4 — Canary Releases (2 PT)

1. Canary release controller — step-based traffic shifting
2. Metrics gates: success rate, latency, error budget
3. Auto-promote / auto-rollback based on gate thresholds
4. Canary overview dashboard (current step, metrics, decision)

### Phase 5 — Observability (1 PT)

1. Prometheus metric scraping configuration for mesh telemetry
2. Jaeger tracing integration
3. Kiali-like service graph embedded in Panel
4. Golden signals dashboard (RED method: Rate, Errors, Duration)

### Phase 6 — UI & Polish (0.5–1 PT)

1. Mesh overview dashboard (status, version, service count, mTLS %, traffic rates)
2. Traffic rule editor with YAML preview
3. Canary wizard with visual step configuration
4. Service topology graph (interactive D3/vis.js)
5. Export metrics to Grafana datasource

---

## 6. Configuration Examples

### Mesh Profile Creation (POST /api/v2/mesh/profiles)

```json
{
  "name": "production-mesh",
  "environment_id": "env-prod-001",
  "provider": "istio",
  "version": "1.20.2",
  "config": {
    "control_plane": {
      "replicas": 3,
      "cpu": "500m",
      "memory": "1Gi"
    },
    "proxy": {
      "cpu": "100m",
      "memory": "256Mi",
      "log_level": "warning"
    },
    "mesh_config": {
      "enable_auto_mtls": true,
      "access_log_format": "JSON",
      "outbound_traffic_policy": "ALLOW_ANY"
    }
  },
  "mtls": "strict",
  "telemetry_enabled": true,
  "tracing_enabled": true,
  "namespaces": ["default", "api", "frontend", "backend"]
}
```

### Canary Release (POST /api/v2/mesh/profiles/:id/canaries)

```json
{
  "name": "api-v2-2026-05",
  "target_service": "api-gateway",
  "target_namespace": "api",
  "baseline_version": "v1.3.0",
  "canary_version": "v2.0.0-beta.1",
  "strategy": "weighted",
  "steps": [
    {"weight": 5, "duration": "10m"},
    {"weight": 25, "duration": "20m"},
    {"weight": 50, "duration": "30m"},
    {"weight": 75, "duration": "20m"},
    {"weight": 100, "duration": "0m"}
  ],
  "metrics_gates": {
    "error_rate": {"threshold": 0.01, "window": "5m"},
    "p99_latency_ms": {"threshold": 500, "window": "5m"},
    "success_rate": {"threshold": 0.995, "window": "5m"}
  }
}
```

### Traffic Splitting Rule (POST /api/v2/mesh/profiles/:id/rules)

```json
{
  "name": "canary-api-split",
  "rule_type": "canary",
  "source_service": "ingress-gateway",
  "destination_service": "api-gateway",
  "config": {
    "hosts": ["api.example.com"],
    "subsets": [
      {
        "name": "stable",
        "labels": {"version": "v1.3.0"},
        "weight": 75
      },
      {
        "name": "canary",
        "labels": {"version": "v2.0.0-beta.1"},
        "weight": 25,
        "headers": {
          "request": {
            "set": {
              "X-Canary": "true"
            }
          }
        }
      }
    ],
    "mirror": {
      "percentage": 10,
      "host": "api-gateway-shadow",
      "subset": "canary"
    },
    "retries": {
      "attempts": 3,
      "per_try_timeout": "2s"
    },
    "fault_injection": null,
    "timeout": "10s"
  },
  "enabled": true,
  "priority": 100
}
```

### Istio CRDs Generated by Adapter

```yaml
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-gateway-canary
  namespace: api
spec:
  hosts:
    - api.example.com
  gateways:
    - ingress-gateway
  http:
    - match:
        - headers:
            X-Canary:
              exact: "true"
      route:
        - destination:
            host: api-gateway
            subset: canary
          weight: 100
    - route:
        - destination:
            host: api-gateway
            subset: stable
          weight: 75
        - destination:
            host: api-gateway
            subset: canary
          weight: 25
      timeout: 10s
      retries:
        attempts: 3
        perTryTimeout: 2s
      mirror:
        host: api-gateway-shadow
        subset: canary
      mirrorPercentage:
        value: 10.0
---
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: api-gateway-subsets
  namespace: api
spec:
  host: api-gateway
  subsets:
    - name: stable
      labels:
        version: v1.3.0
    - name: canary
      labels:
        version: v2.0.0-beta.1
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 1024
        maxRequestsPerConnection: 10
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
```

---

## 7. Service Assignments

| Service | Responsibilities |
|---------|------------------|
| **Integration Service** | Mesh adapter layer, CRD generation, Helm lifecycle, telemetry aggregation |
| **Orchestrator Agent** | Canary release controller, progressive traffic shifting, gate evaluation |
| **Panel** | Mesh dashboard, traffic rule editor, canary wizard, service graph, observability explorer |
| **Database** | `mesh_profiles`, `mesh_namespaces`, `mesh_traffic_rules`, `mesh_canary_releases`, `mesh_telemetry` |
| **Scheduler** | Canary step progression cron, telemetry aggregation intervals |
| **Notification Service** | Canary promote/rollback alerts, mTLS cert expiry warnings |

---

## 8. Effort Breakdown

| Task | PT | Dependencies |
|------|----|-------------|
| MeshAdapter interface + Helm lifecycle | 1.0 | — |
| Istio adapter (VirtualService, DestinationRule, PeerAuthentication) | 1.0 | MeshAdapter |
| Linkerd adapter (HTTPRoute, TrafficSplit, ServiceProfile) | 1.0 | MeshAdapter |
| Sidecar injection management | 0.5 | Adapters |
| mTLS configuration + certificate rotation | 1.0 | Adapters |
| Traffic rules CRUD + validation | 1.0 | Adapters |
| Fault injection / timeout / retry rules | 0.5 | Traffic rules |
| Canary controller + step progression | 1.5 | Traffic rules |
| Metrics gates (auto-promote / rollback) | 0.5 | Canary controller |
| Prometheus / Jaeger telemetry collector | 1.0 | — |
| Service graph + golden signals dashboard | 1.0 | Telemetry |
| UI screens (mesh overview, rules, canary wizard, topology) | 1.5 | All APIs |
| Documentation & tests | 0.5 | — |

---

## 9. Mesh Provider Comparison

| Aspect | Istio | Linkerd |
|--------|-------|---------|
| **Control plane** | istiod (single binary) | linkerd-controller, identity, tap, destination |
| **Proxy** | Envoy | linkerd2-proxy (Rust) |
| **mTLS** | Built-in, SPIFFE certs | Built-in, identity controller |
| **Traffic splitting** | VirtualService + DestinationRule | TrafficSplit + ServiceProfile |
| **Canary support** | Manual (VS weights) + Flagger | Manual (TS weights) + Flagger |
| **Telemetry** | Prometheus + Grafana + Kiali | Linkerd-Viz + Grafana |
| **Tracing** | Jaeger / Zipkin | OpenCensus collector |
| **Performance overhead** | ~5–15 ms per hop | ~1–5 ms per hop |
| **Resource usage** | Higher (Envoy) | Lower (Rust proxy) |
| **K8s CRDs** | 50+ | 10+ |

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Envoy proxy memory leak in long-running canaries | Pod OOM, traffic disruption | Set proxy resource limits; implement canary step timeout |
| mTLS certificate rotation failure | Mesh communication broken | Monitor cert expiry; pre-rotate before expiry; fallback to permissive mode |
| Traffic split misconfiguration | Incorrect routing for real users | Simulation endpoint that dry-runs VirtualService generation; integration tests for each rule type |
| Istio CRD version drift across upgrades | Rule application failure | Version-pin CRDs; automated upgrade tests in staging |
| High cardinality telemetry explodes Prometheus | Expensive queries, slow dashboard | Aggregation rules (5m, 30m, 1h rollups); cardinality limits on request labels |
