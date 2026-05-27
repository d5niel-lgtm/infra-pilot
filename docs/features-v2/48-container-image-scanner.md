# Feature 48: Container Image Scanner

- **Feature ID:** 48
- **Status:** Planned
- **Priority:** High
- **Primary Service:** Orchestrator Agent
- **Supporting Services:** Integration Service, API Gateway, Notification Service
- **Effort:** Medium (4–6 PT)
- **Dependencies:** Registry integration (Docker Hub, ECR, GCR, Harbor), Vulnerability database access

---

## 1. Overview

Integrate container image scanning (Trivy, Snyk, Grype) into the image pull / deployment pipeline. Each image is scanned for CVEs before deployment. Results include severity scoring, fix versions, and auto-remediation via pull request. Policy enforcement blocks deployments containing critical CVEs.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Registry (Docker Hub / ECR / GCR / Harbor)                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Image: myapp:v1.2.3                                            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Image pull / push
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Orchestrator Agent                                   │
│                                                                          │
│  ┌─────────────────┐   ┌─────────────────┐   ┌──────────────────────┐   │
│  │ Image Puller     │   │ Scanner Engine   │   │ Policy Enforcer      │   │
│  │ • Pull manifest  │──▶│ • Trivy          │──▶│ • Severity rules     │   │
│  │ • Resolve digest │   │ • Grype          │   │ • Block critical CVEs│   │
│  │ • Cache layer    │   │ • Snyk (API)     │   │ • Allowlist mgmt     │   │
│  └─────────────────┘   └────────┬─────────┘   └──────────────────────┘   │
└─────────────────────────────────┼────────────────────────────────────────┘
                                  │
                    ┌─────────────┼──────────────┐
                    │             │              │
                    ▼             ▼              ▼
┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐
│ CVE Database     │  │ Report Store     │  │ Remediation Engine       │
│ • Local cache    │  │ • Scan results   │  │ • Auto-create PR         │
│ • Daily updates  │  │ • Historical     │  │ • Suggest fix version    │
│ • NVD / GHSA     │  │ • Trend analysis │  │ • Update Dockerfile      │
└─────────────────┘  └─────────────────┘  └──────────────────────────┘
```

**Data Flow:**

1. **Trigger** — Scanning is triggered on image push to registry, pre-deployment, or on a schedule (re-scan).
2. **Pull & Digest** — The Orchestrator Agent pulls the image manifest and resolves the digest for cache-busting.
3. **Scan** — The Scanner Engine runs Trivy (and optionally Grype/Snyk) against the image. Results are normalized into a standard CVE format.
4. **Policy Evaluation** — The Policy Enforcer checks each finding against severity rules. Critical CVEs without an exception cause the deployment to be blocked.
5. **Reporting** — Results are stored in the Report Store. Notifications are sent via Slack/email/webhook.
6. **Remediation** — For fixable CVEs, the Remediation Engine can create a PR that updates base images or applies patches.

---

## 3. Implementation Plan

### Phase 1 — Scanning Foundation (2 PT)
| Step | Description |
|------|-------------|
| 1.1  | Integrate Trivy as the primary scanner (Go library / CLI) |
| 1.2  | Normalize scan results into a unified CVE schema |
| 1.3  | Implement CVE database cache with daily sync from NVD/GHSA |
| 1.4  | Add scan trigger on image push (registry webhook) |

### Phase 2 — Policy Engine (1.5 PT)
| Step | Description |
|------|-------------|
| 2.1  | Policy engine with YAML-based severity rules |
| 2.2  | Enforce "block on critical CVE" by default |
| 2.3  | Allowlist management (waived CVEs with expiry) |
| 2.4  | Integration with deployment pipeline (fail on policy violation) |

### Phase 3 — Reporting & Remediation (1.5 PT)
| Step | Description |
|------|-------------|
| 3.1  | Scan report storage (Postgres / S3) with historical tracking |
| 3.2  | Notification integration (Slack, email, webhook) |
| 3.3  | Remediation Engine — PR creation with fix version suggestions |
| 3.4  | Trend dashboard API (CVE counts over time, fix rate) |

### Phase 4 — Advanced Scanning (1 PT)
| Step | Description |
|------|-------------|
| 4.1  | Add Grype as secondary scanner for cross-validation |
| 4.2  | Add Snyk API integration (license compliance, SAST) |
| 4.3  | Multi-architecture image scanning (arm64, amd64) |
| 4.4  | SBOM generation (CycloneDX / SPDX) |

---

## 4. API Design

### 4.1 Scans

```
POST   /api/v1/scans                          → Trigger a scan
  Body: { image: "myapp:v1.2.3", registry: "dockerhub" }

GET    /api/v1/scans                          → List scan results
GET    /api/v1/scans/{id}                     → Scan detail + CVE list
GET    /api/v1/scans/{id}/summary             → Summary counts by severity
```

### 4.2 Policies

```
GET    /api/v1/policies                       → List scan policies
POST   /api/v1/policies                       → Create / update policy
DELETE /api/v1/policies/{id}                  → Remove policy
GET    /api/v1/policies/{id}/evaluate?image=  → Dry-run evaluation
```

### 4.3 Allowlist

```
GET    /api/v1/allowlist                      → List waived CVEs
POST   /api/v1/allowlist                      → Add CVE waiver
  Body: { cve_id, reason, expires_at }

