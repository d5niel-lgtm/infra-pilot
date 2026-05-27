# Feature 30: Incident Management

| Metadata | Value |
|----------|-------|
| Feature ID | 30 |
| Feature Name | Incident Management |
| Primary Service | Integration Service |
| Effort Estimate | Large (7–10 PT) |
| Dependencies | Auth Service, Notification Service, PagerDuty/Opsgenie API |
| Priority | High |

---

## 1. Overview

The Incident Management feature provides a complete lifecycle for operational incidents: detection, alerting, on-call scheduling, escalation, timeline tracking, post-mortem documentation, and optional public status page. It integrates with PagerDuty and Opsgenie for alert routing and on-call synchronization.

### 1.1 Goals

- Define on-call schedules with rotation support
- Configure escalation policies with time-based and approval-based rules
- Track incidents from detection through resolution
- Provide post-mortem templates for blameless retrospectives
- Sync on-call rotations with PagerDuty and Opsgenie
- Optional public status page for external stakeholders

### 1.2 Non-Goals

- Replace full-featured monitoring (Prometheus, Grafana, Datadog)
- Incident response runbook automation (future scope)
- SLA/SLO tracking and reporting
- Root cause analysis automation

---

## 2. Architecture

### 2.1 High-Level Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Integration Service                          │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ On-Call       │  │ Escalation   │  │ Incident     │  │ Post-Mortem  │ │
│  │ Scheduler     │  │ Engine       │  │ Lifecycle    │  │ Templates    │ │
│  │ - Rotations   │  │ - Policies   │  │ - Create     │  │ - CRUD       │ │
│  │ - Coverage    │  │ - Time-based │  │ - Update     │  │ - Render     │ │
│  │ - Overrides   │  │ - Routing    │  │ - Resolve    │  │ - Export     │ │
│  └──────┬────────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                  │                  │                  │        │
│         ▼                  ▼                  ▼                  ▼        │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  Integration Adapter Layer                                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌────────────────────────┐  │    │
│  │  │ PagerDuty   │  │ Opsgenie    │  │ Status Page Renderer   │  │    │
│  │  │ Sync        │  │ Sync        │  │ (public HTML/JSON)     │  │    │
│  │  └─────────────┘  └─────────────┘  └────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│  Database    │  │  PagerDuty API   │  │  Public Status Page  │
│  - Schedules │  │  (external)      │  │  (optional hosting)  │
│  - Incidents │  │                  │  │                      │
│  - Post-     │  │  Opsgenie API    │  │                      │
│    mortems   │  │  (external)      │  │                      │
└──────────────┘  └──────────────────┘  └──────────────────────┘
```

### 2.2 Component Descriptions

| Component | Role | Technology |
|-----------|------|------------|
| On-Call Scheduler | Manages rotation schedules, user assignments, overrides | Go / Node.js |
| Escalation Engine | Evaluates escalation policies, routes to next responder | Integration Service |
| Incident Lifecycle | State machine for incident tracking (detecting → acknowledged → resolving → resolved) | Integration Service |
| Post-Mortem Templates | CRUD for markdown-based post-mortem documents | Integration Service |
| PagerDuty Sync | Bidirectional sync of on-call schedules and alerts | REST API + Webhooks |
| Opsgenie Sync | Bidirectional sync of on-call schedules and alerts | REST API + Webhooks |
| Status Page Renderer | Generates public HTML/JSON status page | Static site generation |

### 2.3 Incident State Machine

```
                  ┌──────────────┐
                  │  Detecting   │
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
          ┌──────►│ Acknowledged │◄───────┐
          │       └──────┬───────┘        │
          │              │                │
          │         Auto-│escalate        │ Re-escalate
          │              ▼                │
          │       ┌──────────────┐        │
          │       │ Investigating│────────┘
          │       └──────┬───────┘
          │              │
          │         Resolving
          │              │
          │              ▼
          │       ┌──────────────┐
          └───────│   Resolved   │
                  └──────────────┘
