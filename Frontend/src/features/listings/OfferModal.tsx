import { useState } from "react";
import { CheckCircle2, HandCoins, X } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import shared from "@/components/shared/shared.module.css";
import s from "./offer.module.css";

export function OfferModal({
  open,
  onOpenChange,
  listingPrice,
  onSubmit,
  submitting,
  error,
  done,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingPrice: number;
  onSubmit: (price: number) => void;
  submitting: boolean;
  error: string | null;
  done: boolean;
}) {
  const [value, setValue] = useState("");

  const price = Number(value);
  const invalid =
    value !== "" && (Number.isNaN(price) || price <= 0 || price > listingPrice);

  const submit = () => {
    const p = Number(value);
    if (Number.isNaN(p) || p <= 0 || p > listingPrice) return;
    onSubmit(p);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} ariaLabel="Make an offer">
      {done ? (
        <div className={s.offerDone}>
          <CheckCircle2 size={32} className={s.offerDoneIcon} />
          <h2 className={s.offerTitle}>Offer sent</h2>
          <p className={s.offerDoneText}>
            The seller has been notified and can accept or decline your offer.
          </p>
          <button
            className={`${shared.btnPrimary} ${s.offerSubmit}`}
            onClick={() => onOpenChange(false)}
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <div className={s.offerHead}>
            <div>
              <h2 className={s.offerTitle}>Make an offer</h2>
              <p className={s.offerSub}>
                Listed at ${listingPrice.toLocaleString()}. Offer up to the listed price.
              </p>
            </div>
            <button
              className={shared.modalClose}
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div className={s.offerInputWrap}>
            <span className={s.offerCurrency}>$</span>
            <input
              className={s.offerInput}
              type="number"
              min={1}
              max={listingPrice}
              step={1}
              inputMode="decimal"
              placeholder="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
          </div>
          {invalid && (
            <p className={shared.formError}>
              {price <= 0
                ? "Enter an amount greater than $0."
                : `Offers can't exceed the listed price ($${listingPrice.toLocaleString()}).`}
            </p>
          )}
          {error && <p className={shared.formError}>{error}</p>}

          <div className={s.offerActions}>
            <button
              className={shared.btnGhost}
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className={`${shared.btnPrimary} ${s.offerSubmit}`}
              onClick={submit}
              disabled={submitting || invalid || value === ""}
            >
              <HandCoins size={15} />
              {submitting ? "Sending…" : "Send offer"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
