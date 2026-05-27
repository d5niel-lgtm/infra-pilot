# Feature 37: Synthetic Monitoring

- **Feature ID:** 37
- **Category:** Advanced Observability
- **Primary Service:** Orchestrator Agent
- **Effort:** Medium (4-6 PT)
- **Dependencies:** Feature 13 (Webhook Event Bus), Feature 36 (SLO Tracking)

---

## 1. Overview

Deploy a global network of synthetic monitoring probes that simulate real user traffic to verify service availability, performance, and correctness. Run HTTP/S checks, TCP port checks, Minecraft server pings, SSL certificate expiry monitoring, and DNS resolution tests from multiple geographic locations. Alert immediately when degradation is detected and track response time trends over time.

### Supported Check Types

| Check Type | Description | Metrics Collected |
|------------|-------------|-------------------|
| HTTP/HTTPS | Full request/response validation | Status code, response time, body match, redirect chain |
| TCP Port | TCP connect check | Connection time, port open/closed |
| ICMP Ping | Network layer reachability | Packet loss %, round-trip time |
| SSL/TLS | Certificate validity check | Days to expiry, issuer, SANs, chain validity |
| DNS Resolution | Record lookup verification | Resolution time, record match, NXDOMAIN detection |
| Minecraft Ping | Minecraft server query | Online status, player count, MOTD, version, latency |

---

## 2. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        Management Panel                             │
│  Check Configuration  │  Probe Map  │  Results Dashboard  │  Alerts │
└─────────────────────────────────┬──────────────────────────────────┘
                                  │
┌─────────────────────────────────▼──────────────────────────────────┐
│                      Orchestrator Agent                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   Synthetic Monitor Core                      │  │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐  │  │
│  │  │  Check       │ │  Schedule    │ │  Result Aggregator   │  │  │
│  │  │  Definition  │ │  Engine      │ │  (multi-probe merge) │  │  │
│  │  └─────────────┘ └──────────────┘ └──────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                  │                                  │
│  ┌───────────────────────────────▼──────────────────────────────┐  │
│  │                    Probe Dispatcher                            │  │
│  │  Routes checks to nearest/available probe locations           │  │
│  └───────────────────────────────┬──────────────────────────────┘  │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────┐
│                      Global Probe Network                            │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Probe    │  │ Probe    │  │ Probe    │  │ Probe    │   ... (N)  │
│  │ us-east  │  │ eu-west  │  │ ap-south │  │ sa-east  │           │
│  │          │  │          │  │          │  │          │           │
│  │ HTTP TCP │  │ HTTP TCP │  │ HTTP TCP │  │ HTTP TCP │           │
│  │ Ping SSL │  │ Ping SSL │  │ Ping SSL │  │ Ping SSL │           │
│  │ DNS MC   │  │ DNS MC   │  │ DNS MC   │  │ DNS MC   │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
└────────────────────────────────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼─────────────────────────────────┐
│                      Data & Notification Sinks                       │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│  │ Prometheus   │  │ Alert Manager  │  │ Integration Service    │  │
│  │ (metrics)    │  │ (notifications) │  │ (SLO engine, webhooks) │  │
│  └──────────────┘  └────────────────┘  └────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Probe Location Architecture

Each probe is a lightweight Docker container running a Python agent that:

1. Connects to the Orchestrator Agent via gRPC for configuration and heartbeat
2. Pulls its assigned check schedule every 60s
3. Executes checks and reports results asynchronously
4. Stores a local buffer (last 1000 results) for offline resilience
5. Reports its own health (CPU, memory, connectivity) to the orchestrator

### Planned Probe Locations (Initial)

| Location | Region | Provider |
|----------|--------|----------|
| us-east-1 | N. Virginia | AWS |
| us-west-1 | N. California | AWS |
| eu-west-1 | Ireland | AWS |
| eu-central-1 | Frankfurt | AWS |
| ap-southeast-1 | Singapore | AWS |
| sa-east-1 | Sao Paulo | AWS |
| eu-west-2 | London | Hetzner |

---

## 3. Data Model

### Check Definition

