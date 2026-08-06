import { useState } from "react";
import type { FormEvent } from "react";
import { ShieldCheck, ShoppingBag, MapPin, X } from "lucide-react";
import ninerLogo from "@/assets/NinerMarket.png";
import { PAYMENT_METHODS, SCHOOL_YEARS } from "@/lib/user";
import type { CurrentUser } from "@/lib/types";
import { isCharlotteEmail, signInOrUp } from "@/lib/auth";
import { GoogleChooser, GoogleG, TermsModal, HelpModal } from "./AuthModals";
import { Modal } from "@/components/shared/Modal";
import s from "./login.module.css";

// ─── Login page ─────────────────────────────────────────────────────────────

export function LoginPage({ onAuthed }: { onAuthed: (user: CurrentUser) => void }) {
  const [formOpen, setFormOpen] = useState<"signin" | "signup" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [googleOpen, setGoogleOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [schoolYear, setSchoolYear] = useState("");
  const [payments, setPayments] = useState<string[]>([]);
  const [error, setError] = useState("");

  const validate = (requirePassword: boolean): string => {
    if (!isCharlotteEmail(email)) {
      return "Access is restricted to the UNC Charlotte community. Use a valid @charlotte.edu email.";
    }
    if (requirePassword && !password.trim()) {
      return "Please enter your password.";
    }
    if (!agree) {
      return "Please accept the Terms & Conditions to continue.";
    }
    return "";
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const mode = formOpen === "signup" ? "signup" : "signin";
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (mode === "signup" && !schoolYear) {
      setError("Please select your school year.");
      return;
    }
    if (mode === "signup" && payments.length === 0) {
      setError("Select at least one payment method you accept.");
      return;
    }
    const err = validate(true);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    try {
      const u = await signInOrUp(mode, name, email, schoolYear, payments);
      onAuthed(u);
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const googleContinue = async (googleEmail: string) => {
    setEmail(googleEmail);
    const err = validate(false);
    if (err) {
      setError(err);
      setGoogleOpen(false);
      return;
    }
    setGoogleOpen(false);
    setError("");
    try {
      const u = await signInOrUp("signin", name, googleEmail);
      onAuthed(u);
    } catch {
      setError("Something went wrong. Please try again.");
    }
  };

  const forgotPassword = () => {
    setError(
      "Password reset isn't available in this demo. Use the demo account or sign in with Google."
    );
  };

  const fillDemo = () => {
    setFormOpen("signin");
    setEmail("anna@charlotte.edu");
    setPassword("ninermarket-demo");
    setAgree(true);
    setError("");
  };

  const openForm = (mode: "signin" | "signup") => {
    setError("");
    setFormOpen(mode);
  };

  return (
    <div className={s.xPage}>
      <div className={s.xMain}>
        {/* Left — light side with headline, logo, features & footer */}
        <div className={s.xLeft}>
          <h1 className={s.xHeadline}>More accessible than ever</h1>
          <div className={s.xLogo}>
            <img className={s.xLogoImg} src={ninerLogo} alt="NinerMarket" />
          </div>
          <ul className={s.xFeatures}>
            <li>
              <ShieldCheck size={16} /> Verified @charlotte.edu community
            </li>
            <li>
              <ShoppingBag size={16} /> Textbooks, dorm essentials &amp; more
            </li>
            <li>
              <MapPin size={16} /> Meet up on campus, pay your way
            </li>
          </ul>

          <footer className={s.xFooter}>
            <span>About</span>
            <span>·</span>
            <button type="button" className={s.xFooterLink} onClick={() => setHelpOpen(true)}>
              Help
            </button>
            <span>·</span>
            <button type="button" className={s.xFooterLink} onClick={() => setTermsOpen(true)}>
              Terms
            </button>
            <span>·</span>
            <span>Privacy</span>
            <span>·</span>
            <span>© 2026 NinerMarket</span>
          </footer>
        </div>

        {/* Right — light side with join panel */}
        <div className={s.xRight}>
          <div className={s.xCard}>
            <h2 className={s.xSubheadline}>Shop &amp; sell on campus</h2>

            <div className={s.xActions}>
              <button type="button" className={s.xSocialBtn} onClick={() => setGoogleOpen(true)}>
                <GoogleG />
                Continue with Google
              </button>
              <p className={s.xOnlyNote}>
                NinerMarket is for UNC Charlotte students, faculty &amp; staff only. Sign in with
                your @charlotte.edu Google account.
              </p>
              <button type="button" className={s.xEmailLink} onClick={() => openForm("signup")}>
                Sign up with your email instead
              </button>
              <label className={s.xTerms}>
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  By signing up, you agree to the{" "}
                  <button type="button" className={s.xTermsLink} onClick={() => setTermsOpen(true)}>
                    Terms &amp; Conditions
                  </button>
                  .
                </span>
              </label>
              {error && <p className={s.xError}>{error}</p>}
            </div>

            <div className={s.xSignInBox}>
              <p className={s.xSignInLabel}>Already have an account?</p>
              <button type="button" className={s.xSignInBtn} onClick={() => openForm("signin")}>
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sign-in / sign-up modal */}
      <Modal
        open={!!formOpen}
        onOpenChange={(open) => {
          if (!open) setFormOpen(null);
        }}
        ariaLabel={formOpen === "signup" ? "Create your account" : "Sign in"}
      >
        <div className={s.xModalHeader}>
          <button className={s.xModalClose} onClick={() => setFormOpen(null)} aria-label="Close">
            <X size={18} />
          </button>
          <img className={s.xModalLogo} src={ninerLogo} alt="NinerMarket" />
          <h2 className={s.xModalTitle}>
            {formOpen === "signup" ? "Create your account" : "Sign in to NinerMarket"}
          </h2>
        </div>
        <form onSubmit={submit} className={s.xForm}>
          {formOpen === "signup" && (
            <input
              className={s.xInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          )}
          <input
            className={s.xInput}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address (@charlotte.edu)"
          />
          {email && email.includes("@") && !isCharlotteEmail(email) && (
            <span className={s.xFieldError}>
              Must be a @charlotte.edu email to access NinerMarket.
            </span>
          )}
          <input
            className={s.xInput}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          {formOpen === "signup" && (
            <>
              <div className={s.xFormBlock}>
                <span className={s.xFormLabel}>What year are you in?</span>
                <select
                  className={s.xSelect}
                  value={schoolYear}
                  onChange={(e) => setSchoolYear(e.target.value)}
                >
                  <option value="">Select your year</option>
                  {SCHOOL_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
              <div className={s.xFormBlock}>
                <span className={s.xFormLabel}>Payment methods you accept</span>
                <div className={s.xPayments}>
                  {PAYMENT_METHODS.map((p) => (
                    <label key={p} className={s.xPay}>
                      <input
                        type="checkbox"
                        checked={payments.includes(p)}
                        onChange={() =>
                          setPayments((prev) =>
                            prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
                          )
                        }
                      />
                      <span>{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
          {formOpen === "signin" && (
            <button type="button" className={s.xForgot} onClick={forgotPassword}>
              Forgot password?
            </button>
          )}
          <label className={s.xTerms}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>
              I agree to the{" "}
              <button type="button" className={s.xTermsLink} onClick={() => setTermsOpen(true)}>
                Terms &amp; Conditions
              </button>
              .
            </span>
          </label>
          {error && <p className={s.xError}>{error}</p>}
          <button type="submit" className={s.xSubmitBtn}>
            {formOpen === "signup" ? "Sign up" : "Log in"}
          </button>
          {formOpen === "signin" && (
            <button type="button" className={s.xDemoHint} onClick={fillDemo}>
              Demo account: anna@charlotte.edu
            </button>
          )}
        </form>
      </Modal>

      {googleOpen && (
        <GoogleChooser
          agreed={agree}
          onAgree={setAgree}
          onClose={() => setGoogleOpen(false)}
          onContinue={googleContinue}
        />
      )}

      {termsOpen && (
        <TermsModal
          accepted={agree}
          onAccept={() => {
            setAgree(true);
            setTermsOpen(false);
          }}
          onClose={() => setTermsOpen(false)}
        />
      )}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
