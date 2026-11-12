import type { Locale, Timeline } from '@ghost-examiner/core';
import { Fragment, useEffect, useRef } from 'react';
import './Captions.css';

/** The ghost line on screen; `LineView` from @ghost-examiner/web has this shape. */
export interface CaptionLine {
  id: number;
  text: string;
  locale: Locale;
  timeline: Timeline;
  startedAt: number; // on the performance.now() clock, like the requestAnimationFrame timestamp; identifies the playback
  /** The timeline's current time origin on the same clock; moves on boundary resync (spec b design §3.1). */
  origin: () => number;
  playing: boolean;
}

const CURRENT = 'ge-caption-word--current';

/** Index of the word being said: the last word that has started, while the line lasts. */
function currentWord(line: CaptionLine, now: number): number {
  const elapsed = now - line.origin(); // -Infinity before a spoken line starts: no word
  if (!line.playing || elapsed < 0 || elapsed >= line.timeline.duration) return -1;
  let index = -1;
  for (const word of line.timeline.words) if (word.start <= elapsed) index = word.index;
  return index;
}

/**
 * Live captions (Req 4.1, 4.2, 4.5): the full line at once; the current word gets an underline
 * and bold weight (not color alone), moved by a requestAnimationFrame loop through a ref, from
 * the same timeline and clock as the ghost's mouth. `aria-hidden`, because the Transcript
 * announces each finished line once; announcing word by word would be noise.
 * Sits in normal flow below the ghost, so it never covers the focused element.
 */
export function Captions({ line }: { line?: CaptionLine }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const latest = useRef(line);

  useEffect(() => {
    latest.current = line;
  });

  useEffect(() => {
    let frame = 0;
    const tick = (now: number) => {
      const el = ref.current;
      const l = latest.current;
      if (el && l) {
        const index = currentWord(l, now);
        for (const word of el.children) {
          const isCurrent = Number(word.getAttribute('data-index')) === index;
          if (word.classList.contains(CURRENT) !== isCurrent) word.classList.toggle(CURRENT, isCurrent);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!line) return null;
  return (
    // A new playback gets a fresh element, so no marker carries over from the previous line.
    <p key={`${line.id}:${line.startedAt}`} ref={ref} className="ge-captions" aria-hidden="true" lang={line.locale}>
      {line.timeline.words.map((word, i) => (
        // The space sits between the words, so the underline covers only the word.
        <Fragment key={word.index}>
          {i > 0 && ' '}
          <span className="ge-caption-word" data-index={word.index} data-text={word.text}>
            {word.text}
          </span>
        </Fragment>
      ))}
    </p>
  );
}
