import type { Phase } from '@ghost-examiner/core';

/** What the voice conversation needs to decide when to open the microphone (owner decision 2026-11-20). */
export interface TurnState {
  /** The user chose "Voice conversation" and hasn't pressed Mic off. */
  voiceMode: boolean;
  phase: Phase;
  /** A ghost line is playing: listening now would hear the ghost (no echo). */
  ghostSpeaking: boolean;
  voice: { available: boolean; listening: boolean; error?: string };
  /** The question on screen (a follow-up is a new one). */
  questionKey: string;
  /** The question listening was already opened for automatically. */
  autoListenedFor?: string;
}

/**
 * Open the microphone by itself only when the question has been spoken (answering), the ghost is
 * quiet, the user chose voice, and only once per question: after an error, an Edit or a cancel it
 * waits for a button (no automatic retries). The app adds no timers: the turn ends when the user
 * presses "I'm done" or recognition ends with an error.
 */
export function shouldAutoListen(t: TurnState): boolean {
  return (
    t.voiceMode &&
    t.phase === 'answering' &&
    !t.ghostSpeaking &&
    t.voice.available &&
    !t.voice.listening &&
    t.voice.error === undefined &&
    t.autoListenedFor !== t.questionKey
  );
}