```

---

## 3. Implementation Plan

### Phase 1: On-Call Scheduling (PT 2–3)

| Task | Description |
|------|-------------|
| 1.1 | Define data models: schedules, rotations, shifts, overrides |
| 1.2 | Implement schedule CRUD with recurrence rules (RRULE / iCalendar) |
| 1.3 | Implement rotation assignment (primary, secondary, tertiary) |
| 1.4 | Coverage gap detection and alerting |
| 1.5 | Manual override support (swap shifts, temporary reassignment) |

### Phase 2: Incident Lifecycle (PT 2–3)

| Task | Description |
|------|-------------|
| 2.1 | Define incident data model + state machine |
| 2.2 | Incident CRUD endpoints |
| 2.3 | Escalation policy engine (time-based delays, routing rules) |
| 2.4 | Escalation timer service (check for unacknowledged, escalate) |
| 2.5 | Incident timeline tracking (auto-log state transitions + manual entries) |
| 2.6 | Notification dispatch on state changes (Slack, email, SMS) |

### Phase 3: Integrations & Status Page (PT 3–4)

| Task | Description |
|------|-------------|
| 3.1 | PagerDuty REST API integration: pull on-call schedules, push alerts |
| 3.2 | Opsgenie REST API integration: pull on-call schedules, push alerts |
| 3.3 | Inbound webhook handlers for PagerDuty/Opsgenie alerts → auto-create incidents |
| 3.4 | Post-mortem template CRUD + markdown rendering |
| 3.5 | Post-mortem export (PDF, markdown) |
| 3.6 | Public status page generator (components, incidents, uptime timeline) |
| 3.7 | Status page API for external consumers (JSON feed) |

---

## 4. API Design

### 4.1 On-Call Schedule Endpoints

```
POST   /api/v2/oncall/schedules                    Create schedule
GET    /api/v2/oncall/schedules                     List schedules
GET    /api/v2/oncall/schedules/:id                 Get schedule details
PUT    /api/v2/oncall/schedules/:id                 Update schedule
DELETE /api/v2/oncall/schedules/:id                 Delete schedule

POST   /api/v2/oncall/schedules/:id/overrides       Add override
DELETE /api/v2/oncall/schedules/:id/overrides/:ovId  Remove override

GET    /api/v2/oncall/who-is-oncall                 Current on-call for all schedules
GET    /api/v2/oncall/who-is-oncall?schedule_id=:id  Current on-call for specific schedule
```

### 4.2 Escalation Policy Endpoints

```
POST   /api/v2/escalation-policies                  Create policy
GET    /api/v2/escalation-policies                   List policies
GET    /api/v2/escalation-policies/:id               Get policy details
PUT    /api/v2/escalation-policies/:id               Update policy
DELETE /api/v2/escalation-policies/:id               Delete policy
```

### 4.3 Incident Endpoints

```
POST   /api/v2/incidents                            Create incident
GET    /api/v2/incidents                             List incidents (filterable)
GET    /api/v2/incidents/:id                         Get incident details
PUT    /api/v2/incidents/:id                         Update incident
POST   /api/v2/incidents/:id/acknowledge             Acknowledge
POST   /api/v2/incidents/:id/resolve                 Resolve
POST   /api/v2/incidents/:id/escalate               Manually escalate
POST   /api/v2/incidents/:id/timeline               Add timeline entry
```

### 4.4 Post-Mortem Endpoints

```
POST   /api/v2/post-mortems                         Create post-mortem
GET    /api/v2/post-mortems                          List post-mortems
GET    /api/v2/post-mortems/:id                      Get post-mortem details
PUT    /api/v2/post-mortems/:id                      Update post-mortem
POST   /api/v2/post-mortems/:id/export              Export (markdown, PDF)
```

### 4.5 Status Page Endpoints

```
POST   /api/v2/status-pages                         Create status page config
GET    /api/v2/status-pages                          List status pages
GET    /api/v2/status-pages/:id                      Get page details + current status
PUT    /api/v2/status-pages/:id                      Update page

GET    /api/v2/status-pages/:id/public               Public status JSON (no auth)
```

### 4.6 Request/Response Examples

**Create Schedule:**
```json
POST /api/v2/oncall/schedules
{
  "name": "primary-sre-rotation",
  "description": "Primary SRE on-call rotation",
  "timezone": "UTC",
  "rotation_type": "weekly",
  "shift_start": "09:00",
  "shift_duration_hours": 168,
  "members": [
    { "user_id": "u_alice", "rank": 1 },
    { "user_id": "u_bob", "rank": 2 },
    { "user_id": "u_carol", "rank": 3 }
  ],
  "handoff_day": "monday",
  "handoff_time": "09:00:00"
}

