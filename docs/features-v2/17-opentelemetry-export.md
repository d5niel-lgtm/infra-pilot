# Feature 17: OpenTelemetry Export

- **Feature #:** 17
- **Category:** Developer Ecosystem & API
- **Primary Service:** Integration Service
- **Supporting Services:** Orchestrator Agent, Management Panel, Discord Service, Service Core
- **Effort:** Medium (4-6 PT)
- **Dependencies:** Feature #14 (API Gateway & Rate Limiting)

---

## 1. Overview

OpenTelemetry Export enables Infra Pilot to emit traces, metrics, and logs via the OpenTelemetry Protocol (OTLP) to any OTel-compatible backend (Grafana Tempo, Jaeger, SigNoz, Datadog, New Relic, Honeycomb, etc.). Distributed trace context propagates across all services (Panel → Integration Service → Orchestrator Agent → Service Core), enabling end-to-end request visibility.

### Goals

- Export traces, metrics, and logs via OTLP (gRPC and HTTP/protobuf)
- Distributed trace propagation across all microservices
- Automatic instrumentation of HTTP handlers, database queries, and message queues
- Configurable sampling (rate-based, head-based, tail-based)
- Correlation between traces, metrics, and logs via consistent span/trace IDs
- Minimal performance overhead (~1-3% latency increase at 100% sampling)

### Non-Goals

- Running an OTel Collector as part of Infra Pilot (users bring their own backend/collector)
- Replacing existing Prometheus metrics endpoint (OTel supplements, does not replace)
- Custom OTel instrumentation SDK development — use standard SDKs

---

## 2. Architecture

### High-Level Component Diagram

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Management Panel │    │ Integration      │    │ Orchestrator     │
│ (JS/React)       │    │ Service (Node)   │    │ Agent (Python)   │
│                  │    │                  │    │                  │
│ OTel JS SDK      │    │ OTel Node SDK    │    │ OTel Python SDK  │
│ Web OTEL         │    │ Auto-            │    │ Auto-            │
│ Exporter         │    │ Instrumentation  │    │ Instrumentation  │
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         │                      │                       │
         │                      │                       │
         └──────────────────────┼───────────────────────┘
                                │
                                ▼
                  ┌─────────────────────────────┐
                  │  OTLP Exporter (gRPC / HTTP) │
                  │  ─────────────────────────── │
                  │  endpoint: ${OTEL_EXPORTER_  │
                  │    OTLP_ENDPOINT}:4317       │
                  └────────────┬────────────────┘
                               │
                               ▼
                  ┌─────────────────────────────┐
                  │  User's OTel Backend         │
                  │  (Collector, Grafana Tempo,  │
                  │   Jaeger, SigNoz, Datadog)   │
                  └─────────────────────────────┘
```

### Trace Propagation Flow

```
Browser / External Request
       │
       │ Traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
       ▼
┌──────────────────┐
│ Management Panel │──► Create/Inject span context
│ (React)          │
└──────┬───────────┘
       │ HTTP header propagation
       ▼
┌──────────────────┐
│ Integration      │──► Extract context → Create child span
│ Service (Node)   │──► Auto-instrument HTTP, DB, Queue
└──────┬───────────┘
       │ gRPC metadata / HTTP headers
       ▼
