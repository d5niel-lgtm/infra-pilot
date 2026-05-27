# Feature 13: Webhook Event Bus

- **Feature ID:** 13
- **Category:** Developer Ecosystem & API
- **Primary Service:** Integration Service
- **Effort Estimate:** Medium (4-6 PT)
- **Dependencies:** Internal event system (existing), REST API (v1)
- **Phase:** Phase 2 (Weeks 5-8)

---

## Overview

The **Webhook Event Bus** provides a reliable, configurable outgoing webhook system for every infrastructure event in Infra Pilot. When a server starts/stops, a backup completes, an alert triggers, or any other domain event occurs, the bus delivers a structured HTTP payload to registered subscriber endpoints. The system supports payload templating, HMAC signing for authenticity, configurable retry with exponential backoff, and delivery logging.

### Goals

- Fire webhooks for every significant domain event (server lifecycle, backup, alert, deployment, DNS change)
- Support configurable payload templates (Go templates or JSONPath) per subscriber
- Implement retry with exponential backoff + jitter (max 5 retries, 24h delivery window)
- HMAC-SHA256 signing of payloads with configurable secrets per subscriber
- Delivery logs with status, latency, response code, and failure reason
- Admin UI in the Management Panel to manage webhook subscriptions and view delivery history

### Non-Goals

- Replace the internal event bus or message queue
- Provide webhook event filtering on the publisher side (filtering is per-subscriber)
- Support webhook event replay from persistent store (future enhancement)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Event Producers                              │
│                                                                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │ Orchestrator│  │ Service    │  │ Integration│  │ Discord      │  │
│  │ Agent      │  │ Core       │  │ Service    │  │ Service      │  │
│  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └──────┬───────┘  │
│         │               │               │               │          │
│         └───────────────┴───────────────┴───────────────┘          │
│                                    │                                │
│                                    ▼                                │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                Internal Event Bus (Redis Pub/Sub)              │ │
│  │  server.started | server.stopped | backup.completed |         │ │
│  │  alert.triggered | deployment.succeeded | dns.updated         │ │
│  └────────────────────────────┬───────────────────────────────────┘ │
│                               │                                     │
│                               ▼                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                  Webhook Event Bus Service                     │ │
│  │                                                                │ │
│  │  ┌──────────────────┐  ┌──────────────────┐                   │ │
│  │  │ Event Subscriber  │  │ Payload Templater│                   │ │
│  │  │ Registry         │  │ (Go templates)   │                   │ │
│  │  │ - Match events   │  │ - Build body     │                   │ │
│  │  │ - Filter by type │  │ - Set headers    │                   │ │
│  │  └────────┬─────────┘  └────────┬─────────┘                   │ │
│  │           │                     │                              │ │
│  │           ▼                     ▼                              │ │
│  │  ┌──────────────────┐  ┌──────────────────┐                   │ │
│  │  │ HMAC Signer      │  │ Delivery Engine  │                   │ │
│  │  │ - SHA256 digest  │  │ - HTTP POST      │                   │ │
│  │  │ - Header: X-Sig  │  │ - Retry queue    │                   │ │
│  │  │ - Timestamp      │  │ - Backoff        │                   │ │
│  │  └──────────────────┘  └────────┬─────────┘                   │ │
│  │                                │                              │ │
│  │  ┌─────────────────────────────▼───────────────────────────┐  │ │
│  │  │             Delivery Log Store (PostgreSQL)              │  │ │
│  │  │  id | subscriber_id | event_id | status | latency |     │  │ │
│  │  │  response_code | error_msg | delivered_at               │  │ │
│  │  └─────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                               │                                     │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Subscriber Endpoints  │
                    │  (Slack, Discord,      │
                    │   PagerDuty, Custom)   │
                    └───────────────────────┘
