# Feature 12: Terraform Provider

- **Feature ID:** 12
- **Category:** Developer Ecosystem & API
- **Primary Service:** New `infra/terraform/` directory
- **Effort Estimate:** Large (7-10 PT)
- **Dependencies:** Stable REST API (v1), Feature 11 (CLI) for shared API client patterns
- **Phase:** Phase 2 (Weeks 5-8)

---

## Overview

The **Terraform Provider for Infra Pilot** (`terraform-provider-infrapilot`) enables infrastructure-as-code management of Infra Pilot resources — servers, databases, DNS records, and firewall rules — via HashiCorp Terraform. Users define their infrastructure declaratively in HCL and manage the full lifecycle through `terraform plan`, `terraform apply`, and `terraform destroy`.

### Goals

- Provide Terraform resources for all core Infra Panel entities (server, database, DNS, firewall, backup)
- Support full CRUD lifecycle with import capability
- Generate valid HCL and JSON plan output for CI/CD pipelines
- Include comprehensive acceptance tests with real API interactions
- Maintain provider documentation via `terraform docs`-compatible format

### Non-Goals

- Manage Kubernetes clusters (handled by Feature 19)
- Replace the existing REST API or CLI
- Provide Terraform CDK (Cloud Development Kit) bindings

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                 Terraform CLI                              │
│  terraform plan / terraform apply / terraform destroy      │
└──────────────────────────┬─────────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────────┐
│  infra/terraform/                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Provider Configuration                              │  │
│  │  provider "infrapilot" {                             │  │
│  │    api_url  = var.infrapilot_api_url                 │  │
│  │    api_token = var.infrapilot_api_token              │  │
│  │  }                                                   │  │
│  └────────────────────────┬─────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼─────────────────────────────┐  │
│  │  Resource & Data Source Definitions                  │  │
│  │  ┌────────────┐ ┌────────────┐ ┌───────────────┐    │  │
│  │  │ infrapilot │ │ infrapilot │ │ infrapilot_dns│    │  │
│  │  │ _server    │ │ _database  │ │ _record       │    │  │
│  │  └────────────┘ └────────────┘ └───────────────┘    │  │
│  │  ┌──────────────┐ ┌───────────────┐                 │  │
│  │  │ infrapilot   │ │ infrapilot    │                 │  │
│  │  │ _firewall    │ │ _backup       │                 │  │
│  │  └──────────────┘ └───────────────┘                 │  │
│  └────────────────────────┬─────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼─────────────────────────────┐  │
│  │  API Client (internal/client/)                       │  │
│  │  - Terraform-plugin-go HTTP client                   │  │
│  │  - Auth token management                             │  │
│  │  - Retry & error handling                            │  │
│  │  - Request/response mapping                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────▼─────────────────────────────┐  │
│  │  Acceptance Tests (tests/acc/)                       │  │
│  │  - Real API test suite                               │  │
│  │  - Resource lifecycle validation                     │  │
│  │  - Import state testing                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌───────────────────────────┐
              │  Infra Pilot REST API     │
              │  (Integration Service)     │
              └───────────────────────────┘
```

### Directory Structure

```
infra/terraform/
├── main.go                      # Provider registration
├── provider.go                  # Provider schema & configuration
├── go.mod / go.sum
├── docs/
│   ├── index.md                 # Provider documentation
│   ├── resources/
│   │   ├── server.md            # infrapilot_server resource docs
│   │   ├── database.md          # infrapilot_database resource docs
│   │   ├── dns_record.md        # infrapilot_dns_record resource docs
│   │   ├── firewall_rule.md     # infrapilot_firewall_rule resource docs
│   │   └── backup.md            # infrapilot_backup resource docs
│   └── data-sources/
│       ├── server.md            # infrapilot_server data source docs
│       └── image.md             # infrapilot_image data source docs
├── internal/
│   ├── client/
│   │   ├── client.go            # API client
│   │   ├── server.go            # Server API methods
│   │   ├── database.go          # Database API methods
│   │   ├── dns.go               # DNS API methods
│   │   ├── firewall.go          # Firewall API methods
│   │   └── backup.go            # Backup API methods
│   ├── resources/
│   │   ├── resource_server.go    # Server resource CRUD
│   │   ├── resource_database.go  # Database resource CRUD
│   │   ├── resource_dns.go       # DNS record resource CRUD
│   │   ├── resource_firewall.go  # Firewall rule resource CRUD
│   │   └── resource_backup.go    # Backup resource CRUD
│   ├── datasources/
│   │   ├── datasource_server.go  # Server data source
│   │   └── datasource_image.go   # Image data source
│   └── models/
│       ├── server.go             # Server model types
│       ├── database.go           # Database model types
│       └── ...
└── tests/
    └── acc/
        ├── server_test.go        # Server acceptance tests
        ├── database_test.go      # Database acceptance tests
        ├── dns_test.go           # DNS acceptance tests
        ├── firewall_test.go      # Firewall acceptance tests
        └── backup_test.go        # Backup acceptance tests
