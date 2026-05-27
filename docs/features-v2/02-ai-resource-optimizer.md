# AI Resource Optimizer

> **Feature ID:** 2  
> **Category:** AI & Intelligence  
> **Primary Service:** Orchestrator Agent  
> **Effort Estimate:** Medium (4-6 PT)  
> **Status:** Planned

---

## Overview

Analyze historical CPU, RAM, and disk usage trends per VPS to generate actionable right-sizing recommendations. The optimizer detects idle and underutilized resources, estimates cost savings, and supports an approval workflow for automated downsizing with a configurable grace period before changes are applied.

### Goals

- Reduce infrastructure costs by identifying and right-sizing over-provisioned servers
- Surface idle resources (zombie servers running without meaningful load)
- Provide clear, data-driven recommendations with estimated monthly savings
- Enable safe auto-apply with approval windows and rollback capability

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Metrics Sources                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐│
│  │ Node     │  │ Docker   │  │ Cloud    │  │ Custom   ││
│  │ Exporter │  │ Stats    │  │ Provider │  │ Agent    ││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘│
└───────┼──────────────┼────────────┼──────────────┼───────┘
        │              │            │              │
        ▼              ▼            ▼              ▼
┌──────────────────────────────────────────────────────────┐
│              Orchestrator Agent                           │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │          Metrics Collection & Aggregation           │  │
│  │  ┌─────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │ Scrape  │──│  Window  │──│  Aggregation      │  │  │
│  │  │ Engine  │  │  Buffer  │  │  (avg, p95, max)  │  │  │
│  │  └─────────┘  └──────────┘  └────────┬─────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                        │                                 │
│                        ▼                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │          Trend Analysis Engine                      │  │
│  │  ┌──────────────┐  ┌────────────┐  ┌────────────┐ │  │
│  │  │ Linear       │  │ Seasonal   │  │ Changepoint│ │  │
│  │  │ Regression   │  │ Decompose  │  │ Detection  │ │  │
│  │  └──────┬───────┘  └─────┬──────┘  └──────┬─────┘ │  │
│  │         │                │                │        │  │
│  │         ▼                ▼                ▼        │  │
│  │  ┌────────────────────────────────────────────┐    │  │
│  │  │   Recommendation Engine                     │    │  │
│  │  │   Suggests: downsize, upsize, idle, right   │    │  │
│  │  └──────────────────┬─────────────────────────┘    │  │
│  └─────────────────────┼──────────────────────────────┘  │
│                        │                                 │
│                        ▼                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │          Approval & Auto-Apply                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │
│  │  │ Approval │──│ Grace    │──│ Apply + Rollback  │ │  │
│  │  │ Workflow │  │ Window   │  │                  │ │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘ │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│              Management Panel                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Recommendation Dashboard                           │  │
│  │  Savings Calculator                                │  │
│  │  One-Click Approve / Dismiss / Schedule            │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Metrics Collection & Trend Analysis (2 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 1.1 | Deploy node-level metric exporters | Node Exporter + cAdvisor for Docker hosts |
| 1.2 | Implement scrape engine with configurable interval | Prometheus-style scrape config, 30s default |
| 1.3 | Rolling window aggregation (1h, 24h, 7d, 30d) | TimescaleDB continuous aggregates |
| 1.4 | Trend analysis service | Linear regression slope, seasonal decomposition |

**Scrape configuration:**

```yaml
# config/metrics_scrape.yaml
scrape:
  interval_seconds: 30
  timeout_seconds: 10
  targets:
    - type: node_exporter
      port: 9100
      metrics:
        - node_cpu_seconds_total
        - node_memory_MemTotal_bytes
        - node_memory_MemAvailable_bytes
        - node_disk_io_time_seconds_total
        - node_network_receive_bytes_total
    - type: cadvisor
      port: 8080
      metrics:
        - container_cpu_usage_seconds_total
        - container_memory_working_set_bytes
        - container_fs_usage_bytes

aggregation:
  windows:
    - duration: 1h
      retain_days: 30
    - duration: 24h
      retain_days: 90
    - duration: 7d
      retain_days: 365
```

### Phase 2: Recommendation Engine (1.5 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 2.1 | Resource profiling algorithm | Profile per server: `{p50, p95, max, trend}` |
| 2.2 | Right-sizing recommendation logic | Target plan calculation based on headroom policy |
| 2.3 | Idle resource detection heuristic | No significant traffic for 14d + low CPU/RAM |
| 2.4 | Cost savings estimator | Price book lookup from current vs. recommended plan |
| 2.5 | Recommendation persistence | `recommendations` table in PostgreSQL |

**Recommendation logic (pseudocode):**

```python
def generate_recommendation(server_id, metrics, plans):
    cpu_p95 = metrics.cpu.p95_over_7d
    ram_p95 = metrics.ram.p95_over_7d
    disk_p95 = metrics.disk.p95_over_7d

    # Classify current utilization
    if cpu_p95 < 10 and ram_p95 < 10 and metrics.traffic_avg_14d < MIN_TRAFFIC:
        return Recommendation(
            type="idle",
            action="stop_or_downsize",
            savings=plans.current.cost - plans.minimum.cost,
            confidence=0.95,
        )

    # Find cheapest plan that fits with headroom
    headroom_cpu = 1.5  # 50% headroom
    headroom_ram = 1.3
    required_cpu = cpu_p95 * headroom_cpu
    required_ram = ram_p95 * headroom_ram

    best_plan = min(
        (p for p in plans if p.cpu >= required_cpu and p.ram >= required_ram),
        key=lambda p: p.cost,
    )

    if best_plan.cpu < plans.current.cpu or best_plan.ram < plans.current.ram:
        # Trending up? Don't downsize.
        if metrics.cpu.trend_slope > 0.05:
            return Recommendation(type="monitor", action="no_change")

        return Recommendation(
            type="downsize",
            current_plan=plans.current,
            recommended_plan=best_plan,
            savings=plans.current.cost - best_plan.cost,
            confidence=calculate_confidence(metrics),
        )

    return Recommendation(type="optimal", action="no_change")
```

### Phase 3: Approval Workflow & Auto-Apply (1.5 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 3.1 | Approval workflow state machine | `pending → approved → applying → applied / rolled_back` |
| 3.2 | Grace period timer (configurable: 24h-72h) | Scheduled job, cancellation support |
| 3.3 | Plan change executor | Cloud provider API call with pre/post health check |
| 3.4 | Rollback procedure | Snapshot before change, revert on failure |
| 3.5 | Notification on each state transition | Discord, Slack, email, Panel toast |

**Approflow state machine:**

```
┌─────────┐     approve     ┌──────────┐   timer expires   ┌──────────┐
│ Pending │──────────────▶  │ Approved │─────────────────▶  │ Applying │
│         │                  │ [grace]  │                   │          │
└────┬────┘                  └──────────┘                   └────┬─────┘
     │                           │                              │
     │ dismiss                   │ cancel                       │ success / fail
     ▼                           ▼                              ▼
┌─────────┐               ┌──────────┐                  ┌──────────────┐
│Dismissed│               │ Cancelled│                  │ Applied /    │
└─────────┘               └──────────┘                  │ Rolled Back  │
                                                         └──────────────┘
```

---

## API Design

### REST API

#### List Recommendations

```
GET /api/v1/recommendations
  ?type=downsize,idle
  &server_id=srv-001
  &status=pending,approved,applied,dismissed
  &min_savings=10
  &limit=50
```

Response:
```json
{
  "recommendations": [
    {
      "id": "rec-20260527-001",
      "server_id": "srv-001",
      "server_name": "web-01",
      "type": "downsize",
      "status": "pending",
      "current_plan": {
        "name": "dedicated-8",
        "cpu": 8,
        "ram_gb": 32,
        "disk_gb": 200,
        "monthly_cost": 80.00
      },
      "recommended_plan": {
        "name": "dedicated-4",
        "cpu": 4,
        "ram_gb": 16,
        "disk_gb": 100,
        "monthly_cost": 45.00
      },
      "savings_per_month": 35.00,
      "savings_percent": 43.75,
      "confidence": 0.88,
      "metrics_snapshot": {
        "cpu_p95_7d": 35.2,
        "ram_p95_7d": 8.1,
        "disk_p95_7d": 45.3,
        "cpu_trend": "stable",
        "ram_trend": "stable"
      },
      "created_at": "2026-05-27T00:00:00Z",
      "grace_period_ends": "2026-05-28T12:00:00Z"
    }
  ],
  "total": 12,
  "savings_total_per_month": 210.00
}
```

#### Approve Recommendation

```
POST /api/v1/recommendations/{id}/approve
```

Request:
```json
{
  "approved_by": "admin@example.com",
  "schedule_immediately": false,
  "grace_period_hours": 48
}
```

#### Dismiss Recommendation

```
POST /api/v1/recommendations/{id}/dismiss
```

Request:
```json
{
  "reason": "expected_traffic_increase",
  "dismissed_by": "admin@example.com"
}
```

#### Get Savings Summary

```
GET /api/v1/recommendations/savings-summary
```

Response:
```json
{
  "total_current_monthly": 4520.00,
  "total_optimized_monthly": 3850.00,
  "potential_savings": 670.00,
  "realized_savings": 320.00,
  "servers_analyzed": 48,
  "servers_with_recommendations": 12,
  "idle_servers": 3,
  "by_category": {
    "downsize": {
      "count": 7,
      "potential_savings": 450.00,
      "realized_savings": 200.00
    },
    "idle": {
      "count": 3,
      "potential_savings": 180.00,
      "realized_savings": 100.00
    },
    "upsize": {
      "count": 2,
      "potential_cost_increase": 40.00,
      "realized": 20.00
    }
  }
}
```

---

## Data Model

```python
# models/resource_optimizer.py
@dataclass
class ResourceMetrics:
    server_id: str
    timestamp: datetime
    cpu_percent: float
    ram_percent: float
    ram_used_bytes: int
    disk_percent: float
    disk_used_bytes: int
    network_rx_bytes: int
    network_tx_bytes: int
    load_avg_1m: float
    load_avg_5m: float

@dataclass
class AggregatedProfile:
    server_id: str
    window: str  # 1h, 24h, 7d, 30d
    cpu: ProfileStats
    ram: ProfileStats
    disk: ProfileStats
    network_traffic_avg: float

@dataclass
class ProfileStats:
    p50: float
    p95: float
    p99: float
    max: float
    avg: float
    trend_slope: float  # positive = increasing, negative = decreasing
    trend_stability: float  # lower = more stable

@dataclass
class Recommendation:
    id: str
    server_id: str
    server_name: str
    type: str  # downsize / upsize / idle / optimal
    status: str  # pending / approved / applying / applied / dismissed / cancelled / rolled_back
    current_plan: Plan
    recommended_plan: Plan | None
    savings_per_month: float
    confidence: float
    metrics_snapshot: dict
    created_at: datetime
    approved_by: str | None
    approved_at: datetime | None
    grace_period_ends: datetime | None
    applied_at: datetime | None
    dismissed_reason: str | None
    rollback_initiated: bool
```

**Database Schema:**

```sql
-- Aggregated resource profiles
CREATE TABLE resource_profiles (
    server_id   TEXT NOT NULL,
    window      TEXT NOT NULL,          -- '1h', '24h', '7d', '30d'
    window_start TIMESTAMPTZ NOT NULL,
    cpu_p50     DOUBLE PRECISION,
    cpu_p95     DOUBLE PRECISION,
    cpu_max     DOUBLE PRECISION,
    cpu_trend_slope DOUBLE PRECISION,
    ram_p50     DOUBLE PRECISION,
    ram_p95     DOUBLE PRECISION,
    ram_max     DOUBLE PRECISION,
    ram_trend_slope DOUBLE PRECISION,
    disk_p50    DOUBLE PRECISION,
    disk_p95    DOUBLE PRECISION,
    disk_max    DOUBLE PRECISION,
    PRIMARY KEY (server_id, window, window_start)
);

-- Recommendations
CREATE TABLE recommendations (
    id                  TEXT PRIMARY KEY,
    server_id           TEXT NOT NULL,
    server_name         TEXT NOT NULL,
    type                TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending',
    current_plan        JSONB NOT NULL,
    recommended_plan    JSONB,
    savings_per_month   DOUBLE PRECISION DEFAULT 0,
    confidence          DOUBLE PRECISION,
    metrics_snapshot    JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    approved_by         TEXT,
    approved_at         TIMESTAMPTZ,
    grace_period_ends   TIMESTAMPTZ,
    applied_at          TIMESTAMPTZ,
    dismissed_reason    TEXT,
    rollback_initiated  BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_rec_server ON recommendations(server_id);
CREATE INDEX idx_rec_status ON recommendations(status);
CREATE INDEX idx_rec_type ON recommendations(type);
```

---

## Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Orchestrator Agent** | Metrics scrape engine, aggregation, trend analysis, recommendation engine, approval workflow, plan change executor |
| **Integration Service** | Cloud provider price book API, notification dispatch (Discord/Slack) |
| **Management Panel** | Recommendation dashboard, savings calculator, approve/dismiss UI, history view |

---

## Configuration Reference

```yaml
# config/resource_optimizer.yaml
analysis:
  schedule: "0 */6 * * *"    # every 6 hours
  windows:
    short: 1h
    medium: 24h
    long: 7d
    trend: 30d
  idle_detection:
    cpu_threshold_percent: 5
    ram_threshold_percent: 5
    traffic_threshold_bytes: 1048576  # 1 MB/day
    idle_days: 14

recommendations:
  headroom:
    cpu_factor: 1.5
    ram_factor: 1.3
    disk_factor: 1.2
  min_confidence: 0.6
  min_savings_usd: 5.00

auto_apply:
  enabled: false                   # opt-in per environment
  default_grace_hours: 48
  max_grace_hours: 168            # 7 days
  require_approval: true
  rollback_on_failure: true
  pre_check_health: true
  health_check_timeout_seconds: 120

notifications:
  on_recommendation: true
  on_approval_needed: true
  on_applied: true
  on_rollback: true
  channels: ["panel", "discord"]
```

---

## Effort Breakdown

| Phase | Task | PT | Dependencies |
|-------|------|----|-------------|
| 1.1 | Metric exporter deployment | 0.5 | Node access |
| 1.2 | Scrape engine | 0.5 | Metrics pipeline |
| 1.3 | Window aggregation | 0.5 | Time-series storage |
| 1.4 | Trend analysis | 0.5 | Aggregation data |
| 2.1 | Resource profiling | 0.5 | Trend analysis |
| 2.2 | Right-sizing logic | 0.5 | Plan catalog |
| 2.3 | Idle detection | 0.25 | Profiling output |
| 2.4 | Savings estimator | 0.25 | Price book |
| 2.5 | Persistence layer | 0.25 | DB schema |
| 3.1 | Approval state machine | 0.5 | Workflow engine |
| 3.2 | Grace period timer | 0.25 | Scheduled jobs |
| 3.3 | Plan change executor | 0.5 | Cloud API |
| 3.4 | Rollback procedure | 0.25 | Snapshot infra |
| 3.5 | Notifications | 0.25 | Notifier service |
| | **Total** | **5.75** | |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Downsize during traffic spike | Performance degradation | Trend analysis prevents downsizing on upward trends; health check pre/post apply |
| Idle server is actually standby | Service disruption | Allow exclusion tags (`infrapilot/optimizer=exclude`), require approval for idle actions |
| Price book out of date | Incorrect savings estimates | Sync price book daily from cloud provider APIs |
| Insufficient metrics history | Cold start, no recommendations | Collect 7 days of metrics before generating first recommendation |

---

## Metrics & KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cost savings realized | > 15% of total compute spend | Monthly savings / total monthly cost |
| Recommendation accuracy | > 90% no regression after apply | Compare post-apply performance to pre-apply |
| Time to apply (auto) | < 5 minutes | From grace expiry to plan change complete |
| User adoption | > 60% of servers with recommendations reviewed | Reviewed count / total recommendations |
