# Feature 6: AI Config Advisor

| Field | Value |
|-------|-------|
| **ID** | F-006 |
| **Name** | AI Config Advisor |
| **Category** | AI & Intelligence |
| **Primary Service** | Management Panel |
| **Effort** | Medium (4-6 PT) |
| **Dependencies** | Feature 13 (Webhook Event Bus), Feature 14 (API Gateway) |
| **Phase** | Phase 1 |

---

## Overview

The AI Config Advisor analyzes server configuration files (JVM flags, YAML, properties, TOML, JSON) against a comprehensive database of best practices. It identifies suboptimal settings, security risks, and performance bottlenecks, then presents clear recommendations with a one-click apply mechanism including diff preview.

### Goals

- Reduce server misconfiguration incidents by 60%
- Surface 10+ actionable recommendations per average server scan
- Enable one-click safe application of config changes
- Provide clear before/after diff for every suggested change

### Non-Goals

- Not a configuration management system (no continuous sync)
- Does not modify configs without explicit user approval
- Not responsible for runtime config reload — applies changes to files only

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Management Panel (Frontend)                   │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐  ┌────────────┐ │
│  │ Config   │  │ Scan Results │  │ Diff     │  │ One-Click │ │
│  │ Explorer │  │ Dashboard    │  │ Viewer   │  │ Apply      │ │
│  └────┬─────┘  └──────┬───────┘  └────┬─────┘  └─────┬──────┘ │
└───────┼───────────────┼───────────────┼───────────────┼────────┘
        │               │               │               │
┌───────▼───────────────▼───────────────▼───────────────▼────────┐
│                    Management Panel (API / Backend)              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Config Fetcher   │  │ Rule Engine      │  │ Apply Engine   │ │
│  │ ┌──────────────┐ │  │ ┌──────────────┐ │  │ ┌────────────┐ │ │
│  │ │SSH Connector │ │  │ │Pattern Match │ │  │ │Backup      │ │ │
│  │ │API Connector │ │  │ │Value Check   │ │  │ │File Patch  │ │ │
│  │ │File Upload   │ │  │ │Cross-ref     │ │  │ │Rollback    │ │ │
│  │ └──────────────┘ │  │ └──────────────┘ │  │ └────────────┘ │ │
│  └──────────────────┘  └────────┬─────────┘  └────────────────┘ │
└─────────────────────────────────┼───────────────────────────────┘
                                  │
┌─────────────────────────────────▼───────────────────────────────┐
│                       Rule Engine Backend                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │ JVM Rule   │  │ YAML Rule  │  │ Security   │  │ Performance│ │
│  │ Set        │  │ Set        │  │ Rule Set   │  │ Rule Set   │ │
│  ├────────────┤  ├────────────┤  ├────────────┤  ├────────────┤ │
│  │-Xmx sizing │  │indent      │  │open ports  │  │pool sizes  │ │
│  │GC tuning   │  │anchor dup  │  │credentials │  │timeout     │ │
│  │heap ratio  │  │schema valid│  │tls version │  │buffer sizes│ │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │               Best Practice Database                        │ │
│  │  (versioned, curated, community-contributable rules)        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User clicks "Scan" ──► Config Fetcher retrieves files
                           │
                           ▼
                    Rule Engine matches rules
                           │
                           ▼
                    Results ranked by severity/impact
                           │
                           ▼
                    User reviews in Diff Viewer
                           │
                    ┌──────┴──────┐
                    ▼              ▼
              Apply All     Select Individual
                    │              │
                    ▼              ▼
              Backup original ──► Patch file
                           │
                           ▼
                    Apply result notification
