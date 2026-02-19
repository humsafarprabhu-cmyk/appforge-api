# AppForge Template Engine v2 — Dual Output Architecture

## The Reality
HTML preview is just the showroom. The REAL product is:
1. React Native Expo source code (downloadable project)
2. APK (built via EAS Build)
3. Live hosted app (Expo Web / PWA)

## Dual Output from Single Definition

```
Component Definition (JSON)
    ├── HTML Renderer → iframe preview (instant, in Studio)
    └── RN Renderer → Expo project (export/build)
```

### Component Definition Format
Each component is defined as a **structured JSON spec** — NOT raw HTML or raw JSX.
Both renderers read the same spec and output their respective format.

```json
{
  "id": "stats-ring",
  "type": "stats-ring",
  "props": {
    "ringPercent": 70,
    "ringLabel": "daily goal",
    "metrics": [
      { "label": "Calories", "value": "1,840", "target": "2,200", "color": "accent1" },
      { "label": "Steps", "value": "7,432", "target": "10,000", "color": "primary" },
      { "label": "Active min", "value": "42", "target": "60", "color": "accent2" }
    ]
  }
}
```

### HTML Renderer (already built)
- Reads component spec → injects into HTML template with {{tokens}}
- Output: self-contained HTML file per screen
- Used for: Studio preview iframe

### React Native Renderer (to build)
- Reads component spec → generates React Native component code
- Output: Expo project structure:

```
my-app/
├── app.json
├── package.json
├── App.tsx                    # Navigation setup
├── src/
│   ├── theme.ts               # Design tokens (colors, spacing, fonts)
│   ├── components/
│   │   ├── GlassCard.tsx       # Reusable glass morphism card
│   │   ├── StatRing.tsx        # Progress ring
│   │   ├── StatCards.tsx       # 3-col stat cards
│   │   ├── BarChart.tsx        # Weekly bar chart
│   │   ├── DonutChart.tsx      # Donut/pie chart
│   │   ├── ListItem.tsx        # Icon + title + subtitle row
│   │   ├── HorizontalCards.tsx # Horizontal scroll cards
│   │   ├── HeroHeader.tsx      # Gradient hero header
│   │   ├── GlassInput.tsx      # Glass morphism input
│   │   ├── ProfileHeader.tsx   # Avatar + stats
│   │   ├── SettingsRow.tsx     # Settings row with toggle
│   │   └── BottomNav.tsx       # Tab navigation
│   ├── screens/
│   │   ├── DashboardScreen.tsx # Composed from components
│   │   ├── ListScreen.tsx
│   │   ├── DetailScreen.tsx
│   │   ├── FormScreen.tsx
│   │   └── ProfileScreen.tsx
│   └── data/
│       └── sampleData.ts      # Hardcoded sample data
├── assets/
│   └── icon.png
└── eas.json                   # EAS Build config
```

## React Native Component Library (matches HTML 1:1)

### Base Components (reusable primitives)
| Component | RN Implementation |
|---|---|
| GlassCard | View + LinearGradient border + BlurView |
| StatusBar | expo-status-bar (native, no custom needed) |
| BottomNav | @react-navigation/bottom-tabs |
| GlassInput | TextInput + styled container |
| GradientButton | LinearGradient + Pressable |
| IconCircle | View + LinearGradient + SVG icon |

### Screen Components (composed from primitives)
| Screen Type | Components Used |
|---|---|
| Dashboard A | GreetingHeader, StatRing, BarChart, ListItems, BottomNav |
| Dashboard B | HeroHeader, StatCards, DonutChart, HorizontalCards, BottomNav |
| Dashboard C | SearchHeader, StatPills, ProgressBars, ListItems, BottomNav |
| List | SearchHeader, FilterChips, ListItems, BottomNav |
| Detail | HeroHeader, StatCards, Description, ActionButton, BottomNav |
| Form | GreetingHeader, GlassInputs, TagSelector, Toggle, SubmitButton, BottomNav |
| Profile | AvatarHeader, StatCards, SettingsRows, LogoutButton, BottomNav |

## RN Dependencies (minimal, well-tested)
```json
{
  "expo": "~52.0.0",
  "react-native": "0.76.x",
  "@react-navigation/native": "^7.x",
  "@react-navigation/bottom-tabs": "^7.x",
  "expo-linear-gradient": "~14.0.0",
  "expo-blur": "~14.0.0",
  "react-native-svg": "~15.x",
  "react-native-safe-area-context": "~5.x",
  "react-native-screens": "~4.x",
  "@expo/vector-icons": "^14.x"
}
```

## Build Pipeline
1. User finishes app in Studio → clicks "Export" or "Build APK"
2. Server assembles Expo project from component specs
3. For ZIP: download project directly
4. For APK: push to EAS Build (needs Expo account + EAS CLI on server)
5. For Live: deploy as Expo Web (PWA) to our hosting

## Implementation Order
Phase 1 (NOW): HTML templates + assembly engine → Preview works ✅
Phase 2 (NEXT): React Native component files → Export as ZIP works
Phase 3 (AFTER): EAS Build integration → APK download works
Phase 4 (LATER): Live hosting → Expo Web deployment

## Cost Model
- HTML preview: GPT-4o fills templates → ~$0.001/app
- RN export: GPT-4o fills RN templates → ~$0.002/app (slightly more tokens)
- APK build: EAS Build free tier (30 builds/month) or $99/month (unlimited)
- Total: ~$0.003/app + build costs

## Key Decision: Pre-built RN Components
The React Native components are PRE-WRITTEN, TESTED, and BEAUTIFUL.
GPT-4o only fills in: data, colors, screen names, navigation labels.
It does NOT write React Native code from scratch.
This guarantees:
- No build errors (components are pre-tested)
- Consistent quality (Opus-designed, not GPT-generated)
- Fast assembly (~2 seconds, not ~3 minutes)
- Reliable APK builds (no random code issues)
