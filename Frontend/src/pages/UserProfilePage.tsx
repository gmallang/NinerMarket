import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MessageCircle, Star } from "lucide-react";
import { api } from "@/lib/api";
import { avatarUrl } from "@/lib/avatar";
import { formatRelativeTime } from "@/lib/format";
import { fromDto } from "@/lib/listings";
import { useMarketStore } from "@/lib/store";
import type { Listing, Offer, Rating, UserDto } from "@/lib/types";
import { ListingCard } from "@/features/listings/ListingCard";
import ps from "./page.module.css";
import s from "./UserProfilePage.module.css";

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className={s.stars} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= value ? s.starFilled : s.starEmpty}
          fill={n <= value ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export function UserProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const currentUser = useMarketStore((s) => s.user);
  const savedItems = useMarketStore((s) => s.savedItems);
  const toggleSave = useMarketStore((s) => s.toggleSave);
  const openListingOverlay = useMarketStore((s) => s.openListingOverlay);

  const [profile, setProfile] = useState<UserDto | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [offerBusy, setOfferBusy] = useState<string | null>(null);
  const [offerMsg, setOfferMsg] = useState<string | null>(null);
  const [unsellingId, setUnsellingId] = useState<string | null>(null);
  const [unsellMsg, setUnsellMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      setError(null);
      setShowAll(false);
      try {
        const [u, r, ls] = await Promise.all([
          api.getUser(id),
          api.getRatings(id),
          api.getUserListings(id),
        ]);
        let of: Offer[] = [];
        if (currentUser?.id === id) {
          of = await api.getOffers(id);
        }
        if (!active) return;
        setProfile(u);
        setRatings(r);
        setListings(ls.map(fromDto));
        setOffers(of);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Couldn't load profile");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id, currentUser?.id]);

  const isOwnProfile = !!currentUser && currentUser.id === id;
  const visibleListings = showAll ? listings : listings.slice(0, 3);

  const breakdown = [5, 4, 3, 2, 1].map((n) => ({
    stars: n,
    count: ratings.filter((r) => r.stars === n).length,
  }));
  const maxCount = Math.max(1, ...breakdown.map((b) => b.count));

  const openListing = (listingId: string) => openListingOverlay(listingId);

  const submitRating = async () => {
    if (!currentUser || !id || stars === 0) return;
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      await api.createRating({
        rater_id: currentUser.id,
        ratee_id: id,
        listing_id: listings[0]?.id ?? "",
        stars,
        comment: comment.trim(),
      });
      setStars(0);
      setComment("");
      setSubmitMsg("Thanks — your rating was submitted.");
      const [u, r] = await Promise.all([api.getUser(id), api.getRatings(id)]);
      setProfile(u);
      setRatings(r);
    } catch (err) {
      setSubmitMsg(err instanceof Error ? err.message : "Couldn't submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  const receivedOffers = offers.filter((o) => o.direction === "received");
  const sentOffers = offers.filter((o) => o.direction === "sent");

  const offerBadgeClass = (status: Offer["status"]) =>
    s[`offerBadge${status.charAt(0).toUpperCase()}${status.slice(1)}`] as string;

  const replaceOffer = (next: Offer) =>
    setOffers((os) => os.map((o) => (o.id === next.id ? next : o)));

  const syncSoldListing = (listingId: string) => {
    setListings((ls) =>
      ls.map((l) =>
        l.id === listingId
          ? { ...l, status: "sold", soldAt: new Date().toISOString() }
          : l
      )
    );
    const cached = useMarketStore.getState().listings.find((l) => l.id === listingId);
    if (cached)
      useMarketStore
        .getState()
        .updateListing({ ...cached, status: "sold", soldAt: new Date().toISOString() });
  };

  const recentSoldIds = new Set(
    listings
      .filter((l) => l.status === "sold")
      .sort((a, b) => (b.soldAt ?? "").localeCompare(a.soldAt ?? ""))
      .slice(0, 3)
      .map((l) => l.id)
  );

  const handleUnsell = async (listingId: string) => {
    setUnsellingId(listingId);
    setUnsellMsg(null);
    try {
      const next = await api.updateListing(listingId, { status: "active" });
      const updated = fromDto(next);
      setListings((ls) => ls.map((l) => (l.id === listingId ? updated : l)));
      useMarketStore.getState().updateListing(updated);
    } catch (err) {
      setUnsellMsg(err instanceof Error ? err.message : "Couldn't put the listing back up.");
    } finally {
      setUnsellingId(null);
    }
  };

  const handleAcceptOffer = async (offerId: string, listingId: string) => {
    setOfferBusy(offerId);
    setOfferMsg(null);
    try {
      const next = await api.acceptOffer(offerId);
      replaceOffer(next);
      syncSoldListing(listingId);
    } catch (err) {
      setOfferMsg(err instanceof Error ? err.message : "Couldn't accept the offer.");
    } finally {
      setOfferBusy(null);
    }
  };

  const handleDeclineOffer = async (offerId: string) => {
    setOfferBusy(offerId);
    setOfferMsg(null);
    try {
      replaceOffer(await api.declineOffer(offerId));
    } catch (err) {
      setOfferMsg(err instanceof Error ? err.message : "Couldn't decline the offer.");
    } finally {
      setOfferBusy(null);
    }
  };

  const handleCancelOffer = async (offerId: string) => {
    setOfferBusy(offerId);
    setOfferMsg(null);
    try {
      replaceOffer(await api.cancelOffer(offerId));
    } catch (err) {
      setOfferMsg(err instanceof Error ? err.message : "Couldn't cancel the offer.");
    } finally {
      setOfferBusy(null);
    }
  };

  if (loading) {
    return (
      <div className={ps.page}>
        <p className={ps.notFound}>Loading profile&hellip;</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={ps.page}>
        <p className={ps.notFound}>
          {error ?? "User not found."} <Link to="/">Back to browse</Link>
        </p>
      </div>
    );
  }

  return (
    <div className={ps.page}>
      <div className={s.header}>
        <img
          src={avatarUrl(profile.display_name, 96)}
          alt={profile.display_name}
          className={s.avatar}
        />
        <div className={s.headerInfo}>
          <h1 className={s.name}>{profile.display_name}</h1>
          <p className={s.year}>{profile.school_year || "UNC Charlotte student"}</p>
          {isOwnProfile && <p className={s.email}>{profile.email}</p>}
          <div className={s.summary}>
            <span className={s.summaryAvg}>
              {profile.rating_count > 0 ? profile.rating_avg.toFixed(1) : "—"}
            </span>
            <div>
              <Stars value={Math.round(profile.rating_avg)} />
              <p className={s.summaryCount}>
                {profile.rating_count} rating{profile.rating_count === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {!isOwnProfile && (
        <section className={s.rateCard} aria-label="Rate this seller">
          <h2 className={s.sectionTitle}>Rate this seller</h2>
          <div className={s.rateStars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={`${s.rateStarBtn} ${n <= stars ? s.rateStarBtnOn : ""}`}
                onClick={() => setStars(n)}
                aria-label={`${n} star${n === 1 ? "" : "s"}`}
              >
                <Star
                  size={22}
                  className={n <= stars ? s.starFilled : s.starEmpty}
                  fill={n <= stars ? "currentColor" : "none"}
                />
              </button>
            ))}
          </div>
          <textarea
            className={s.rateComment}
            placeholder="What was your experience like?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
          <div className={s.rateFooter}>
            <button
              className={s.rateSubmit}
              onClick={() => void submitRating()}
              disabled={submitting || stars === 0}
            >
              {submitting ? "Submitting..." : "Submit rating"}
            </button>
            {submitMsg && <p className={s.rateMsg}>{submitMsg}</p>}
          </div>
        </section>
      )}

      <section className={s.listingsSection} aria-label="Listings">
        <div className={s.sectionHeader}>
          <h2 className={s.sectionTitle}>
            {profile.display_name.split(" ")[0]}'s listings ({listings.length})
          </h2>
          {listings.length > 3 && (
            <div className={s.toggle}>
              <button
                className={`${s.toggleBtn} ${!showAll ? s.toggleBtnActive : ""}`}
                onClick={() => setShowAll(false)}
              >
                Recent
              </button>
              <button
                className={`${s.toggleBtn} ${showAll ? s.toggleBtnActive : ""}`}
                onClick={() => setShowAll(true)}
              >
                All
              </button>
            </div>
          )}
        </div>
        {visibleListings.length === 0 ? (
          <p className={s.emptyListings}>No active listings right now.</p>
        ) : (
          <div className={s.grid}>
            {visibleListings.map((item) => (
              <div className={s.cardWrap} key={item.id}>
                <ListingCard
                  item={item}
                  saved={savedItems.has(item.id)}
                  onToggleSave={() => toggleSave(item.id)}
                  onOpen={() => openListing(item.id)}
                  onOpenSeller={
                    item.sellerId ? () => navigate(`/user/${item.sellerId}`) : undefined
                  }
                />
                {isOwnProfile &&
                  item.status === "sold" &&
                  recentSoldIds.has(item.id) && (
                    <button
                      className={s.unsellBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleUnsell(item.id);
                      }}
                      disabled={unsellingId === item.id}
                    >
                      {unsellingId === item.id ? "Reposting…" : "Unsell — put back up"}
                    </button>
                  )}
              </div>
            ))}
          </div>
        )}
        {unsellMsg && <p className={s.unsellMsg}>{unsellMsg}</p>}
      </section>

      {isOwnProfile && offers.length > 0 && (
        <section className={s.offersSection} aria-label="Offers">
          <h2 className={s.sectionTitle}>Offers</h2>

          {receivedOffers.length > 0 && (
            <div className={s.offersGroup}>
              <h3 className={s.offersSub}>Received</h3>
              <ul className={s.offerList}>
                {receivedOffers.map((o) => (
                  <li key={o.id} className={s.offerItem}>
                    <div className={s.offerInfo}>
                      <p className={s.offerText}>
                        <span className={s.offerBuyer}>{o.buyer_name}</span> offered{" "}
                        <strong>${o.price.toLocaleString()}</strong> on{" "}
                        <button className={s.offerListing} onClick={() => openListing(o.listing_id)}>
                          {o.listing_name}
                        </button>
                      </p>
                      {o.listing_status !== "active" && (
                        <p className={s.offerHint}>This listing is no longer available.</p>
                      )}
                    </div>
                    {o.status === "pending" ? (
                      <div className={s.offerActions}>
                        <button
                          className={s.offerDecline}
                          onClick={() => handleDeclineOffer(o.id)}
                          disabled={offerBusy === o.id}
                        >
                          Decline
                        </button>
                        <button
                          className={s.offerAccept}
                          onClick={() => handleAcceptOffer(o.id, o.listing_id)}
                          disabled={offerBusy === o.id || o.listing_status !== "active"}
                        >
                          Accept
                        </button>
                      </div>
                    ) : (
                      <span className={`${s.offerBadge} ${offerBadgeClass(o.status)}`}>
                        {o.status}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sentOffers.length > 0 && (
            <div className={s.offersGroup}>
              <h3 className={s.offersSub}>Sent</h3>
              <ul className={s.offerList}>
                {sentOffers.map((o) => (
                  <li key={o.id} className={s.offerItem}>
                    <div className={s.offerInfo}>
                      <p className={s.offerText}>
                        You offered <strong>${o.price.toLocaleString()}</strong> on{" "}
                        <button className={s.offerListing} onClick={() => openListing(o.listing_id)}>
                          {o.listing_name}
                        </button>
                      </p>
                    </div>
                    {o.status === "pending" ? (
                      <div className={s.offerActions}>
                        <button
                          className={s.offerCancel}
                          onClick={() => handleCancelOffer(o.id)}
                          disabled={offerBusy === o.id}
                        >
                          Cancel
                        </button>
                        <span className={`${s.offerBadge} ${offerBadgeClass(o.status)}`}>
                          {o.status}
                        </span>
                      </div>
                    ) : (
                      <span className={`${s.offerBadge} ${offerBadgeClass(o.status)}`}>
                        {o.status}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {offerMsg && <p className={s.offerMsg}>{offerMsg}</p>}
        </section>
      )}

      <section className={s.ratingsSection} aria-label="Ratings">
        <h2 className={s.sectionTitle}>Ratings</h2>
        {ratings.length === 0 ? (
          <p className={s.emptyListings}>No ratings yet.</p>
        ) : (
          <>
            <div className={s.breakdown}>
              {breakdown.map((b) => (
                <div key={b.stars} className={s.breakdownRow}>
                  <span className={s.breakdownLabel}>{b.stars} ★</span>
                  <div className={s.breakdownTrack}>
                    <div
                      className={s.breakdownFill}
                      style={{ width: `${(b.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className={s.breakdownCount}>{b.count}</span>
                </div>
              ))}
            </div>
            <ul className={s.ratingList}>
              {ratings
                .slice()
                .reverse()
                .map((r) => (
                  <li key={r.id} className={s.ratingItem}>
                    <div className={s.ratingTop}>
                      {r.rater ? (
                        <button
                          className={s.ratingAuthor}
                          onClick={() => navigate(`/user/${r.rater!.id}`)}
                        >
                          <img
                            src={avatarUrl(r.rater.display_name, 32)}
                            alt={r.rater.display_name}
                            className={s.ratingAuthorAvatar}
                          />
                          <span>{r.rater.display_name}</span>
                        </button>
                      ) : (
                        <span className={s.ratingAuthor}>Former member</span>
                      )}
                      <Stars value={r.stars} />
                      <span className={s.ratingTime}>{formatRelativeTime(r.created_at)}</span>
                    </div>
                    {r.comment && <p className={s.ratingComment}>{r.comment}</p>}
                    {r.listing_id && (
                      <button
                        className={s.ratingListingLink}
                        onClick={() => openListing(r.listing_id)}
                      >
                        <MessageCircle size={12} /> View listing
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
