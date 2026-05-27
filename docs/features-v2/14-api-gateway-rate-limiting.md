# Feature 14: API Gateway & Rate Limiting

- **Feature ID:** 14
- **Category:** Developer Ecosystem & API
- **Primary Service:** Integration Service
- **Effort Estimate:** Medium (4-6 PT)
- **Dependencies:** Existing REST API (v1), Authentication Service
- **Phase:** Phase 2 (Weeks 5-8)

---

## Overview

The **API Gateway & Rate Limiting** system provides a centralized gateway layer for all Infra Pilot API traffic. It enforces per-key rate limiting, usage quotas, and request logging while managing the full lifecycle of API keys. This enables secure, observable, and fair multi-tenant API access suitable for both human operators and automated systems.

### Goals

- Central API gateway routing all `/api/v1/*` traffic through a unified entry point
- Per-key rate limiting using token bucket algorithm (configurable burst and sustained rates)
- Usage quotas (daily/monthly request caps) with configurable overage behavior
- Full request/response logging for audit and debugging
- API key management with creation, rotation, revocation, and scoping
- Usage analytics and quota alerts

### Non-Goals

- Service-to-service internal routing (handled by existing service mesh)
- DDoS protection at the network level (handled by CDN/WAF, Feature 23)
- Authentication or identity management (delegated to Auth Service)
- Caching layer or CDN integration

---

## Architecture

```
                         ┌─────────────────────────┐
                         │     External Clients     │
                         │  (CLI, Terraform, Apps)  │
                         └───────────┬─────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────┐
│                    API Gateway (Integration Service)               │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Gateway Proxy Layer                                       │   │
│  │  - TLS termination                                         │   │
│  │  - Request routing by path prefix                          │   │
│  │  - API key extraction (header/query)                       │   │
│  │  - Request/response transform                              │   │
│  └──────────────────────────┬─────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼─────────────────────────────────┐   │
│  │  API Key Authentication                                    │   │
│  │  - Validate X-API-Key header                               │   │
│  │  - Check key status (active/revoked/expired)               │   │
│  │  - Resolve key -> owner, tier, permissions                 │   │
│  └──────────────────────────┬─────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼─────────────────────────────────┐   │
│  │  Rate Limiter (Token Bucket)                               │   │
│  │  ┌──────────────┐  ┌──────────────┐                       │   │
│  │  │ Per-Key       │  │ Per-IP       │                       │   │
│  │  │ Rate Limiter  │  │ Rate Limiter │                       │   │
│  │  └──────────────┘  └──────────────┘                       │   │
│  │  ┌──────────────┐  ┌──────────────┐                       │   │
│  │  │ Per-Endpoint  │  │ Global       │                       │   │
│  │  │ Rate Limiter  │  │ Rate Limiter │                       │   │
│  │  └──────────────┘  └──────────────┘                       │   │
│  └──────────────────────────┬─────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼─────────────────────────────────┐   │
│  │  Quota Enforcement                                        │   │
│  │  - Daily/monthly usage tracking                           │   │
│  │  - Overage strategies: block, warn, bill                  │   │
│  │  - Usage reset cron                                       │   │
│  └──────────────────────────┬─────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼─────────────────────────────────┐   │
│  │  Request/Response Log                                     │   │
│  │  - Full request metadata                                  │   │
│  │  - Response status and latency                            │   │
│  │  - Async write to log buffer                              │   │
│  └────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬─────────────────────────────────┘
                                   │
                                   ▼
                    ┌─────────────────────────┐
                    │     Upstream Services    │
                    │  (Orchestrator, Core,    │
                    │   Integration, etc.)     │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │     Redis (Rate Data)    │
                    │  - Token bucket state    │
                    │  - Usage counters        │
                    │  - Quota tracking        │
                    └─────────────────────────┘

                    ┌─────────────────────────┐
                    │  PostgreSQL (Persistent) │
                    │  - API keys             │
                    │  - Usage logs           │
                    │  - Quota configurations │
                    └─────────────────────────┘
```

### Request Flow

```
1. Client sends request with X-API-Key header
2. Gateway terminates TLS, extracts API key
3. Key validation: check key exists, is active, not expired
4. Rate limit check (Redis token bucket):
   a. Per-key rate limit (e.g., 100 req/s burst, 10 req/s sustained)
   b. Per-IP rate limit (e.g., 1000 req/min)
   c. Per-endpoint rate limit (e.g., POST /servers: 5 req/s)
   d. Global rate limit (e.g., 10000 req/s cluster-wide)
5. Quota check: daily remaining vs. limit
6. If all pass: proxy request to upstream service, log request
7. If any fail: return 429 Too Many Requests with Retry-After header
8. Response logged with status, latency, and remaining quota headers
```

