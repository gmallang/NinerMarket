import { Heart, MapPin } from "lucide-react";
import type { Listing } from "@/lib/types";
import { CONDITION_CLASS } from "./condition";
import s from "./row.module.css";
import c from "./condition.module.css";

// ─── ListingRow ──────────────────────────────────────────────────────────────

export function ListingRow({
  item,
  saved,
  onToggleSave,
  onOpen,
  onMessage,
  onOpenSeller,
}: {
  item: Listing;
  saved: boolean;
  onToggleSave: () => void;
  onOpen: () => void;
  onMessage: () => void;
  onOpenSeller?: () => void;
}) {
  return (
    <div className={s.row} onClick={onOpen}>
      <div className={s.rowImageWrap}>
        <img src={item.image} alt={item.title} className={s.rowImage} />
      </div>
      <div className={s.rowBody}>
        <div className={s.rowTop}>
          <div className={s.rowInfo}>
            <p className={s.rowPrice}>${item.price.toLocaleString()}</p>
            <p className={s.rowTitle}>{item.title}</p>
            <div className={s.rowTags}>
              <span
                className={`${c.condBadge} ${CONDITION_CLASS[item.condition]}`}
                style={{ position: "static" }}
              >
                {item.condition}
              </span>
              <span className={s.rowLocation}>
                <MapPin size={11} /> {item.campus}
              </span>
              <span className={s.rowTime}>{item.time}</span>
            </div>
          </div>
          <button
            className={`${s.rowSaveBtn} ${saved ? s.rowSaveBtnActive : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave();
            }}
          >
            <Heart size={14} fill={saved ? "currentColor" : "none"} />
          </button>
        </div>
        <div className={s.rowBottom}>
          {item.sellerId && onOpenSeller ? (
            <button
              className={s.sellerLink}
              onClick={(e) => {
                e.stopPropagation();
                onOpenSeller();
              }}
            >
              <span className={s.rowSeller}>{item.seller}</span>
              <span className={s.rowRating}>★ {item.sellerRating}</span>
            </button>
          ) : (
            <>
              <span className={s.rowSeller}>{item.seller}</span>
              <span className={s.rowRating}>★ {item.sellerRating}</span>
            </>
          )}
          <button
            className={s.msgBtn}
            onClick={(e) => {
              e.stopPropagation();
              onMessage();
            }}
          >
            Message
          </button>
        </div>
      </div>
    </div>
  );
}
