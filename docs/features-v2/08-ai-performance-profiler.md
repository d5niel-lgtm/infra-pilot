# Feature 8: AI Performance Profiler

| Field | Value |
|-------|-------|
| **ID** | F-008 |
| **Name** | AI Performance Profiler |
| **Category** | AI & Intelligence |
| **Primary Service** | Service Core |
| **Effort** | Medium (4-6 PT) |
| **Dependencies** | Feature 1 (AI Log Anomaly Detector), Minecraft server agent |
| **Phase** | Phase 1 |

---

## Overview

The AI Performance Profiler deeply profiles Minecraft server tick performance to identify sources of lag and performance degradation. It tracks entity counts, redstone activity, plugin execution times, chunk loading patterns, and hardware utilization, then correlates these signals to produce actionable, prioritized recommendations for server administrators.

### Goals

- Identify tick lag sources within 60 seconds of profiling start
- Pinpoint lag to specific entities, chunks, plugins, or redstone contraptions
- Provide ranked, actionable fix suggestions with estimated impact
- Track performance trends over time for proactive maintenance

### Non-Goals

- Not a real-time monitoring dashboard (sessions are on-demand or scheduled)
- Does not automatically modify server properties or plugins
- Not a benchmarking tool (comparative performance across different servers)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Minecraft Server (Target)                       │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                         Server Plugins                            │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │ │
│  │  │ Profiler   │  │ Entity     │  │ Redstone   │  │ Chunk      │ │ │
│  │  │ Agent      │  │ Tracker    │  │ Analyzer   │  │ Profiler   │ │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │                     Tick Execution Loop                           │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │ │
│  │  │Entities  │ │Tile Ent. │ │Chunks    │ │Plugins   │ │Physics │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘ │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
         │                          │
         │ RCON / Plugin API        │ Metrics via Agent
         ▼                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        Service Core (Primary)                         │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    Profile Orchestrator                         │  │
│  │  ┌───────────────┐ ┌───────────────┐ ┌──────────────────────┐ │  │
│  │  │ Profile       │ │ Data          │ │ Profile History      │ │  │
│  │  │ Scheduler     │ │ Collector     │ │ & Trends             │ │  │
│  │  └───────────────┘ └───────┬───────┘ └──────────────────────┘ │  │
│  └────────────────────────────┼───────────────────────────────────┘  │
│                               │                                       │
│  ┌────────────────────────────▼───────────────────────────────────┐  │
│  │                      Analysis Pipeline                           │  │
│  │                                                                  │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │  │
│  │  │ Tick Time        │  │ Entity Lag       │  │ Redstone Lag   │ │  │
│  │  │ Analyzer         │  │ Analyzer         │  │ Analyzer       │ │  │
│  │  │                  │  │                  │  │                │ │  │
│  │  │ • MSPT tracking  │  │ • Entity counts  │  │ • Active       │ │  │
│  │  │ • TPS calculation│  │ • Per-entity     │  │   contraptions │ │  │
│  │  │ • Phase breakdown│  │   tick time      │  │ • Update       │ │  │
│  │  │ • GC pressure    │  │ • AI mob farms   │  │   frequency    │ │  │
│  │  └──────────────────┘  │ • Hopper lag     │  │ • Chunk        │ │  │
│  │                        └──────────────────┘  │   loading      │ │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  └────────────────┘ │  │
│  │  │ Plugin Timing    │  │ Chunk & World    │  ┌────────────────┐ │  │
│  │  │ Analyzer         │  │ Analyzer         │  │ Suggestion     │ │  │
│  │  │                  │  │                  │  │ Engine         │ │  │
│  │  │ • Per-plugin MSPT│  │ • Chunk loading  │  │                │ │  │
│  │  │ • Event handler  │  │ • Mob spawning   │  │ • Prioritized  │ │  │
│  │  │   profiling      │  │ • Village/AI     │  │   fixes        │ │  │
│  │  │ • DB query times │  │ • Liquid physics │  │ • Impact       │ │  │
│  │  └──────────────────┘  └──────────────────┘  │   estimation   │ │  │
│  │                                                └────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                               │                                       │
│                               ▼                                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Report Generator                               │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │  │
│  │  │ Flame Graph│  │ Timeline   │  │ Ranked     │  │ Export     │  │  │
│  │  │ Generator  │  │ Viewer     │  │ Issues     │  │ (PDF/JSON) │  │  │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    Management Panel (UI)                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │ Profile      │  │ Report View  │  │ Trend Chart  │  │Suggested │ │
│  │ Dashboard    │  │ (flame +     │  │ (MSPT over   │  │Fixes     │ │
│  │              │  │  timeline)   │  │  time)       │  │Panel     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### Profiling Flow

