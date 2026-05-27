# AI Backup Validator

> **Feature ID:** 5  
> **Category:** AI & Intelligence  
> **Primary Service:** Integration Service  
> **Effort Estimate:** Medium (4-6 PT)  
> **Status:** Planned

---

## Overview

Restore backups to ephemeral containers and run automated integrity checks to validate backup quality. The validator ensures backups are not just present but *usable* — databases have consistent schemas, file hashes match expected values, and applications start correctly in the restored environment.

A validation score is calculated for each backup, and detailed reports are surfaced in the Management Panel.

### Goals

- Ensure all backups are actually restorable before the data is needed
- Detect silent backup corruption immediately rather than at recovery time
- Provide a quantifiable validation score for each backup
- Support DB consistency checks (PostgreSQL, MySQL, MongoDB), file integrity verification, and application health probes
- Schedule validation automatically after each backup completes

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Backup Sources                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ Filesystem │  │ PostgreSQL │  │ MySQL / MongoDB    │ │
│  │ Snapshots  │  │ Dumps      │  │ Dumps              │ │
│  └──────┬─────┘  └──────┬─────┘  └────────┬───────────┘ │
└─────────┼────────────────┼──────────────────┼─────────────┘
          │                │                  │
          ▼                ▼                  ▼
┌──────────────────────────────────────────────────────────┐
│              Integration Service                          │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │            Ephemeral Restore Engine                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │
│  │  │ Target   │──│ Restore  │──│ Container         │ │  │
│  │  │ Selection│  │ Executor │  │ Lifecycle Manager │ │  │
│  │  └──────────┘  └──────────┘  └────────┬─────────┘ │  │
│  └────────────────────────────────────────────────────┘  │
│                        │                                 │
│                        ▼                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │            Integrity Check Engine                    │  │
│  │  ┌──────────────┐  ┌────────────┐  ┌────────────┐ │  │
│  │  │ DB           │  │ File Hash  │  │ Application│ │  │
│  │  │ Consistency  │  │ Verifier   │  │ Health     │ │  │
│  │  │              │  │            │  │ Probe      │ │  │
│  │  └──────┬───────┘  └─────┬──────┘  └──────┬─────┘ │  │
│  │         │                │                │        │  │
│  │         ▼                ▼                ▼        │  │
│  │  ┌────────────────────────────────────────────┐    │  │
│  │  │      Validation Scorer                      │    │  │
│  │  │  Weighted score: 0.0 - 1.0                  │    │  │
│  │  └──────────────────┬─────────────────────────┘    │  │
│  └─────────────────────┼──────────────────────────────┘  │
│                        │                                 │
│                        ▼                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │            Reporting & Scheduling                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │
│  │  │ Report   │──│ Schedule │──│ Notification     │ │  │
│  │  │ Generator│  │ Engine   │  │ (on failure)     │ │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘ │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│              Container Runtime (Docker/K8s)               │
│  ┌────────────────────────────────────────────────────┐  │
│  │  Ephemeral Validation Container (Temporary)         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │
│  │  │ Restored │──│ DB Check │──│ Health Check     │ │  │
│  │  │ Data     │  │ Scripts  │  │ (app start +     │ │  │
│  │  │ Volume   │  │          │  │  HTTP probe)     │ │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘ │  │
│  │  ┌──────────────────────────────────────────────┐ │  │
│  │  │  Results → sent to Integration Service        │ │  │
│  │  └──────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Ephemeral Restore Engine (1.5-2 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 1.1 | Target backup selection logic | Latest, specific backup ID, or random sampling |
| 1.2 | Ephemeral container provisioning | Docker API / K8s Job creation with restore volume |
| 1.3 | Restore executor | Download backup, extract, apply to ephemeral environment |
| 1.4 | Resource limits & cleanup | CPU/RAM limits, TTL-based container cleanup, timeout handling |

**Restore workflow:**

```yaml
# config/restore_templates.yaml
restore_templates:
  postgres:
    image: "postgres:16-alpine"
    restore_command: |
      pg_restore -U validator -d postgres /backup/dump.sql
    env:
      POSTGRES_PASSWORD: "{{ .TempPassword }}"
    resources:
      cpu: "1"
      memory: "2Gi"
    timeout_seconds: 300

  filesystem:
    image: "alpine:latest"
    restore_command: |
      tar xzf /backup/archive.tar.gz -C /restored
    resources:
      cpu: "0.5"
      memory: "1Gi"
    timeout_seconds: 600

  mysql:
    image: "mysql:8.0"
    restore_command: |
      mysql -u validator -p"{{ .TempPassword }}" < /backup/dump.sql
    env:
      MYSQL_ROOT_PASSWORD: "{{ .TempPassword }}"
    resources:
      cpu: "1"
      memory: "2Gi"
    timeout_seconds: 300

  mongodb:
    image: "mongo:7"
    restore_command: |
      mongorestore --drop /backup/dump/
    resources:
      cpu: "1"
      memory: "2Gi"
    timeout_seconds: 600
```

### Phase 2: Integrity Checks (1.5-2 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 2.1 | DB consistency checks | `pg_checksums`, `mysqlcheck`, `mongodb validate` |
| 2.2 | Schema integrity verification | Compare restored schema to expected baseline |
| 2.3 | Table row counts & data sampling | Validate record counts match backup manifest |
| 2.4 | File hash verification | SHA-256 checksum comparison against backup manifest |
| 2.5 | Application health probes | HTTP/S start check, port binding verification |

**Integrity check scripts:**

```python
# pseudocode: integrity_checks.py
class IntegrityChecker:
    async def check_database(self, db_type: str, conn_string: str) -> CheckResult:
        checks = []
        score = 0.0

        if db_type == "postgres":
            # Check database consistency
            result = await self._run_sql(conn_string, "SELECT count(*) FROM pg_class WHERE relkind = 'r'")
            table_count = result[0][0]
            checks.append(Check("table_count", table_count > 0, {"tables": table_count}))

            # Check for corruption
            corrupt = await self._run_shell(f"pg_checksums -c {conn_string}")
            checks.append(Check("no_corruption", corrupt.exit_code == 0, {"output": corrupt.stdout}))

            # Check schema against baseline
            schema = await self._get_schema(conn_string)
            baseline = await self._load_baseline(self.backup_id)
            schema_match = self._compare_schema(schema, baseline)
            checks.append(Check("schema_matches_baseline", schema_match, {"diff": schema.diff}))

        # ... similar for mysql, mongodb

        return CheckResult(checks=checks, score=sum(c.weight for c in checks if c.passed) / len(checks))

    async def check_files(self, backup_manifest: dict, restored_path: str) -> CheckResult:
        checks = []
        verified = 0
        failed = 0

        for entry in backup_manifest["files"]:
            expected_hash = entry["sha256"]
            actual_hash = self._compute_hash(f"{restored_path}/{entry['path']}")
            if actual_hash == expected_hash:
                verified += 1
            else:
                failed += 1
                checks.append(Check(
                    f"hash_{entry['path']}",
                    False,
                    {"expected": expected_hash, "actual": actual_hash}
                ))

        checks.append(Check("file_integrity", failed == 0, {
            "verified": verified, "failed": failed, "total": verified + failed
        }))
        return CheckResult(checks=checks, score=verified / (verified + failed) if (verified + failed) > 0 else 0)
```

### Phase 3: Scoring & Reporting (1 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 3.1 | Validation score calculation | Weighted combination of individual checks |
| 3.2 | Report generation | Structured JSON report + human-readable summary |
| 3.3 | Trend tracking over time | Per-backup, per-server validation history |
| 3.4 | Notification on failure | Critical alert if score < threshold |

**Scoring formula:**

```
Validation Score = 0.0 - 1.0

Weights (configurable):
  Database consistency:      0.35
  Schema integrity:          0.20
  File hash verification:    0.25
  Application health probe:  0.20

Thresholds:
  Pass:  >= 0.90
  Warning: 0.70 - 0.89
  Fail:   < 0.70
```

**Validation report:**

```json
{
  "validation_id": "val-20260527-001",
  "backup_id": "bkp-20260527-003",
  "server_id": "srv-001",
  "server_name": "db-primary",
  "backup_type": "postgres",
  "started_at": "2026-05-27T03:00:00Z",
  "completed_at": "2026-05-27T03:12:34Z",
  "duration_seconds": 754,
  "overall_score": 0.94,
  "status": "pass",
  "checks": {
    "database_consistency": {
      "score": 1.0,
      "weight": 0.35,
      "checks": [
        {"name": "table_count", "passed": true, "detail": "42 tables found"},
        {"name": "no_corruption", "passed": true, "detail": "pg_checksums: no corruption detected"},
        {"name": "index_validity", "passed": true, "detail": "All indexes valid"}
      ]
    },
    "schema_integrity": {
      "score": 0.85,
      "weight": 0.20,
      "checks": [
        {"name": "schema_vs_baseline", "passed": true, "detail": "Schema matches baseline"},
        {"name": "row_count_accuracy", "passed": false,
         "detail": "Table 'sessions' has 1,234,567 rows vs expected 1,250,000 (98.8%)",
         "actual": 1234567, "expected": 1250000}
      ]
    },
    "file_integrity": {
      "score": 1.0,
      "weight": 0.25,
      "checks": [
        {"name": "file_hash_verification", "passed": true,
         "detail": "All 1,248 files verified, 0 mismatches"}
      ]
    },
    "application_health": {
      "score": 0.9,
      "weight": 0.20,
      "checks": [
        {"name": "postgres_accepts_connections", "passed": true,
         "detail": "Connection pool test: 10/10 connections established"},
        {"name": "query_performance", "passed": true,
         "detail": "Sample query completed in 4ms (baseline: 5ms)"},
        {"name": "replication_slot_check", "passed": false,
         "detail": "1 stale replication slot found (slot_name: 'old_slot', not in use)"}
      ]
    }
  },
  "recommendations": [
    "Investigate table 'sessions' row count discrepancy",
    "Drop stale replication slot 'old_slot' on db-primary"
  ]
}
```

### Phase 4: Scheduling & Automation (1 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 4.1 | Post-backup trigger | Webhook or event subscription: on backup complete → validate |
| 4.2 | Scheduled validation | Cron-based periodic re-validation of critical backups |
| 4.3 | Random sampling | Validate random N% of backups even without explicit trigger |
| 4.4 | Retention of validation results | Store last N validation reports, purge old artifacts |

---

## API Design

### REST API

#### Trigger Validation

```
POST /api/v1/validations
```

Request:
```json
{
  "backup_id": "bkp-20260527-003",
  "server_id": "srv-001",
  "checks": ["database", "files", "health"],
  "priority": "high",
  "notify_on_completion": true
}
```

Response:
```json
{
  "validation_id": "val-20260527-001",
  "status": "running",
  "estimated_duration_seconds": 600
}
```

#### Get Validation Result

```
GET /api/v1/validations/{id}
```

Response: (full report JSON as shown above)

#### List Validations

```
GET /api/v1/validations
  ?server_id=srv-001
  &status=pass,fail
  &from=2026-05-01T00:00:00Z
  &to=2026-05-27T23:59:59Z
  &min_score=0.9
  &limit=50
```

#### Get Validation Summary (Dashboard)

```
GET /api/v1/validations/summary
  ?server_id=srv-001
  &days=30
```

Response:
```json
{
  "total_validations": 45,
  "passed": 40,
  "warning": 3,
  "failed": 2,
  "average_score": 0.93,
  "trend": "stable",
  "latest_scores": [
    {"date": "2026-05-27", "score": 0.94},
    {"date": "2026-05-26", "score": 0.91},
    {"date": "2026-05-25", "score": 0.95}
  ],
  "latest_failures": [
    {
      "backup_id": "bkp-20260525-001",
      "server_name": "db-primary",
      "score": 0.45,
      "reason": "pg_checksums: corruption detected in table 'orders'",
      "validated_at": "2026-05-25T04:00:00Z"
    }
  ]
}
```

#### Schedule Validation Policy

```
PUT /api/v1/validations/policies/{server_id}
```

Request:
```json
{
  "enabled": true,
  "trigger_on_backup": true,
  "schedule_cron": "0 5 * * *",
  "checks": ["database", "files", "health"],
  "score_threshold_warning": 0.85,
  "score_threshold_fail": 0.70,
  "notify_on": ["fail", "warning"],
  "retention_days": 90
}
```

---

## Data Model

```python
# models/backup_validator.py
@dataclass
class ValidationRequest:
    backup_id: str
    server_id: str
    checks: list[str]        # database, files, health
    priority: str            # low / normal / high
    notify_on_completion: bool

@dataclass
class ValidationResult:
    id: str
    backup_id: str
    server_id: str
    server_name: str
    backup_type: str         # postgres / mysql / mongodb / filesystem
    started_at: datetime
    completed_at: datetime | None
    duration_seconds: int | None
    overall_score: float
    status: str              # running / pass / warning / fail / error
    checks: dict[str, CheckCategory]
    recommendations: list[str]
    container_id: str | None
    error: str | None

@dataclass
class CheckCategory:
    score: float
    weight: float
    checks: list[Check]

@dataclass
class Check:
    name: str
    passed: bool
    detail: str
    actual: Any | None
    expected: Any | None

@dataclass
class ValidationPolicy:
    server_id: str
    enabled: bool
    trigger_on_backup: bool
    schedule_cron: str | None
    checks: list[str]
    score_threshold_warning: float
    score_threshold_fail: float
    notify_on: list[str]
    retention_days: int
```

**Database Schema:**

```sql
-- Validation results
CREATE TABLE validation_results (
    id              TEXT PRIMARY KEY,
    backup_id       TEXT NOT NULL,
    server_id       TEXT NOT NULL,
    server_name     TEXT NOT NULL,
    backup_type     TEXT NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    duration_seconds INTEGER,
    overall_score   DOUBLE PRECISION,
    status          TEXT NOT NULL DEFAULT 'running',
    checks          JSONB,
    recommendations JSONB DEFAULT '[]',
    container_id    TEXT,
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_val_server ON validation_results(server_id);
CREATE INDEX idx_val_status ON validation_results(status);
CREATE INDEX idx_val_score ON validation_results(overall_score);
CREATE INDEX idx_val_backup ON validation_results(backup_id);

-- Validation policies
CREATE TABLE validation_policies (
    server_id       TEXT PRIMARY KEY,
    enabled         BOOLEAN DEFAULT TRUE,
    trigger_on_backup BOOLEAN DEFAULT TRUE,
    schedule_cron   TEXT,
    checks          JSONB DEFAULT '["database", "files", "health"]',
    score_threshold_warning DOUBLE PRECISION DEFAULT 0.85,
    score_threshold_fail DOUBLE PRECISION DEFAULT 0.70,
    notify_on       JSONB DEFAULT '["fail"]',
    retention_days  INTEGER DEFAULT 90,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Backup integrity metadata (file manifest)
CREATE TABLE backup_manifests (
    backup_id       TEXT PRIMARY KEY,
    server_id       TEXT NOT NULL,
    backup_type     TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL,
    file_count      INTEGER NOT NULL,
    total_size_bytes BIGINT NOT NULL,
    files           JSONB,    -- array of {path, sha256, size_bytes}
    db_metadata     JSONB     -- table schemas, row counts for DB backups
);
```

---

## Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Integration Service** | Ephemeral restore orchestration, integrity check engine, validation scorer, reporting, scheduling engine, policy management |
| **Orchestrator Agent** | Backup event hooks, ephemeral container provisioning on compute nodes, network isolation for validation containers |
| **Management Panel** | Validation dashboard, report viewer (pass/warning/fail), policy configuration UI, trend chart, failure drill-down |

---

## Configuration Reference

```yaml
# config/backup_validator.yaml
restore:
  container_ttl_minutes: 30
  max_concurrent_validations: 5
  resource_limits:
    default:
      cpu: "1"
      memory: "2Gi"
    large_backup:
      cpu: "4"
      memory: "8Gi"
      threshold_bytes: 10737418240  # 10 GB
  network_isolated: true
  cleanup_on_completion: true

checks:
  database:
    postgres:
      consistency_tool: "pg_checksums"
      schema_comparison: true
      row_count_accuracy: true
      row_count_tolerance_percent: 5.0
    mysql:
      consistency_tool: "mysqlcheck"
      schema_check: true
    mongodb:
      validation: true
      index_check: true

  files:
    hash_algorithm: "sha256"
    verify_all_files: true
    sample_size: null       # null = all files, else percentage

  health:
    probe_timeout_seconds: 30
    retry_count: 3
    required_checks:
      - port_open
      - process_running
      - connection_test

scoring:
  weights:
    database_consistency: 0.35
    schema_integrity: 0.20
    file_integrity: 0.25
    application_health: 0.20
  thresholds:
    pass: 0.90
    warning: 0.70
    fail: 0.00

scheduling:
  post_backup_trigger: true
  cron_schedule: "0 6 * * *"
  random_sample_percent: 10
  retention_days: 90

notifications:
  on_pass: false
  on_warning: true
  on_fail: true
  on_error: true
  channels: ["panel", "discord"]
```

**Docker compose for ephemeral validator container:**

```yaml
# docker/validator-compose.yaml
version: "3.8"
services:
  validator:
    image: infrapilot/backup-validator:latest
    restart: "no"
    environment:
      VALIDATION_ID: "${VALIDATION_ID}"
      BACKUP_STORAGE_URL: "${BACKUP_STORAGE_URL}"
      BACKUP_TYPE: "${BACKUP_TYPE}"
      CHECK_TYPES: "${CHECK_TYPES}"
      REPORT_CALLBACK_URL: "http://integration-service:8000/api/v1/validations/${VALIDATION_ID}/callback"
    volumes:
      - restored-data:/restored
    networks:
      - isolated-validation
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 2G

volumes:
  restored-data:

networks:
  isolated-validation:
    internal: true
```

---

## Effort Breakdown

| Phase | Task | PT | Dependencies |
|-------|------|----|-------------|
| 1.1 | Backup selection logic | 0.5 | Backup catalog |
| 1.2 | Ephemeral container provisioning | 1 | Docker/K8s access |
| 1.3 | Restore executor | 0.5 | Container runtime |
| 1.4 | Resource limits & cleanup | 0.5 | Container runtime |
| 2.1 | DB consistency checks | 1 | Database tools |
| 2.2 | Schema integrity verification | 0.5 | Baseline schema store |
| 2.3 | Row count validation | 0.25 | DB access |
| 2.4 | File hash verification | 0.5 | Hash computation |
| 2.5 | Application health probes | 0.5 | HTTP client |
| 3.1 | Score calculation | 0.25 | Check results |
| 3.2 | Report generation | 0.5 | Score output |
| 3.3 | Trend tracking | 0.25 | Time-series storage |
| 3.4 | Failure notification | 0.25 | Notifier service |
| 4.1 | Post-backup trigger | 0.25 | Event bus |
| 4.2 | Scheduled validation | 0.25 | Cron scheduler |
| 4.3 | Random sampling | 0.25 | Sampling logic |
| 4.4 | Retention & cleanup | 0.25 | Scheduler |
| | **Total** | **6.25** | |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Ephemeral restore impacts production | Resource contention | Strict resource limits, dedicated node pool for validation, throttle concurrent validations |
| Restore takes too long | Validation delays | Configurable timeout, incremental restore for large backups, streaming validation |
| False positive (valid backup flagged bad) | Unnecessary re-backup | Configurable thresholds, manual review option, multiple check types with redundancy |
| False negative (corrupted backup passes) | Data loss at recovery | Multi-layered checks (hashes + DB consistency + health), checksum verification against backup manifest |
| Validation container security | Attack surface | Network isolation, no persistent storage, temp credentials, automatic cleanup |

---

## Metrics & KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Backup validation coverage | > 90% of all backups | Validated backups / total backups |
| Mean validation time | < 10 min | Duration per validation |
| Recovery confidence score | > 0.95 | Average score across all validations |
| Undetected corruption rate | < 0.1% | Corrupt backups missed / total corrupt |
| Validation failure rate | < 5% | Failed validations / total validations |
| Time from backup to validation | < 30 min | Time from backup completion to validation start |
