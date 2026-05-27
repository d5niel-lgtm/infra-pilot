# Feature 23: CDN & WAF Integration

| Metadata | Value |
|----------|-------|
| Feature ID | 23 |
| Feature Name | CDN & WAF Integration |
| Primary Service | Integration Service |
| Effort Estimate | Medium (4–6 PT) |
| Status | Planned |

---

## 1. Overview

One-click Cloudflare / Bunny CDN provisioning and WAF management directly from the Panel. Users select a provider, choose a plan, and the system automatically provisions the CDN, configures caching rules, applies WAF security policies, enables DDoS mitigation, and manages SSL/TLS certificates.

### Goals

- Eliminate manual CDN setup friction with a fully automated workflow
- Provide a unified interface across multiple CDN providers
- Enforce security baseline via WAF rules and DDoS protection
- Enable per-environment cache rule management (dev / staging / prod)
- Support SSL/TLS certificate provisioning and renewal

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Panel (UI)                           │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ CDN Setup    │  │ Cache Rules  │  │ WAF / DDoS Config│  │
│  │ Wizard       │  │ Manager      │  │ Manager           │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘  │
└─────────┼─────────────────┼───────────────────┼─────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  Integration Service                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              CDN Provider Abstraction Layer          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│  │  │ Cloudflare  │  │ Bunny CDN    │  │ (Future:   │  │   │
│  │  │ Adapter     │  │ Adapter      │  │  Fastly…)  │  │   │
│  │  └──────┬──────┘  └──────┬───────┘  └──────┬─────┘  │   │
│  └─────────┼─────────────────┼─────────────────┼────────┘   │
│            │                 │                               │
│  ┌─────────▼─────────────────▼─────────────────────────┐    │
│  │           Rule Engine / Orchestrator                 │    │
│  │  ┌──────────┐ ┌───────────┐ ┌───────────────────┐   │    │
│  │  │Cache Rule│ │ WAF Rule  │ │ DDoS / Security   │   │    │
│  │  │Manager   │ │ Manager   │ │ Profile Manager   │   │    │
│  │  └──────────┘ └───────────┘ └───────────────────┘   │    │
│  └──────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌──────────┐        ┌──────────┐        ┌──────────────┐
│Cloudflare│        │Bunny CDN │        │ Let's Encrypt │
│  API     │        │  API     │        │ / ACME        │
└──────────┘        └──────────┘        └──────────────┘
```

### Component Responsibilities

| Component | Role |
|-----------|------|
| Panel | UI forms, wizards, dashboards for CDN/WAF management |
| Integration Service | Provider abstraction, orchestration, rule management |
| CDN Provider Adapter | Type-safe API client for each provider |
| Rule Engine | Compiles panel config into provider-specific API calls |
| ACME Client | Automatic SSL/TLS certificate issuance and renewal |

---

## 3. Data Model

### `cdn_providers`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR | e.g. "cloudflare", "bunny" |
| display_name | VARCHAR | e.g. "Cloudflare" |
| enabled | BOOLEAN | Whether the provider is available |
| config_schema | JSONB | JSON Schema for provider-specific config |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `cdn_zones`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| environment_id | UUID | FK → environments.id |
| provider_id | UUID | FK → cdn_providers.id |
| provider_zone_id | VARCHAR | ID returned by the provider |
| domain | VARCHAR | The domain being proxied |
| plan | VARCHAR | e.g. "free", "pro", "business" |
| status | ENUM | provisioning, active, failed, suspended |
| config | JSONB | Provider-specific zone config |
| ssl_status | ENUM | pending, active, expired |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `cache_rules`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| zone_id | UUID | FK → cdn_zones.id |
| name | VARCHAR | Human-readable rule name |
| description | TEXT | |
| priority | INT | Rule evaluation order |
| criteria | JSONB | Match conditions (path, query, header, cookie) |
| actions | JSONB | TTL, cache-key, bypass, edge-cache |
| enabled | BOOLEAN | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `waf_rules`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| zone_id | UUID | FK → cdn_zones.id |
| name | VARCHAR | |
| description | TEXT | |
| severity | ENUM | critical, high, medium, low |
| action | ENUM | block, challenge, js_challenge, log, allow |
| filter | JSONB | Filter expression (IP, UA, path, rate) |
| enabled | BOOLEAN | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

### `security_profiles`

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| zone_id | UUID | FK → cdn_zones.id |
| name | VARCHAR | e.g. "strict", "moderate", "custom" |
| ddos_protection | BOOLEAN | |
| rate_limiting | JSONB | Requests per second / IP |
| bot_management | JSONB | Bot fight mode settings |
| tls_min_version | VARCHAR | e.g. "1.2", "1.3" |
| always_use_https | BOOLEAN | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

---

## 4. API Design

### CDN Zone Management

```
POST   /api/v2/cdn/zones                     — Provision a new CDN zone
GET    /api/v2/cdn/zones                      — List all CDN zones
GET    /api/v2/cdn/zones/:id                  — Get zone details
PUT    /api/v2/cdn/zones/:id                  — Update zone configuration
DELETE /api/v2/cdn/zones/:id                  — Delete / suspend a zone
POST   /api/v2/cdn/zones/:id/purge            — Purge cache (by URL, tag, or all)
POST   /api/v2/cdn/zones/:id/ssl             — Trigger SSL certificate issuance
```

### Cache Rules

```
GET    /api/v2/cdn/zones/:id/cache-rules       — List cache rules
POST   /api/v2/cdn/zones/:id/cache-rules       — Create cache rule
PUT    /api/v2/cdn/zones/:id/cache-rules/:rid  — Update cache rule
DELETE /api/v2/cdn/zones/:id/cache-rules/:rid  — Delete cache rule
PATCH  /api/v2/cdn/zones/:id/cache-rules/reorder — Reorder rule priority
```

### WAF Rules

```
GET    /api/v2/cdn/zones/:id/waf-rules         — List WAF rules
POST   /api/v2/cdn/zones/:id/waf-rules         — Create WAF rule
PUT    /api/v2/cdn/zones/:id/waf-rules/:rid    — Update WAF rule
DELETE /api/v2/cdn/zones/:id/waf-rules/:rid    — Delete WAF rule
POST   /api/v2/cdn/zones/:id/waf-rules/simulate — Test a rule against sample traffic
```

### Security Profiles

```
GET    /api/v2/cdn/zones/:id/security-profile  — Get current security profile
PUT    /api/v2/cdn/zones/:id/security-profile  — Update security profile
POST   /api/v2/cdn/zones/:id/security-profile/apply — Apply profile to zone
```

---

## 5. Implementation Plan

### Phase 1 — Provider Abstraction & One-Click Provisioning (2 PT)

1. Define `CDNProviderAdapter` interface (Go interface or TypeScript abstract class)
2. Implement Cloudflare adapter (zones, DNS, SSL via Cloudflare API v4)
3. Implement Bunny CDN adapter (pull zones, SSL via Bunny API)
4. Build provisioning workflow in Integration Service (create zone → configure DNS → issue SSL)
5. Add `cdn_zones` CRUD endpoints

### Phase 2 — Cache Rules Engine (1 PT)

1. Implement `CacheRuleManager` — normalizes rules across providers
2. Build cache rule CRUD API
3. Add cache purge endpoint with tag / URL / wildcard support
4. UI for drag-and-drop rule reordering

### Phase 3 — WAF & Security (1.5 PT)

1. Implement `WafRuleManager` — translates panel WAF rules to provider-specific format
2. Build WAF rule CRUD API
3. Implement `SecurityProfileManager` — presets and custom profiles
4. Add DDoS protection toggle and rate-limiting config
5. Build WAF simulation / dry-run endpoint

### Phase 4 — SSL/TLS & Polish (0.5–1 PT)

1. ACME / Let's Encrypt integration for custom certificate management
2. SSL status monitoring and autorenewal alerts
3. Dashboard widgets: cache hit ratio, threats blocked, bandwidth saved
4. Audit logging for all CDN/WAF configuration changes

---

## 6. Provider Adapter Interface (Pseudo-Code)

```typescript
interface CDNProviderAdapter {
  // Zone lifecycle
  createZone(params: CreateZoneParams): Promise<Zone>;
  getZone(zoneId: string): Promise<Zone>;
  updateZone(zoneId: string, params: Partial<Zone>): Promise<Zone>;
  deleteZone(zoneId: string): Promise<void>;
  suspendZone(zoneId: string): Promise<void>;
  activateZone(zoneId: string): Promise<void>;