```
User starts profile ──► Profiler agent plugin injected
                           │
                           ▼
                    Profile Orchestrator manages session
                           │
                     ┌─────┴──────┐
                     ▼            ▼
              5-sec snapshot    Continuous 60s
              (quick check)     (deep profile)
                           │
                           ▼
                    Data Collector gathers:
                    • Per-tick MSPT (milliseconds per tick)
                    • Per-entity tick time
                    • Per-plugin hook execution times
                    • Chunk load/unload events
                    • GC pause events
                    • Redstone update counts
                           │
                           ▼
                    Analysis Pipeline (parallel)
                           │
                           ▼
                    Suggestion Engine ranks findings
                           │
                           ▼
                    Report generated with flame graphs
```

---

## Implementation Plan

### Phase 1: Profiler Agent Plugin (Week 1, 1.5 PT)

1. **Minecraft Plugin (Paper/Bukkit/Spigot)**
   - Custom plugin loaded on-demand via RCON or plugin manager API
   - Tick hook injection (using `ServerTickEvents` / `Scheduler`)
   - Entity tracking via entity tick event listeners
   - Plugin timing via `PluginManager` call event hooks

2. **Data Collection Modules**
   - **MSPT Sampler**: Record per-tick MSPT, TPS, phase timing
   - **Entity Tracker**: Per-entity-type count and tick time (mobs, items, minecarts, etc.)
   - **Redstone Analyzer**: Count redstone updates per tick per chunk
   - **Plugin Timer**: Wrap `onEnable`, `onDisable`, event handlers with timing
   - **Chunk Profiler**: Track loading/unloading, active chunk count
   - **GC Monitor**: Capture GC pause events via `GarbageCollectorMXBean`

3. **Data Export**
   - Metrics pushed to Service Core via WebSocket or HTTP POST
   - Configurable sampling interval (100ms, 500ms, 1s)
   - Batch export every 1 second during profiling session

### Phase 2: Analysis Pipeline (Week 2-3, 2.5 PT)

1. **Tick Time Analyzer**
   - Parse MSPT → compute average, p50, p95, p99
   - Break down tick phases: entities, tile entities, chunks, plugins, physics
   - Identify "lag spikes" (ticks > 100ms for <20 TPS)

2. **Entity Lag Analyzer**
   - Aggregate entity tick time by type, chunk, world
   - Detect "entity hoarding" (>100 entities per chunk)
   - Identify specific AI-heavy mobs (villagers, zombies, illagers)
   - Find hopper lag (hoppers checking above them)
   - Detect item frame clusters

3. **Redstone Lag Analyzer**
   - Identify chunks with excessive redstone updates (>1000/tick)
   - Detect clock circuits (rapid toggling)
   - Find piston animation spam
   - Locate unloaded redstone chunks causing cascade loads

4. **Plugin Timing Analyzer**
   - Per-plugin average MSPT contribution
   - Per-event-handler timing breakdown
   - Detect plugin event cascades (plugin A → plugin B → plugin C)
   - Database query timing (if plugin uses external DB)
   - Identify plugins with >5ms/tick average overhead

