# AppForge Template Engine — Component Architecture

## The Insight

A "Dashboard" in fitness, finance, and food apps all share the SAME structural components:
- Header with greeting
- Stats row (3-4 metrics)
- Chart section
- Item list
- Bottom nav

The ONLY difference is: **data, colors, and icons.**

So we don't pre-generate 150 screens. We pre-generate **~25 high-quality COMPONENTS** 
and an **assembly engine** that combines them.

This gives us INFINITE unique apps from a finite set of building blocks.

---

## 5-Layer Architecture

### Layer 1: Design Tokens (JSON) — FREE to create
```json
{
  "fitness-a": {
    "primary": ["#6366f1", "#8b5cf6"],
    "accent1": ["#10b981", "#34d399"],
    "accent2": ["#f59e0b", "#fbbf24"],
    "accent3": ["#f43f5e", "#fb7185"],
    "surface": "rgba(255,255,255,0.04)",
    "border": "rgba(255,255,255,0.06)"
  },
  "finance-a": {
    "primary": ["#3b82f6", "#60a5fa"],
    "accent1": ["#10b981", "#34d399"],
    "accent2": ["#f43f5e", "#fb7185"],
    "accent3": ["#f59e0b", "#fbbf24"],
    "surface": "rgba(255,255,255,0.04)",
    "border": "rgba(255,255,255,0.06)"
  }
}
```

### Layer 2: Component Library (~25 components) — Opus generates ONCE
Each component is a self-contained HTML block with {{TOKEN}} placeholders.

**Header Components (3 variants):**
- `header-greeting` — "Good morning, {{userName}}" + avatar
- `header-search` — Search bar + filter chips
- `header-hero` — Full-width gradient hero with title

**Stats Components (4 variants):**
- `stats-ring` — Progress ring + 3 metric rows
- `stats-cards-3` — 3 icon+number cards in a row
- `stats-pills` — Horizontal scroll metric pills
- `stats-hero-number` — Single big number + sparkline

**Chart Components (4 variants):**
- `chart-bar-weekly` — 7-day bar chart
- `chart-donut` — Donut/pie with legend
- `chart-line` — Line chart with gradient fill
- `chart-progress-bars` — Stacked category progress bars

**List Components (4 variants):**
- `list-icon-rows` — Icon + title + subtitle + right meta
- `list-cards-stacked` — Full-width glass cards
- `list-horizontal-scroll` — Horizontal card carousel
- `list-compact` — Dense rows with progress indicators

**Detail Components (3 variants):**
- `detail-hero-header` — Gradient hero + title + stats
- `detail-card-info` — Info cards + description + action buttons
- `detail-timeline` — Vertical timeline with steps

**Form Components (3 variants):**
- `form-glass-inputs` — Labeled glass inputs + gradient submit
- `form-stepped` — Multi-step form with progress indicator
- `form-toggle-list` — Settings-style toggle list

**Profile Components (2 variants):**
- `profile-avatar-stats` — Avatar + name + stat row + settings list
- `profile-minimal` — Clean list with toggles + logout

**Nav Components (2 variants):**
- `nav-bottom-5` — 5 icon tabs, active state colored
- `nav-bottom-fab` — 4 tabs + floating center action button

**Utility:**
- `status-bar` — iOS-style 9:41 + signal/wifi/battery
- `base-wrapper` — HTML head + Tailwind + Inter + dark theme + animations

### Layer 3: Screen Blueprints (JSON) — defines component combos
```json
{
  "dashboard-type-a": ["status-bar", "header-greeting", "stats-ring", "chart-bar-weekly", "list-icon-rows", "nav-bottom-fab"],
  "dashboard-type-b": ["status-bar", "header-hero", "stats-cards-3", "chart-donut", "list-horizontal-scroll", "nav-bottom-5"],
  "dashboard-type-c": ["status-bar", "header-search", "stats-pills", "chart-line", "list-cards-stacked", "nav-bottom-5"],
  "list-type-a": ["status-bar", "header-search", "list-icon-rows", "nav-bottom-5"],
  "list-type-b": ["status-bar", "header-greeting", "list-cards-stacked", "nav-bottom-fab"],
  "detail-type-a": ["status-bar", "detail-hero-header", "list-icon-rows", "nav-bottom-5"],
  "form-type-a": ["status-bar", "header-greeting", "form-glass-inputs", "nav-bottom-5"],
  "profile-type-a": ["status-bar", "profile-avatar-stats", "nav-bottom-5"]
}
```

### Layer 4: Category Data (JSON) — sample content per domain
```json
{
  "fitness": {
    "greeting": "Good morning",
    "metrics": [
      {"label": "Steps", "value": "7,432", "target": "10,000", "icon": "footprints"},
      {"label": "Calories", "value": "1,840", "target": "2,200", "icon": "flame"},
      {"label": "Active min", "value": "42", "target": "60", "icon": "clock"}
    ],
    "items": [
      {"title": "Morning Run", "subtitle": "6:30 AM · 5.2 km · 32 min", "badge": "+320 cal"},
      {"title": "Upper Body Weights", "subtitle": "12:15 PM · 8 exercises · 45 min", "badge": "+410 cal"},
      {"title": "Evening Yoga", "subtitle": "6:00 PM · Flexibility · 25 min", "badge": "Scheduled"}
    ],
    "chartData": [35, 55, 80, 65, 95, 70, 20],
    "navItems": ["Dashboard", "Workouts", "Add", "Progress", "Profile"]
  },
  "finance": {
    "greeting": "Welcome back",
    "metrics": [
      {"label": "Balance", "value": "$12,840", "icon": "wallet"},
      {"label": "Income", "value": "$4,200", "icon": "arrow-up"},
      {"label": "Expenses", "value": "$2,180", "icon": "arrow-down"}
    ],
    ...
  }
}
```

### Layer 5: Assembly Engine (GPT-4o — CHEAP)
Input: User prompt + matched category + selected blueprint + design tokens + data
Output: Final HTML with all placeholders filled

GPT-4o prompt:
"Given these components, tokens, and data, assemble a complete HTML screen. 
Replace all {{tokens}}. Adapt sample data to match the user's specific app idea.
Do NOT modify component structure, CSS, or animations."

---

## Why This Is 100x Smarter

| Approach | Opus calls | Unique combos | Cost |
|---|---|---|---|
| Brute force (150 screens) | 150 | 150 | $$$$ |
| Component library (25 parts) | 25 | 10,000+ | $ |

- 25 Opus generations vs 150
- 10 categories × 3 color palettes × 8 blueprint combos × ∞ data = functionally INFINITE unique apps
- Two "fitness" apps: different blueprint + different colors + different data = look completely different
- Adding new category = just new Layer 4 JSON data. ZERO new Opus calls
- GPT-4o does string replacement, not creative design = reliable, cheap, fast

## Execution Order
1. Generate Layer 2 components (I do this now — ~25 Opus-quality HTML blocks)
2. Build Layer 1 tokens + Layer 4 data (just JSON writing)
3. Define Layer 3 blueprints (just JSON)
4. Build Layer 5 assembler (modify server.ts)
5. Test: user prompt → category match → blueprint select → assemble → serve
