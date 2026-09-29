---
name: Pastel Word Game System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#564239'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#8a7268'
  outline-variant: '#ddc1b5'
  surface-tint: '#9f4203'
  primary: '#9f4203'
  on-primary: '#ffffff'
  primary-container: '#ff8a4c'
  on-primary-container: '#6c2a00'
  inverse-primary: '#ffb693'
  secondary: '#006c4b'
  on-secondary: '#ffffff'
  secondary-container: '#64f9bc'
  on-secondary-container: '#00714e'
  tertiary: '#855300'
  on-tertiary: '#ffffff'
  tertiary-container: '#ec9700'
  on-tertiary-container: '#5a3700'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbcb'
  primary-fixed-dim: '#ffb693'
  on-primary-fixed: '#351000'
  on-primary-fixed-variant: '#7a3000'
  secondary-fixed: '#68fcbf'
  secondary-fixed-dim: '#45dfa4'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005137'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '800'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  tile-letter:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 32px
  tile-letter-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '800'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.03em
  label-keyboard:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-md: 1rem
  margin: 1rem
  margin-md: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system delivers an approachable, tactile, and universally legible interface for word puzzles and daily lingual challenges. Combining utilitarian clarity with warm, cheerful pastel accents, the aesthetic removes cognitive strain while cultivating an encouraging, delightful play space.

### Brand Personality & Tone
- **Warm & Welcoming:** Uses inviting apricot hues and soft mint/amber tones that eliminate high-pressure anxiety from competitive play.
- **Utilitarian Precision:** Leverages crisp, highly legible typography and defined grids to ensure immediate letter recognition at every screen size.
- **Playful Tactility:** Interactive tiles, keyboard inputs, and status cards employ physical press states, subtle surface lifts, and balanced rounded geometry.

### Visual Style
The system merges **Modern Tactile Minimalism** with **Playful Soft Surfaces**. Surfaces avoid heavy skeuomorphism in favor of soft ambient color fills, subtle border definitions, and gentle micro-elevations on user interaction. It ensures maximum contrast and quick scannability during fast-paced play while remaining cozy and visually restful for extended daily sessions.

## Colors

The palette establishes an encouraging, lighthearted atmosphere with functional semantic meaning tied directly to game states.

### Core Roles
- **Primary (`#FF8A4C` - Warm Apricot):** Used for primary navigation, user level badges, streak highlights, interactive highlights, and focal CTAs.
- **Secondary (`#34D399` - Pastel Mint):** Communicates the "Correct Position" state for letter tiles, win conditions, and positive achievement confirmations.
- **Tertiary (`#F59E0B` - Butter Amber):** Designates the "Present but Misplaced" state for letter tiles and warning nudges.
- **Neutral (`#64748B` - Slate Neutral):** Powers unplaced or absent letters, structural framing borders, and secondary copy.

### Mode Mapping & Semantics

#### Light Mode
- **Canvas / Background:** `#FDFBF7` (warm creamy paper tone).
- **Surface / Tile Base:** `#FFFFFF` with `#E2E8F0` resting outlines.
- **Text Primary:** `#0F172A` (deep slate for uncompromised legibility).
- **Text Secondary:** `#475569`.
- **Tile Absent / Disabled Key:** Background `#E2E8F0`, foreground `#64748B`.
- **Tile Misplaced:** Background `#FEF3C7`, border `#F59E0B`, text `#78350F`.
- **Tile Correct:** Background `#D1FAE5`, border `#10B981`, text `#064E3B`.

#### Dark Mode
- **Canvas / Background:** `#0F172A` (deep midnight slate).
- **Surface / Tile Base:** `#1E293B` with `#334155` resting outlines.
- **Text Primary:** `#F8FAFC`.
- **Text Secondary:** `#94A3B8`.
- **Tile Absent / Disabled Key:** Background `#334155`, foreground `#64748B`.
- **Tile Misplaced:** Background `#78350F`, border `#F59E0B`, text `#FEF3C7`.
- **Tile Correct:** Background `#064E3B`, border `#34D399`, text `#ECFDF5`.

## Typography

The typography relies on Inter across all hierarchy tiers. Inter provides standardized geometric letterforms, open apertures, and balanced x-heights, ensuring that critical character distinctions (such as `O` vs `D`, or `I` vs `L`) remain unambiguous at small sizes and high interaction speeds.

### Hierarchy & Application
- **Display & Headline:** Used for victory modals, high streaks, score overviews, and section titles. Features tighter letter tracking for energetic impact.
- **Tile Letter:** Specially tuned with vertical centering and high weight (`800`) to fill letter blocks symmetrically.
- **Keyboard Labels:** Compact, punchy weights (`700`) styled to fit within 32px-48px touch targets without overlapping or truncation.
- **Body & Captions:** Neutral, open tracking with generous line-heights to deliver rules, clues, and statistics comfortably.

## Layout & Spacing

The layout is built around a centralized column system tailored for game boards and on-screen keyboards, adapting predictably from compact mobile displays to wide desktop canvases.

