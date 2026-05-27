# Feature 36: SLA / SLO Tracking

- **Feature ID:** 36
- **Category:** Advanced Observability
- **Primary Service:** Integration Service
- **Effort:** Medium (4-6 PT)
- **Dependencies:** Feature 34 (Distributed Tracing), Feature 17 (OpenTelemetry Export)

---

## 1. Overview

Define, measure, and report Service Level Agreements (SLAs) and Service Level Objectives (SLOs) for infrastructure resources. Track uptime, response time, backup success rate, and other custom SLIs. Compute error budgets in real time, fire burn rate alerts when budgets deplete faster than planned, and generate compliance reports for internal or external auditing.

### Goals

- Allow operators to define SLOs per server, service, or team workspace
- Collect SLI measurements from existing monitoring pipelines (Prometheus, OpenTelemetry)
- Compute real-time error budgets with configurable burn rate thresholds
- Alert when error budget consumption exceeds safe limits
- Generate monthly compliance reports (PDF/CSV) for auditor review

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Consumers                       │
│  Management Panel  │  Discord Bot  │  API Clients  │  Webhooks  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     Integration Service                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  SLO Definition  │  │  SLI Collector   │  │  Error Budget   │ │
│  │  Manager         │  │  Engine          │  │  Calculator     │ │
│  │  - CRUD SLOs     │  │  - Query SLIs    │  │  - Remaining %  │ │
│  │  - Target %      │  │  - Windows: 7/30 │  │  - Burn rate    │ │
│  │  - Windows       │  │  - Data source    │  │  - Forecast     │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬────────┘ │
│           │                     │                      │          │
│  ┌────────▼─────────────────────▼──────────────────────▼────────┐ │
│  │                     SLO Engine Core                          │ │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐  │ │
│  │  │ MultiWindow │ │ Burn Rate    │ │ Compliance Report    │  │ │
│  │  │ Evaluator   │ │ Detector     │ │ Generator            │  │ │
│  │  └─────────────┘ └──────────────┘ └──────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     Data Sources                                  │
│  ┌──────────────┐  ┌──────────────────┐  ┌────────────────────┐ │
│  │ Prometheus    │  │ OpenTelemetry    │  │ Backup Service     │ │
│  │ (uptime, cpu) │  │ (latency, errors)│  │ (success rate)     │ │
│  └──────────────┘  └──────────────────┘  └────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Service | Role |
|-----------|---------|------|
| SLO Definition Manager | Integration Service | CRUD for SLO targets, windows, alert thresholds |
| SLI Collector Engine | Integration Service | Pull metrics from data sources, compute SLI ratios |
| Error Budget Calculator | Integration Service | Track remaining budget, burn rate, days to depletion |
| Compliance Report Generator | Integration Service | Monthly PDF/CSV reports, audit trail |
| Alert Manager | Integration Service | Route burn rate alerts to notification channels |

---

## 3. Data Model

### SLO Definition

```yaml
slo:
  id: "slo-uptime-web-prod"
  name: "Web Production Uptime"
  description: "Uptime SLO for production web servers"
  target:
    value: 99.9
    unit: "%"
  window:
    type: "rolling"          # rolling | calendar_month
    duration_days: 30
  sli:
    source: "prometheus"
    query: "up{job='web-prod',env='production'}"
    type: "good_bad"         # good_bad | ratio | latency_bucket
    good_condition: "value == 1"
  error_budget:
    initial_ttd_days: 30
    burn_rate_alerts:
      - severity: "warning"
        threshold: 2.0       # 2x burn rate = warning
        window_minutes: 60
      - severity: "critical"
        threshold: 5.0       # 5x burn rate = critical
        window_minutes: 30
  labels:
    team: "platform"
    environment: "production"
    service: "web"
```

### SLI Measurement

```yaml
sli_measurement:
  id: "sli-1745712000-srv-001"
  slo_id: "slo-uptime-web-prod"
  timestamp: 1745712000
  window_start: 1745712000
  window_end: 1745798400
  total_events: 86400
  good_events: 86350
  bad_events: 50
  sli_value: 99.942
  source_query: "up{job='web-prod',env='production'}"
```

### Error Budget Snapshot

```yaml
error_budget:
  slo_id: "slo-uptime-web-prod"
  snapshot_at: 1745712000
  total_budget_seconds: 2592000       # 30 days
  consumed_seconds: 43200              # 12 hours downtime
  remaining_seconds: 2548800
  remaining_percent: 98.33
  burn_rate_1h: 0.45                   # 1-hour burn rate
  burn_rate_24h: 0.62                  # 24-hour burn rate
  estimated_depletion_days: 85
  status: "healthy"                    # healthy | warning | critical | exhausted
```

### Compliance Report

```yaml
compliance_report:
  id: "cr-2026-05"
  period:
    start: "2026-05-01T00:00:00Z"
    end: "2026-05-31T23:59:59Z"
  generated_at: "2026-06-01T01:00:00Z"
  organization_id: "org-acme"
  slos:
    - slo_id: "slo-uptime-web-prod"
      target: 99.9
      achieved: 99.94
      status: "met"
      error_budget_remaining: 83.4
      outages:
        - date: "2026-05-12"
          duration_minutes: 14
          reason: "DNS propagation delay"
    - slo_id: "slo-response-api"
      target: 99.5
      achieved: 99.72
      status: "met"
      error_budget_remaining: 67.8
```

---

## 4. API Design

### SLO Definitions

#### List SLOs

```
GET /api/v2/slos
  ?status=active
  &team=platform
  &environment=production
  &page=1
  &per_page=50
```

