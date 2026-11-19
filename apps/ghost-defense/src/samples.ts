import type { Locale } from '@ghost-examiner/core';
import en from '../content/samples/sample-en.md?raw';
import es from '../content/samples/sample-es.md?raw';

/**
 * Two fictional sample files for "Try with a sample file" (ghost-defense-live Req 1.10), bundled as
 * text with Vite's `?raw`, so choosing one makes no request. They are also golden files 1 and 2
 * (Req 15.5).
 */
export const SAMPLES: readonly { lang: Locale; text: string }[] = [
  { lang: 'en', text: en },
  { lang: 'es', text: es },
];
