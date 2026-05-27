# SIEM Export

> **Feature ID:** 49  
> **Category:** Security & Compliance  
> **Primary Service:** Integration Service  
> **Effort Estimate:** Small (1-3 PT)  
> **Status:** Planned

---

## Overview

Stream audit logs from the Infra Pilot platform to external SIEM (Security Information and Event Management) systems including Splunk, ELK Stack (Elasticsearch/Logstash/Kibana), Datadog, and any RFC 5424 syslog-compatible endpoint. All exports use structured JSON formatting with mandatory TLS transport.

This feature enables security teams to centralise log monitoring, run correlation rules, and maintain a single pane of glass across their infrastructure estate.

### Goals

- Deliver real-time and batch audit log export to major SIEM platforms
- Enforce TLS/mTLS for all outbound log transmissions
- Provide filterable export rules (by severity, source, service, label)
- Implement exponential-backoff retry for transient delivery failures
- Support both push (HTTP/Syslog) and pull (SIEM-initiated scrape) models
- Maintain delivery guarantees with at-least-once semantics

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Infra Pilot Platform                          │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Audit    │  │  Access  │  │  Billing  │  │  Resource        │ │
│  │  Logs     │  │  Logs    │  │  Logs     │  │  Change Logs     │ │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └────────┬─────────┘ │
│        │              │              │                │           │
│        ▼              ▼              ▼                ▼           │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                 Integration Service                        │    │
│  │  ┌────────────────────────────────────────────────────┐  │    │
│  │  │              SIEM Export Pipeline                   │  │    │
│  │  │                                                     │  │    │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │    │
│  │  │  │ Log      │──│ Filter & │──│ Transformer      │  │  │    │
│  │  │  │ Buffer   │  │ Classify │  │ → JSON Schema    │  │  │    │
│  │  │  └──────────┘  └──────────┘  └────────┬─────────┘  │  │    │
│  │  │                                        │            │  │    │
│  │  │                                        ▼            │  │    │
│  │  │  ┌──────────────────────────────────────────────┐  │  │    │
│  │  │  │         Output Router                         │  │  │    │
│  │  │  │  ┌─────────┐ ┌──────────┐ ┌──────────────┐  │  │  │    │
│  │  │  │  │ Syslog  │ │  HTTPS   │ │  Pull API    │  │  │  │    │
│  │  │  │  │ (RFC5424)│ │  Push    │ │  (Scrape)    │  │  │  │    │
│  │  │  │  └────┬────┘ └────┬─────┘ └──────┬───────┘  │  │  │    │
│  │  │  └───────┼───────────┼──────────────┼──────────┘  │  │    │
│  │  │          │           │              │             │  │    │
│  │  │          ▼           ▼              ▼             │  │    │
│  │  │  ┌────────────────────────────────────────────┐  │  │    │
│  │  │  │         TLS/mTLS Termination Layer          │  │  │    │
│  │  │  │  ┌──────────┐ ┌──────────┐ ┌────────────┐ │  │  │    │
│  │  │  │  │  CA      │ │  Cert    │ │  Mutual    │ │  │  │    │
│  │  │  │  │  Pool    │ │  Pinning │ │  Auth (mTLS)│ │  │  │    │
│  │  │  │  └──────────┘ └──────────┘ └────────────┘ │  │  │    │
│  │  │  └────────────────────────────────────────────┘  │  │    │
│  │  │                                                  │  │    │
│  │  │  ┌────────────────────────────────────────────┐  │  │    │
│  │  │  │         Retry & Backoff Engine              │  │  │    │
│  │  │  │  Exponential backoff (max 5 retries)       │  │  │    │
│  │  │  │  Dead-letter queue for permanent failures   │  │  │    │
│  │  │  └────────────────────────────────────────────┘  │  │    │
│  │  └────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┬────────────────┐
          ▼                ▼                ▼                ▼