```yaml
synthetic_check:
  id: "check-http-web-prod"
  name: "Web Production Health Check"
  type: "http"                      # http | tcp | ping | ssl | dns | minecraft
  enabled: true
  interval_seconds: 300
  timeout_ms: 10000
  retry_count: 2
  probe_locations:
    - "us-east-1"
    - "eu-west-1"
    - "ap-southeast-1"
  targets:
    http:
      url: "https://app.example.com/health"
      method: "GET"
      expected_status: 200
      expected_body_regex: "\"status\":\"ok\""
      follow_redirects: true
      headers:
        User-Agent: "InfraPilot-Synthetic/1.0"
    tcp:
      host: "db.internal"
      port: 5432
    ssl:
      host: "app.example.com"
      port: 443
      warn_days_before_expiry: 30
      crit_days_before_expiry: 14
    dns:
      hostname: "app.example.com"
      record_type: "A"
      expected_values:
        - "203.0.113.42"
    minecraft:
      host: "mc.example.com"
      port: 25565
      expected_online: true
      min_player_threshold: 0
  alerts:
    enabled: true
    cooldown_minutes: 15
    channels:
      - "discord"
      - "email"
  labels:
    team: "platform"
    environment: "production"
```

### Check Result

```yaml
check_result:
  id: "res-wXk3m9qR"
  check_id: "check-http-web-prod"
  probe_location: "us-east-1"
  executed_at: 1745712345
  duration_ms: 342
  status: "pass"                    # pass | fail | error
  type: "http"
  data:
    http:
      status_code: 200
      response_time_ms: 312
      body_length: 4523
      tls_version: "TLSv1.3"
      redirect_chain: []
    tcp:
      connection_time_ms: 45
      port_open: true
    ssl:
      days_remaining: 187
      issuer: "Let's Encrypt Authority X3"
      subject_cn: "app.example.com"
      valid: true
      chain_valid: true
    dns:
      resolution_time_ms: 23
      resolved_ips: ["203.0.113.42"]
      records_match: true
    minecraft:
      online: true
      players_online: 42
      max_players: 100
      motd: "§aWelcome to Example MC"
      version: "1.20.4"
      latency_ms: 78
  error: null                       # Error message on failure
  raw_output: null                  # Stored for debugging (truncated)
```

### Probe Agent

```yaml
probe_agent:
  id: "probe-us-east-1"
  location: "us-east-1"
  status: "online"
  version: "1.2.0"
  last_heartbeat: 1745712345
  checks_assigned: 47
  checks_completed_total: 142305
  checks_failed_total: 312
  avg_execution_time_ms: 284
  resources:
    cpu_usage_percent: 23.4
    memory_usage_mb: 128
    network_rx_bytes: 1048576
    network_tx_bytes: 524288
```

---

## 4. API Design

### Check Management

#### List Checks

```
GET /api/v2/synthetic/checks
  ?type=http
  &status=active
  &page=1
  &per_page=50
```

#### Create Check

```
POST /api/v2/synthetic/checks
```

```json
{
  "name": "Web Production Health Check",
  "type": "http",
  "interval_seconds": 300,
  "timeout_ms": 10000,
  "retry_count": 2,
  "probe_locations": ["us-east-1", "eu-west-1"],
  "targets": {
    "http": {
      "url": "https://app.example.com/health",
      "method": "GET",
      "expected_status": 200,
      "expected_body_regex": "\"status\":\"ok\""
    }
  },
  "alerts": {
    "enabled": true,
    "cooldown_minutes": 15
  },
  "labels": {
    "team": "platform"
  }
}
```

Response `201`:
```json
{
  "id": "check-http-web-prod",
  "status": "active",
  "created_at": "2026-05-01T00:00:00Z"
}
```

#### Get Check Details

```
GET /api/v2/synthetic/checks/{check_id}
```

#### Update Check

```
PATCH /api/v2/synthetic/checks/{check_id}
```

#### Delete Check

```
DELETE /api/v2/synthetic/checks/{check_id}
```

#### Trigger Immediate Check

```
POST /api/v2/synthetic/checks/{check_id}/run
```

```json
{
  "probe_locations": ["us-east-1", "eu-west-1"]
}
```

### Results

#### Get Latest Results

```
GET /api/v2/synthetic/checks/{check_id}/results/latest
```

