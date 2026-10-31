import { Heart } from "lucide-react";
import type { Listing } from "@/lib/types";
import { avatarUrl } from "@/lib/avatar";
import { listingImageUrl } from "@/lib/image";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import ninerLogo from "@/assets/NinerMarket.png";
import s from "./card.module.css";

// �"?�"?�"? ListingCard �"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?�"?

function CardImage({ item }: { item: Listing }) {
  const src = item.thumbnail ?? item.image;
  if (src && src.trim().length > 0) {
    return (
      <ProgressiveImage
        src={listingImageUrl(src, 400)}
        sizes="(max-width: 480px) 50vw, (max-width: 900px) 33vw, 240px"
        alt={item.title}
        className={s.cardImage}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
      }}
    >
      <img
        src={ninerLogo}
        alt="NinerMarket"
        style={{ height: 48, width: "auto", filter: "brightness(0) invert(1)", opacity: 0.9 }}
      />
    </div>
  );
}

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
        <CardImage item={item} />
        <button
          className={`${s.saveBtn} ${saved ? s.saveBtnActive : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSave();
          }}
          aria-label={saved ? "Unsave listing" : "Save listing"}
        >
          <Heart size={16} fill={saved ? "currentColor" : "none"} />
        </button>
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
      </div>
      <div className={s.cardBody}>
        <p className={s.cardPrice}>${item.price.toLocaleString()}</p>
        <p className={s.cardTitle}>{item.title}</p>
        <div className={s.cardMeta}>
          <span>
            {item.condition} • {item.campus}
          </span>
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
              {item.sellerRating != null && <span className={s.sellerRating}>★ {item.sellerRating}</span>}
            </button>
          ) : (
            <>
              <img src={avatarUrl(item.seller, 40)} alt={item.seller} className={s.sellerAvatar} loading="lazy" decoding="async" />
              <span className={s.sellerName}>{item.seller}</span>
              {item.sellerRating != null && <span className={s.sellerRating}>★ {item.sellerRating}</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
