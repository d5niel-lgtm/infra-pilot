# Feature 10: AI Capacity Forecaster

| Field | Value |
|-------|-------|
| **ID** | F-010 |
| **Name** | AI Capacity Forecaster |
| **Category** | AI & Intelligence |
| **Primary Service** | Orchestrator Agent |
| **Effort** | Medium (4-6 PT) |
| **Dependencies** | Feature 2 (AI Resource Optimizer), Feature 1 (AI Log Anomaly Detector) |
| **Phase** | Phase 1 |

---

## Overview

The AI Capacity Forecaster analyzes historical resource usage data (CPU, RAM, disk, network, player counts) across all managed servers to predict future capacity needs at 30, 60, and 90 day horizons. It identifies growth trends, seasonal patterns, and imminent resource exhaustion, then proactively recommends provisioning additional resources or rightsizing existing allocations before performance is impacted.

### Goals

- Predict resource exhaustion events ≥7 days in advance with 90%+ precision
- Forecast capacity needs at 30/60/90 day horizons per server and per account
- Recommend provisioning actions with cost-benefit analysis
- Reduce out-of-capacity incidents by 70%

### Non-Goals

- Not a real-time autoscaler (recommendations require approval)
- Does not automatically provision cloud resources
- Not a billing or cost management tool (though informs cost planning)
- Does not replace existing monitoring alerts

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Data Sources                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Metrics DB   │  │ Usage        │  │ Player Count │  │ Billing      │ │
│  │ (Timescale)  │  │ History      │  │ History      │  │ History      │ │
│  │ CPU/RAM/Disk │  │ (Daily rolls)│  │ (Hourly)     │  │ (Monthly)    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
└─────────┼─────────────────┼─────────────────┼─────────────────┼──────────┘
          │                 │                 │                 │
          ▼                 ▼                 ▼                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      Orchestrator Agent (Primary)                          │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │                     Data Aggregation Layer                       │        │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │        │
│  │  │ Metrics        │  │ Anomaly        │  │ Seasonality    │    │        │
│  │  │ Collector      │  │ Detector       │  │ Extractor      │    │        │
│  │  │ (pull from TSDB)│  │ (outliers,     │  │ (daily, weekly,│    │        │
│  │  │                │  │  gaps, spikes) │  │  monthly)      │    │        │
│  │  └────────────────┘  └────────────────┘  └────────────────┘    │        │
│  └──────────────────────────────────────────────────────────────┘        │
│                              │                                            │
│                              ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │                      Forecasting Engine                          │        │
│  │                                                              │        │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │        │
│  │  │ Statistical      │  │ ML Model         │  │ Ensemble   │  │        │
│  │  │ Models           │  │ (Prophet /        │  │ Combiner   │  │        │
│  │  │                  │  │  NeuralProphet)   │  │            │  │        │
│  │  │ • ARIMA          │  │                  │  │ • Weighted │  │        │
│  │  │ • Exponential    │  │ • Multi-variate  │  │   average  │  │        │
│  │  │   Smoothing      │  │ • Holiday effects│  │ • Variance │  │        │
│  │  │ • Linear Trend   │  │ • Growth curve   │  │   analysis │  │        │
│  │  └──────────────────┘  └──────────────────┘  └────────────┘  │        │
│  └──────────────────────────────────────────────────────────────┘        │
│                              │                                            │
│                              ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │                  Analysis & Recommendation Layer                 │        │
│  │                                                              │        │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────┐  │        │
│  │  │ Resource         │  │ Exhaustion       │  │ Cost       │  │        │
│  │  │ Threshold        │  │ Detector         │  │ Analyzer   │  │        │
│  │  │ Analyzer         │  │                  │  │            │  │        │
│  │  │ • Current vs     │  │ • Days until     │  │ • Current  │  │        │
│  │  │   forecast       │  │   OOM             │  │   cost    │  │        │
│  │  │ • Per-resource   │  │ • Disk full date │  │ • Upgrade │  │        │
│  │  │   breakdown      │  │ • Network sat    │  │   cost    │  │        │
│  │  │ • Growth rate    │  │ • Player cap hit │  │ • Savings │  │        │
│  │  └──────────────────┘  └──────────────────┘  └────────────┘  │        │
│  └──────────────────────────────────────────────────────────────┘        │
│                              │                                            │
│                              ▼                                            │
│  ┌──────────────────────────────────────────────────────────────┐        │
│  │                     Provisioning Planner                          │        │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │        │
│  │  │ Recommendation │  │ Action Plan    │  │ Schedule       │    │        │
│  │  │ Generator      │  │ Builder        │  │ Optimizer      │    │        │
│  │  │ • Upgrade plan  │  │ • Step-by-step │  │ • Best time    │    │        │
│  │  │ • Downgrade    │  │ • Approvals    │  │ • Maintenance  │    │        │
│  │  │ • Add node     │  │ • Rollback     │  │   window aware │    │        │
│  │  └────────────────┘  └────────────────┘  └────────────────┘    │        │
│  └──────────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                       Management Panel (UI)                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Forecast     │  │ Capacity     │  │ Timeline     │  │ Recommend-   │ │
│  │ Dashboard    │  │ Heatmap      │  │ View         │  │ ations Panel │ │
│  │ • 30/60/90   │  │ • Per-server │  │ • Historical │  │ • Ranked     │ │
│  │ • Per-server │  │ • Per-account │  │ • Predicted  │  │ • Cost-benefit│ │
│  │ • Account    │  │ • Per-region │  │ • Overlay    │  │ • One-click  │ │
│  │   summary    │  │              │  │              │  │   apply      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Metrics │───▶│ Clean & │───▶│ Forecast│───▶│ Analyze │───▶│ Recommend│
│ (90d+)  │    │ Resample│    │ (3 models) │    │ (thresholds)  │ (actions)│
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
     │              │              │              │              │
     ▼              ▼              ▼              ▼              ▼
  TimescaleDB    Preprocess     Prophet +     Rule Engine     Notifications
                  Pipeline       ARIMA +       Checks         + UI Update
                                ES Model
