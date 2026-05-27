# Feature 18: GraphQL API

- **Feature #:** 18
- **Category:** Developer Ecosystem & API
- **Primary Service:** Integration Service
- **Supporting Services:** Orchestrator Agent, Management Panel
- **Effort:** Medium (4-6 PT)
- **Dependencies:** Feature #14 (API Gateway & Rate Limiting), Feature #17 (OpenTelemetry Export)

---

## 1. Overview

The GraphQL API provides an optional GraphQL layer alongside the existing REST API. It enables clients to query exactly the data they need, receive real-time updates via subscriptions (WebSocket), and interact with the full Infra Pilot resource model through a single endpoint. The layer includes N+1 query prevention via DataLoader, authentication middleware, and support for schema stitching to compose multiple service schemas.

### Goals

- Single `/graphql` endpoint for all queries and mutations
- Real-time subscriptions for server events, logs, and metrics
- DataLoader-based batching to prevent N+1 query problems
- JWT-based auth middleware with field-level permission checking
- Schema stitching to compose schemas from Integration Service, Orchestrator Agent, and Service Core
- Backward compatible — existing REST API unchanged; GraphQL is additive

### Non-Goals

- Replacing REST API entirely (REST remains primary, GraphQL is optional)
- Automatic schema generation from REST endpoints (hand-written schema with resolvers)
- Federated GraphQL (Apollo Federation) in v1 — schema stitching is simpler
- GraphQL as a BFF (Backend for Frontend) — the schema is general-purpose

---

## 2. Architecture

### High-Level Component Diagram

```
┌──────────────────┐       ┌──────────────────────────────────────────┐
│   Client         │       │        Integration Service                │
│   (GraphQL)      │       │                                          │
│                  │       │  ┌──────────────────────────────────────┐ │
│  Queries         │──────►│  │        GraphQL Server (Yoga)         │ │
│  Mutations       │       │  │                                      │ │
│  Subscriptions   │◄──────┤  │  ┌──────────┐  ┌──────────────────┐  │ │
│                  │       │  │  │ Schema   │  │ Auth Middleware   │  │ │
└──────────────────┘       │  │  │ (Stitched)│  │ (JWT + RBAC)     │  │ │
                           │  │  └────┬─────┘  └──────────────────┘  │ │
                           │  │       │                               │ │
                           │  │       ▼                               │ │
                           │  │  ┌──────────────────────────────────┐ │ │
                           │  │  │      Resolvers                   │ │ │
                           │  │  │  ┌────────┐  ┌───────────────┐  │ │ │
                           │  │  │  │ Query  │  │ Mutation      │  │ │ │
                           │  │  │  │ ────── │  │ ────────────  │  │ │ │
                           │  │  │  │ servers│  │ createServer  │  │ │ │
                           │  │  │  │ server │  │ deleteServer  │  │ │ │
                           │  │  │  │ logs   │  │ updateConfig  │  │ │ │
                           │  │  │  │ metrics│  │ deployBackup  │  │ │ │
                           │  │  │  └───┬────┘  └───────┬───────┘  │ │ │
                           │  │  │      │               │           │ │ │
                           │  │  │      ▼               ▼           │ │ │
                           │  │  │  ┌─────────────────────────┐     │ │ │
                           │  │  │  │     DataLoader Cache     │     │ │ │
                           │  │  │  │  (batches + caches per  │     │ │ │
                           │  │  │  │   request context)      │     │ │ │
                           │  │  │  └────────┬────────────────┘     │ │ │
                           │  │  │           │                       │ │ │
                           │  │  └───────────┼───────────────────────┘ │ │
                           │  └──────────────┼─────────────────────────┘ │
                           │                 │                           │
                           └─────────────────┼───────────────────────────┘
                                             │
               ┌─────────────────────────────┼─────────────────────────────┐
               │              ┌──────────────┴──────────────┐              │
               │              ▼              ▼              ▼              │
               │     ┌────────────┐  ┌──────────────┐  ┌──────────┐       │
               │     │REST API    │  │Orchestrator  │  │Service   │       │
               │     │(Integration│  │Agent (Python)│  │Core(Java)│       │
               │     │ Service)   │  │              │  │          │       │
               │     └────────────┘  └──────────────┘  └──────────┘       │
               │                                                          │
               └──────────────────────────────────────────────────────────┘
```

