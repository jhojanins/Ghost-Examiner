---
name: ghost-svg-animation
description: "Build or change the Ghost avatar in Ghost Examiner: SVG structure, expressions, the requestAnimationFrame loop, the text-driven lip-sync speech timeline (visemes), captions synced to that timeline, reduced motion and muted mode. Use when working on the Ghost React component in packages/ui, ghost state or speech timeline code in packages/core, captions, or ghost visuals."
metadata:
  project: ghost-examiner
---

# Ghost SVG animation, lip-sync and captions

> **Version note:** this skill describes the later, full version. Spec (a) phase 1 follows its design instead: `buildTimeline(text, locale)` returns the design's `Timeline` (`words`, `mouth`, `duration`; no `rate`), with 4 visemes (`rest`, `A`, `O`, `MBP`) and 4 expressions, and no float.

## Data flow
`ghostPose(state, now, { reducedMotion })` (pure, packages/core) → `GhostPose` → `<Ghost>` (packages/ui) writes it to the SVG.
`buildTimeline(text, locale, rate)` (pure, packages/core) → `SpeechCue[]` → read by both the mouth and the captions. One timeline, two views.

## SVG structure
- Fixed `viewBox`; groups with stable ids: `ghost-body`, `brows`, `eye-left`, `eye-right`, `pupils`, `glasses`, `mouth`, `bowtie`, `clipboard`, `hands`.
- Mouth: one pre-drawn path per viseme (`rest, A, E, O, U, MBP, FV`). Switch shapes; don't morph paths.
- Round coordinates to 1 decimal. No per-frame filters or large blurs.
- Original art only; visibly different from Kiro's ghost mascot.

## Animation rules
- Animate only `transform` and `opacity`. Put transforms on `<g>` with `transform-box: fill-box; transform-origin: center`.
- Whole-body float: animate a wrapper `<div>`, not the `<svg>` element.
- One `requestAnimationFrame` loop per ghost. Write pose changes through refs (`setAttribute`, `style`), not React state, so React doesn't re-render 60 times a second.
- Blink every 3 to 6 s for ~120 ms, from a seeded RNG so tests are deterministic.
- Expressions map to brow angle, eye shape and mouth bias; transitions 150 to 300 ms.
- Reduced motion (media query or in-app toggle): `float = 0`, no blinking, sway or idle drift, no transitions longer than 150 ms. Keep expression and mouth changes (they carry meaning when muted).
- A visible motion toggle is required (WCAG 2.2.2) because idle motion runs longer than 5 s.
- No flashing. Glows and fades take at least 1 s and never strobe.

## Speech timeline
- Split into words; duration per word ≈ chars × base rate (EN ~65 ms/char, ES ~60 ms/char at rate 1), divided by the TTS rate. Pauses: comma 200 ms, period or question mark 400 ms.
- Visemes per letter group: `a→A`, `e,i,y→E`, `o→O`, `u,w→U`, `m,b,p→MBP`, `f,v→FV`, other consonants keep the previous open shape briefly, spaces → `rest`. Handle EN `oo`, `ee`, `th` and ES `ll`, `qu` simply.
- Re-sync: on `SpeechSynthesisUtterance` `boundary` events, map `charIndex` to the word cue and shift the clock offset. If no boundary arrives in the first 1.5 s, stay on the estimated clock. On `end`, go to `rest`.
- Muted: `SilentOutput` plays the same timeline on a clock. The session does not auto-advance in muted mode; the user continues when ready.

## Captions
- Show the full line at once; mark the current word with underline + weight, not color alone. Both states >= 4.5:1.
- Max 2 lines of ~42 characters, font >= 1.25rem, user-adjustable size. Captions never cover focused elements.
- Transcript panel keeps every line; announce each finished line once via `aria-live="polite"` (never per word).

## Tests
- `buildTimeline`: cues are sorted, non-overlapping, cover every word, end at `rest`; total duration grows with text length (good fast-check property).
- `ghostPose`: `reducedMotion` always yields `float === 0`; same inputs give the same pose.
- `<Ghost>`: given a pose, the right mouth path is visible and the label matches the expression.
- Visual check with Playwright MCP screenshots in both motion settings.
