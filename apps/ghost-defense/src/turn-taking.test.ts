import { describe, expect, it } from 'vitest';
import { shouldAutoListen, type TurnState } from './turn-taking';

const ready: TurnState = {
  voiceMode: true,
  phase: 'answering',
  ghostSpeaking: false,
  voice: { available: true, listening: false },
  questionKey: '0',
};

describe('shouldAutoListen (voice conversation, owner decision 2026-11-20)', () => {
  it('starts listening once the question has been spoken, in voice mode', () => {
    expect(shouldAutoListen(ready)).toBe(true);
  });
  it('never while the ghost speaks, or before the question has finished (asking)', () => {
    expect(shouldAutoListen({ ...ready, ghostSpeaking: true })).toBe(false);
    expect(shouldAutoListen({ ...ready, phase: 'asking' })).toBe(false);
  });
  it('never in Type mode, or after Mic off', () => {
    expect(shouldAutoListen({ ...ready, voiceMode: false })).toBe(false);
  });
  it('never outside answering: confirming, evaluating, feedback, summary', () => {
    for (const phase of ['confirming', 'evaluating', 'feedback', 'summary', 'preparing'] as const) expect(shouldAutoListen({ ...ready, phase }), phase).toBe(false);
  });
  it('once per question: no automatic retry after an error, an Edit or a cancel', () => {
    expect(shouldAutoListen({ ...ready, autoListenedFor: '0' })).toBe(false);
    expect(shouldAutoListen({ ...ready, autoListenedFor: '0', questionKey: '0:follow-up' })).toBe(true); // a follow-up is a new question
    expect(shouldAutoListen({ ...ready, voice: { available: true, listening: false, error: 'voice.error.permission' } })).toBe(false);
  });
  it('not when voice is unavailable (Brave, no API) or already listening', () => {
    expect(shouldAutoListen({ ...ready, voice: { available: false, listening: false } })).toBe(false);
    expect(shouldAutoListen({ ...ready, voice: { available: true, listening: true } })).toBe(false);
  });
});
