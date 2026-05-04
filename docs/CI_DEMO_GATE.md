# CI and Local Gating Demo</br>

This document describes how Seed Demo gating works, how to enable/disable it per environment, and how to verify it in CI as well as locally.

Overview
- Demo feature flag: VITE_DEMO_FEATURE_ENABLED controls whether the Seed Demo feature is visible in the UI and whether the API seed/guard behavior is enabled.
- Global status badge: A small Demo flag badge is rendered in the header across the app to show if the demo flag is on or off.
- CI tests: Playwright tests verify the gating by hitting an endpoint that reports the flag value and by validating UI gating behavior when the backend is reachable.

Per-environment configuration
- Development: set VITE_DEMO_FEATURE_ENABLED=true (seed demo flows available)
- Staging/QA: set VITE_DEMO_FEATURE_ENABLED=true for tester access or false to hide
- Production: set VITE_DEMO_FEATURE_ENABLED=false (default) to guard against accidental seeds

Testing in CI
- The workflow runs two Playwright test jobs:
  1) DEMO enabled (VITE_DEMO_FEATURE_ENABLED=true)
  2) DEMO disabled (VITE_DEMO_FEATURE_ENABLED=false)
- A dedicated Playwright test file (demo_gate.spec.ts) verifies that the backend flag aligns with the environment value by calling /api/demo/flag.
- If the backend is not up in CI, the test will skip gracefully.

Locally validating gating (one-off)
- Start the app with flag ON:
  - Unix/macOS: export VITE_DEMO_FEATURE_ENABLED=true; (cd services/management-panel; npm ci; npm run dev)
  - Windows PowerShell: $env:VITE_DEMO_FEATURE_ENABLED = "true"; cd services\management-panel; npm ci; npm run dev
- Open app and verify Seed Demo button visibility and the global Demo badge show ON.
- Start the app with flag OFF:
  - Unix/macOS: export VITE_DEMO_FEATURE_ENABLED=false; (cd services/management-panel; npm ci; npm run dev)
  - Windows PowerShell: $env:VITE_DEMO_FEATURE_ENABLED = "false"; cd services\management-panel; npm ci; npm run dev
- Run UI tests:
  - cd services/management-panel
  - npm run test:playwright

UI endpoints and API checks
- Backend flag endpoint: GET /api/demo/flag returns { enabled: true|false }
- Seed Demo endpoint: POST /api/seed-demo (requires Business Mode)

Notes
- The flag is frontend-visible as a status badge and gating on the Seed Demo control; the backend endpoint ensures the gating is verifiable in CI.
- If you make further changes to gating in the repo, update this document accordingly.
