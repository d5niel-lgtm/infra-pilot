# Feature 39: Alert Fatigue Reduction

- **Feature ID:** 39
- **Category:** Advanced Observability
- **Primary Service:** Integration Service
- **Effort:** Large (7-10 PT)
- **Dependencies:** Feature 13 (Webhook Event Bus), Feature 30 (Incident Management), Feature 36 (SLO Tracking)

---

## 1. Overview

Implement an intelligent alert management system that dramatically reduces alert fatigue for operators. The system provides real-time deduplication (collapsing identical alerts into single notifications), correlation (grouping related alerts from different sources into a single incident), maintenance window suppression (silencing alerts for planned operations), auto-escalation (escalating unacknowledged alerts through configurable policies), notification throttling (rate-limiting per channel/severity), and digest mode (periodic summary instead of per-alert notifications).

### Goals

- Reduce total alert volume by 60-80% through deduplication and correlation
- Eliminate notification storms from cascading failures via correlation groups
- Support scheduled and ad-hoc maintenance windows with automatic alert suppression
- Route alerts through escalation policies with time-based and acknowledgement-based triggers
- Throttle notifications per severity/channel to prevent channel flooding
- Provide periodic digest summaries for non-urgent alert categories

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Alert Sources                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │Infra     │  │Synthetic │  │SLO/Budget│  │Prometheus│    ... (N)   │
│  │Metrics   │  │Monitor   │  │Alerts    │  │Alert     │              │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘              │
└────────┼──────────────┼──────────────┼──────────────┼────────────────┘
         │              │              │              │
┌────────▼──────────────▼──────────────▼──────────────▼────────────────┐
│                          Integration Service                           │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                         Alert Pipeline                            │  │
│  │                                                                  │  │
│  │  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐  │  │
│  │  │ Ingest      │──▶│ Deduplication │──▶│ Correlation Engine   │  │  │
│  │  │ (validate,  │   │ (hash, time,  │   │ (topology, time,    │  │  │
│  │  │ normalize)  │   │  fingerprint) │   │  metric similarity)  │  │  │
│  │  └─────────────┘   └──────────────┘   └───────────┬──────────┘  │  │
│  │                                                    │              │  │
│  │  ┌─────────────────────────────────────────────────▼──────────┐  │  │
│  │  │                  Routing & Policy Engine                    │  │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐   │  │  │
│  │  │  │ Maintenance   │ │ Escalation   │ │ Notification    │   │  │  │
│  │  │  │ Window Check  │ │ Policy Eval  │ │ Throttle        │   │  │  │
│  │  │  └──────────────┘ └──────────────┘ └──────────────────┘   │  │  │
│  │  └────────────────────────────────┬───────────────────────────┘  │  │
│  │                                   │                               │  │
│  │  ┌────────────────────────────────▼───────────────────────────┐  │  │
│  │  │                    Output Formatter                         │  │  │
│  │  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐   │  │  │
│  │  │  │ Real-Time    │ │ Digest Mode  │ │ Webhook/Api     │   │  │  │
│  │  │  │ Notification │ │ (periodic    │ │ Payload Builder  │   │  │  │
│  │  │  │ Builder      │ │  summary)    │ │                  │   │  │  │
│  │  │  └──────────────┘ └──────────────┘ └──────────────────┘   │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                         Notification Channels                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐   │
│  │ Discord    │  │ Email      │  │ Webhook    │  │ SMS/PagerDuty  │   │
│  │ (embed)    │  │ (HTML)     │  │ (JSON POST)│  │ (API)          │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Alert Lifecycle State Machine

```
                    ┌──────────┐
                    │  New     │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
              ┌─────│  Open    │──────┐
              │     └────┬─────┘      │
              │          │            │
         ┌────▼───┐  ┌──▼─────┐  ┌───▼────┐
         │Suppress│  │Acknowled│  │Escalate│
         │(maint.)│  │-ged    │  │-ed     │
         └───┬────┘  └──┬─────┘  └───┬────┘
             │          │            │
         ┌───▼──────────▼────────────▼────┐
         │           Resolved              │
         └─────────────────────────────────┘
```

### Correlation Strategies

| Strategy | Method | Example |
|----------|--------|---------|
| **Topology-based** | Resources related via dependency graph | Server down → dependent services alert grouped |
| **Time-window** | Alerts within N minutes of same resource | CPU + memory + disk alerts at same time |
| **Metric similarity** | Anomalies in related metrics | Response time spike + error rate increase |
| **Cause-effect** | Root cause inferred from temporal order | Host down (cause) → service unreachable (effect) |
| **Label match** | Same label dimensions | All alerts with `team: platform, env: prod` |

---

