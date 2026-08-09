import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ListingDetail } from "@/features/listings/ListingDetail";
import { useMarketStore } from "@/lib/store";
import { api } from "@/lib/api";
import { fromDto } from "@/lib/listings";
import type { Listing } from "@/lib/types";
import ps from "./page.module.css";

export function ListingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const listings = useMarketStore((s) => s.listings);
  const savedItems = useMarketStore((s) => s.savedItems);
  const toggleSave = useMarketStore((s) => s.toggleSave);
  const openMessageOverlay = useMarketStore((s) => s.openMessageOverlay);
  const markListingSold = useMarketStore((s) => s.markListingSold);
  const openEditListing = useMarketStore((s) => s.openEditListing);
  const user = useMarketStore((s) => s.user);

  const cached = listings.find((l) => l.id === id);
  const [fetchState, setFetchState] = useState<{ id: string; listing: Listing | null } | null>(
    null
  );

  useEffect(() => {
    if (!id || cached) return;
    let alive = true;
    api
      .getListing(id)
      .then((dto) => alive && setFetchState({ id, listing: fromDto(dto) }))
      .catch(() => alive && setFetchState({ id, listing: null }));
    return () => {
      alive = false;
    };
  }, [id, cached]);

  const fetched = fetchState && fetchState.id === id ? fetchState.listing : undefined;
  const fetchFailed = fetched === null;
  const item = cached ?? fetched ?? undefined;

  if (!item) {
    if (!fetchFailed) {
      return (
        <div className={ps.page}>
          <p className={ps.notFound} role="status">
            Loading listing&hellip;
          </p>
        </div>
      );
    }
    return (
      <div className={ps.page}>
        <p className={ps.notFound}>
          Listing not found. <Link to="/">Back to browse</Link>
        </p>
      </div>
    );
  }

  const handleMessage = () => openMessageOverlay(item.id);

  const handleOpenSeller = item.sellerId ? () => navigate(`/user/${item.sellerId}`) : undefined;

  const isOwner = !!user && user.id === item.sellerId;

  return (
    <div className={ps.page}>
      <ListingDetail
        item={item}
        saved={savedItems.has(item.id)}
        isOwner={isOwner}
        onClose={() => navigate("/")}
        onToggleSave={() => toggleSave(item.id)}
        onMessage={handleMessage}
        onOpenSeller={handleOpenSeller}
        onMarkSold={() => markListingSold(item.id)}
        onEdit={isOwner ? () => openEditListing(item) : undefined}
      />
    </div>
  );
}

