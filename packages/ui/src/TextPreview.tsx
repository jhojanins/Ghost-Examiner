import { format, kitMessages, type Locale } from '@ghost-examiner/core';
import { useId, type ReactNode, type Ref } from 'react';
import './tokens.css';
import './TextPreview.css';

export interface TextPreviewProps {
  locale: Locale;
  /** The extracted text, exactly as the ghost will read it. */
  text: string;
  truncated: boolean;
  /** Number of excerpts the text was split into. */
  parts: number;
  /** A bundled fictional sample rather than the user's own file (Req 1.10). */
  sample?: boolean;
  fileLang: Locale;
  onFileLang: (lang: Locale) => void;
  count: number;
  onCount: (count: number) => void;
  onRemove: () => void;
  onStart: () => void;
  /** The heading, so the app can move focus to it when the screen opens. */
  ref?: Ref<HTMLHeadingElement>;
}

const COUNTS = [3, 4, 5, 6, 7, 8];
const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t#]*$/;

/** The text as blocks: Markdown headings become headings (level 3 and below), the rest paragraphs. Plain text only. */
function blocks(text: string): ReactNode[] {
  return text
    .split(/\n[ \t]*\n/)
    .map((b) => b.trim())
    .filter((b) => b !== '')
    .map((block, i) => {
      const h = HEADING.exec(block.split('\n')[0]);
      if (!h) return <p key={i}>{block}</p>;
      const Tag = (['h3', 'h4', 'h5', 'h6'] as const)[Math.min(h[1].length - 1, 3)];
      const rest = block.split('\n').slice(1).join('\n').trim();
      return [<Tag key={`${i}h`}>{h[2]}</Tag>, rest && <p key={i}>{rest}</p>];
    });
}

/**
 * What the ghost will read (ghost-defense-live Req 2): the extracted text as real text in a
 * scrollable, focusable region, its size, what the ghost can't see, any warning, the file's
 * language (for screen readers, Req 2.4), the number of questions, and Remove or Start.
 */
export function TextPreview(props: TextPreviewProps) {
  const { locale, text, truncated, parts, sample, fileLang, count, onFileLang, onCount, onRemove, onStart, ref } = props;
  const m = kitMessages[locale];
  const id = useId();
  const number = new Intl.NumberFormat(locale);
  const hasHeadings = text.split('\n').some((line) => HEADING.test(line));
  return (
    <section className="ge-preview-panel" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} ref={ref} tabIndex={-1} className="ge-preview-heading">
        {m['defense.preview.heading']}
      </h2>
      <p>{format(m['defense.preview.counts'], { chars: number.format(text.length), parts: number.format(parts) })}</p>
      <p className="ge-preview-note">{m['defense.preview.onlyText']}</p>
      {sample && <p className="ge-preview-note">{m['defense.preview.sample']}</p>}
      {truncated && <p className="ge-preview-warning">{m['defense.preview.truncated']}</p>}
      {!hasHeadings && <p className="ge-preview-note">{m['defense.preview.noHeadings']}</p>}
      <div className="ge-preview-text" role="region" aria-label={m['defense.preview.textLabel']} tabIndex={0} lang={fileLang}>
        {blocks(text)}
      </div>
      <fieldset className="ge-preview-field">
        <legend>{m['defense.preview.fileLang']}</legend>
        {(['en', 'es'] as const).map((lang) => (
          <label key={lang} className="ge-preview-radio">
            <input type="radio" name={`${id}-lang`} value={lang} checked={fileLang === lang} onChange={() => onFileLang(lang)} />
            <span lang={lang}>{m[`language.${lang}`]}</span>
          </label>
        ))}
      </fieldset>
      <label htmlFor={`${id}-count`} className="ge-preview-label">
        {m['defense.preview.count']}
      </label>
      <select id={`${id}-count`} className="ge-preview-select" value={count} onChange={(e) => onCount(Number(e.target.value))}>
        {COUNTS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <div className="ge-preview-actions">
        <button type="button" className="ge-button ge-button--primary" onClick={onStart}>
          {m['defense.preview.start']}
        </button>
        <button type="button" className="ge-button" onClick={onRemove}>
          {m['defense.preview.remove']}
        </button>
      </div>
    </section>
  );
}