## 3. Data Model

### Alert Event (Ingested)

```yaml
alert_event:
  id: "aev-f8a2c9d1"
  source: "prometheus"
  source_id: "ALERT-1745712345"
  fingerprint: "a1b2c3d4e5f6"         # Deterministic hash for dedup
  received_at: 1745712345
  normalized:
    title: "High CPU Usage on web-prod-01"
    description: "CPU usage at 94% for >5 minutes"
    severity: "warning"                # info | warning | critical
    resource_id: "srv-web-prod-01"
    resource_type: "server"
    metric_name: "cpu_usage_percent"
    metric_value: 94.2
    labels:
      team: "platform"
      environment: "production"
      service: "web"
    source_url: "https://prometheus.example.com/alert/cpu-high"
  raw_payload: {}                      # Original source payload
```

### Deduplication Record

```yaml
dedup_record:
  id: "ddr-abc123"
  fingerprint: "a1b2c3d4e5f6"
  first_seen_at: 1745712345
  last_seen_at: 1745712645
  occurrence_count: 12
  first_alert_id: "aev-f8a2c9d1"
  last_alert_id: "aev-9k2m4n7p"
  status: "grouping"                  # grouping | grouped | resolved
  notification_sent: true
  last_notification_at: 1745712345
  throttle_until: 1745712545          # Next allowed notification time
```

### Correlation Group (Incident)

```yaml
correlation_group:
  id: "cg-infra-20260512-001"
  title: "Production Web Cluster Degradation"
  description: "Multiple alerts indicate web cluster health issue"
  created_at: 1745712360
  updated_at: 1745712660
  status: "open"                      # open | acknowledged | escalating | resolved
  severity: "critical"
  alert_ids:
    - "aev-f8a2c9d1"                  # High CPU
    - "aev-f8a2c9d2"                  # High Memory
    - "aev-f8a2c9d3"                  # 5xx Error Rate Spike
  primary_alert: "aev-f8a2c9d1"
  root_cause_alert: "aev-f8a2c9d1"    # Updated after analysis
  correlation_strategy: "topology"
  resources_affected:
    - "srv-web-prod-01"
    - "srv-web-prod-02"
  services_affected:
    - "web-api"
    - "web-frontend"
  timeline:
    - timestamp: 1745712345
      event: "alert_received"
      detail: "High CPU on web-prod-01"
    - timestamp: 1745712360
      event: "group_created"
      detail: "Correlated 3 related alerts"
    - timestamp: 1745712400
      event: "notification_sent"
      detail: "Discord notification sent"
    - timestamp: 1745712600
      event: "acknowledged"
      detail: "Acknowledged by user@example.com"
```

### Maintenance Window

```yaml
maintenance_window:
  id: "mw-deploy-20260512"
  title: "Production Web Deploy Window"
  description: "Scheduled deployment of web v2.4.1"
  created_by: "user@example.com"
  starts_at: 1745712000
  ends_at: 1745719200                  # 2 hour window
  timezone: "UTC"
  scope:
    type: "label_selector"
    selectors:
      - "team=platform"
      - "environment=production"
      - "service=web"
    resources:
      - "srv-web-prod-01"
      - "srv-web-prod-02"
  suppression_rules:
    severities: ["info", "warning"]   # critical still fires
    alert_types: ["cpu", "memory", "response_time"]
    alert_sources: ["prometheus"]
  status: "active"                    # scheduled | active | completed | cancelled
  notification:
    notify_on_start: true
    notify_on_end: true
    channels: ["discord"]
```

### Escalation Policy

```yaml
escalation_policy:
  id: "ep-platform-critical"
  name: "Platform Critical Escalation"
  description: "Escalation for critical platform alerts"
  applies_to:
    severities: ["critical"]
    labels:
      team: "platform"
  steps:
    - level: 1
      name: "Primary On-Call"
      notify:
        - type: "schedule"
          schedule_id: "schedule-platform-primary"
      timeout_minutes: 15
      repeat_count: 2
      channels: ["discord", "pagerduty"]
    - level: 2
      name: "Secondary On-Call"
      notify:
        - type: "schedule"
          schedule_id: "schedule-platform-secondary"
      timeout_minutes: 10
      channels: ["discord", "sms"]
    - level: 3
      name: "Engineering Manager"
      notify:
        - type: "user"
          user_id: "user-mgr-001"
      timeout_minutes: 5
      channels: ["sms", "phone"]
    - level: 4
      name: "VP Engineering"
      notify:
        - type: "user"
          user_id: "user-vp-001"
      channels: ["phone"]
  acknowledgement_resets: true        # Ack at level 1 stops escalation
```

### Digest Configuration

