# Feature 7: AI Code Review Bot

| Field | Value |
|-------|-------|
| **ID** | F-007 |
| **Name** | AI Code Review Bot |
| **Category** | AI & Intelligence |
| **Primary Service** | Discord Service |
| **Effort** | Medium (4-6 PT) |
| **Dependencies** | Feature 13 (Webhook Event Bus), GitHub App registration |
| **Phase** | Phase 1 |

---

## Overview

The AI Code Review Bot listens for GitHub Pull Request webhook events, performs automated static analysis, security scanning, and configuration validation across the changed files, then posts a structured review summary directly to the configured Discord channel. It also updates the PR status with check results and inline comments.

### Goals

- Reduce code review cycle time by 40% through automated first-pass analysis
- Catch security issues, config mistakes, and API misuse before human review
- Deliver clear, actionable review summaries in Discord with severity breakdown
- Provide PR status checks that block merges on critical findings

### Non-Goals

- Not a replacement for human code review (AI findings are advisory)
- Does not auto-merge or auto-approve PRs
- Not a CI/CD pipeline — analysis runs parallel to existing CI
- Does not store full source code permanently (processes in memory, retains only metadata)

---

## Architecture

```
┌─────────────────┐     ┌─────────────────────────────────────────────────┐
│   GitHub         │     │                  Discord Service                │
│   (Webhook)      │     │                                                 │
│                  │     │  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  PR opened       │────▶│  │ Webhook  │  │ Analyzer │  │ Discord Bot  │  │
│  PR synchronized │     │  │ Receiver │──▶│ Pipeline │──▶│ Publisher    │  │
│  PR reopened     │     │  └──────────┘  └────┬─────┘  └──────┬───────┘  │
│  PR review       │     │                      │               │          │
└─────────────────┘     │                      ▼               │          │
                        │  ┌─────────────────────────────────┐  │          │
                        │  │        Analyzer Pipeline         │  │          │
                        │  │  ┌──────────┐  ┌──────────────┐ │  │          │
                        │  │  │ Security │  │ Config Check │ │  │          │
                        │  │  │ Scanner  │  │              │ │  │          │
                        │  │  ├──────────┤  ├──────────────┤ │  │          │
                        │  │  │ - secrets │  │ - YAML valid │ │  │          │
                        │  │  │ - vulns   │  │ - Dockerfile │ │  │          │
                        │  │  │ - deps    │  │ - CI config  │ │  │          │
                        │  │  │ - SAST    │  │ - API misuse │ │  │          │
                        │  │  └──────────┘  └──────────────┘ │  │          │
                        │  │  ┌──────────┐  ┌──────────────┐ │  │          │
                        │  │  │ Lint     │  │ AI Review    │ │  │          │
                        │  │  │ Checker  │  │ Engine       │ │  │          │
                        │  │  ├──────────┤  ├──────────────┤ │  │          │
                        │  │  │ - ESLint │  │ - diff       │ │  │          │
                        │  │  │ - Ruff   │  │   analysis   │ │  │          │
                        │  │  │ - style  │  │ - pattern    │ │  │          │
                        │  │  │   checks │  │   detection  │ │  │          │
                        │  │  └──────────┘  └──────────────┘ │  │          │
                        │  └─────────────────────────────────┘  │          │
                        │                                       │          │
                        │  ┌─────────────────────────────────┐  │          │
                        │  │         PR Status Manager       │  │          │
                        │  │  ┌──────────┐  ┌──────────────┐ │  │          │
                        │  │  │ Check    │  │ Inline       │ │  │          │
                        │  │  │ Runner   │  │ Commenter    │ │  │          │
                        │  │  └──────────┘  └──────────────┘ │  │          │
                        │  └─────────────────────────────────┘  │          │
                        └──────────────────────────────────────┘          │
                                     │                                    │
                                     ▼                                    │
                        ┌─────────────────────┐                          │
                        │     Discord          │                          │
                        │  #code-reviews       │◀─────────────────────────┘
                        │  ┌────────────────┐  │
                        │  │ 🔍 PR Review   │  │
                        │  │ #42: Fix       │  │
                        │  │ database pool  │  │
                        │  │ 🟡 3 warnings  │  │
                        │  │ 🔴 2 critical  │  │
                        │  └────────────────┘  │
                        └─────────────────────┘
```

