# Feature 38: Cost Allocation & Chargeback

- **Feature ID:** 38
- **Category:** Advanced Observability
- **Primary Service:** Integration Service
- **Effort:** Medium (4-6 PT)
- **Dependencies:** Feature 24 (Multi-Cloud Cost Optimizer), Feature 28 (Team Workspaces)

---

## 1. Overview

Implement a comprehensive cost allocation and chargeback system that enables organizations to track cloud infrastructure spending by team, project, customer, or any custom dimension. Supports both showback (informational) and chargeback (actual billing) models. Generate monthly PDF and CSV reports with per-tag cost breakdowns. Integrate with cloud provider billing APIs (AWS Cost Explorer, GCP Billing, Azure Cost Management) and reconcile against provisioned resource inventory.

### Goals

- Tag all resources (servers, databases, networks, storage) with metadata dimensions
- Pull cost data from cloud provider billing APIs and reconcile with inventory
- Compute per-tag cost breakdowns with support for hierarchy and aggregation
- Support showback (view-only) and chargeback (cross-charge) models
- Generate monthly chargeback reports in PDF and CSV formats
- Track budgets per tag dimension and alert on overspend
- Expose cost data via REST API for integration with external billing systems

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Data Sources                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ AWS Cost     │  │ GCP Billing  │  │ Azure Cost   │              │
│  │ Explorer     │  │ Export       │  │ Management   │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                        │
│  ┌──────▼─────────────────▼─────────────────▼───────┐              │
│  │           Cloud Billing Ingestion Layer            │              │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  │              │
│  │  │ AWS        │  │ GCP        │  │ Azure      │  │              │
│  │  │ Adapter    │  │ Adapter    │  │ Adapter    │  │              │
│  │  └────────────┘  └────────────┘  └────────────┘  │              │
│  └──────────────────────┬────────────────────────────┘              │
│                         │                                            │
│  ┌──────────────────────▼────────────────────────────┐              │
│  │              Integration Service                     │              │
│  │  ┌──────────────────┐  ┌────────────────────────┐  │              │
│  │  │ Tag Engine        │  │ Cost Allocation        │  │              │
│  │  │ - Tag propagation │  │ Engine                  │  │              │
│  │  │ - Tag validation  │  │ - Per-tag cost calc    │  │              │
│  │  │ - Auto-tagging    │  │ - Showback/chargeback  │  │              │
│  │  │ rules             │  │ - Amortization         │  │              │
│  │  └────────┬─────────┘  └───────────┬────────────┘  │              │
│  │           │                        │                │              │
│  │  ┌────────▼────────────────────────▼────────────┐  │              │
│  │  │              Reconciliation Engine            │  │              │
│  │  │  - Match billing line items to inventory     │  │              │
│  │  │  - Detect untagged resources                 │  │              │
│  │  │  - Flag cost anomalies                        │  │              │
│  │  └──────────────────────┬────────────────────────┘  │              │
│  └─────────────────────────┬───────────────────────────┘              │
│                            │                                          │
┌────────────────────────────┼──────────────────────────────────────────┐
│                    ┌───────▼────────┐                                 │
│                    │  Report Engine  │                                 │
│                    │  - PDF (HTML→  │                                 │
│                    │    WeasyPrint) │                                 │
│                    │  - CSV export  │                                 │
│                    │  - Schedule    │                                 │
│                    │    monthly     │                                 │
│                    └───────┬────────┘                                 │
│                            │                                          │
│  ┌─────────────────────────▼──────────────────────────────────────┐  │
│  │                     Storage Layer                                │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │  │
│  │  │ PostgreSQL   │  │ Redis Cache  │  │ Object Store        │  │  │
│  │  │ (tags, costs, │  │ (aggregated  │  │ (reports, invoices)  │  │  │
│  │  │  budgets)    │  │  cost views) │  │                      │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Tag Propagation Strategy

```
Cloud Provider Tag ──▶ Orchestrator Resource ──▶ Inventory Record
     applied at              inherits from              enriched with
   provisioning             parent resource              computed tags
       │                         │                           │
       ▼                         ▼                           ▼
  Team: "platform"          Team: "platform"          Team: "platform"
  Project: "infra"          Project: "infra"          Project: "infra"
  Env: "prod"               Env: "prod"               Env: "prod"
                                                        Cost Center: "eng-42"
                                                        Budget: "platform-prod"
```

### Showback vs Chargeback Models

| Feature | Showback | Chargeback |
|---------|----------|------------|
| Purpose | Awareness & accountability | Cross-charge between teams |
| Financial impact | Informational only | Actual invoice adjustment |
| Granularity | Per-team/project breakdown | Per-consumer with unit pricing |
| Approval needed | No | Yes (finance/admin) |
| Report type | Dashboard + CSV | Formal PDF invoice |
| Implementation | Computed costs displayed | Costs applied via credit/debit |

---

## 3. Data Model

### Cost Tag Definition