5. **Chunk & World Analyzer**
   - Active vs. loaded chunk ratio
   - Mob cap utilization
   - Liquid physics hotspot detection
   - Village AI impact (golem spawning, gossip updates)

### Phase 3: Suggestion Engine & Reporting (Week 3-4, 1.5 PT)

1. **Suggestion Engine**
   - Knowledge base of 40+ common lag sources with fixes
   - Pattern → Suggestion mapping with impact scoring

2. **Report Generator**
   - Flame graph visualization (using d3-flame-graph)
   - Timeline view (MSPT over profile duration)
   - Ranked issue list with severity, impact, effort
   - Export to PDF, PNG, JSON

3. **Historical Trends**
   - Store profile summaries in timeseries DB
   - Show MSPT trend over days/weeks
   - Alert on sustained high MSPT

---

## API Design

### Endpoints

All endpoints are prefixed with `/api/v2/performance-profiler`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/profiles` | Start a new profiling session |
| `GET`  | `/profiles` | List profiles for a server |
| `GET`  | `/profiles/{profileId}` | Get profile report |
| `DELETE` | `/profiles/{profileId}` | Delete a profile |
| `GET`  | `/profiles/{profileId}/flamegraph` | Get flame graph data |
| `GET`  | `/profiles/{profileId}/timeline` | Get timeline data |
| `GET`  | `/profiles/{profileId}/suggestions` | Get ranked suggestions |
| `GET`  | `/trends/{serverId}` | Get MSPT trends over time |
| `GET`  | `/trends/{serverId}/anomaly` | Check for performance anomalies |

### Request/Response Examples

**POST /api/v2/performance-profiler/profiles**

```json
{
  "server_id": "srv-mc-42",
  "duration_seconds": 60,
  "sampling_interval_ms": 200,
  "type": "deep",
  "modules": {
    "entity_tracking": true,
    "plugin_timing": true,
    "redstone_analysis": true,
    "chunk_profiling": true
  },
  "scheduled": false
}
```

**Response**

```json
{
  "profile_id": "prof-20260527-abc789",
  "server_id": "srv-mc-42",
  "status": "completed",
  "started_at": "2026-05-27T14:30:00Z",
  "completed_at": "2026-05-27T14:31:00Z",
  "duration_seconds": 60,
  "total_ticks_sampled": 1200,
  "summary": {
    "average_mspt": 38.2,
    "min_mspt": 12.1,
    "max_mspt": 245.7,
    "p50_mspt": 32.5,
    "p95_mspt": 68.3,
    "p99_mspt": 142.8,
    "average_tps": 19.2,
    "ticks_below_20_tps": 45,
    "worst_ticks": [
      { "tick": 847, "mspt": 245.7, "cause": "chunk_load_storm" },
      { "tick": 312, "mspt": 198.3, "cause": "redstone_clock" },
      { "tick": 561, "mspt": 167.2, "cause": "entity_spawn" }
    ]
  },
  "phase_breakdown": {
    "entities": 14.2,
    "tile_entities": 4.1,
    "chunks": 8.3,
    "plugins": 6.5,
    "physics": 3.1,
    "other": 2.0
  },
  "top_issues": [
    {
      "rank": 1,
      "category": "redstone",
      "title": "Redstone clock in overworld (chunk 12, -34)",
      "impact": "high",
      "current_mspt": 28.4,
      "estimated_after_fix": 10.2,
      "description": "Detected a rapid redstone clock circuit toggling ~1200 times/second in chunk [12, -34]. This accounts for 18.4mspt.",
      "suggestion": "Replace the clock with an observer-based design or reduce clock speed. Consider using a hopper clock for slower timings.",
      "commands": [
        "/tp @s 192 64 -544",
        "/fill 192 64 -544 200 64 -536 air"
      ],
      "references": [
        "https://minecraft.wiki/w/Redstone_circuits#Clock_circuits"
      ]
    }
  ],
  "suggestions": [
    {
      "id": "sug-001",
      "category": "entities",
      "severity": "warning",
      "title": "Excessive villager population in spawn chunks",
      "impact": "high",
      "effort": "medium",
      "current_value": "247 villagers in spawn chunks",
      "target_value": "<50 villagers per village",
      "description": "The spawn chunk village has 247 villagers causing significant AI tick overhead (~6.2mspt).",
      "fix": "Move excess villagers to a trading hall outside spawn chunks, or reduce via natural causes.",
      "estimated_mspt_reduction": 5.1
    },
    {
      "id": "sug-002",
      "category": "plugins",
      "severity": "warning",
      "title": "Plugin 'CustomEnchants' taking 4.2mspt average",
      "impact": "medium",
      "effort": "low",
      "current_value": "4.2 mspt",
      "target_value": "<1.0 mspt",
      "description": "CustomEnchants v3.1 consumes 4.2mspt on every tick, primarily in projectile-hit detection.",
      "fix": "Update to v3.2+ which has projectile-hit optimization, or reduce enchantment tick checks via config.",
      "estimated_mspt_reduction": 3.5
    }
  ],
  "health_score": 62
}
```

---

## Data Model

```yaml
Profile:
  id: string (UUID)
  server_id: string
  status: "pending" | "running" | "completed" | "failed"
  type: "snapshot" | "deep" | "continuous"
  duration_seconds: integer
  sampling_interval_ms: integer
  started_at: datetime
  completed_at: datetime
  triggered_by: "manual" | "scheduled" | "alert"
  summary: ProfileSummary
  phase_breakdown: PhaseBreakdown
  tick_samples: TickSample[]
  entity_data: EntityProfilingData
  plugin_data: PluginProfilingData
  redstone_data: RedstoneProfilingData
  chunk_data: ChunkProfilingData
  suggestions: Suggestion[]