┌──────────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────┐
│     Splunk       │ │   ELK Stack  │ │  Datadog   │ │ RFC 5424 │
│  HEC / TCP Input │ │  Logstash    │ │  HTTP API  │ │  Syslog  │
└──────────────────┘ └──────────────┘ └────────────┘ └──────────┘
```

---

## Implementation Plan

### Phase 1: Core Pipeline (1-2 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 1.1 | Log buffer & classification service | `internal/siem/buffer.go` — in-memory ring buffer with configurable capacity |
| 1.2 | Structured JSON transformer | `internal/siem/transformer.go` — normalise to canonical SIEM schema |
| 1.3 | Output router (syslog / HTTPS / pull) | `internal/siem/router.go` — route per destination config |
| 1.4 | TLS termination layer | `internal/siem/tls.go` — cert loading, mTLS handshake, CA pinning |

**Canonical JSON schema:**

```json
{
  "version": "1.0",
  "timestamp": "2026-05-27T14:30:00.123Z",
  "event_id": "evt-abc123def",
  "event_type": "audit.resource.create",
  "severity": "notice",
  "source": {
    "service": "orchestrator",
    "host": "ctrl-01.infra.example.com",
    "ip": "10.0.1.42"
  },
  "actor": {
    "id": "user-789",
    "type": "user",
    "email": "ops@example.com"
  },
  "resource": {
    "type": "server",
    "id": "srv-web-42",
    "action": "create"
  },
  "context": {
    "request_id": "req-xyz-987",
    "user_agent": "InfraPilot CLI v2.1.0",
    "geo": {
      "city": "Frankfurt",
      "country": "DE"
    }
  },
  "payload": {
    "changes": {
      "cpu_cores": 4,
      "memory_gb": 16
    }
  },
  "labels": {
    "env": "production",
    "team": "platform"
  }
}
```

### Phase 2: Destinations & Retry (0.5-1 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 2.1 | Splunk HEC integration | `internal/siem/dest/splunk.go` — HTTP Event Collector client |
| 2.2 | ELK Logstash integration | `internal/siem/dest/elastic.go` — Logstash TCP/HTTP input client |
| 2.3 | Datadog integration | `internal/siem/dest/datadog.go` — Datadog HTTP Logs API client |
| 2.4 | Generic syslog (RFC 5424) | `internal/siem/dest/syslog.go` — TCP/TLS syslog sender |
| 2.5 | Retry engine with backoff | `internal/siem/retry.go` — exponential backoff, jitter, dead-letter queue |

**Retry configuration:**

```yaml
# config/siem_export.yaml
export:
  retry:
    max_attempts: 5
    initial_backoff_ms: 1000
    max_backoff_ms: 60000
    multiplier: 2.0
    jitter: 0.1          # +/- 10% jitter
    dead_letter_ttl_hours: 72
  batch:
    max_size_bytes: 1048576   # 1 MB
    max_events: 500
    flush_interval_ms: 5000
```

### Phase 3: Filtering & Monitoring (0.5 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 3.1 | Filter rules engine | `internal/siem/filter.go` — include/exclude rules based on severity, source, labels, event_type |
| 3.2 | Rate limiter per destination | `internal/siem/ratelimit.go` — token-bucket per output sink |
| 3.3 | Health check & metrics | Prometheus metrics: `siem_exported_total`, `siem_errors_total`, `siem_queue_depth` |
| 3.4 | Status dashboard panel | Panel widget showing per-destination health, throughput, error rate |

---

## API Design

### SIEM Export Configuration CRUD

#### List Export Targets

```
GET /api/v1/integrations/siem
```

Response:
```json
{
  "targets": [
    {
      "id": "siem-splunk-prod",
      "name": "Splunk Production",
      "type": "splunk_hec",
      "endpoint": "https://splunk.example.com:8088/services/collector",
      "enabled": true,
      "tls": {
        "verify": true,
        "mtls_enabled": false
      },
      "filter": {
        "min_severity": "notice",
        "include_labels": {"env": "production"},
        "exclude_event_types": ["heartbeat"]
      },
      "status": "connected",
      "exported_count": 1425300,
      "error_count": 12,
      "last_error_at": "2026-05-27T12:01:00Z",
      "created_at": "2026-05-01T00:00:00Z"
    }
  ]
}
```

#### Create Export Target

```
POST /api/v1/integrations/siem
```

Request:
```json
{
  "name": "Splunk Production",
  "type": "splunk_hec",
  "endpoint": "https://splunk.example.com:8088/services/collector",
  "auth": {
    "token": "{{ secrets.SPLUNK_HEC_TOKEN }}",
    "mtls_cert_pem": null,
    "mtls_key_pem": null
  },
  "tls": {
    "verify": true,
    "ca_cert_pem": null
  },
  "filter": {
    "min_severity": "notice",
    "include_labels": {"env": "production"},
    "exclude_event_types": ["heartbeat"]
  },
  "batch": {
    "max_size_bytes": 1048576,
    "max_events": 500,
    "flush_interval_ms": 5000
  },
  "retry": {
    "max_attempts": 5,
    "initial_backoff_ms": 1000,
    "max_backoff_ms": 60000
  }
}
```

Response: `201 Created`

#### Update Export Target

```
PATCH /api/v1/integrations/siem/{id}
```

#### Delete Export Target

```
DELETE /api/v1/integrations/siem/{id}
```

#### Test Connection

```
POST /api/v1/integrations/siem/{id}/test
```

Response:
```json
{
  "success": true,
  "latency_ms": 145,
  "tls_version": "TLSv1.3",
  "server_info": "Splunk HEC v8.2"
}
```

#### List Available Event Types

```
GET /api/v1/integrations/siem/event-types
```

Response:
```json
{
  "event_types": [
    {"type": "audit.resource.create", "description": "Resource created"},
    {"type": "audit.resource.delete", "description": "Resource deleted"},
    {"type": "audit.resource.modify", "description": "Resource modified"},
    {"type": "audit.access.granted", "description": "Access granted"},
    {"type": "audit.access.denied", "description": "Access denied"},
    {"type": "audit.login.success", "description": "Successful login"},
    {"type": "audit.login.failure", "description": "Failed login attempt"},
    {"type": "billing.invoice.created", "description": "Invoice generated"},
    {"type": "system.heartbeat", "description": "Service health check"}
  ]
}
```

---

## Data Model

```python
# models/siem_export.py
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