```

### Component Flow

```
1. Event Producer emits event to Redis Pub/Sub
2. Webhook Bus subscribes to all event channels
3. Subscriber Registry matches event type -> enabled webhooks
4. Payload Templater renders subscriber-specific template
5. HMAC Signer computes SHA256 signature with subscriber secret
6. Delivery Engine sends HTTP POST with retry logic
7. Delivery Log records success/failure with metadata
```

---

## Implementation Plan

### Phase A: Event Registry & Subscriber Model (1.5 PT)

1. Define the canonical event schema in the Integration Service
2. Implement event type registry with metadata (event name, version, schema)
3. Build subscriber model: URL, events filter, template, secret, retry config
4. Create PostgreSQL schema for subscribers and delivery logs
5. Build CRUD API for managing webhook subscriptions

### Phase B: Payload Templating & Signing (1.5 PT)

1. Implement Go template rendering engine with event data injection
2. Support default templates per event type (overridable per subscriber)
3. Implement HMAC-SHA256 signing with subscriber secret
4. Add timestamp-based nonce (`X-Infrapilot-Timestamp` header)
5. Add optional payload body (`X-Infrapilot-Signature-256` header)

### Phase C: Delivery Engine & Retry (1.5 PT)

1. Build HTTP delivery worker pool with configurable concurrency
2. Implement retry with exponential backoff + jitter (0s, 10s, 30s, 2m, 10m, 1h)
3. Add circuit breaker: disable subscriber after N consecutive failures
4. Implement dead-letter queue after max retries exhausted
5. Build delivery log persistence with async batch writes

### Phase D: Admin UI & Monitoring (1 PT)

1. Add Management Panel pages: Webhook list, create/edit form, delivery log viewer
2. Add webhook test button (send sample event)
3. Add metrics: delivery count, success rate, P50/P95/P99 latency
4. Add alerting: subscriber disabled alert, high failure rate alert

---

## API Design

### Webhook Subscription CRUD

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/webhook-subscriptions` | List all subscriptions |
| `POST` | `/api/v1/webhook-subscriptions` | Create subscription |
| `GET` | `/api/v1/webhook-subscriptions/:id` | Get subscription details |
| `PUT` | `/api/v1/webhook-subscriptions/:id` | Update subscription |
| `DELETE` | `/api/v1/webhook-subscriptions/:id` | Delete subscription |
| `POST` | `/api/v1/webhook-subscriptions/:id/test` | Send test event |

### Delivery Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/webhook-deliveries` | List deliveries (paginated) |
| `GET` | `/api/v1/webhook-deliveries/:id` | Get delivery detail |
| `POST` | `/api/v1/webhook-deliveries/:id/retry` | Manually retry delivery |

### Event Types Registry

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/events/types` | List all available event types |

### Payload Schema

**Delivery Request (outgoing to subscriber):**

```
POST /webhook HTTP/1.1
Content-Type: application/json
User-Agent: InfraPilot-Webhook/1.0
X-Infrapilot-Delivery-Id: dlv_abc123
X-Infrapilot-Event-Type: server.started
X-Infrapilot-Timestamp: 1717000000
X-Infrapilot-Signature-256: sha256=abcdef1234567890...
```

```json
{
  "event": {
    "id": "evt_abc123",
    "type": "server.started",
    "version": "1.0",
    "created_at": "2026-05-27T12:00:00Z",
    "actor": {
      "id": "usr_xyz",
      "type": "user"
    }
  },
  "data": {
    "server_id": "srv_abc123",
    "server_name": "web-01",
    "region": "us-east",
    "previous_status": "stopped",
    "current_status": "running",
    "started_at": "2026-05-27T12:00:05Z"
  },
  "links": {
    "self": "https://api.infrapanel.io/v1/servers/srv_abc123"
  }
}
```

---

## Data Model

### Subscriber Configuration

```json
{
  "id": "sub_abc123",
  "name": "Slack Ops Channel",
  "url": "https://hooks.slack.com/services/T00/B00/xxx",
  "enabled": true,
  "event_types": ["server.*", "backup.*", "alert.*"],
  "template": "{\n  \"text\": \"Server {{.data.server_name}} is {{.data.current_status}}\"\n}",
  "secret": "whsec_****",
  "retry_config": {
    "max_retries": 5,
    "initial_backoff_ms": 1000,
    "max_backoff_ms": 3600000,
    "circuit_breaker_threshold": 10,
    "circuit_breaker_reset_seconds": 300
  },
  "headers": {
    "Authorization": "Bearer custom-token"
  },
  "created_at": "2026-05-01T00:00:00Z",
  "updated_at": "2026-05-27T00:00:00Z"
}
```

### Delivery Log

```json
{
  "id": "dlv_abc123",
  "subscriber_id": "sub_abc123",
  "event_id": "evt_xyz789",
  "event_type": "server.started",
  "status": "delivered",
  "request": {
    "url": "https://hooks.slack.com/services/T00/B00/xxx",
    "method": "POST",
    "headers": {
      "content-type": "application/json",
      "x-infrapilot-signature-256": "sha256=..."
    },
    "body_size_bytes": 512
  },
  "response": {
    "status_code": 200,
    "headers": {},
    "body_preview": "ok",
    "latency_ms": 245
  },
  "retry_attempt": 0,
  "error_message": null,
  "delivered_at": "2026-05-27T12:00:05.123Z",
  "created_at": "2026-05-27T12:00:04.878Z"
}
```

### PostgreSQL Schema

```sql
CREATE TABLE webhook_subscribers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    url             TEXT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    event_types     TEXT[] NOT NULL,
    template        TEXT,
    secret          TEXT,
    retry_config    JSONB NOT NULL DEFAULT '{}',
    headers         JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhook_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id   UUID NOT NULL REFERENCES webhook_subscribers(id) ON DELETE CASCADE,
    event_id        UUID NOT NULL,
    event_type      VARCHAR(255) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    request_headers JSONB,
    request_body    TEXT,
    response_code   SMALLINT,
    response_headers JSONB,
    response_body   TEXT,
    latency_ms      INTEGER,
    retry_attempt   SMALLINT NOT NULL DEFAULT 0,
    error_message   TEXT,
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deliveries_subscriber ON webhook_deliveries(subscriber_id, created_at DESC);
CREATE INDEX idx_deliveries_status ON webhook_deliveries(status) WHERE status = 'pending';
```

---

## Service Assignments

| Component | Owner | Notes |
|-----------|-------|-------|
| Event registry & type system | Platform Team | Canonical event schema |
| Subscriber CRUD API | Integration Team | REST endpoints |
| Payload templating engine | Integration Team | Go templates with event context |
| HMAC signing module | Security Team | SHA256, replay protection |
| Delivery engine & retry | Integration Team | Worker pool, backoff, circuit breaker |
| Delivery log store | Platform Team | PostgreSQL schema, async writes |
| Admin UI (Panel) | Frontend Team | Webhook management pages |
| Metrics & monitoring | DevOps Team | Prometheus metrics, Grafana dashboard |

---

## Effort Estimate Breakdown

| Task | PT | Dependencies |
|------|----|-------------|
| Event registry & canonical schema | 1.0 | Existing event system |
| Subscriber CRUD (API + DB) | 1.0 | PostgreSQL schema |
| Payload templating (Go templates) | 0.5 | Event schema finalized |
| HMAC signing & headers | 0.5 | None |
| Delivery engine (worker pool, HTTP) | 1.0 | Subscriber model |
| Retry with backoff + circuit breaker | 0.5 | Delivery engine |
| Delivery log persistence | 0.5 | DB schema |
| Admin UI (list, create, detail) | 1.0 | API endpoints |
| Test button & sample events | 0.5 | Delivery engine |
| Metrics & alerting | 0.5 | Prometheus |
| **Total** | **6.5** | |

---

## Usage Examples

### Create Webhook Subscription

```bash
curl -X POST https://api.infrapanel.io/v1/webhook-subscriptions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Slack Ops Channel",
    "url": "https://hooks.slack.com/services/xxx",
    "event_types": ["server.*", "alert.*"],
    "template": "{\n  \"text\": \"{{.data.server_name}}: {{.data.current_status}}\"\n}",
    "secret": "my-secret-key"
  }'
