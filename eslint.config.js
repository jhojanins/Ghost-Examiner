import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig(
  { ignores: ['**/dist/**', '**/test-results/**', '**/playwright-report/**'] },
  tseslint.configs.recommended,
  {
    files: ['packages/ui/**/*.{ts,tsx}', 'apps/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
);