```

---

## Implementation Plan

### Phase 1: Data Collection & Aggregation (Week 1, 1.5 PT)

1. **Metrics Collector**
   - Pull CPU, RAM, disk, network I/O metrics from TimescaleDB (90+ day window)
   - Player count history from Minecraft query logs
   - Swap usage, disk I/O wait, OOM killer events
   - Configurable resolution: 1-hour → 1-day aggregation rollups

2. **Data Quality Pipeline**
   - Gap filling (linear interpolation for <6h gaps)
   - Anomaly removal (1-time spikes, maintenance windows, backup spikes)
   - Stationarity tests (Augmented Dickey-Fuller)
   - Seasonal decomposition (STL: Seasonal, Trend, Residual)

3. **Aggregation Views**
   - Pre-computed daily/hourly rollups per server
   - Account-level rollups (sum of all servers)
   - Group/label rollups (e.g., "production", "staging")

### Phase 2: Forecasting Engine (Week 1-3, 2.5 PT)

1. **Statistical Models**
   - **ARIMA**: AutoRegressive Integrated Moving Average
     - Auto-search (p,d,q) parameters via AIC minimization
     - Best for: linear trends, stable seasonality
   - **Exponential Smoothing**: Holt-Winters
     - Best for: clear seasonal patterns
   - **Linear Regression**: Simple trend + seasonal dummies
     - Best for: continuous growth with additive seasonality

2. **ML Models**
   - **Prophet** (Meta): Handles holidays, changepoints, outliers
   - **NeuralProphet**: Deep learning extension with auto-regression
   - **LightGBM** (future): Multi-variate with external regressors

3. **Ensemble Strategy**
   - Weighted average of top-3 models (weights based on recent accuracy)
   - Confidence intervals: 80% and 95% prediction intervals
   - Model selection per server per resource (different servers → different best models)
   - Weekly re-evaluation: test all models on last 14 days, pick best

### Phase 3: Analysis & Recommendations (Week 3-4, 1.5 PT)

1. **Resource Threshold Analyzer**
   - Compare forecast p95 against configured thresholds:
     - CPU: 80% sustained → warning, 90% → critical
     - RAM: 85% used → warning, 95% → critical
     - Disk: 75% → warning, 90% → critical
     - Network: 70% bandwidth → warning, 85% → critical
   - Earliest exhaustion date calculation

2. **Exhaustion Detector**
   - Days until resource exhaustion (with confidence)
   - Multiple scenario analysis:
     - Current trend continues
     - Growth accelerates (+20%)
     - Growth decelerates (-20%)
   - Slack time: days from detection to actual exhaustion

3. **Provisioning Recommendation Engine**
   - For each predicted exhaustion:
     - Recommended action (upgrade plan, add node, migrate)
     - Cost: current vs. recommended
     - Impact: performance improvement, headroom gained
     - Timeline: recommended apply-by date
     - Alternative options with trade-offs

4. **Cost-Benefit Analyzer**
   - Current monthly cost for server(s)
   - Projected cost after recommendation
   - Cost per unit of resource (e.g., $/GB RAM)
   - Payback period for upgrade

---

## API Design

### Endpoints

All endpoints are prefixed with `/api/v2/capacity-forecast`.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/forecast/{serverId}` | Get 30/60/90 day forecast for a server |
| `GET`  | `/forecast/{serverId}/history` | Get historical + predicted data points |
| `GET`  | `/forecast/account/{accountId}` | Get account-level aggregate forecast |
| `GET`  | `/forecast/group/{tag}` | Get forecast for tagged group of servers |
| `GET`  | `/recommendations` | List all active recommendations |
| `GET`  | `/recommendations/{recId}` | Get specific recommendation details |
| `PATCH`| `/recommendations/{recId}` | Accept/dismiss/modify recommendation |
| `POST` | `/recommendations/{recId}/apply` | Execute recommendation |
| `GET`  | `/models/{serverId}` | Get model metadata for a server |
| `POST` | `/models/{serverId}/retrain` | Force model retraining |
| `GET`  | `/accuracy` | Model accuracy dashboard data |

