/**
 * ghost-interview build settings (Req 11.4). Not a Preview build since voice input landed (spec b
 * Req 10.1): a browser without speech recognition gets a Preview session at runtime instead.
 */
export const config = {
  preview: false,
} as const;