### Event Flow

```
GitHub PR Event ──► Webhook Receiver
                       │
                       ├──► Validate signature (HMAC-SHA256)
                       ├──► Filter: only opened/synchronized/reopened
                       ├──► Fetch PR diff (GitHub API)
                       │
                       ▼
                Analyzer Pipeline (parallel)
                       │
                       ├──► Security Scanner
                       │     ├── Secret detection (gitleaks-style patterns)
                       │     ├── Dependency vulns (OSV API)
                       │     ├── SAST (semgrep rules)
                       │     └── Dockerfile scan (hadolint)
                       │
                       ├──► Config Checker
                       │     ├── YAML/JSON validation
                       │     ├── CI config linting
                       │     └── API usage pattern check
                       │
                       ├──► Lint Checker
                       │     ├── Language-specific linters
                       │     └── Style consistency
                       │
                       └──► AI Review Engine
                             ├── Diff understand (LLM)
                             ├── Logic error detection
                             └── Best practice suggestions
                       │
                       ▼
                Results Aggregator
                       │
                       ├──► Post Discord embed summary
                       ├──► Set GitHub commit status (pass/fail/pending)
                       └──► Add inline review comments (optional)
```

---

## Implementation Plan

### Phase 1: Webhook & Core Infrastructure (Week 1, 1.5 PT)

1. **GitHub Webhook Receiver**
   - HMAC-SHA256 signature verification
   - Event filtering (pull_request, pull_request_review)
   - Rate limiting (GitHub API best practices)
   - Queue-based processing (async to avoid webhook timeout)
   - Retry with exponential backoff

2. **GitHub API Client**
   - Fetch PR diff and metadata
   - Post commit status checks
   - Create review comments (inline + summary)
   - Authenticate via GitHub App installation token

3. **Discord Bot Publisher**
   - Rich embed message builder
   - Severity-colored embeds (green/yellow/red)
   - Action buttons (View PR, Approve, Request Changes placeholder)
   - Thread creation for detailed discussion per review

### Phase 2: Analysis Pipeline (Week 2-3, 2.5 PT)

1. **Security Scanner**
   - Secret/credential detection (regex + entropy analysis)
   - Dependency vulnerability lookup (OSV.dev API, GitHub Advisory DB)
   - Semgrep-based SAST with community rules
   - Dockerfile/Hadolint integration
   - Secrets detection for common patterns (AWS keys, tokens, connection strings)

2. **Config Checker**
   - YAML/JSON syntax and schema validation
   - CI/CD config linting (GitHub Actions, Docker Compose)
   - API misuse detection (known anti-patterns)
   - Infrastructure-as-code checks (Terraform, Helm, K8s manifests)

3. **Lint Checker**
   - Language detection from file extensions
   - Invoke language-specific linters (ESLint, Ruff, Clippy, etc.)
   - Aggregate and deduplicate results

4. **AI Review Engine**
   - LLM-based diff analysis
   - Context-aware code review (understand surrounding code)
   - Bug pattern detection (null pointer, race condition, resource leak)
   - Performance optimization suggestions
   - Rate-limited to avoid excessive API costs

### Phase 3: Comments & Status Integration (Week 3-4, 1.5 PT)

1. **PR Status Manager**
   - Map severity levels to GitHub check states:
     - Critical → failure (blocks merge)
     - Warning → neutral (advisory)
     - Info → success (informational)
   - Update status on each analysis pass
   - Handle re-analysis on new commits

2. **Inline Comment Engine**
   - Deduplicate comments across analysis runs
   - File+line anchored comments
   - Suggestion blocks with code fence
   - Batch create via GitHub Reviews API

3. **Discord UX Polish**
   - Customizable channel subscriptions per repo
   - Filter by minimum severity
   - Per-repository configuration command
   - Archive digests for large PRs (summary-only mode)