### Request/Response Examples

**GET /api/v2/capacity-forecast/forecast/srv-mc-42**

```json
{
  "server_id": "srv-mc-42",
  "generated_at": "2026-05-27T06:00:00Z",
  "data_window": {
    "start": "2025-11-27T00:00:00Z",
    "end": "2026-05-27T00:00:00Z",
    "total_days": 181,
    "data_quality": 0.97
  },
  "forecasts": {
    "cpu": {
      "resource": "cpu",
      "unit": "percent",
      "current_value": 45.2,
      "trend": "increasing",
      "growth_rate": "1.8%/month",
      "models": {
        "primary": "prophet",
        "secondary": "arima",
        "ensemble_weights": { "prophet": 0.5, "arima": 0.3, "linear": 0.2 }
      },
      "predictions": {
        "30d": {
          "p50": 52.3,
          "p95": 68.1,
          "p05": 38.2,
          "confidence": 0.89
        },
        "60d": {
          "p50": 59.8,
          "p95": 78.4,
          "p05": 42.5,
          "confidence": 0.82
        },
        "90d": {
          "p50": 67.2,
          "p95": 89.6,
          "p05": 47.1,
          "confidence": 0.74
        }
      },
      "exhaustion": {
        "threshold": 90,
        "days_until_exhaustion_p50": 87,
        "days_until_exhaustion_p95": 42,
        "exhaustion_date_p95": "2026-07-08",
        "status": "watch"
      }
    },
    "ram": {
      "resource": "ram",
      "unit": "percent",
      "current_value": 72.0,
      "trend": "increasing",
      "growth_rate": "2.5%/month",
      "predictions": {
        "30d": { "p50": 79.5, "p95": 88.3, "p05": 72.1, "confidence": 0.92 },
        "60d": { "p50": 87.2, "p95": 96.4, "p05": 79.8, "confidence": 0.85 },
        "90d": { "p50": 94.8, "p95": 103.2, "p05": 86.5, "confidence": 0.76 }
      },
      "exhaustion": {
        "threshold": 95,
        "days_until_exhaustion_p50": 52,
        "days_until_exhaustion_p95": 28,
        "exhaustion_date_p95": "2026-06-24",
        "status": "critical"
      }
    },
    "disk": {
      "resource": "disk",
      "unit": "percent",
      "current_value": 55.0,
      "trend": "stable",
      "growth_rate": "0.3%/month",
      "predictions": {
        "30d": { "p50": 56.1, "p95": 58.4, "p05": 54.0, "confidence": 0.95 },
        "60d": { "p50": 57.2, "p95": 60.8, "p05": 54.5, "confidence": 0.93 },
        "90d": { "p50": 58.3, "p95": 63.2, "p05": 55.1, "confidence": 0.91 }
      },
      "exhaustion": null
    },
    "players": {
      "resource": "players",
      "unit": "count",
      "current_value": 45,
      "trend": "increasing",
      "growth_rate": "3.2 players/month",
      "predictions": {
        "30d": { "p50": 52, "p95": 62, "p05": 43, "confidence": 0.87 },
        "60d": { "p50": 58, "p95": 72, "p05": 47, "confidence": 0.79 },
        "90d": { "p50": 65, "p95": 84, "p05": 51, "confidence": 0.71 }
      },
      "exhaustion": {
        "threshold": 80,
        "days_until_exhaustion_p50": 68,
        "days_until_exhaustion_p95": 38,
        "exhaustion_date_p95": "2026-07-04",
        "status": "warning"
      }
    }
  },
  "overall_status": "critical"
}
```

