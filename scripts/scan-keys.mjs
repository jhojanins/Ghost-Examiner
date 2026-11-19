// Fails the build if a provider key ended up in the built site (netlify-proxy-safety skill,
// ghost-defense-live design §5). Keys must live only in Netlify environment variables; a
// `VITE_`-prefixed variable, for example, would be copied into the client bundle.
// Usage: node scripts/scan-keys.mjs dist
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PATTERNS = [
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['Groq API key', /gsk_[0-9A-Za-z]{40,}/],
];

/** Every built file that contains a key, as `{ file, kind }`. The key itself is never reported. */
export async function scanForKeys(dir) {
  const found = [];
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    const text = await readFile(path, 'latin1'); // any bytes, so binary files are scanned too
    for (const [kind, pattern] of PATTERNS) if (pattern.test(text)) found.push({ file: relative(dir, path), kind });
  }
  return found;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? 'dist';
  const found = await scanForKeys(dir);
  for (const { file, kind } of found) console.error(`Key scan: a ${kind} in ${file}`);
  if (found.length > 0) process.exit(1);
  console.log(`Key scan: no provider keys in ${dir}/`);
}