┌──────────────────┐
│ Orchestrator     │──► Extract context → Create child span
│ Agent (Python)   │──► Auto-instrument aiohttp, psycopg2, redis
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Service Core     │──► Extract context → Create child span
│ (Java)           │──► Auto-instrument JAX-RS, JDBC, RabbitMQ
└──────────────────┘
```

### Span Attributes (Enrichment)

Every span carries standardized attributes for correlation:

```json
{
  "span_id": "b7ad6b7169203331",
  "trace_id": "0af7651916cd43dd8448eb211c80319c",
  "resource": {
    "service.name": "orchestrator-agent",
    "service.version": "2.5.0",
    "deployment.environment": "production",
    "host.name": "ip-orch-pod-7f8b9c",
    "telemetry.sdk.name": "opentelemetry",
    "telemetry.sdk.language": "python",
    "telemetry.sdk.version": "1.28.0"
  },
  "scope": {
    "name": "infrapilot.orchestrator.provisioning"
  },
  "attributes": {
    "infrapilot.tenant_id": "tnt_001",
    "infrapilot.server_id": "srv_web_01",
    "infrapilot.server_name": "web-01",
    "infrapilot.action": "server.create",
    "infrapilot.user_id": "usr_abc",
    "http.method": "POST",
    "http.route": "/api/v2/servers",
    "http.status_code": 201,
    "db.system": "postgresql",
    "db.name": "infrapilot"
  }
}
```

---

## 3. Data Model

### Configuration

```json
{
  "otel": {
    "enabled": true,
    "exporter": {
      "protocol": "grpc",
      "endpoint": "http://otel-collector:4317",
      "headers": {
        "x-api-key": "${OTEL_API_KEY}"
      },
      "compression": "gzip",
      "timeout_ms": 10000
    },
    "traces": {
      "enabled": true,
      "sampler": {
        "type": "parentbased_traceidratio",
        "ratio": 0.1,
        "rate_limit_per_second": 100
      },
      "max_export_batch_size": 512,
      "export_interval_ms": 5000
    },
    "metrics": {
      "enabled": true,
      "export_interval_ms": 30000,
      "temporality": "delta",
      "exemplars_enabled": true
    },
    "logs": {
      "enabled": true,
      "severity_threshold": "INFO",
      "include_console": true
    },
    "propagation": {
      "format": ["traceparent", "baggage"],
      "headers": ["traceparent", "tracestate", "baggage"]
    },
    "resource": {
      "service.name": "infrapilot",
      "deployment.environment": "production"
    }
  }
}
```

### Metrics Exported

| Metric Name | Type | Description | Unit |
|-------------|------|-------------|------|
| `infrapilot.server.provisioning.duration` | Histogram | Time to provision a server | ms |
| `infrapilot.server.backup.duration` | Histogram | Time to complete backup | ms |
| `infrapilot.server.backup.size` | Histogram | Backup size | bytes |
| `infrapilot.api.request.duration` | Histogram | API request latency | ms |
| `infrapilot.api.request.count` | Counter | Total API requests | count |
| `infrapilot.api.request.errors` | Counter | API request errors | count |
| `infrapilot.discord.command.count` | Counter | Discord command invocations | count |
| `infrapilot.db.connection.pool.size` | Gauge | Active DB connections | count |
| `infrapilot.db.query.duration` | Histogram | Database query latency | ms |
| `infrapilot.queue.depth` | Gauge | Message queue depth | count |

### Log Correlation

Structured logs include trace context for correlation:

```json
{
  "timestamp": "2026-05-20T12:00:00.123Z",
  "level": "INFO",
  "message": "Server provisioned successfully",
  "service": "orchestrator-agent",
  "trace_id": "0af7651916cd43dd8448eb211c80319c",
  "span_id": "b7ad6b7169203331",
  "trace_flags": "01",
  "resource": {
    "server_id": "srv_web_01",
    "tenant_id": "tnt_001",
    "provider": "hetzner"
  }
}
```

---

## 4. Implementation Plan

### Phase 1: SDK Integration & Auto-Instrumentation (Weeks 1-2, 2.5 PT)

| Task | Service | Description |
|------|---------|-------------|
| 1.1 | Integration Service | Add OTel Node.js SDK + auto-instrumentation packages |
| 1.2 | Orchestrator Agent | Add OTel Python SDK + auto-instrumentation packages |
| 1.3 | Discord Service | Add OTel Node.js SDK + auto-instrumentation |
| 1.4 | Service Core | Add OTel Java SDK + auto-instrumentation (OpenLiberty/Quarkus) |
| 1.5 | Management Panel | Add OTel Web SDK (Web Vitals, fetch instrumentation) |
| 1.6 | All | Configure OTLP exporter, batching, compression, TLS |

**Deliverables:** All services instrumented and exporting traces to configurable OTLP endpoint.

### Phase 2: Trace Propagation (Week 2-3, 1 PT)

| Task | Service | Description |
|------|---------|-------------|
| 2.1 | All | Ensure W3C TraceContext (traceparent/tracestate) propagation |
| 2.2 | Integration Service | Add propagation through gRPC metadata |
| 2.3 | Orchestrator Agent | Add propagation through aiohttp client requests |
| 2.4 | Management Panel | Add propagation through fetch/axios interceptors |
| 2.5 | All | Add baggage propagation for tenant/user context |

**Deliverables:** End-to-end distributed traces across all service boundaries.

### Phase 3: Metrics Export (Week 3, 1 PT)

| Task | Service | Description |
|------|---------|-------------|
| 3.1 | Integration Service | Define & register OTel metrics (histograms, counters, gauges) |
| 3.2 | Orchestrator Agent | Define & register OTel metrics for provisioning operations |
| 3.3 | Service Core | Define & register OTel metrics for game server lifecycle |
| 3.4 | Integration Service | Add exemplar support (trace-to-metrics correlation) |
| 3.5 | All | Configure delta vs cumulative temporality |

**Deliverables:** Custom metrics exported via OTLP with exemplar support.

### Phase 4: Log Correlation (Week 4, 1 PT)

| Task | Service | Description |
|------|---------|-------------|
| 4.1 | All | Inject trace_id/span_id into all structured log entries |
| 4.2 | All | Configure OTel log exporter (severity filtering, batching) |
| 4.3 | Integration Service | Add log correlation dashboard config (optional Grafana) |
| 4.4 | Shared | Document trace-to-log query patterns |

**Deliverables:** All logs include trace context; logs exportable via OTLP.

### Phase 5: Sampler Configuration & Performance (Week 5, 0.5 PT)

| Task | Service | Description |
|------|---------|-------------|
| 5.1 | All | Head-based sampling configuration (rate, trace ID ratio) |
| 5.2 | Integration Service | Tail-based sampler (sample only interesting spans: errors, slow) |
| 5.3 | All | Load testing at 100% and 1% sampling; measure overhead |
| 5.4 | Shared | Document recommended sampling strategies per environment |

**Deliverables:** Configurable sampling strategies with validated performance characteristics.

---

## 5. API Design

### Configuration Endpoint

```yaml
GET /api/v2/otel/status
```

```json
{
  "enabled": true,
  "exporter": {
    "endpoint": "http://otel-collector:4317",
    "protocol": "grpc",
    "connected": true,
    "last_export": "2026-05-20T12:00:05Z"
  },
  "traces": {
    "spans_exported": 15234,
    "spans_dropped": 12,
    "sampling_ratio": 0.1
  },
  "metrics": {
    "datapoints_exported": 89234,
    "datapoints_dropped": 0
  },
  "logs": {
    "records_exported": 452345,
    "records_dropped": 45
  }
}
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_SDK_DISABLED` | `false` | Disable OTel SDK entirely |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | OTLP gRPC endpoint |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` | OTLP protocol (`grpc`/`http/protobuf`) |
| `OTEL_EXPORTER_OTLP_HEADERS` | — | Custom headers (e.g., API key) |
| `OTEL_EXPORTER_OTLP_COMPRESSION` | `gzip` | Compression (`gzip`/`none`) |
| `OTEL_TRACES_SAMPLER` | `parentbased_always_on` | Sampler type |
| `OTEL_TRACES_SAMPLER_ARG` | `1.0` | Sampler argument (ratio) |
| `OTEL_METRICS_EXPORTER` | `otlp` | Metrics exporter |
| `OTEL_LOGS_EXPORTER` | `otlp` | Logs exporter |
| `OTEL_SERVICE_NAME` | `infrapilot` | Service name for resource |
| `OTEL_RESOURCE_ATTRIBUTES` | — | Additional resource attributes |

