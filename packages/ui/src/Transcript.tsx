import { kitMessages, type Locale } from '@ghost-examiner/core';
import { useId, useState } from 'react';
import './Transcript.css';

/** A finished ghost line. The app keeps the list (the session view holds only the current line). */
export interface TranscriptLine {
  id: number;
  text: string;
  locale: Locale;
  /** The user heard it spoken aloud, so it is listed but not announced again (Req 3.6). */
  heard: boolean;
}

export interface TranscriptProps {
  lines: readonly TranscriptLine[];
  /** UI language, for the heading. Each line keeps its own `lang`. */
  locale: Locale;
}

/**
 * Transcript of finished ghost lines (Req 4.4). The list itself is not live. A separate,
 * visually hidden polite live region holds only the newest line, keyed by line id, so:
 * - each finished line is announced exactly once (a re-render or language switch with the same
 *   lines leaves the node untouched, so nothing is re-read);
 * - a new line with the same words still gets a new node and is announced;
 * - lines already present at mount are listed but not announced;
 * - a line the user heard spoken aloud is listed but not announced, so a screen reader doesn't
 *   repeat the ghost's audio (spec b Req 3.6).
 */
export function Transcript({ lines, locale }: TranscriptProps) {
  const headingId = useId();
  const [firstNewId] = useState(() => Math.max(0, ...lines.map((l) => l.id)) + 1);
  const newest = lines.at(-1);
  const announce = newest && newest.id >= firstNewId && !newest.heard ? newest : undefined;

  return (
    <section className="ge-transcript" aria-labelledby={headingId}>
      <h2 id={headingId} className="ge-transcript-heading">
        {kitMessages[locale]['transcript.heading']}
      </h2>
      <ol className="ge-transcript-list">
        {lines.map((line) => (
          <li key={line.id} lang={line.locale}>
            {line.text}
          </li>
        ))}
      </ol>
      <div className="ge-visually-hidden" aria-live="polite">
        {announce && (
          <p key={announce.id} lang={announce.locale}>
            {announce.text}
          </p>
        )}
      </div>
    </section>
  );
}
