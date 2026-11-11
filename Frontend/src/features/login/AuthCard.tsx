import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Capacitor } from "@capacitor/core";
import { Eye, EyeOff, X } from "lucide-react";
import type { AuthMode } from "@/features/public/PublicChrome";
import type { CurrentUser } from "@/lib/types";
import {
  isCharlotteEmail,
  loadSessionUser,
  localSignIn,
  nameFromEmail,
  signInWithGoogle,
  signInWithGoogleToken,
  signin,
  signup,
  verifyEmail,
} from "@/lib/auth";
import { API_BASE_URL, api, getToken, setToken } from "@/lib/api";
import { GoogleChooser, GoogleG, TermsModal } from "./AuthModals";
import { Modal } from "@/components/shared/Modal";
import s from "./login.module.css";

const IS_MOBILE =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(pointer: coarse)").matches ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

/**
 * The card that floats over the hero photo on /login and /about. It holds the
 * whole email/Google/password flow; only the surrounding page changes.
 */
export function AuthCard({
  mode,
  onModeChange,
  onAuthed,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onAuthed: (user: CurrentUser) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [googleOpen, setGoogleOpen] = useState(false);
  // Errors are tagged with the mode they belong to, so switching between
  // "create account" and "log in" does not carry a stale message across.
  const [errorState, setErrorState] = useState<{ mode: AuthMode | null; message: string }>({
    mode: null,
    message: "",
  });
  const error = errorState.mode === null || errorState.mode === mode ? errorState.message : "";
  // Stable setter (the Google and redirect effects depend on it) that tags the
  // message with the mode showing at the time it was raised.
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const setError = useCallback(
    (message: string) => setErrorState({ mode: message ? modeRef.current : null, message }),
    []
  );
  const [verifying, setVerifying] = useState(false);
  const [verifyEmailAddress, setVerifyEmailAddress] = useState("");
  const [code, setCode] = useState("");
  const [setPwdOpen, setSetPwdOpen] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [pendingUser, setPendingUser] = useState<CurrentUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPwd, setForgotNewPwd] = useState("");
  const [forgotConfirmPwd, setForgotConfirmPwd] = useState("");
  const [forgotStep, setForgotStep] = useState<"email" | "reset">("email");
  const [forgotError, setForgotError] = useState("");
  const [forgotSending, setForgotSending] = useState(false);

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
    let resizeTimer: number | undefined;
    let stopResize: (() => void) | undefined;

    const mount = () => {
      const gid = window.google?.accounts?.id;
      if (!gid || cancelled || !googleButtonRef.current) return;
      gid.initialize({
        client_id: GOOGLE_CLIENT_ID,
        hd: "charlotte.edu",
        ux_mode: IS_MOBILE ? "redirect" : "popup",
        login_uri: IS_MOBILE
          ? `${API_BASE_URL}/users/google/callback${Capacitor.isNativePlatform() ? "?target=app" : ""}`
          : undefined,
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
      // Google draws a fixed-width iframe at exactly the width we pass, so
      // measure the slot instead of stretching the iframe with CSS (which
      // leaves the button artwork sitting off-center in a wider frame).
      const draw = () => {
        const slot = googleButtonRef.current;
        if (!slot || cancelled) return;
        const measured = Math.floor(slot.getBoundingClientRect().width);
        slot.replaceChildren();
        gid.renderButton(slot, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          width: Math.min(400, Math.max(200, measured || 328)),
        });
      };
      draw();
      const handleResize = () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(draw, 150);
      };
      window.addEventListener("resize", handleResize);
      stopResize = () => window.removeEventListener("resize", handleResize);
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
      window.clearTimeout(resizeTimer);
      stopResize?.();
    };
  }, [GOOGLE_CLIENT_ID, setError]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const token = params.get("nm_token");
    const error = params.get("nm_error");
    if (!token && !error) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    let cancelled = false;
    (async () => {
      if (error) {
        setError("Google sign-in failed. Please try again.");
        return;
      }
      try {
        setToken(token ?? "");
        if (getToken() !== token) {
          // Some mobile browsers briefly restrict storage writes right after
          // a cross-origin redirect (Google -> our API -> here). One retry
          // a beat later is enough to clear that window.
          await new Promise((resolve) => window.setTimeout(resolve, 100));
          setToken(token ?? "");
        }
        const u = await loadSessionUser();
        if (cancelled) return;
        if (!u.has_password) {
          setPendingToken("");
          setPendingUser(u);
          setNewPassword("");
          setConfirmPassword("");
          setPwdError("");
          setSetPwdOpen(true);
        } else {
          authedRef.current(u);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Google sign-in failed. Please try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setError]);

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
    setVerifying(true);
    setError("");
    try {
      await api.resendCode(targetEmail.trim().toLowerCase());
    } catch {
      // the code from signup is still usable; verify step will surface errors
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "signup" && !name.trim()) {
      setError("Please enter your full name.");
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
        const res = await signup(name, email, password, "", []);
        if (res.needsVerification) {
          setVerifyEmailAddress(email.trim().toLowerCase());
          setCode("");
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
      await api.resendCode(verifyEmailAddress);
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

  const openForgot = () => {
    setForgotEmail(email.trim().toLowerCase());
    setForgotCode("");
    setForgotNewPwd("");
    setForgotConfirmPwd("");
    setForgotError("");
    setForgotStep("email");
    setForgotOpen(true);
  };

  const sendResetCode = async (target: string) => {
    setForgotError("");
    setForgotSending(true);
    try {
      await api.forgotPassword(target.trim().toLowerCase());
      setForgotCode("");
      setForgotStep("reset");
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Couldn't send a reset code.");
    } finally {
      setForgotSending(false);
    }
  };

  const requestResetCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!isCharlotteEmail(forgotEmail)) {
      setForgotError("Enter your @charlotte.edu email to reset your password.");
      return;
    }
    setForgotError("");
    await sendResetCode(forgotEmail);
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    if (forgotNewPwd.length < 8) {
      setForgotError("Password must be at least 8 characters.");
      return;
    }
    if (forgotNewPwd !== forgotConfirmPwd) {
      setForgotError("Passwords do not match.");
      return;
    }
    setForgotError("");
    setForgotSending(true);
    try {
      await api.resetPassword(forgotEmail.trim().toLowerCase(), forgotCode.trim(), forgotNewPwd);
      setForgotOpen(false);
      // Pre-fill the email on the sign-in form so they can log straight in.
      setEmail(forgotEmail.trim().toLowerCase());
      setPassword("");
      onModeChange("signin");
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Couldn't reset your password.");
    } finally {
      setForgotSending(false);
    }
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
      const u = await api.setPassword(newPassword, pendingToken || undefined);
      setSetPwdOpen(false);
      authedRef.current(u);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/authorization|session/i.test(message)) {
        setPwdError("Your session expired before we could save that. Please sign in again.");
      } else {
        setPwdError(message || "Couldn't set the password.");
      }
    } finally {
      setPwdSaving(false);
    }
  };

  const skipSetPwd = () => {
    setSetPwdOpen(false);
    if (pendingUser) authedRef.current(pendingUser);
  };

  const emailTyped = email.includes("@") && !isCharlotteEmail(email);

  return (
    <div className={s.card}>
      <h2 className={s.cardTitle}>
        {verifying
          ? "Verify your email"
          : mode === "signup"
            ? "Create your account"
            : "Log in to NinerMarket"}
      </h2>
      <p className={s.cardSub}>
        {verifying
          ? "Enter the code we sent to your Niner email."
          : mode === "signup"
            ? "Join your campus community."
            : "Welcome back"}
      </p>

      {verifying ? (
        <form onSubmit={verifySubmit} className={s.cardForm}>
          <p className={s.xVerifyNote}>
            We emailed a 6-digit code to <strong>{verifyEmailAddress}</strong>. Enter it below to
            verify your account.
          </p>
          <p className={s.xSpamNote}>
            Don&apos;t see it? Check your <strong>spam/junk folder</strong>. Still nothing after a
            minute? Resend below.
          </p>
          <input
            className={s.input}
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="6-digit code"
            aria-label="6-digit verification code"
            autoFocus
          />
          {error && <p className={s.error}>{error}</p>}
          <button type="submit" className={s.submitBtn}>
            Verify email
          </button>
          <div className={s.auxRow}>
            <button type="button" className={s.auxLink} onClick={resend}>
              Resend code
            </button>
            <button type="button" className={s.auxLink} onClick={() => setVerifying(false)}>
              Back
            </button>
          </div>
        </form>
      ) : (
        <>
          <form onSubmit={submit} className={s.cardForm}>
            {mode === "signup" && (
              <input
                className={s.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                aria-label="Full name"
                autoComplete="name"
              />
            )}
            <input
              className={s.input}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address (@charlotte.edu)"
              aria-label="Email address"
              autoComplete="email"
            />
            {emailTyped && (
              <span className={s.fieldError}>
                Must be a @charlotte.edu email to access NinerMarket.
              </span>
            )}
            <div className={s.pwdWrap}>
              <input
                className={s.input}
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                aria-label="Password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              <button
                type="button"
                className={s.pwdToggle}
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {mode === "signin" && (
              <button type="button" className={s.forgot} onClick={openForgot}>
                Forgot password?
              </button>
            )}
            <label className={s.terms}>
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => {
                  setAgree(e.target.checked);
                  if (e.target.checked) setError("");
                }}
              />
              <span>
                I agree to the{" "}
                <button type="button" className={s.termsLink} onClick={() => setTermsOpen(true)}>
                  Terms &amp; Conditions
                </button>
                .
              </span>
            </label>
            {error && <p className={s.error}>{error}</p>}
            <button type="submit" className={s.submitBtn} disabled={!agree}>
              {mode === "signup" ? "Create account" : "Log in"}
            </button>
          </form>

          <div className={s.or}>
            <span>or</span>
          </div>

          {GOOGLE_CLIENT_ID ? (
            <div ref={googleButtonRef} className={s.googleSlot} />
          ) : (
            <button
              type="button"
              className={s.googleBtn}
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

          <p className={s.onlyNote}>
            For UNC Charlotte students, faculty &amp; staff. Use your @charlotte.edu email to sign
            in.
          </p>

          {mode === "signup" ? (
            <p className={s.switchRow}>
              Already have an account?{" "}
              <button type="button" className={s.switchLink} onClick={() => onModeChange("signin")}>
                Log in
              </button>
            </p>
          ) : (
            <div className={s.accountRow}>
              <button
                type="button"
                className={s.createAccountBtn}
                onClick={() => onModeChange("signup")}
              >
                Create new account
              </button>
            </div>
          )}
        </>
      )}

      <Modal
        open={setPwdOpen}
        onOpenChange={(open) => {
          if (!open) skipSetPwd();
        }}
        ariaLabel="Set a password"
        foreground
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

      <Modal
        open={forgotOpen}
        onOpenChange={(open) => !open && setForgotOpen(false)}
        ariaLabel="Reset your password"
        foreground
      >
        <div className={s.xModalHeader}>
          <button className={s.xModalClose} onClick={() => setForgotOpen(false)} aria-label="Close">
            <X size={18} />
          </button>
          <h2 className={s.xModalTitle}>Reset your password</h2>
        </div>
        {forgotStep === "email" ? (
          <form onSubmit={requestResetCode} className={s.xForm}>
            <p className={s.xVerifyNote}>
              Enter your @charlotte.edu email and we&rsquo;ll send you a 6-digit reset code.
            </p>
            <input
              className={s.xInput}
              type="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="you@charlotte.edu"
              aria-label="Email address to reset"
              autoFocus
            />
            {forgotError && <p className={s.xError}>{forgotError}</p>}
            <button type="submit" className={s.xSubmitBtn} disabled={forgotSending}>
              {forgotSending ? "Sending…" : "Send reset code"}
            </button>
            <button type="button" className={s.xDemoHint} onClick={() => setForgotOpen(false)}>
              Back to sign in
            </button>
          </form>
        ) : (
          <form onSubmit={submitReset} className={s.xForm}>
            <p className={s.xVerifyNote}>
              We emailed a 6-digit code to <strong>{forgotEmail}</strong>.
            </p>
            <p className={s.xSpamNote}>
              Don&apos;t see it? Check your <strong>spam/junk folder</strong>. The code expires in
              15 minutes.
            </p>
            <input
              className={s.xInput}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={forgotCode}
              onChange={(e) => setForgotCode(e.target.value.replace(/\D/g, ""))}
              placeholder="6-digit code"
              aria-label="6-digit reset code"
              autoFocus
            />
            <div className={s.xPasswordWrap}>
              <input
                className={s.xInput}
                type="password"
                value={forgotNewPwd}
                onChange={(e) => setForgotNewPwd(e.target.value)}
                placeholder="New password (min 8 characters)"
                aria-label="New password"
              />
            </div>
            <div className={s.xPasswordWrap}>
              <input
                className={s.xInput}
                type="password"
                value={forgotConfirmPwd}
                onChange={(e) => setForgotConfirmPwd(e.target.value)}
                placeholder="Confirm new password"
                aria-label="Confirm new password"
              />
            </div>
            {forgotError && <p className={s.xError}>{forgotError}</p>}
            <button type="submit" className={s.xSubmitBtn} disabled={forgotSending}>
              {forgotSending ? "Resetting…" : "Reset password"}
            </button>
            <button
              type="button"
              className={s.xDemoHint}
              onClick={() => sendResetCode(forgotEmail)}
            >
              Resend code
            </button>
          </form>
        )}
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
    </div>
  );
}
