import { format, kitMessages, type AnswerCandidate, type Locale } from '@ghost-examiner/core';
import { useEffect, useId, useRef } from 'react';
import './tokens.css';
import './ConfirmAnswer.css';

export interface InlineConfirmProps {
  locale: Locale;
  candidate: AnswerCandidate & { candidateId: number };
  onSend: (candidateId: number) => void;
  /** Edit the text in the typed field (spec a 7.3). */
  onEdit: () => void;
  /** Answer again with the same method (spec b 6.3). */
  onRetry: () => void;
  /** A spoken answer: listen again and add to the same words (ghost-defense voice conversation). */
  onKeepTalking?: () => void;
}

/**
 * Inline confirmation for a conversation (ghost-defense-live Req 7.2, owner decision 3): the
 * interpreted answer stays in the answer area with Send focused on mount, so Enter confirms; after
 * voice stops, the candidate mounts this view, so stop then Enter is the whole action. Send is
 * described by the text, the method and any notice, so a screen reader reads them once on focus.
 * Confirmation is always this explicit press.
 */
export function InlineConfirm({ locale, candidate, onSend, onEdit, onRetry, onKeepTalking }: InlineConfirmProps) {
  const m = kitMessages[locale];
  const id = useId();
  const send = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    send.current?.focus();
  }, []);
  const describedBy = [`${id}-text`, `${id}-method`, ...(candidate.notice ? [`${id}-notice`] : [])].join(' ');
  return (
    <section className="ge-confirm" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="ge-confirm-heading">
        {m['defense.confirm.heading']}
      </h2>
      <blockquote id={`${id}-text`} className="ge-confirm-answer">
        {candidate.text}
      </blockquote>
      {candidate.notice && (
        <p id={`${id}-notice`} className="ge-confirm-notice">
          {m[candidate.notice]}
        </p>
      )}
      <p id={`${id}-method`} className="ge-confirm-method">
        {format(m['confirm.method'], { method: m[`method.${candidate.method}`] })}
      </p>
      <div className="ge-confirm-actions">
        <button ref={send} type="button" className="ge-button ge-button--primary" aria-describedby={describedBy} onClick={() => onSend(candidate.candidateId)}>
          {m['defense.confirm.send']}
        </button>
        {onKeepTalking && candidate.method === 'voice' && (
          <button type="button" className="ge-button" onClick={onKeepTalking}>
            {m['voice.keepTalking']}
          </button>
        )}
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
