import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/shared/Modal";
import { useMarketStore } from "@/lib/store";
import { api } from "@/lib/api";
import { fromDto } from "@/lib/listings";
import type { Listing } from "@/lib/types";
import { ListingDetail } from "./ListingDetail";
import s from "./detail.module.css";

export function ListingOverlay() {
  const navigate = useNavigate();

  const listingOverlayId = useMarketStore((s) => s.listingOverlayId);
  const closeListingOverlay = useMarketStore((s) => s.closeListingOverlay);
  const listings = useMarketStore((s) => s.listings);
  const savedItems = useMarketStore((s) => s.savedItems);
  const toggleSave = useMarketStore((s) => s.toggleSave);
  const openMessageOverlay = useMarketStore((s) => s.openMessageOverlay);

  const cached = listings.find((l) => l.id === listingOverlayId);
  const [result, setResult] = useState<{ id: string; listing: Listing | null } | null>(null);

  useEffect(() => {
    if (!listingOverlayId || cached) return;
    let alive = true;
    api
      .getListing(listingOverlayId)
      .then((dto) => alive && setResult({ id: listingOverlayId, listing: fromDto(dto) }))
      .catch(() => alive && setResult({ id: listingOverlayId, listing: null }));
    return () => {
      alive = false;
    };
  }, [listingOverlayId, cached]);

  const fetched = result?.id === listingOverlayId ? result.listing : undefined;
  const fetchFailed = fetched === null;
  const item = cached ?? fetched ?? undefined;

  const handleOpenSeller = item?.sellerId
    ? () => {
        closeListingOverlay();
        navigate(`/user/${item.sellerId}`);
      }
    : undefined;

  const handleBuy = item
    ? async () => {
        const origin = window.location.origin;
        const result = await api.createCheckout({
          listing_id: item.id,
          success_url: `${origin}/checkout/success?id=${item.id}`,
          cancel_url: `${origin}/checkout/cancel?id=${item.id}`,
        });
        closeListingOverlay();
        if (result.url) {
          window.location.href = result.url;
        } else {
          navigate(`/checkout/success?mock=1&id=${item.id}`);
        }
      }
    : undefined;

  return (
    <Modal
      open={listingOverlayId != null}
      onOpenChange={(next) => {
        if (!next) closeListingOverlay();
      }}
      ariaLabel={item?.title ?? "Listing"}
      className={s.overlayContent}
    >
      {item ? (
        <ListingDetail
          item={item}
          saved={savedItems.has(item.id)}
          onClose={closeListingOverlay}
          onToggleSave={() => toggleSave(item.id)}
          onMessage={() => openMessageOverlay(item.id)}
          onOpenSeller={handleOpenSeller}
          onBuy={handleBuy}
        />
      ) : (
        listingOverlayId != null && (
          <p className={s.overlayStatus} role="status">
            {fetchFailed ? "This listing couldn't be found." : "Loading listing…"}
          </p>
        )
      )}
    </Modal>
  );
}