```yaml
cost_tag:
  id: "tag-team-platform"
  key: "team"
  value: "platform"
  description: "Platform engineering team"
  hierarchy:
    parent: null
    children:
      - "team-platform-infra"
      - "team-platform-sre"
  propagation: "inherited"       # inherited | explicit | computed
  compliance:
    required: true
    allowed_values:
      - "platform"
      - "games"
      - "business"
      - "internal"
  budget:
    monthly_limit: 5000.00
    currency: "USD"
    alert_thresholds:
      - at_percent: 80
        severity: "warning"
      - at_percent: 100
        severity: "critical"
```

### Resource Cost Allocation

```yaml
resource_cost:
  resource_id: "srv-web-01"
  resource_type: "server"
  provider: "aws"
  provider_resource_id: "i-0abcd1234efgh5678"
  period:
    start: "2026-05-01T00:00:00Z"
    end: "2026-05-31T23:59:59Z"
  line_items:
    - category: "compute"
      service: "EC2"
      usage_type: "t3.large"
      quantity: 744                       # hours
      unit: "Hrs"
      cost: 248.32
    - category: "storage"
      service: "EBS"
      usage_type: "gp3"
      quantity: 100                       # GB-months
      unit: "GB-Mo"
      cost: 8.00
    - category: "network"
      service: "DataTransfer"
      usage_type: "Out-Bytes"
      quantity: 50                        # GB
      unit: "GB"
      cost: 4.50
  total_cost: 260.82
  tags:
    team: "platform"
    project: "infra"
    environment: "production"
    cost_center: "cc-eng-42"
  allocation:
    method: "direct"                     # direct | proportional | prorated
    proportion: 1.0
```

### Budget & Chargeback Report

```yaml
chargeback_report:
  id: "cbr-2026-05"
  type: "monthly"
  period:
    start: "2026-05-01T00:00:00Z"
    end: "2026-05-31T23:59:59Z"
  generated_at: "2026-06-01T02:00:00Z"
  organization_id: "org-acme"
  model: "showback"                      # showback | chargeback
  currency: "USD"
  summary:
    total_cost: 45230.12
    total_untagged_cost: 1230.45
    tagged_percentage: 97.28
    budget_variance: -230.12             # negative = under budget
  breakdowns:
    by_team:
      - dimension: "team:platform"
        total: 18450.00
        percentage: 40.8
        servers: 23
        budget: 20000.00
        variance: -1550.00
      - dimension: "team:games"
        total: 12500.00
        percentage: 27.6
        servers: 18
        budget: 15000.00
        variance: -2500.00
      - dimension: "team:business"
        total: 13049.67
        percentage: 28.9
        servers: 12
        budget: 10000.00
        variance: 3049.67
    by_environment:
      - dimension: "env:production"
        total: 31200.00
        percentage: 69.0
      - dimension: "env:staging"
        total: 8540.12
        percentage: 18.9
      - dimension: "env:development"
        total: 5489.55
        percentage: 12.1
    by_service:
      - dimension: "service:compute"
        total: 28100.00
        percentage: 62.1
      - dimension: "service:storage"
        total: 9230.12
        percentage: 20.4
      - dimension: "service:network"
        total: 6400.00
        percentage: 14.2
      - dimension: "service:other"
        total: 1499.55
        percentage: 3.3
```

### Reconciliation Record

```yaml
reconciliation:
  id: "rec-2026-05"
  period: "2026-05"
  provider: "aws"
  billing_total: 45230.12
  inventory_total: 43999.67
  discrepancy: 1230.45
  discrepancy_percent: 2.72
  untagged_resources:
    - resource_id: "i-abcdef123456"
      resource_type: "ec2"
      estimated_cost: 89.50
      missing_tags: ["team", "project"]
  reconciled_at: "2026-06-01T01:30:00Z"
  status: "partial"                     # complete | partial | failed
```

---

## 4. API Design

### Tag Management

#### List Tags

```
GET /api/v2/cost/tags
  ?key=team
  &page=1
  &per_page=50
```

#### Create Tag Definition

```
POST /api/v2/cost/tags
```

```json
{
  "key": "cost_center",
  "value": "cc-eng-42",
  "description": "Engineering cost center code",
  "propagation": "inherited",
  "compliance": {
    "required": true,
    "allowed_values": ["cc-eng-42", "cc-games-01", "cc-business-07"]
  },
  "budget": {
    "monthly_limit": 20000.00,
    "currency": "USD",
    "alert_thresholds": [
      { "at_percent": 80, "severity": "warning" },
      { "at_percent": 100, "severity": "critical" }
    ]
  }
}
```

### Resource Costs

#### Get Resource Cost

```
GET /api/v2/cost/resources/{resource_id}/cost
  ?period=2026-05
```

#### List Resource Costs by Tag

```
GET /api/v2/cost/by-tag
  ?tag=team:platform
  &period=2026-05
  &granularity=daily
```

### Chargeback Reports

#### List Reports

```
GET /api/v2/cost/reports
  ?period=2026-05
  &type=showback
```

#### Generate Report

