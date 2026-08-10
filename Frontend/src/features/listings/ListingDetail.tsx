import { useState } from "react";
import { CheckCircle2, Flag, HandCoins, Heart, MapPin, MessageCircle, Pencil, X } from "lucide-react";
import type { Listing } from "@/lib/types";
import { avatarUrl } from "@/lib/avatar";
import { CATEGORIES } from "@/data/categories";
import { CONDITION_CLASS } from "./condition";
import { OfferModal } from "./OfferModal";
import { ReportModal } from "./ReportModal";
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
  onReport,
  onMakeOffer,
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
  onReport?: (reason: string, details: string) => Promise<void>;
  onMakeOffer?: (price: number) => Promise<void>;
}) {
  const photos = item.photos?.length ? item.photos : [item.image];
  const [activeImg, setActiveImg] = useState(0);
  const [markingSold, setMarkingSold] = useState(false);
  const [markSoldError, setMarkSoldError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportDone, setReportDone] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerDone, setOfferDone] = useState(false);
  const categoryLabel = CATEGORIES.find((x) => x.id === item.category)?.label ?? item.category;
  const isSold = item.status === "sold";
  const isFlagged = item.status === "flagged";
  const isActive = item.status === "active";

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

  const handleReport = async (reason: string, details: string) => {
    if (!onReport) return;
    setReportSubmitting(true);
    setReportError(null);
    try {
      await onReport(reason, details);
      setReportDone(true);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Couldn't submit report.");
    } finally {
      setReportSubmitting(false);
    }
  };

  const closeReport = () => {
    setReportOpen(false);
    setReportDone(false);
    setReportError(null);
  };

  const handleOffer = async (price: number) => {
    if (!onMakeOffer) return;
    setOfferSubmitting(true);
    setOfferError(null);
    try {
      await onMakeOffer(price);
      setOfferDone(true);
    } catch (err) {
      setOfferError(err instanceof Error ? err.message : "Couldn't send offer.");
    } finally {
      setOfferSubmitting(false);
    }
  };

  const closeOffer = () => {
    setOfferOpen(false);
    setOfferDone(false);
    setOfferError(null);
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
          {isOwner && isFlagged && (
            <div className={s.flaggedBanner}>
              <strong>This listing was flagged for review{item.flagReason ? ` (${item.flagReason})` : ""}</strong>
              <span>
                It's hidden from other students until you edit it to remove the prohibited item.
                Contact hrlfacilities@charlotte.edu if you think this was a mistake.
              </span>
            </div>
          )}
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
            {!isSold && onReport && (
              <button
                className={`${shared.btnGhost} ${s.detailGhostBtn}`}
                onClick={() => setReportOpen(true)}
              >
                <Flag size={15} />
                Report
              </button>
            )}
            {isActive && onMakeOffer && (
              <button
                className={`${shared.btnGhost} ${s.detailGhostBtn}`}
                onClick={() => setOfferOpen(true)}
              >
                <HandCoins size={15} />
                Make an offer
              </button>
            )}
            <button className={`${shared.btnPrimary} ${s.detailPrimaryBtn}`} onClick={onMessage}>
              <MessageCircle size={16} />
              Message Seller
            </button>
          </>
        )}
      </div>
      <ReportModal
        key={reportOpen ? "open" : "closed"}
        open={reportOpen}
        onOpenChange={(open) => {
          if (!open) closeReport();
        }}
        onSubmit={handleReport}
        submitting={reportSubmitting}
        error={reportError}
        done={reportDone}
      />
      <OfferModal
        key={offerOpen ? "open" : "closed"}
        open={offerOpen}
        onOpenChange={(open) => {
          if (!open) closeOffer();
        }}
        listingPrice={item.price}
        onSubmit={handleOffer}
        submitting={offerSubmitting}
        error={offerError}
        done={offerDone}
      />
    </div>
  );
}
