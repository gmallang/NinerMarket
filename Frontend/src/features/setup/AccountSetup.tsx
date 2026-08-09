import { useState } from "react";
import ninerLogo from "@/assets/NinerMarket.png";
import { PAYMENT_METHODS, SCHOOL_YEARS } from "@/lib/user";
import s from "./setup.module.css";

// ─── First-run account setup ─────────────────────────────────────────────────

export function AccountSetup({
  name,
  onSave,
  onSkip,
  saving = false,
  error: saveError = "",
}: {
  name: string;
  onSave: (year: string, payments: string[]) => void;
  onSkip: () => void;
  saving?: boolean;
  error?: string;
}) {
  const [year, setYear] = useState("");
  const [payments, setPayments] = useState<string[]>([]);
  const [error, setError] = useState("");

  const togglePayment = (p: string) =>
    setPayments((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const submit = () => {
    if (!year) {
      setError("Please select your school year.");
      return;
    }
    if (payments.length === 0) {
      setError("Select at least one payment method you accept.");
      return;
    }
    setError("");
    onSave(year, payments);
  };

  return (
    <div
      className={s.setupModal}
      role="dialog"
      aria-modal="true"
      aria-label="Finish setting up your account"
    >
      <div className={s.setupHeader}>
        <img className={s.setupLogo} src={ninerLogo} alt="NinerMarket" />
        <h2 className={s.setupTitle}>Finish your profile</h2>
      </div>
      <p className={s.setupSub}>
        Welcome to NinerMarket, {name}! Let buyers know your school year and how you like to be
        paid.
      </p>

      <label className={s.setupLabel}>What year are you in?</label>
      <div className={s.setupYears}>
        {SCHOOL_YEARS.map((y) => (
          <button
            key={y}
            type="button"
            className={`${s.setupPill} ${year === y ? s.setupPillActive : ""}`}
            onClick={() => setYear(y)}
          >
            {y}
          </button>
        ))}
      </div>

      <label className={s.setupLabel}>Payment methods you accept</label>
      <div className={s.setupPayments}>
        {PAYMENT_METHODS.map((p) => (
          <label key={p} className={s.setupPay}>
            <input
              type="checkbox"
              checked={payments.includes(p)}
              onChange={() => togglePayment(p)}
            />
            <span>{p}</span>
          </label>
        ))}
      </div>

      {(error || saveError) && <p className={s.setupError}>{error || saveError}</p>}

      <div className={s.setupActions}>
        <button type="button" className={s.setupSkip} onClick={onSkip} disabled={saving}>
          Skip for now
        </button>
        <button type="button" className={s.setupSave} onClick={submit} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
