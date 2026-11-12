import type { GhostState, SessionState, Timeline } from '@ghost-examiner/core';

/** The parts of the session view the ghost needs; `SessionView` from @ghost-examiner/web fits. */
export interface GhostSessionView {
  state: SessionState;
  line?: { timeline: Timeline; startedAt: number; playing: boolean };
}

/**
 * Session view + playback → ghost state (design §5.2, Req 3.4). Rows are checked in table order:
 *
 * | Session                      | Activity / expression                              |
 * |------------------------------|----------------------------------------------------|
 * | a line is playing            | speaking / neutral (feedback reaction for summary) |
 * | answering, confirming        | listening / attentive                              |
 * | evaluating                   | thinking / thinking                                |
 * | feedback, after the line     | reacting / feedback.reaction                       |
 * | intro, summary, no line      | idle / neutral                                     |
 *
 * Pure. Only a playing line passes its timeline on, so a finished line never moves the mouth.
 */
export function ghostState(view: GhostSessionView, seed: number): GhostState {
  const { state, line } = view;
  // The engine stores feedback only in the feedback phase (cleared on `next` and before a re-evaluation).
  const reaction = state.feedback?.reaction;

  if (line?.playing) {
    return {
      activity: 'speaking',
      expression: reaction ?? 'neutral',
      speech: { timeline: line.timeline, startedAt: line.startedAt },
      seed,
    };
  }
  switch (state.phase) {
    case 'answering':
    case 'confirming':
      return { activity: 'listening', expression: 'attentive', seed };
    case 'evaluating':
      return { activity: 'thinking', expression: 'thinking', seed };
    case 'feedback':
      return { activity: 'reacting', expression: reaction ?? 'neutral', seed };
    default:
      return { activity: 'idle', expression: 'neutral', seed };
  }
}
