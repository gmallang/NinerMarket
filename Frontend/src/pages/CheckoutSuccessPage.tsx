import { useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle, ShoppingBag, Home } from "lucide-react";
import { useMarketStore } from "@/lib/store";
import s from "./checkout.module.css";

export function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const isMock = params.get("mock") === "1";
  const listingId = params.get("id") ?? "";

  const listing = useMarketStore((st) => st.listings.find((l) => l.id === listingId));
  const notifySellerPurchased = useMarketStore((st) => st.notifySellerPurchased);
  const notified = useRef(false);

  useEffect(() => {
    if (listingId && !notified.current) {
      notifySellerPurchased(listingId);
      notified.current = true;
    }
  }, [listingId, notifySellerPurchased]);

  return (
    <div className={s.page}>
      <div className={s.card}>
        <div className={`${s.iconWrap} ${s.iconWrapSuccess}`}>
          <CheckCircle size={36} strokeWidth={2.5} />
        </div>

        {isMock && (
          <span className={s.mockBadge}>⚡ Mock Mode — no real charge was made</span>
        )}

        <h1 className={s.heading}>Payment Successful!</h1>
        <p className={s.subheading}>
          Your purchase is confirmed. The seller will reach out about pickup details via messages.
        </p>

        {listing && (
          <div className={s.detailBox}>
            <div className={s.detailRow}>
              <span className={s.detailLabel}>Item</span>
              <span className={s.detailValue}>{listing.title}</span>
            </div>
            <div className={s.detailRow}>
              <span className={s.detailLabel}>Amount paid</span>
              <span className={s.detailValueGreen}>${listing.price.toLocaleString()}</span>
            </div>
            <div className={s.detailRow}>
              <span className={s.detailLabel}>Seller</span>
              <span className={s.detailValue}>{listing.seller}</span>
            </div>
            {listing.campus && (
              <div className={s.detailRow}>
                <span className={s.detailLabel}>Pickup location</span>
                <span className={s.detailValue}>{listing.campus}</span>
              </div>
            )}
          </div>
        )}

        <div className={s.actions}>
          <Link to="/" className={s.btnPrimary}>
            <Home size={16} />
            Back to Marketplace
          </Link>
          {listing?.sellerId && (
            <Link to={`/user/${listing.sellerId}`} className={s.btnGhost}>
              <ShoppingBag size={15} />
              View Seller Profile
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
