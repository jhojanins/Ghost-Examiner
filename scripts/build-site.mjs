// Assembles the one site (design §7, Req 13.1): the landing page at /, ghost-interview at
// /interview/ and ghost-defense at /defense/. Run after both apps are built (`pnpm build`).
import { access, cp, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const parts = [
  ['site/', ''],
  ['apps/ghost-interview/dist/', 'interview/'],
  ['apps/ghost-defense/dist/', 'defense/'],
];

for (const [from] of parts) await access(new URL(from, root)); // fail loudly if an app was not built

await rm(dist, { recursive: true, force: true });
for (const [from, to] of parts) await cp(new URL(from, root), new URL(to, dist), { recursive: true });
console.log('Site assembled in dist/: /, /interview/, /defense/');
