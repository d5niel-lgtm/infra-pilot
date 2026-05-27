# Feature 41: Desktop App

- **Feature ID:** 41
- **Primary Service:** Management Panel (Tauri)
- **Effort:** Large (7-10 PT)
- **Phase:** Phase 5 (UX, Mobile & Compliance)
- **Dependencies:** Management Panel v1 (React/Vite), Convex backend, zero-native shell (existing)

---

## Overview

Native desktop application built with Tauri that wraps the existing Management Panel (React/Vite) into a fully native experience. Goes beyond the current zero-native WebView shell by adding offline-first local state, system tray integration, native OS notifications, an auto-updater, and deep link protocol handling.

The desktop app targets power users and server administrators who prefer a dedicated native window with system-level integration — taskbar/dock presence, global hotkeys, background running in system tray, and native file dialogs.

### Key Capabilities

- **Native Window** — Frameless or standard window with custom titlebar, draggable regions
- **System Tray** — Minimize to tray, context menu with quick actions (quick restart, status overview)
- **Native Notifications** — OS-native toast/banner notifications, notification center integration
- **Offline-First** — Local state persistence via SQLite, offline action queuing, sync on reconnect
- **Auto-Updater** — Silent background updates, differential downloads, rollback capability
- **Deep Links** — `infrapilot://` protocol handler for server access, action triggers
- **Global Hotkeys** — Custom keyboard shortcuts for quick actions (Ctrl+Shift+S for server search)
- **Touch Bar / Widgets** — macOS Touch Bar integration, desktop widgets (future)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Tauri Desktop App                        │
│                                                          │
│  ┌────────────────────┐  ┌──────────────────────────┐    │
│  │  Rust Core          │  │  WebView Frontend        │    │
│  │                     │  │                          │    │
│  │  ┌───────────────┐  │  │  React / Vite (Panel)   │    │
│  │  │ Tauri Commands │◄─┼──┤                          │    │
│  │  │ (IPC Bridge)   │  │  │  @tauri-apps/api calls  │    │
│  │  └───────┬───────┘  │  └──────────┬───────────────┘    │
│  │          │          │             │                     │
│  │  ┌───────┴───────┐  │             │                     │
│  │  │ Plugin Layer   │  │             │                     │
│  │  │ ┌───────────┐ │  │             │                     │
│  │  │ │System Tray│ │  │             │                     │
│  │  │ │Notifc     │ │  │             │                     │
│  │  │ │Updater    │ │  │             │                     │
│  │  │ │Deep Links │ │  │             │                     │
│  │  │ │Hotkeys    │ │  │             │                     │
│  │  │ └───────────┘ │  │             │                     │
│  │  └───────┬───────┘  │             │                     │
│  │          │          │  ┌──────────▼──────────┐          │
│  │  ┌───────┴───────┐  │  │  Local State (IPC)  │          │
│  │  │ SQLite DB      │◄─┼──┤  IndexedDB / SQLite │          │
│  │  │ (Local cache)  │  │  └─────────────────────┘          │
│  │  └───────────────┘  │                                    │
│  └────────────────────┘                                     │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  WebSocket Client (keepalive, real-time updates)    │  │
│  └──────────────────────┬──────────────────────────────┘  │
└─────────────────────────┼─────────────────────────────────┘
                          │ WSS
┌─────────────────────────┼─────────────────────────────────┐
│          Backend        │                                 │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │           Integration Service                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐    │  │
│  │  │ REST API │ │ WebSocket│ │ Update Server    │    │  │
│  │  │ Gateway  │ │ Hub      │ │ (releases.json)  │    │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘    │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop Shell | Tauri 2.x (Rust) | Smaller binary than Electron (5 MB vs 150+), lower memory, Rust safety |
| Frontend | React 18 + Vite + Tailwind CSS | Reuse existing Management Panel, zero migration needed |
| Local Database | SQLite via tauri-plugin-sql | Offline state, server cache, action queue |
| IPC Bridge | @tauri-apps/api + Tauri Commands | TypeScript ↔ Rust bidirectional communication |
| System Tray | tauri-plugin-tray (custom) | Cross-platform tray with dynamic context menu |
| Notifications | tauri-plugin-notification | Native notification center integration |
| Auto-Updater | tauri-plugin-updater | Differential updates, checksum verification |
| Deep Links | tauri-plugin-deep-link | OS-level protocol handler registration |
| Global Hotkeys | tauri-plugin-global-shortcut | System-wide keyboard shortcuts |
| State Sync | CRDT / last-write-wins merge | Conflict resolution for offline edits |