```

---

## Implementation Plan

### Phase A: Provider Scaffolding (2 PT)

1. Initialize Go module with `terraform-plugin-framework` (v1+) — the modern SDK
2. Implement `provider.go` with provider schema: `api_url`, `api_token`, `timeout`
3. Build `internal/client/client.go` — generic HTTP client wrapping the REST API
4. Implement authentication, request signing, error mapping to Terraform diagnostics
5. Register the provider in `main.go` using `tf6server` protocol

### Phase B: Server Resource (2 PT)

1. Implement `infrapilot_server` resource schema with all attributes (name, region, plan, image, ssh_keys, tags, etc.)
2. Implement CRUD handlers mapping to REST endpoints
3. Add plan modifiers (RequiresReplace, plan-time validation)
4. Implement `ReadContext` with refresh logic for external changes
5. Add import support (`ImporterState`)

### Phase C: Database & DNS Resources (2 PT)

1. Implement `infrapilot_database` — database type, version, storage size, backups
2. Implement `infrapilot_dns_record` — zone, name, type, TTL, value
3. Implement `infrapilot_firewall_rule` — direction, protocol, ports, source/dest CIDR
4. Implement `infrapilot_backup` — schedule, retention, target

### Phase D: Data Sources & Acceptance Tests (2-3 PT)

1. Implement `infrapilot_server` data source (lookup by name or ID)
2. Implement `infrapilot_image` data source (available OS images)
3. Write acceptance tests for each resource with real API calls
4. Add test sweepers for cleanup
5. Generate Terraform Registry documentation

### Phase E: CI & Publishing (1 PT)

1. Configure GitHub Actions for cross-compilation (linux/amd64, linux/arm64, darwin/amd64, darwin/arm64)
2. Add GPG signing for release artifacts
3. Publish to Terraform Registry via automated workflow
4. Write quickstart guide and example configurations

---

## Resource Schema Design

### `infrapilot_server`

```hcl
resource "infrapilot_server" "web" {
  name        = "web-01"
  region      = "us-east"
  plan        = "standard-2"
  image       = "ubuntu-22.04"
  ssh_keys    = ["ssh-ed25519 AAAAC3..."]
  tags        = ["web", "production"]
  
  backups {
    enabled  = true
    schedule = "daily"
    retention_days = 14
  }
  
  monitoring {
    alerts_enabled = true
    cpu_threshold  = 90
    mem_threshold  = 85
  }
}
```

**Schema attributes:**

| Attribute | Type | Required | ForceNew | Description |
|-----------|------|----------|----------|-------------|
| `name` | string | yes | no | Server hostname |
| `region` | string | yes | yes | Deployment region |
| `plan` | string | yes | no | Resource plan slug |
| `image` | string | yes | yes | OS image slug |
| `ssh_keys` | list(string) | no | no | SSH public keys |
| `tags` | set(string) | no | no | Resource tags |
| `backups` | object | no | no | Backup configuration |
| `monitoring` | object | no | no | Monitoring thresholds |
| `id` | string | computed | - | Server ID |
| `status` | string | computed | - | Current status |
| `ipv4_address` | string | computed | - | Public IPv4 |
| `created_at` | string | computed | - | Creation timestamp |

### `infrapilot_dns_record`

```hcl
resource "infrapilot_dns_record" "www" {
  zone     = "example.com"
  name     = "www"
  type     = "A"
  ttl      = 300
  value    = "203.0.113.10"
}
```

### `infrapilot_database`

```hcl
resource "infrapilot_database" "main" {
  name         = "app-db"
  engine       = "postgres"
  version      = "16"
  plan         = "db-standard-2"
  storage_gb   = 100
  auto_backup  = true
}
```

---

## API Design

The provider maps to the existing Infra Pilot REST API. Each resource implements Terraform's CRUD lifecycle:

| Resource | Create | Read | Update | Delete |
|----------|--------|------|--------|--------|
| `infrapilot_server` | `POST /api/v1/servers` | `GET /api/v1/servers/:id` | `PUT /api/v1/servers/:id` | `DELETE /api/v1/servers/:id` |
| `infrapilot_database` | `POST /api/v1/databases` | `GET /api/v1/databases/:id` | `PUT /api/v1/databases/:id` | `DELETE /api/v1/databases/:id` |
| `infrapilot_dns_record` | `POST /api/v1/dns/records` | `GET /api/v1/dns/records/:id` | `PUT /api/v1/dns/records/:id` | `DELETE /api/v1/dns/records/:id` |
| `infrapilot_firewall_rule` | `POST /api/v1/firewall/rules` | `GET /api/v1/firewall/rules/:id` | `PUT /api/v1/firewall/rules/:id` | `DELETE /api/v1/firewall/rules/:id` |
| `infrapilot_backup` | `POST /api/v1/backups` | `GET /api/v1/backups/:id` | `PUT /api/v1/backups/:id` | `DELETE /api/v1/backups/:id` |

### Error Handling

Terraform API errors are mapped to Terraform diagnostics:

```go
if resp.StatusCode == http.StatusNotFound {
    tflog.Warn(ctx, "Resource not found, removing from state", map[string]any{"id": id})
    resp.State.RemoveResource(ctx)
    return diags
}