```yaml
digest_config:
  id: "digest-daily-platform"
  name: "Daily Platform Digest"
  schedule: "0 9 * * *"               # Daily at 09:00 UTC
  timezone: "UTC"
  scope:
    severity: ["info", "warning"]
    labels:
      team: "platform"
  format: "discord_embed"
  max_alerts: 25
  include_previous_resolved: false
  channels: ["discord-digest"]
```

---

## 4. API Design

### Alerts

#### Ingest Alert

```
POST /api/v2/alerts/ingest
```

```json
{
  "source": "prometheus",
  "source_id": "ALERT-1745712345",
  "title": "High CPU Usage on web-prod-01",
  "description": "CPU usage at 94% for >5 minutes",
  "severity": "warning",
  "resource_id": "srv-web-prod-01",
  "resource_type": "server",
  "metric_name": "cpu_usage_percent",
  "metric_value": 94.2,
  "labels": {
    "team": "platform",
    "environment": "production",
    "service": "web"
  },
  "raw_payload": {}
}
```

Response `200`:
```json
{
  "alert_id": "aev-f8a2c9d1",
  "fingerprint": "a1b2c3d4e5f6",
  "dedup_status": "grouping",
  "occurrence_count": 12,
  "correlation_group_id": "cg-infra-20260512-001",
  "will_notify": false,
  "reason": "Throttled: last notification 40s ago"
}
```

#### Get Alert Details

```
GET /api/v2/alerts/{alert_id}
```

#### List Alerts

```
GET /api/v2/alerts
  ?status=open
  &severity=critical
  &resource_id=srv-web-prod-01
  &from=2026-05-01T00:00:00Z
  &to=2026-05-31T23:59:59Z
  &page=1
  &per_page=50
```

#### Acknowledge Alert

```
POST /api/v2/alerts/{alert_id}/acknowledge
```

```json
{
  "user_id": "user@example.com",
  "note": "Investigating CPU spike"
}
```

#### Resolve Alert

```
POST /api/v2/alerts/{alert_id}/resolve
```

```json
{
  "user_id": "user@example.com",
  "resolution": "Auto-scaling added new instance, CPU normalized",
  "root_cause": "Traffic spike from marketing campaign"
}
```

### Correlation Groups

#### List Groups

```
GET /api/v2/alerts/groups
  ?status=open
  &severity=critical
  &page=1
  &per_page=20
```

#### Get Group Details

```
GET /api/v2/alerts/groups/{group_id}
```

### Maintenance Windows

#### List Windows

```
GET /api/v2/maintenance-windows
  ?status=active
  &upcoming=true
```

#### Create Window

```
POST /api/v2/maintenance-windows
```

```json
{
  "title": "Production Web Deploy Window",
  "description": "Scheduled deployment of web v2.4.1",
  "starts_at": "2026-05-12T22:00:00Z",
  "ends_at": "2026-05-13T00:00:00Z",
  "scope": {
    "type": "label_selector",
    "selectors": [
      "team=platform",
      "environment=production"
    ]
  },
  "suppression_rules": {
    "severities": ["info", "warning"],
    "alert_types": ["cpu", "memory"]
  },
  "notification": {
    "notify_on_start": true,
    "notify_on_end": true,
    "channels": ["discord"]
  }
}
```

### Escalation Policies

#### List Policies

```
GET /api/v2/escalation-policies
```

#### Create Policy

```
POST /api/v2/escalation-policies
```

```json
{
  "name": "Platform Critical Escalation",
  "applies_to": {
    "severities": ["critical"],
    "labels": {
      "team": "platform"
    }
  },
  "steps": [
    {
      "level": 1,
      "name": "Primary On-Call",
      "notify": [
        { "type": "schedule", "schedule_id": "schedule-platform-primary" }
      ],
      "timeout_minutes": 15,
      "channels": ["discord", "pagerduty"]
    },
    {
      "level": 2,
      "name": "Secondary On-Call",
      "notify": [
        { "type": "schedule", "schedule_id": "schedule-platform-secondary" }
      ],
      "timeout_minutes": 10,
      "channels": ["discord", "sms"]
    }
  ],
  "acknowledgement_resets": true
}
```

### Digests

#### List Digests

```
GET /api/v2/alerts/digests
```

#### Create Digest Config

```
POST /api/v2/alerts/digests
```

```json
{
  "name": "Daily Platform Digest",
  "schedule": "0 9 * * *",
  "timezone": "UTC",
  "scope": {
    "severity": ["info", "warning"],
    "labels": { "team": "platform" }
  },
  "format": "discord_embed",
  "max_alerts": 25,
  "channels": ["discord-digest"]
}
```

### Statistics

#### Get Alert Reduction Stats

