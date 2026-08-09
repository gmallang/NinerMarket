import { useState } from "react";
import { CheckCircle2, Heart, MapPin, MessageCircle, Pencil, X } from "lucide-react";
import type { Listing } from "@/lib/types";
import { avatarUrl } from "@/lib/avatar";
import { CATEGORIES } from "@/data/categories";
import { CONDITION_CLASS } from "./condition";
import shared from "@/components/shared/shared.module.css";
import s from "./detail.module.css";

// ─── Listing detail (page) ───────────────────────────────────────────────────

export function ListingDetail({
  item,
  saved,
  isOwner = false,
  onClose,
  onToggleSave,
  onMessage,
  onOpenSeller,
  onMarkSold,
  onEdit,
}: {
  item: Listing;
  saved: boolean;
  isOwner?: boolean;
  onClose: () => void;
  onToggleSave: () => void;
  onMessage: () => void;
  onOpenSeller?: () => void;
  onMarkSold?: () => Promise<void>;
  onEdit?: () => void;
}) {
  const photos = item.photos?.length ? item.photos : [item.image];
  const [activeImg, setActiveImg] = useState(0);
  const [markingSold, setMarkingSold] = useState(false);
  const [markSoldError, setMarkSoldError] = useState<string | null>(null);
  const categoryLabel = CATEGORIES.find((x) => x.id === item.category)?.label ?? item.category;
  const isSold = item.status === "sold";

  const handleMarkSold = async () => {
    if (!onMarkSold) return;
    setMarkingSold(true);
    setMarkSoldError(null);
    try {
      await onMarkSold();
    } catch (err) {
      setMarkSoldError(err instanceof Error ? err.message : "Couldn't update listing.");
    } finally {
      setMarkingSold(false);
    }
  };

  return (
    <div className={s.detailModal} role="dialog" aria-modal="true" aria-label={item.title}>
      <button className={s.detailClose} onClick={onClose} aria-label="Close">
        <X size={18} />
      </button>
      <div className={s.detailBody}>
        <div className={s.detailGallery}>
          <img src={photos[activeImg]} alt={item.title} className={s.detailMainImg} />
          {photos.length > 1 && (
            <div className={s.detailThumbs}>
              {photos.map((p, i) => (
                <img
                  key={i}
                  src={p}
                  alt={`${item.title} ${i + 1}`}
                  className={`${s.detailThumb} ${i === activeImg ? s.detailThumbActive : ""}`}
                  onClick={() => setActiveImg(i)}
                />
              ))}
            </div>
          )}
        </div>
        <div className={s.detailInfo}>
          <div className={s.detailTags}>
            <span
              className={`${s.detailCond} ${CONDITION_CLASS[item.condition]}`}
              style={{ position: "static" }}
            >
              {item.condition}
            </span>
            <span className={s.detailCategory}>{categoryLabel}</span>
          </div>
          <h2 className={s.detailTitle}>{item.title}</h2>
          <p className={s.detailPrice}>${item.price.toLocaleString()}</p>
          <div className={s.detailMeta}>
            <MapPin size={13} className={s.detailMetaIcon} />
            <span>{item.campus}</span>
            <span className={s.detailTime}>{item.time}</span>
          </div>
          <div className={s.detailSeller}>
            {item.sellerId && onOpenSeller ? (
              <button className={s.sellerLink} onClick={onOpenSeller}>
                <img
                  src={avatarUrl(item.seller, 64)}
                  alt={item.seller}
                  className={s.detailSellerAvatar}
                />
                <div>
                  <p className={s.detailSellerName}>{item.seller}</p>
                  <p className={s.detailSellerRating}>
                    ★ {item.sellerRating.toFixed(1)}{" "}
                    {item.sellerRatingCount != null && item.sellerRatingCount > 0
                      ? `(${item.sellerRatingCount} rating${item.sellerRatingCount === 1 ? "" : "s"})`
                      : "no ratings"}
                  </p>
                  {item.sellerYear && <p className={s.detailSellerYear}>{item.sellerYear}</p>}
                </div>
              </button>
            ) : (
              <>
                <img
                  src={avatarUrl(item.seller, 64)}
                  alt={item.seller}
                  className={s.detailSellerAvatar}
                />
                <div>
                  <p className={s.detailSellerName}>{item.seller}</p>
                  <p className={s.detailSellerRating}>
                    ★ {item.sellerRating.toFixed(1)}{" "}
                    {item.sellerRatingCount != null && item.sellerRatingCount > 0
                      ? `(${item.sellerRatingCount} rating${item.sellerRatingCount === 1 ? "" : "s"})`
                      : "no ratings"}
                  </p>
                  {item.sellerYear && <p className={s.detailSellerYear}>{item.sellerYear}</p>}
                </div>
              </>
            )}
          </div>
          {item.sellerPayments && item.sellerPayments.length > 0 && (
            <div className={s.detailPayments}>
              <span className={s.detailPaymentsLabel}>Accepted payment methods</span>
              <div className={s.detailPaymentsList}>
                {item.sellerPayments.map((p) => (
                  <span key={p} className={s.detailPayTag}>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className={s.detailDesc}>
            <h3 className={s.detailDescTitle}>Description</h3>
            <p className={s.detailDescText}>
              {item.description || "No description provided by the seller."}
            </p>
          </div>
        </div>
      </div>
      <div className={s.detailFooter}>
        {isOwner ? (
          <>
            {onEdit && (
              <button className={`${shared.btnGhost} ${s.detailGhostBtn}`} onClick={onEdit}>
                <Pencil size={15} />
                Edit
              </button>
            )}
            <div className={s.detailOwnerActions}>
              {isSold ? (
                <span className={s.soldBadge}>
                  <CheckCircle2 size={15} /> Sold
                </span>
              ) : (
                <>
                  <button
                    className={s.soldBtn}
                    onClick={() => void handleMarkSold()}
                    disabled={markingSold}
                  >
                    <CheckCircle2 size={15} />
                    {markingSold ? "Updating…" : "Mark as Sold"}
                  </button>
                  {markSoldError && <p className={s.soldError}>{markSoldError}</p>}
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <button className={`${shared.btnGhost} ${s.detailGhostBtn}`} onClick={onToggleSave}>
              <Heart size={15} fill={saved ? "currentColor" : "none"} />
              {saved ? "Saved" : "Save"}
            </button>
            <button className={`${shared.btnPrimary} ${s.detailPrimaryBtn}`} onClick={onMessage}>
              <MessageCircle size={16} />
              Message Seller
            </button>
          </>
        )}
      </div>
    </div>
  );
}
