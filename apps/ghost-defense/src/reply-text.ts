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