```
GET /api/v2/alerts/stats
  ?window=7d
```

```json
{
  "window_days": 7,
  "raw_alerts_ingested": 14823,
  "after_dedup": 2452,
  "after_correlation": 412,
  "suppressed_by_maintenance": 893,
  "notifications_sent": 412,
  "dedup_ratio": 83.5,
  "correlation_ratio": 97.2,
  "overall_reduction_percent": 97.2,
  "by_severity": {
    "critical": { "ingested": 234, "sent": 42, "reduction": 82.1 },
    "warning": { "ingested": 2890, "sent": 145, "reduction": 95.0 },
    "info": { "ingested": 11699, "sent": 225, "reduction": 98.1 }
  }
}
```

---

## 5. Implementation Plan

### Phase 1: Deduplication & Ingestion Pipeline (PT 1-3)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 1.1 | Alert normalization layer: validate, normalize, fingerprint | `services/alert_normalizer.py` |
| 1.2 | Deduplication engine: hash-based, time-window, state tracking | `services/dedup_engine.py` |
| 1.3 | Alert ingest API endpoint with dedup response | `routes/alerts.py` |
| 1.4 | Persistent storage for dedup state, alert events | `models/alert.py`, `models/dedup.py` |

### Phase 2: Correlation & Escalation Engine (PT 4-6)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 2.1 | Correlation engine: topology, time-window, label matching | `services/correlation_engine.py` |
| 2.2 | Correlation group lifecycle management | `services/group_manager.py` |
| 2.3 | Escalation policy engine with timer-based step progression | `services/escalation_engine.py` |
| 2.4 | Escalation policy CRUD + schedule/on-call integration | `routes/escalation.py`, `models/escalation.py` |

### Phase 3: Suppression, Throttling, Digest & Panel (PT 7-10)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 3.1 | Maintenance window CRUD + automatic alert suppression | `services/maintenance_window.py`, `routes/maintenance.py` |
| 3.2 | Notification throttle: per-channel, per-severity rate limit | `services/throttle_engine.py` |
| 3.3 | Digest mode: cron-based summary generation, formatting | `services/digest_engine.py` |
| 3.4 | Panel UI: alert list, correlation group view, timeline | Panel components |
| 3.5 | Panel UI: maintenance window scheduler, escalation policy editor | Panel components |
| 3.6 | Panel UI: digest config, reduction statistics dashboard | Panel components |

---

## 6. Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Integration Service** (primary) | Alert ingestion, deduplication, correlation engine, escalation engine, maintenance windows, notification throttling, digest mode, REST API |
| **Management Panel** | Alert dashboard, correlation group timeline, maintenance window scheduler, escalation policy editor, digest config, reduction stats |
| **Discord Service** | Alert notification delivery (embed format), digest delivery, escalation channel messages |
| **Orchestrator Agent** | Provide topology/relationship data for correlation engine, trigger maintenance windows from deployment workflows |
| **Incident Management** (F30) | Receive resolved correlation groups as incidents, integrate escalation policies |

---

## 7. Effort Estimate: Large (7-10 PT)

| Area | PT Estimate |
|------|-------------|
| Alert ingestion + normalization pipeline | 1.0 |
| Deduplication engine (fingerprinting, state) | 1.5 |
| Correlation engine (topology, time, label) | 2.0 |
| Escalation policy engine (timer, steps, schedules) | 1.5 |
| Maintenance window suppression | 1.0 |
| Notification throttling | 0.5 |
| Digest mode (scheduling, formatting) | 1.0 |
| REST API endpoints | 1.0 |
| Panel UI (alert list, groups, maintenance, escalation, stats) | 2.0 |
| Integration + E2E tests | 1.0 |
| Documentation | 0.5 |
| **Total** | **13.0 PT (rounded to 10 with framework reuse)** |

### Risk Factors

- Correlation accuracy depends on resource topology graph completeness; initial correlations may be noisy
- Escalation policy timing requires robust scheduler (consider Celery/APScheduler)
- Digest mode formatting varies significantly by channel (Discord embed vs HTML email)
- Alert dedup fingerprint collisions require careful hash design
- Throttling logic must balance between reducing noise and not silencing real issues

---

## 8. Key Metrics

| Metric | Target |
|--------|--------|
| Alert volume reduction | > 95% (raw alerts → notifications sent) |
| Deduplication latency | < 500ms per alert |
| Correlation latency | < 5s from alert ingest to group assignment |
| Escalation step accuracy | 100% (no missed steps) |
| Maintenance window suppression | 100% of scope-matched alerts during window |
| Digest delivery | Within 5 minutes of scheduled time |
| API throughput | 200 req/s for alert ingestion |
