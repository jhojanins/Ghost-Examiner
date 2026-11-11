---
inclusion: always
---

# Structure

## Repository rules
- Public GitHub repo, MIT `LICENSE` at the root.
- `/.kiro` lives at the repo root and is committed. Never add `.kiro` or any of its contents to `.gitignore`.
- `apps/` contains exactly two app folders: `apps/ghost-interview` and `apps/ghost-defense`. Nothing else goes in `apps/`.
- The kit (reusable skeleton) is the three packages in `packages/`. The README must state clearly which part is the skeleton (`packages/`) and which are the two apps (`apps/`).

## Layout
```
/.kiro/                  steering, specs, hooks, skills, settings (tracked)
/apps/
  ghost-interview/       app: screens, question packs, config, e2e/
  ghost-defense/         app: screens, document flow, fictional samples, e2e/
/packages/               the kit
  core/                  @ghost-examiner/core: pure TS, no React, no DOM
  web/                   @ghost-examiner/web: browser adapters, effect runtime, no React
  ui/                    @ghost-examiner/ui: React components, styles, tokens
/netlify/functions/      llm.mts proxy (thin; logic from @ghost-examiner/core)
/site/                   static landing page linking both apps
/scripts/                build and site-assembly scripts
/docs/                   ARCHITECTURE.md, KIRO_USAGE.md, PRIVACY.md
LICENSE  README.md
```

## Dependency direction
- `apps → ui → web → core`. `core` depends on nothing in the repo.
- Framework-agnostic core: the `InputAdapter` interface, Morse encode/decode and timing classifier, question engine, `LLMProvider` and the ghost state machine live in `packages/core` as pure TypeScript. They never import React, react-dom or JSX, and never use DOM APIs (core's tsconfig has no DOM lib), so they run in Node and work with any UI.
- `packages/web` may use browser APIs but never imports React.
- React is only the UI layer (`packages/ui` and the apps): the Ghost avatar component, input widgets and app screens.
- Apps import packages only through their public entry points (`package.json` `exports`). Packages never import from an app.
- Apps differ by configuration and content (question packs, prompts, copy, theme), not by forking kit code. If an app needs new behavior, add an extension point to the kit.
- Each input method is an adapter implementing `InputAdapter`. Adding an input never requires changes to the question engine.

## Conventions
- File names: `kebab-case.ts`; React components: `PascalCase.tsx`.
- Tests sit next to the code: `*.test.ts`, property tests `*.prop.test.ts`, e2e in each app's `e2e/` folder.
- User-facing strings never appear inline in components; they come from the `en`/`es` catalogs.
