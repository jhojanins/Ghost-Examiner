import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      { test: { name: 'core', root: 'packages/core', environment: 'node' } },
      { test: { name: 'web', root: 'packages/web', environment: 'jsdom' } },
      { test: { name: 'ui', root: 'packages/ui', environment: 'jsdom' } },
    ],
  },
});
