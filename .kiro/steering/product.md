---
inclusion: always
---

# Product: Ghost Examiner

## What it is
A reusable skeleton kit (the three packages in `packages/`) for "face to face" conversations with an animated ghost examiner, plus two apps built from it (`apps/`). Built solo by a student for Kiroween 2026, category **Skeleton Crew**, also targeting the **Best Student** bonus.

## Key dates
- **Nov 15 (Day 5)**: vertical slice (marked Preview) on a public branch-deploy URL of `main`: ghost, one question, keyboard input, confirmation, demo-mode evaluation.
- **Dec 1**: feature freeze and final production deploy.
- **Dec 2**: submission. The official deadline (Dec 4) is buffer only.
- The public URL must stay live until **Jan 29, 2027**.
- Full schedule: `docs/ARCHITECTURE.md` section 6.

## The ghost
An original 2D examiner (glasses, bow tie, clipboard), calm with dry humor, never cruel. Personality, tone and phrasing: `ghost-persona` skill.

## Apps (each in its own folder, both built only from the kit)
- `apps/ghost-interview`: accessible job-interview practice. The ghost asks interview questions, listens, follows up, and gives constructive feedback.
- `apps/ghost-defense`: defense of a thesis, project or AI-assisted work. The user uploads a document; the ghost asks questions about it to check the user really understands it.

## Input methods
Voice, keyboard and Morse code (tap). A personalized small-vocabulary sign input is an optional stretch goal.

## Hard product rules
- The app is bilingual (ES/EN): UI, ghost speech and captions. The user picks the language; default follows the browser. Spanish uses informal "tú".
- All docs, README, code comments and submission text are in English.
- Demo mode works with no API key, using scripted questions and fictional sample data.
- Accessibility, privacy and ethics rules in `accessibility-ethics.md` are non-negotiable and override convenience.

## Scope
Main schedule, in order: (a) kit skeleton + animated ghost + Day 5 slice, (b) keyboard + voice + captions, (c) Morse + property tests, (d) camera tier 1 (self-view), (e) ghost-interview, (f) ghost-defense.

Stretch goals, only if ahead of schedule: camera tier 2 (face signals for the ghost's gaze), (g) experimental sign input.

## Out of scope
Generated video avatars, accounts/login, server-side storage of user data, sign language translation, emotion recognition, grading users for real hiring or academic decisions.
