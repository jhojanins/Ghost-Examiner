import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { scanForKeys } from './scan-keys.mjs';

// Planted fake keys in the shape of real ones (test data only; neither is a real key).
const FAKE_GOOGLE = 'AIza' + 'Sy' + 'A'.repeat(33);
const FAKE_GROQ = 'gsk_' + 'b'.repeat(52);
let dir;
afterEach(async () => dir && rm(dir, { recursive: true, force: true }));

describe('scanForKeys (netlify-proxy-safety skill: scan dist/ after each build)', () => {
  it('finds a Google or Groq key planted anywhere in the built files, and names the file', async () => {
    dir = await mkdtemp(join(tmpdir(), 'scan-'));
    await mkdir(join(dir, 'defense', 'assets'), { recursive: true });
    await writeFile(join(dir, 'index.html'), '<p>clean</p>');
    await writeFile(join(dir, 'defense', 'assets', 'index.js'), `const k="${FAKE_GOOGLE}";`);
    await writeFile(join(dir, 'defense', 'assets', 'other.js'), `x="${FAKE_GROQ}"`);
    const found = await scanForKeys(dir);
    expect(found.map((f) => f.file).sort()).toEqual([join('defense', 'assets', 'index.js'), join('defense', 'assets', 'other.js')]);
    expect(found.map((f) => f.kind).sort()).toEqual(['Google API key', 'Groq API key']);
    expect(JSON.stringify(found)).not.toContain(FAKE_GOOGLE); // the report never repeats the key
  });
  it('passes a clean build, including text that merely mentions the prefixes', async () => {
    dir = await mkdtemp(join(tmpdir(), 'scan-'));
    await writeFile(join(dir, 'app.js'), 'const note = "keys start with AIza or gsk_";');
    expect(await scanForKeys(dir)).toEqual([]);
  });
});
