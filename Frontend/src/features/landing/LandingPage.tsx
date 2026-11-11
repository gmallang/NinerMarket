import { useState } from "react";
import { LockKeyhole } from "lucide-react";
import ninerLogo from "@/assets/NinerMarket.png";
import { AuthCard } from "@/features/login/AuthCard";
import {
  HelpModal,
  PrivacyModal,
  TermsModal,
} from "@/features/login/AuthModals";
import type { AuthMode } from "@/features/public/PublicChrome";
import type { CurrentUser } from "@/lib/types";
import s from "./landing.module.css";

/**
 * Public login page, shared by /login and /about (the RequireAuth redirect
 * target). The marketplace itself stays gated: this page only renders the
 * branding and the existing AuthCard. It reads no marketplace data.
 */
export function LandingPage({ onAuthed }: { onAuthed: (user: CurrentUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className={s.page}>
      <main className={s.main}>
        <div className={s.layout}>
          <section className={s.brandPane} aria-labelledby="landing-title">
            <div className={s.wordmark}>
              <img src={ninerLogo} alt="" className={s.logo} />
              <span className={s.brandName}>NinerMarket</span>
            </div>

            <h1
              id="landing-title"
              className={s.headline}
              aria-label="Your Campus. Your People. Your Marketplace."
            >
              Your Campus.
              <br />
              <span className={s.headlineAccent}>Your People.</span>
              <br />
              Your Marketplace.
            </h1>

            <p className={s.description}>
              NinerMarket is a student-only marketplace for verified UNC Charlotte students. Buy
              and sell what you no longer need, ask campus for what you are looking for, and keep
              the community close to home.
            </p>

            <p className={s.accessNote}>
              <LockKeyhole size={14} aria-hidden="true" />
              A verified @charlotte.edu email is required to join.
            </p>
          </section>

          <section className={s.loginPane} aria-label="Log in or create an account">
            <AuthCard mode={mode} onModeChange={setMode} onAuthed={onAuthed} />
          </section>
        </div>
      </main>

      <footer className={s.footer}>
        <div className={s.footerInner}>
          <p className={s.disclaimer}>
            NinerMarket is an independent student project built by UNC Charlotte students. It is
            not officially affiliated with, endorsed by, or operated by UNC Charlotte.
          </p>
          <div className={s.footerActions}>
            <button type="button" className={s.footerLink} onClick={() => setPrivacyOpen(true)}>
              Privacy
            </button>
            <button type="button" className={s.footerLink} onClick={() => setTermsOpen(true)}>
              Terms
            </button>
            <button type="button" className={s.footerLink} onClick={() => setHelpOpen(true)}>
              Help
            </button>
            <span className={s.copyright}>© 2026 NinerMarket</span>
          </div>
        </div>
      </footer>

      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {termsOpen && (
        <TermsModal
          accepted
          onAccept={() => setTermsOpen(false)}
          onClose={() => setTermsOpen(false)}
        />
      )}
    </div>
  );
}