  // SSL
  issueSSL(zoneId: string, method: 'acme' | 'provider'): Promise<SSLStatus>;
  renewSSL(zoneId: string): Promise<SSLStatus>;

  // Cache
  purgeCache(zoneId: string, params: PurgeParams): Promise<void>;
  createCacheRule(zoneId: string, rule: CacheRule): Promise<CacheRule>;
  updateCacheRule(zoneId: string, ruleId: string, rule: Partial<CacheRule>): Promise<CacheRule>;
  deleteCacheRule(zoneId: string, ruleId: string): Promise<void>;

  // WAF
  createWafRule(zoneId: string, rule: WafRule): Promise<WafRule>;
  updateWafRule(zoneId: string, ruleId: string, rule: Partial<WafRule>): Promise<WafRule>;
  deleteWafRule(zoneId: string, ruleId: string): Promise<void>;

  // Security
  getSecurityProfile(zoneId: string): Promise<SecurityProfile>;
  updateSecurityProfile(zoneId: string, profile: SecurityProfile): Promise<SecurityProfile>;
}
```

---

## 7. Configuration Examples

### One-Click Cloudflare Setup (POST /api/v2/cdn/zones)

```json
{
  "provider": "cloudflare",
  "domain": "app.example.com",
  "plan": "pro",
  "config": {
    "origin_server": "origin.app.example.com",
    "ipv6": true,
    "http2": true,
    "http3": true,
    "min_tls_version": "1.2",
    "always_use_https": true,
    "ssl": "full"
  },
  "security_profile": "moderate"
}
```

### Cache Rule Example

```json
{
  "name": "Static Assets — Long TTL",
  "description": "Cache JS, CSS, and images for 30 days",
  "priority": 10,
  "criteria": {
    "path_glob": ["/assets/**", "/static/**"],
    "file_extension": [".js", ".css", ".png", ".jpg", ".svg", ".woff2"]
  },
  "actions": {
    "ttl": 2592000,
    "cache_key": {
      "include_query": false,
      "include_host": true
    },
    "edge_cache_ttl": 604800,
    "browser_cache_ttl": 2592000
  },
  "enabled": true
}
```

### WAF Rule Example

```json
{
  "name": "Block Admin Access from Non-VPN IPs",
  "description": "Only allow /admin from approved IP ranges",
  "severity": "critical",
  "action": "block",
  "filter": {
    "path_prefix": "/admin",
    "not_ip_in": ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"]
  },
  "enabled": true
}
```

---

## 8. Service Assignments

| Service | Responsibilities |
|---------|------------------|
| **Panel** | CDN setup wizard, cache rule form, WAF rule editor, security dashboard, SSL status |
| **Integration Service** | Provider abstraction layer, rule engine, SSL management, audit logging |
| **Orchestrator Agent** | Cross-service coordination (if multi-region CDN) |
| **Database** | Stores zones, rules, profiles, audit logs |

---

## 9. Effort Breakdown

| Task | PT | Dependencies |
|------|----|-------------|
| Provider adapter interface & Cloudflare adapter | 1.0 | — |
| Bunny CDN adapter | 0.5 | — |
| Zone provisioning workflow | 0.5 | Adapters |
| Cache rules CRUD + engine | 1.0 | Zone endpoints |
| Cache purge logic | 0.5 | Cache engine |
| WAF rules CRUD + engine | 1.0 | Zone endpoints |
| Security profile manager | 0.5 | — |
| DDoS mitigation toggle | 0.25 | — |
| SSL/TLS ACME integration | 0.5 | — |
| Dashboard widgets & monitoring | 0.5 | All endpoints |
| UI screens (wizard, editor, dashboard) | 1.0 | All APIs |
| Documentation & tests | 0.5 | — |

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Provider API rate limits | Delayed provisioning | Implement queue with exponential backoff |
| Provider API breaking changes | Integration failure | Version-pin adapters, integration tests run nightly |
| SSL certificate race conditions | Partial downtime | Use ACME with retry logic + status polling |
| WAF rule conflicts across providers | Inconsistent behavior | Normalize rules via abstract syntax tree before translation |