```

---

## Implementation Plan

### Phase 1: Core Engine (Week 1-2, 2 PT)

1. **Config Parser Library** — Build parsers for:
   - JVM flags (`-X`, `-XX:` notation)
   - YAML/TOML/JSON (using existing libraries)
   - Java `.properties` files
   - `.env` files
   - Generic key=value formats
   - XML (server.xml, web.xml)

2. **Config Fetcher Module**
   - SSH-based file retrieval (agentless)
   - API-based fetch for agent-managed servers
   - Direct file upload from Panel
   - Git repository source support

3. **Data Model** — Implement `ConfigurationFile`, `ConfigEntry`, `Rule`, `RuleResult` models (see below)

### Phase 2: Rule Engine & Database (Week 2-3, 1.5 PT)

1. **Rule Engine** — Build with:
   - Pattern matching (regex, JSONPath, JMESPath, XPath)
   - Value comparison (range, set membership, semantic version)
   - Cross-file reference checks
   - Context-aware rules (e.g., "if X is set, Y should also be set")

2. **Best Practice Database**
   - 50+ curated v1 rules
   - Versioned rule schema with semantic versioning
   - Community contribution pipeline
   - Auto-update mechanism

3. **Rule Categories**

| Category | Example Rules | Source |
|----------|--------------|--------|
| JVM Memory | `-Xmx` should not exceed 80% of available RAM | Oracle docs |
| JVM GC | Use G1GC for heaps >4 GB, ZGC for >32 GB | OpenJDK |
| YAML Style | 2-space indentation, no tab characters | YAML spec |
| Security | No hardcoded passwords, TLS 1.2+ only | OWASP |
| Performance | Connection pool size ≤ (core_count * 2) + 1 | HikariCP |
| Minecraft | `view-distance` ≤ 10 for <4 GB RAM, simulation-distance ≤ view-distance | PaperMC |

### Phase 3: Apply Engine & UI (Week 3-4, 2.5 PT)

1. **Apply Engine**
   - Automatic file backup before any modification
   - Atomic file patching with verification
   - Rollback mechanism (undo last apply)
   - Dry-run mode (no changes, just report what would change)

2. **Diff Viewer** — Side-by-side diff with:
   - Syntax-highlighted before/after
   - Line-level change highlighting
   - Accept/reject per change
   - Comment annotation

3. **Dashboard Integration**
   - Scan history with trend tracking
   - Configuration health score (0-100)
   - Exportable reports (PDF, HTML)
   - Scheduled recurring scans

---

## API Design

### Endpoints

All endpoints are prefixed with `/api/v2/config-advisor`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/scan` | Trigger a new config scan for a server |
| `GET`  | `/scan/{scanId}` | Get scan results |
| `GET`  | `/scan/{scanId}/diff/{recommendationId}` | Get diff for a specific recommendation |
| `POST` | `/scan/{scanId}/apply` | Apply selected or all recommendations |
| `POST` | `/scan/{scanId}/apply/{recommendationId}` | Apply a single recommendation |
| `POST` | `/scan/{scanId}/rollback` | Rollback last apply operation |
| `GET`  | `/rules` | List available rules |
| `POST` | `/rules` | Add a custom rule |
| `GET`  | `/history` | Get scan history for a server |
| `GET`  | `/health-score` | Get configuration health score |

### Request/Response Examples

**POST /api/v2/config-advisor/scan**

```json
{
  "server_id": "srv-a1b2c3d4",
  "source": "ssh",
  "ssh_config": {
    "host": "192.168.1.100",
    "port": 22,
    "username": "root",
    "auth_method": "key",
    "key_id": "key-xyz789"
  },
  "include_patterns": [
    "*.yml", "*.yaml", "*.properties",
    "*.json", "*.toml", "*.env",
    "*.sh", "*.bat"
  ],
  "exclude_patterns": [
    "*/logs/*", "*/cache/*", "*/plugins/*"
  ],
  "options": {
    "dry_run": false,
    "severity_threshold": "info",
    "max_recommendations": 50
  }
}
```

**Response**

```json
{
  "scan_id": "scan-20260527-abc123",
  "status": "completed",
  "server_id": "srv-a1b2c3d4",
  "scanned_at": "2026-05-27T14:30:00Z",
  "files_scanned": 24,
  "total_entries": 847,
  "recommendations": [
    {
      "id": "rec-001",
      "rule_id": "jvm-xmx-ratio",
      "category": "JVM Memory",
      "severity": "warning",
      "title": "JVM max heap too large for available memory",
      "description": "-Xmx is set to 12 GB but available RAM is 8 GB",
      "file": "/etc/infrapilot/server.conf",
      "line": 12,
      "current_value": "-Xmx12g",
      "suggested_value": "-Xmx6g",
      "impact": "risk",
      "effort": "low"
    },
    {
      "id": "rec-002",
      "rule_id": "yaml-indent",
      "category": "YAML Style",
      "severity": "info",
      "title": "Inconsistent indentation",
      "description": "Mixing 2-space and 4-space indentation in server.yml",
      "file": "/opt/minecraft/server.yml",
      "line": 47,
      "current_value": "    view-distance: 12",
      "suggested_value": "  view-distance: 12",
      "impact": "style",
      "effort": "low"
    }
  ],
  "health_score": {
    "overall": 62,
    "categories": {
      "JVM Memory": 45,
      "YAML Style": 80,
      "Security": 55,
      "Performance": 70
    }
  },
  "summary": {
    "critical": 0,
    "warning": 1,
    "info": 3,
    "style": 2
  }
}
```

---

## Data Model

### Core Entities

