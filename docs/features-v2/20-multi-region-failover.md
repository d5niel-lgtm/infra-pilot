# Feature 20: Multi-Region Failover

- **Plan ID:** #20
- **Category:** Advanced Infrastructure
- **Primary Service:** Integration Service
- **Effort:** Large (7-10 PT)
- **Dependencies:** Feature 13 (Webhook Event Bus), Feature 25 (Disaster Recovery Orchestrator)

## Overview

Active-passive multi-region failover for services managed by Infra Pilot. Health-based DNS failover automatically redirects traffic from a degraded primary region to a healthy standby region. Includes data replication lag monitoring, automatic traffic switching, and scheduled cutover testing.

### Key Capabilities

| Capability | Description |
|---|---|
| Region Health Monitoring | Multi-probe health checks across regions, composite health scores |
| DNS Failover | Route53 (AWS) and Cloudflare DNS failover policies |
| Data Replication Monitoring | Track replication lag, sync status, consistency checks |
| Automatic Traffic Switch | Configurable thresholds trigger region switch with rollback |
| Cutover Testing | Scheduled drills with automated validation, report generation |
| Traffic Draining | Graceful connection draining before region switch |

---

## Architecture

### System Context

```
                         ┌─────────────────┐
                         │  Global DNS      │
                         │  (Route53 / CF)  │
                         └────────┬─────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                 │
         ┌───────▼───────┐       │        ┌───────▼───────┐
         │  Region A     │       │        │  Region B     │
         │  (Primary)    │       │        │  (Standby)    │
         │               │       │        │               │
         │  ┌─────────┐  │       │        │  ┌─────────┐  │
         │  │Services │  │       │        │  │Services │  │
         │  └─────────┘  │       │        │  └─────────┘  │
         │  ┌─────────┐  │       │        │  ┌─────────┐  │
         │  │DB       │◄─┼───────┼────────┼──│ DB      │  │
         │  │(Primary)│  │  Async│        │  │(Replica)│  │
         │  └─────────┘  │  Repl │        │  └─────────┘  │
         └───────┬───────┘       │        └───────┬───────┘
                 │               │                │
                 └───────┬───────┘                │
                         │                        │
                  ┌──────▼────────────────────────▼──────┐
                  │     Failover Controller               │
                  │       (Infr Pilot)                    │
                  │                                       │
                  │  ┌─────────────┐   ┌──────────────┐  │
                  │  │ Health       │   │ DNS Manager   │  │
                  │  │ Monitor      │   │ (Route53/CF)  │  │
                  │  └──────┬──────┘   └──────┬────────┘  │
                  │         │                 │            │
                  │  ┌──────▼──────┐   ┌──────▼────────┐  │
                  │  │ Replication │   │ Traffic       │  │
                  │  │ Lag Tracker │   │ Switch Engine │  │
                  │  └─────────────┘   └───────────────┘  │
                  │  ┌─────────────────────────────────┐  │
                  │  │ Cutover Test Scheduler           │  │
                  │  └─────────────────────────────────┘  │
                  └───────────────────────────────────────┘
```

### Interaction Flow

```
Normal Operation (Active-Passive)

    User Request
        │
        ▼
    DNS (Route53) ───────────▶ Region A (Primary)
                                   │
                                   ├── Serve traffic
                                   ├── DB writes (Primary)
                                   │
                                   └── Async replication ──▶ Region B (Standby)
                                                                │
                                                                ├── Ready to serve
                                                                └── DB reads (Replica)

Failover Trigger

    Health Monitor detects Region A degraded (score < threshold)
        │
        ▼
    Failover Controller:
        1. Verify Region B is healthy
        2. Check replication lag < max allowed
        3. Drain connections from Region A
        4. Promote Region B DB to Primary
        5. Update DNS records → Region B
        6. Send notifications (Slack, Discord, Panel)
        7. Create incident record

Automatic Rollback

    Region A recovers:
        1. Re-sync data from Region B
        2. Run consistency checks
        3. Manual approval (or auto if configured)
        4. Reverse DNS → Region A
        5. Region B back to Standby
```

---

## Implementation Plan

### Phase 1: Health Monitoring (2 PT)

