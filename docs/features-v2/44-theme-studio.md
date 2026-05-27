# Feature 44: Theme Studio

- **Feature ID:** 44
- **Status:** Planned
- **Priority:** Medium
- **Primary Service:** Management Panel
- **Effort Estimate:** Medium (4–6 PT)
- **Dependencies:** Feature 43 (WCAG contrast tokens as baseline)

---

## 1. Overview

A visual theme builder that lets users customise the look and feel of the
Management Panel without writing CSS. Users manipulate colours, fonts, border
radii, spacing, and shadows through a graphical editor, see changes in a live
preview pane, and export the result as a portable JSON theme bundle. A
community gallery allows sharing and discovering themes.

### Goals

1. Reduce styling friction for operators who want white-label or dark-mode
   dashboards.
2. Provide a single-file export/import format so themes are portable across
   environments.
3. Ship with two built-in themes: *Light* (default) and *Dark*.
4. Community gallery backed by the existing API (themes stored as JSON blobs).

---

## 2. Architecture & Component Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Theme Studio (Management Panel)              │
│                                                                     │
│  ┌──────────────────────┐      ┌────────────────────────────────┐   │
│  │  ThemeEditor          │      │  LivePreview                   │   │
│  │  ┌──────────────────┐ │      │  ┌──────────────────────────┐  │   │
│  │  │ ColourPicker     │ │      │  │ Mini dashboard mockup   │  │   │
│  │  │ FontSelector     │ │      │  │ (iframe / same-frame)    │  │   │
│  │  │ SpacingSliders   │ │      │  └──────────────────────────┘  │   │
│  │  │ BorderRadiusCtrls│ │      └────────────────────────────────┘   │
│  │  │ ShadowControls   │ │                                          │
│  │  └──────────────────┘ │                                          │
│  └──────────┬────────────┘                                          │
│             │                                                        │
│  ┌──────────▼────────────────────────────────────────────────────┐  │
│  │  ThemeEngine (core library)                                   │  │
│  │  • reads ThemeConfig (JSON schema)                            │  │
│  │  • generates CSS custom properties                            │  │
│  │  • applies to :root via style-setter                          │  │
│  │  • validates contrast ratios (reuses F43 helpers)             │  │
│  └──────────┬────────────────────────────────────────────────────┘  │
│             │                                                        │
│  ┌──────────▼────────────────────────────────────────────────────┐  │
│  │  ThemeStore (Zustand)                                        │  │
│  │  • current active theme                                      │  │
│  │  • draft (unsaved changes)                                   │  │
│  │  • gallery listing cache                                     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Backend (API gateway)                                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  GET/POST /api/v2/themes                                      │ │
│  │  GET/PUT/DELETE /api/v2/themes/:id                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Plan

### Phase 1 — Theme Engine (1–2 PT)

1. Define the **ThemeConfig** JSON schema (see §5).
2. Build the `ThemeEngine` class:
   - Accepts a `ThemeConfig` object.
   - Generates a flat map of CSS custom properties.
   - Applies properties to `document.documentElement.style`.
   - Validates colour-contrast ratios (reuse F43 helpers).
3. Write unit tests for serialisation, application, and contrast validation.

### Phase 2 — Editor UI (2 PT)

1. Build the **ThemeEditor** panel:
   - **Colour Picker** — grouped by token role (primary, surface, text, border,
     danger, success, warning).
   - **Font Selector** — system fonts + Google Fonts dropdown (optional).
   - **Spacing / Radius / Shadow sliders** — adjust base unit (4 px grid).
2. Build the **LivePreview** pane:
   - Renders a miniature dashboard (sidebar, cards, table, button, input).
   - Can be an iframe pointing at a stripped-down preview route or a
     same-frame styled wrapper.
3. Connect editor changes to `ThemeEngine` → live preview updates
   in real-time (debounced 100 ms).

### Phase 3 — Persistence & Portability (1 PT)

1. **Export** — serialize current `ThemeConfig` to JSON and trigger a file
   download (`theme-name.json`).
2. **Import** — file-upload input that validates against the JSON schema
   and applies the theme.
3. **Save to profile** — persist chosen theme per user via
   `PUT /api/v2/users/me/preferences { theme: { ... } }`.

### Phase 4 — Community Gallery (1–2 PT)

1. List endpoint `GET /api/v2/themes?page=&per_page=` — returns
   publicly shared themes.
2. Publish flow — user fills in name, description, tags; hits "Publish";
   theme is upserted to `POST /api/v2/themes`.
3. Gallery UI — grid of theme cards (thumbnail, name, author, usage count).
4. "Install" button — applies the theme locally and saves to preferences.

---

