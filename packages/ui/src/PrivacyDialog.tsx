import { kitMessages, type Locale } from '@ghost-examiner/core';
import { useEffect, useId, useRef, type SyntheticEvent } from 'react';
import './tokens.css';
import './PrivacyDialog.css';

export interface PrivacyDialogProps {
  open: boolean;
  locale: Locale;
  /** `consent` before the first question (Accept, Not now); `read-only` from the header link (Close). */
  mode: 'consent' | 'read-only';
  onAccept: () => void;
  /** Esc, "Not now" or "Close". Never starts the session. */
  onDismiss: () => void;
}

const POINTS = ['privacy.local', 'privacy.noPersonalData', 'privacy.freeTier'] as const;

/**
 * Privacy notice (Req 10, design §5.1): a native <dialog> opened with showModal(), so the
 * browser makes the rest of the page inert and keeps focus inside (Req 10.3). Focus moves to the
 * heading so screen readers start at the top, and returns to the opener when it closes.
 * Controlled by `open`: the parent closes it after onAccept or onDismiss.
 */
export function PrivacyDialog({ open, locale, mode, onAccept, onDismiss }: PrivacyDialogProps) {
  const m = kitMessages[locale];
  const headingId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const closingByProp = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      headingRef.current?.focus();
    } else if (!open && dialog.open) {
      closingByProp.current = true;
      dialog.close();
      restoreFocus();
    }
  }, [open]);

  /** Back to the opener, unless the user has already moved focus somewhere else. */
  function restoreFocus() {
    const active = document.activeElement;
    const lost = !active || active === document.body || !!dialogRef.current?.contains(active);
    if (lost && opener.current?.isConnected) opener.current.focus();
    opener.current = null;
  }

  // Esc. The browser's own close is cancelled and the parent closes the dialog instead, so the
  // DOM never runs ahead of `open`. (Chromium fires `close` a moment later; a quick reopen in
  // between was dismissed again by that late event, found in the task 21 browser check.)
  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    if (!event.cancelable) return; // the browser will close it anyway; handleClose dismisses
    event.preventDefault();
    onDismiss();
  };

  // Fires after every close. It may arrive late, after the dialog was opened again.
  const handleClose = () => {
    if (closingByProp.current) closingByProp.current = false;
    else onDismiss(); // closed by the browser itself (a cancel that could not be cancelled)
    if (!dialogRef.current?.open) restoreFocus();
  };

  return (
    <dialog
      ref={dialogRef}
      className="ge-dialog"
      aria-labelledby={headingId}
      lang={locale}
      onCancel={handleCancel}
      onClose={handleClose}
    >
      <h2 id={headingId} ref={headingRef} tabIndex={-1} className="ge-dialog-heading">
        {m['privacy.title']}
      </h2>
      <p>{m['privacy.intro']}</p>
      <ul className="ge-dialog-points">
        {POINTS.map((key) => (
          <li key={key}>{m[key]}</li>
        ))}
      </ul>
      <div className="ge-dialog-actions">
        {mode === 'consent' ? (
          <>
            <button type="button" className="ge-button ge-button--primary" onClick={onAccept}>
              {m['privacy.accept']}
            </button>
            <button type="button" className="ge-button" onClick={onDismiss}>
              {m['privacy.notNow']}
            </button>
          </>
        ) : (
          <button type="button" className="ge-button ge-button--primary" onClick={onDismiss}>
            {m['privacy.close']}
          </button>
        )}
      </div>
    </dialog>
  );
}
