---
name: kiroween-checklist
description: "Kiroween 2026 submission checklist for Ghost Examiner (Skeleton Crew category plus Best Student bonus): public repo, MIT license, tracked /.kiro, two app folders, English materials, demo video under 3 minutes, live URL until Jan 29, 2027. Use when preparing a release, the README, the demo video, the submission form, or when asked whether the project meets hackathon requirements."
metadata:
  project: ghost-examiner
---

# Kiroween submission checklist

Feature freeze and final deploy: **Dec 1, 2026**. Submit: **Dec 2**. Official deadline: Dec 4 (buffer only). Before submitting, re-read the official Kiroween rules page and record its URL and any new requirement here.

## Repository
- [ ] Repo is public on GitHub.
- [ ] `LICENSE` (MIT) at the root, detected by GitHub (shown in the repo sidebar).
- [ ] `/.kiro` is committed: `git ls-files .kiro | head` lists files and `git check-ignore -v .kiro` prints nothing.
- [ ] `.gitignore` has no rule matching `.kiro`.
- [ ] Two app folders exist and build: `apps/ghost-interview`, `apps/ghost-defense`.
- [ ] `apps/` contains exactly those two folders.
- [ ] Both apps import only from `packages/*` public entry points (Skeleton Crew story). README states that `packages/` is the skeleton and `apps/` holds the two apps.

## Materials (all in English)
- [ ] README: what it is, live URL(s), how to run, demo mode, architecture summary, accessibility and privacy, Kiro usage summary, license.
- [ ] `docs/KIRO_USAGE.md` is complete: specs, steering, hooks, MCP, powers, skills, PBT, with concrete examples.
- [ ] Category stated: Skeleton Crew. Best Student bonus: eligibility proof prepared as the rules require.
- [ ] No Kiro trademarks or copyrighted assets; the ghost is original and visibly distinct from Kiro's mascot.

## Demo video
- [ ] Under 3 minutes, public link (YouTube or Vimeo), English, with captions.
- [ ] Shows both apps, the kit reuse, at least 3 input methods, captions, muted mode, camera optional, privacy notice, and a short Kiro workflow segment.
- [ ] Uses demo mode or fictional data only.
- [ ] The demo evaluator is keyword-based: the video, its narration and the Devpost text present it as a demo ("keyword-based demo feedback"), never as the app understanding or grading the answer. Real LLM evaluation is described only where a real provider is shown.

## Live URL until Jan 29, 2027
- [ ] Netlify production URL works in a private window with no API key (demo mode).
- [ ] Netlify credits checked: production deploys budgeted, nothing near the 300-credit cap.
- [ ] Backup mirror (GitHub Pages, demo + BYOK) works and is linked in the README.
- [ ] Calendar reminders to re-check the URL weekly until Jan 29, 2027.

## Product rules spot check
- [ ] Every question answerable by >= 2 input methods; confirmation before evaluation.
- [ ] Captions always on for ghost speech; fully usable muted.
- [ ] Camera off by default; everything except signs works without it; signs labeled Experimental and never called translation.
- [ ] Privacy notice shown, warns about free-tier LLM data use and sensitive documents.
- [ ] axe: zero violations on every screen in EN and ES.