if resp.StatusCode == http.StatusTooManyRequests {
    retryAfter := resp.Header.Get("Retry-After")
    return diags.AddError("API Rate Limited",
        fmt.Sprintf("Rate limited. Retry after %s seconds", retryAfter))
}
```

---

## Data Model

### Internal Model (Example: Server)

```go
type ServerModel struct {
    ID          types.String `tfsdk:"id"`
    Name        types.String `tfsdk:"name"`
    Region      types.String `tfsdk:"region"`
    Plan        types.String `tfsdk:"plan"`
    Image       types.String `tfsdk:"image"`
    SSHKeys     types.List   `tfsdk:"ssh_keys"`
    Tags        types.Set    `tfsdk:"tags"`
    Status      types.String `tfsdk:"status"`
    IPv4Address types.String `tfsdk:"ipv4_address"`
    CreatedAt   types.String `tfsdk:"created_at"`
    Backups     types.Object `tfsdk:"backups"`
    Monitoring  types.Object `tfsdk:"monitoring"`
}
```

### JSON Plan Output Example

```json
{
  "format_version": "1.2",
  "terraform_version": "1.9.0",
  "planned_values": {
    "root_module": {
      "resources": [
        {
          "address": "infrapilot_server.web",
          "mode": "managed",
          "type": "infrapilot_server",
          "name": "web",
          "provider_name": "registry.terraform.io/infrapilot/infrapilot",
          "schema_version": 0,
          "values": {
            "name": "web-01",
            "region": "us-east",
            "plan": "standard-2",
            "image": "ubuntu-22.04",
            "tags": ["web", "production"],
            "backups": {
              "enabled": true,
              "schedule": "daily",
              "retention_days": 14
            }
          }
        }
      ]
    }
  }
}
```

---

## Service Assignments

| Component | Owner | Notes |
|-----------|-------|-------|
| Provider scaffolding | Platform Team | SDK setup, provider config |
| Server resource | Core Services Team | CRUD + import |
| Database resource | Core Services Team | CRUD + import |
| DNS resource | Core Services Team | CRUD + import |
| Firewall resource | Security Team | CRUD + import |
| Backup resource | Core Services Team | CRUD + import |
| API client | Platform Team | Shared HTTP client layer |
| Acceptance tests | QA | Real API test suite |
| CI/CD & publishing | DevOps | Cross-compile, GPG sign, registry |
| Documentation | Developer Experience | Registry docs, examples |

---

## Effort Estimate Breakdown

| Task | PT | Dependencies |
|------|----|-------------|
| Provider scaffolding & SDK setup | 1.5 | None |
| API client layer | 1.0 | REST API spec |
| Server resource (CRUD + import) | 1.5 | Server API |
| Database resource | 1.0 | Database API |
| DNS record resource | 0.5 | DNS API |
| Firewall rule resource | 0.5 | Firewall API |
| Backup resource | 0.5 | Backup API |
| Data sources | 0.5 | Server/Image API |
| Acceptance tests | 1.5 | All resources stable |
| CI/CD cross-compile & registry | 1.0 | GPG key, registry account |
| Documentation | 0.5 | All resources done |
| **Total** | **9.5** | |

---

## Usage Examples

### Basic Provider Configuration

```hcl
terraform {
  required_providers {
    infrapilot = {
      source  = "infrapilot/infrapilot"
      version = "~> 1.0"
    }
  }
}