---

## API Design

### Internal Endpoints (Discord Service)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/webhooks/github` | GitHub webhook receiver |
| `GET`  | `/reviews/{reviewId}` | Get review details |
| `GET`  | `/reviews/{reviewId}/findings` | Get individual findings |
| `POST` | `/reviews/{reviewId}/reanalyze` | Trigger re-analysis |
| `GET`  | `/config/{guildId}/{repoId}` | Get review config for repo |
| `PATCH` | `/config/{guildId}/{repoId}` | Update review config |

### Webhook Payload (GitHub → Infra Pilot)

```json
{
  "event": "pull_request",
  "action": "opened",
  "signature": "sha256=abc123def456...",
  "payload": {
    "repository": {
      "full_name": "myorg/minecraft-server",
      "clone_url": "https://github.com/myorg/minecraft-server.git",
      "default_branch": "main"
    },
    "pull_request": {
      "number": 42,
      "title": "Fix database connection pool configuration",
      "head": {
        "sha": "abc123def456",
        "ref": "fix/db-pool",
        "repo": { "full_name": "myorg/minecraft-server" }
      },
      "base": {
        "sha": "789012abc345",
        "ref": "main",
        "repo": { "full_name": "myorg/minecraft-server" }
      },
      "user": { "login": "developer1" },
      "created_at": "2026-05-27T10:00:00Z",
      "changed_files": 12,
      "additions": 340,
      "deletions": 50
    }
  }
}
```

### Discord Embed Output

```json
{
  "embeds": [{
    "title": "🔍 Code Review: PR #42 — Fix database connection pool configuration",
    "url": "https://github.com/myorg/minecraft-server/pull/42",
    "color": 16776960,
    "fields": [
      {
        "name": "Repository",
        "value": "myorg/minecraft-server",
        "inline": true
      },
      {
        "name": "Author",
        "value": "developer1",
        "inline": true
      },
      {
        "name": "Branch",
        "value": "fix/db-pool → main",
        "inline": true
      },
      {
        "name": "Changes",
        "value": "+340 / -50 in 12 files",
        "inline": true
      },
      {
        "name": "🔴 Critical (2)",
        "value": "• Hardcoded database password in `config.yml:24`\n• SQL injection vulnerable query in `Queries.java:88`",
        "inline": false
      },
      {
        "name": "🟡 Warnings (3)",
        "value": "• Connection pool timeout set to 30s (recommended ≤ 5s) in `config.yml:12`\n• Unused import `java.util.Date` in `Server.java:3`\n• Missing `@Override` annotation in `Service.java:45`",
        "inline": false
      },
      {
        "name": "🟢 Info (4)",
        "value": "• Consider using try-with-resources in `Database.java:67`\n• Method `getPlayer()` could be static",
        "inline": false
      }
    ],
    "footer": {
      "text": "Infra Pilot AI Code Review • Analysis took 12.4s"
    },
    "timestamp": "2026-05-27T10:05:00Z"
  }]
}
```

---

## Data Model

```yaml
ReviewRequest:
  id: string (UUID)
  event: "pull_request" | "pull_request_review"
  action: string
  repository: Repository
  pull_request: PullRequest
  sender: User
  received_at: datetime
  status: "queued" | "processing" | "completed" | "failed"

Repository:
  full_name: string       # "myorg/minecraft-server"
  owner: string
  name: string
  clone_url: string
  default_branch: string
  installation_id: integer # GitHub App installation

PullRequest:
  number: integer
  title: string
  description: string
  head_sha: string
  head_ref: string
  base_sha: string
  base_ref: string
  author: string
  created_at: datetime
  changed_files: integer
  additions: integer
  deletions: integer

ReviewResult:
  id: string (UUID)
  review_request_id: string
  status: "in_progress" | "completed" | "failed"
  started_at: datetime
  completed_at: datetime
  duration_ms: integer
  findings: Finding[]
  summary:
    critical: integer
    warning: integer
    info: integer
    total: integer
  pr_status: "success" | "neutral" | "failure"

Finding:
  id: string (UUID)
  rule_id: string
  category: "security" | "config" | "lint" | "logic" | "performance" | "style"
  severity: "critical" | "warning" | "info"
  title: string
  description: string
  file: string
  line: integer
  column: integer
  snippet: string
  suggested_fix: string
  cve_id: string | null   # for dependency vulns
  cwe_id: string | null    # for security findings
  source: "semgrep" | "gitleaks" | "osv" | "hadolint" | "eslint" | "llm" | "builtin"

ReviewConfig:
  id: string (UUID)
  guild_id: string         # Discord guild
  channel_id: string       # Discord channel for summaries
  repo_pattern: string     # glob pattern for repos, e.g. "myorg/*"
  min_severity: string     # "info" | "warning" | "critical"
  inline_comments: boolean
  auto_approve: boolean    # approve on no critical findings
  blocked_severities: string[]  # severities that block merge
  enabled_checks: string[] # "security" | "config" | "lint" | "ai_review"
```

