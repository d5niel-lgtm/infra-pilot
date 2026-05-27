# Feature 24: Multi-Cloud Cost Optimizer

| Metadata | Value |
|----------|-------|
| Feature ID | 24 |
| Feature Name | Multi-Cloud Cost Optimizer |
| Primary Service | Orchestrator Agent |
| Effort Estimate | Medium (4–6 PT) |
| Status | Planned |

---

## 1. Overview

A cost intelligence engine that continuously profiles infrastructure workloads and compares pricing across AWS, GCP, Azure, and Hetzner. It delivers actionable migration recommendations — which region, which provider, and which reserved/pay-as-you-go mix minimizes spend — and tracks realized savings over time.

### Goals

- Reduce cloud spend by 15–40% via intelligent cross-provider arbitration
- Provide a single pane of glass for multi-cloud pricing comparison
- Automate workload right-sizing recommendations
- Track savings with auditable before/after reports
- Support spot/preemptible instance recommendations where applicable

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Panel (UI)                                │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────────┐  │
│  │ Cost Dashboard│  │ Recommendation │  │ Savings Tracker      │  │
│  │ (per-project) │  │ Explorer       │  │ (before/after)       │  │
│  └──────┬───────┘  └───────┬────────┘  └──────────┬───────────┘  │
└─────────┼──────────────────┼──────────────────────┼──────────────┘
          │                  │                      │
          ▼                  ▼                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Orchestrator Agent                            │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │                 Workload Profiler                          │   │
│  │  ┌────────────┐ ┌───────────┐ ┌──────────┐ ┌──────────┐  │   │
│  │  │ Inventory  │ │ Usage     │ │ Tagging  │ │ Reserved │  │   │
│  │  │ Collector  │ │ Analyzer  │ │ Enforcer │ │ Instance │  │   │
│  │  │            │ │           │ │          │ │ Planner  │  │   │
│  │  └─────┬──────┘ └─────┬─────┘ └────┬─────┘ └────┬─────┘  │   │
│  └────────┼──────────────┼────────────┼────────────┼─────────┘   │
│           │              │            │            │              │
│  ┌────────▼──────────────▼────────────▼────────────▼─────────┐   │
│  │                  Cost Comparison Engine                    │   │
│  │  ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │   │
│  │  │ Price      │ │ Instance │ │ Storage  │ │ Data     │   │   │
│  │  │ Scraper    │ │ Matcher  │ │ Cost     │ │ Transfer │   │   │
│  │  │            │ │          │ │ Analyzer │ │ Estimator│   │   │
│  │  └─────┬──────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘   │   │
│  └────────┼─────────────┼────────────┼────────────┼──────────┘   │
└───────────┼─────────────┼────────────┼────────────┼──────────────┘
            │             │            │            │
            ▼             ▼            ▼            ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌────────────┐
