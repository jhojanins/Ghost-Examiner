/**
 * ghost-defense build settings. Not a Preview build since phase 1 (ghost-defense-live Req 14.4):
 * a browser without speech recognition still gets a Preview session (spec b Req 10.4).
 */
export const config = {
  preview: false,
} as const;
