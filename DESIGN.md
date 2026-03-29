# Design System — Hospital Simulator

## Product Context
- **What this is:** An interactive hospital economics simulator for facilitated team education sessions (45-75 min)
- **Who it's for:** Cross-functional product team (8 in-person + 4 on Zoom) building AI clinical documentation tools
- **Space/industry:** Healthcare technology education, simulation games
- **Project type:** Facilitated game displayed on 80-inch TV in a meeting room (also screen-shared via Zoom)
- **Display context:** 80" TV at ~6-10 feet viewing distance, plus Zoom screen share at laptop resolution

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian meets Medical Command Center
- **Decoration level:** Intentional — subtle texture on surfaces (equipment bezel borders on panels), no decorative elements. Every visual element communicates state.
- **Mood:** Hospital operations war room. Dense but readable. Data lives in the world, not in side panels. The SVG hospital schematic IS the interface. Think Frostpunk's furnace gauge meets a real hospital's central monitoring station.
- **Anti-patterns:** No generic SaaS dashboard aesthetic. No cute/claymation game aesthetic (we're not Two Point Hospital). No floating HUD numbers disconnected from the world. No decorative blobs, gradients, or purple accents.
- **Research basis:** Informed by Will Wright's simulation UI principles ("if meaning can be assigned to something, it should be"), Frostpunk's diegetic UI, Factorio's ambient state indicators, and Project Hospital's interactive infographic approach.

## Typography
- **Display/Hero:** Space Grotesk 700 — geometric, slightly techy, feels like a command center readout. Used for quarter headers, hospital name, big metric numbers, dramatic reveals.
- **Body:** Plus Jakarta Sans 400/500/600 — warm geometric sans, readable at TV distance, professional but not sterile. Used for narrative text, labels, discussion prompts.
- **Data/Financial:** Geist Mono 400/600 — excellent tabular-nums, makes financial figures and case counts scannable. Used for dollar amounts, percentages, occupancy rates, all numerical data.
- **Loading:** Google Fonts CDN
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  ```
- **Scale:**
  - 64px — dramatic reveal numbers (Q4 margin), Space Grotesk 700
  - 48px — hero metrics (margin in financial panel), Space Grotesk 700
  - 32px — section headings, quarter badge, Space Grotesk 700
  - 24px — sub-headings, event titles, Space Grotesk 700
  - 18px — body text (TV viewing), narrative paragraphs, Plus Jakarta Sans 400
  - 16px — body text (Zoom viewing), panel labels, Plus Jakarta Sans 400
  - 14px — secondary text, control labels, Plus Jakarta Sans 400
  - 13px — panel titles (uppercase), sub-options, Plus Jakarta Sans 500
  - 12px — metadata, timestamps, Geist Mono 400
  - 11px — schematic labels, badge tags, Space Grotesk 600

## Color
- **Approach:** Restrained with semantic accents — dark background reduces TV glare, teal medical accent pops on navy, traffic-light semantics for instant comprehension.
- **Background:** #0F172A (slate-950, deep navy) — main page background
- **Surface:** #1E293B (slate-800) — panel backgrounds, cards, schematic ward fills
- **Surface elevated:** #334155 (slate-700) — controls, interactive elements, hover states
- **Border:** #475569 (slate-600) — panel borders, ward outlines, dividers
- **Primary:** #2DD4BF (teal-400) — medical accent, active states, primary actions, discharge coordination indicator
- **Primary muted:** #0D9488 (teal-600) — secondary actions, toggle-on state, active borders
- **Text primary:** #F1F5F9 (slate-100) — headings, body text, values
- **Text muted:** #94A3B8 (slate-400) — labels, secondary info, descriptions
- **Healthy:** #34D399 (emerald-400) — good operational state, low occupancy, positive quality, staffing OK
- **Warning:** #FBBF24 (amber-400) — moderate concern, margin 0-5%, quality 50-69, mid occupancy
- **Crisis:** #FB7185 (rose-400) — danger state, negative margin, high occupancy, poor quality, readmissions
- **Financial positive:** #38BDF8 (sky-400) — revenue figures, cash reserves above target
- **Financial negative:** #FB7185 (rose-400) — same as crisis, losses and cost overruns
- **Semantic backgrounds** (use with ~12% opacity over surface):
  - Healthy bg: #064E3B20
  - Warning bg: #78350F20
  - Crisis bg: #9F122320
  - Info bg: #0C4A6E20
- **Dark mode:** This IS dark mode. No light mode needed. TV display context mandates dark.

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable — readable from 8 feet on TV, scannable on Zoom
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)
- **Panel padding:** 24px (lg)
- **Card gap:** 16px (md)
- **Header bar height:** 64px
- **Control spacing:** 14px between control groups
- **Section title margin-bottom:** 16px

## Layout
- **Approach:** Hybrid — spatial layout for hospital schematic, disciplined grid for console and financial panels
- **Decision Phase (three zones):**
  - Top ~45%: Hospital schematic (full width, the star)
  - Bottom-left 50%: Operations console (sliders, toggles, controls)
  - Bottom-right 50%: Financial summary (P&L, margin, cash, payers)
- **Results Phase:**
  - Top ~50%: Hospital schematic (animating state changes)
  - Bottom ~50%: Narrative + event card + discussion prompt (max-width 900px for readability)
- **Max content width:** Full viewport width (no max-width constraint, this fills the TV)
- **Border radius:**
  - sm: 4px (controls, small elements)
  - md: 6px (buttons, alerts)
  - lg: 8px (cards, panels, ward rectangles)
  - xl: 12px (main container, mockup frame)
  - full: 9999px (badges, pills, toggle dots)
- **Panel borders:** 1px solid var(--border), styled as equipment bezels (subtle inset shadow optional)

## Hospital Schematic Design
- **Rendering:** Pure SVG via React component `<HospitalSchematic state={hospitalState} />`
- **Layout:** Overhead floor plan, not architecturally accurate but recognizable. Left-to-right flow: ED (entry) → Bed Wings (care) → Discharge (exit). Side panel for hospital-wide indicators (staffing, quality, DRG accuracy).
- **Ward indicators:** Each ward shows name (Space Grotesk 14px), bed count (Geist Mono 12px), and occupancy % (Geist Mono 20px bold). Ward background uses semantic color at ~10% opacity over surface.
- **OR indicators:** Small circles, green = active, gray = idle. Count shown below (e.g., "3/4 active").
- **Patient flow visualization:** Animated particle streams between areas. Small dots (4px circles) flow along curved SVG paths between connected areas. Dot density = flow volume. Teal dots for normal patient flow (ED → beds → discharge). Rose dots for readmissions (discharge → ED, along bottom edge). CSS keyframe animations on SVG `<circle>` elements following `<path>` definitions via `offset-path`. Subtle, alive, educational.
- **Hospital-wide indicators:** Standalone badges in right column: Staffing ratio, Quality score, DRG Accuracy. Same card treatment as wards.

## Motion
- **Approach:** Intentional — motion communicates state changes, not decoration
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:**
  - micro: 50-100ms (toggle states, hover)
  - short: 150-250ms (button press, slider feedback)
  - medium: 300ms (SVG fill transitions, ward occupancy changes, quality badge color)
  - long: 2000ms (quarter results choreography — schematic animates from old state to new)
  - dramatic: 3000ms (Q4 final reveal — margin number counting to final value)
- **Particle animation:** CSS `@keyframes` on SVG circles using `offset-path` and `offset-distance`. Loop duration ~4s for normal flow, ~6s for readmission loop. Stagger start times for organic feel.
- **Console controls:** Instant feedback, no animation delay on sliders/toggles
- **Accessibility:** `reducedMotion` toggle in header. Respects `prefers-reduced-motion` media query. When active, all CSS transitions set to 0ms, particles hidden, state changes are instant.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-29 | Dark theme only, no light mode | TV display in meeting room, reduces glare, better contrast for data |
| 2026-03-29 | Space Grotesk for display | Command center feel, differentiates from EMR aesthetic team sees daily |
| 2026-03-29 | Teal as primary accent | Medical association, reads well on dark navy, distinctive |
| 2026-03-29 | Traffic-light semantics | Universal comprehension, zero learning curve for operational status |
| 2026-03-29 | Schematic IS the dashboard | Will Wright principle: world surface as primary display, not side panels |
| 2026-03-29 | Animated particle streams for patient flow | Chose over arrows (crude) and spatial-only (too static). Particles make the hospital feel alive. CSS-only implementation. |
| 2026-03-29 | Medical command center, not game aesthetic | Team takes it seriously as learning tool. Hospital domain expertise feels respected. |