---

## Implementation Plan

### Phase A: Gateway Proxy & Key Validation (1.5 PT)

1. Implement HTTP reverse proxy layer (Go `httputil.ReverseProxy` or Node.js `http-proxy`)
2. Add API key extraction from `X-API-Key` header and `?api_key=` query parameter
3. Implement key validation: lookup in Redis cache (with PostgreSQL fallback)
4. Add key status checks (active, revoked, expired)
5. Implement key-to-tier resolution (free, pro, enterprise)

### Phase B: Rate Limiting Engine (1.5 PT)

1. Implement token bucket algorithm in Go/Python with Redis backend
2. Support configurable: `max_burst`, `refill_rate` (per second), `refill_interval`
3. Build multi-level rate limiter: per-key → per-IP → per-endpoint → global
4. Implement atomic Redis operations (EVAL/Lua scripts for correctness)
5. Add `Retry-After` header computation and 429 response formatting

### Phase C: Quota Management (1 PT)

1. Implement daily/monthly usage counters in Redis with PostgreSQL persistence
2. Add quota configuration per key: `daily_limit`, `monthly_limit`, `overage_strategy`
3. Implement overage strategies: `block`, `warn` (header only), `bill` (meter)
4. Add quota reset cron jobs (daily at midnight UTC, monthly on 1st)
5. Return usage headers: `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Phase D: API Key Management & Admin API (1.5 PT)

1. Build CRUD API for API keys: create, list, get, update, revoke, rotate
2. Add key scoping: `read_only`, `write`, `admin` permission sets
3. Implement key rotation with overlapping grace period (old key works for 24h)
4. Build admin UI pages in Management Panel for key management
5. Add usage analytics: top keys, top endpoints, error rates, latency

### Phase E: Request Logging & Observability (0.5 PT)

1. Implement structured request/response logging (JSON, async writer)
2. Add log enrichment: key ID, tier, rate limit decisions, upstream latency
3. Expose Prometheus metrics: requests total, requests by status, rate limit hits, latency
4. Build Grafana dashboard: gateway overview, top keys, rate limit events

---

## API Design

### Rate Limiting Headers (Response)

Every API response includes rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1717000500
X-RateLimit-Burst: 150
X-RateLimit-Tier: pro
X-Key-ID: key_abc123
```

When rate limited:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 5
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1717000050
Content-Type: application/json

{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "API rate limit exceeded. Retry after 5 seconds.",
    "retry_after_seconds": 5,
    "limit": 100,
    "remaining": 0,
    "reset_at": "2026-05-27T12:00:50Z"
  }
}
```

### API Key Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/api-keys` | Create new API key |
| `GET` | `/api/v1/api-keys` | List API keys |
| `GET` | `/api/v1/api-keys/:id` | Get key details |
| `PUT` | `/api/v1/api-keys/:id` | Update key (name, scopes, quotas) |
| `DELETE` | `/api/v1/api-keys/:id` | Revoke API key |
| `POST` | `/api/v1/api-keys/:id/rotate` | Rotate key (new secret, old expires) |
| `GET` | `/api/v1/api-keys/:id/usage` | Get usage statistics |

### Usage Analytics Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/analytics/usage` | Aggregate usage stats |
| `GET` | `/api/v1/analytics/usage/top-keys` | Top N keys by request count |
| `GET` | `/api/v1/analytics/usage/top-endpoints` | Top N endpoints by request count |
| `GET` | `/api/v1/analytics/errors` | Error rate analytics |
| `GET` | `/api/v1/analytics/latency` | P50/P95/P99 latency stats |

---

## Data Model

### API Key Record

```json
{
  "id": "key_abc123",
  "name": "CI Pipeline Key",
  "key_prefix": "ip_api_abc...",
  "key_hash": "$2a$10$...",
  "owner_id": "usr_xyz",
  "tier": "enterprise",
  "scopes": ["servers:read", "servers:write", "deployments:write"],
  "status": "active",
  "rate_limits": {
    "per_key": { "max_burst": 200, "refill_rate": 50, "refill_interval": 1 },
    "per_endpoint": {
      "POST:/api/v1/servers": { "max_burst": 10, "refill_rate": 2, "refill_interval": 1 },
      "DELETE:/api/v1/servers/:id": { "max_burst": 5, "refill_rate": 1, "refill_interval": 1 }
    }
  },
  "quotas": {
    "daily_limit": 50000,
    "monthly_limit": 1000000,
    "overage_strategy": "warn"
  },
  "expires_at": "2027-05-27T00:00:00Z",
  "last_used_at": "2026-05-27T11:45:00Z",
  "created_at": "2026-01-15T00:00:00Z",
  "rotated_from": null,
  "rotated_to": null
}
```

