# Brand Guidelines Changelog

This file tracks all changes to the CallVault Brand Guidelines document.

---

## v4.3 - February 28, 2026

**Time:** 22:27 UTC
**Git Commit:** (add after commit)

### Changes

#### Phase-16.1-01: v2 AppShell Pane Architecture
- Added new subsection under Layout Architecture documenting the 4-pane AppShell system
- Documents locked pane widths (P1: 72/220px, P2: 0/280px, P4: 0/320/360px)
- Documents OrgSwitcherBar shell chrome pattern (bg-viewport, no border-b)
- Documents DetailPaneOutlet width-only animation rule (no x offset)
- Documents close button flex-flow pattern (not absolute inside overflow-hidden)
- Documents border-border/60 for all pane borders (not full border-border)

#### Phase-16.1-02: Spring Animation System
- Added v2 Spring Animation System subsection to Animation Guidelines
- Documents motion/react import (not framer-motion)
- Documents locked spring config: stiffness 260, damping 28
- Documents AnimatePresence panel enter/exit pattern
- Clarifies when to use spring vs CSS transitions

#### Phase-16.1-03: Navigation Pill Height Correction
- Updated pill indicator height from h-[80%] to h-[65%] to match v2 implementation
- Added note that both heights are acceptable depending on nav item size
- Updated implementation snippet to use span with aria-hidden

#### Phase-16.1-04: Custom Button-Tab Pattern
- Added Custom Button-Based Tabs subsection to Tab Navigation
- Documents border-b-2 border-vibe-orange active indicator pattern
- Documents when to use Radix Tabs vs custom button tabs

#### Phase-16.1-05: Dialog Button Exception
- Added Dialog Action Buttons exception section to Button System
- Documents bg-brand-500/bg-brand-600 pattern accepted inside Radix Dialog
- Clarifies that bg-foreground text-background is also an accepted CTA pattern
- Defines strict scope: applies inside dialog content only

#### Version Bump
- Incremented from v4.2.1 to v4.3
- Renamed file from brand-guidelines-v4.2.md to brand-guidelines-v4.3.md
- Archived v4.2.md to docs/archive/

---

## v4.2.1 - February 10, 2026

**Time:** 16:31 UTC
**Git Commit:** (pending)

### Changes

#### US-005: Tab Indicator Direction Update
- Updated Tab Navigation guidance to document rounded pill active indicators
- Removed clip-path/angular tab assumptions from required implementation guidance

#### US-006: HUB/Pane Header Alignment Rules
- Added explicit pane-header composition rules for HUB secondary pane, middle pane, and adjacent detail panes
- Codified non-overlap requirement for header context/actions in constrained pane widths

#### US-007: Token-First Hardcoded Value Policy
- Added explicit rule to avoid hardcoded presentation values when equivalent tokens/utilities exist
- Documented allowed exceptions (semantic badges, runtime dimensions, external brand marks)

#### US-008: Patch Version Bump
- Incremented guideline version from v4.2 to v4.2.1 in all required locations
- Updated Last Updated metadata to February 10, 2026

---

## v4.2 - January 14, 2026

**Time:** 15:30 UTC
**Git Commit:** (pending)

### Changes

#### US-001: CSS Variable Reference Update
- Updated CSS Variable Reference section (Section 23) for accuracy
- Standardized variable naming conventions

#### US-002: Color System Update
- Updated Color System section (Section 3) with refined semantic colors
- Improved background hierarchy documentation

#### US-003: Component Code Examples Update
- Replaced all `cb-` and `cv-` prefixes with semantic class names throughout:
  - Button System: `border-ink`, `bg-white`, `text-ink`, `bg-hover`
  - Tab Navigation: `border-ink`, `text-ink-muted`, `text-ink`
  - Icon System: `text-ink-muted`
  - Metric Cards: `border-border`, `text-ink`, `text-ink-muted`
  - Progress Trackers: `bg-border`
  - Conversation UI: `bg-hover`, `text-ink`
  - Status Pills: `bg-success-bg`, `text-success-text`
  - Dark Mode examples: `text-ink`, `text-white`
  - Microcopy: `text-ink-soft`

#### US-004: Version Bump
- Incremented version from v4.1.3 to v4.2
- Renamed file from `brand-guidelines-v4.1.md` to `brand-guidelines-v4.2.md`
- Updated Last Updated date to January 14, 2026

---

## v4.1.3 - January 8, 2026

- Patch updates to various sections
- Minor clarifications and fixes

---

## v4.1 - January 2026

- Minor version update with multiple section improvements
- Enhanced component specifications

---

## v4.0 - December 4, 2025

### Major Changes
- Major rebrand from "CallVault" to "Call Vault"
- Color system changed from Vibe Green (#D9FC67) to Vibe Orange (#FF8800)
- Added new Vibe Orange variants: Dark (#FF3D00) and Light (#FFEB00)
- Added Brand Identity & Logo section with new logo specifications
- Updated all CSS variables from `cb-` prefix to semantic names
- Updated all component examples to use new color system
- Added gradient usage guidelines (White Hot to Lava)
- Updated microcopy examples to reflect new brand voice
