import { format, kitMessages, type DefenseSummary as Summary, type Locale } from '@ghost-examiner/core';
import { useId, useState, type Ref } from 'react';
import { QuoteBlock } from './QuoteBlock';
import './tokens.css';
import './ConfirmAnswer.css';
import './FeedbackPanel.css';

export interface DefenseSummaryProps {
  locale: Locale;
  fileLang: Locale;
  /** Who wrote it (Req 8.2): AI (with the provider's name) or the offline demo rules. */
  source: 'ai' | 'demo';
  provider?: string;
  /** The questions asked, in order. */
  questions: readonly string[];
  /** Undefined while the summary is being written. */
  summary?: Summary;
  onAgain: () => void;
  onNew: () => void;
  /** The heading, so the app can move focus to it when the summary opens. */
  ref?: Ref<HTMLHeadingElement>;
}

/** The summary as plain text, for the clipboard (Req 8.5): no markup at all. */
function asText(p: DefenseSummaryProps, label: string): string {
  const m = kitMessages[p.locale];
  const lines = [m['defense.summary.heading'], '', m['defense.summary.questions'], ...p.questions.map((q) => `- ${q}`)];
  if (p.summary) {
    lines.push('', m['defense.summary.strength'], p.summary.strength);
    if (p.summary.review.length > 0) {
      lines.push('', m['defense.summary.review'], ...p.summary.review.flatMap((r) => [`- ${r.point}`, `  "${r.quote}"`]));
    }
  }
  lines.push('', label);
  return lines.join('\n');
}

/**
 * The end of a defense session (ghost-defense-live Req 8): the questions, one strength and up to
 * three points to review with their quotes, labeled as practice feedback and by source. Copy
 * summary puts plain text on the clipboard (feature-detected; without a clipboard the button is
 * hidden and the text stays selectable). Nothing is saved anywhere.
 */
export function DefenseSummary(props: DefenseSummaryProps) {
  const { locale, fileLang, source, provider = '', questions, summary, ref } = props;
  const m = kitMessages[locale];
  const id = useId();
  const [copied, setCopied] = useState(false);
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
  const label = `${m['defense.summary.label']} ${source === 'demo' ? m['defense.summary.source.demo'] : format(m['defense.summary.source.ai'], { provider })}`;
  return (
    <section className="ge-feedback" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} ref={ref} tabIndex={-1} className="ge-feedback-heading">
        {m['defense.summary.heading']}
      </h2>
      <h3 id={`${id}-questions`}>{m['defense.summary.questions']}</h3>
      <ol aria-labelledby={`${id}-questions`}>
        {questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ol>
      {summary && (
        <>
          <h3>{m['defense.summary.strength']}</h3>
          <p>{summary.strength}</p>
          {summary.review.length > 0 && (
            <>
              <h3 id={`${id}-review`}>{m['defense.summary.review']}</h3>
              <ul aria-labelledby={`${id}-review`}>
                {summary.review.map((r, i) => (
                  <li key={i}>
                    {r.point}
                    <QuoteBlock locale={locale} quote={r.quote} lang={fileLang} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      <p className="ge-feedback-demo">{label}</p>
      <div className="ge-confirm-actions">
        {clipboard && (
          <button
            type="button"
            className="ge-button"
            onClick={() => void clipboard.writeText(asText(props, label)).then(() => setCopied(true), () => setCopied(false))}
          >
            {m['defense.summary.copy']}
          </button>
        )}
        <button type="button" className="ge-button ge-button--primary" onClick={props.onAgain}>
          {m['defense.summary.again']}
        </button>
        <button type="button" className="ge-button" onClick={props.onNew}>
          {m['defense.summary.new']}
        </button>
      </div>
      <p aria-live="polite">{copied ? m['defense.summary.copied'] : ''}</p>
    </section>
  );
}