### Request Lifecycle

```
1. Client sends GraphQL query to POST /graphql (or WebSocket for subscriptions)
2. Auth middleware extracts JWT, attaches user + permissions to context
3. GraphQL engine parses query, validates against schema
4. Resolvers execute, batching via DataLoader where applicable
5. For stitched schemas, delegation to downstream services
6. Response assembled and returned (JSON for queries, stream for subscriptions)
```

### Subscription Transport

```
WebSocket Connection (graphql-ws protocol)
       │
       ▼
Client sends connection_init (with auth token)
       │
       ▼
Server validates → acknowledge
       │
       ▼
Client subscribes:
  subscription {
    serverEvents(serverId: "srv_web_01") {
      type
      message
      timestamp
    }
  }
       │
       ▼
Server registers subscription → publishes events via
Integration Service event bus (Redis Pub/Sub)
       │
       ▼
Event occurs → GraphQL server pushes to subscribed clients
       │
       ▼
Client receives:
  {
    "data": {
      "serverEvents": {
        "type": "STATUS_CHANGE",
        "message": "Server web-01 is now running",
        "timestamp": "2026-05-20T12:00:00Z"
      }
    }
  }
```

---

## 3. Data Model

### GraphQL Schema (Core)

```graphql
# ============================================================
# Types
# ============================================================

type Server {
  id: ID!
  name: String!
  provider: Provider!
  region: String!
  plan: String!
  status: ServerStatus!
  cpuCores: Int!
  memoryMb: Int!
  diskGb: Int!
  image: String
  ipAddress: String
  tags: [String!]!
  firewall: [FirewallRule!]
  backups: [Backup!]
  metrics: ServerMetrics
  createdAt: DateTime!
  updatedAt: DateTime!
}

type Backup {
  id: ID!
  serverId: ID!
  status: BackupStatus!
  sizeBytes: Int
  type: BackupType!
  createdAt: DateTime!
  completedAt: DateTime
}

type ServerMetrics {
  cpuUsage: Float
  memoryUsage: Float
  diskUsage: Float
  networkIn: Int
  networkOut: Int
  uptime: Int
  sampledAt: DateTime
}

type FirewallRule {
  protocol: String!
  port: Int
  source: String!
  action: FirewallAction!
}

type DnsRecord {
  id: ID!
  zone: String!
  name: String!
  type: DnsRecordType!
  value: String!
  ttl: Int!
  proxied: Boolean!
}

type Deployment {
  id: ID!
  serverId: ID!
  status: DeploymentStatus!
  type: String!
  errorMessage: String
  startedAt: DateTime!
  completedAt: DateTime
}

type LogEntry {
  timestamp: DateTime!
  level: LogLevel!
  message: String!
  service: String
  traceId: String
}

type User {
  id: ID!
  email: String!
  name: String!
  role: UserRole!
  permissions: [String!]!
  createdAt: DateTime!
}

# ============================================================
# Enums
# ============================================================

enum ServerStatus { PROVISIONING RUNNING STOPPED ERROR SUSPENDED TERMINATED }
enum BackupStatus { PENDING RUNNING COMPLETED FAILED }
enum BackupType { FULL INCREMENTAL SNAPSHOT }
enum FirewallAction { ALLOW DENY }
enum DnsRecordType { A AAAA CNAME MX TXT SRV }
enum DeploymentStatus { PENDING RUNNING SUCCEEDED FAILED ROLLED_BACK }
enum LogLevel { DEBUG INFO WARN ERROR FATAL }
enum UserRole { ADMIN OPERATOR DEVELOPER VIEWER }

# ============================================================
# Input Types
# ============================================================

input CreateServerInput {
  name: String!
  provider: Provider!
  region: String!
  plan: String!
  cpuCores: Int
  memoryMb: Int
  diskGb: Int
  image: String
  tags: [String!]
  firewall: [FirewallRuleInput!]
}

input FirewallRuleInput {
  protocol: String!
  port: Int
  source: String!
  action: FirewallAction!
}

input ServerFilter {
  status: ServerStatus
  provider: Provider
  tag: String
  search: String
}

input PaginationInput {
  page: Int = 1
  perPage: Int = 20
}

# ============================================================
# Query
# ============================================================

type Query {
  # Server queries
  servers(filter: ServerFilter, pagination: PaginationInput): ServerConnection!
  server(id: ID!): Server
  serverByName(name: String!): Server

  # Backup queries
  backups(serverId: ID!, pagination: PaginationInput): BackupConnection!
  backup(id: ID!): Backup

  # DNS queries
  dnsRecords(zone: String, pagination: PaginationInput): DnsRecordConnection!
  dnsRecord(id: ID!): DnsRecord

  # Deployment queries
  deployments(serverId: ID, pagination: PaginationInput): DeploymentConnection!
  deployment(id: ID!): Deployment

  # Log queries
  logs(
    serverId: ID!,
    level: LogLevel,
    from: DateTime,
    to: DateTime,
    search: String,
    pagination: PaginationInput
  ): LogConnection!

  # Metrics queries
  metrics(
    serverId: ID!,
    from: DateTime!,
    to: DateTime!,
    interval: String!
  ): [ServerMetrics!]!

  # User queries
  me: User!
  users(pagination: PaginationInput): UserConnection!

  # Health
  health: HealthStatus!
}

# ============================================================
# Mutations
# ============================================================

type Mutation {
  # Server mutations
  createServer(input: CreateServerInput!): ServerPayload!
  updateServer(id: ID!, input: UpdateServerInput!): ServerPayload!
  deleteServer(id: ID!): DeletePayload!
  startServer(id: ID!): ServerPayload!
  stopServer(id: ID!): ServerPayload!
  restartServer(id: ID!): ServerPayload!

  # Backup mutations
  createBackup(serverId: ID!, type: BackupType!): BackupPayload!
  restoreBackup(id: ID!): BackupPayload!
  deleteBackup(id: ID!): DeletePayload!

  # DNS mutations
  createDnsRecord(input: CreateDnsRecordInput!): DnsRecordPayload!
  updateDnsRecord(id: ID!, input: UpdateDnsRecordInput!): DnsRecordPayload!
  deleteDnsRecord(id: ID!): DeletePayload!

  # Deployment mutations
  triggerDeployment(serverId: ID!, type: String!, config: JSON): DeploymentPayload!
  rollbackDeployment(id: ID!): DeploymentPayload!
}

# ============================================================
# Subscriptions
# ============================================================

type Subscription {
  # Real-time server events
  serverEvents(serverId: ID): ServerEvent!
  serverLogs(serverId: ID!, level: LogLevel): LogEntry!
  serverMetrics(serverId: ID!, interval: String!): ServerMetrics!

  # Global events
  deploymentEvents: DeploymentEvent!
  alertEvents: AlertEvent!
}

# ============================================================
# Event Types (for subscriptions)
# ============================================================

type ServerEvent {
  type: ServerEventType!
  serverId: ID!
  message: String!
  timestamp: DateTime!
  data: JSON
}

enum ServerEventType {
  STATUS_CHANGE
  RESOURCE_UPDATE
  BACKUP_COMPLETE
  ERROR
  ALERT
}

type DeploymentEvent {
  type: DeploymentEventType!
  deploymentId: ID!
  serverId: ID!
  status: DeploymentStatus!
  message: String
  timestamp: DateTime!
}

type AlertEvent {
  id: ID!
  severity: String!
  title: String!
  message: String!
  resourceType: String
  resourceId: String
  timestamp: DateTime!
}

# ============================================================
# Connection Types (pagination wrappers)
# ============================================================

type ServerConnection { edges: [ServerEdge!]! pageInfo: PageInfo! totalCount: Int! }
type ServerEdge { node: Server! cursor: String! }
type BackupConnection { edges: [BackupEdge!]! pageInfo: PageInfo! totalCount: Int! }
type BackupEdge { node: Backup! cursor: String! }
type DnsRecordConnection { edges: [DnsRecordEdge!]! pageInfo: PageInfo! totalCount: Int! }
type DnsRecordEdge { node: DnsRecord! cursor: String! }
type DeploymentConnection { edges: [DeploymentEdge!]! pageInfo: PageInfo! totalCount: Int! }
type DeploymentEdge { node: Deployment! cursor: String! }
type LogConnection { edges: [LogEdge!]! pageInfo: PageInfo! totalCount: Int! }
type LogEntryEdge { node: LogEntry! cursor: String! }
type UserConnection { edges: [UserEdge!]! pageInfo: PageInfo! totalCount: Int! }
type UserEdge { node: User! cursor: String! }

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# ============================================================
# Payloads
# ============================================================

type ServerPayload { server: Server! success: Boolean! errors: [Error!] }
type BackupPayload { backup: Backup! success: Boolean! errors: [Error!] }
type DnsRecordPayload { dnsRecord: DnsRecord! success: Boolean! errors: [Error!] }
type DeploymentPayload { deployment: Deployment! success: Boolean! errors: [Error!] }
type DeletePayload { success: Boolean! errors: [Error!] }

type Error { field: String message: String! code: String! }

type HealthStatus {
  status: String!
  version: String!
  uptime: Int!
  services: [ServiceStatus!]!
}

type ServiceStatus { name: String! status: String! latency: Int! }

# ============================================================
# Scalars
# ============================================================

scalar DateTime
scalar JSON
scalar Provider
```