```
POST /api/v2/cost/reports/generate
```

```json
{
  "period": "2026-05",
  "type": "chargeback",
  "format": "pdf",
  "include_breakdowns": ["by_team", "by_environment", "by_service"],
  "tag_dimensions": ["team", "project", "environment"]
}
```

Response `202`:
```json
{
  "report_id": "cbr-2026-05",
  "status": "generating",
  "estimated_seconds": 30
}
```

#### Download Report

```
GET /api/v2/cost/reports/{report_id}/download
  ?format=pdf
```

### Budget Tracking

#### List Budgets

```
GET /api/v2/cost/budgets
```

#### Get Budget Status

```
GET /api/v2/cost/budgets/{tag_id}
```

```json
{
  "tag_id": "tag-team-platform",
  "monthly_limit": 20000.00,
  "current_spend": 18450.00,
  "remaining": 1550.00,
  "utilization_percent": 92.25,
  "status": "warning",
  "forecast_spend": 19500.00,
  "days_remaining_in_period": 5,
  "alerts_triggered": [
    {
      "threshold": 80,
      "triggered_at": "2026-05-20T14:30:00Z",
      "spend_at_trigger": 16050.00
    }
  ]
}
```

### Reconciliation

#### Run Reconciliation

```
POST /api/v2/cost/reconciliation/run
```

```json
{
  "period": "2026-05",
  "providers": ["aws", "gcp"]
}
```

#### List Reconciliations

```
GET /api/v2/cost/reconciliation
  ?period=2026-05
  &status=partial
```

---

## 5. Implementation Plan

### Phase 1: Tag Engine & Cost Ingestion (PT 1-2)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 1.1 | Tag CRUD endpoints, validation, propagation rules | `models/cost_tags.py`, `routes/cost.py` |
| 1.2 | Cloud billing adapters: AWS Cost Explorer SDK | `adapters/aws_billing.py` |
| 1.3 | Cloud billing adapters: GCP Billing + Azure Cost Mgmt | `adapters/gcp_billing.py`, `adapters/azure_billing.py` |
| 1.4 | Inventory-to-billing reconciliation engine | `services/reconciliation.py` |

### Phase 2: Cost Allocation Engine (PT 3-4)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 2.1 | Per-tag cost calculation with hierarchy support | `services/cost_allocation.py` |
| 2.2 | Showback vs chargeback models + budget tracking | `services/budget_tracker.py` |
| 2.3 | REST API: cost queries, budgets, reports | `routes/cost.py` (extend) |
| 2.4 | Unit tests for tag propagation and cost math | `tests/test_cost_allocation.py` |

### Phase 3: Reporting & Panel UI (PT 5-6)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 3.1 | PDF report generator with charts and tables | `services/report_generator.py` |
| 3.2 | CSV export for raw cost data | `services/csv_exporter.py` |
| 3.3 | Panel UI: cost dashboard, tag explorer, budget gauges | Panel components |
| 3.4 | Panel UI: report viewer, reconciliation summary | Panel components |

---

## 6. Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Integration Service** (primary) | Tag management, cloud billing ingestion, cost allocation engine, reconciliation, budget tracking, report generation, REST API |
| **Management Panel** | Cost dashboard, tag management UI, budget gauge widgets, report viewer/download, untagged resources view |
| **Orchestrator Agent** | Tag propagation to provisioned resources, tag input during server create/update workflows |
| **Discord Service** | Budget overspend alerts, monthly cost summary notifications |

---

## 7. Effort Estimate: Medium (4-6 PT)

| Area | PT Estimate |
|------|-------------|
| Tag engine (CRUD, validation, propagation) | 1.0 |
| Cloud billing adapters (AWS, GCP, Azure) | 1.5 |
| Reconciliation engine | 0.5 |
| Cost allocation engine (per-tag calc, showback/chargeback) | 1.0 |
| Budget tracking + alerts | 0.5 |
| Report generation (PDF + CSV) | 0.5 |
| REST API endpoints | 0.5 |
| Panel UI (dashboard, tag explorer, reports) | 1.5 |
| Integration + E2E tests | 0.5 |
| Documentation | 0.5 |
| **Total** | **8.0 PT (rounded to 6 with billing SDK reuse)** |

### Risk Factors

- Cloud billing APIs have different data freshness SLAs (AWS ~24h, GCP ~48h, Azure ~24h)
- Currency conversion and amortization (RI/SP) adds complexity for multi-provider setups
- Tag propagation lag: cloud tags applied at provisioning may take hours to appear in billing data
- PDF report formatting is time-consuming to get right across different page sizes/locales

---

## 8. Key Metrics

| Metric | Target |
|--------|--------|
| Cost data freshness | < 24h from cloud provider cut-off |
| Reconciliation accuracy | > 99% match between billing and inventory |
| Report generation time | < 30s per monthly report |
| Supported tag dimensions | Unlimited (key-value pairs) |
| API throughput | 100 req/s for cost queries |
| Max resources tracked | 50,000 per organization |