### Sampler Configuration

```yaml
traces:
  sampler:
    # Parent-based trace ID ratio sampler
    type: parentbased_traceidratio
    ratio: 0.1  # 10% of traces

    # Or: rate-limiting sampler
    # type: rate_limiting
    # traces_per_second: 10

    # Or: always sample errors + slow spans
    # type: tail_based
    # rules:
    #   - sample_when: { http.status_code >= 500 }
    #   - sample_when: { duration_ms >= 5000 }
    #   - rate: 0.01  # background rate for normal spans
```

---

## 6. Service Assignments

| Service | Responsibilities |
|---------|-----------------|
| **Integration Service** | OTel Node.js SDK + auto-instrumentation, gRPC/HTTP propagation, metric registration, tail-based sampling logic, status API |
| **Orchestrator Agent** | OTel Python SDK + auto-instrumentation (aiohttp, psycopg2, redis), trace propagation, provisioning metrics |
| **Management Panel** | OTel Web SDK (Web Vitals, fetch instrumentation), traceparent propagation via HTTP headers |
| **Discord Service** | OTel Node.js SDK + auto-instrumentation, Discord.js hook instrumentation, command metrics |
| **Service Core** | OTel Java SDK + auto-instrumentation (JAX-RS, JDBC, RabbitMQ), JVM metrics, game server lifecycle spans |