| Task | Description |
|---|---|
| 1.1 | Multi-probe health check system (HTTP, TCP, custom checks per region) |
| 1.2 | Composite health scoring algorithm (weighted probes, degrading thresholds) |
| 1.3 | Health check history store with trend analysis |
| 1.4 | Alert integration — trigger notification when score drops below threshold |

### Phase 2: DNS Failover Engine (2 PT)

| Task | Description |
|---|---|
| 2.1 | Route53 failover routing policy manager (weighted, failover, latency) |
| 2.2 | Cloudflare DNS failover via API (load balancing pools, monitors) |
| 2.3 | TTL management — automatic TTL reduction during failover events |
| 2.4 | Multi-provider DNS abstraction layer |

### Phase 3: Replication Monitoring (2 PT)

| Task | Description |
|---|---|
| 3.1 | PostgreSQL replication lag monitoring (WAL position tracking) |
| 3.2 | MySQL/MariaDB replication lag monitoring (seconds_behind_master) |
| 3.3 | Redis replication sync status monitoring |
| 3.4 | Custom replication check API for arbitrary data stores |
| 3.5 | Lag threshold alerting and pre-failover lag validation |

### Phase 4: Traffic Switching & Draining (1.5 PT)

| Task | Description |
|---|---|
| 4.1 | Connection draining strategy per service type (LB, app, DB) |
| 4.2 | Automatic database promotion (replica → primary) |
| 4.3 | Graceful traffic cutover with canary verification |
| 4.4 | Rollback mechanism — automated reversion on failure |

### Phase 5: Cutover Testing (1.5 PT)

| Task | Description |
|---|---|
| 5.1 | Scheduled failover drill executor |
| 5.2 | Pre-flight checklists (DNS propagation, DB lag, service health) |
| 5.3 | Automated test validation (end-to-end smoke tests after cutover) |
| 5.4 | Drill report generation (RTO/RPO metrics, pass/fail status) |

---

## API Design

### Endpoints

All endpoints are prefixed with `/api/v2/failover`.

#### Region Configuration

```
GET    /api/v2/failover/regions                    — List configured regions
POST   /api/v2/failover/regions                    — Add region
GET    /api/v2/failover/regions/{region_id}         — Get region details
PATCH  /api/v2/failover/regions/{region_id}         — Update region config
DELETE /api/v2/failover/regions/{region_id}         — Remove region
```

#### Health

```
GET    /api/v2/failover/health                     — Current health scores all regions
GET    /api/v2/failover/health/{region_id}          — Health details for one region
GET    /api/v2/failover/health/history?region=X&window=24h  — Health history
```

#### Failover

```
POST   /api/v2/failover/switch                     — Trigger failover to standby region
POST   /api/v2/failover/rollback                   — Rollback to original primary
GET    /api/v2/failover/status                     — Current failover state
GET    /api/v2/failover/history                    — Failover event history
```

#### Replication

```
GET    /api/v2/failover/replication/{region_id}    — Replication status
GET    /api/v2/failover/replication/lag            — All regions lag metrics
```

#### Cutover Tests

```
GET    /api/v2/failover/drills                     — List cutover drills
POST   /api/v2/failover/drills                     — Schedule/start drill
GET    /api/v2/failover/drills/{drill_id}          — Drill results
```

### Request/Response Examples

#### Configure Region

```json
POST /api/v2/failover/regions

{
  "name": "eu-west-1",
  "role": "primary",
  "dns_zone": "app.infra-pilot.io",
  "health_endpoints": [
    {
      "url": "https://app.infra-pilot.io/health",
      "type": "http",
      "interval_seconds": 15,
      "timeout_seconds": 5,
      "expected_status": 200
    },
    {
      "url": "https://api.infra-pilot.io/healthz",
      "type": "http",
      "interval_seconds": 10,
      "timeout_seconds": 3
    }
  ],
  "database": {
    "type": "postgresql",
    "host": "db.primary.infra-pilot.io",
    "replication_slot": "standby_region_b"
  },
  "dns_provider": {
    "type": "route53",
    "zone_id": "Z123456789",
    "record_name": "app.infra-pilot.io",
    "health_check_id": "hc-abc123"
  }
}
```