Response 201:
{
  "id": "sched_sre_primary",
  "name": "primary-sre-rotation",
  "rotation_type": "weekly",
  "current_on_call": { "user_id": "u_alice", "started_at": "2026-05-25T09:00:00Z" },
  "created_at": "2026-05-27T12:00:00Z"
}
```

**Create Escalation Policy:**
```json
POST /api/v2/escalation-policies
{
  "name": "sre-escalation",
  "description": "SRE escalation: every 15 min, escalate to next tier",
  "rules": [
    {
      "escalation_delay_minutes": 15,
      "targets": [
        { "type": "schedule", "id": "sched_sre_primary" },
        { "type": "user", "id": "u_alice" }
      ]
    },
    {
      "escalation_delay_minutes": 30,
      "targets": [
        { "type": "schedule", "id": "sched_sre_secondary" }
      ]
    },
    {
      "escalation_delay_minutes": 60,
      "targets": [
        { "type": "user", "id": "u_manager" },
        { "type": "webhook", "url": "https://hooks.slack.com/services/xxx" }
      ]
    }
  ]
}
```

**Create Incident:**
```json
POST /api/v2/incidents
{
  "title": "High latency on api.example.com",
  "severity": "critical",
  "source": "prometheus",
  "source_id": "alert-abc-123",
  "description": "P99 latency > 5s for 10 minutes on api-prod-01",
  "affected_components": ["api-gateway", "user-service"],
  "escalation_policy_id": "pol_sre_escalation"
}

Response 201:
{
  "id": "inc_20260527_001",
  "status": "detecting",
  "acknowledged_by": null,
  "on_call_paged": true,
  "created_at": "2026-05-27T12:05:00Z",
  "timeline": [
    { "ts": "2026-05-27T12:05:00Z", "type": "created", "detail": "Incident created from Prometheus alert" }
  ]
}
```

**Resolve Incident:**
```json
POST /api/v2/incidents/inc_20260527_001/resolve
{
  "resolved_by": "u_alice",
  "resolution_notes": "Scaled up API replicas from 3 to 6, latency returned to normal",
  "root_cause": "CPU saturation due to traffic spike after product launch"
}

Response 200:
{
  "id": "inc_20260527_001",
  "status": "resolved",
  "resolved_by": "u_alice",
  "resolved_at": "2026-05-27T12:45:00Z",
  "duration_minutes": 40
}
```

**Status Page (public JSON):**
```json
GET /api/v2/status-pages/sp_infrapilot/public

