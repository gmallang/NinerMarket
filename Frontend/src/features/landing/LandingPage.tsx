import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  Megaphone,
  Users,
  X,
} from "lucide-react";
import ninerLogo from "@/assets/NinerMarket.png";
import { CATEGORIES } from "@/data/categories";
import { ListingCard } from "@/features/listings/ListingCard";
import { LandingPreview } from "./LandingPreview";
import { fromDto } from "@/lib/listings";
import { SCHOOL_YEARS } from "@/lib/user";
import type { CurrentUser, Listing, WantedRequestDto } from "@/lib/types";
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
import { GoogleChooser, GoogleG, TermsModal, HelpModal } from "@/features/login/AuthModals";
import { Modal } from "@/components/shared/Modal";
import { SiteFooter } from "@/components/shared/SiteFooter";
import s from "@/features/login/login.module.css";
import l from "./landing.module.css";

/** "$40 – $60", "Up to $35", … for the Looking For preview. */
function budgetLabel(request: WantedRequestDto): string {
  if (request.budget_min != null && request.budget_max != null) {
    return `$${request.budget_min} – $${request.budget_max}`;
  }
  if (request.budget_max != null) return `Up to $${request.budget_max}`;
  if (request.budget_min != null) return `From $${request.budget_min}`;
  return "Open budget";
}

// ─── Login page ─────────────────────────────────────────────────────────────

const IS_MOBILE =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(pointer: coarse)").matches ||
    navigator.maxTouchPoints > 0 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