## 4. API Design

### Endpoints

| Method   | Path                            | Description                        |
|----------|---------------------------------|------------------------------------|
| `GET`    | `/api/v2/themes`                | List public themes (paginated)     |
| `POST`   | `/api/v2/themes`                | Publish a new theme                |
| `GET`    | `/api/v2/themes/:id`            | Get a single theme by ID           |
| `PUT`    | `/api/v2/themes/:id`            | Update a published theme (owner)   |
| `DELETE` | `/api/v2/themes/:id`            | Delete a theme (owner / admin)     |
| `PUT`    | `/api/v2/users/me/preferences`  | Save active theme as user pref     |

### Request / Response Example

```json
POST /api/v2/themes
{
  "name": "Midnight Ops",
  "description": "Dark theme optimized for NOC dashboards.",
  "tags": ["dark", "high-contrast", "noc"],
  "isPublic": true,
  "config": {
    "colors": {
      "primary": "#00bcd4",
      "surface": "#121212",
      "text": "#e0e0e0",
      "border": "#333333",
      "danger": "#cf6679",
      "success": "#4caf50",
      "warning": "#ff9800"
    },
    "fonts": {
      "heading": "'Inter', system-ui, sans-serif",
      "body": "'Inter', system-ui, sans-serif",
      "monospace": "'JetBrains Mono', monospace"
    },
    "radii": {
      "sm": 4,
      "md": 8,
      "lg": 12,
      "xl": 16,
      "full": 9999
    },
    "spacing": {
      "base": 4,
      "xs": 4,
      "sm": 8,
      "md": 16,
      "lg": 24,
      "xl": 32,
      "xxl": 48
    },
    "shadows": {
      "sm": "0 1px 2px rgba(0,0,0,0.3)",
      "md": "0 4px 6px rgba(0,0,0,0.4)",
      "lg": "0 10px 25px rgba(0,0,0,0.5)"
    }
  }
}

Response 201
{
  "id": "a1b2c3d4",
  "name": "Midnight Ops",
  "author": { "id": "u42", "name": "ops-admin" },
  "installCount": 0,
  "createdAt": "2026-05-27T12:00:00Z"
}
```

---

## 5. Data Model

### ThemeConfig (JSON Schema)

```typescript
interface ThemeConfig {
  colors: {
    primary: string;        // hex / hsl
    surface: string;
    text: string;
    border: string;
    danger: string;
    success: string;
    warning: string;
    // optional semantic overrides
    primaryHover?: string;
    surfaceAlt?: string;
    textMuted?: string;
  };
  fonts: {
    heading: string;        // font-family string
    body: string;
    monospace?: string;
  };
  radii: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;           // typically 9999 for pills
  };
  spacing: {
    base: number;           // grid unit in px (default 4)
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl?: number;
  };
  shadows: {
    sm: string;             // full box-shadow value
    md: string;
    lg: string;
  };
}
```

### Database (PostgreSQL)

```sql
CREATE TABLE themes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID NOT NULL REFERENCES users(id),
  name        VARCHAR(128) NOT NULL,
  description TEXT,
  tags        TEXT[],
  config      JSONB NOT NULL,
  is_public   BOOLEAN NOT NULL DEFAULT false,
  install_count INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_themes_public ON themes (is_public, install_count DESC)
  WHERE is_public = true;
```

---

## 6. Service Assignments

| Service           | Role                                                              |
|-------------------|-------------------------------------------------------------------|
| Management Panel  | ThemeEngine library, editor UI, live preview, gallery UI          |
| API Gateway       | Theme CRUD endpoints, user-preference proxy                       |
| Database          | `themes` table                                                    |
| CDN / Storage     | Optional: theme thumbnail images stored in S3-compatible bucket   |

---

## 7. Effort Estimate

| Phase                    | Person-days |
|--------------------------|-------------|
| Theme Engine + validation | 1–2        |
| Editor UI + live preview  | 2          |
| Persistence / portability | 1          |
| Community gallery         | 1–2        |
| **Total**                 | **4–6**    |

---

## 8. Acceptance Criteria

1. [ ] Users can edit every colour, font, radius, spacing, and shadow token
       via the visual editor.
2. [ ] Live preview reflects changes in ≤ 150 ms.
3. [ ] Export produces a valid `ThemeConfig` JSON file.
4. [ ] Import accepts the same JSON and applies the theme immediately.
5. [ ] Built-in Light and Dark themes are available on first load.
6. [ ] Community gallery lists public themes, supports search by tag.
7. [ ] "Install" applies the gallery theme and persists to user preferences.
8. [ ] All custom themes are validated against the contrast-ratio rules from
       Feature 43.