Response 200:
{
  "page_name": "Infra Pilot Status",
  "overall_status": "degraded_performance",
  "components": [
    { "name": "API Gateway", "status": "operational" },
    { "name": "Dashboard", "status": "operational" },
    { "name": "User Service", "status": "degraded_performance" }
  ],
  "active_incidents": [
    {
      "id": "inc_20260527_001",
      "title": "High latency on api.example.com",
      "status": "resolved",
      "created_at": "2026-05-27T12:05:00Z",
      "resolved_at": "2026-05-27T12:45:00Z"
    }
  ],
  "updated_at": "2026-05-27T12:46:00Z"
}
```

---

## 5. Data Model

### 5.1 `oncall_schedules`

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(64) (PK) | Human-readable slug |
| name | VARCHAR(128) | Display name |
| description | TEXT | Optional description |
| timezone | VARCHAR(64) | IANA timezone |
| rotation_type | ENUM | `weekly`, `daily`, `custom` |
| shift_start | TIME | When shift begins |
| shift_duration_hours | INT | Length of each shift |
| handoff_day | VARCHAR(16) | Day of week for handoff |
| handoff_time | TIME | Time of handoff |
| created_by | UUID (FK → users) | Creator |
| created_at | TIMESTAMPTZ | Creation |
| updated_at | TIMESTAMPTZ | Last update |

### 5.2 `oncall_members`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| schedule_id | VARCHAR(64) (FK) | Parent schedule |
| user_id | UUID (FK → users) | Team member |
| rank | INT | 1 = primary, 2 = secondary, etc. |
| is_active | BOOLEAN | Whether currently participating |

### 5.3 `oncall_overrides`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| schedule_id | VARCHAR(64) (FK) | Parent schedule |
| original_user_id | UUID (FK → users) | Who is being replaced |
| replacement_user_id | UUID (FK → users) | Replacement |
| starts_at | TIMESTAMPTZ | Override start |
| ends_at | TIMESTAMPTZ | Override end |
| reason | TEXT | Justification |
| created_by | UUID (FK → users) | Who created override |

### 5.4 `escalation_policies`

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(64) (PK) | Human-readable slug |
| name | VARCHAR(128) | Display name |
| rules | JSONB | Array of escalation rules with targets and delays |
| created_by | UUID (FK → users) | Creator |
| created_at | TIMESTAMPTZ | Creation |
| updated_at | TIMESTAMPTZ | Last update |

### 5.5 `incidents`

| Column | Type | Description |
|--------|------|-------------|
| id | VARCHAR(64) (PK) | e.g., `inc_20260527_001` |
| title | TEXT | Short description |
| severity | ENUM | `critical`, `major`, `minor`, `warning` |
| status | ENUM | `detecting`, `acknowledged`, `investigating`, `resolving`, `resolved` |
| source | VARCHAR(64) | Detection source (prometheus, pagerduty, manual) |
| source_id | VARCHAR(128) | External alert ID |
| description | TEXT | Full description |
| affected_components | TEXT[] | List of affected services |
| escalation_policy_id | VARCHAR(64) (FK) | Active escalation policy |
| acknowledged_by | UUID (FK → users, nullable) | Who acknowledged |
| acknowledged_at | TIMESTAMPTZ | When acknowledged |
| resolved_by | UUID (FK → users, nullable) | Who resolved |
| resolved_at | TIMESTAMPTZ | When resolved |
| resolution_notes | TEXT | How it was resolved |
| root_cause | TEXT | Identified RCA |
| created_at | TIMESTAMPTZ | Creation |
| updated_at | TIMESTAMPTZ | Last update |

### 5.6 `incident_timeline`

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL (PK) | Auto-increment |
| incident_id | VARCHAR(64) (FK) | Parent incident |
| entry_type | ENUM | `created`, `acknowledged`, `note`, `escalated`, `resolved`, `reopened` |
| detail | TEXT | Free-text entry |
| actor_id | UUID (FK → users, nullable) | Who created entry |
| created_at | TIMESTAMPTZ | Immutable timestamp |

### 5.7 `post_mortems`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| incident_id | VARCHAR(64) (FK, nullable) | Related incident |
| title | VARCHAR(256) | Post-mortem title |
| template_id | UUID (FK → templates) | Template used |
| content | JSONB | Structured fields based on template |
| document | TEXT | Rendered markdown |
| created_by | UUID (FK → users) | Author |
| created_at | TIMESTAMPTZ | Creation |
| updated_at | TIMESTAMPTZ | Last update |

### 5.8 `post_mortem_templates`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| name | VARCHAR(128) | Template name |
| schema | JSONB | Field definitions (title, summary, timeline, rca, action-items) |
| markdown_template | TEXT | Go template / Handlebars template for rendering |
| created_by | UUID (FK → users) | Creator |

### 5.9 `status_pages`

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Auto-generated |
| name | VARCHAR(128) | Status page title |
| subdomain | VARCHAR(64) | e.g., `status.example.com` |
| is_public | BOOLEAN | Whether publicly accessible |
| components | JSONB | List of service components and their status |
| custom_css | TEXT | Optional custom styling |
| created_by | UUID (FK → users) | Creator |
| created_at | TIMESTAMPTZ | Creation |
| updated_at | TIMESTAMPTZ | Last update |

---

## 6. Service Assignments

| Service | Responsibilities |
|---------|-----------------|
| **Integration Service** (primary) | On-call scheduling engine, escalation engine, incident lifecycle, post-mortem CRUD, status page generator |
| **Notification Service** | Slack alerts, email notifications, SMS (via Twilio) for incident state changes |
| **PagerDuty (external)** | On-call schedule sync source-of-truth, alert routing |
| **Opsgenie (external)** | On-call schedule sync source-of-truth, alert routing |
| **Database** | All schedule, incident, post-mortem, and status page data |

---

## 7. Integration Patterns

### 7.1 PagerDuty Sync

```yaml
# Configuration
pagerduty:
  api_token: ${PAGERDUTY_API_TOKEN}
  sync_interval_seconds: 300
  webhook_secret: ${PAGERDUTY_WEBHOOK_SECRET}

# Sync flow:
# 1. Every 5 min, pull on-call schedules from PagerDuty API
# 2. Map PD schedules to local oncall_schedules by external_id
# 3. Update local oncall_members with current on-call users
# 4. When an alert fires in PD → webhook → creates incident
# 5. When incident is resolved in Infra Pilot → push to PD
```

### 7.2 Escalation Timer Flow

```
1. Incident created → status = "detecting"
2. Escalation timer starts (based on escalation_policy first rule delay)
3. If not acknowledged within delay → execute escalation rule targets
   ├── Page on-call schedule (via PagerDuty/Opsgenie/notification)
   └── Move to next escalation rule, restart timer with that delay
4. If acknowledged → status = "acknowledged", timer cancelled
5. If acknowledged but not resolved within policy threshold → re-escalate
```

---

## 8. Effort Estimate

| Phase | Person-Days |
|-------|-------------|
| Phase 1: On-Call Scheduling | 2–3 PT |
| Phase 2: Incident Lifecycle | 2–3 PT |
| Phase 3: Integrations & Status Page | 3–4 PT |
| **Total** | **7–10 PT** |

---

## 9. Future Enhancements

- Runbook automation (attach automated remediation to incident types)
- SLA breach prediction and alerting
- Incident metrics dashboard (MTTD, MTTR, etc.)
- AI-powered root cause suggestion
- Video/voice conference bridge auto-creation on incident open
- Multi-region status page aggregation