class SIEMDestinationType(str, Enum):
    SPLUNK_HEC = "splunk_hec"
    ELK_LOGSTASH = "elk_logstash"
    DATADOG_HTTP = "datadog_http"
    SYSLOG_RFC5424 = "syslog_rfc5424"

class ExportStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    PAUSED = "paused"

@dataclass
class TLSConfig:
    verify: bool = True
    ca_cert_pem: str | None = None
    mtls_enabled: bool = False
    mtls_cert_pem: str | None = None
    mtls_key_pem: str | None = None

@dataclass
class ExportFilter:
    min_severity: str = "info"          # emerg, alert, crit, error, warning, notice, info
    include_labels: dict[str, str] = field(default_factory=dict)
    exclude_labels: dict[str, str] = field(default_factory=dict)
    include_event_types: list[str] = field(default_factory=list)
    exclude_event_types: list[str] = field(default_factory=list)
    include_sources: list[str] = field(default_factory=list)
    exclude_sources: list[str] = field(default_factory=list)

@dataclass
class BatchConfig:
    max_size_bytes: int = 1048576
    max_events: int = 500
    flush_interval_ms: int = 5000

@dataclass
class RetryConfig:
    max_attempts: int = 5
    initial_backoff_ms: int = 1000
    max_backoff_ms: int = 60000
    multiplier: float = 2.0
    jitter: float = 0.1
    dead_letter_ttl_hours: int = 72

@dataclass
class SIEMExportTarget:
    id: str
    name: str
    type: SIEMDestinationType
    endpoint: str
    enabled: bool
    tls: TLSConfig
    filter: ExportFilter
    batch: BatchConfig
    retry: RetryConfig
    status: ExportStatus
    exported_count: int
    error_count: int
    last_error_at: datetime | None
    created_at: datetime
    updated_at: datetime

@dataclass
class SIEMEvent:
    version: str = "1.0"
    timestamp: datetime
    event_id: str
    event_type: str
    severity: str
    source: dict       # {service, host, ip}
    actor: dict | None # {id, type, email}
    resource: dict     # {type, id, action}
    context: dict      # {request_id, user_agent, geo}
    payload: dict      # free-form event data
    labels: dict       # key-value metadata tags