**GET /api/v2/capacity-forecast/recommendations**

```json
{
  "recommendations": [
    {
      "id": "rec-cap-001",
      "server_id": "srv-mc-42",
      "resource": "ram",
      "severity": "critical",
      "title": "RAM exhaustion predicted within 28 days",
      "description": "Server srv-mc-42 will exhaust available RAM within 28 days (p95) under current growth trajectory. Current: 72% (7.2 GB / 10 GB).",
      "current_specs": {
        "plan": "game-10gb",
        "ram_gb": 10,
        "cpu_cores": 4,
        "disk_gb": 100
      },
      "recommended_specs": {
        "plan": "game-16gb",
        "ram_gb": 16,
        "cpu_cores": 6,
        "disk_gb": 100
      },
      "cost_analysis": {
        "current_monthly": 29.99,
        "recommended_monthly": 44.99,
        "monthly_increase": 15.00,
        "cost_per_gb_saved": "optimal",
        "recommended_apply_date": "2026-06-10"
      },
      "alternatives": [
        {
          "plan": "game-24gb",
          "ram_gb": 24,
          "monthly": 64.99,
          "pro": "Longer runway (~18 months before next upgrade)",
          "con": "Higher upfront cost increase"
        },
        {
          "action": "optimize_jvm",
          "description": "Apply JVM memory optimization flags to reduce memory pressure by ~15%",
          "pro": "No cost increase",
          "con": "Extends runway by ~45 days only"
        }
      ],
      "status": "open",
      "created_at": "2026-05-27T06:00:00Z",
      "expires_at": "2026-06-10T06:00:00Z"
    }
  ],
  "summary": {
    "total": 12,
    "critical": 2,
    "warning": 5,
    "info": 5,
    "total_monthly_increase_if_applied": 68.50
  }
}
```

---

## Data Model

