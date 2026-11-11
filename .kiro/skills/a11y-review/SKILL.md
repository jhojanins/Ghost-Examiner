---
name: a11y-review
description: Audit a Ghost Examiner UI change against WCAG 2.2 AA and the project's accessibility rules (contrast, keyboard access, focus order, captions, reduced motion, no flashing, two input methods, confirmation step) and report concrete fixes. Use when building, reviewing or finishing any UI component, screen, style, animation or copy change, or when asked for an accessibility check.
metadata:
  project: ghost-examiner
---

# Accessibility review

## Procedure
1. List the changed screens and components.
2. Run the automated check (see `testing-strategy`): axe with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`, in EN and ES, with `reducedMotion` set to `reduce` and `no-preference`. Zero violations is the bar.
3. Do the manual pass with Playwright MCP, keyboard only (Tab, Shift+Tab, Enter, Space, Esc). Use `browser_snapshot` (accessibility tree) first; take screenshots only to judge visuals.
4. Report findings in the format below. Any blocker keeps the task open.

## Checklist (WCAG 2.2 success criteria)
- **1.4.3 Contrast**: all text >= 4.5:1, including large text and captions over the ghost scene (project rule is stricter than WCAG). **1.4.11**: focus rings, input borders and ghost parts that convey state >= 3:1.
- **1.4.1 Use of color**: Morse dot/dash, active caption word and recording state are not shown by color alone.
- **1.4.4 / 1.4.10 / 1.4.12**: works at 200% text, at 320 px width, and with increased text spacing.
- **2.1.1 / 2.1.2**: every action works by keyboard; no keyboard trap (camera tile, dialogs, Morse pad).
- **2.4.3 / 2.4.7 / 2.4.11**: logical focus order, visible focus, and the focused element is never hidden by captions, the camera tile or sticky bars.
- **2.5.8 Target size**: targets >= 24x24 CSS px; the Morse tap pad is much larger.
- **2.2.1 Timing**: no answer time limits; Morse and silence thresholds adjustable.
- **2.2.2 Pause, stop, hide**: the ghost's idle motion runs longer than 5 s, so a visible motion toggle must exist.
- **2.3.1 Flashes**: no flashing at all. **Reduced motion**: non-essential motion off under `prefers-reduced-motion` and via the in-app toggle.
- **Captions**: every ghost line has live captions and stays in the transcript; the app works muted.
- **4.1.2 Name, role, value**: native `<button>`, `<a>`, `<input>` first; toggles expose `aria-pressed`; the ghost SVG has `role="img"` and a localized label.
- **4.1.3 Status messages**: confirmation prompts, fallback-to-demo notices and errors use `aria-live="polite"`; announce whole lines, not every word.
- **3.1.1 / 3.1.2 Language**: `<html lang>` updates on ES/EN switch; mixed-language text has `lang`.
- **3.3.1 / 3.3.2**: inputs have labels; errors say what happened and how to fix it.
- **3.3.8 Accessible authentication**: the bring-your-own-key field allows paste.
- **3.2.6 Consistent help**: help and privacy links sit in the same place on every screen.

## Project rules to verify
- Each question offers >= 2 input methods, keyboard always among them.
- The interpreted answer is shown and confirmed before evaluation (confirm, edit, retry).
- Camera is off by default, has a visible on-indicator and one-click off. Sign input is labeled "Experimental".
- The privacy notice appears before first use and before uploads.

## Implementation pitfalls to flag
- `outline: none` without a `:focus-visible` replacement; `transition: all`.
- `<div>` or `<span>` with click handlers instead of `<button>`.
- Disabled zoom (`user-scalable=no`, `maximum-scale=1`); blocked paste.
- SVG transforms not on a `<g>` with `transform-box: fill-box`.
- Brand names without `translate="no"`; hardcoded date or number formats instead of `Intl.*`.

## Report format
| SC / rule | Where (file:line or screen) | Severity (blocker, major, minor) | Fix |
|---|---|---|---|

End with: axe result per screen and locale, and what was verified manually.