#### Query Results History

```
GET /api/v2/synthetic/checks/{check_id}/results
  ?start=2026-05-01T00:00:00Z
  &end=2026-05-31T23:59:59Z
  &probe_location=us-east-1
  &status=fail
  &page=1
  &per_page=100
```

#### Get Response Time Series

```
GET /api/v2/synthetic/checks/{check_id}/timeseries
  ?window=24h
  &granularity=5m
  &aggregate=avg
```

### Probes

#### List Probes

```
GET /api/v2/synthetic/probes
```

#### Get Probe Details

```
GET /api/v2/synthetic/probes/{probe_id}
```

#### Get Probe Heartbeat Log

```
GET /api/v2/synthetic/probes/{probe_id}/heartbeats
  ?window=24h
```

---

## 5. Implementation Plan

### Phase 1: Probe Runner & Check Execution (PT 1-2)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 1.1 | Define check configuration schema and DB models | `models/synthetic.py` |
| 1.2 | Implement check executors: HTTP, TCP, Ping | `executors/http.py`, `executors/tcp.py`, `executors/ping.py` |
| 1.3 | Implement check executors: SSL, DNS, Minecraft | `executors/ssl.py`, `executors/dns.py`, `executors/minecraft.py` |
| 1.4 | Build probe agent bootstrap script + Dockerfile | `infra/probe-agent/Dockerfile`, `probe_agent.py` |

### Phase 2: Orchestration & Scheduling (PT 3-4)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 2.1 | Probe dispatcher: assign checks to probes, load balancing | `services/probe_dispatcher.py` |
| 2.2 | Schedule engine: cron-like intervals with jitter | `services/schedule_engine.py` |
| 2.3 | Result aggregator: merge multi-probe results, deduplicate | `services/result_aggregator.py` |
| 2.4 | Probe agent heartbeats and health monitoring | `services/probe_health.py` |

### Phase 3: Alerting & Dashboard (PT 5-6)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 3.1 | Alert evaluation: degradation detection, multi-probe consensus | `services/alert_evaluator.py` |
| 3.2 | REST API endpoints for checks, results, probes | `routes/synthetic.py` |
| 3.3 | Panel UI: check list, create/edit form, probe map | Panel components |
| 3.4 | Panel UI: results dashboard, response time charts, alert history | Panel components |

---

## 6. Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Orchestrator Agent** (primary) | Check definition management, probe dispatch, schedule engine, result aggregation, alert evaluation, REST API |
| **Probe Agent** (new sub-component) | Lightweight Python agent deployed at each location, executes checks, reports results |
| **Management Panel** | Check configuration UI, results dashboard, probe map visualization, alert configuration |
| **Integration Service** | Receives check results for SLO integration, webhook dispatch on alert |
| **Discord Service** | Alert notifications with check status, response time graphs |

---

## 7. Effort Estimate: Medium (4-6 PT)

| Area | PT Estimate |
|------|-------------|
| Check executors (HTTP, TCP, Ping, SSL, DNS, Minecraft) | 1.5 |
| Probe agent + Docker image | 1.0 |
| Probe dispatcher + schedule engine | 1.0 |
| Result aggregation + alert evaluation | 1.0 |
| REST API endpoints | 0.5 |
| Panel UI (check config, results dashboard, probe map) | 1.5 |
| Integration + E2E tests | 0.5 |
| Documentation | 0.5 |
| **Total** | **7.5 PT (rounded to 6 with framework reuse)** |

### Risk Factors

- Minecraft protocol parsing may need library adaptation (use `mcstatus` Python library)
- Probe network deployment requires at least 3 cloud regions for meaningful multi-region coverage
- SSL check accuracy depends on proper SNI support and certificate chain validation
- DNS check reliability may vary by probe location's upstream resolver behavior

---

## 8. Key Metrics

| Metric | Target |
|--------|--------|
| Check execution frequency | Every 60s minimum, configurable per check |
| End-to-end result latency | < 5s from execution to API |
| Probe locations at launch | 7 (AWS regions + Hetzner) |
| Maximum checks per probe | 500 |
| Probe agent resource usage | < 256 MB RAM, < 0.5 CPU core |
| API throughput | 200 req/s for results ingestion |
