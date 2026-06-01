---
name: DIFARYX
description: Bounded scientific workflow and evidence orchestration platform.
colors:
  primary: "#2563eb"
  navy: "#0B1120"
  navy-light: "#1e293b"
  background: "#ffffff"
  surface: "#f8fafc"
  surface-hover: "#f1f5f9"
  border: "#e2e8f0"
  text-main: "#0B1120"
  text-muted: "#64748b"
  text-dim: "#94a3b8"
  accent: "#2563eb"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "rgba(37, 99, 235, 0.9)"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-hover}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: DIFARYX

## 1. Overview

**Creative North Star: "The Rigorous Journal"**

The DIFARYX interface is built on the metaphor of a rigorous scientific journal or lab notebook. It emphasizes high information density, strict layout alignment, clear type contrast, and crisp borders. We reject purely decorative or overstimulating components in favor of functional layout clarity. The goal is to establish trust through transparent, traceable data presentation rather than relying on standard commercial SaaS visual noise.

Key Characteristics:
- Strict layout alignment with high information density
- High typographic contrast with clean, sans-serif styling
- Crisp, explicit borders and structured, flat panel sections
- Action-oriented micro-animations that respond only to user intent

## 2. Colors

The palette is anchored by a high-contrast pairing of Deep Rigor Navy and Precision Scientific Blue, supported by clean neutral slates.

### Primary
- **Precision Scientific Blue** (#2563eb): Used exclusively for active highlights, focus rings, primary action buttons, and active tabs.

### Neutral
- **Deep Rigor Navy** (#0B1120): Used for body text, primary headings, and deep structural surfaces (such as navigation).
- **Deep Slate/Charcoal** (#1e293b): Used for secondary headers and dark-mode component backgrounds.
- **Neutral Slate** (#64748b): Used for secondary/muted labels and metadata text.
- **Neutral Silver** (#94a3b8): Used for borders, disabled states, and very quiet dividers.
- **Clean Laboratory White** (#ffffff): Root page background.
- **Surface Gray** (#f8fafc): Background color for cards, panels, and data regions.

**The Ten Percent Accent Rule.** Precision Scientific Blue is restricted to ≤10% of any given screen area. Its sparseness is what creates functional focus.

## 3. Typography

**Display Font:** Inter, system-ui, sans-serif
**Body Font:** Inter, system-ui, sans-serif
**Label/Mono Font:** Inter, monospace (if distinct)

The typographic hierarchy relies on a strict scale ratio to clearly separate metadata, body text, structural titles, and display headers.

### Hierarchy
- **Display** (700, clamp(2.5rem, 6vw, 4.5rem), 1.1): Used for large hero text or landing page entry points.
- **Headline** (600, 2rem, 1.2): Used for primary page titles or section headers.
- **Title** (600, 1.25rem, 1.25): Used for card titles and sub-sections.
- **Body** (400, 1rem, 1.5): Used for general reading, discussions, and details. Capped at 75ch.
- **Label** (500, 0.875rem, 1.25): Used for buttons, badge labels, metadata, and form titles.

**The Reading Comfort Rule.** Body copy must always respect line-height limits (1.5) and contain between 65 and 75 characters per line to ensure scan readability.

## 4. Elevation

The elevation philosophy is flat by default. Surfaces do not use soft, wide drop shadows. We convey structural separation and depth strictly through tonal layering and crisp borders.

**The Crisp Outline Rule.** Visual grouping is established via 1px solid borders (`#e2e8f0`) rather than large drop shadows. Shadows are reserved exclusively for temporary floating elements (like dropdown menus, popovers, or dialogs) and must remain sharp and dark.

## 5. Components

### Buttons
- **Shape:** Softly-squared corners with 6px radius (`rounded-md`).
- **Primary:** Precision Scientific Blue background, white text. Transitions smoothly to `rgba(37, 99, 235, 0.9)` on hover.
- **Outline:** Transparent background with 1px border (`#e2e8f0`). Text uses Deep Rigor Navy, transitioning to Surface Gray on hover.

### Cards / Containers
- **Corner Style:** 12px corner radius (`rounded-xl`).
- **Background:** Surface Gray (`#f8fafc`) with a 1px border (`#e2e8f0`).
- **Shadow Strategy:** Flat by default, no ambient drop shadows.

### Inputs / Fields
- **Style:** 1px border (`#e2e8f0`), Surface Gray background, 6px radius (`rounded-md`).
- **Focus:** Highlighted with a 2px Precision Scientific Blue ring.

## 6. Do's and Don'ts

### Do:
- **Do** rely on tonal layering (e.g. `bg-surface` vs `bg-background`) to define screen zones.
- **Do** keep text contrast above 4.5:1, including placeholder and muted info text.
- **Do** check that scientific charts are readable under varying light and color-blind conditions.

### Don't:
- **Don't** use side-stripe borders (e.g., `border-left` or `border-right` stripes) as a styling accent on cards or banners.
- **Don't** use gradient text or background-clip text gradients.
- **Don't** use glassmorphism blurs decoratively.
- **Don't** pair 1px borders with soft wide shadows (ghost cards) on static elements.
- **Don't** use border-radius greater than 12px for structural containers or cards.
- **Don't** use tiny tracked uppercase eyebrows on every section header.