Response:
```json
{
  "slos": [
    {
      "id": "slo-uptime-web-prod",
      "name": "Web Production Uptime",
      "target": 99.9,
      "current_sli": 99.94,
      "error_budget_remaining": 83.4,
      "status": "healthy"
    }
  ],
  "total": 12,
  "page": 1
}
```

#### Create SLO

```
POST /api/v2/slos
```

```json
{
  "name": "Web Production Uptime",
  "description": "Uptime SLO for production web servers",
  "target": 99.9,
  "window_days": 30,
  "sli": {
    "source": "prometheus",
    "query": "up{job='web-prod',env='production'}",
    "type": "good_bad",
    "good_condition": "value == 1"
  },
  "error_budget": {
    "burn_rate_alerts": [
      { "severity": "warning", "threshold": 2.0, "window_minutes": 60 },
      { "severity": "critical", "threshold": 5.0, "window_minutes": 30 }
    ]
  },
  "labels": {
    "team": "platform",
    "environment": "production"
  }
}
```

Response `201`:
```json
{
  "id": "slo-uptime-web-prod",
  "status": "active",
  "created_at": "2026-05-01T00:00:00Z"
}
```

#### Get SLO Details

```
GET /api/v2/slos/{slo_id}
```

#### Update SLO

```
PATCH /api/v2/slos/{slo_id}
```

#### Delete SLO

```
DELETE /api/v2/slos/{slo_id}
```

### Error Budget

#### Get Error Budget

```
GET /api/v2/slos/{slo_id}/error-budget
```

```json
{
  "slo_id": "slo-uptime-web-prod",
  "total_budget_seconds": 2592000,
  "consumed_seconds": 43200,
  "remaining_seconds": 2548800,
  "remaining_percent": 98.33,
  "burn_rate_1h": 0.45,
  "burn_rate_24h": 0.62,
  "estimated_depletion_days": 85,
  "status": "healthy"
}
```

#### Get Burn Rate History

```
GET /api/v2/slos/{slo_id}/burn-rate
  ?window=7d
  &granularity=1h
```

### Compliance Reports

#### List Reports

```
GET /api/v2/compliance-reports
  ?period=2026-05
  &format=json
```

#### Generate Report

```
POST /api/v2/compliance-reports/generate
```

```json
{
  "period": "2026-05",
  "format": "pdf",
  "include_details": true,
  "slos": ["slo-uptime-web-prod", "slo-response-api"]
}
```

Response `202`:
```json
{
  "report_id": "cr-2026-05",
  "status": "generating",
  "estimated_seconds": 15
}
```

#### Download Report

```
GET /api/v2/compliance-reports/{report_id}/download
  ?format=pdf
```

### SLI Data

#### Query SLI Raw Data

```
GET /api/v2/slos/{slo_id}/sli-data
  ?start=2026-05-01T00:00:00Z
  &end=2026-05-31T23:59:59Z
  &granularity=1h
```

---

## 5. Implementation Plan

### Phase 1: Core SLO Engine (PT 1-2)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 1.1 | SLO CRUD endpoints and database schema | `models/slo.py`, `routes/slos.py` |
| 1.2 | SLI collector: Prometheus query adapter | `services/sli_collector.py` |
| 1.3 | Error budget calculator with multi-window evaluation | `services/error_budget.py` |
| 1.4 | Unit tests for budget math and burn rate detection | `tests/test_error_budget.py` |

### Phase 2: Alerting & Reporting (PT 3-4)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 2.1 | Burn rate alert evaluator + notification dispatch | `services/burn_rate_detector.py` |
| 2.2 | Compliance report generation (PDF via WeasyPrint, CSV) | `services/report_generator.py` |
| 2.3 | REST API endpoints for reports and SLI queries | `routes/compliance.py` |
| 2.4 | Integration tests with mock Prometheus data | `tests/test_compliance.py` |

### Phase 3: Panel UI & Polish (PT 5-6)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 3.1 | SLO dashboard panel: list, detail, burn rate chart | Panel components |
| 3.2 | SLO creation/edit form with SLI query builder | Panel components |
| 3.3 | Compliance report viewer/download page | Panel components |
| 3.4 | WebSocket live updates for error budget changes | Event stream |

---

## 6. Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Integration Service** (primary) | SLO CRUD, SLI collection, error budget calculation, burn rate detection, compliance report generation, REST API |
| **Management Panel** | SLO dashboard, creation forms, burn rate charts, report viewer/download |
| **Discord Service** | Burn rate alert notifications via Discord embed |
| **Orchestrator Agent** | Provide SLI source data (uptime stats, response time metrics) |

---

## 7. Effort Estimate: Medium (4-6 PT)

| Area | PT Estimate |
|------|-------------|
| SLO definition CRUD + DB schema | 1.0 |
| SLI collector engine + Prometheus adapter | 1.0 |
| Error budget calculator + burn rate detection | 1.5 |
| Compliance report generator | 1.0 |
| REST API endpoints | 0.5 |
| Panel UI (dashboard, forms, reports) | 1.0 |
| Integration + E2E tests | 0.5 |
| Documentation | 0.5 |
| **Total** | **6.0 PT** |

### Risk Factors

- Prometheus query language complexity for custom SLIs may require additional iteration
- Burn rate alert tuning (threshold calibration) needs production data feedback loop
- PDF generation for compliance reports may require extra effort for branded templates

---

## 8. Key Metrics

| Metric | Target |
|--------|--------|
| SLI evaluation latency | < 30s from metric ingestion |
| Error budget calculation interval | Every 60s |
| Compliance report generation | < 30s per report |
| Supported SLOs per organization | Unlimited (paginated API) |
| API throughput | 100 req/s per SLO endpoint |