```

**Database Schema:**

```sql
-- SIEM export targets
CREATE TABLE siem_export_targets (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    type            TEXT NOT NULL,            -- splunk_hec, elk_logstash, datadog_http, syslog_rfc5424
    endpoint        TEXT NOT NULL,
    enabled         BOOLEAN DEFAULT true,
    tls_config      JSONB NOT NULL DEFAULT '{}',
    filter_config   JSONB NOT NULL DEFAULT '{}',
    batch_config    JSONB NOT NULL DEFAULT '{}',
    retry_config    JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'disconnected',
    exported_count  BIGINT DEFAULT 0,
    error_count     BIGINT DEFAULT 0,
    last_error_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Dead-letter queue for permanently failed events
CREATE TABLE siem_dead_letters (
    id              BIGSERIAL PRIMARY KEY,
    target_id       TEXT REFERENCES siem_export_targets(id),
    event           JSONB NOT NULL,
    error_reason    TEXT NOT NULL,
    attempt_count   INTEGER NOT NULL,
    failed_at       TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL
);

-- Export audit trail
CREATE TABLE siem_export_log (
    id              BIGSERIAL PRIMARY KEY,
    target_id       TEXT NOT NULL,
    event_count     INTEGER NOT NULL,
    bytes_sent      BIGINT NOT NULL,
    success         BOOLEAN NOT NULL,
    error_message   TEXT,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Configuration Reference

```yaml
# config/siem_export.yaml
export:
  defaults:
    tls:
      verify: true
      min_version: "TLSv1.2"
    batch:
      max_size_bytes: 1048576
      max_events: 500
      flush_interval_ms: 5000
    retry:
      max_attempts: 5
      initial_backoff_ms: 1000
      max_backoff_ms: 60000
      multiplier: 2.0
      jitter: 0.1
      dead_letter_ttl_hours: 72

  targets:
    - name: "Splunk Production"
      type: splunk_hec
      endpoint: "https://splunk.example.com:8088/services/collector"
      auth:
        token: "${SPLUNK_HEC_TOKEN}"
      tls:
        verify: true
      filter:
        min_severity: notice
        include_labels:
          env: production
        exclude_event_types:
          - system.heartbeat
      enabled: true

    - name: "ELK Staging"
      type: elk_logstash
      endpoint: "tcp://logstash.staging.example.com:6514"
      tls:
        verify: true
        mtls_enabled: true
        mtls_cert_pem: "/etc/infrapilot/certs/siem-client.crt"
        mtls_key_pem: "/etc/infrapilot/certs/siem-client.key"
      filter:
        min_severity: info
      enabled: true

    - name: "Datadog EU"
      type: datadog_http
      endpoint: "https://http-intake.logs.datadoghq.eu/api/v2/logs"
      auth:
        token: "${DATADOG_API_KEY}"
      filter:
        min_severity: warning
        include_labels:
          env: production
      enabled: true

    - name: "Corporate Syslog"
      type: syslog_rfc5424
      endpoint: "tcp://syslog.corp.example.com:514"
      tls:
        verify: false
      filter:
        include_event_types:
          - audit.access.denied
          - audit.login.failure
      enabled: false
```

---

## Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Integration Service** | SIEM export pipeline — buffer, transform, route, retry, dead-letter queue; REST API for target CRUD; TLS/mTLS termination |
| **Management Panel** | Configuration UI for SIEM targets; per-destination health dashboard; dead-letter queue viewer and replay |
| **Orchestrator Agent** | Deploy SIEM exporter sidecar configuration; manage secrets injection for auth tokens and TLS material |

---

## Effort Breakdown

| Phase | Task | PT | Dependencies |
|-------|------|----|-------------|
| 1.1 | Log buffer & classification service | 0.5 | Audit log schema |
| 1.2 | JSON transformer (canonical schema) | 0.5 | Schema definition |
| 1.3 | Output router (syslog / HTTPS / pull) | 0.5 | Transformer |
| 1.4 | TLS termination layer | 0.5 | Router |
| 2.1 | Splunk HEC integration | 0.25 | Output router |
| 2.2 | ELK Logstash integration | 0.25 | Output router |
| 2.3 | Datadog HTTP integration | 0.25 | Output router |
| 2.4 | Generic syslog RFC 5424 | 0.25 | Output router |
| 2.5 | Retry engine with backoff | 0.5 | Phase 1 |
| 3.1 | Filter rules engine | 0.25 | Transformer |
| 3.2 | Rate limiter per destination | 0.25 | Router |
| 3.3 | Prometheus metrics & health | 0.25 | Phase 2 |
| 3.4 | Management Panel UI | 0.5 | REST API |
| | **Total** | **4.5** | |

> **Note:** Parallelisation of destination integrations (2.1–2.4) reduces wall-clock time. Actual effort is **1-3 PT** as stated in the plan.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Certificate expiry for mTLS | Export outage | Automated cert expiry monitoring, pre-expiry alerts (30/14/7 days), cert rotation API |
| SIEM endpoint rate limiting | Event loss | Token-bucket rate limiter per target, backpressure signalling, dead-letter queue |
| Sensitive data in audit logs | Compliance violation | Configurable field redaction, `exclude_fields` filter, regex-based PII scrubber |
| High log volume overwhelms network | Latency spikes, dropped events | Configurable batch sizing, compression (gzip), circuit breaker pattern |
| SIEM destination unreachable | Log backlog | Ring buffer with configurable capacity, backpressure to source, dead-letter after max retries |