provider "infrapilot" {
  api_url   = var.infrapilot_api_url
  api_token = var.infrapilot_api_token
}

variable "infrapilot_api_url" {
  type = string
  default = "https://api.infrapanel.io"
}

variable "infrapilot_api_token" {
  type      = string
  sensitive = true
}
```

### Complete Example: Web Application Stack

```hcl
# Look up available image
data "infrapilot_image" "ubuntu" {
  slug = "ubuntu-22.04"
}

# Create server
resource "infrapilot_server" "web" {
  name     = "web-01"
  region   = "us-east"
  plan     = "standard-2"
  image    = data.infrapilot_image.ubuntu.id
  ssh_keys = [var.ssh_key]
  tags     = ["web", "production"]
  
  monitoring {
    alerts_enabled = true
    cpu_threshold  = 80
  }
}

# Create database
resource "infrapilot_database" "main" {
  name       = "app-db"
  engine     = "postgres"
  version    = "16"
  plan       = "db-standard-2"
  storage_gb = 50
}

# Create DNS record
resource "infrapilot_dns_record" "www" {
  zone  = "example.com"
  name  = "www"
  type  = "A"
  ttl   = 300
  value = infrapilot_server.web.ipv4_address
}

# Create firewall rule
resource "infrapilot_firewall_rule" "allow_https" {
  server_id = infrapilot_server.web.id
  direction = "inbound"
  protocol  = "tcp"
  port      = 443
  cidr      = "0.0.0.0/0"
}

output "web_ip" {
  value = infrapilot_server.web.ipv4_address
}
```

### Import Existing Resources

```bash
terraform import infrapilot_server.web srv_abc123
terraform import infrapilot_database.main db_xyz789
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API rate limits during `terraform plan` | Failed runs, degraded UX | Implement client-side caching of read responses during plan |
| Resource drift between `apply` and external changes | State inconsistency | Use `ReadContext` to refresh state before every plan |
| Breaking API changes | Provider incompatibility | API version negotiation, provider version constraints |
| Long-running server creation | Timeout during `apply` | Use state polling with configurable timeout in resource `Create` |
| State file contains sensitive data | Credential exposure | Mark API token and passwords as `Sensitive: true` in schema |

---

## Acceptance Criteria

- [ ] Provider compiles for linux/amd64, linux/arm64, darwin/amd64, darwin/arm64
- [ ] `provider "infrapilot"` configuration validates API token and URL
- [ ] All 5 resources support full CRUD lifecycle via acceptance tests
- [ ] Resource import works for all resource types
- [ ] Data sources return correct results for server and image lookups
- [ ] Plan modifiers correctly detect force-new changes (region, image change)
- [ ] Sensitive fields are marked and redacted in logs/state
- [ ] Terraform Registry documentation renders correctly with all examples
- [ ] CI pipeline produces signed releases with GPG
- [ ] E2E test: `terraform apply` + `terraform destroy` completes without manual steps