---

## Implementation Plan

### Phase 1: Tauri Shell & Migration (2 PT)

| Step | Description | Deliverables |
|------|-------------|-------------|
| 1.1 | Tauri project scaffolding | `src-tauri/` directory, Cargo.toml, tauri.conf.json |
| 1.2 | WebView integration | Load existing Vite dev/build into WebView, verify asset paths |
| 1.3 | IPC bridge setup | Tauri commands for core operations, TypeScript bindings |
| 1.4 | Window customization | Frameless window, custom titlebar, draggable regions, min-size |
| 1.5 | Dev workflow | `npm run tauri dev`, hot-reload across Rust + React |

**tauri.conf.json:**

```json
{
  "productName": "Infra Pilot",
  "version": "1.0.0",
  "identifier": "com.infrapilot.desktop",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "Infra Pilot",
        "width": 1280,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "decorations": false,
        "center": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' https://api.infrapilot.io wss://api.infrapilot.io; style-src 'self' 'unsafe-inline'"
    }
  },
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": ["https://releases.infrapilot.io/desktop/{{target}}/{{current_version}}"],
      "dialog": true,
      "pubkey": "YOUR_UPDATER_PUBLIC_KEY"
    },
    "deep-link": {
      "desktop": {
        "schemes": ["infrapilot"]
      }
    }
  }
}
```

**Folder structure:**

```
services/management-panel/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs              # Entry point
│   │   ├── lib.rs                # Tauri builder setup
│   │   ├── commands/             # IPC command handlers
│   │   │   ├── mod.rs
│   │   │   ├── system.rs         # System info, app state
│   │   │   ├── notifications.rs  # Native notification dispatch
│   │   │   ├── tray.rs           # System tray management
│   │   │   ├── updater.rs        # Update checks & apply
│   │   │   └── deeplink.rs       # Deep link handler
│   │   ├── db/                   # SQLite operations
│   │   │   ├── mod.rs
│   │   │   ├── schema.rs
│   │   │   └── migrations.rs
│   │   └── state.rs              # AppState (DB pool, config)
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   ├── icons/
│   └── build.rs
├── src/                          # Existing React frontend
├── public/
├── package.json
└── vite.config.ts
```

### Phase 2: System Tray & Native Notifications (2 PT)

| Step | Description | Deliverables |
|------|-------------|-------------|
| 2.1 | System tray menu | Tray icon, context menu (Open, Quick Restart, Status Dashboard, Quit) |
| 2.2 | Dynamic tray updates | Server status badge counter, connection indicator |
| 2.3 | Minimize-to-tray | Close button minimizes, Ctrl+Q to quit, double-click to restore |
| 2.4 | Native notification dispatch | Forward Panel alerts to OS notification center |
| 2.5 | Notification click handling | Click notification → open window → navigate to relevant view |

**System tray diagram:**

```
System Tray Icon (dynamic badge):
  ● Green  = All servers online
  ● Yellow = Some servers degraded
  ● Red    = Critical alerts active

Context Menu:
  ┌──────────────────────┐
  │  Open Infra Pilot    │
  │  ─────────────────── │
  │  Server Status        │
  │  ├─ web-01  ● Online │
  │  ├─ db-01   ● Online │
  │  └─ game-01 ● Online │
  │  ─────────────────── │
  │  Quick Actions        │
  │  ├─ Restart web-01  ▶│
  │  └─ Backup all      ▶│
  │  ─────────────────── │
  │  Settings             │
  │  Quit                 │
  └──────────────────────┘
```