---

## 4. API Design

### Endpoints

| Endpoint | Protocol | Description |
|----------|----------|-------------|
| `POST /api/v2/graphql` | HTTP | GraphQL queries and mutations |
| `GET /api/v2/graphql` | HTTP | GraphiQL IDE (development mode) |
| `ws://host/api/v2/graphql` | WebSocket | GraphQL subscriptions (graphql-ws) |

### Authentication

The auth middleware extracts the JWT from the `Authorization` header (HTTP) or connection params (WebSocket):

```json
// HTTP Request
POST /api/v2/graphql
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "query": "query { servers { id name status } }",
  "variables": {}
}

// WebSocket connection_init
{
  "type": "connection_init",
  "payload": {
    "token": "<jwt_token>"
  }
}
```

### Query Examples

**Get servers with nested backups and metrics:**

```graphql
query GetServers {
  servers(filter: { status: RUNNING }, pagination: { page: 1, perPage: 10 }) {
    totalCount
    edges {
      node {
        id
        name
        status
        cpuCores
        memoryMb
        tags
        metrics {
          cpuUsage
          memoryUsage
        }
        backups(pagination: { page: 1, perPage: 3 }) {
          edges {
            node {
              id
              status
              createdAt
            }
          }
        }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

**Single server with logs:**

```graphql
query GetServerWithLogs($id: ID!) {
  server(id: $id) {
    id
    name
    status
    ipAddress
    firewall { protocol port source action }
  }
  logs(serverId: $id, level: ERROR, from: "2026-05-20T00:00:00Z", to: "2026-05-20T23:59:59Z") {
    edges {
      node {
        timestamp
        level
        message
        traceId
      }
    }
  }
}
```

**Create server mutation:**

```graphql
mutation CreateServer($input: CreateServerInput!) {
  createServer(input: $input) {
    server {
      id
      name
      status
      provider
      ipAddress
    }
    errors {
      field
      message
    }
  }
}
```

### Subscription Examples

**Listen to all server events:**

```graphql
subscription WatchServerEvents {
  serverEvents {
    type
    serverId
    message
    timestamp
    data
  }
}
```

**Listen to error logs for a specific server:**

```graphql
subscription WatchServerErrors($serverId: ID!) {
  serverLogs(serverId: $serverId, level: ERROR) {
    timestamp
    message
    traceId
  }
}
```

**Listen to real-time metrics stream:**

```graphql
subscription WatchMetrics($serverId: ID!) {
  serverMetrics(serverId: $serverId, interval: "1m") {
    cpuUsage
    memoryUsage
    diskUsage
    sampledAt
  }
}
```

---

## 5. Implementation Plan

### Phase 1: GraphQL Server Setup & Schema (Week 1, 2 PT)

| Task | Service | Description |
|------|---------|-------------|
| 1.1 | Integration Service | Install GraphQL Yoga (or Apollo Server), configure HTTP + WebSocket |
| 1.2 | Integration Service | Define core GraphQL schema (type definitions + resolvers) |
| 1.3 | Integration Service | Implement auth middleware (JWT extraction, RBAC context) |
| 1.4 | Integration Service | Set up GraphiQL IDE (development only) |
| 1.5 | Integration Service | Configure rate limiting per query complexity |

**Deliverables:** GraphQL endpoint operational with core schema and auth.

### Phase 2: Resolvers & DataLoader (Weeks 1-2, 1.5 PT)

| Task | Service | Description |
|------|---------|-------------|
| 2.1 | Integration Service | Implement query resolvers (servers, backups, logs, metrics, DNS, deployments) |
| 2.2 | Integration Service | Implement mutation resolvers (CRUD for all resource types) |
| 2.3 | Integration Service | Create DataLoader instances for N+1 prevention (server → backups, server → metrics, etc.) |
| 2.4 | Integration Service | Add field-level permission checks in resolvers |
| 2.5 | Integration Service | Add query complexity analysis and depth limiting |

**Deliverables:** All queries and mutations functional with DataLoader batching.

### Phase 3: Subscriptions (Week 2-3, 1.5 PT)

| Task | Service | Description |
|------|---------|-------------|
| 3.1 | Integration Service | Implement WebSocket transport (graphql-ws) |
| 3.2 | Integration Service | Create PubSub adapter backed by Redis |
| 3.3 | Integration Service | Implement subscription resolvers (serverEvents, serverLogs, serverMetrics, deploymentEvents, alertEvents) |
| 3.4 | Integration Service | Add WebSocket auth (connection_init token validation) |
| 3.5 | Integration Service | Implement subscription filtering (per-server, per-level) |
| 3.6 | Management Panel | Demo: live-updating dashboard via subscriptions |

**Deliverables:** Real-time subscriptions operational for events, logs, and metrics.

### Phase 4: Schema Stitching (Week 3, 1 PT)

| Task | Service | Description |
|------|---------|-------------|
| 4.1 | Orchestrator Agent | Expose internal GraphQL schema (or REST → GQL schema mapping) |
| 4.2 | Service Core | Expose internal GraphQL schema (or REST → GQL schema mapping) |
| 4.3 | Integration Service | Implement schema stitching (merge schemas from multiple services) |
| 4.4 | Integration Service | Add delegation resolvers for remote schemas |

**Deliverables:** Stitched schema combining data from Integration Service, Orchestrator Agent, and Service Core.

### Phase 5: Testing & Documentation (Week 4, 0.5 PT)

| Task | Service | Description |
|------|---------|-------------|
| 5.1 | All | Integration tests for all query/mutation/subscription paths |
| 5.2 | Integration Service | Query performance testing (N+1 prevention verification) |
| 5.3 | Integration Service | Load testing (concurrent subscriptions, high-frequency metrics) |
| 5.4 | Shared | API documentation (GraphQL schema docs, example queries) |

**Deliverables:** Tested and documented GraphQL API.

---

## 6. DataLoader Strategy

### Batch Loading Patterns

```
Without DataLoader (N+1 problem):
  Query: servers { backups { id } }
  DB calls:
    1. SELECT * FROM servers                  (1 query)
    10. SELECT * FROM backups WHERE server_id = 'srv_01'  (10 queries!)
    11. SELECT * FROM backups WHERE server_id = 'srv_02'
    ...

