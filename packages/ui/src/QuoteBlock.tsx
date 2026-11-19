import { kitMessages, type Locale } from '@ghost-examiner/core';
import { useId } from 'react';
import './tokens.css';
import './QuoteBlock.css';

export interface QuoteBlockProps {
  locale: Locale;
  quote: string;
  /** The file's language (ghost-defense-live Req 2.4), so screen readers read the quote correctly. */
  lang: Locale;
}

/**
 * A passage of the user's file (Req 6.7): labeled "From your file", shown as plain text in a
 * `blockquote` with the file's `lang`. Quotes are shown, never spoken (owner decision 5).
 */
export function QuoteBlock({ locale, quote, lang }: QuoteBlockProps) {
  const id = useId();
  return (
    <figure className="ge-quote" aria-labelledby={id}>
      <figcaption id={id} className="ge-quote-label">
        {kitMessages[locale]['defense.quote.label']}
      </figcaption>
      <blockquote className="ge-quote-text" lang={lang}>
        {quote}
      </blockquote>
    </figure>
  );
}
