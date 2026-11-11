---
name: morse-input-pbt
description: Write property-based tests with fast-check for the Morse code encoder, decoder and press-timing classifier in packages/core/src/morse. Use when creating or changing Morse encode/decode logic, timing thresholds, the Morse input adapter, or their tests.
metadata:
  project: ghost-examiner
---

# Morse property-based tests

## Contract under test (finalized in spec c)
- `encode(text) → string`: letters separated by one space, words by ` / `. Output alphabet: `.`, `-`, ` `, `/`.
- `decode(code) → string`: total function, never throws. Unknown codes become `?`.
- `normalize(text)`: uppercase, strip accents (É→E), keep Ñ (`--.--`), collapse whitespace.
- `classify(presses, thresholds) → symbols`: pure; input is press/release timestamps, never `Date.now()`.
- Timing model (unit `u`): dot 1u, dash 3u, gap inside a letter 1u, between letters 3u, between words 7u. Default boundaries: press < 2u is a dot; gap < 2u same letter, < 5u new letter, otherwise new word.

## Properties to cover
1. **Round trip**: for any string over the supported alphabet, `decode(encode(s)) === normalize(s)`.
2. **Output alphabet**: `encode` output only contains `.`, `-`, ` `, `/`.
3. **Totality**: `decode` of any string over `.- /` returns without throwing.
4. **Recovery under jitter**: build ideal presses from a symbol sequence with unit `u` in the user range (60 to 400 ms) and jitter up to ±30%; `classify` returns the original symbols.
5. **Monotonicity**: lengthening a press never turns a dash into a dot; lengthening a gap never merges letters.
6. **Scale invariance**: multiplying all timestamps and thresholds by `k > 0` gives the same symbols.
7. **Determinism**: same input, same output.

## Generators
- Build valid inputs directly; avoid `.filter()` that rejects most cases.
- Characters: `fc.constantFrom(...ALPHABET)`; words: `fc.array(char, { minLength: 1, maxLength: 12 })`; texts: `fc.array(word, { minLength: 1, maxLength: 6 }).map(ws => ws.join(' '))`.
- Timing: map a symbol sequence plus `fc.integer({ min: 60, max: 400 })` (unit) and `fc.array(fc.double({ min: -0.3, max: 0.3, noNaN: true }))` (jitter) to press events.

```ts
import fc from 'fast-check';
import { describe, it } from 'vitest';
import { encode, decode, normalize, ALPHABET } from './morse';

const text = fc
  .array(fc.array(fc.constantFrom(...ALPHABET), { minLength: 1, maxLength: 12 }).map(c => c.join('')), { minLength: 1, maxLength: 6 })
  .map(words => words.join(' '));

describe('morse codec', () => {
  it('round-trips any supported text', () => {
    fc.assert(fc.property(text, s => decode(encode(s)) === normalize(s)));
  });
});
```

## Conventions
- Files: `*.prop.test.ts` next to the code. Run with `vitest run`, never watch mode.
- Default `numRuns` 100 locally; raise to 1000 in CI with an env var.
- When a property fails, copy the shrunk counterexample into a normal `*.test.ts` regression test and keep the seed in the test name.
- Also keep a few example-based tests (SOS, empty string, `Ñ`, digits) for readability.
- Log each new property in `docs/KIRO_USAGE.md` under PBT.
