import { useState } from "react";
import type { FormEvent } from "react";
import { MessageCircle } from "lucide-react";
import { isCharlotteEmail } from "@/lib/auth";
import { TERMS_SECTIONS } from "@/data/terms";
import { Modal } from "@/components/shared/Modal";
import shared from "@/components/shared/shared.module.css";
import s from "./login.module.css";

export function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8.1 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8.1 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C36.9 40.4 44 34.5 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

// ─── Google account chooser (mock) ──────────────────────────────────────────

export function GoogleChooser({
  agreed,
  onAgree,
  onClose,
  onContinue,
}: {
  agreed: boolean;
  onAgree: (v: boolean) => void;
  onClose: () => void;
  onContinue: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!isCharlotteEmail(email)) {
      setError("Choose the Google account associated with your @charlotte.edu email.");
      return;
    }
    if (!agreed) {
      setError("Please accept the Terms & Conditions to continue.");
      return;
    }
    onContinue(email);
  };

  return (
    <>
      <Modal
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        className={s.googleModal}
        ariaLabel="Sign in with Google"
      >
        <div className={s.googleLogo}>
          <GoogleG />
        </div>
        <h2 className={s.googleTitle}>Sign in with Google</h2>
        <p className={s.googleSub}>Use your UNC Charlotte account</p>
        <form onSubmit={submit} className={s.googleForm}>
          <input
            className={s.loginInput}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@charlotte.edu"
            autoFocus
          />
          <label
            className={s.loginTerms}
            style={{ justifyContent: "flex-start", textAlign: "left" }}
          >
            <input type="checkbox" checked={agreed} onChange={(e) => onAgree(e.target.checked)} />
            <span>
              I agree to the{" "}
              <button type="button" className={s.loginTermsLink} onClick={() => setTermsOpen(true)}>
                Terms &amp; Conditions
              </button>
            </span>
          </label>
          {error && <p className={shared.formError}>{error}</p>}
          <button type="submit" className={`${s.loginSubmit} ${shared.btnPrimary}`}>
            Continue
          </button>
        </form>
        <button type="button" className={s.googleBack} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={s.xDemoHint}
          onClick={() => {
            onAgree(true);
            setEmail("anna@charlotte.edu");
          }}
        >
          Demo account: anna@charlotte.edu
        </button>
      </Modal>

      {termsOpen && (
        <TermsModal
          accepted={agreed}
          onAccept={() => {
            onAgree(true);
            setTermsOpen(false);
          }}
          onClose={() => setTermsOpen(false)}
        />
      )}
    </>
  );
}

// ─── Terms & Conditions modal ───────────────────────────────────────────────

export function TermsModal({
  accepted,
  onAccept,
  onClose,
}: {
  accepted: boolean;
  onAccept: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className={s.termsModal}
      ariaLabel="Terms and conditions"
    >
      <div className={s.termsHeader}>
        <h2 className={s.googleTitle}>Terms &amp; Conditions</h2>
      </div>
      <div className={s.termsScroll}>
        {TERMS_SECTIONS.map((t, i) => (
          <div key={i} className={s.termsSection}>
            <h3>
              {i + 1}. {t.title}
            </h3>
            <p>{t.body}</p>
          </div>
        ))}
      </div>
      <div className={s.termsActions}>
        <button type="button" className={shared.btnGhost} onClick={onClose}>
          Decline
        </button>
        <button type="button" className={shared.btnPrimary} onClick={onAccept}>
          {accepted ? "Done" : "I Accept"}
        </button>
      </div>
    </Modal>
  );
}

// ─── Help & support modal ────────────────────────────────────────────────────

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className={s.helpModal}
      ariaLabel="Help and support"
    >
      <div className={s.termsHeader}>
        <MessageCircle size={20} className={s.termsIcon} />
        <h2 className={s.googleTitle}>Help &amp; Support</h2>
      </div>
      <p className={s.helpIntro}>
        Need a hand with listings, payments, or your account? Email our support team and we&rsquo;ll
        get back to you as soon as we can.
      </p>
      <div className={s.helpContact}>
        <p className={s.helpContactLabel}>Support contacts</p>
        <a className={s.helpContactLink} href="mailto:gmallang@charlotte.edu">
          gmallang@charlotte.edu
        </a>
        <a className={s.helpContactLink} href="mailto:ksaifeld@charlotte.edu">
          ksaifeld@charlotte.edu
        </a>
      </div>
      <div className={s.termsActions}>
        <button type="button" className={shared.btnPrimary} onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}
