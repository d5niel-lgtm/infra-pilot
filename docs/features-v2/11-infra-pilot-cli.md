# Feature 11: Infra Pilot CLI

- **Feature ID:** 11
- **Category:** Developer Ecosystem & API
- **Primary Service:** New `cli/` directory
- **Effort Estimate:** Large (7-10 PT)
- **Dependencies:** Stable REST API (v1), Authentication Service
- **Phase:** Phase 2 (Weeks 5-8)

---

## Overview

The **Infra Pilot CLI** (`ipilot`) is a command-line tool that provides authenticated access to the Infra Pilot API. It enables developers and operators to manage servers, deployments, databases, DNS records, and other infrastructure resources directly from the terminal. The CLI supports scripting, automation pipelines, and CI/CD integration.

### Goals

- Provide a fast, ergonomic CLI for all Infra Panel REST API operations
- Support multiple output formats (JSON, table, YAML) for both human and machine consumption
- Enable scripting and automation with non-interactive mode and exit codes
- Offer shell tab completion for bash, zsh, fish, and PowerShell
- Securely manage API tokens and multi-account profiles

### Non-Goals

- Replace the Management Panel UI for complex workflows
- Provide real-time terminal emulation (handled by Collaborative Terminal, Feature 27)
- Serve as an API gateway or rate-limiting layer

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Terminal                           │
│  ipilot server list --format json --region us-east          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  cli/                                                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Main Entry Point (cmd/root.go)                       │ │
│  │  - Cobra root command setup                           │ │
│  │  - Global flags (--format, --output, --profile)       │ │
│  │  - Config file loading (~/.ipilot/config.yaml)        │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │  Command Groups                                        │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │ │
│  │  │ server   │ │ deploy   │ │ logs     │ │ db       │  │ │
│  │  │ dns      │ │ backup   │ │ config   │ │ profile  │  │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │  API Client Layer (client/)                            │ │
│  │  - HTTP client with retry & timeout                    │ │
│  │  - Auth token injection                                │ │
│  │  - Request/response interceptors                       │ │
│  │  - Pagination helpers                                  │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │  Output Formatters (output/)                           │ │
│  │  - JSON formatter     - Table formatter                │ │
│  │  - YAML formatter     - Raw (ID-only) formatter        │ │
│  └────────────────────────┬───────────────────────────────┘ │
│                           │                                  │
│  ┌────────────────────────▼───────────────────────────────┐ │
│  │  Auth Module (auth/)                                   │ │
│  │  - Token storage (keyring / encrypted file)            │ │
│  │  - Login / logout flow                                 │ │
│  │  - Token refresh                                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌───────────────────────┐
              │  Infra Pilot REST API │
              │  (Integration Service) │
              └───────────────────────┘
```

### Directory Structure

```
cli/
├── main.go                    # Entry point
├── cmd/
│   ├── root.go                # Root command & global flags
│   ├── server.go              # ipilot server * subcommands
│   ├── deploy.go              # ipilot deploy
│   ├── logs.go                # ipilot logs (including --follow)
│   ├── db.go                  # ipilot db * subcommands
│   ├── dns.go                 # ipilot dns * subcommands
│   ├── backup.go              # ipilot backup * subcommands
│   ├── config.go              # ipilot config * (manage profile)
│   └── completion.go          # ipilot completion [bash|zsh|fish|powershell]
├── client/
│   ├── client.go              # HTTP client wrapper
│   ├── requests.go            # Request builders
│   ├── responses.go           # Response parsing
│   ├── middleware.go           # Auth injection, logging, retry
│   └── pagination.go          # Cursor/offset pagination
├── output/
│   ├── formatter.go           # Formatter interface
│   ├── json.go                # JSON formatter
│   ├── table.go               # Table formatter
│   ├── yaml.go                # YAML formatter
│   └── raw.go                 # Raw (ID list) formatter
├── auth/
│   ├── auth.go                # Auth flow
│   ├── token.go               # Token storage
│   └── login.go               # Device/login flow
├── config/
│   ├── config.go              # Config file read/write
│   └── defaults.go            # Default values
└── go.mod / go.sum
```

---

## Implementation Plan

### Phase A: Scaffolding & Auth (2-3 PT)

1. Initialize Go module and Cobra CLI structure
2. Implement `cmd/root.go` with global flags (`--format`, `--profile`, `--quiet`, `--verbose`)
3. Build `auth/` module with device-code OAuth flow
4. Implement token storage via OS keyring (fallback to encrypted file)
5. Add `ipilot login` and `ipilot logout` commands
6. Write config file management (`~/.ipilot/config.yaml`)

### Phase B: API Client Layer (2 PT)

1. Build `client/client.go` with configurable base URL, timeouts, retry
2. Implement request signing and auth header injection
3. Add response middleware for error handling and rate-limit awareness
4. Implement pagination helpers (cursor-based and offset-based)
5. Add request/response logging in verbose mode

### Phase C: Core Commands (2-3 PT)

1. Implement `ipilot server [list|show|create|delete|start|stop|restart]`
2. Implement `ipilot deploy [create|status|rollback]`
3. Implement `ipilot logs [service] --follow` with WebSocket streaming
4. Implement `ipilot db [list|create|backup|restore]`
5. Implement `ipilot dns [list|create|delete|update]`
6. Implement `ipilot backup [list|create|restore]`

### Phase D: Output Formatting & Completion (1-2 PT)

1. Build `output/` formatters with auto-detection based on `--format`
2. Implement table formatter with column auto-width
3. Add `--quiet` mode (single ID output for scripting)
4. Implement `ipilot completion [shell]` with all subcommands and flags
5. Add `IPILOT_FORMAT` and `IPILOT_PROFILE` environment variable support

---

## API Design

The CLI wraps the existing Infra Panel REST API. Key endpoints consumed:

### Server Operations

| Method | Endpoint | CLI Command |
|--------|----------|-------------|
| `GET` | `/api/v1/servers` | `ipilot server list` |
| `GET` | `/api/v1/servers/:id` | `ipilot server show <id>` |
| `POST` | `/api/v1/servers` | `ipilot server create [flags]` |
| `DELETE` | `/api/v1/servers/:id` | `ipilot server delete <id>` |
| `POST` | `/api/v1/servers/:id/start` | `ipilot server start <id>` |
| `POST` | `/api/v1/servers/:id/stop` | `ipilot server stop <id>` |
| `POST` | `/api/v1/servers/:id/restart` | `ipilot server restart <id>` |

### Deploy Operations

| Method | Endpoint | CLI Command |
|--------|----------|-------------|
| `POST` | `/api/v1/deployments` | `ipilot deploy create [flags]` |
| `GET` | `/api/v1/deployments/:id` | `ipilot deploy status <id>` |
| `POST` | `/api/v1/deployments/:id/rollback` | `ipilot deploy rollback <id>` |

### Logs

| Method | Endpoint | CLI Command |
|--------|----------|-------------|
| `GET` | `/api/v1/servers/:id/logs` | `ipilot logs <id>` |
| `WS` | `/api/v1/servers/:id/logs/stream` | `ipilot logs <id> --follow` |

---

## Data Model

### CLI Config File (`~/.ipilot/config.yaml`)

```yaml
current_profile: production
profiles:
  production:
    api_url: https://api.infrapanel.io
    default_format: table
    timeout_seconds: 30
  staging:
    api_url: https://staging.api.infrapanel.io
    default_format: json
    timeout_seconds: 60
