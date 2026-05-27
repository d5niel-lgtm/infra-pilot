# Feature 46: Compliance Framework Reports

- **Feature ID:** 46
- **Status:** Planned
- **Priority:** High
- **Primary Service:** Integration Service
- **Supporting Services:** Orchestrator Agent, API Gateway, Auth Service
- **Effort:** Large (7–10 PT)
- **Dependencies:** Feature 47 (Secrets Management), Feature 48 (Container Image Scanner)

---

## 1. Overview

Generate auditor-ready compliance reports for SOC 2, HIPAA, and PCI-DSS frameworks. The system continuously collects evidence from infrastructure, maps controls to framework requirements, and produces exportable reports (PDF, HTML, JSON) suitable for external auditors.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        API Gateway                               │
│  POST /api/v1/compliance/reports  GET /api/v1/compliance/...     │
└──────────┬───────────────────────────────────────────────────────┘
           │
┌──────────▼───────────────────────────────────────────────────────┐
│                    Integration Service                            │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐  │
│  │ Framework Engine  │  │ Evidence Manager  │  │ Report Builder  │  │
│  │  • SOC 2          │  │  • Collectors     │  │  • Templates    │  │
│  │  • HIPAA          │  │  • Timestamps     │  │  • PDF/HTML     │  │
│  │  • PCI-DSS        │  │  • Integrity hash │  │  • JSON export  │  │
│  └────────┬─────────┘  └────────┬──────────┘  └────────┬───────┘  │
└──────────┬──────────────────────┬──────────────────────┬──────────┘
           │                      │                      │
           ▼                      ▼                      ▼
┌───────────────────┐  ┌───────────────────┐  ┌────────────────────┐
│  Control Mapper    │  │  Evidence Store   │  │  Report Store      │
│  • Control→Evidence│  │  • Immutable log  │  │  • Generated docs  │
│  • Gap detection   │  │  • Retention 7yr  │  │  • Signed PDFs     │
│  • Remediation     │  │  • Encrypted at   │  │  • Auditor portal  │
│    tracking        │  │    rest           │  │    (future)        │
└───────────────────┘  └───────────────────┘  └────────────────────┘
```

**Data Flow:**

1. **Evidence Collection** — Collectors run on a schedule (cron / event-driven) and gather evidence from cloud APIs, Kubernetes audit logs, container scan results, IAM policies, network configurations, and backup logs.
2. **Control Mapping** — The Control Mapper matches collected evidence against framework control requirements. Each control is linked to one or more evidence items.
3. **Gap Analysis** — Unmapped or failing controls are flagged. Remediation tickets can be auto-created.
4. **Report Generation** — Templates are hydrated with evidence and control status. Reports are timestamped, hashed, and signed.
5. **Export** — Reports are made available for download in PDF, HTML, and JSON formats.

---

## 3. Implementation Plan

### Phase 1 — Foundation (3 PT)
| Step | Description |
|------|-------------|
| 1.1  | Define framework data models (controls, evidence items, mappings) |
| 1.2  | Implement evidence store with append-only log semantics |
| 1.3  | Implement Control Mapper with pluggable framework definitions |
| 1.4  | Add evidence collection framework with cron trigger support |

### Phase 2 — Framework Coverage (2 PT)
| Step | Description |
|------|-------------|
| 2.1  | SOC 2 control definitions (security, availability, confidentiality) |
| 2.2  | HIPAA control definitions (administrative, physical, technical safeguards) |
| 2.3  | PCI-DSS control definitions (12 requirements mapped to evidence) |

### Phase 3 — Reporting & Export (2 PT)
| Step | Description |
|------|-------------|
| 3.1  | Report Builder with templating engine (Handlebars/Liquid) |
| 3.2  | PDF generation (wkhtmltopdf / Puppeteer) |
| 3.3  | JSON export for SIEM integration |
| 3.4  | Report digital signing and integrity verification |

### Phase 4 — Continuous Monitoring (2 PT)
| Step | Description |
|------|-------------|
| 4.1  | Real-time evidence stream (Kafka / NATS) |
| 4.2  | Automated gap detection alerts |
| 4.3  | Compliance dashboard API |
| 4.4  | Remediation workflow integration |

---

## 4. API Design

### 4.1 Frameworks

```
GET    /api/v1/compliance/frameworks              → List all frameworks
GET    /api/v1/compliance/frameworks/{id}         → Framework details + controls
POST   /api/v1/compliance/frameworks              → Register custom framework
```

### 4.2 Evidence

```
GET    /api/v1/compliance/evidence                → List evidence items
GET    /api/v1/compliance/evidence/{id}           → Evidence detail + integrity hash
POST   /api/v1/compliance/evidence                → Submit evidence (from collectors)
DELETE /api/v1/compliance/evidence/{id}           → Soft-delete (admin only)
```

### 4.3 Reports

```
POST   /api/v1/compliance/reports                 → Generate report
  Body: { framework_id, start_date, end_date, format: "pdf"|"html"|"json" }