```

### Test Webhook

```bash
curl -X POST https://api.infrapanel.io/v1/webhook-subscriptions/sub_abc123/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "server.started",
    "data": {
      "server_name": "test-server",
      "current_status": "running"
    }
  }'
```

### HMAC Verification (Subscriber Side)

```python
import hmac
import hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Header format: sha256=<hex digest>
    received = signature.replace("sha256=", "")
    return hmac.compare_digest(expected, received)
```

### Subscriber Configuration (Management Panel YAML)

```yaml
name: PagerDuty Incidents
url: https://events.pagerduty.com/v2/enqueue/xxx
enabled: true
event_types:
  - alert.triggered
  - server.crashed
  - backup.failed
template: |
  {
    "routing_key": "pd_key",
    "event_action": "trigger",
    "payload": {
      "summary": "{{.event.type}}: {{.data.server_name}}",
      "severity": "critical",
      "source": "infrapilot",
      "custom_details": {{ toJson .data }}
    }
  }
secret: whsec_pd_secret
retry_config:
  max_retries: 3
  initial_backoff_ms: 5000
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Slow subscriber blocks delivery queue | Delivery latency for other subscribers | Per-subscriber concurrency limit, worker pool isolation |
| Subscriber endpoint goes down | Message loss | Retry with backoff + dead-letter queue, alert on circuit breaker |
| Secret key compromise | Webhook spoofing | Key rotation support, audit log of key changes |
| Template injection | Server-side template execution | Sandboxed template engine, limit available functions |
| Event volume spike | Delivery backlog | Bounded worker pool, priority queuing for critical events |

---

## Acceptance Criteria

- [ ] All 20+ event types defined in registry with versioned schemas
- [ ] Webhook subscriptions can filter by glob pattern (e.g., `server.*`)
- [ ] Payload template renders all event fields and supports `toJson`, `now`, `upper`, `lower`
- [ ] HMAC-SHA256 signature header is present on every delivery
- [ ] Retry executes at least 5 attempts with increasing backoff (verified by test)
- [ ] Circuit breaker disables subscriber after N consecutive failures and auto-recovers
- [ ] Delivery logs store full request/response metadata for 30 days
- [ ] Admin UI can create, edit, enable/disable, delete subscriptions
- [ ] Test button sends real webhook with sample event data
- [ ] P50 delivery latency < 500ms, P99 < 5s (excluding retries)
- [ ] Dead-letter queue captures all failed deliveries after max retries