### Phase 3: Offline-First Local State (2 PT)

| Step | Description | Deliverables |
|------|-------------|-------------|
| 3.1 | SQLite schema | Local cache tables (servers, events, settings, action_queue) |
| 3.2 | Sync engine | Background sync on connectivity change, delta updates |
| 3.3 | Offline action queue | Queue mutations, replay on reconnect, conflict detection |
| 3.4 | Connectivity indicator | Global offline banner, stale data badges |

**Local state data flow:**

```
┌──────────┐    Online?    ┌──────────┐
│  React    │─────────────▶│  API     │
│  Frontend │◀─────────────│  Client  │
└─────┬────┘               └──────────┘
      │ IPC                          ▲
      ▼                              │
┌──────────┐               ┌─────────┴────┐
│ Tauri    │               │ Sync Engine  │
│ Commands │◀──────────────│ (background) │
│          │               └──────────────┘
│  SQLite  │◀──────────────┘
│  (local) │
└──────────┘
```

**SQLite schema:**

```sql
-- Local server cache
CREATE TABLE cached_servers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  ip_address TEXT,
  cpu_usage REAL,
  ram_usage REAL,
  ram_total INTEGER,
  disk_usage REAL,
  last_seen TEXT,
  cached_at TEXT NOT NULL DEFAULT (datetime('now')),
  dirty INTEGER DEFAULT 0     -- Flag for unsynced local changes
);

-- Action queue for offline operations
CREATE TABLE action_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('start', 'stop', 'restart')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'syncing', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

-- Local settings (synced to cloud when online)
CREATE TABLE local_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Notification log (local only)
CREATE TABLE notification_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id TEXT UNIQUE,
  title TEXT NOT NULL,
  body TEXT,
  server_id TEXT,
  severity TEXT,
  read INTEGER DEFAULT 0,
  received_at TEXT NOT NULL
);
```

### Phase 4: Auto-Updater (1 PT)

| Step | Description | Deliverables |
|------|-------------|-------------|
| 4.1 | Update server setup | Static JSON manifest on CDN, signed release artifacts |
| 4.2 | Update check interval | Check on launch + every 6 hours, user-initiated check |
| 4.3 | Download & install | Background download, progress bar, prompt on ready |
| 4.4 | Rollback mechanism | Backup previous version, restore on crash loop detection |

**Update manifest format (`releases.json`):**

```json
{
  "version": "1.2.0",
  "pub_date": "2026-06-15T10:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://releases.infrapilot.io/desktop/1.2.0/InfraPilot_1.2.0_x64.msi.zip"
    },
    "darwin-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://releases.infrapilot.io/desktop/1.2.0/InfraPilot_1.2.0_x64.dmg.zip"
    },
    "darwin-aarch64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://releases.infrapilot.io/desktop/1.2.0/InfraPilot_1.2.0_aarch64.dmg.zip"
    },
    "linux-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://releases.infrapilot.io/desktop/1.2.0/InfraPilot_1.2.0_amd64.AppImage.tar.gz"
    }
  }
}
```

### Phase 5: Deep Links & Global Hotkeys (1 PT)

| Step | Description | Deliverables |
|------|-------------|-------------|
| 5.1 | Protocol registration | `infrapilot://` scheme on all platforms |
| 5.2 | Route resolver | Parse deep link → React Router navigation |
| 5.3 | Global hotkeys | Configurable shortcuts via Settings UI |
| 5.4 | Hotkey presets | Default profiles (Administrator, Developer, Game Host) |

**Deep link URL scheme:**

```
infrapilot://servers                              → Open server list
infrapilot://server/{id}                          → Open server detail
infrapilot://server/{id}/terminal                 → Open terminal
infrapilot://alerts                               → Open alert center
infrapilot://settings                             → Open settings
infrapilot://action/restart?server={id}           → Confirm restart dialog
infrapilot://search?q={query}                     → Open search with query
```

---

## API Design (Backend Additions)