GET    /api/v1/compliance/reports                 → List generated reports
GET    /api/v1/compliance/reports/{id}            → Report metadata + download URL
GET    /api/v1/compliance/reports/{id}/download   → Download report file
DELETE /api/v1/compliance/reports/{id}            → Archive report
```

### 4.4 Dashboard / Monitoring

```
GET    /api/v1/compliance/dashboard               → Compliance scores per framework
GET    /api/v1/compliance/gaps                    → Current control gaps
```

### 4.5 Example: Generate Report

```json
POST /api/v1/compliance/reports
{
  "framework_id": "soc2_type2",
  "start_date": "2026-01-01T00:00:00Z",
  "end_date": "2026-06-30T23:59:59Z",
  "format": "pdf",
  "include_evidence": true,
  "sign": true
}

Response 201:
{
  "report_id": "rpt_a1b2c3d4",
  "framework": "soc2_type2",
  "status": "generating",
  "download_url": "/api/v1/compliance/reports/rpt_a1b2c3d4/download",
  "expires_at": "2026-07-31T23:59:59Z"
}
```

---

## 5. Data Model

### 5.1 Framework

```yaml
Framework:
  id: string (uuid)
  name: string                          # "SOC 2 Type II"
  slug: string                          # "soc2_type2"
  version: string                       # "2025"
  controls: list<Control>
  created_at: timestamp
  updated_at: timestamp
```

### 5.2 Control

```yaml
Control:
  id: string (uuid)
  framework_id: string
  control_id: string                    # "CC6.1", "HIPAA.164.312(a)(1)"
  title: string
  description: string
  category: string                      # "Security" | "Availability" | "Confidentiality" | ...
  risk_level: string                    # "critical" | "high" | "medium" | "low"
  evidence_requirements: list<string>   # Evidence types that satisfy this control
```

### 5.3 Evidence

```yaml
Evidence:
  id: string (uuid)
  type: string                          # "audit_log" | "scan_result" | "iam_policy" | ...
  source: string                        # "kubernetes" | "aws_cloudtrail" | "vault" | ...
  collected_at: timestamp
  content_hash: string                  # SHA-256 of raw content
  raw_content: object                   # JSON blob
  retained_until: timestamp             # 7-year retention for PCI-DSS
```

### 5.4 Report

```yaml
Report:
  id: string (uuid)
  framework_id: string
  period_start: timestamp
  period_end: timestamp
  format: string                        # "pdf" | "html" | "json"
  status: string                        # "generating" | "ready" | "expired"
  evidence_count: integer
  control_summary:
    passed: integer
    failed: integer
    not_audited: integer
  download_url: string
  signed_by: string                     # Certificate fingerprint
  signed_at: timestamp
  created_at: timestamp
  expires_at: timestamp
```

---

## 6. Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Integration Service** | Framework engine, evidence collection orchestration, control mapper, report builder |
| **Orchestrator Agent** | Collect infrastructure-level evidence (K8s audit logs, container scan results, network policies) |
| **API Gateway** | Route /api/v1/compliance/*, enforce auth, rate-limit report generation |
| **Auth Service** | Validate access tokens, enforce RBAC (compliance_viewer, compliance_admin roles) |
| **Secrets (Feature 47)** | Store evidence collector API keys, signing certificates |

---

## 7. Effort Estimate

| Phase | PT | Dependencies |
|-------|----|--------------|
| Foundation | 3 | Data models, evidence store, collector framework |
| Framework Coverage | 2 | SOC 2, HIPAA, PCI-DSS control definitions |
| Reporting & Export | 2 | PDF/HTML/JSON generation, digital signing |
| Continuous Monitoring | 2 | Real-time streams, gap alerts, dashboard API |
| **Total** | **9** | Ranges 7–10 depending on framework depth |

---

## 8. Open Questions

- Should evidence be stored in immutable object storage (S3/GCS) or a database?
- What is the retention policy for intermediate evidence vs. final reports?
- Do we need support for custom (user-defined) frameworks beyond SOC 2 / HIPAA / PCI-DSS?
- Should report signing use an internal CA or integrate with external KMS?
- What is the acceptable latency for report generation (synchronous vs. async)?
