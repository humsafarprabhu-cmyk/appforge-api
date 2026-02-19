# AppForge Template System

## Architecture
- 10 categories × 3 variants × 5 screens = 150 pre-generated screens
- Each variant has unique: layout, color palette, component types, nav style
- GPT-4o personalizes (cheap) → Opus quality at 1/100th cost

## Category → Variant Design Matrix

### Fitness
- **A (Indigo/Purple):** Progress ring dashboard, vertical workout list, bar chart stats, glass cards
- **B (Emerald/Teal):** Horizontal scroll cards, donut chart, timeline view, rounded pills
- **C (Orange/Warm):** Hero banner dashboard, grid workout tiles, line chart, neumorphic cards

### Finance
- **A (Blue/Cyan):** Balance card + transaction list, pie chart breakdown, clean minimal
- **B (Green/Emerald):** Multi-account cards, bar chart budget, detailed rows
- **C (Purple/Gold):** Gradient balance hero, spending donut, category grid

### Food/Recipe
- **A (Orange/Red):** Recipe card grid, ingredient checklist, step-by-step cooking view
- **B (Green/Fresh):** Meal planner calendar, macro nutrients ring, horizontal recipe scroll
- **C (Warm/Brown):** Full-image recipe hero, pantry list, cooking timer UI

### Productivity
- **A (Indigo):** Kanban-style tasks, progress bars, clean checklist
- **B (Teal):** Calendar-first layout, habit streak grid, time blocks
- **C (Rose/Pink):** Note cards layout, priority matrix, tag-based organization

### Social
- **A (Blue):** Feed-first (Instagram-like), story bubbles, chat list
- **B (Purple):** Grid gallery, profile-focused, activity timeline
- **C (Green):** Chat-first (WhatsApp-like), status dots, group cards

### Education
- **A (Blue):** Course cards, progress bar per course, video player layout
- **B (Purple):** Flashcard stack, streak counter, quiz UI
- **C (Teal):** Learning path timeline, badge collection, leaderboard

### E-commerce
- **A (Indigo):** Product grid, cart drawer, order cards
- **B (Rose):** Product carousel, wishlist hearts, promo banners
- **C (Orange):** Category tiles, deal countdown, review cards

### Travel
- **A (Blue/Sky):** Trip cards with images, map placeholder, itinerary timeline
- **B (Teal):** Booking cards, flight info layout, packing checklist
- **C (Sunset):** Destination hero images, explore grid, travel diary

### Music
- **A (Purple/Dark):** Now playing full-screen, playlist list, waveform visualizer
- **B (Rose/Neon):** Album grid, queue list, EQ bars
- **C (Blue/Minimal):** Compact player, artist cards, genre chips

### Lifestyle (Pet/Wellness)
- **A (Green):** Pet profile card, feeding schedule, vet visits timeline
- **B (Purple):** Wellness dashboard, mood tracker, meditation timer
- **C (Orange):** Daily routine list, water intake ring, sleep chart

## Screen Types per Variant (5 each)
1. Dashboard/Home
2. List/Browse 
3. Detail/Single Item
4. Create/Form
5. Profile/Settings

## Personalization Layer (GPT-4o handles)
Given a template + user prompt, GPT-4o modifies:
- App name, page titles
- All hardcoded text/labels
- Sample data (names, numbers, dates)
- Color values (swap palette)
- Icon choices (swap SVG paths)
- Number of list items
- Feature-specific content

GPT-4o does NOT:
- Change layout structure
- Rewrite CSS/styling
- Add new components
- Modify animations
