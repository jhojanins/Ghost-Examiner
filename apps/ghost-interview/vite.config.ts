import { defineConfig } from 'vite';

// Served at /interview/ on the combined site (design §6, §7). Vite 8 compiles JSX from tsconfig.
export default defineConfig({
  base: '/interview/',
});
