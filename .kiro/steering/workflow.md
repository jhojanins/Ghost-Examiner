---
inclusion: always
---

# Workflow: definition of done

A task is done only when all of these pass. If a step fails, fix the problem and re-run every step.

1. **Use the relevant skills** before writing code:
   | Work touches | Skills |
   |---|---|
   | Any code, config, tests or task planning | `lean-code` |
   | Any UI, styles, copy | `a11y-review` (plus `ghost-persona` for any user-facing text) |
   | Ghost avatar, lip-sync, captions | `ghost-svg-animation`, `a11y-review` |
   | Morse logic or adapter | `morse-input-pbt` |
   | LLM providers, proxy, env vars | `netlify-proxy-safety`, `prompt-injection-defense` |
   | Prompts, document parsing, evaluation | `prompt-injection-defense`, `ghost-persona` |
   | Writing or running tests | `testing-strategy` |
   | Release, README, video, submission | `kiroween-checklist` |
2. **Run the tests**: typecheck, lint, and unit + property tests for the affected packages, single-shot (no watch mode).
3. **Verify in the browser through Playwright MCP**: open the running app, use it by keyboard only, and check the behavior the task changed (captions, muted mode, ES/EN, confirmation step, no console errors).
4. **Run the automated accessibility check** (axe, WCAG 2.2 AA tags): zero violations on affected screens.
5. **Report** what was verified and how. Anything that could not be verified is stated explicitly; the task is not marked done.
6. **Log** notable Kiro usage in `docs/KIRO_USAGE.md`.

## Scope rules
- **Traceability**: every file or function added must trace to a requirement in the active spec. If it doesn't, don't add it; tell the owner instead.
- **Small tasks**: each task in `tasks.md` is one logical unit with its own success criterion. Split any task that is bigger.
- **Mutation checks and commits**: after mutation checks, restore each file and confirm it matches the original (`diff` against the backup) before committing. Every commit goes in its own message, after the edits are confirmed (for example with `git diff`); never in the same batch as a file edit or a script that edits files. No exceptions.

Production deploys are never part of "done" without the owner's explicit approval in the conversation.

Exception: a task with no runnable UI yet (early `packages/core` work) skips steps 3 and 4, says so in its report, and the first task that adds UI covers them.
