import { kitMessages, type KeyboardAdapter, type Locale } from '@ghost-examiner/core';
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import './tokens.css';
import './KeyboardInput.css';

export interface KeyboardInputProps {
  locale: Locale;
  /** The keyboard adapter's `submit` (it trims, and rejects empty text without emitting). */
  onSubmit: KeyboardAdapter['submit'];
  /** Prefilled text after Edit (Req 7.3). Read on mount; give the component a new `key` to reset it. */
  draft?: string;
}

/**
 * The typed answer (Req 6.2–6.4): a labeled textarea with paste allowed, a submit button, and
 * Ctrl+Enter / Cmd+Enter. Plain Enter adds a new line. An empty submit shows an inline error,
 * linked to the field and announced politely, and keeps focus in the field.
 */
export function KeyboardInput({ locale, onSubmit, draft = '' }: KeyboardInputProps) {
  const m = kitMessages[locale];
  const id = useId();
  const [text, setText] = useState(draft);
  const [empty, setEmpty] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const submit = () => {
    const result = onSubmit(text);
    if (result.ok) return;
    setEmpty(true);
    field.current?.focus();
  };

  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className="ge-keyboard-input" onSubmit={onFormSubmit} noValidate>
      <label htmlFor={id} className="ge-keyboard-label">
        {m['keyboard.label']}
      </label>
      <textarea
        id={id}
        ref={field}
        className="ge-keyboard-field"
        rows={4}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setEmpty(false);
        }}
        onKeyDown={onKeyDown}
        aria-describedby={empty ? `${hintId} ${errorId}` : hintId}
        aria-invalid={empty || undefined}
      />
      <p id={hintId} className="ge-keyboard-hint">
        {m['keyboard.hint']}
      </p>
      {/* Always present, so the error is announced when it appears. */}
      <div aria-live="polite">
        {empty && (
          <p id={errorId} className="ge-keyboard-error">
            {m['keyboard.empty']}
          </p>
        )}
      </div>
      <button type="submit" className="ge-button ge-button--primary">
        {m['keyboard.submit']}
      </button>
    </form>
  );
}
