import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, ShoppingBag, MapPin, X, ChevronDown, Eye, EyeOff } from "lucide-react";
import ninerLogo from "@/assets/NinerMarket.png";
import { SCHOOL_YEARS } from "@/lib/user";
import type { CurrentUser } from "@/lib/types";
import {
  isCharlotteEmail,
  localSignIn,
  nameFromEmail,
  signInWithGoogle,
  signInWithGoogleToken,
  signin,
  signup,
  verifyEmail,
} from "@/lib/auth";
import { api } from "@/lib/api";
import { GoogleChooser, GoogleG, TermsModal, HelpModal } from "./AuthModals";
import { Modal } from "@/components/shared/Modal";
import s from "./login.module.css";

// ─── Login page ─────────────────────────────────────────────────────────────

export function LoginPage({ onAuthed }: { onAuthed: (user: CurrentUser) => void }) {
  const [formOpen, setFormOpen] = useState<"signin" | "signup" | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [googleOpen, setGoogleOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [schoolYear, setSchoolYear] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyEmailAddress, setVerifyEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [setPwdOpen, setSetPwdOpen] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [pendingUser, setPendingUser] = useState<CurrentUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  const [agree, setAgreeState] = useState(() => {
    try {
      return sessionStorage.getItem("nm-terms-agreed") === "1";
    } catch {
      return false;
    }
  });
  const setAgree = (value: boolean) => {
    setAgreeState(value);
    try {
      sessionStorage.setItem("nm-terms-agreed", value ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  };

  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const agreeRef = useRef(agree);
  const authedRef = useRef(onAuthed);
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    agreeRef.current = agree;
  }, [agree]);

  useEffect(() => {
    authedRef.current = onAuthed;
  }, [onAuthed]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    let cancelled = false;

    const mount = () => {
      const gid = window.google?.accounts?.id;
      if (!gid || cancelled || !googleButtonRef.current) return;
      gid.initialize({
        client_id: GOOGLE_CLIENT_ID,
        hd: "charlotte.edu",
        callback: async (resp) => {
          if (!resp.credential) return;
          if (!agreeRef.current) {
            setError("Please accept the Terms & Conditions to continue.");
            return;
          }
          setError("");
          try {
            const u = await signInWithGoogleToken(resp.credential);
            if (!u.has_password) {
              setPendingToken(resp.credential);
              setPendingUser(u);
              setNewPassword("");
              setConfirmPassword("");
              setPwdError("");
              setSetPwdOpen(true);
            } else {
              authedRef.current(u);
            }
          } catch (e) {
            setError(e instanceof Error ? e.message : "Google sign-in failed. Please try again.");
          }
        },
      });
      gid.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 360,
      });
    };

    if (window.google?.accounts?.id) {
      mount();
    } else {
      const tick = () => {
        if (cancelled) return;
        if (window.google?.accounts?.id) {
          mount();
        } else {
          window.setTimeout(tick, 100);
        }
      };
      tick();
    }

    return () => {
      cancelled = true;
    };
  }, [GOOGLE_CLIENT_ID]);

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

  const startVerify = async (targetEmail: string) => {
    setVerifyEmailAddress(targetEmail.trim().toLowerCase());
    setCode("");
    setDevCode("");
    setVerifying(true);
    setError("");
    try {
      const res = await api.resendCode(targetEmail.trim().toLowerCase());
      setDevCode(res.dev_code ?? "");
    } catch {
      // the code from signup is still usable; verify step will surface errors
    }
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
    if (mode === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    const err = validate(true);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    try {
      if (mode === "signup") {
        const res = await signup(name, email, password, schoolYear, []);
        if (res.needsVerification) {
          setVerifyEmailAddress(email.trim().toLowerCase());
          setCode("");
          setDevCode(res.devCode ?? "");
          setVerifying(true);
          return;
        }
        onAuthed(res.user);
      } else {
        const u = await signin(email, password);
        onAuthed(u);
      }
    } catch (e) {
      if (e instanceof TypeError) {
        onAuthed(localSignIn(email, nameFromEmail(email)));
        return;
      }
      const message = e instanceof Error ? e.message : "";
      if (message.includes("not verified")) {
        await startVerify(email);
        return;
      }
      setError(message || "Something went wrong. Please try again.");
    }
  };

  const verifySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setError("");
    try {
      const u = await verifyEmail(verifyEmailAddress, code);
      onAuthed(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid or expired code.");
    }
  };

  const resend = async () => {
    setError("");
    try {
      const res = await api.resendCode(verifyEmailAddress);
      setDevCode(res.dev_code ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't resend the code.");
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
      const u = await signInWithGoogle(googleEmail);
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

  const setPwdSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPwdError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError("Passwords do not match.");
      return;
    }
    setPwdError("");
    setPwdSaving(true);
    try {
      const u = await api.setPassword(pendingToken, newPassword);
      setSetPwdOpen(false);
      authedRef.current(u);
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : "Couldn't set the password.");
    } finally {
      setPwdSaving(false);
    }
  };

  const skipSetPwd = () => {
    setSetPwdOpen(false);
    if (pendingUser) authedRef.current(pendingUser);
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
    setVerifying(false);
    setCode("");
    setDevCode("");
    setFormOpen(mode);
  };

  const closeForm = () => {
    setFormOpen(null);
    setVerifying(false);
    setCode("");
    setDevCode("");
    setError("");
  };

  return (
    <div className={s.xPage}>
      <div className={s.xMain}>
        {/* Left — light side with headline, logo, features & footer */}
        <div className={s.xLeft}>
          <h1 className={s.xHeadline}>Your campus marketplace</h1>
          <div className={s.xLogo}>
            <img className={s.xLogoImg} src={ninerLogo} alt="NinerMarket" />
            <span className={s.xLogoName}>NinerMarket</span>
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
        </div>

        {/* Right — light side with join panel */}
        <div className={s.xRight}>
          <div className={s.xCard}>
            <h2 className={s.xSubheadline}>Shop &amp; sell on campus</h2>

            <div className={s.xActions}>
              {GOOGLE_CLIENT_ID ? (
                <div ref={googleButtonRef} className={s.xGoogleBtn} />
              ) : (
                <button
                  type="button"
                  className={s.xSocialBtn}
                  onClick={() => {
                    if (!agree) {
                      setError("Please accept the Terms & Conditions to continue.");
                      return;
                    }
                    setGoogleOpen(true);
                  }}
                >
                  <GoogleG />
                  Continue with Google
                </button>
              )}
              <p className={s.xOnlyNote}>
                NinerMarket is for UNC Charlotte students, faculty &amp; staff only. Sign in with
                your @charlotte.edu Google account.
              </p>
              <label className={s.xTerms}>
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => {
                    setAgree(e.target.checked);
                    if (e.target.checked) setError("");
                  }}
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

            <hr className={s.xDivider} />

            <div className={s.xSignInBox}>
              <button type="button" className={s.xEmailLink} onClick={() => openForm("signup")}>
                Sign up with your @charlotte.edu email instead
              </button>
              <p className={s.xSignInLabel}>Already have an account?</p>
              <button type="button" className={s.xSignInBtn} onClick={() => openForm("signin")}>
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer className={s.xFooter}>
        <Link to="/about" className={s.xFooterLink}>
          About
        </Link>
        <span>·</span>
        <Link to="/privacy" className={s.xFooterLink}>
          Privacy
        </Link>
        <span>·</span>
        <button type="button" className={s.xFooterLink} onClick={() => setHelpOpen(true)}>
          Help
        </button>
        <span>·</span>
        <button type="button" className={s.xFooterLink} onClick={() => setTermsOpen(true)}>
          Terms
        </button>
        <span>·</span>
        <span>© 2026 NinerMarket</span>
      </footer>

      {/* Sign-in / sign-up modal */}
      <Modal
        open={!!formOpen}
        onOpenChange={(open) => {
          if (!open) closeForm();
        }}
        ariaLabel={verifying ? "Verify your email" : formOpen === "signup" ? "Create your account" : "Sign in"}
      >
        <div className={s.xModalHeader}>
          <button className={s.xModalClose} onClick={closeForm} aria-label="Close">
            <X size={18} />
          </button>
          {formOpen !== "signup" && (
            <img className={s.xModalLogo} src={ninerLogo} alt="NinerMarket" />
          )}
          <h2 className={s.xModalTitle}>
            {verifying
              ? "Verify your email"
              : formOpen === "signup"
                ? "Create your account"
                : "Sign in to NinerMarket"}
          </h2>
        </div>
        {verifying ? (
          <form onSubmit={verifySubmit} className={s.xForm}>
            <p className={s.xVerifyNote}>
              We emailed a 6-digit code to{" "}
              <strong>{verifyEmailAddress}</strong>. Enter it below to verify your account.
            </p>
            {devCode && (
              <p className={s.xDevCode}>
                DEV MODE — no email key set, use code: <strong>{devCode}</strong>
              </p>
            )}
            <input
              className={s.xInput}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              autoFocus
            />
            {error && <p className={s.xError}>{error}</p>}
            <button type="submit" className={s.xSubmitBtn}>
              Verify email
            </button>
            <button type="button" className={s.xDemoHint} onClick={resend}>
              Resend code
            </button>
            <button type="button" className={s.xDemoHint} onClick={() => setVerifying(false)}>
              Back to sign in
            </button>
          </form>
        ) : (
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
          <div className={s.xPasswordWrap}>
            <input
              className={s.xInput}
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <button
              type="button"
              className={s.xPwdToggle}
              onClick={() => setShowPwd((v) => !v)}
              aria-label={showPwd ? "Hide password" : "Show password"}
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {formOpen === "signup" && (
            <div className={s.xFormBlock}>
              <label className={s.xFormLabel} htmlFor="school-year">
                School year
              </label>
              <div className={s.xSelectWrap}>
                <select
                  id="school-year"
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
                <ChevronDown size={16} className={s.xSelectIcon} />
              </div>
            </div>
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
          <button type="submit" className={s.xSubmitBtn} disabled={!agree}>
            {formOpen === "signup" ? "Sign up" : "Log in"}
          </button>
          {formOpen === "signin" && (
            <button type="button" className={s.xDemoHint} onClick={fillDemo}>
              Demo account: anna@charlotte.edu
            </button>
          )}
          </form>
        )}
      </Modal>

      <Modal
        open={setPwdOpen}
        onOpenChange={(open) => {
          if (!open) skipSetPwd();
        }}
        ariaLabel="Set a password"
      >
        <div className={s.xModalHeader}>
          <h2 className={s.xModalTitle}>Set a password</h2>
        </div>
        <form onSubmit={setPwdSubmit} className={s.xForm}>
          <p className={s.xVerifyNote}>
            Signed in with Google as <strong>{pendingUser?.email}</strong>. Set a password to also
            sign in with your email in the future.
          </p>
          <div className={s.xPasswordWrap}>
            <input
              className={s.xInput}
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              autoFocus
            />
          </div>
          <div className={s.xPasswordWrap}>
            <input
              className={s.xInput}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
            />
          </div>
          {pwdError && <p className={s.xError}>{pwdError}</p>}
          <button type="submit" className={s.xSubmitBtn} disabled={pwdSaving}>
            {pwdSaving ? "Saving…" : "Set password"}
          </button>
          <button type="button" className={s.xDemoHint} onClick={skipSetPwd}>
            Skip for now
          </button>
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
