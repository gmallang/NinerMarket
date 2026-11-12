import { EyeOff, ListChecks, Mail, MessageCircle, Search, ShieldAlert, X } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { useMarketStore } from "@/lib/store";
import shared from "@/components/shared/shared.module.css";
import flaggedArt from "@/assets/flagged-review.gif";
import s from "./AccountFlagModal.module.css";

interface AccountFlagModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The full notice for an account a moderator has flagged: what is restricted,
 * what still works, and how to appeal. The banner is the quiet version of this;
 * this is what a flagged student sees when they sign in, and the banner's
 * "See full notice" button reopens it.
 *
 * Renders nothing at all for an account that is not flagged, so mounting it
 * app-wide costs nothing and there is no way to open it by accident.
 */
export function AccountFlagModal({ open, onOpenChange }: AccountFlagModalProps) {
  const user = useMarketStore((state) => state.user);

  if (!user?.posting_flagged) return null;

  const reason = (user.flag_reason ?? "").trim();

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      ariaLabel="Your account is flagged for review"
      className={s.dialog}
    >
      <div className={s.media}>
        <img className={s.art} src={flaggedArt} alt="" aria-hidden="true" />
        <span className={s.chip}>
          <ShieldAlert size={13} />
          Account flagged
        </span>
        <button
          type="button"
          className={s.close}
          onClick={() => onOpenChange(false)}
          aria-label="Close notice"
          title="Close notice"
        >
          <X size={16} />
        </button>
      </div>

      <div className={s.body}>
        <h2 className={s.title}>Your account is under review</h2>
        <p className={s.lead}>
          A moderator put your account on review. You can still browse, message and buy - but
          nothing you post goes live until a moderator approves it.
        </p>

        {reason && (
          <p className={s.reason}>
            Reason on file: <strong>{reason}</strong>
          </p>
        )}

        <h3 className={s.heading}>What you can&apos;t do right now</h3>
        <ul className={s.list}>
          <li className={s.item}>
            <span className={s.itemIcon} aria-hidden="true">
              <EyeOff size={15} />
            </span>
            <div>
              <p className={s.itemTitle}>Show a new listing to other students</p>
              <p className={s.itemText}>
                Anything you post waits in a moderator&apos;s queue. Only you can see it until
                it&apos;s approved, so buyers won&apos;t find it in search or browse.
              </p>
            </div>
          </li>
          <li className={s.item}>
            <span className={s.itemIcon} aria-hidden="true">
              <ListChecks size={15} />
            </span>
            <div>
              <p className={s.itemTitle}>Put a held post live yourself</p>
              <p className={s.itemText}>
                Editing a listing that is waiting for approval - or was flagged - keeps it in
                the queue instead of publishing it. A moderator has to approve it.
              </p>
            </div>
          </li>
        </ul>

        <h3 className={s.heading}>What still works normally</h3>
        <ul className={s.chips}>
          <li className={s.chipItem}>
            <Search size={13} aria-hidden="true" /> Browsing and search
          </li>
          <li className={s.chipItem}>
            <MessageCircle size={13} aria-hidden="true" /> Messages and offers
          </li>
          <li className={s.chipItem}>Buying and selling approved listings</li>
          <li className={s.chipItem}>Saved items, ratings and Looking For requests</li>
        </ul>

        <p className={s.next}>
          A moderator will review your account and lift the restriction if everything checks
          out. You&apos;ll get a notification either way - you don&apos;t need to do anything.
        </p>

        <div className={s.actions}>
          <button
            type="button"
            className={`${shared.btnPrimary} ${s.gotIt}`}
            onClick={() => onOpenChange(false)}
          >
            Got it, keep browsing
          </button>
          <a className={`${shared.btnGhost} ${s.contact}`} href="mailto:gmallang@charlotte.edu">
            <Mail size={14} aria-hidden="true" />
            Appeal by email
          </a>
        </div>
        <p className={s.fineprint}>
          Think this is a mistake? Email{" "}
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
    </Modal>
  );
}
