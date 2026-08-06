import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MessageCircle, Star } from "lucide-react";
import { api } from "@/lib/api";
import { avatarUrl } from "@/lib/avatar";
import { formatRelativeTime } from "@/lib/format";
import { fromDto } from "@/lib/listings";
import { useMarketStore } from "@/lib/store";
import type { Listing, Rating, UserDto } from "@/lib/types";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

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
        if (!active) return;
        setProfile(u);
        setRatings(r);
        setListings(ls.map(fromDto));
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
  }, [id]);

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
              <ListingCard
                key={item.id}
                item={item}
                saved={savedItems.has(item.id)}
                onToggleSave={() => toggleSave(item.id)}
                onOpen={() => openListing(item.id)}
                onOpenSeller={item.sellerId ? () => navigate(`/user/${item.sellerId}`) : undefined}
              />
            ))}
          </div>
        )}
      </section>

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
