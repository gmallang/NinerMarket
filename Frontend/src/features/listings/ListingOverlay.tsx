import { useNavigate } from "react-router-dom";
import { Modal } from "@/components/shared/Modal";
import { useMarketStore } from "@/lib/store";
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

  const item = listings.find((l) => l.id === listingOverlayId);

  const handleOpenSeller = item?.sellerId
    ? () => {
        closeListingOverlay();
        navigate(`/user/${item.sellerId}`);
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
      {item && (
        <ListingDetail
          item={item}
          saved={savedItems.has(item.id)}
          onClose={closeListingOverlay}
          onToggleSave={() => toggleSave(item.id)}
          onMessage={() => openMessageOverlay(item.id)}
          onOpenSeller={handleOpenSeller}
        />
      )}
    </Modal>
  );
}