### Rate Limit Bucket (Redis)

```json
{
  "key": "rate_limit:key:key_abc123",
  "tokens": 150,
  "last_refill": 1717000000,
  "max_burst": 200,
  "refill_rate": 50
}
```

### Usage Counter (Redis)

```json
{
  "key": "usage:daily:key_abc123:2026-05-27",
  "count": 12450,
  "updated_at": 1717000000
}
```

### PostgreSQL Schema

```sql
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    key_prefix      VARCHAR(20) NOT NULL,
    key_hash        TEXT NOT NULL,
    owner_id        UUID NOT NULL,
    tier            VARCHAR(50) NOT NULL DEFAULT 'free',
    scopes          TEXT[] NOT NULL DEFAULT '{}',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    rate_limits     JSONB NOT NULL DEFAULT '{}',
    quotas          JSONB NOT NULL DEFAULT '{}',
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    rotated_from    UUID,
    rotated_to      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_owner ON api_keys(owner_id);
CREATE INDEX idx_api_keys_status ON api_keys(status) WHERE status = 'active';

CREATE TABLE api_usage_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id          UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint        VARCHAR(512) NOT NULL,
    method          VARCHAR(10) NOT NULL,
    status_code     SMALLINT NOT NULL,
    latency_ms      INTEGER NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    rate_limited    BOOLEAN NOT NULL DEFAULT false,
    request_id      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_logs_key ON api_usage_logs(key_id, created_at DESC);
CREATE INDEX idx_usage_logs_created ON api_usage_logs(created_at);

-- Partitioned by month for performance
CREATE TABLE api_usage_daily (
    key_id          UUID NOT NULL,
    date            DATE NOT NULL,
    count           BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (key_id, date)
);

CREATE TABLE api_usage_monthly (
    key_id          UUID NOT NULL,
    year_month      VARCHAR(7) NOT NULL,
    count           BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (key_id, year_month)
);
```

---

## Rate Limiting Algorithms

### Token Bucket (Primary)

```
Rate:       10 requests/second
Burst:      20 tokens
Interval:   100ms

Time    Action              Tokens
T+0ms   Request 1           19 remaining  ✓
T+0ms   Request 2           18 remaining  ✓
T+0ms   Request 3           17 remaining  ✓
T+100ms Refill (+1 token)   18 remaining
T+150ms Request 4           17 remaining  ✓
T+200ms Refill (+1 token)   18 remaining
...
```

**Redis Lua Implementation:**

```lua
-- rate_limit.lua
local key = KEYS[1]
local max_burst = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local refill_interval = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local now = tonumber(ARGV[5])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1] or max_burst)
local last_refill = tonumber(bucket[2] or now)

-- Calculate refill since last check
local elapsed = now - last_refill
local refill_count = math.floor(elapsed / refill_interval) * refill_rate
tokens = math.min(max_burst, tokens + refill_count)

-- Update last_refill to most recent interval boundary
local new_last_refill = last_refill + (elapsed - (elapsed % refill_interval))

if tokens >= cost then
    tokens = tokens - cost
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', new_last_refill)
    redis.call('EXPIRE', key, math.ceil(max_burst / refill_rate) * 2)
    return {1, tokens, new_last_refill}
else
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', new_last_refill)
    return {0, tokens, new_last_refill}
end
```

### Rate Limit Hierarchy

```
1. Global Rate Limit       (cluster-wide: 10000 req/s)
         │
2. Per-IP Rate Limit       (per client IP: 1000 req/min)
         │
3. Per-Key Rate Limit      (per API key: depends on tier)
         │
4. Per-Endpoint Rate Limit (specific endpoints: 5 req/s for DELETE /servers)
```

---

## Service Assignments

| Component | Owner | Notes |
|-----------|-------|-------|
| Gateway reverse proxy | Integration Team | Request routing, TLS |
| API key CRUD + validation | Integration Team | Key lifecycle API |
| Rate limiter (token bucket) | Platform Team | Redis Lua implementation |
| Quota management | Integration Team | Daily/monthly counters |
| Request logging | Platform Team | Async log writer, DB schema |
| Admin UI (Panel) | Frontend Team | Key management pages |
| Usage analytics | Frontend Team | Charts, top-N queries |
| Prometheus metrics | DevOps Team | Metric exposition, Grafana |

---

## Effort Estimate Breakdown