export function LandingPage({ onAuthed }: { onAuthed: (user: CurrentUser) => void }) {
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
  const [setPwdOpen, setSetPwdOpen] = useState(false);
  const [pendingToken, setPendingToken] = useState("");
  const [pendingUser, setPendingUser] = useState<CurrentUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwdError, setPwdError] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  // Public landing page: the sign-in panel opens as a modal from the CTAs,
  // and the page previews a few real listings and requests.
  const [joinOpen, setJoinOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [featured, setFeatured] = useState<Listing[]>([]);
  const [featuredTotal, setFeaturedTotal] = useState<number | null>(null);
  const [requests, setRequests] = useState<WantedRequestDto[]>([]);
  const [requestTotal, setRequestTotal] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listListings({ limit: 4, sort: "recent" })
      .then(({ items, total }) => {
        if (!alive) return;
        setFeatured(items.map(fromDto));
        setFeaturedTotal(total ?? null);
      })
      .catch(() => {
        // The preview is decorative - the page still reads fine without it.
      });
    api
      .listRequests({ status: "active", limit: 3 })
      .then(({ items, total }) => {
        if (!alive) return;
        setRequests(items);
        setRequestTotal(total ?? null);
      })
      .catch(() => {
        // Same as above.
      });
    return () => {
      alive = false;
    };
  }, []);

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
  const googleRenderedRef = useRef<HTMLDivElement | null>(null);

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
      const node = googleButtonRef.current;
      // The button's container only exists while the join modal is open, so
      // skip (and keep polling) until it is in the DOM. Rendering twice into
      // the same node would stack two buttons.
      if (!gid || cancelled || !node || googleRenderedRef.current === node) return;
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
      gid.renderButton(node, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 360,
      });
      googleRenderedRef.current = node;
    };

    const tick = () => {
      if (cancelled) return;
      if (window.google?.accounts?.id && googleButtonRef.current) {
        mount();
      } else {
        window.setTimeout(tick, 100);
      }
    };
    tick();

    return () => {
      cancelled = true;
    };
    // Re-runs when the join panel opens: Google renders into a container that
    // only exists while the modal is mounted.
  }, [GOOGLE_CLIENT_ID, joinOpen]);

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
  }, []);

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
    const mode = formOpen === "signup" ? "signup" : "signin";
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
        const res = await signup(name, email, password, schoolYear, []);
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

  const forgotPassword = () => {
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
      if (formOpen !== "signin") openForm("signin");
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

  const openForm = (mode: "signin" | "signup") => {
    setError("");
    setVerifying(false);
    setCode("");
    setJoinOpen(false);
    setFormOpen(mode);
  };

  const closeForm = () => {
    setFormOpen(null);
    setVerifying(false);
    setCode("");
    setError("");
  };

  return (
    <div className={l.page}>
      <header className={l.nav}>
        <div className={l.navInner}>
          <Link to="/" className={l.brand} aria-label="NinerMarket home">
            <img className={l.brandImg} src={ninerLogo} alt="" />
            <span className={l.brandName}>NinerMarket</span>
          </Link>

          <nav className={l.navLinks} aria-label="Main">
            <div className={l.browseWrap}>
              <button
                type="button"
                className={l.browseBtn}
                aria-expanded={browseOpen}
                aria-haspopup="true"
                onClick={() => setBrowseOpen((open) => !open)}
              >
                Browse
                <ChevronDown size={15} className={browseOpen ? l.browseChevronOpen : undefined} />
              </button>
              {browseOpen && (
                <div className={l.browseMenu} role="menu">
                  {CATEGORIES.filter((category) => category.id !== "all").map((category) => {
                    const Icon = category.icon;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        role="menuitem"
                        className={l.browseItem}
                        onClick={() => {
                          setBrowseOpen(false);
                          openForm("signin");
                        }}
                      >
                        <Icon size={15} />
                        {category.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <Link to="/about" className={l.navLink}>
              About
            </Link>
            <button type="button" className={l.navLink} onClick={() => setHelpOpen(true)}>
              Contact
            </button>
            <button type="button" className={l.navCta} onClick={() => setJoinOpen(true)}>
              Sign Up / Log In
            </button>
          </nav>
        </div>
      </header>

      <section className={l.hero}>
        <div className={l.heroInner}>
          <div className={l.heroCopy}>
            <h1 className={l.heroTitle}>
              Your campus.
              <span className={l.heroGold}>Your marketplace.</span>
            </h1>
            <p className={l.heroTagline}>Buy local. Sell local. Find your next deal.</p>
            <p className={l.heroBody}>
              Discover textbooks, dorm essentials, electronics, furniture, and more from fellow UNC
              Charlotte students.
            </p>
            <div className={l.heroActions}>
              <button
                type="button"
                className={`${l.btn} ${l.btnGold}`}
                onClick={() => setJoinOpen(true)}
              >
                Explore Marketplace <ArrowRight size={16} />
              </button>
              <button
                type="button"
                className={`${l.btn} ${l.btnOutline}`}
                onClick={() => openForm("signup")}
              >
                Create an Account
              </button>
            </div>
          </div>

          <LandingPreview />
        </div>
      </section>

      <div className={l.container}>
        <section className={l.marketRow}>
          <div className={l.recentCol}>
            <div className={l.recentHead}>
              <div>
                <h2 className={l.recentTitle}>Recently Listed</h2>
                <p className={l.recentSub}>Browse items fellow Niners are selling.</p>
              </div>
              <button type="button" className={l.viewAll} onClick={() => setJoinOpen(true)}>
                View all →
              </button>
            </div>
            <div className={l.recentGrid}>
              {featured.map((item) => (
                <ListingCard
                  key={item.id}
                  item={item}
                  saved={false}
                  onToggleSave={() => setJoinOpen(true)}
                  onOpen={() => setJoinOpen(true)}
                />
              ))}
            </div>
          </div>

          <aside className={l.lookingCol}>
            <h2 className={l.lookingTitle}>
              <Megaphone size={19} /> Looking For?
            </h2>
            <p className={l.lookingSub}>Help fellow Niners find what they need.</p>
            <ul className={l.reqList}>
              {requests.map((request) => (
                <li key={request.id} className={l.reqRow}>
                  <span className={l.reqIcon}>
                    <Lock size={15} />
                  </span>
                  <div className={l.reqBody}>
                    <span className={l.reqTitle}>{request.title}</span>
                    <span className={l.reqBudget}>{budgetLabel(request)}</span>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className={l.browseAll} onClick={() => setJoinOpen(true)}>
              Browse all requests <ArrowRight size={15} />
            </button>
          </aside>
        </section>

        <section className={l.steps}>
          <h2 className={l.stepsTitle}>Buy. Sell. Connect.</h2>
          <p className={l.stepsSub}>Getting started is easy.</p>
          <ol className={l.stepList}>
            {[
              { title: "Browse", desc: "Find what you need or search for requests." },
              { title: "Connect", desc: "Message and coordinate with other Niners." },
              { title: "Complete", desc: "Meet up and make a deal!" },
            ].map((step, index) => (
              <li key={step.title} className={l.step}>
                <span className={l.stepNum}>{index + 1}</span>
                <span className={l.stepBody}>
                  <strong>{step.title}</strong>
                  <span>{step.desc}</span>
                </span>
                {index < 2 && <ChevronRight size={20} className={l.stepArrow} aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </section>

        <section className={l.stats}>
          <div className={l.statsLead}>
            <Users size={30} className={l.statsIcon} />
            <div>
              <strong>A marketplace built for Niners.</strong>
              <span>Join UNC Charlotte students already buying and selling on NinerMarket.</span>
            </div>
          </div>
          <div className={l.stat}>
            <span className={l.statValue}>
              {featuredTotal != null ? `${featuredTotal}+` : "…"}
            </span>
            <span className={l.statLabel}>Listings</span>
          </div>
          <div className={l.stat}>
            <span className={l.statValue}>{requestTotal != null ? requestTotal : "…"}</span>
            <span className={l.statLabel}>Open requests</span>
          </div>
          <div className={l.stat}>
            <span className={l.statValue}>100%</span>
            <span className={l.statLabel}>Free to use</span>
          </div>
        </section>

        <section className={l.ctaBand}>
          <img className={l.ctaMark} src={ninerLogo} alt="" aria-hidden="true" />
          <div className={l.ctaCopy}>
            <h2 className={l.ctaTitle}>Ready to find your next deal?</h2>
            <p className={l.ctaSub}>Join NinerMarket today and be part of the campus community.</p>
          </div>
          <button type="button" className={`${l.btn} ${l.btnGold}`} onClick={() => setJoinOpen(true)}>
            Sign Up / Log In <ArrowRight size={16} />
          </button>
        </section>
      </div>

      <SiteFooter
        className={l.footerSlot}
        note="NinerMarket is an independent student project built by UNC Charlotte students. It is not officially affiliated with, endorsed by, or operated by UNC Charlotte."
      />

      {/* Join panel - the page's single entry point into the auth flow. */}
      <Modal
        open={joinOpen}
        onOpenChange={(open) => {
          if (!open) setJoinOpen(false);
        }}
        ariaLabel="Join NinerMarket"
      >
        <div className={l.joinCard}>
          <h2 className={l.joinTitle}>Shop &amp; sell on campus</h2>

          <div className={l.joinActions}>
            {GOOGLE_CLIENT_ID ? (
              <div ref={googleButtonRef} className={l.joinGoogle} />
            ) : (
              <button
                type="button"
                className={l.joinSocial}
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
            <p className={l.joinNote}>
              NinerMarket is for UNC Charlotte students, faculty &amp; staff only. Sign in with your
              @charlotte.edu Google account.
            </p>
            <label className={l.joinTerms}>
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
                <button type="button" className={l.joinLink} onClick={() => setTermsOpen(true)}>
                  Terms &amp; Conditions
                </button>
                .
              </span>
            </label>
            {error && <p className={l.joinError}>{error}</p>}
          </div>

          <hr className={l.joinDivider} />

          <button type="button" className={l.joinLink} onClick={() => openForm("signup")}>
            Sign up with your @charlotte.edu email instead
          </button>
          <p className={l.joinSignInLabel}>Already have an account?</p>
          <button type="button" className={l.joinSignInBtn} onClick={() => openForm("signin")}>
            Sign in
          </button>
        </div>
      </Modal>


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
            <p className={s.xSpamNote}>
              Don&apos;t see it? Check your <strong>spam/junk folder</strong>. Verification emails
              sometimes land there. Still nothing after a minute? Tap Resend below.
            </p>
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

      <Modal
        open={forgotOpen}
        onOpenChange={(open) => !open && setForgotOpen(false)}
        ariaLabel="Reset your password"
      >
        <div className={s.xModalHeader}>
          <button
            className={s.xModalClose}
            onClick={() => setForgotOpen(false)}
            aria-label="Close"
          >
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
              autoFocus
            />
            {forgotError && <p className={s.xError}>{forgotError}</p>}
            <button type="submit" className={s.xSubmitBtn} disabled={forgotSending}>
              {forgotSending ? "Sending…" : "Send reset code"}
            </button>
            <button
              type="button"
              className={s.xDemoHint}
              onClick={() => setForgotOpen(false)}
            >
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
              autoFocus
            />
            <div className={s.xPasswordWrap}>
              <input
                className={s.xInput}
                type="password"
                value={forgotNewPwd}
                onChange={(e) => setForgotNewPwd(e.target.value)}
                placeholder="New password (min 8 characters)"
              />
            </div>
            <div className={s.xPasswordWrap}>
              <input
                className={s.xInput}
                type="password"
                value={forgotConfirmPwd}
                onChange={(e) => setForgotConfirmPwd(e.target.value)}
                placeholder="Confirm new password"
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

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