Response:

```json
{
  "region_id": "reg-euw1",
  "name": "eu-west-1",
  "role": "primary",
  "status": "active",
  "health_score": 0.98,
  "created_at": "2026-05-27T10:30:00Z"
}
```

#### Trigger Failover

```json
POST /api/v2/failover/switch

{
  "target_region": "us-east-1",
  "reason": "manual",
  "drain_timeout_seconds": 120,
  "auto_rollback_minutes": 30,
  "skip_validation": false
}
```

Response:

```json
{
  "failover_id": "fo-7f2a1b",
  "status": "in_progress",
  "stages": [
    { "name": "validation", "status": "completed", "duration_ms": 3200 },
    { "name": "draining", "status": "in_progress", "duration_ms": 15000 },
    { "name": "db_promotion", "status": "pending", "duration_ms": null },
    { "name": "dns_update", "status": "pending", "duration_ms": null },
    { "name": "verification", "status": "pending", "duration_ms": null }
  ],
  "estimated_completion": "2026-05-27T10:35:00Z"
}
```

---

## Data Model

### Region

```sql
CREATE TABLE failover_regions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(128) NOT NULL UNIQUE,
    role            VARCHAR(10) NOT NULL CHECK (role IN ('primary', 'standby')),
    status          VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'degraded', 'inactive', 'promoting')),
    dns_zone        VARCHAR(256) NOT NULL,
    dns_provider    JSONB NOT NULL,
    health_endpoints JSONB NOT NULL,
    database_config  JSONB NOT NULL DEFAULT '{}',
    health_score    DECIMAL(5,2) DEFAULT 1.00,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Health Checks

```sql
CREATE TABLE failover_health_checks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id       UUID NOT NULL REFERENCES failover_regions(id) ON DELETE CASCADE,
    endpoint_url    VARCHAR(512) NOT NULL,
    check_type      VARCHAR(20) NOT NULL CHECK (check_type IN ('http', 'tcp', 'custom')),
    status          VARCHAR(20) NOT NULL CHECK (status IN ('up', 'degraded', 'down')),
    response_time_ms INTEGER,
    http_status     INTEGER,
    error_message   TEXT,
    checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_health_checks_region_time
    ON failover_health_checks (region_id, checked_at DESC);
