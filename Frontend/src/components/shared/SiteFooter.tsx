import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { HelpModal, PrivacyModal, TermsModal } from "@/features/login/AuthModals";
import s from "./SiteFooter.module.css";

/**
 * The single footer used by every page: About, Privacy, Help, Terms and the
 * copyright line. Privacy, Help and Terms open in overlays - the same modals
 * the auth flow uses - so no page needs its own legal screen.
 */
export function SiteFooter({ note, className }: { note?: ReactNode; className?: string }) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <footer className={className ? `${s.footer} ${className}` : s.footer}>
      {note && <p className={s.note}>{note}</p>}

      <nav className={s.links} aria-label="About, privacy, help and terms">
        <Link to="/about" className={s.link}>
          About
        </Link>
        <button type="button" className={s.link} onClick={() => setPrivacyOpen(true)}>
          Privacy
        </button>
        <button type="button" className={s.link} onClick={() => setHelpOpen(true)}>
          Help
        </button>
        <button type="button" className={s.link} onClick={() => setTermsOpen(true)}>
          Terms
        </button>
        <span className={s.copy}>© 2026 NinerMarket</span>
      </nav>

      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {termsOpen && (
        <TermsModal
          accepted
          onAccept={() => setTermsOpen(false)}
          onClose={() => setTermsOpen(false)}
        />
      )}
    </footer>
  );
}