---

## Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Discord Service** | Primary: Webhook receiver, analyzer pipeline, Discord publisher, PR status manager |
| **Integration Service** | Secondary: GitHub API rate limiting coordination, webhook event bus routing |
| **Service Core** | None directly; authentication, user/repo permission checks |

---

## Effort Estimate

| Phase | Task | PT | Owner |
|-------|------|----|-------|
| P1 | GitHub webhook receiver + signature verification | 0.5 | Backend |
| P1 | GitHub API client (diff fetch, status, comments) | 0.5 | Backend |
| P1 | Discord embed publisher | 0.5 | Backend |
| P2 | Security scanner (secrets + vulns + SAST) | 1.0 | Backend/SecEng |
| P2 | Config checker + lint integrations | 0.5 | Backend |
| P2 | AI Review Engine (LLM integration) | 1.0 | ML/Backend |
| P3 | PR status manager + inline comments | 0.5 | Backend |
| P3 | Discord UX + per-repo config | 0.5 | Backend |
| P3 | Testing + edge case handling | 0.25 | QA |
| **Total** | | **5.25 PT** | |

---

## Configuration

### Discord Bot Commands

```
/review register repo:myorg/minecraft-server channel:#code-reviews
/review config repo:myorg/minecraft-server min-severity:warning
/review config repo:myorg/minecraft-server inline-comments:true
/review status repo:myorg/minecraft-server
/review ignore repo:myorg/minecraft-server file:"vendor/*"
```

### YAML Configuration Example

```yaml
# discord-service/config/code-review.yml
repositories:
  - pattern: "myorg/*"
    channel: "code-reviews"
    min_severity: "warning"
    inline_comments: true
    auto_approve: false
    blocked_severities:
      - "critical"
    enabled_checks:
      - security
      - config
      - lint
      - ai_review
    ignore_patterns:
      - "vendor/*"
      - "node_modules/*"
      - "*.generated.*"
      - "dist/*"
    custom_rules:
      - id: "no-hardcoded-aws-keys"
        pattern: "AKIA[0-9A-Z]{16}"
        severity: "critical"
        message: "AWS access key detected"
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| GitHub API rate limiting | Medium | Use GitHub App with higher limits; queue-based processing |
| LLM API latency/cost | Medium | Parallel analysis; cache results for identical diffs; set max tokens per review |
| False positives cause noise | High | Configurable severity thresholds; per-repo rule tuning; user feedback buttons |
| Webhook timeout (10s GitHub limit) | High | Acknowledge immediately; process async with status polling |
| Secret leak in transit/processing | Critical | Process in-memory only; no persistent storage of diffs; audit logging |

---

## Future Enhancements

- **v2.0**: Auto-fix suggestions with GitHub suggestions API
- **v2.1**: Learning mode — adapt to project-specific patterns
- **v2.2**: Multi-repo dashboard in Management Panel
- **v2.3**: GitLab/Bitbucket/Gitea support
- **v2.4**: Team performance analytics (review velocity, common issues)
- **v2.5**: Custom rule authoring UI