| Task | PT | Dependencies |
|------|----|-------------|
| Gateway proxy layer | 1.0 | TLS cert, upstream routing config |
| API key CRUD API | 1.0 | DB schema, key hashing |
| Token bucket rate limiter (Redis) | 1.5 | Redis cluster |
| Multi-level rate limit orchestration | 0.5 | Token bucket primitive |
| Quota system (daily/monthly) | 0.5 | Rate limiter, cron jobs |
| Request logging pipeline | 0.5 | Log schema, async writer |
| API key rotation & revocation | 0.5 | Key CRUD API |
| Admin UI (key management) | 1.0 | Frontend components |
| Usage analytics + charts | 0.5 | Usage data pipeline |
| Metrics + Grafana dashboard | 0.5 | Prometheus |
| **Total** | **7.0** | |

---

## Usage Examples

### Create API Key

```bash
curl -X POST https://api.infrapanel.io/v1/api-keys \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CI/CD Pipeline",
    "tier": "pro",
    "scopes": ["servers:read", "servers:write", "deployments:write"],
    "quotas": {
      "daily_limit": 10000,
      "overage_strategy": "block"
    }
  }'

# Response:
# {
#   "id": "key_abc123",
#   "key": "ip_api_abc123def456...",
#   "name": "CI/CD Pipeline",
#   ...
# }
```

### Rotate API Key

```bash
curl -X POST https://api.infrapanel.io/v1/api-keys/key_abc123/rotate \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response:
# {
#   "new_key": "ip_api_xyz789...",
#   "old_key_expires_at": "2026-05-28T12:00:00Z"
# }
```

### Use API Key

```bash
# Via header (recommended)
curl -H "X-API-Key: ip_api_abc123def456..." \
  https://api.infrapanel.io/v1/servers

# Via query parameter (less secure)
curl "https://api.infrapanel.io/v1/servers?api_key=ip_api_abc123def456..."
```

### Rate Limiting Configuration

```yaml
# Rate limit config for enterprise tier
rate_limits:
  global:
    max_burst: 10000
    refill_rate: 5000
    refill_interval_seconds: 1
  
  per_ip:
    default:
      max_burst: 200
      refill_rate: 100
      refill_interval_seconds: 1
  
  per_key:
    tiers:
      free:
        max_burst: 30
        refill_rate: 10
        refill_interval_seconds: 1
      pro:
        max_burst: 100
        refill_rate: 50
        refill_interval_seconds: 1
      enterprise:
        max_burst: 500
        refill_rate: 200
        refill_interval_seconds: 1
  
  per_endpoint:
    "POST:/api/v1/servers":
      max_burst: 10
      refill_rate: 2
    "DELETE:/api/v1/servers/*":
      max_burst: 5
      refill_rate: 1

quotas:
  free:
    daily_limit: 1000
    monthly_limit: 30000
    overage_strategy: block
  pro:
    daily_limit: 50000
    monthly_limit: 1000000
    overage_strategy: warn
  enterprise:
    daily_limit: 500000
    monthly_limit: 10000000
    overage_strategy: bill
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Redis failure stops rate limiting | Unlimited requests can reach upstream | Fail-open mode: allow request but log error; Redis Sentinel for HA |
| Clock skew between nodes | Inaccurate rate limiting | Use Redis server time, not local clock |
| Token bucket state loss on Redis restart | Rate limit state reset | Durable Redis config (AOF), graceful degradation |
| Key hash collision | Unauthorized access | Use bcrypt with unique per-key salt, collision check on creation |
| Distributed rate limiting inconsistency | Over-limit or under-limit in multi-node | Redis atomic Lua scripts, consistent hashing of keys to Redis nodes |

---

## Acceptance Criteria

- [ ] Gateway proxies all `/api/v1/*` requests to correct upstream services
- [ ] API key validation rejects inactive/revoked/expired keys with 401
- [ ] Token bucket rate limiter enforces burst and sustained rates within 5% tolerance
- [ ] `Retry-After` header present and accurate on 429 responses
- [ ] Multi-level rate limits evaluate in correct order (global → IP → key → endpoint)
- [ ] Quota counters track daily and monthly usage correctly across service restarts
- [ ] Quota overage strategies work: `block` returns 429, `warn` adds header, `bill` logs metering data
- [ ] API key rotation creates new key and expires old key after grace period
- [ ] Request logs persist with all required fields and < 50ms overhead
- [ ] Usage analytics queries return correct aggregate data
- [ ] P99 gateway latency overhead < 10ms (vs direct-to-service)
- [ ] All endpoints return rate limit headers
