/**
 * Which reply sentences the panel shows (owner decision 2026-11-20): with the ghost's voice on, a
 * streamed sentence appears when it starts playing, in step with captions and mouth; with the
 * voice off or unavailable, every sentence that arrived shows at once. A reply that was not
 * streamed (`played` undefined) shows whole.
 */
export function visibleSentences(say: readonly string[], played: number | undefined, sound: { on: boolean; reason?: string }): readonly string[] {
  const voiced = sound.on && sound.reason === undefined;
  return played === undefined || !voiced ? say : say.slice(0, played);
}

/**
 * The mode label for the screen (owner decision 2026-11-20): a reply from the demo rules, while
 * the session will try AI again, is labeled as that one turn; otherwise the session's mode.
 */
export function labelMode(defense: { mode: 'ai' | 'demo' | 'mixed'; replyFrom?: 'ai' | 'demo' } | undefined): 'ai' | 'demo' | 'mixed' | 'turn-demo' {
  if (!defense) return 'demo';
  return defense.replyFrom === 'demo' && defense.mode !== 'demo' ? 'turn-demo' : defense.mode;
}