DELETE /api/v1/allowlist/{id}
```

### 4.4 Remediation

```
POST   /api/v1/remediations                   → Auto-create remediation PR
  Body: { scan_id, cve_ids: ["CVE-2026-1234"] }

GET    /api/v1/remediations                   → List PRs created
```

### 4.5 Example: Trigger Scan

```json
POST /api/v1/scans
{
  "image": "ghcr.io/myorg/api-gateway:v2.5.1",
  "registry_credentials": {
    "type": "ghcr",
    "token_name": "SCAN_TOKEN"
  },
  "scanners": ["trivy", "grype"]
}

Response 201:
{
  "scan_id": "scan_abc123",
  "image": "ghcr.io/myorg/api-gateway:v2.5.1",
  "digest": "sha256:a1b2c3d4...",
  "status": "scanning",
  "created_at": "2026-05-27T10:30:00Z"
}
```

### 4.6 Example: Policy Evaluation Result

```json
{
  "scan_id": "scan_abc123",
  "image": "ghcr.io/myorg/api-gateway:v2.5.1",
  "policy": "default-strict",
  "evaluated_at": "2026-05-27T10:31:00Z",
  "action": "block",
  "summary": {
    "total": 12,
    "critical": 2,
    "high": 4,
    "medium": 4,
    "low": 2
  },
  "blocking_cves": [
    {
      "cve_id": "CVE-2026-1234",
      "severity": "critical",
      "package": "libssl3",
      "installed_version": "3.0.12",
      "fixed_version": "3.0.14",
      "description": "Buffer overflow in TLS handshake"
    }
  ],
  "remediation_suggestions": [
    {
      "type": "base_image_update",
      "current": "ubuntu:22.04",
      "suggested": "ubuntu:22.04-20260526"
    }
  ]
}
```

---

## 5. Data Model

### 5.1 Scan

```yaml
Scan:
  id: string (uuid)
  image: string                             # "myapp:v1.2.3"
  digest: string                            # sha256:...
  registry: string                          # "dockerhub" | "ecr" | "ghcr"
  scanners: list<string>                    # ["trivy", "grype"]
  status: string                            # "pending" | "scanning" | "completed" | "failed"
  summary:
    critical: integer
    high: integer
    medium: integer
    low: integer
    unknown: integer
  created_at: timestamp
  completed_at: timestamp
```

### 5.2 Vulnerability

```yaml
Vulnerability:
  id: string (uuid)
  scan_id: string
  cve_id: string                            # "CVE-2026-1234"
  severity: string                          # "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"
  score: float                              # CVSS v3 score 0.0–10.0
  package_name: string
  installed_version: string
  fixed_version: string                     # null if no fix available
  status: string                            # "fixed" | "will_not_fix" | "unknown"
  description: string
  cvss_vector: string                       # "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
  cwe_ids: list<string>
  exploit_available: boolean
  references: list<string>
```

### 5.3 Policy

```yaml
Policy:
  id: string (uuid)
  name: string                              # "default-strict"
  rules:
    - severity: "CRITICAL"
      action: "block"
      exceptions:
        - package: "openssl"
          max_score: 9.0
    - severity: "HIGH"
      action: "warn"
    - severity: "MEDIUM"
      action: "allow"
    - severity: "LOW"
      action: "allow"
  default_action: "allow"
  created_at: timestamp
  updated_at: timestamp
```

### 5.4 Allowlist Entry (Waiver)

```yaml
AllowlistEntry:
  id: string (uuid)
  cve_id: string
  reason: string
  waived_by: string
  expires_at: timestamp
  created_at: timestamp
```

### 5.5 Remediation PR

```yaml
RemediationPR:
  id: string (uuid)
  scan_id: string
  cve_ids: list<string>
  pr_url: string                            # GitHub/GitLab PR link
  pr_status: string                         # "open" | "merged" | "closed"
  base_image_update: object
  package_updates: list<object>
  created_at: timestamp
```

---

## 6. Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Orchestrator Agent** | Primary service — image pulling, scanner engine, policy enforcer, remediation PR creation |
| **Integration Service** | CVE database sync (NVD/GHSA), notification dispatch, trend analytics API |
| **API Gateway** | Route /api/v1/scans/* and /api/v1/policies/*, authenticate developers |
| **Notification Service** | Slack / email / webhook delivery on policy violations |
| **Compliance (Feature 46)** | Consume scan results as evidence for SOC 2 CC6.1 (patching) and CC7.1 (vulnerability management) |

---

## 7. Effort Estimate

| Phase | PT | Dependencies |
|-------|----|--------------|
| Scanning Foundation | 2 | Trivy integration, CVE database, push-trigger |
| Policy Engine | 1.5 | Severity rules, deployment blocking, allowlist |
| Reporting & Remediation | 1.5 | Reports, notifications, auto-PR creation |
| Advanced Scanning | 1 | Grype/Snyk, multi-arch, SBOM |
| **Total** | **6** | Ranges 4–6 depending on number of scanners integrated |

---

## 8. Open Questions

- Should we support on-premise registries (Harbor, Nexus) with air-gapped CVE databases?
- What is the SLA for CVE database freshness (4h / 12h / 24h)?
- How do we handle images with no known CVE database (distroless, scratch)?
- Should the auto-remediation PR be auto-merged on low-severity findings?
- Do we need integration with external ticketing systems (Jira, Linear) for critical CVEs?
- What is the strategy for handling false positives (noise reduction)?