│ AWS       │ │ GCP       │ │ Azure     │ │ Hetzner    │
│ Pricing   │ │ Pricing   │ │ Pricing   │ │ Pricing    │
│ API       │ │ API       │ │ API       │ │ API        │
└───────────┘ └───────────┘ └───────────┘ └────────────┘
```

### Component Responsibilities

| Component | Role |
|-----------|------|
| Orchestrator Agent (Core) | Workload profiling, price comparison, recommendation engine |
| Inventory Collector | Pulls running resources from each cloud provider via their APIs |
| Usage Analyzer | Reads CloudWatch/Stackdriver/Azure Monitor metrics for CPU, RAM, network |
| Price Scraper | Fetches on-demand, reserved, and spot pricing from provider APIs |
| Instance Matcher | Maps cross-provider instance families by vCPU, RAM, network, GPU |
| Cost Comparison Engine | Computes total monthly cost per provider for a given workload |
| Savings Tracker | Stores baseline costs and compares after migration |

---

## 3. Data Model

### `cloud_providers`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR | e.g. "aws", "gcp", "azure", "hetzner" |
| display_name | VARCHAR | |
| enabled | BOOLEAN | |
| pricing_api_config | JSONB | Endpoint URLs, API keys (encrypted) |

### `inventory_resources`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| provider_id | UUID | FK → cloud_providers.id |
| environment_id | UUID | FK → environments.id |
| resource_type | VARCHAR | "compute", "storage", "database", "network" |
| provider_resource_id | VARCHAR | Original resource ID from provider |
| region | VARCHAR | |
| instance_type | VARCHAR | e.g. "t3.medium", "e2-standard-2" |
| specs | JSONB | vCPU, RAM GB, GPU, network throughput |
| tags | JSONB | User-defined tags |
| status | VARCHAR | running, stopped, terminated |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `usage_metrics`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| resource_id | UUID | FK → inventory_resources.id |
| timestamp | TIMESTAMPTZ | |
| cpu_avg_pct | FLOAT | |
| cpu_max_pct | FLOAT | |
| memory_avg_pct | FLOAT | |
| memory_max_pct | FLOAT | |
| network_in_bytes | BIGINT | |
| network_out_bytes | BIGINT | |
| disk_read_bytes | BIGINT | |
| disk_write_bytes | BIGINT | |

### `price_catalog`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| provider | VARCHAR | |
| region | VARCHAR | |
| instance_type | VARCHAR | |
| pricing_model | ENUM | on_demand, reserved_1y, reserved_3y, spot |
| unit | VARCHAR | "hour", "month" |
| price | DECIMAL(10,6) | |
| effective_date | DATE | |
| created_at | TIMESTAMPTZ | |

### `cost_recommendations`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| environment_id | UUID | FK → environments.id |
| resource_id | UUID | FK → inventory_resources.id |
| current_provider | VARCHAR | |
| current_cost_monthly | DECIMAL(10,2) | |
| target_provider | VARCHAR | |
| target_region | VARCHAR | |
| target_instance_type | VARCHAR | |
| target_cost_monthly | DECIMAL(10,2) | |
| estimated_savings_pct | FLOAT | |
| savings_monthly | DECIMAL(10,2) | |
| migration_effort | ENUM | low, medium, high |
| confidence | FLOAT | 0.0 – 1.0 |
| status | ENUM | pending, applied, dismissed, expired |
| created_at | TIMESTAMPTZ | |
| applied_at | TIMESTAMPTZ | |

### `savings_reports`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| environment_id | UUID | FK → environments.id |
| report_month | DATE | First day of the month |
| baseline_cost | DECIMAL(10,2) | Cost before any recommendations |
| actual_cost | DECIMAL(10,2) | Cost after applying recommendations |
| savings_amount | DECIMAL(10,2) | |
| savings_pct | FLOAT | |
| details | JSONB | Breakdown by resource / provider |
| created_at | TIMESTAMPTZ | |

---

## 4. API Design

### Workload Inventory

```
GET    /api/v2/cost/inventory                    — List all inventoried resources
GET    /api/v2/cost/inventory/:id                — Get resource details + usage profile
PUT    /api/v2/cost/inventory/:id/tags           — Update resource tags
POST   /api/v2/cost/inventory/refresh            — Trigger full inventory resync
```

### Pricing & Comparison

```
GET    /api/v2/cost/prices                       — List price catalog (filterable by provider/region/type)
GET    /api/v2/cost/compare                      — Compare pricing for a given workload spec
POST   /api/v2/cost/compare/batch                — Batch comparison for multiple resources
```

Query parameters for `GET /api/v2/cost/compare`:

| Param | Type | Description |
|-------|------|-------------|
| vcpu | int | Number of vCPUs |
| memory_gb | int | RAM in GB |
| gpu | string | GPU type (optional) |
| region | string | Current region (optional, for filtering) |
| providers | string | Comma-separated list of providers to compare |
| pricing_model | string | on_demand, reserved, spot |

### Recommendations

```
GET    /api/v2/cost/recommendations              — List all recommendations
GET    /api/v2/cost/recommendations/:id          — Get recommendation details
POST   /api/v2/cost/recommendations/:id/apply    — Mark as applied / trigger migration
POST   /api/v2/cost/recommendations/:id/dismiss  — Dismiss recommendation
POST   /api/v2/cost/recommendations/generate     — Run full recommendation engine
```

### Savings Tracking

```
GET    /api/v2/cost/savings                      — Monthly savings summary
GET    /api/v2/cost/savings/:year/:month         — Detailed report for a specific month
GET    /api/v2/cost/savings/trend                 — Savings over time (JSON time-series)
```

---

## 5. Implementation Plan

### Phase 1 — Provider Pricing Integration (1.5 PT)

1. Implement `PriceScraper` with adapters for each provider's pricing API:
   - **AWS**: `pricing.<region>.amazonaws.com` — SKU-based, SAX-parsed
   - **GCP**: Cloud Billing Catalog API
   - **Azure**: Retail Prices API
   - **Hetzner**: JSON pricing endpoint
2. Build `price_catalog` table and periodic sync job (daily)
3. Implement `InstanceMatcher` — normalizes instance families across providers

### Phase 2 — Workload Profiling (1.5 PT)

1. `InventoryCollector` — pulls running resources from each provider's compute API
2. `UsageAnalyzer` — fetches metrics (CPU, RAM, network) from monitoring APIs
3. Build `usage_metrics` aggregation pipeline (hourly → daily → monthly rollup)
4. Profile tagging and right-sizing analysis (over-provisioned detection)

### Phase 3 — Cost Comparison Engine (1 PT)

1. Implement comparison algorithm:
   - Match workload profile → candidate instances per provider
   - Compute total cost: compute + storage + data transfer + license
   - Apply discount factors (reserved, committed use, spot)
   - Score by cost, region proximity, and migration effort
2. Build `/cost/compare` and `/cost/compare/batch` endpoints

### Phase 4 — Recommendations & Savings Tracking (1 PT)

1. Build recommendation generator — scheduled + on-demand
2. Implement confidence scoring based on usage stability
3. Build savings reports — monthly baseline vs. actual
4. Email/digest notifications for new high-savings opportunities

### Phase 5 — UI & Polish (0.5–1 PT)

1. Cost dashboard with provider breakdown
2. Recommendation explorer with apply/dismiss workflow
3. Savings tracker with trend chart
4. Export to CSV/PDF for procurement reviews

---

## 6. Configuration Examples

### Workload Spec for Comparison (POST /api/v2/cost/compare/batch)

```json
{
  "resources": [
    {
      "name": "web-server-group",
      "vcpu": 4,
      "memory_gb": 16,
      "gpu": null,
      "storage_gb": 100,
      "storage_type": "ssd",
      "monthly_network_egress_gb": 500,
      "current_provider": "aws",
      "current_region": "us-east-1",
      "current_instance": "t3.xlarge",
      "pricing_models": ["on_demand", "reserved_1y", "spot"],
      "min_uptime_pct": 99.5
    }
  ],
  "target_providers": ["aws", "gcp", "azure", "hetzner"],
  "target_regions": ["us-east-1", "us-central1", "eastus", "nbg1-dc1"]
}
```

### Response Excerpt

```json
{
  "comparisons": [
    {
      "resource": "web-server-group",
      "current": {
        "provider": "aws",
        "region": "us-east-1",
        "instance": "t3.xlarge",
        "monthly_cost": 216.32
      },
      "alternatives": [
        {
          "provider": "gcp",
          "region": "us-central1",
          "instance": "e2-standard-4",
          "monthly_cost": 152.18,
          "savings_pct": 29.7,
          "effort": "low"
        },
        {
          "provider": "hetzner",
          "region": "nbg1-dc1",
          "instance": "CX51",
          "monthly_cost": 89.46,
          "savings_pct": 58.6,
          "effort": "medium"
        }
      ]
    }
  ]
}
```

### Recommendation Generation (POST /api/v2/cost/recommendations/generate)

```json
{
  "environments": ["env-001", "env-002"],
  "min_savings_pct": 10,
  "excluded_providers": [],
  "include_spot": true,
  "max_recommendations": 50
}
```

---

## 7. Service Assignments

| Service | Responsibilities |
|---------|------------------|
| **Orchestrator Agent** | Core: workload profiler, price scraper, instance matcher, comparison engine, recommendation generator, savings tracker |
| **Integration Service** | Provider-specific pricing API clients, inventory collectors |
| **Panel** | Cost dashboard, recommendation explorer, savings reports |
| **Database** | `price_catalog`, `usage_metrics`, `cost_recommendations`, `savings_reports` |
| **Scheduler** | Daily price sync, hourly usage collection, weekly recommendation generation |

---

## 8. Effort Breakdown

| Task | PT | Dependencies |
|------|----|-------------|
| `PriceScraper` base + AWS adapter | 0.5 | — |
| `PriceScraper` GCP adapter | 0.25 | Base scraper |
| `PriceScraper` Azure adapter | 0.25 | Base scraper |
| `PriceScraper` Hetzner adapter | 0.25 | Base scraper |
| `InstanceMatcher` + normalization table | 0.5 | — |
| `InventoryCollector` + `UsageAnalyzer` | 1.0 | Provider read APIs |
| Cost comparison algorithm | 1.0 | Matcher + prices |
| Recommendation generator | 0.5 | Comparison engine |
| Savings tracker + monthly reports | 0.5 | Recommendations |
| UI (dashboard, explorer, savings) | 1.0 | All APIs |
| Documentation & tests | 0.5 | — |

---

## 9. Instance Matching Table (Normalization)

| Category | AWS | GCP | Azure | Hetzner |
|----------|-----|-----|-------|---------|
| 2 vCPU / 8 GB | t3.large | e2-standard-2 | D2s v3 | CX42 |
| 4 vCPU / 16 GB | t3.xlarge | e2-standard-4 | D4s v3 | CX52 |
| 8 vCPU / 32 GB | t3.2xlarge | e2-standard-8 | D8s v3 | CX62 |
| 16 vCPU / 64 GB | m5.4xlarge | e2-standard-16 | D16s v3 | — |

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Pricing API becomes stale | Stale recommendations, over/under-estimated savings | Daily sync + freshness indicator on price records |
| Reserved instance math is complex | Inaccurate comparisons for RIs | Model RI as upfront + hourly; use provider SDKs for accurate amortization |
| Data transfer costs vary wildly | Wrong total cost estimation | Include egress pricing in comparison; flag when egress > 50% of total |
| Hetzner lacks equivalent GPU instances | Gaps in recommendation for ML workloads | Graceful degradation — exclude providers without matching SKUs |
