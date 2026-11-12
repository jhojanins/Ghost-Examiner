import { format, kitMessages, type AnswerCandidate, type Locale } from '@ghost-examiner/core';
import { useEffect, useId, useRef } from 'react';
import './tokens.css';
import './ConfirmAnswer.css';

export interface ConfirmAnswerProps {
  locale: Locale;
  /** The interpreted answer, before evaluation (Req 7.1). */
  candidate: AnswerCandidate;
  onConfirm: () => void;
  /** Back to the field with this text prefilled (Req 7.3). */
  onEdit: () => void;
  /** Back to answering the same question from scratch (Req 7.4). */
  onRetry: () => void;
}

/**
 * Confirmation step (Req 7.1, 7.2): shows how the answer was understood and by which input,
 * with Confirm, Edit and Answer again. Focus moves to the heading once, on mount, so the
 * prompt is announced; later re-renders (such as a language switch) leave focus alone.
 */
export function ConfirmAnswer({ locale, candidate, onConfirm, onEdit, onRetry }: ConfirmAnswerProps) {
  const m = kitMessages[locale];
  const headingId = useId();
  const noticeId = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section className="ge-confirm" aria-labelledby={headingId}>
      <h2
        id={headingId}
        ref={heading}
        tabIndex={-1}
        className="ge-confirm-heading"
        aria-describedby={candidate.notice ? noticeId : undefined}
      >
        {m['confirm.heading']}
      </h2>
      <blockquote className="ge-confirm-answer">{candidate.text}</blockquote>
      {/* Owner decision after spec b task 30: the message that ended listening stays next to the
          text until the user acts. Read with the heading when focus lands there; not a live region. */}
      {candidate.notice && (
        <p id={noticeId} className="ge-confirm-notice">
          {m[candidate.notice]}
        </p>
      )}
      <p className="ge-confirm-method">{format(m['confirm.method'], { method: m[`method.${candidate.method}`] })}</p>
      <div className="ge-confirm-actions">
        <button type="button" className="ge-button ge-button--primary" onClick={onConfirm}>
          {m['confirm.confirm']}
        </button>
        <button type="button" className="ge-button" onClick={onEdit}>
          {m['confirm.edit']}
        </button>
        <button type="button" className="ge-button" onClick={onRetry}>
          {m['confirm.retry']}
        </button>
      </div>
    </section>
  );
}