With DataLoader:
  DB calls:
    1. SELECT * FROM servers                  (1 query)
    2. SELECT * FROM backups WHERE server_id IN ('srv_01', 'srv_02', ...)  (1 query)
```

### DataLoader Instances

| Loader | Key | Batch Function | Cache Scope |
|--------|-----|----------------|-------------|
| `serverLoader` | `server.id` | `SELECT * FROM servers WHERE id IN ($keys)` | Per-request |
| `backupLoader` | `server.id` | `SELECT * FROM backups WHERE server_id IN ($keys)` | Per-request |
| `dnsLoader` | `dns.id` | `SELECT * FROM dns_records WHERE id IN ($keys)` | Per-request |
| `deploymentLoader` | `server.id` | `SELECT * FROM deployments WHERE server_id IN ($keys)` | Per-request |
| `userLoader` | `user.id` | `SELECT * FROM users WHERE id IN ($keys)` | Per-request |
| `metricsLoader` | `server.id` | Batch fetch from Prometheus/InfluxDB | Per-request |

---

## 7. Service Assignments

| Service | Responsibilities |
|---------|-----------------|
| **Integration Service** | GraphQL server (Yoga/Apollo), schema definition, resolver implementation, DataLoader batching, WebSocket subscriptions, auth middleware, query complexity analysis, schema stitching orchestrator |
| **Orchestrator Agent** | Expose internal GraphQL schema (or REST endpoints consumed by resolvers), publish events for subscription topics |
| **Management Panel** | GraphQL client integration (Apollo Client or URQL), subscription hooks for live-updating UI, demo dashboards |
| **Service Core** | Expose internal GraphQL schema for game-server-specific types |

---

## 8. Configuration Example

**infrapilot.yaml** (GraphQL configuration):

```yaml
graphql:
  enabled: true
  path: /api/v2/graphql
  playground: false  # GraphiQL IDE — enable only in dev
  auth:
    required: true
    jwt_secret_env: JWT_SECRET
  subscriptions:
    enabled: true
    path: /api/v2/graphql
    protocol: graphql-ws
    keepalive_interval_secs: 10
    max_subscriptions_per_connection: 50
  query:
    max_depth: 8
    max_complexity: 1000
    max_batch_size: 25
  dataloader:
    cache: true
    cache_ttl_ms: 5000  # per-request cache, not shared
  stitching:
    enabled: true
    services:
      - name: orchestrator
        url: http://orchestrator:8000/graphql
      - name: service-core
        url: http://service-core:8080/graphql
  rate_limiting:
    queries_per_minute: 120
    mutations_per_minute: 30
    complexity_per_minute: 5000
