# zero-native Management Panel Shell

Infra Pilot now includes a zero-native desktop shell for the React/Vite management panel. This is the part of the project that can be rewritten cleanly to zero-native today: the user interface runs in a native WebView shell, while the Express API, orchestrator, and service-core remain long-running services.

## What changed

- `services/management-panel/app.zon` is the zero-native app manifest. It defines the app identity, WebView source, Vite dev-server command, navigation policy, and main window size.
- `services/management-panel/native/src/main.zig` is the Zig native entry point. It selects a zero-native platform backend, loads `dist/index.html` for production, and switches to the managed Vite URL when `ZERO_NATIVE_FRONTEND_URL` is set by `zero-native dev`.
- `services/management-panel/build.zig` adds desktop-oriented build steps around the existing frontend build.
- The existing Express API is intentionally not embedded into Zig. Keep it as the local API process on `http://127.0.0.1:3001` so Docker, database, and authentication integrations continue to work unchanged.

## Prerequisites

- Zig 0.16.0 or newer.
- Node.js 18+ with npm.
- The zero-native CLI: `npm install -g zero-native`.
- A zero-native framework checkout available at `vendor/zero-native` from the repository root, or pass `-Dzero-native-path=/path/to/zero-native` to Zig.
- Linux desktop builds need GTK4 and WebKitGTK 6 development packages. macOS uses the system WebKit runtime.

## Development flow

Run the API in one terminal:

```bash
cd services/management-panel
npm run dev:backend
```

Run the native shell in another terminal:

```bash
cd services/management-panel
npm run desktop:dev -- -Dzero-native-path=/absolute/path/to/zero-native
```

`desktop:dev` builds the Zig shell and delegates frontend lifecycle management to `zero-native dev`, which starts Vite, waits for `http://127.0.0.1:5173/`, injects `ZERO_NATIVE_FRONTEND_URL`, and launches the native WebView.

## Production/package flow

```bash
cd services/management-panel
npm run build
npm run desktop:package -- -Dzero-native-path=/absolute/path/to/zero-native
```

The package step uses the built `dist/` directory and serves it through the `zero://app` origin declared in `app.zon`.

## Validation

```bash
cd services/management-panel
npm run desktop:validate
npm run desktop:doctor
```

Use `desktop:doctor` before packaging on a real workstation because it checks the host WebView environment as well as the manifest.

## Current boundaries

- The zero-native integration uses `.web_engine = "system"` by default for the smallest native shell.
- Chromium/CEF metadata is present in `app.zon`, but the local `build.zig` intentionally supports the system WebView path first. Add CEF bundling only after the team decides it needs pinned Chromium rendering.
- The browser version remains supported via `npm run dev` and Docker Compose.
