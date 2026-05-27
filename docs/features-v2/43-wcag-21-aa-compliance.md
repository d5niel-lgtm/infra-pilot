# Feature 43: WCAG 2.1 AA Compliance

- **Feature ID:** 43
- **Status:** Planned
- **Priority:** High
- **Primary Service:** Management Panel
- **Effort Estimate:** Large (7–10 PT)
- **Dependencies:** None

---

## 1. Overview

Bring the Management Panel into conformance with the **Web Content Accessibility
Guidelines (WCAG) 2.1 Level AA**. This covers screen-reader compatibility,
keyboard-only navigation, visible focus indicators, sufficient colour contrast,
ARIA landmark / live-region annotations, and respect for user reduced-motion
preferences.

### Goals

1. Achieve WCAG 2.1 AA audit pass rate ≥ 95 % (automated tools + manual checks).
2. Every interactive element operable via keyboard alone.
3. No information conveyed solely through colour.
4. All motion / animation respects `prefers-reduced-motion`.

---

## 2. Architecture & Component Map

```
┌─────────────────────────────────────────────────────────────────┐
│                     Management Panel                             │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  AccessibilityProvider (React Context)                    │   │
│  │  • reads prefers-reduced-motion                           │   │
│  │  • exposes ariaAnnouncer (live region)                    │   │
│  │  • tracks focus trap state                                │   │
│  └──────────────┬────────────────────────────────────────────┘   │
│                 │                                                 │
│  ┌──────────────▼────────────────────────────────────────────┐   │
│  │  @infra-pilot/ui — component library                      │   │
│  │  • Button, Input, Select, Modal, Table, etc.             │   │
│  │  • each component owns its ARIA attributes                │   │
│  │  • focus management hooks (useFocusTrap, useTabIndex)     │   │
│  └──────────────┬────────────────────────────────────────────┘   │
│                 │                                                 │
│  ┌──────────────▼────────────────────────────────────────────┐   │
│  │  Pages / Features                                         │   │
│  │  • compose shared components                              │   │
│  │  • add page-level landmarks (<nav>, <main>, etc.)         │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Audit Tooling (dev / CI)                                 │   │
│  │  • axe-core (unit + E2E)                                  │   │
│  │  • Lighthouse CI (per-PR gate)                            │   │
│  │  • Storybook → a11y addon                                 │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Plan

### Phase 1 — Foundation (2–3 PT)

1. **AccessibilityProvider**  
   - Create React context that reads `prefers-reduced-motion` via
     `matchMedia`.  
   - Provide an `announce(message, priority)` method backed by an
     `aria-live` region.  
   - Track modal / drawer open state to manage focus trapping.

2. **Shared hooks**  
   - `useFocusTrap(containerRef, isActive)` — traps Tab cycling.  
   - `useSkipLink()` — renders a "Skip to content" link.  
   - `useAnnounce()` — convenience wrapper for the live region.

3. **CI audit gate**  
   - Add `@axe-core/playwright` to E2E suite.  
   - Configure Lighthouse CI to fail builds if accessibility score < 90.

### Phase 2 — Component Audit & Fixes (3–4 PT)

For each component in `@infra-pilot/ui`:

| Component   | Required ARIA                                      |
|-------------|----------------------------------------------------|
| Button      | `role="button"` (if not native `<button>`)         |
| Input       | `aria-invalid`, `aria-describedby` (hint/error)    |
| Select      | `aria-expanded`, `aria-activedescendant`           |
| Modal       | `role="dialog"`, `aria-modal`, `aria-labelledby`   |
| Table       | `<caption>`, `scope` on `<th>`, `aria-sort`        |
| Tabs        | `role="tablist"`, `role="tab`, `aria-selected`     |
| Toast       | `role="alert"` / `aria-live="polite"`              |
| Tooltip     | `role="tooltip"`, `aria-describedby`               |

Checklist applied to every component:
- [ ] Visible focus ring (`:focus-visible`) — minimum 3 px offset.
- [ ] Keyboard interaction spec documented in Storybook.
- [ ] Colour-contrast ratio ≥ 4.5 : 1 (normal) / 3 : 1 (large).
- [ ] No colour-only state indicators (add icons / underlines).
- [ ] Respects `prefers-reduced-motion` — replace animations with
      instant transitions.

### Phase 3 — Page-Level Landmarks (1 PT)

- Every top-level route renders `<SkipLink />`.
- Pages use semantic landmarks: `<header>`, `<nav>`, `<main>`,
  `<aside>`, `<footer>`.
- Dynamic content updates announced via `useAnnounce()`.

### Phase 4 — QA & Remediation (1–2 PT)

- Run full axe-core scan on every route; fix violations.
- Manual keyboard walk-through (Tab, Shift+Tab, Enter, Escape, arrow keys).
- Screen-reader testing with NVDA (Windows) and VoiceOver (macOS).
- Reduced-motion validation — enable OS setting, verify all animations
  honour the preference.

---

## 4. API Design

Most work is client-side; no new backend endpoints are required.  
One new internal context API:

### `AccessibilityContext`

```typescript
interface AccessibilityContextValue {
  /** True when user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Send a message to the aria-live region */
  announce: (message: string, priority?: 'polite' | 'assertive') => void;
  /** Register a focus trap; returns unregister function */
  registerFocusTrap: (id: string, containerRef: RefObject<HTMLElement>) => () => void;
}
```

### CSS Custom Properties for Contrast

```css
:root {
  --a11y-focus-ring-color: #0066cc;
  --a11y-focus-ring-width: 3px;
  --a11y-focus-ring-offset: 2px;
  --a11y-motion-duration: 0ms;          /* overridden for reduced-motion */
  --a11y-motion-easing: step-start;
}
```

---

## 5. Data Model

No new database tables. An audit-trail store (localStorage / IndexedDB) may be
added later for tracking user-driven accessibility preferences:

```typescript
interface A11yPreferences {
  highContrast?: boolean;        // optional forced high-contrast override
  fontSizeScale?: number;        // 1.0 = default, 1.25 = 125 %
  reducedMotionOverride?: 'auto' | 'reduce' | 'no-preference';
}
```

Stored under key `infra-pilot:a11y-preferences`.

---

## 6. Service Assignments

| Service           | Role                                                              |
|-------------------|-------------------------------------------------------------------|
| Management Panel  | All UI changes, component library audit, context provider, E2E    |
| Design (Figma)    | Provide colour tokens with verified contrast ratios               |
| QA                | Manual screen-reader + keyboard audit, Lighthouse CI gate review  |

---

## 7. Effort Estimate

| Phase                    | Person-days |
|--------------------------|-------------|
| Foundation (provider + CI) | 2–3        |
| Component audit & fixes    | 3–4        |
| Page-level landmarks       | 1          |
| QA & remediation           | 1–2        |
| **Total**                  | **7–10**   |

---

## 8. Acceptance Criteria

1. [ ] All automated axe-core tests pass with zero violations.
2. [ ] Lighthouse a11y score ≥ 90 in CI.
3. [ ] Every `<button>`, `<a>`, `<input>`, `<select>`, `<textarea>` is
       reachable and operable by keyboard.
4. [ ] Visible focus indicator is present on all interactive elements.
5. [ ] Colour-contrast ratio ≥ 4.5 : 1 for body text.
6. [ ] No information conveyed by colour alone (icons / labels added).
7. [ ] All animations respect `prefers-reduced-motion`.
8. [ ] Screen-reader test passes for top-5 user flows (login, list servers,
       create server, edit config, view logs).
