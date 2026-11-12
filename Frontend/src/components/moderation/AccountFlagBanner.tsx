import { useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import { useMarketStore } from "@/lib/store";
import s from "./AccountFlagBanner.module.css";

/**
 * Shown at the top of the signed-in pages while the account has review-only
 * posting, so a flagged student is told why - not left guessing why their
 * listings never show up.
 *
 * The state comes from /users/me, so it appears on every sign-in and reflects a
 * moderator's latest decision on the next page load. Dismissing hides it for
 * this visit only; the server flag is the source of truth.
 */
export function AccountFlagBanner() {
  const user = useMarketStore((state) => state.user);
  const [dismissed, setDismissed] = useState(false);

  if (!user?.posting_flagged || dismissed) return null;

  const reason = (user.flag_reason ?? "").trim();

  return (
    <section className={s.banner} role="status" aria-live="polite" aria-label="Account in review">
      <span className={s.icon} aria-hidden="true">
        <ShieldAlert size={18} />
      </span>

      <div className={s.body}>
        <p className={s.title}>Your account is in review</p>
        <p className={s.text}>
          New listings you post won&apos;t be visible to other students until a moderator
          approves them. Browsing, messaging, offers and buying work as usual.
        </p>
        {reason && (
          <p className={s.reason}>
            Reason on file: <strong>{reason}</strong>
          </p>
        )}
        <p className={s.text}>
          Think this is a mistake? Reply to the notification in your bell menu, or email{" "}
          <a className={s.link} href="mailto:gmallang@charlotte.edu">
            gmallang@charlotte.edu
          </a>{" "}
          or{" "}
          <a className={s.link} href="mailto:ksaifeld@charlotte.edu">
            ksaifeld@charlotte.edu
          </a>
          .
        </p>
      </div>

      <button
        type="button"
        className={s.dismiss}
        onClick={() => setDismissed(true)}
        aria-label="Dismiss for now"
        title="Dismiss for now"
      >
        <X size={15} />
      </button>
    </section>
  );
}
