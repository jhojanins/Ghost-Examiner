---
name: lean-code
description: Keep Ghost Examiner code minimal and on-task. Use before writing, changing or reviewing any code, config or test, and when splitting spec tasks in tasks.md, to check assumptions, avoid speculative code, limit the diff to the task, and define how the result will be verified.
metadata:
  project: ghost-examiner
---

# Lean code

## 1. Think before coding
- Restate the task in one sentence and name the requirement it implements (e.g. "Req 7.3").
- List your assumptions. If one would change the design or the user-visible result, ask before coding.
- If the requirement is ambiguous or two readings are plausible, ask. Don't pick silently.

## 2. Simplicity first
- Write the least code that meets the acceptance criteria. Nothing "for later".
- No new abstraction until the second real use exists. One implementation does not need an interface, unless the architecture already defines one (`InputAdapter`, `LLMProvider`, `SpeechOutput`, `Clock`).
- No config options, flags or parameters that no requirement asks for.
- No new dependency without asking. Prefer the platform, plain functions and data.

## 3. Surgical changes
- Touch only the files and lines the task needs.
- Don't rename, reformat, reorder or "clean up" unrelated code, even if it bothers you.
- If you see an unrelated bug, smell or missing test, mention it in the report. Don't fix it in this task.
- Delete only code that your own change made dead.

## 4. Goal-driven execution
- Before coding, write the success criterion as something checkable: a test name, a command and its expected output, or a browser behavior to observe.
- Write or update the test first when practical; see it fail, then make it pass.
- Done means the criterion was verified (see `workflow.md`), not that the code compiles.

## Task size
- One task = one logical unit: one module, one component, one adapter, or one flow step, with its tests.
- Split a task if it touches more than one package for unrelated reasons, needs more than one success criterion that can fail independently, or would take more than about half a day.

## Self-check before reporting
- Every added file and function traces to a requirement in the active spec.
- No code that no test or requirement needs; the diff is limited to the task.