The desktop app uses the existing API but requires new endpoints for updater and state sync:

```yaml
# Update check endpoint (called by Tauri plugin)
GET https://releases.infrapilot.io/desktop/{target}/{current_version}
  Response:
    version: "1.2.0"
    pub_date: "2026-06-15T10:00:00Z"
    url: "https://..."
    signature: "dW50cnVzdGVk..."
    notes: "Bug fixes and performance improvements"

# State sync endpoint
POST /api/v2/desktop/sync
  Headers:  Authorization: Bearer <token>
  Body:
    last_sync_at: "2026-05-27T12:00:00Z"
    actions: [                           # Queued offline actions
      { id: "local_1", server_id: "srv_1", action: "restart", timestamp: "..." },
      { id: "local_2", server_id: "srv_2", action: "start", timestamp: "..." }
    ]
    settings: { theme: "dark", terminal_font_size: 14 }
  Response:
    sync_at: "2026-05-27T12:05:00Z"
    action_results: [
      { local_id: "local_1", status: "accepted", job_id: "job_abc" },
      { local_id: "local_2", status: "accepted", job_id: "job_def" }
    ]
    updated_servers: [ { id: "srv_1", status: "online", ... } ]
    conflicts: []                     # Server-side wins for conflicting edits
```

---

## Service Assignments

| Service | Role | Ownership |
|---------|------|-----------|
| **Management Panel** | Tauri shell, Rust plugins, frontend integration | Desktop team (2 devs) |
| **Integration Service** | State sync endpoint, notification proxy | Backend team |
| **Infrastructure** | Update CDN, release CI/CD pipeline signing | DevOps team |

---

## Offline-First Conflict Resolution

| Scenario | Resolution Strategy |
|----------|-------------------|
| Server status changed while offline | Server wins — discard local stale status on sync |
| User queued action while online elsewhere | Server deduplicates by action + timestamp |
| Settings changed on two devices | Last-write-wins with server timestamp |
| Action failed on server (e.g., server already stopped) | Action marked `failed` with error message, notify user |

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Update tampering | Ed25519 signature verification via tauri-plugin-updater |
| Deep link injection | URL scheme validated in Rust before passing to frontend |
| Local data exposure | SQLite encryption via tauri-plugin-sql with OS keychain |
| Backend token storage | Encrypted in OS keychain (Windows Credential Manager, macOS Keychain, Linux secret-service) |

---

## Effort Estimate: Large (7-10 PT)

| Phase | PT | Dependencies |
|-------|----|-------------|
| Phase 1: Tauri Shell & Migration | 2 | Management Panel v1 (existing) |
| Phase 2: System Tray & Notifications | 2 | Phase 1 |
| Phase 3: Offline-First Local State | 2 | Phase 1 |
| Phase 4: Auto-Updater | 1 | Phase 1, Update CDN |
| Phase 5: Deep Links & Hotkeys | 1 | Phase 1-2 |
| Packaging, signing & CI/CD | 1 | All phases |
| **Total** | **9** | |

### Staffing Recommendation

- **1 Senior Rust Developer** — Tauri core, plugins, IPC commands, auto-updater
- **1 Full-Stack Developer** — React integration, offline state sync, frontend IPC bindings
- **1 DevOps Engineer** — 25% time, release pipeline, code signing, update CDN

---

## Comparison: zero-native Shell vs. Tauri

| Aspect | Current zero-native Shell | Proposed Tauri App |
|--------|--------------------------|-------------------|
| Binary size | ~5 MB (Zig + system WebView) | ~5-8 MB |
| System tray | Manual implementation | Plugin ecosystem |
| Offline state | None — requires network | SQLite local cache |
| Auto-updater | Manual | Built-in plugin |
| Deep links | Not supported | Plugin-supported |
| Global hotkeys | Not possible | Plugin-supported |
| Native file dialogs | Via WebView only | Tauri plugin |
| Development maturity | Experimental | Battle-tested (v2 stable) |
| Effort to add features | High (custom Zig) | Low (plugin ecosystem) |