```

---

## 9. Effort Estimate

| Phase | PT | Dependencies |
|-------|----|-------------|
| Phase 1: GraphQL Server Setup & Schema | 2.0 | Feature #14 (API Gateway & Rate Limiting) |
| Phase 2: Resolvers & DataLoader | 1.5 | Phase 1 |
| Phase 3: Subscriptions | 1.5 | Phase 1, Redis |
| Phase 4: Schema Stitching | 1.0 | Phase 1, Orchestrator Agent GQL schema |
| Phase 5: Testing & Documentation | 0.5 | Phases 1-4 |
| **Buffer (15%)** | **0.9** | — |
| **Total** | **~7.4 PT** | — |

### Risk Factors

- **Subscription scaling:** Each WebSocket connection consumes memory; long-lived subscriptions for 1000+ concurrent users need horizontal scaling with sticky sessions or a shared PubSub
- **Schema stitching complexity:** Type conflicts across service schemas (e.g., different `Server` types) require manual merge configuration
- **Performance:** Deeply nested queries without DataLoader can cause cascading DB load; complexity analysis must be strict
- **WebSocket proxy:** Load balancers (Nginx, HAProxy) must be configured for WebSocket upgrade and long-lived connections

---

## 10. Security & Compliance

- JWT required for all queries, mutations, and subscriptions
- Field-level authorization: users can only query resources they have permission for
- Query complexity limits prevent abusive queries (malicious or accidental)
- Subscription rate limiting: max N subscriptions per connection, throttled event delivery
- Input validation: all mutation inputs sanitized and validated against schema
- Depth limiting prevents deeply nested recursive queries
- TLS required in production for both HTTP and WebSocket transports
- Audit logging for all mutations (who performed what action)
