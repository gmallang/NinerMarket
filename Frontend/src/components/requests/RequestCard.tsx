import { Link } from "react-router-dom";
import { Clock, MapPin, Pencil, Trash2, CheckCircle2, RotateCcw, MessageCircle } from "lucide-react";
import { avatarUrl } from "@/lib/avatar";
import { formatRelativeTime } from "@/lib/format";
import { CATEGORIES } from "@/data/categories";
import type { WantedRequestDto } from "@/lib/types";
import s from "./RequestCard.module.css";

function budgetLabel(min: number | null, max: number | null): string | null {
  if (min != null && max != null) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (min != null) return `From $${min.toLocaleString()}`;
  if (max != null) return `Up to $${max.toLocaleString()}`;
  return null;
}

function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Other";
}

/** A "Looking For" request. Shares the listing card's visual language but is
 * deliberately distinguishable: dashed top edge, green budget chip, and a
 * "Wanted" badge instead of a price. */
export function RequestCard({
  request,
  currentUserId,
  respondPending,
  onRespond,
  onEdit,
  onDelete,
  onFulfill,
  onReopen,
}: {
  request: WantedRequestDto;
  currentUserId?: string;
  respondPending?: boolean;
  onRespond?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onFulfill?: () => void;
  onReopen?: () => void;
}) {
  const isOwn = !!currentUserId && request.user_id === currentUserId;
  const budget = budgetLabel(request.budget_min, request.budget_max);
  const requester = request.requester;

  return (
    <article className={s.card}>
      <div className={s.topRow}>
        <span className={s.category}>{categoryLabel(request.category)}</span>
        <span className={`${s.status} ${s[request.status]}`}>
          {request.status === "active"
            ? "Active"
            : request.status === "fulfilled"
              ? "Fulfilled"
              : "Expired"}
        </span>
      </div>

      <h3 className={s.title}>{request.title}</h3>
      <p className={s.description}>{request.description}</p>

      <div className={s.meta}>
        {budget && <span className={s.budget}>Budget {budget}</span>}
        {request.preferred_location && (
          <span className={s.metaItem}>
            <MapPin size={13} />
            {request.preferred_location}
          </span>
        )}
        <span className={s.metaItem}>
          <Clock size={13} />
          {formatRelativeTime(request.created_at)}
        </span>
        {request.response_count > 0 && (
          <span className={s.metaItem}>
            <MessageCircle size={13} />
            {request.response_count} {request.response_count === 1 ? "response" : "responses"}
          </span>
        )}
      </div>

      <div className={s.footer}>
        {requester ? (
          isOwn ? (
            <span className={s.requester}>
              <img className={s.avatar} src={avatarUrl(requester.display_name, 40)} alt="" loading="lazy" />
              <span className={s.requesterName}>You</span>
            </span>
          ) : (
            <Link to={`/user/${requester.id}`} className={s.requester}>
              <img className={s.avatar} src={avatarUrl(requester.display_name, 40)} alt="" loading="lazy" />
              <span className={s.requesterName}>{requester.display_name}</span>
              {requester.rating_count > 0 && (
                <span className={s.rating}>★ {requester.rating_avg.toFixed(1)}</span>
              )}
            </Link>
          )
        ) : (
          <span />
        )}

        <div className={s.actions}>
          {isOwn ? (
            <>
              {request.status === "active" && onFulfill && (
                <button className={s.actionBtn} onClick={onFulfill}>
                  <CheckCircle2 size={14} /> Mark fulfilled
                </button>
              )}
              {request.status !== "active" && onReopen && (
                <button className={s.actionBtn} onClick={onReopen}>
                  <RotateCcw size={14} /> Reopen
                </button>
              )}
              {onEdit && (
                <button className={s.iconBtn} onClick={onEdit} aria-label="Edit request" title="Edit">
                  <Pencil size={14} />
                </button>
              )}
              {onDelete && (
                <button
                  className={`${s.iconBtn} ${s.iconBtnDanger}`}
                  onClick={onDelete}
                  aria-label="Delete request"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </>
          ) : (
            request.status === "active" &&
            onRespond && (
              <button className={s.respondBtn} onClick={onRespond} disabled={respondPending}>
                {respondPending ? "Opening…" : "I have this"}
              </button>
            )
          )}
        </div>
      </div>
    </article>
  );
}