```

### Token Storage

Tokens are stored in the OS keyring when available, falling back to an encrypted file at `~/.ipilot/tokens.json`:

```json
{
  "profiles": {
    "production": {
      "access_token": "ip_eyJhbGciOi...",
      "refresh_token": "ip_rf_abc123...",
      "expires_at": "2026-06-15T12:00:00Z",
      "token_type": "bearer"
    }
  }
}
```

---

## Service Assignments

| Component | Owner | Notes |
|-----------|-------|-------|
| CLI scaffolding & Cobra setup | Platform Team | Core CLI structure |
| Auth module | Security Team | OAuth flow, token storage |
| API client | Platform Team | HTTP client, retry, error handling |
| Server commands | Core Services Team | `ipilot server *` |
| Deploy commands | Orchestrator Team | `ipilot deploy *` |
| Logs streaming | Core Services Team | WebSocket `--follow` |
| Output formatters | Platform Team | JSON, table, YAML, raw |
| Tab completion | Platform Team | All shell variants |
| Documentation | Developer Experience | User guide, examples |
| E2E tests | QA | Integration test suite |

---

## Effort Estimate Breakdown

| Task | PT | Dependencies |
|------|----|-------------|
| CLI scaffolding & config | 1.5 | None |
| Auth module (login/logout/token) | 1.5 | Auth Service API |
| API client with retry | 1.5 | REST API spec |
| Server commands (CRUD + actions) | 1.0 | Server API |
| Deploy commands | 1.0 | Deploy API |
| Logs with --follow | 1.0 | Logs API, WebSocket |
| Output formatters | 1.0 | None |
| Tab completion | 0.5 | All commands defined |
| Documentation | 0.5 | All features implemented |
| E2E tests | 1.0 | CLI stable |
| **Total** | **10.0** | |

---

## Usage Examples

### Basic Usage

```bash
# List servers with table output
ipilot server list

# List servers with JSON output
ipilot server list --format json

# Create a server
ipilot server create --name web-01 --region us-east --plan standard-2

# View server details
ipilot server show srv_abc123 --format yaml

# Tail logs
ipilot logs srv_abc123 --follow

# Deploy an application
ipilot deploy create --service web --image nginx:1.25 --replicas 3

# Switch profile
ipilot config set-profile staging
```

### Scripting

```bash
#!/bin/bash
# Automate server creation with JSON output parsing
SERVER_ID=$(ipilot server create \
  --name "ci-runner-${BUILD_NUMBER}" \
  --region us-east \
  --plan standard-4 \
  --format json \
  --quiet)

echo "Created server: $SERVER_ID"
```

### Tab Completion

```bash
# Install completion for current shell
eval "$(ipilot completion zsh)"

# Or generate and source the script
ipilot completion bash > ~/.ipilot/completion.bash
source ~/.ipilot/completion.bash
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API version drift | CLI breaks on API update | Use API version negotiation (`Accept: application/vnd.infrapanel.v1+json`) |
| Token exposure on shared machines | Credential leak | OS keyring integration, token encryption at rest |
| Large output sets | Memory pressure | Streaming pagination, `--limit` flag, cursor-based iteration |
| WebSocket reconnection | Log stream interruption | Automatic reconnect with backoff, buffer management |

---

## Acceptance Criteria

- [ ] `ipilot login` completes device-code OAuth flow and stores token
- [ ] All server CRUD commands function correctly with JSON and table output
- [ ] `ipilot logs --follow` streams logs with < 2s latency and reconnects on disconnect
- [ ] `ipilot deploy create` accepts all required flags and returns deployment ID
- [ ] `--format json`, `--format yaml`, `--format table` produce correct output for every command
- [ ] Tab completion generates valid scripts for bash, zsh, fish, and PowerShell
- [ ] Exit codes: 0 for success, 1 for user error, 2 for API/server error
- [ ] Tests pass: unit (80%+ coverage), integration (all commands), E2E (happy path)
