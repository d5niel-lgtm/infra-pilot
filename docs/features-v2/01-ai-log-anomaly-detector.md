# AI Log Anomaly Detector

> **Feature ID:** 1  
> **Category:** AI & Intelligence  
> **Primary Service:** Integration Service  
> **Effort Estimate:** Large (7-10 PT)  
> **Status:** Planned

---

## Overview

Train an unsupervised ML model on historical server logs to detect anomalous patterns in real time. The detector identifies crash loops, intrusion attempts, silent failures, and other irregular log sequences that would otherwise go unnoticed until a customer reports an issue.

Alerts are pushed to the Management Panel via WebSocket and optionally forwarded to Discord, Slack, or email.

### Goals

- Reduce mean time to detection (MTTD) for silent failures from hours to seconds
- Automatically surface crash loops and repeated error patterns before they cascade
- Distinguish genuine anomalies from expected noise (deployments, scheduled restarts)
- Provide a feedback loop for operators to mark false positives, improving model accuracy over time

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Log Sources                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │  Docker  │  │ Systemd  │  │  Nginx   │  │ App    │ │
│  │  daemon  │  │  journal │  │  access  │  │ logs   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘ │
└───────┼──────────────┼────────────┼─────────────┼───────┘
        │              │            │             │
        ▼              ▼            ▼             ▼