ProfileSummary:
  average_mspt: float
  min_mspt: float
  max_mspt: float
  p50_mspt: float
  p95_mspt: float
  p99_mspt: float
  average_tps: float
  ticks_below_20_tps: integer

PhaseBreakdown:
  entities_mspt: float
  tile_entities_mspt: float
  chunks_mspt: float
  plugins_mspt: float
  physics_mspt: float
  other_mspt: float

TickSample:
  tick_number: integer
  mspt: float
  tps: float
  entity_count: integer
  active_chunks: integer
  redstone_updates: integer
  plugin_hooks_run: integer
  gc_paused: boolean
  gc_pause_ms: float

EntityProfilingData:
  total_entities: integer
  by_type: dict          # {"ZOMBIE": 45, "VILLAGER": 247, ...}
  by_chunk: dict         # {"0,0": 34, "12,-34": 89, ...}
  top_entities_by_tick_time: EntityMetric[]
  hopper_count: integer
  hopper_tick_time: float
  item_count: integer
  item_frame_count: integer

PluginProfilingData:
  plugins: PluginMetric[]

PluginMetric:
  name: string
  version: string
  average_mspt: float
  max_mspt: float
  total_calls: integer
  event_handlers: EventHandlerMetric[]

EventHandlerMetric:
  event: string
  plugin: string
  average_ms: float
  max_ms: float
  calls: integer

RedstoneProfilingData:
  total_updates: integer
  updates_per_tick: integer
  hot_chunks: RedstoneChunkData[]

RedstoneChunkData:
  chunk_x: integer
  chunk_z: integer
  world: string
  updates_per_tick: integer
  estimated_mspt: float
  detected_circuit_type: string   # "clock" | "piston_spam" | "hopper_mess"

ChunkProfilingData:
  total_loaded: integer
  total_active: integer
  spawn_chunk_entities: integer
  liquid_tick_hotspots: ChunkLocation[]