```

### Replication Lag

```sql
CREATE TABLE failover_replication_lag (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id       UUID NOT NULL REFERENCES failover_regions(id) ON DELETE CASCADE,
    source_region   VARCHAR(128) NOT NULL,
    lag_bytes       BIGINT,
    lag_seconds     NUMERIC(10,2),
    wal_position    VARCHAR(64),
    status          VARCHAR(20) NOT NULL CHECK (status IN ('streaming', 'catchup', 'error')),
    checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Failover Events

```sql
CREATE TABLE failover_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type            VARCHAR(20) NOT NULL
                    CHECK (type IN ('automatic', 'manual', 'drill', 'rollback')),
    status          VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress', 'completed', 'failed', 'rolled_back')),
    from_region     UUID NOT NULL REFERENCES failover_regions(id),
    to_region       UUID NOT NULL REFERENCES failover_regions(id),
    trigger_reason  TEXT,
    rto_seconds     INTEGER,
    rpo_seconds     INTEGER,
    stages          JSONB NOT NULL DEFAULT '[]',
    started_by      UUID REFERENCES users(id),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    rollback_event  UUID REFERENCES failover_events(id)
);
```

### Cutover Drills

```sql
CREATE TABLE failover_drills (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(256) NOT NULL,
    schedule        VARCHAR(64),  -- cron expression
    status          VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'running', 'passed', 'failed')),
    config          JSONB NOT NULL DEFAULT '{}',
    last_run_at     TIMESTAMPTZ,
    last_result     JSONB,
    report          TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### State Machine

```
                     ┌──────────┐
                     │  Active  │
                     │ (Primary)│
                     └────┬─────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
              ▼           ▼           ▼
        ┌──────────┐ ┌────────┐ ┌──────────┐
        │Degraded  │ │Promoti-│ │Rollback  │
        │(Primary) │ │ng      │ │(to this) │
        └────┬─────┘ │(Standby│ └────┬─────┘
             │       │→Primary│      │
             │        └───┬────┘      │
             │            ▼           │
             │      ┌──────────┐      │
             └──────│  Active  │──────┘
                    │ (Standby)│
                    └──────────┘
```

---

## Service Assignments

| Component | Service | Responsibilities |
|---|---|---|
| Health Monitor | **Integration Service** | Multi-probe health checks, scoring, alerting |
| DNS Manager | **Integration Service** | Route53/Cloudflare API, failover routing policies |
| Replication Monitor | **Integration Service** | Lag tracking, consistency checks |
| Traffic Switch Engine | **Integration Service** | Connection draining, DB promotion, DNS cutover |
| Cutover Test Scheduler | **Integration Service** | Drill scheduling, execution, report generation |
| Failover UI | **Management Panel** | Region config, health dashboards, failover controls |
| Notifications | **Integration Service** | Slack/Discord/email alerts on failover events |
| DR Integration | **Orchestrator Agent** (+ Feature 25) | DR plan definition, cross-feature coordination |

---

## Effort Estimate

| Phase | Tasks | PT |
|---|---|---|
| Phase 1: Health Monitoring | 1.1–1.4 | 2 |
| Phase 2: DNS Failover Engine | 2.1–2.4 | 2 |
| Phase 3: Replication Monitoring | 3.1–3.5 | 2 |
| Phase 4: Traffic Switching & Draining | 4.1–4.4 | 1.5 |
| Phase 5: Cutover Testing | 5.1–5.4 | 1.5 |
| **Total** | **21 tasks** | **9 PT** |

### Risk Factors

| Risk | Mitigation |
|---|---|
| DNS propagation delay undermines RTO | Use low TTL (60s) during normal ops, Route53 health checks for near-instant failover |
| Replication lag too high at failover time | Pre-failover lag check with configurable max threshold; abort if exceeded |
| Data inconsistency after split-brain | Use strict active-passive model; automated fencing of old primary |
| Cutover drill causes real disruption | Drills run in isolated test region first; production drills during maintenance windows |
| Multi-provider DNS inconsistencies | Abstract via unified DNS provider interface with provider-specific adapters |

---

## Monitoring & Observability

### Prometheus Metrics

```python
# Health
failover_region_health_score{region}         # Gauge — 0.0 to 1.0 score
failover_health_check_status{region,endpoint} # Gauge — 1 (up) / 0 (down)
failover_health_check_duration_ms             # Histogram — probe response time

# Replication
failover_replication_lag_seconds{region}     # Gauge — current lag in seconds
failover_replication_lag_bytes{region}       # Gauge — current lag in bytes
failover_replication_status{region}          # Gauge — 1 streaming / 0 error

# Failover
failover_events_total{type,status}           # Counter — failover events
failover_rto_seconds                         # Histogram — actual RTO achieved
failover_rpo_seconds                         # Histogram — actual RPO achieved

# Drills
failover_drill_total{status}                 # Counter — drill outcomes
failover_drill_duration_seconds              # Histogram — drill duration
```

### Logging

```json
{
  "event": "failover.started",
  "failover_id": "fo-7f2a1b",
  "from_region": "eu-west-1",
  "to_region": "us-east-1",
  "reason": "health_degradation_score_0.35",
  "trigger": "automatic"
}

{
  "event": "failover.completed",
  "failover_id": "fo-7f2a1b",
  "status": "completed",
  "rto_seconds": 85,
  "rpo_seconds": 12,
  "dns_propagation_ms": 42000
}

{
  "event": "replication.lag_alert",
  "region": "us-east-1",
  "lag_seconds": 120.5,
  "threshold": 30,
  "status": "critical"
}
```

---

## Related Documents

- [Architecture Overview](../architecture/overview.md)
- [Feature 13: Webhook Event Bus](13-webhook-event-bus.md)
- [Feature 25: Disaster Recovery Orchestrator](25-disaster-recovery-orchestrator.md)
- [Feature 38: Cost Allocation & Chargeback](38-cost-allocation-chargeback.md)
- [Implementation Plan v2](../feature-implementation-plan-v2.md)

---

**Last Updated:** May 2026