---

## 7. Example: Distributed Trace Output

### Single Request Trace (Panel → Integration → Orchestrator → DB)

```
Trace: 0af7651916cd43dd8448eb211c80319c
├── Span: panel.dashboard.render          (2ms)    [Management Panel]
│   └── Span: panel.api.fetch.servers     (5ms)    [Management Panel]
│       └── Span: integration.http.POST   (3ms)    [Integration Service]
│           └── Span: orchestrator.provision.server  (850ms) [Orchestrator Agent]
│               ├── Span: cloud.hetzner.create_server (600ms) [Orchestrator Agent]
│               ├── Span: db.query.insert_server      (12ms)  [Orchestrator Agent]
│               └── Span: cache.set.server_state       (2ms)  [Orchestrator Agent]
│                   └── Span: redis.command.set        (1ms)  [Orchestrator Agent]
```

### Span with Error

```json
{
  "name": "cloud.hetzner.create_server",
  "trace_id": "0af7651916cd43dd8448eb211c80319c",
  "span_id": "b7ad6b7169203331",
  "parent_span_id": "9c8d7e6f5a4b3c2d",
  "start_time": "2026-05-20T12:00:00.000Z",
  "end_time": "2026-05-20T12:00:00.600Z",
  "status": {
    "code": "ERROR",
    "message": "Insufficient resources in fsn1 region"
  },
  "attributes": {
    "infrapilot.server_id": "srv_web_01",
    "infrapilot.provider": "hetzner",
    "infrapilot.region": "fsn1",
    "http.status_code": 507,
    "error.type": "INSUFFICIENT_CAPACITY",
    "error.message": "No available servers in fsn1 region"
  },
  "events": [
    {
      "name": "exception",
      "timestamp": "2026-05-20T12:00:00.600Z",
      "attributes": {
        "exception.type": "HetznerApiException",
        "exception.message": "HTTP 507: Insufficient resources",
        "exception.stacktrace": "HetznerApiException: ..."
      }
    }
  ]
}
```

---

## 8. Effort Estimate

| Phase | PT | Dependencies |
|-------|----|-------------|
| Phase 1: SDK Integration & Auto-Instrumentation | 2.5 | Feature #14 (API Gateway) — for rate limiting on export |
| Phase 2: Trace Propagation | 1.0 | Phase 1 |
| Phase 3: Metrics Export | 1.0 | Phase 1 |
| Phase 4: Log Correlation | 1.0 | Phase 1 |
| Phase 5: Sampler Configuration & Performance | 0.5 | Phase 1 |
| **Buffer (15%)** | **0.9** | — |
| **Total** | **~6.9 PT** | — |

### Risk Factors

- **SDK version compatibility:** OpenTelemetry SDKs across languages must agree on OTLP version (v0/v1)
- **Auto-instrumentation blind spots:** Not all libraries are covered — manual instrumentation needed for custom middleware
- **Performance at scale:** High-throughput services may need judicious sampling to avoid overwhelming the exporter
- **Java agent compatibility:** Service Core runs Java 8+; OTel Java agent requires Java 8 minimum (OK) but may conflict with existing agents (JMX, etc.)

---

## 9. Security & Compliance

- OTLP connection uses TLS by default; mTLS supported for mutual authentication
- API keys can be passed via OTLP headers for collector authentication
- Sampling must never drop error spans with security relevance (auth failures, permission errors)
- Span attributes must not include secrets, passwords, or PII; attribute filtering middleware strips sensitive fields
- OTel export is outbound-only — no inbound listener required
- All OTel configuration is tenant-isolated where applicable (multi-tenant deployments)