### Layout Rhythm
- **Game Board Constraints:** The primary game matrix adheres to a strict maximum width (`480px` on mobile, `560px` on desktop) to keep tile sizes within natural focal bounds.
- **Vertical Spacing:** The distance between tile rows matches the horizontal tile gap (`0.375rem` to `0.5rem`) creating a uniform 1:1 aspect ratio grid.
- **Keyboard Placement:** Mobile keyboards dock to the bottom with safe-area insets (`env(safe-area-inset-bottom)`) and minimum `6px` gaps between individual keys to prevent accidental tap conflicts.
- **Responsive Adaptations:** 
  - *Mobile (< 640px):* Single-column central stack. Outer canvas margins are `1rem`. Gaps between board rows and keyboard elements tighten to `space-xs` and `space-sm`.
  - *Desktop (≥ 1024px):* Game board remains centered; stats, past streaks, and side navigation reflow into flanking cards using an 8-column layout with `gutter-md` (`1rem`).

## Elevation & Depth

Elevation conveys playful physicality through soft, low-contrast diffuse shadows combined with slight chromatic undertones matching the apricot and neutral color schemes.

### Surface Tiers
- **Tier 0 (Canvas):** Flat base `#FDFBF7` (Light) or `#0F172A` (Dark).
- **Tier 1 (Resting Tiles & Cards):** Raised using a 1px border (`#E2E8F0` / `#334155`) plus a subtle drop shadow: `0 2px 4px rgba(100, 116, 139, 0.06)`.
- **Tier 2 (Interactive Floating Keys & Controls):** Shadow `0 4px 10px rgba(100, 116, 139, 0.12)`, accented with a 1.5px bottom edge offset simulating a pressable tactile switch.
- **Tier 3 (Modals & Victory Sheets):** Deep, diffused ambient blur: `0 16px 32px rgba(15, 23, 42, 0.15)`.

### Pressed & Active States
When keys or buttons are pressed, the surface translates down `1px` to `2px` along the Y-axis while reducing the bottom shadow to zero, creating immediate physical feedback.

## Shapes

The shape vocabulary employs balanced, friendly rounding (`roundedness: 2`, where base components use `0.5rem` / `8px` corner radii).

### Geometry Guidelines
- **Game Tiles:** Fixed `8px` (`0.5rem`) radius. Tiles avoid complete circularity to maximize letter boundary space while softening harsh corners.
- **Interactive Pill Buttons & Badges:** Use expanded radii (`rounded-full` / `9999px`) to create an inviting, toy-like button feel for CTAs and keyboard keys.
- **Content Cards & Panels:** Standardized to `16px` (`rounded-lg` / `1rem`) corner radius with inset padding of `space-md` or `space-lg`.
- **Modals & Dialogs:** Framed in `24px` (`rounded-xl` / `1.5rem`) to feel welcoming and non-institutional.

## Components

### Game Tiles
- **Default / Empty:** 1:1 square ratio, `0.5rem` rounded corners. Light mode has white background with a 2px `#E2E8F0` border. Dark mode has `#1E293B` background with `#334155` border.
- **Populated (Unsubmitted):** Border color darkens to `#94A3B8` (Light) or `#64748B` (Dark). Subtle scaling animation (`scale(1.05)`) upon letter entry.
- **Revealed States:**
  - *Correct:* Mint background (`#D1FAE5` / `#064E3B`), solid mint border (`#10B981` / `#34D399`), deep emerald text.
  - *Misplaced:* Amber background (`#FEF3C7` / `#78350F`), solid amber border (`#F59E0B`), warm brown text.
  - *Absent:* Slate background (`#E2E8F0` / `#334155`), slate border, muted text.

### Buttons & Controls
- **Primary Pill Button:** Fully rounded (`rounded-full`), apricot background (`#FF8A4C`), white bold label, subtle warm-tinted shadow (`0 4px 12px rgba(255, 138, 76, 0.3)`). Hover slightly brightens; active press moves down 1px.
- **Secondary Pill Button:** Transparent or light cream fill with a 1.5px `#FF8A4C` border and apricot text.
- **Virtual Keyboard Keys:** Rounded rectangle (`0.5rem`), min-height 48px on mobile. Neutral key surface mirrors tile absent/present states dynamically as guesses are confirmed.

### Cards & Result Modals
- **Playful Score Cards:** Framed in `1rem` rounded corners, warm white/slate surface, elevated with Tier 1 drop shadows. High scores and win streaks are badged with pastel apricot ribbons.
- **Dialogs & Overlays:** Centered, accompanied by a soft blurred backdrop (`backdrop-filter: blur(4px)`). Header features a large, friendly display title with animated score tallies.

### Chips & Stat Badges
- **Streak & Guess Chips:** Pill-shaped capsules with `space-xs` vertical and `space-sm` horizontal padding. Tinted pastel backgrounds matching the game state (e.g., mint for 100% win rate, apricot for active streak).

### Inputs & Selection
- **Inputs:** Clean rounded fields (`0.5rem`), `#E2E8F0` resting border, shifting to `#FF8A4C` glow with `0 0 0 3px rgba(255, 138, 76, 0.2)` on focus.
- **Toggles / Switches:** Pill switch track with smooth sliding circular thumb (`#FF8A4C` active fill, `#CBD5E1` inactive).