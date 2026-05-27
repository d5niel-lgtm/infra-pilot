# Feature 40: Mobile App

- **Feature ID:** 40
- **Primary Service:** New `mobile/` directory
- **Effort:** Extra Large (11+ PT)
- **Phase:** Phase 5 (UX, Mobile & Compliance)
- **Dependencies:** Stable REST API (Phase 1-2), Webhook Event Bus (#13), Push notification infrastructure

---

## Overview

Native mobile application (iOS & Android) for on-the-go server management. Provides real-time server monitoring, push notifications for alerts, quick-action toggles (restart, stop, start), a mobile-optimized terminal emulator, and biometric authentication.

The mobile app targets server administrators and game server owners who need immediate visibility and control from their phone without launching a desktop browser.

### Key Capabilities

- **Dashboard** — Server list with health status, CPU/RAM/disk gauges
- **Push Notifications** — Alert on server down, backup complete, high resource usage
- **Quick Actions** — Start/stop/restart servers, one-tap SSH keys
- **Mobile Terminal** — Optimized terminal emulator with touch-friendly keyboard
- **Biometric Auth** — Face ID / Touch ID / fingerprint for app unlock
- **Offline Support** — Cached server list, queued actions, offline-first data model
- **Deep Links** — `infrapilot://server/{id}` to open specific server views

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Mobile App (iOS/Android)            │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────┐  │
│  │  UI Layer    │  │  State       │  │  Local   │  │
│  │ (Screens,    │──│  Management  │──│  DB      │  │
│  │  Widgets)    │  │  (Riverpod)  │  │  (SQLite)│  │
│  └─────────────┘  └──────┬───────┘  └─────────┘  │
│                          │                        │
│  ┌───────────────────────┴──────────────────────┐ │
│  │            Service Layer                      │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │ │
│  │  │ API      │ │ WebSocket│ │ Push          │  │ │
│  │  │ Client   │ │ Client   │ │ Registration  │  │ │
│  │  └──────────┘ └──────────┘ └──────────────┘  │ │
│  └───────────────────────┬──────────────────────┘ │
└──────────────────────────┼────────────────────────┘
                           │ HTTPS / WSS
┌──────────────────────────┼────────────────────────┐
│            Backend       │                        │
│  ┌───────────────────────┴──────────────────────┐ │
│  │           Integration Service                 │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │ │
│  │  │ REST API │ │ WebSocket│ │ FCM/APNs     │  │ │
│  │  │ Gateway  │ │ Hub      │ │ Proxy         │  │ │
│  │  └──────────┘ └──────────┘ └──────────────┘  │ │
│  └──────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Flutter 3.x | Single codebase, strong mobile terminal ecosystem, excellent perf |
| State Management | Riverpod + flutter_bloc | Testable, reactive, scalable |
| Local DB | drift (SQLite) | Offline-first, type-safe queries, migrations |
| HTTP Client | Dio | Interceptors, retry, SSL pinning |
| WebSocket | web_socket_channel | Native WebSocket support |
| Push Notifications | firebase_messaging + local_notifications | FCM for Android, APNs via FCM proxy |
| Terminal Emulator | flutter_xterm / terminal_xterm | Full VT100/xterm emulation |
| Biometrics | local_auth | Platform biometric API |
| Secure Storage | flutter_secure_storage | Keychain/Keystore for tokens |
| Deep Linking | app_links + uni_links | Universal links / App Links |
| CI/CD | Codemagic / GitHub Actions | iOS + Android builds in parallel |

---

## Implementation Plan

### Phase 1: Foundation (3 PT)

| Step | Description | Deliverables |
|------|-------------|-------------|
| 1.1 | Project scaffolding | Flutter project, folder structure, CI/CD pipeline |
| 1.2 | API client layer | Dio-based REST client with auth token refresh, error handling |
| 1.3 | State management setup | Riverpod providers, app state models, repository pattern |
| 1.4 | Local database | drift schema for cached servers, users, settings |
| 1.5 | Navigation shell | Bottom tab navigation (Dashboard, Servers, Terminal, Settings) |

**Folder structure:**

```
mobile/
├── lib/
│   ├── app/                  # App entry, router, theme
│   │   ├── router/
│   │   ├── theme/
│   │   └── app.dart
│   ├── core/                 # Shared utilities
│   │   ├── api/              # Dio client, interceptors
│   │   ├── storage/          # Secure storage, prefs
│   │   ├── websocket/        # WS connection manager
│   │   └── constants/
│   ├── features/             # Feature modules
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── servers/
│   │   ├── terminal/
│   │   ├── notifications/
│   │   └── settings/
│   ├── models/               # Data models (freezed)
│   ├── repositories/         # Data access layer
│   └── providers/            # Riverpod providers
├── test/
├── ios/
├── android/
├── pubspec.yaml
└── README.md
```

### Phase 2: Authentication & Server Management (3 PT)

| Step | Description | Deliverables |
|------|-------------|-------------|
| 2.1 | Login flow | API token auth, OAuth2 PKCE flow, session persistence |
| 2.2 | Biometric unlock | local_auth integration, app lock screen |
| 2.3 | Server list | Paginated list with search, sort, status indicators |
| 2.4 | Server detail view | Metrics gauges, recent events, quick actions |
| 2.5 | Server control | Start/stop/restart with confirmation, action history |

**API Endpoints consumed:**

```yaml
# Core mobile API endpoints
endpoints:
  auth:
    login:
      method: POST
      path: /api/v2/auth/login
      body: { email, password, device_name }
      response: { access_token, refresh_token, user }

    refresh:
      method: POST
      path: /api/v2/auth/refresh
      body: { refresh_token }
      response: { access_token, refresh_token }

  servers:
    list:
      method: GET
      path: /api/v2/servers
      params: { page, per_page, search, sort, status }
      response: { data: [Server], meta: { page, total } }

    detail:
      method: GET
      path: /api/v2/servers/{id}
      response: { data: Server, metrics: Metrics }

    action:
      method: POST
      path: /api/v2/servers/{id}/action
      body: { action: "start" | "stop" | "restart" | "kill" }
      response: { status: "accepted", job_id }

  metrics:
    realtime:
      method: GET (WebSocket Upgrade)
      path: /api/v2/ws/servers/{id}/metrics
      frames: [ { cpu, ram, disk, net_rx, net_tx, timestamp } ]
```

### Phase 3: Push Notifications (2 PT)

| Step | Description | Deliverables |
|------|-------------|-------------|
| 3.1 | FCM registration | Token registration on login, refresh on token change |
| 3.2 | Notification handlers | Foreground (in-app banner), background (system tray), data-only (silent sync) |
| 3.3 | Notification preferences | Per-category toggle (alerts, backups, deployments), quiet hours |
| 3.4 | Deep link routing | Parse notification payload → navigate to relevant screen |

**Notification payload format:**

```json
{
  "notification": {
    "title": "Server Alert",
    "body": "web-01 is down — automatic restart initiated"
  },
  "data": {
    "type": "server.alert",
    "server_id": "srv_abc123",
    "severity": "critical",
    "action_url": "infrapilot://server/srv_abc123",
    "silent": false,
    "category": "alerts"
  }
}
```

### Phase 4: Mobile Terminal (2 PT)

| Step | Description | Deliverables |
|------|-------------|-------------|
| 4.1 | Terminal widget | xterm.js-based Flutter terminal emulator widget |
| 4.2 | SSH/WebSocket relay | Connect via REST API WebSocket proxy, not direct SSH |
| 4.3 | Touch keyboard | Custom toolbar: Tab, Ctrl, Esc, arrow keys, function keys |
| 4.4 | Session persistence | Restore terminal session, scrollback buffer caching |

**Terminal architecture:**

```
┌─────────────────────────────────────────────┐
│          Mobile App                         │
│  ┌─────────────────────────────────────┐    │
│  │  Terminal Widget (flutter_xterm)    │    │
│  │  ┌───────────────────────────────┐  │    │
│  │  │  Terminal Buffer             │  │    │
│  │  │  (scrollback, selection)     │  │    │
│  │  └───────────────────────────────┘  │    │
│  └──────────────────┬──────────────────┘    │
│                     │ WebSocket (WSS)       │
│  ┌──────────────────▼──────────────────┐    │
│  │  Terminal Proxy Service (Backend)   │    │
│  │  ┌──────────────┐ ┌──────────────┐  │    │
│  │  │ WS Server    │→│ SSH Client   │  │    │
│  │  │ (auth, audit)│ │ (session mgr)│  │    │
│  │  └──────────────┘ └──────────────┘  │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Phase 5: Offline Support & Polish (1 PT)

| Step | Description | Deliverables |
|------|-------------|-------------|
| 5.1 | Offline-first data model | Read from local DB, sync in background on connectivity |
| 5.2 | Action queue | Queue server actions when offline, execute on reconnect |
| 5.3 | Connectivity awareness | Banner when offline, graceful degradation |
| 5.4 | Error states | Empty states, retry widgets, timeout handling |

---

## Data Model

```yaml
# Core mobile-local data models (drift/SQLite)
MobileServer:
  table: servers
  columns:
    id: TEXT PRIMARY KEY           # Server UUID
    name: TEXT NOT NULL
    status: TEXT NOT NULL           # online | offline | starting | stopping | error
    ip_address: TEXT
    region: TEXT
    cpu_usage: REAL                # 0.0 - 100.0
    ram_usage: REAL
    ram_total: INTEGER             # MB
    disk_usage: REAL
    disk_total: INTEGER            # GB
    last_seen: TEXT                # ISO 8601
    cached_at: TEXT                # Local cache timestamp
    favorite: INTEGER DEFAULT 0    # Boolean (0/1)

MobileNotification:
  table: notifications
  columns:
    id: TEXT PRIMARY KEY
    type: TEXT NOT NULL            # server.alert | backup.done | deploy.complete
    title: TEXT NOT NULL
    body: TEXT
    server_id: TEXT                # FK to servers.id
    severity: TEXT                 # info | warning | critical
    read: INTEGER DEFAULT 0
    action_url: TEXT               # Deep link
    received_at: TEXT NOT NULL

ActionQueue:
  table: action_queue
  columns:
    id: INTEGER PRIMARY KEY AUTOINCREMENT
    server_id: TEXT NOT NULL
    action: TEXT NOT NULL          # start | stop | restart
    status: TEXT DEFAULT "pending" # pending | syncing | completed | failed
    created_at: TEXT NOT NULL
    synced_at: TEXT
    error_message: TEXT
```

---

## API Design (Backend Additions)

The mobile app consumes the existing REST API but requires several new/adapted endpoints:

### New Endpoints

```yaml
# Push notification registration
POST /api/v2/devices/register
  Body:   { device_token, platform: "ios"|"android", app_version }
  Response: { device_id, registered_at }

POST /api/v2/devices/unregister
  Body:   { device_token }
  Response: { success: true }

# Notification preferences
GET /api/v2/notifications/preferences
  Response: { categories: [{ type, enabled, push, email }] }

PUT /api/v2/notifications/preferences
  Body:   { categories: [{ type, enabled: bool }] }
  Response: { success: true }

# Terminal WebSocket proxy
GET /api/v2/ws/servers/{id}/terminal
  Upgrade: WebSocket
  Query:   { cols, rows, font_size }
  Frames:  [ stdin: text, stdout: text, resize: { cols, rows } ]

# Biometric auth token
POST /api/v2/auth/biometric-token
  Body:   { password }
  Response: { biometric_token, expires_at }

POST /api/v2/auth/biometric-login
  Body:   { biometric_token }
  Response: { access_token, refresh_token }
```

---

## Service Assignments

| Service | Role | Ownership |
|---------|------|-----------|
| **New: `mobile/`** | Flutter app codebase, builds, app store deployment | Mobile team (2-3 devs) |
| **Integration Service** | Push notification FCM/APNs proxy, terminal WS relay, device registration API | Backend team |
| **Management Panel** | Shared API client types & OpenAPI spec; no mobile UI changes | Shared |
| **Service Core** | No direct changes; mobile relies on existing core API | — |

---

## Push Notification Architecture

```
┌──────────┐    FCM/APNs    ┌────────────┐   HTTPS   ┌──────────────────┐
│  Mobile   │◄──────────────│ Firebase    │◄─────────│ Integration      │
│  Device   │                │ Cloud       │          │ Service          │
│           │                │ Messaging   │          │                  │
└──────────┘                └────────────┘          │  ┌────────────┐   │
       ▲                                             │  │ Event      │   │
       │ WebSocket (app open)                        │  │ Router     │   │
       └─────────────────────────────────────────────│  │ (webhook)  │   │
                                                     │  └────────────┘   │
                                                     │         ▲         │
                                                     │    ┌───────────┐  │
                                                     │    │ Event Bus │  │
                                                     │    │ (#13)     │  │
                                                     │    └───────────┘  │
                                                     └──────────────────┘
```

---

## Offline-First Strategy

| Scenario | Behavior |
|----------|----------|
| No connectivity at launch | Show cached server list with "offline" badge, stale data indicator |
| Action while offline | Queue action in local DB, show "pending" indicator, execute on reconnect |
| Connectivity restored | Sync pending actions, refresh server data, clear stale indicators |
| Partial connectivity | Retry with exponential backoff, show per-item error states |
| Token expired offline | Store refresh token securely, re-auth on reconnect transparently |

---

## Mobile Terminal UX

The mobile terminal requires careful UX decisions:

- **Gesture handling** — Pinch-to-zoom font size, swipe to scroll buffer, long-press for paste
- **Touch keyboard toolbar** — Persistent bottom bar with: Ctrl, Tab, Esc, Arrow keys, Function keys (F1-F12), clipboard paste
- **Color scheme** — Match desktop terminal theme, optionally customisable
- **Session timeout** — Auto-disconnect after 15 min inactivity, reconnect prompt
- **Buffer limit** — 10,000 line scrollback, overflow truncation with "buffer full" indicator

---

## Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Token theft | Device-bound biometric token + short-lived access tokens |
| Man-in-the-middle | Certificate pinning (Dio SSL pinning), WSS required |
| Local data exposure | All cached data encrypted with flutter_secure_storage |
| Push notification spoofing | Verify FCM/APNs signature server-side |
| Terminal session hijack | One-time terminal token, scoped to server, expires on disconnect |

---

## Effort Estimate: Extra Large (11+ PT)

| Phase | PT | Dependencies |
|-------|----|-------------|
| Phase 1: Foundation | 3 | — |
| Phase 2: Auth & Server Management | 3 | Phase 1, Stable REST API |
| Phase 3: Push Notifications | 2 | Phase 2, Webhook Event Bus (#13) |
| Phase 4: Mobile Terminal | 2 | Phase 2, Terminal Proxy Service |
| Phase 5: Offline & Polish | 1 | Phase 2-4 |
| App Store submission & CI/CD | 1 | All phases |
| **Total** | **12** | |

### Staffing Recommendation

- **2 Senior Flutter Developers** — Full-time, Phases 1-5
- **1 Backend Developer** — 50% time, push notification & terminal proxy endpoints
- **1 QA Engineer** — 50% time, device matrix testing, E2E test automation