┌─────────────────────────────────────────────────────────┐
│              Integration Service                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Log Collection Pipeline                 │   │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────────────┐ │   │
│  │  │  Agent  │──│ Buffer & │──│ Feature          │ │   │
│  │  │  Sidecar│  │ Batch    │  │ Extraction       │ │   │
│  │  └─────────┘  └──────────┘  └────────┬─────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
│                        │                                 │
│                        ▼                                 │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Anomaly Detection Engine                │   │
│  │  ┌──────────────────┐  ┌──────────────────────┐ │   │
│  │  │ Isolation Forest │  │ LSTM Sequence        │ │   │
│  │  │ (pattern scoring)│  │ (temporal analysis)  │ │   │
│  │  └────────┬─────────┘  └──────────┬───────────┘ │   │
│  │           │                       │              │   │
│  │           ▼                       ▼              │   │
│  │  ┌──────────────────────────────────────────┐    │   │
│  │  │         Ensemble Scorer                   │    │   │
│  │  │  Combines model outputs → anomaly_score   │    │   │
│  │  └──────────────────┬───────────────────────┘    │   │
│  └─────────────────────┼────────────────────────────┘   │
│                        │                                 │
│                        ▼                                 │
│  ┌──────────────────────────────────────────────────┐   │
│  │           Alert Manager                           │   │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────────┐ │   │
│  │  │ Dedup &  │──│ Severity │──│ Notify (WS,    │ │   │
│  │  │ Throttle │  │ Routing  │  │ Discord, Slack)│ │   │
│  │  └──────────┘  └──────────┘  └────────────────┘ │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Management Panel                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Realtime Alert Feed (WebSocket)                  │   │
│  │  Anomaly Detail View                             │   │
│  │  Feedback Buttons: ✓ True Anomaly / ✗ False Pos  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Log Collection Pipeline (2-3 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 1.1 | Deploy log-agent sidecar to all managed nodes | Log shipper (Fluentd vector), config per node type |
| 1.2 | Central log buffer with Kafka or Redis Streams | Buffered log topics, retention policy (7d raw, 90d aggregated) |
| 1.3 | Log parsing & normalization | Structured schema: `{timestamp, source, level, message, service, host, container_id}` |
| 1.4 | Feature extraction service | Extracted features written to time-series store |

**Feature extraction logic:**

```python
# pseudocode: log_feature_extractor.py
def extract_features(log_batch: list[dict]) -> dict:
    features = {
        "error_rate": count_errors(log_batch) / len(log_batch),
        "unique_error_types": count_unique(match_pattern(log_batch, ERROR_PATTERNS)),
        "log_volume_delta": len(log_batch) - rolling_avg("log_volume", window=300),
        "temporal_entropy": shannon_entropy([l["level"] for l in log_batch]),
        "keyword_scores": {
            kw: score_keyword_occurrence(log_batch, kw)
            for kw in ["timeout", "exception", "failed", "denied", "crash"]
        },
        "burst_score": detect_burst_pattern(log_batch, interval_ms=1000),
    }
    return features
```

### Phase 2: Model Training Pipeline (3-4 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 2.1 | Historical log export & labeling | Labeled dataset (anomaly / normal) from past incidents |
| 2.2 | Train Isolation Forest model | `model/isolation_forest.pkl` |
| 2.3 | Train LSTM sequence model | `model/lstm_anomaly.h5` with sequence length=100 |
| 2.4 | Ensemble calibrator | Weight optimizer for combining model outputs |
| 2.5 | Model versioning & A/B deployment | MLflow registry, canary deployment strategy |

**Model config:**

```yaml
# config/anomaly_detector.yaml
model:
  ensemble:
    isolation_forest:
      enabled: true
      n_estimators: 200
      contamination: 0.01
      max_samples: 256
    lstm:
      enabled: true
      sequence_length: 100
      epochs: 50
      batch_size: 32
      lstm_units: [64, 32]
  scoring:
    threshold_mode: "dynamic" # dynamic | static
    static_threshold: 0.85
    dynamic_percentile: 95
    dynamic_window: 3600 # seconds

pipeline:
  batch_size: 5000
  flush_interval_ms: 5000
  feature_window_s: 300

feedback:
  store_false_positives: true
  retrain_interval_hours: 168 # weekly
  min_feedback_samples: 100
```

### Phase 3: Alerting & Feedback Loop (2-3 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 3.1 | Alert deduplication engine | Hash-based dedup, suppression per source + pattern |
| 3.2 | Severity classification | Critical / Warning / Info based on anomaly score + source |
| 3.3 | WebSocket push to Panel | Real-time alert feed |
| 3.4 | Notification integrations | Discord embed, Slack message, email |
| 3.5 | Feedback ingestion API | `POST /api/v1/anomalies/{id}/feedback` |
| 3.6 | Scheduled retraining pipeline | Cron trigger, dataset refresh, model promotion |

---

## API Design

### Anomaly Events (WebSocket)

**Topic:** `ws://<host>/ws/v1/events`  
**Event type:** `anomaly.detected`

```json
{
  "event": "anomaly.detected",
  "data": {
    "id": "anom-20260527-abc123",
    "timestamp": "2026-05-27T14:23:11Z",
    "severity": "warning",
    "score": 0.91,
    "source": "docker:web-01",
    "service": "nginx",
    "pattern": "connection_timeout_burst",
    "summary": "5x timeout spike in 60s window on web-01",
    "affected_logs": [
      {"line": 1452, "message": "2026-05-27T14:22:50Z [error] upstream timed out (110)"},
      {"line": 1453, "message": "2026-05-27T14:22:51Z [error] upstream timed out (110)"}
    ],
    "features_snapshot": {
      "error_rate": 0.18,
      "log_volume_delta": 340,
      "keyword_timeout": 0.92
    }
  }
}
```

### REST API

#### List Anomalies

```
GET /api/v1/anomalies
  ?severity=critical,warning
  &source=web-01
  &from=2026-05-01T00:00:00Z
  &to=2026-05-27T23:59:59Z
  &status=open,acknowledged,resolved
  &limit=50
  &offset=0
```

Response:
```json
{
  "anomalies": [
    {
      "id": "anom-20260527-abc123",
      "severity": "warning",
      "score": 0.91,
      "source": "docker:web-01",
      "pattern": "connection_timeout_burst",
      "summary": "5x timeout spike in 60s window on web-01",
      "status": "open",
      "detected_at": "2026-05-27T14:23:11Z",
      "acknowledged_by": null,
      "resolved_at": null
    }
  ],
  "total": 47,
  "limit": 50,
  "offset": 0
}
```

#### Submit Feedback

```
POST /api/v1/anomalies/{id}/feedback
```

Request:
```json
{
  "is_true_positive": false,
  "correct_label": "deployment_artifact",
  "comment": "This was during rolling deploy, expected pattern",
  "submitted_by": "ops-admin"
}
```

#### Get Anomaly Details

```
GET /api/v1/anomalies/{id}
```

#### Acknowledge / Resolve

```
PATCH /api/v1/anomalies/{id}
```

Request:
```json
{
  "status": "acknowledged",
  "assigned_to": "sre-team"
}
```

---

## Data Model

```python
# models/anomaly.py
@dataclass
class LogEvent:
    timestamp: datetime
    source: str          # e.g. "docker:web-01"
    service: str         # e.g. "nginx", "postgres"
    level: str           # DEBUG, INFO, WARN, ERROR, FATAL
    message: str
    host: str
    container_id: str | None
    raw: str

@dataclass
class LogFeatureVector:
    window_start: datetime
    window_end: datetime
    source: str
    error_rate: float
    unique_error_types: int
    log_volume_delta: float
    temporal_entropy: float
    keyword_scores: dict[str, float]
    burst_score: float
    embedding: list[float] | None  # LSTM encoder output

@dataclass
class AnomalyEvent:
    id: str
    timestamp: datetime
    severity: str          # critical / warning / info
    score: float           # 0.0 - 1.0
    source: str
    service: str
    pattern: str           # ML-classified pattern label
    summary: str
    affected_logs: list[dict]
    features_snapshot: dict
    status: str            # open / acknowledged / resolved / dismissed
    acknowledged_by: str | None
    resolved_at: datetime | None
    feedback: list[Feedback] | None

@dataclass
class Feedback:
    anomaly_id: str
    is_true_positive: bool
    correct_label: str | None
    comment: str | None
    submitted_by: str
    submitted_at: datetime
```

**Database Schema (PostgreSQL + TimescaleDB):**

```sql
-- Log events (raw, short retention)
CREATE TABLE log_events (
    id          BIGSERIAL,
    timestamp   TIMESTAMPTZ NOT NULL,
    source      TEXT NOT NULL,
    service     TEXT,
    level       TEXT NOT NULL,
    message     TEXT NOT NULL,
    host        TEXT,
    container_id TEXT,
    raw         TEXT
) PARTITION BY RANGE (timestamp);

-- Features (aggregated, medium retention)
CREATE TABLE log_features (
    window_start    TIMESTAMPTZ NOT NULL,
    window_end      TIMESTAMPTZ NOT NULL,
    source          TEXT NOT NULL,
    error_rate      DOUBLE PRECISION,
    unique_errors   INTEGER,
    log_volume_delta DOUBLE PRECISION,
    temporal_entropy DOUBLE PRECISION,
    keyword_scores  JSONB,
    burst_score     DOUBLE PRECISION,
    embedding       VECTOR(128),
    PRIMARY KEY (window_start, source)
);

-- Anomaly events (long retention)
CREATE TABLE anomaly_events (
    id              TEXT PRIMARY KEY,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    severity        TEXT NOT NULL,
    score           DOUBLE PRECISION NOT NULL,
    source          TEXT NOT NULL,
    service         TEXT,
    pattern         TEXT,
    summary         TEXT,
    features_snapshot JSONB,
    status          TEXT NOT NULL DEFAULT 'open',
    acknowledged_by TEXT,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback
CREATE TABLE anomaly_feedback (
    id              SERIAL PRIMARY KEY,
    anomaly_id      TEXT REFERENCES anomaly_events(id),
    is_true_positive BOOLEAN NOT NULL,
    correct_label   TEXT,
    comment         TEXT,
    submitted_by    TEXT NOT NULL,
    submitted_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Integration Service** | Log collection pipeline, feature extraction, model inference, alert manager, feedback API |
| **Orchestrator Agent** | Deploy log-agent sidecar configuration, manage log buffer infrastructure (Kafka/Redis) |
| **Management Panel** | WebSocket alert feed, anomaly detail view, feedback UI, historical search |
| **Discord Bot / Notifications** | Forward critical anomalies to Discord/Slack channels |

---

## Configuration Reference

```yaml
# config/log_agent.yaml
agent:
  collection:
    sources:
      - type: tail
        path: /var/log/nginx/*.log
        parser: nginx
      - type: journald
        filter:
          - unit: docker.service
          - unit: sshd.service
    buffer_max_size: 10MB
    flush_interval_s: 5
  enrich:
    add_hostname: true
    add_container_labels: true
```

```json
// config/anomaly_alerts.json
{
  "channels": {
    "panel": { "enabled": true, "websocket_topic": "anomaly.detected" },
    "discord": { "enabled": true, "webhook_url": "{{ secrets.DISCORD_ALERT_WEBHOOK }}" },
    "slack": { "enabled": false, "webhook_url": "" },
    "email": { "enabled": true, "recipients": ["sre@example.com"], "throttle_minutes": 15 }
  },
  "severity_rules": {
    "critical": { "notify_all": true, "auto_create_incident": true },
    "warning": { "notify_discord": true, "auto_create_incident": false },
    "info": { "notify_panel_only": true }
  }
}
```

---

## Effort Breakdown

| Phase | Task | PT | Dependencies |
|-------|------|----|-------------|
| 1.1 | Log agent sidecar deployment | 1 | Docker orchestration |
| 1.2 | Central log buffer setup (Kafka/Redis) | 1 | Infrastructure |
| 1.3 | Log parsing & normalization | 0.5 | Log schema definition |
| 1.4 | Feature extraction service | 1 | Parsing pipeline |
| 2.1 | Historical dataset preparation | 1 | Phase 1 completion |
| 2.2 | Isolation Forest training | 1 | Labeled dataset |
| 2.3 | LSTM training | 1.5 | GPU-available infra |
| 2.4 | Ensemble calibrator | 0.5 | Both models trained |
| 2.5 | Model registry & deployment | 0.5 | MLflow setup |
| 3.1 | Alert deduplication | 0.5 | Anomaly event schema |
| 3.2 | Severity classification | 0.5 | Scoring pipeline |
| 3.3 | WebSocket push | 0.5 | Panel WebSocket infra |
| 3.4 | Notification integrations | 0.5 | Discord/Slack webhooks |
| 3.5 | Feedback API | 0.5 | REST API framework |
| 3.6 | Scheduled retraining | 0.5 | Cron + MLflow |
| | **Total** | **10.5** | |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| High false-positive rate | Alert fatigue, ignored alerts | Feedback loop, dynamic threshold tuning, ensemble scoring |
| Log volume at scale | Storage costs, latency | Sampling for high-volume sources, tiered retention, Kafka compression |
| Model drift over time | Degraded detection accuracy | Weekly retraining, drift monitoring, automatic rollback to previous model |
| Privacy / sensitive logs | Compliance violation | PII redaction pipeline, configurable exclude patterns, audit trail |

---

## Metrics & KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| MTTD (mean time to detect) | < 30s | Time from error to anomaly event creation |
| Precision (accuracy of alerts) | > 90% | True positives / (TP + FP) |
| Recall (anomalies caught) | > 85% | TP / (TP + FN) from post-mortem review |
| Feedback response rate | > 20% of alerts | Feedback count / total anomaly events |
| Model training time | < 4 hours | End-to-end pipeline duration |