```yaml
Forecast:
  id: string (UUID)
  server_id: string
  generated_at: datetime
  data_window_start: datetime
  data_window_end: datetime
  data_quality: float         # 0-1
  resources: ResourceForecast[]
  overall_status: "healthy" | "watch" | "warning" | "critical"

ResourceForecast:
  resource: "cpu" | "ram" | "disk" | "network" | "players"
  unit: string
  current_value: float
  current_timestamp: datetime
  trend: "increasing" | "decreasing" | "stable"
  growth_rate: string         # e.g. "2.5%/month"
  model_metadata: ModelMetadata
  predictions: TimeHorizonPredictions
  exhaustion: ExhaustionPrediction | null

ModelMetadata:
  primary: string             # "prophet" | "arima" | "exp_smoothing" | "linear"
  secondary: string
  ensemble_weights: dict
  accuracy_last_14d: float    # MAPE
  last_retrained: datetime
  training_duration_ms: integer

TimeHorizonPredictions:
  30d: HorizonPrediction
  60d: HorizonPrediction
  90d: HorizonPrediction

HorizonPrediction:
  p50: float
  p95: float
  p05: float
  confidence: float           # 0-1

ExhaustionPrediction:
  threshold: float            # e.g. 90 (percent) or 80 (player count)
  days_until_exhaustion_p50: integer
  days_until_exhaustion_p95: integer
  exhaustion_date_p50: date
  exhaustion_date_p95: date
  status: "ok" | "watch" | "warning" | "critical"

Recommendation:
  id: string (UUID)
  server_id: string
  resource: string
  severity: "critical" | "warning" | "info"
  status: "open" | "accepted" | "dismissed" | "applied" | "expired"
  title: string
  description: string
  current_specs: ServerSpecs
  recommended_specs: ServerSpecs
  cost_analysis: CostAnalysis
  alternatives: AlternativeAction[]
  triggered_by_forecast_id: string
  created_at: datetime
  expires_at: datetime
  applied_at: datetime | null
  applied_by: string | null

ServerSpecs:
  plan: string
  cpu_cores: integer
  ram_gb: integer
  disk_gb: integer
  bandwidth_tb: integer

CostAnalysis:
  current_monthly: float
  recommended_monthly: float
  monthly_increase: float
  payback_period_months: float | null
  cost_efficiency: "optimal" | "underprovisioned" | "overprovisioned"

AlternativeAction:
  type: "upgrade" | "downgrade" | "optimize" | "migrate" | "add_node"
  description: string
  pro: string
  con: string

TrainingMetrics:
  id: string (UUID)
  server_id: string
  model_name: string
  trained_at: datetime
  training_duration_ms: integer
  mape: float          # Mean Absolute Percentage Error
  mae: float           # Mean Absolute Error
  rmse: float          # Root Mean Square Error
  mase: float          # Mean Absolute Scaled Error
  training_data_points: integer
  features_used: string[]
```

---

## Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Orchestrator Agent** | Primary: Data collection, forecasting engine, analysis, recommendation generation, model training |
| **Management Panel** | Secondary: UI for forecast dashboard, heatmap, timeline, recommendations panel, cost analysis |
| **Integration Service** | Secondary: Alert/notification dispatch when critical recommendations generated, scheduled report delivery |
| **Service Core** | None directly; authentication, server metadata, account hierarchy |

---

## Effort Estimate

| Phase | Task | PT | Owner |
|-------|------|----|-------|
| P1 | Metrics collector + aggregation pipeline | 0.75 | Backend |
| P1 | Data quality checks + gap filling | 0.5 | Backend |
| P1 | Pre-computed rollup views | 0.25 | Backend |
| P2 | Statistical models (ARIMA, Holt-Winters, Linear) | 1.0 | Backend/ML |
| P2 | Prophet/NeuralProphet integration | 1.0 | ML |
| P2 | Ensemble model combiner + model selection | 0.5 | ML |
| P3 | Resource threshold analyzer + exhaustion detector | 0.5 | Backend |
| P3 | Provisioning recommendation engine | 0.5 | Backend |
| P3 | Cost-benefit analysis | 0.25 | Backend |
| P3 | Forecast dashboard + recommendations UI | 0.75 | Frontend |
| P3 | Scheduled report generation | 0.25 | Backend |
| **Total** | | **5.75 PT** | |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Insufficient historical data (<30 days) | High | Fallback to linear trend; output with reduced confidence; flag for data collection |
| Sudden traffic spikes (e.g., Minecraft YouTuber effect) | Medium | Anomaly detection excludes spikes; confidence intervals widen with uncertainty |
| Model drift over time (forecast accuracy degrades) | Medium | Weekly accuracy evaluation; auto-retrain on threshold breach; model versioning |
| Seasonality changes (e.g., summer vs. school year) | Low | Multi-year seasonality support in Prophet; manual holiday/event calendar input |
| Resource limits not well-understood (e.g., disk I/O) | Medium | Focus on clear resources first (RAM, disk); add complex resources in v2 |
| Over-provisioning leads to unnecessary spend | Medium | Conservative recommendations; explicit cost-benefit displayed; approval required |
| Cold start for new servers | High | Use account-level aggregates as baseline; populate with similar-server profiles |

