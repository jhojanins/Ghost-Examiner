import { kitMessages, type Feedback, type Locale } from '@ghost-examiner/core';
import { useEffect, useId, useRef } from 'react';
import './tokens.css';
import './FeedbackPanel.css';

export interface FeedbackPanelProps {
  /** UI language, for the panel's own labels. */
  locale: Locale;
  feedback: Feedback;
  /** The evaluator's provider is a demo provider (`LLMProvider.isDemo`): show the demo label. */
  demo: boolean;
  onNext: () => void;
}

/**
 * Practice feedback (Req 8.2, 8.5): one strength and one improvement, under a heading that says
 * it is practice feedback, never a verdict. Demo feedback says plainly that it is keyword-based
 * (task 27 rule). The feedback text carries its own `lang`. The summary is the ghost's spoken
 * line (captions and transcript), so it is not repeated here. Focus moves to the heading once.
 */
export function FeedbackPanel({ locale, feedback, demo, onNext }: FeedbackPanelProps) {
  const m = kitMessages[locale];
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section className="ge-feedback" aria-labelledby={headingId}>
      <h2 id={headingId} ref={heading} tabIndex={-1} className="ge-feedback-heading">
        {m['feedback.heading']}
      </h2>
      {demo && <p className="ge-feedback-demo">{m['feedback.demoLabel']}</p>}
      <div className="ge-feedback-items">
        <div>
          <h3 className="ge-feedback-label">{m['feedback.strengthLabel']}</h3>
          <p lang={feedback.locale}>{feedback.strength}</p>
        </div>
        <div>
          <h3 className="ge-feedback-label">{m['feedback.improvementLabel']}</h3>
          <p lang={feedback.locale}>{feedback.improvement}</p>
        </div>
      </div>
      <button type="button" className="ge-button ge-button--primary" onClick={onNext}>
        {m['feedback.next']}
      </button>
    </section>
  );
}