```yaml
ConfigurationFile:
  id: string (UUID)
  server_id: string
  path: string
  format: "yaml" | "json" | "toml" | "properties" | "jvm_flags" | "env" | "xml"
  content_hash: string (SHA-256)
  size_bytes: integer
  last_modified: datetime
  entries: ConfigEntry[]

ConfigEntry:
  id: string (UUID)
  file_id: string
  key: string          # e.g. "java.options.Xmx"
  value: string
  line_number: integer
  line_content: string
  context_before: string[]
  context_after: string[]

Rule:
  id: string (UUID)
  name: string
  rule_id: string      # machine-readable, e.g. "jvm-xmx-ratio"
  version: string      # semver
  category: string
  severity: "critical" | "warning" | "info" | "style"
  scope: "single_file" | "cross_file" | "cross_server"
  conditions: Condition[]
  remediation: Remediation
  metadata:
    author: string
    source: string     # URL or reference
    tags: string[]
    created: datetime
    updated: datetime

Condition:
  type: "pattern" | "value_range" | "value_set" | "exists" | "not_exists" | "cross_reference"
  target: string       # JSONPath/XPATH/key expression
  operator: string     # "matches", "eq", "lt", "gt", "in", "not_in", etc.
  value: any

Remediation:
  suggested_value: string | null
  template: string     # template string with placeholders
  warning: string      # optional warning before applying
  restart_required: boolean

RuleResult:
  id: string (UUID)
  scan_id: string
  rule_id: string
  file_id: string
  status: "pass" | "fail" | "skip" | "error"
  severity: string
  title: string
  description: string
  current_value: string
  suggested_value: string
  diff: Diff
  applied: boolean
  applied_at: datetime | null
  rollback_available: boolean

Diff:
  hunks: DiffHunk[]

DiffHunk:
  file_path: string
  old_start: integer
  old_lines: string[]
  new_start: integer
  new_lines: string[]

Scan:
  id: string (UUID)
  server_id: string
  status: "pending" | "running" | "completed" | "failed"
  source: "ssh" | "api" | "upload" | "git"
  triggered_by: string
  started_at: datetime
  completed_at: datetime
  results: RuleResult[]
  health_score: integer
```

---

## Rule Examples

### JVM Memory Rule (YAML definition)

```yaml
rule_id: jvm-xmx-ratio
version: "1.0.0"
category: JVM Memory
severity: warning
scope: single_file
conditions:
  - type: pattern
    target: "lines"
    operator: "matches"
    value: "-Xmx\\d+[gGmM]"
  - type: value_range
    target: "parsed.xmx_bytes"
    operator: "gt"
    value: "{{ server.ram_bytes * 0.8 }}"
remediation:
  suggested_value: "-Xmx{{ (server.ram_bytes * 0.6) | filesizeformat }}"
  warning: "Reducing heap may require GC tuning adjustment"
  restart_required: true
metadata:
  author: "Infra Pilot Team"
  source: "https://docs.oracle.com/javase/8/docs/technotes/guides/vm/gctuning/"
  tags: ["jvm", "memory", "heap"]
```

### Security: Hardcoded Credential Detection

```yaml
rule_id: sec-hardcoded-credential
version: "1.1.0"
category: Security
severity: critical
scope: single_file
conditions:
  - type: pattern
    target: "entries"
    operator: "matches"
    value: "(password|secret|token|apikey|api_key)\\s*[=:]\\s*['\"]?[^'\"\\s]{8,}"
remediation:
  suggested_value: null
  warning: "Replace with environment variable or secret manager reference. Do NOT auto-apply."
  restart_required: false
metadata:
  author: "Infra Pilot Team"
  source: "https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html"
  tags: ["security", "credentials", "secrets"]
```

---

## Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Management Panel** | Primary: Config fetch orchestration, rule engine, apply engine, UI, diff viewer, scan history |
| **Integration Service** | Secondary: Webhook notifications on scan complete, export report delivery |
| **Orchestrator Agent** | Secondary: Agent-based config collection for managed servers |
| **Service Core** | None directly; authentication/authorization shared |

---

## Effort Estimate

| Phase | Task | PT | Owner |
|-------|------|----|-------|
| P1 | Config parser library | 1.0 | Backend |
| P1 | Config fetcher module | 0.5 | Backend |
| P1 | Core data model | 0.5 | Backend |
| P2 | Rule engine | 1.0 | Backend |
| P2 | Best practice DB (50 rules) | 0.5 | Backend/DevOps |
| P3 | Apply engine + backup/rollback | 0.75 | Backend |
| P3 | Diff viewer UI | 0.75 | Frontend |
| P3 | Dashboard integration | 0.5 | Frontend |
| P3 | Scheduled scans | 0.25 | Backend |
| P3 | Export reports | 0.25 | Backend/Frontend |
| **Total** | | **6.0 PT** | |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| SSH connection failures for config fetch | Medium | Fallback to manual upload; retry with backoff |
| False positives from rule engine | High | Allow per-rule silencing; user feedback loop to improve rules |
| Destructive apply on critical config | High | Mandatory backup before apply; preview diff; rollback always available |
| Rule database becomes stale | Medium | Auto-update mechanism; deprecate outdated rules; community contributions |
| Cross-file rules are complex | Medium | Ship v1 with single-file rules only; cross-file in v2 |

---

## Future Enhancements

- **v2.0**: Cross-file and cross-server rule analysis
- **v2.1**: ML-driven custom rule suggestions based on past changes
- **v2.2**: Config drift detection (config vs. runtime state)
- **v2.3**: Team-shared rule sets and compliance baselines
- **v2.4**: Ansible/Puppet/Chef manifest analysis
- **v2.5**: Auto-remediation workflows with approval gates
