import { useSearchParams, Link } from "react-router-dom";
import { XCircle, ArrowLeft, Home } from "lucide-react";
import s from "./checkout.module.css";

export function CheckoutCancelPage() {
  const [params] = useSearchParams();
  const listingId = params.get("id") ?? "";

  return (
    <div className={s.page}>
      <div className={s.card}>
        <div className={`${s.iconWrap} ${s.iconWrapCancel}`}>
          <XCircle size={36} strokeWidth={2.5} />
        </div>

        <h1 className={s.heading}>Payment Cancelled</h1>
        <p className={s.subheading}>
          No payment was processed. You can go back to the listing and try again, or continue browsing.
        </p>

        <div className={s.actions}>
          {listingId ? (
            <Link to={`/listing/${listingId}`} className={s.btnPrimary}>
              <ArrowLeft size={16} />
              Return to Listing
            </Link>
          ) : (
            <Link to="/" className={s.btnPrimary}>
              <Home size={16} />
              Back to Marketplace
            </Link>
          )}
          <Link to="/" className={s.btnGhost}>
            <Home size={15} />
            Browse Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
}
