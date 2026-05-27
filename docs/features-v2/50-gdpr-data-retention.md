# GDPR & Data Retention

> **Feature ID:** 50  
> **Category:** Security & Compliance  
> **Primary Service:** Integration Service  
> **Effort Estimate:** Medium (4-6 PT)  
> **Status:** Planned

---

## Overview

Implement a comprehensive data lifecycle management system that ensures compliance with the General Data Protection Regulation (GDPR) and similar privacy frameworks. The system manages automated data retention policies, right-to-erasure (Article 17) workflows, data inventory exports (Article 30), and consent management across all Infra Pilot services.

All personally identifiable information (PII) stored within the platform — including user profiles, audit logs, billing records, and support tickets — is classified, tagged, and subject to configurable lifecycle policies.

### Goals

- Auto-purge logs and records older than configurable retention periods
- Provide a fully auditable right-to-erasure workflow (forget me)
- Generate GDPR Article 30 data inventory exports in machine-readable format
- Classify all stored data by PII sensitivity level
- Manage user consent records for data processing activities
- Generate Data Processing Agreement (DPA) documents on demand
- Maintain a tamper-proof audit trail for all data lifecycle operations

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Infra Pilot Platform                           │
│                                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐  │
│  │  User     │  │  Audit   │  │  Billing  │  │  Support  │  │ Tele- │  │
│  │  Profiles │  │  Logs    │  │  Records  │  │  Tickets  │  │ metry │  │
│  └─────┬────┘  └─────┬────┘  └─────┬────┘  └─────┬────┘  └───┬───┘  │
│        │              │              │              │            │     │
│        ▼              ▼              ▼              ▼            ▼     │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                  Integration Service                           │    │
│  │                                                               │    │
│  │  ┌────────────────────────────────────────────────────────┐  │    │
│  │  │              Data Lifecycle Engine                      │  │    │
│  │  │                                                         │  │    │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │  │    │
│  │  │  │ Data         │  │ Retention    │  │ Purge        │ │  │    │
│  │  │  │ Classifier   │──│ Policy Engine│──│ Executor     │ │  │    │
│  │  │  └──────────────┘  └──────────────┘  └──────┬───────┘ │  │    │
│  │  │                                              │         │  │    │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────┴───────┐ │  │    │
│  │  │  │ Right-to-    │  │ Consent      │  │ Data         │ │  │    │
│  │  │  │ Erasure      │──│ Manager      │  │ Inventory    │ │  │    │
│  │  │  │ Workflow     │  │              │  │ Export       │ │  │    │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘ │  │    │
│  │  └────────────────────────────────────────────────────────┘  │    │
│  │                               │                               │    │
│  │                               ▼                               │    │
│  │  ┌────────────────────────────────────────────────────────┐  │    │
│  │  │               DPA Generator                             │  │    │
│  │  │  Template engine → GDPR-compliant PDF + Markdown       │  │    │
│  │  └────────────────────────────────────────────────────────┘  │    │
│  │                                                               │    │
│  │  ┌────────────────────────────────────────────────────────┐  │    │
│  │  │               Audit Trail                               │  │    │
│  │  │  Immutable log of all purge / erasure / consent events │  │    │
│  │  └────────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Data Classification & Policy Engine (2 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 1.1 | PII classification schema across all services | `internal/gdpr/classifier.go` — scan database schemas, tag columns by PII category |
| 1.2 | Retention policy definition & storage | `internal/gdpr/policy.go` — YAML-driven retention rules per data category |
| 1.3 | Policy engine (evaluate + schedule) | `internal/gdpr/engine.go` — cron-driven evaluation, schedules purge jobs |
| 1.4 | Metadata registry for tracked data locations | `internal/gdpr/registry.go` — tracks database tables, columns, object storage paths |

**PII Classification Levels:**

| Level | Label | Examples | Retention Default |
|-------|-------|----------|------------------|
| L0 | None | System metrics, anonymised aggregates | Indefinite |
| L1 | Internal | Email addresses, usernames | 3 years |
| L2 | Sensitive | IP addresses, user-agent strings | 1 year |
| L3 | Critical | Payment tokens, passwords (hashed), government IDs | 90 days (or legal minimum) |

**Retention policy definition:**

```yaml
# config/data_retention.yaml
retention_policies:
  - category: "user.profile"
    pii_level: L1
    default_days: 1095        # 3 years
    legal_hold: true           # preserve if legal hold active
    purge_action: "anonymize"  # anonymize | delete | archive
    services:
      - integration
      - panel

  - category: "audit.logs"
    pii_level: L2
    default_days: 365
    legal_hold: true
    purge_action: "delete"
    services:
      - integration
      - orchestrator

  - category: "billing.invoices"
    pii_level: L1
    default_days: 2555        # 7 years (tax requirement)
    legal_hold: true
    purge_action: "archive"
    services:
      - billing

  - category: "support.tickets"
    pii_level: L2
    default_days: 730         # 2 years
    legal_hold: true
    purge_action: "anonymize"
    services:
      - support

  - category: "telemetry.session"
    pii_level: L3
    default_days: 90
    legal_hold: false
    purge_action: "delete"
    services:
      - integration

  - category: "consent.records"
    pii_level: L1
    default_days: -1          # -1 = permanent (legal requirement)
    legal_hold: true
    purge_action: "none"
    services:
      - integration
```

### Phase 2: Purge Executor & Right-to-Erasure (1.5 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 2.1 | Purge executor service | `internal/gdpr/purge.go` — executes delete/anonymize/archive across all services |
| 2.2 | Anonymization engine | `internal/gdpr/anonymize.go` — field-level masking, hashing, aggregation |
| 2.3 | Archive storage backend | Cold storage (S3/Blob) with encryption-at-rest |
| 2.4 | Right-to-erasure workflow | `internal/gdpr/erasure.go` — multi-step verification + execution |
| 2.5 | Erasure request API | `POST /api/v1/gdpr/erasure` — submit + track erasure requests |

**Anonymization strategies:**

```python
# pseudocode: anonymize.py
def anonymize_field(value: str, strategy: str) -> str:
    strategies = {
        "mask": value[0] + "*" * (len(value) - 2) + value[-1] if len(value) > 2 else "***",
        "hash": hashlib.sha256(value.encode()).hexdigest(),
        "truncate": value[:4] + "…",
        "redact": "[REDACTED]",
        "aggregate": bucket_into_range(value),  # e.g. age → 25-30
        "tokenize": vault_tokenize(value),       # vault-backed tokenization
    }
    return strategies.get(strategy, "[REDACTED]")
```

**Right-to-erasure flow:**

```
User Request          Verification          Execution              Confirmation
─────────────         ─────────────         ─────────               ───────────
                                                    ┌──────────┐
User submits             Verify identity           │  Search   │
erasure request  ───►  (email link / 2FA)  ───►  │  all PII  │───► Summary shown to user
via Panel / API                                    │  stores   │
                                                    └──────────┘
                                                         │
                                                    ┌──────────┐
                    User confirms                   │ Execute  │
                    intention         ◄──────────  │ purge &  │
                    (72h cool-down)                │ anonymize│
                                                    └──────────┘
                                                         │
                                                    ┌──────────┐
                     Erasure complete               │ Audit log│
                     Email confirmation  ◄────────  │ notify   │
                                                    │ user     │
                                                    └──────────┘
```

### Phase 3: Data Inventory, Consent & DPA (0.5-1 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 3.1 | Data inventory scanner | `internal/gdpr/inventory.go` — scans all connected data stores |
| 3.2 | GDPR Article 30 export | `internal/gdpr/report.go` — generates CSV/JSON/PDF inventory report |
| 3.3 | Consent management CRUD | `internal/gdpr/consent.go` — record + version user consent for processing purposes |
| 3.4 | DPA template & generator | `internal/gdpr/dpa.go` — fills organisation details into GDPR-compliant DPA template |
| 3.5 | Expiry notification service | Automated alerts to admins before retention periods elapse |

---

## API Design

### Data Retention Rules

#### List Retention Policies

```
GET /api/v1/gdpr/retention-policies
```

Response:
```json
{
  "policies": [
    {
      "category": "user.profile",
      "pii_level": "L1",
      "default_days": 1095,
      "purge_action": "anonymize",
      "legal_hold_enabled": true,
      "affected_services": ["integration", "panel"],
      "estimated_next_purge": "2026-08-15T02:00:00Z",
      "total_records_marked": 14253
    }
  ]
}
```

#### Update Retention Policy

```
PATCH /api/v1/gdpr/retention-policies/{category}
```

Request:
```json
{
  "default_days": 730,
  "purge_action": "delete",
  "legal_hold_enabled": false
}
```

#### Trigger Manual Purge

```
POST /api/v1/gdpr/retention-policies/{category}/purge
```

Response:
```json
{
  "job_id": "purge-20260527-a1b2c3",
  "category": "audit.logs",
  "records_affected": 45200,
  "estimated_duration_seconds": 120,
  "status": "running"
}
```

### Right-to-Erasure

#### Submit Erasure Request

```
POST /api/v1/gdpr/erasure
```

Request:
```json
{
  "user_id": "user-789",
  "verification_method": "email_link",
  "reason": "Data no longer necessary for processing purposes",
  "requested_by": "user-789"
}
```

Response: `201 Created`
```json
{
  "request_id": "erasure-20260527-xyz789",
  "status": "pending_verification",
  "verification_url": "https://panel.example.com/gdpr/erasure/verify/xyz789",
  "cool_down_expires": "2026-05-30T14:30:00Z",
  "created_at": "2026-05-27T14:30:00Z"
}
```

#### Verify Erasure Request

```
POST /api/v1/gdpr/erasure/{request_id}/verify
```

Request:
```json
{
  "verification_token": "abc123def456"
}
```

Response:
```json
{
  "request_id": "erasure-20260527-xyz789",
  "status": "pending_confirmation",
  "summary": {
    "total_records_found": 342,
    "categories": [
      {"category": "user.profile", "records": 1, "action": "anonymize"},
      {"category": "audit.logs", "records": 280, "action": "delete"},
      {"category": "billing.invoices", "records": 12, "action": "anonymize"},
      {"category": "support.tickets", "records": 49, "action": "anonymize"}
    ]
  }
}
```

#### Confirm Erasure

```
POST /api/v1/gdpr/erasure/{request_id}/confirm
```

Response:
```json
{
  "request_id": "erasure-20260527-xyz789",
  "status": "executing",
  "job_id": "purge-erasure-xyz789",
  "estimated_completion": "2026-05-27T14:35:00Z"
}
```

#### Get Erasure Status

```
GET /api/v1/gdpr/erasure/{request_id}
```

#### List Erasure Requests (Admin)

```
GET /api/v1/gdpr/erasure?status=completed&from=2026-01-01&limit=50
```

### Data Inventory

#### Generate Inventory Report

```
POST /api/v1/gdpr/inventory/export
```

Request:
```json
{
  "format": "csv",
  "include_sample_data": false,
  "sections": ["databases", "object_storage", "backups", "third_party"]
}
```

Response: `200 OK` (file download)

**Sample CSV output:**

```csv
category,service,table,column,pii_level,purge_action,retention_days,record_count
user.profile,panel,users,email,L1,anonymize,1095,12500
user.profile,panel,users,full_name,L1,anonymize,1095,12500
audit.logs,integration,log_events,ip_address,L2,delete,365,2840000
audit.logs,integration,log_events,user_agent,L2,delete,365,2840000
billing.invoices,billing,invoices,card_last_four,L3,archive,2555,48000
support.tickets,support,tickets,message_body,L2,anonymize,730,89000
consent.records,integration,consents,all,L1,none,-1,12500
```

### Consent Management

#### Record Consent

```
POST /api/v1/gdpr/consent
```

Request:
```json
{
  "user_id": "user-789",
  "purposes": [
    {
      "purpose": "service_operations",
      "granted": true,
      "version": "2.1"
    },
    {
      "purpose": "marketing_communications",
      "granted": false,
      "version": "1.0"
    },
    {
      "purpose": "third_party_sharing",
      "granted": false,
      "version": "1.0"
    }
  ],
  "ip_address": "203.0.113.42",
  "user_agent": "Mozilla/5.0 ..."
}
```

#### Get Consent Record

```
GET /api/v1/gdpr/consent/{user_id}
```

#### Get Consent History

```
GET /api/v1/gdpr/consent/{user_id}/history
```

### DPA Generation

#### Generate DPA

```
POST /api/v1/gdpr/dpa/generate
```

Request:
```json
{
  "organisation_name": "ACME Corp GmbH",
  "organisation_address": "Musterstr. 42, 60329 Frankfurt, Germany",
  "representative_name": "Jane Doe",
  "representative_email": "jane.doe@acme.com",
  "data_categories": [
    "identity_data",
    "contact_data",
    "usage_data",
    "billing_data"
  ],
  "processing_purposes": [
    "service_provision",
    "billing",
    "support",
    "security_monitoring"
  ],
  "subprocessors": [
    {"name": "AWS EMEA", "address": "Berlin, Germany", "purpose": "cloud_infrastructure"},
    {"name": "Stripe Payments", "address": "Dublin, Ireland", "purpose": "payment_processing"}
  ],
  "security_measures": [
    "encryption_at_rest_AES256",
    "encryption_in_transit_TLSv1.3",
    "access_control_RBAC",
    "audit_logging",
    "soc2_type2"
  ],
  "format": "pdf"
}
```

Response: `200 OK` (DPA document download)

---

## Data Model

```python
# models/gdpr.py
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime

class PIILevel(str, Enum):
    NONE = "L0"
    INTERNAL = "L1"
    SENSITIVE = "L2"
    CRITICAL = "L3"

class PurgeAction(str, Enum):
    DELETE = "delete"
    ANONYMIZE = "anonymize"
    ARCHIVE = "archive"
    NONE = "none"

class ErasureStatus(str, Enum):
    PENDING_VERIFICATION = "pending_verification"
    PENDING_CONFIRMATION = "pending_confirmation"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ConsentPurpose(str, Enum):
    SERVICE_OPERATIONS = "service_operations"
    MARKETING_COMM = "marketing_communications"
    THIRD_PARTY_SHARING = "third_party_sharing"
    ANALYTICS = "analytics"
    SUPPORT = "support"

@dataclass
class RetentionPolicy:
    category: str
    pii_level: PIILevel
    default_days: int               # -1 = permanent
    purge_action: PurgeAction
    legal_hold_enabled: bool
    services: list[str]

@dataclass
class DataLocation:
    service: str
    database: str
    table: str
    column: str
    pii_level: PIILevel
    purge_action: PurgeAction
    retention_days: int
    record_count: int
    sample_data: dict | None = None

@dataclass
class PurgeJob:
    id: str
    category: str
    policy: RetentionPolicy
    records_affected: int
    status: str                     # pending / running / completed / failed
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None

@dataclass
class ErasureRequest:
    id: str
    user_id: str
    status: ErasureStatus
    verification_method: str
    verification_token_hash: str
    verification_expires: datetime
    cool_down_expires: datetime
    confirmed_at: datetime | None
    summary: dict | None            # records found per category
    purge_job_id: str | None
    created_at: datetime
    updated_at: datetime

@dataclass
class ConsentRecord:
    id: str
    user_id: str
    purpose: ConsentPurpose
    granted: bool
    version: str
    ip_address: str
    user_agent: str
    granted_at: datetime
    revoked_at: datetime | None

@dataclass
class DPATemplate:
    organisation_name: str
    organisation_address: str
    representative_name: str
    representative_email: str
    data_categories: list[str]
    processing_purposes: list[str]
    subprocessors: list[dict]
    security_measures: list[str]
    generated_at: datetime
    valid_until: datetime
```

**Database Schema:**

```sql
-- Retention policies (configuration, cached from YAML)
CREATE TABLE retention_policies (
    category        TEXT PRIMARY KEY,
    pii_level       TEXT NOT NULL,
    default_days    INTEGER NOT NULL,
    purge_action    TEXT NOT NULL,
    legal_hold_enabled BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Data inventory (populated by scanner)
CREATE TABLE data_inventory (
    id              SERIAL PRIMARY KEY,
    service         TEXT NOT NULL,
    database_name   TEXT NOT NULL,
    table_name      TEXT NOT NULL,
    column_name     TEXT NOT NULL,
    pii_level       TEXT NOT NULL,
    purge_action    TEXT NOT NULL,
    retention_days  INTEGER NOT NULL,
    record_count    BIGINT DEFAULT 0,
    discovered_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (service, database_name, table_name, column_name)
);

-- Purge jobs
CREATE TABLE purge_jobs (
    id              TEXT PRIMARY KEY,
    category        TEXT NOT NULL,
    policy_category TEXT REFERENCES retention_policies(category),
    records_affected BIGINT DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending',
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Right-to-erasure requests
CREATE TABLE erasure_requests (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending_verification',
    verification_method TEXT NOT NULL,
    verification_token_hash TEXT NOT NULL,
    verification_expires TIMESTAMPTZ NOT NULL,
    cool_down_expires   TIMESTAMPTZ NOT NULL,
    confirmed_at        TIMESTAMPTZ,
    summary             JSONB,
    purge_job_id        TEXT REFERENCES purge_jobs(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Consent records
CREATE TABLE consent_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL,
    purpose         TEXT NOT NULL,
    granted         BOOLEAN NOT NULL,
    version         TEXT NOT NULL,
    ip_address      TEXT,
    user_agent      TEXT,
    granted_at      TIMESTAMPTZ DEFAULT NOW(),
    revoked_at      TIMESTAMPTZ,
    INDEX idx_consent_user (user_id)
);

-- DPA documents
CREATE TABLE dpa_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_name TEXT NOT NULL,
    data             JSONB NOT NULL,
    format           TEXT NOT NULL DEFAULT 'pdf',
    file_path        TEXT,
    generated_at    TIMESTAMPTZ DEFAULT NOW(),
    valid_until     TIMESTAMPTZ
);

-- Data lifecycle audit trail (immutable)
CREATE TABLE lifecycle_audit_log (
    id              BIGSERIAL PRIMARY KEY,
    event_type      TEXT NOT NULL,    -- purge_executed / erasure_completed / consent_change / policy_updated
    category        TEXT,
    user_id         TEXT,
    details         JSONB NOT NULL,
    performed_by    TEXT NOT NULL,     -- system / admin user ID / erasure-request
    performed_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Configuration Reference

```yaml
# config/data_retention.yaml
retention:
  scheduler:
    cron_expression: "0 2 * * *"        # Daily at 02:00
    purge_batch_size: 10000
    purge_concurrency: 4
    dry_run: false                       # Safety: log without deleting

  anonymization:
    default_strategy: "mask"
    strategies:
      email: "mask"
      ip_address: "hash"
      full_name: "mask"
      phone: "truncate"
      credit_card: "tokenize"
      password_hash: "redact"           # should already be hashed
      message_body: "redact"
    vault_address: "http://vault:8200"  # for tokenization

  archive:
    storage_backend: "s3"
    s3_bucket: "infrapilot-gdpr-archive"
    s3_region: "eu-central-1"
    encryption_key_arn: "arn:aws:kms:eu-central-1:...:key/..."
    archive_format: "jsonl.gzip"

  legal_hold:
    enabled: true
    hold_api_endpoint: "http://legal-hold-service:8080"
    hold_check_timeout_ms: 5000

  erasure:
    cool_down_hours: 72
    verification_token_ttl_minutes: 60
    max_erasure_execution_minutes: 30
    notification:
      on_submit: true
      on_complete: true
      on_failure: true
    email_templates:
      verification: "templates/gdpr/erasure_verification.html"
      confirmation: "templates/gdpr/erasure_confirmation.html"
      complete: "templates/gdpr/erasure_complete.html"

  notifications:
    expiry_warning_days: [90, 30, 14, 7]
    notify_roles: ["admin", "compliance_officer"]
    notify_channels: ["email", "panel"]
```

---

## Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Integration Service** | Data lifecycle engine — classification, retention policy engine, purge executor, anonymization, right-to-erasure workflow, consent management, data inventory, DPA generator, audit trail |
| **Management Panel** | GDPR dashboard — retention policy management UI, erasure request submission & tracking, consent preference UI, data inventory viewer, DPA download, compliance reporting |
| **Orchestrator Agent** | Coordinate cross-service purge execution; ensure all worker nodes respect data retention policies; deploy anonymization sidecars |
| **Notification Service** | Send erasure verification emails, expiry warnings, compliance alerts to designated roles |

---

## Effort Breakdown

| Phase | Task | PT | Dependencies |
|-------|------|----|-------------|
| 1.1 | PII classification schema & scanner | 1 | Data schemas across all services |
| 1.2 | Retention policy definition & YAML config | 0.5 | Classification schema |
| 1.3 | Policy engine (scheduler + evaluator) | 1 | Policy definitions |
| 1.4 | Metadata registry for tracked data | 0.5 | Scanner |
| 2.1 | Purge executor (delete/anonymize/archive) | 1 | Policy engine |
| 2.2 | Anonymization engine | 0.5 | Purge executor |
| 2.3 | Archive storage backend (S3/Blob) | 0.5 | Purge executor |
| 2.4 | Right-to-erasure workflow | 1 | Purge executor, anonymization |
| 2.5 | Erasure request API | 0.5 | Workflow |
| 3.1 | Data inventory scanner | 0.5 | Classification |
| 3.2 | GDPR Article 30 export | 0.5 | Inventory |
| 3.3 | Consent management CRUD | 0.5 | Database schema |
| 3.4 | DPA template & generator | 0.5 | Consent management |
| 3.5 | Expiry notification service | 0.25 | Policy engine |
| 3.6 | Lifecycle audit trail | 0.25 | All phases |
| | **Total** | **8.75** | |

> **Note:** Phases 1–3 overlap where possible. Consolidated effort is **4–6 PT** as stated in the plan.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Accidental data deletion before retention expiry | Permanent data loss, compliance violation | Dry-run mode enforced on first execution; confirmation step for all purge jobs; soft-delete with 30-day recovery window |
| Incomplete erasure (missed PII in backups/derived data) | GDPR non-compliance, fines | Backup scanning integrated into inventory; `lifecycle_audit_log` tracks all copies; follow-up scan 24h post-erasure |
| Legal hold conflict with retention purge | Wrongful deletion of evidence | Legal hold API check before every purge; hold flag overrides retention policy; all overrides logged |
| Cross-service consistency during purge | Partial purge, inconsistent state | Distributed saga pattern with compensating actions; two-phase commit across services |
| Consent version drift (user consented to old policy) | Invalid consent basis | Versioned consent records; prompt re-consent on policy changes; deny processing until re-consent |
| DPA template becomes outdated (law changes) | Non-compliant DPA | Versioned templates with expiry dates; automated notification when new template available |
