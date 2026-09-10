import { Heart, MapPin } from "lucide-react";
import type { Listing } from "@/lib/types";
import { avatarUrl } from "@/lib/avatar";
import { listingImageUrl } from "@/lib/image";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { CONDITION_CLASS } from "./condition";
import s from "./card.module.css";
import c from "./condition.module.css";

// ─── ListingCard ─────────────────────────────────────────────────────────────

export function ListingCard({
  item,
  saved,
  onToggleSave,
  onOpen,
  onOpenSeller,
}: {
  item: Listing;
  saved: boolean;
  onToggleSave: () => void;
  onOpen: () => void;
  onOpenSeller?: () => void;
}) {
  return (
    <div className={s.card} onClick={onOpen}>
      <div className={s.cardImageWrap}>
        <ProgressiveImage
          src={listingImageUrl(item.thumbnail ?? item.image, 400)}
          sizes="(max-width: 480px) 50vw, (max-width: 900px) 33vw, 240px"
          alt={item.title}
          className={s.cardImage}
          loading="lazy"
          decoding="async"
        >
          <button
            className={`${s.saveBtn} ${saved ? s.saveBtnActive : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave();
            }}
          >
            <Heart size={14} fill={saved ? "currentColor" : "none"} />
          </button>
          <span className={`${c.condBadge} ${CONDITION_CLASS[item.condition]}`}>
            {item.condition}
          </span>
          {item.status === "sold" && (
            <div className={s.soldOverlay}>
              <span className={s.soldTag}>Sold</span>
            </div>
          )}
          {item.status === "flagged" && (
            <div className={s.flaggedOverlay}>
              <span className={s.flaggedTag}>Under Review</span>
            </div>
          )}
        </ProgressiveImage>
      </div>
      <div className={s.cardBody}>
        <p className={s.cardPrice}>${item.price.toLocaleString()}</p>
        <p className={s.cardTitle}>{item.title}</p>
        <div className={s.cardMeta}>
          <MapPin size={11} className={s.cardMetaIcon} />
          <span>{item.campus}</span>
          <span className={s.cardMetaTime}>{item.time}</span>
        </div>
        <div className={s.sellerRow}>
          {item.sellerId && onOpenSeller ? (
            <button
              className={s.sellerLink}
              onClick={(e) => {
                e.stopPropagation();
                onOpenSeller();
              }}
            >
              <img src={avatarUrl(item.seller, 40)} alt={item.seller} className={s.sellerAvatar} loading="lazy" decoding="async" />
              <span className={s.sellerName}>{item.seller}</span>
              <span className={s.sellerRating}>★ {item.sellerRating}</span>
            </button>
          ) : (
            <>
              <img src={avatarUrl(item.seller, 40)} alt={item.seller} className={s.sellerAvatar} loading="lazy" decoding="async" />
              <span className={s.sellerName}>{item.seller}</span>
              <span className={s.sellerRating}>★ {item.sellerRating}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
