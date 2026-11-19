import { format, kitMessages, type KitMessageKey, type Locale } from '@ghost-examiner/core';
import { useId, useState, type DragEvent, type Ref } from 'react';
import './tokens.css';
import './FileUpload.css';

export interface FileUploadProps {
  locale: Locale;
  /** Who answers right now, already localized (Req 1.1: name the active provider). */
  provider: string;
  /** The last parsing problem, if any (a `defense.error.*` key). */
  error?: KitMessageKey;
  onFile: (file: File) => void;
  onPaste: (text: string) => void;
  /** Bundled fictional samples (Req 1.10); the app loads a chosen one through the same path as pasted text. */
  samples?: readonly FileSample[];
  onSample?: (sample: FileSample) => void;
  /** The heading, so the app can move focus to it when the screen opens. */
  ref?: Ref<HTMLHeadingElement>;
}
export interface FileSample {
  lang: Locale;
  text: string;
}

/**
 * Choosing the user's file (ghost-defense-live Req 1.1, 1.2, 1.7): the warning and the active
 * provider first, then a native file input, drag and drop on the same area (never the only way),
 * and a "paste text instead" disclosure. Parsing happens in the app (packages/web); this only
 * passes the file or text on. Errors go to one polite region that is always present.
 */
export function FileUpload({ locale, provider, error, onFile, onPaste, samples = [], onSample, ref }: FileUploadProps) {
  const m = kitMessages[locale];
  const id = useId();
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };
  return (
    <section className="ge-upload" role="group" aria-labelledby={`${id}-heading`} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <h2 id={`${id}-heading`} ref={ref} tabIndex={-1} className="ge-upload-heading">
        {m['defense.upload.heading']}
      </h2>
      <p className="ge-upload-warning">{m['defense.upload.warning']}</p>
      <p className="ge-upload-provider">{format(m['defense.upload.provider'], { provider })}</p>
      <label htmlFor={`${id}-file`} className="ge-upload-label">
        {m['defense.upload.label']}
      </label>
      <input
        id={`${id}-file`}
        className="ge-upload-file"
        type="file"
        accept=".txt,.md"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = ''; // choosing the same file again still counts
        }}
      />
      <button type="button" className="ge-link-button ge-upload-toggle" aria-expanded={pasting} aria-controls={`${id}-paste`} onClick={() => setPasting(!pasting)}>
        {m['defense.upload.paste']}
      </button>
      <div id={`${id}-paste`} className="ge-upload-paste" hidden={!pasting}>
        {pasting && (
          <>
            <label htmlFor={`${id}-text`} className="ge-upload-label">
              {m['defense.upload.pasteLabel']}
            </label>
            <textarea id={`${id}-text`} className="ge-keyboard-field" rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} />
            <button type="button" className="ge-button" onClick={() => onPaste(pasted)}>
              {m['defense.upload.pasteUse']}
            </button>
          </>
        )}
      </div>
      {samples.length > 0 && (
        <div className="ge-upload-samples" role="group" aria-labelledby={`${id}-samples`}>
          <p id={`${id}-samples`} className="ge-upload-label">
            {m['defense.upload.samples']}
          </p>
          {samples.map((sample) => (
            <button key={sample.lang} type="button" className="ge-button" onClick={() => onSample?.(sample)}>
              {m[`defense.upload.sample.${sample.lang}`]}
            </button>
          ))}
        </div>
      )}
      <p className="ge-upload-error" aria-live="polite">
        {error && m[error]}
      </p>
    </section>
  );
}
