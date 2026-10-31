import { useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import type { WantedRequestDto } from "@/lib/types";
import { useMarketStore } from "@/lib/store";
import { CATEGORIES } from "@/data/categories";
import { CAMPUS_LOCATIONS } from "@/data/locations";
import shared from "@/components/shared/shared.module.css";
import f from "@/features/sell/SellForm.module.css";

const DEFAULT_EXPIRY_DAYS = 30;

function defaultExpiry(): string {
  const date = new Date();
  date.setDate(date.getDate() + DEFAULT_EXPIRY_DAYS);
  return date.toISOString().slice(0, 10);
}

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return defaultExpiry();
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? defaultExpiry() : parsed.toISOString().slice(0, 10);
}

/** Create/edit form for a "Looking For" request. Deliberately separate from
 * SellForm — a request has a budget range and an expiry, no price/condition. */
export function RequestForm({
  request,
  onClose,
  onSaved,
}: {
  request?: WantedRequestDto;
  onClose: () => void;
  onSaved?: (request: WantedRequestDto) => void;
}) {
  const isEditing = !!request;
  const markRequestsChanged = useMarketStore((s) => s.markRequestsChanged);

  const [title, setTitle] = useState(request?.title ?? "");
  const [category, setCategory] = useState(request?.category ?? CATEGORIES[1].id);
  const [description, setDescription] = useState(request?.description ?? "");
  const [budgetMin, setBudgetMin] = useState(
    request?.budget_min != null ? String(request.budget_min) : "",
  );
  const [budgetMax, setBudgetMax] = useState(
    request?.budget_max != null ? String(request.budget_max) : "",
  );
  const [location, setLocation] = useState(request?.preferred_location ?? "");
  const [expires, setExpires] = useState(toDateInput(request?.expires_at));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        description: description.trim(),
        budget_min: budgetMin.trim() === "" ? null : Number(budgetMin),
        budget_max: budgetMax.trim() === "" ? null : Number(budgetMax),
        preferred_location: location.trim(),
        expires_at: new Date(`${expires}T23:59:59`).toISOString(),
      };
      const saved = request
        ? await api.updateRequest(request.id, payload)
        : await api.createRequest(payload);
      markRequestsChanged();
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className={f.modalHeader}>
        <h2 className={f.modalTitle}>{isEditing ? "Edit request" : "Post a request"}</h2>
        <button className={shared.modalClose} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={submit} className={f.modalForm}>
        <label className={f.formField}>
          <span className={f.formLabel}>What are you looking for?</span>
          <input
            className={f.formInput}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Mini fridge for my dorm"
            maxLength={120}
            required
          />
        </label>

        <label className={f.formField}>
          <span className={f.formLabel}>Category</span>
          <select
            className={f.formSelect}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.filter((c) => c.id !== "all").map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className={f.formField}>
          <span className={f.formLabel}>Details</span>
          <textarea
            className={f.formTextarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Size, model, condition — anything that helps someone help you."
            rows={3}
            maxLength={2000}
            required
          />
        </label>

        <div className={f.formRow}>
          <label className={f.formField}>
            <span className={f.formLabel}>Budget min ($)</span>
            <input
              className={f.formInput}
              type="number"
              min="0"
              step="1"
              value={budgetMin}
              onChange={(e) => setBudgetMin(e.target.value)}
              placeholder="Optional"
            />
          </label>
          <label className={f.formField}>
            <span className={f.formLabel}>Budget max ($)</span>
            <input
              className={f.formInput}
              type="number"
              min="0"
              step="1"
              value={budgetMax}
              onChange={(e) => setBudgetMax(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>

        <label className={f.formField}>
          <span className={f.formLabel}>Preferred location</span>
          <input
            className={f.formInput}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. UNC Charlotte Campus"
            list="request-locations"
          />
          <datalist id="request-locations">
            {CAMPUS_LOCATIONS.map((loc) => (
              <option key={loc} value={loc} />
            ))}
          </datalist>
        </label>

        <label className={f.formField}>
          <span className={f.formLabel}>Keep it open until</span>
          <input
            className={f.formInput}
            type="date"
            value={expires}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setExpires(e.target.value)}
          />
        </label>

        {error && <p className={shared.formError}>{error}</p>}

        <div className={f.modalActions}>
          <button type="button" className={shared.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={shared.btnPrimary} disabled={submitting}>
            {submitting ? "Saving..." : isEditing ? "Save Changes" : "Post Request"}
          </button>
        </div>
      </form>
    </>
  );
}