---

## Forecast Accuracy Tracking

```
┌─────────────────────────────────────────────────────────────────┐
│                      Model Accuracy Dashboard                      │
│                                                                   │
│  Resource │ Last 7d │ Last 14d │ Last 30d │ Best Model (14d)     │
│  ─────────┼─────────┼──────────┼──────────┼───────────────────── │
│  CPU      │  4.2%   │   5.1%   │   6.8%   │ Prophet              │
│  RAM      │  3.8%   │   4.5%   │   5.2%   │ NeuralProphet        │
│  Disk     │  1.2%   │   1.5%   │   2.1%   │ Linear (stable)      │
│  Players  │  8.7%   │  10.2%   │  14.5%   │ ARIMA                │
│  Network  │  6.3%   │   7.8%   │   9.1%   │ Prophet              │
│  ─────────┼─────────┼──────────┼──────────┼───────────────────── │
│  Overall  │  4.8%   │   5.8%   │   7.5%   │ Ensemble             │
└─────────────────────────────────────────────────────────────────┘

Accuracy metric: MAPE (Mean Absolute Percentage Error)
Retrain trigger: MAPE > 10% over 14 days
```

---

## Configuration

### YAML Configuration Example

```yaml
# orchestrator-agent/config/capacity-forecaster.yml
capacity_forecast:
  enabled: true
  schedule: "0 6 * * *"  # daily at 06:00 UTC
  
  data:
    min_history_days: 30
    max_history_days: 365
    aggregation: "1h"
    gap_fill_max_hours: 6
    anomaly_std_dev_threshold: 3.0
    
  models:
    ensemble:
      enabled: true
      evaluation_window_days: 14
      min_accuracy: 0.7
    prophet:
      enabled: true
      uncertainty_samples: 1000
      changepoint_prior_scale: 0.05
      seasonality_prior_scale: 10.0
      holidays: "minecraft-release-dates.csv"
    arima:
      enabled: true
      auto_search: true
      max_p: 5
      max_d: 2
      max_q: 5
    exponential_smoothing:
      enabled: true
      seasonal_periods: [7, 30]
      
  thresholds:
    cpu:
      warning: 80
      critical: 90
    ram:
      warning: 85
      critical: 95
    disk:
      warning: 75
      critical: 90
    network:
      warning: 70
      critical: 85
    players:
      warning: 75
      critical: 90
      
  recommendations:
    max_per_server: 3
    auto_dismiss_days: 30
    min_slack_days: 7  # don't recommend if <7 days to exhaustion
    cost_savings_threshold: 5.0  # minimum $/month savings for downgrade rec
    
  notifications:
    critical:
      - type: "discord"
        channel: "capacity-alerts"
      - type: "email"
        to: ["ops@company.com"]
    weekly_report:
      enabled: true
      day: "monday"
      format: "pdf"
```

---

## Future Enhancements

- **v2.0**: Multi-variate forecasting (CPU depends on players, RAM depends on plugins)
- **v2.1**: Cross-server migration recommendations (consolidate under-utilized servers)
- **v2.2**: Auto-scaling integration with cloud provider APIs
- **v2.3**: Budget-aware capacity planning (recommend within cost constraints)
- **v2.4**: Hardware lifecycle prediction (SSD wear, ECC error rates)
- **v2.5**: Predictive auto-scaling with approval workflow + automated execution
