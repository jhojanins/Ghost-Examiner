import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      { test: { name: 'core', root: 'packages/core', environment: 'node' } },
      { test: { name: 'web', root: 'packages/web', environment: 'jsdom' } },
      { test: { name: 'ui', root: 'packages/ui', environment: 'jsdom' } },
      // Content checks only; the app's screens are covered by the browser walk-through and e2e.
      { test: { name: 'ghost-interview', root: 'apps/ghost-interview', environment: 'node', exclude: ['e2e/**', 'node_modules/**'] } },
    ],
  },
});