Suggestion:
  id: string (UUID)
  category: "entities" | "redstone" | "plugins" | "chunks" | "config" | "hardware"
  severity: "critical" | "warning" | "info"
  title: string
  description: string
  impact: "high" | "medium" | "low"
  effort: "high" | "medium" | "low"
  estimated_mspt_reduction: float
  current_value: string
  target_value: string
  fix: string
  commands: string[]        # in-game commands to run
  references: string[]      # URLs for more info
  auto_fixable: boolean

ServerTrend:
  server_id: string
  period_start: datetime
  period_end: datetime
  daily_summaries: DailySummary[]

DailySummary:
  date: date
  avg_mspt: float
  max_mspt: float
  p95_mspt: float
  avg_tps: float
  peak_player_count: integer
  profile_count: integer
  suggestion_count: integer
```

---

## Service Assignments

| Service | Responsibility |
|---------|---------------|
| **Service Core** | Primary: Profile orchestration, analysis pipeline, suggestion engine, report generation, trend tracking |
| **Management Panel** | Secondary: UI for profile dashboard, flame graph, timeline, suggestions panel, trend charts |
| **Orchestrator Agent** | Secondary: Deploy profiler plugin to target server, manage plugin lifecycle |
| **Discord Service** | None directly; may receive summary notifications |
| **Integration Service** | Secondary: Alert integration on performance anomaly detection |

---

## Effort Estimate

| Phase | Task | PT | Owner |
|-------|------|----|-------|
| P1 | Minecraft profiler plugin (Paper API) | 1.0 | Minecraft Dev |
| P1 | Data collector modules (entity, redstone, plugin) | 0.5 | Minecraft Dev |
| P2 | Tick time analyzer + flame graph data | 0.75 | Backend |
| P2 | Entity/redstone/plugin analysis pipeline | 1.0 | Backend |
| P2 | Chunk & world analyzer | 0.5 | Backend |
| P3 | Suggestion engine (40+ patterns) | 0.75 | Backend/GameDev |
| P3 | Report generator (flame graph, timeline, export) | 0.75 | Frontend |
| P3 | Trend tracking + dashboard | 0.5 | Frontend+Backend |
| **Total** | | **5.75 PT** | |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Profiler plugin itself causes lag | High | Ultra-lightweight sampling; disable in production by default; never sample >1% of tick time |
| Minecraft version incompatibilities | Medium | Target Paper 1.20+ API; version detection; graceful fallback to MSPT-only mode |
| False positives in lag attribution | Medium | Cross-reference multiple indicators; confidence scoring; human validation loop |
| Large servers with 100+ plugins | Medium | Plugin timing is best-effort; aggregate high-level data for overwhelmed servers |
| Player privacy (player entities tracked) | Low | Anonymize player data; no UUID/username storage; aggregate by entity type only |
| Redstone analysis on highly active servers | Medium | Enable redstone module only on-demand; set max update tracking threshold |

---

## Suggestion Knowledge Base Categories

| Category | Count | Examples |
|----------|-------|----------|
| Entity Optimization | 12 | Villager cap, hopper chains, item frames, AI mob farms, animal breeding caps |
| Redstone Optimization | 8 | Clock circuits, piston spam, comparator loops, observer chains |
| Plugin Optimization | 10 | Heavy event handlers, DB query frequency, async processing, scheduler usage |
| World Optimization | 6 | View-distance, simulation-distance, entity-activation-range, mob-spawn |
| Chunk Optimization | 5 | Spawn chunk management, lazy loading, pre-generation |
| Hardware/JVM | 4 | GC tuning, RAM allocation, CPU core pinning, SSD vs HDD |
| Network | 3 | Compression threshold, rate limits, proxy configuration |

---

## Future Enhancements

- **v2.0**: Auto-remediation (apply fix suggestions via RCON)
- **v2.1**: Player-reported lag correlation (where players experience lag)
- **v2.2**: Cross-server profiling comparison
- **v2.3**: Predictive lag detection (ML model trained on historical profiles)
- **v2.4**: Modded server support (Forge, Fabric, NeoForge)
- **v2.5**: Profiling during specific activities (PvP, redstone tests, server startup)
