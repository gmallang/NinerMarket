import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ImagePlus, X } from "lucide-react";
import { api } from "@/lib/api";
import { compressImage } from "@/lib/image";
import { fromDto } from "@/lib/listings";
import { currentUserId } from "@/lib/user";
import type { Listing } from "@/lib/types";
import { CATEGORIES, CONDITIONS } from "@/data/categories";
import { CAMPUS_LOCATIONS } from "@/data/locations";
import shared from "@/components/shared/shared.module.css";
import s from "./SellForm.module.css";

const MIN_LOCATION_CHARS = 3;

// ─── Sell form ──────────────────────────────────────────────────────────────

export function SellForm({
  listing,
  onClose,
  onSaved,
}: {
  listing?: Listing;
  onClose: () => void;
  onSaved: (listing: Listing) => void;
}) {
  const isEditing = !!listing;
  const [name, setName] = useState(listing?.title ?? "");
  const [price, setPrice] = useState(listing ? String(listing.price) : "");
  const [category, setCategory] = useState(listing?.category ?? CATEGORIES[1].id);
  const [condition, setCondition] = useState(listing?.condition ?? CONDITIONS[0]);
  const [description, setDescription] = useState(listing?.description ?? "");
  const [location, setLocation] = useState(listing?.campus ?? "");
  const [locationOpen, setLocationOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>(listing?.photos ?? []);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const locationMatches =
    location.trim().length >= MIN_LOCATION_CHARS
      ? CAMPUS_LOCATIONS.filter((loc) => loc.toLowerCase().includes(location.trim().toLowerCase()))
      : [];

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (photos.length >= 6) return;
      if (!file.type.startsWith("image/")) return;
      if (file.size > 5 * 1024 * 1024) return;
      compressImage(file)
        .then((dataUrl) => setPhotos((prev) => [...prev, dataUrl]))
        .catch(() => {
          const reader = new FileReader();
          reader.onload = () => setPhotos((prev) => [...prev, reader.result as string]);
          reader.readAsDataURL(file);
        });
    });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const uploadedPhotos = await Promise.all(
        photos.map((p) => (p.startsWith("data:") ? api.uploadPhoto(p) : p))
      );
      const dto = listing
        ? await api.updateListing(listing.id, {
            name,
            price: Number(price),
            category,
            condition,
            description,
            pickup_location: location,
            photos: uploadedPhotos,
          })
        : await api.createListing({
            seller_id: currentUserId(),
            name,
            price: Number(price),
            category,
            condition,
            description,
            pickup_location: location,
            photos: uploadedPhotos,
          });
      onSaved(fromDto(dto));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Could not ${listing ? "update" : "create"} listing`
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className={s.modalHeader}>
        <h2 className={s.modalTitle}>{isEditing ? "Edit listing" : "Sell an item"}</h2>
        <button className={shared.modalClose} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <form onSubmit={submit} className={s.modalForm}>
        <div className={s.formField}>
          <span className={s.formLabel}>Photos</span>
          {photos.length > 0 && (
            <div className={s.photoGrid}>
              {photos.map((p, i) => (
                <div key={i} className={s.photoPreview}>
                  <img src={p} alt={`Upload ${i + 1}`} />
                  <button
                    type="button"
                    className={s.photoRemove}
                    onClick={() => removePhoto(i)}
                    aria-label="Remove photo"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {photos.length < 6 && (
                <button
                  type="button"
                  className={s.photoAddBtn}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus size={16} />
                </button>
              )}
            </div>
          )}
          <button type="button" className={s.photoDrop} onClick={() => fileRef.current?.click()}>
            <ImagePlus size={20} />
            <span>{photos.length ? "Add more photos" : "Click to add photos"}</span>
            <small>JPG or PNG, up to 6 photos</small>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className={s.photoDropInput}
            onChange={handleFileChange}
          />
        </div>

        <label className={s.formField}>
          <span className={s.formLabel}>Title</span>
          <input
            className={s.formInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What are you selling?"
            required
          />
        </label>

        <div className={s.formRow}>
          <label className={s.formField}>
            <span className={s.formLabel}>Price ($)</span>
            <input
              className={s.formInput}
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              required
            />
          </label>
          <label className={s.formField}>
            <span className={s.formLabel}>Condition</span>
            <select
              className={s.formSelect}
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className={s.formField}>
          <span className={s.formLabel}>Category</span>
          <select
            className={s.formSelect}
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

        <label className={`${s.formField} ${s.locationField}`}>
          <span className={s.formLabel}>Pickup location</span>
          <input
            className={s.formInput}
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setLocationOpen(true);
            }}
            onFocus={() => setLocationOpen(true)}
            onBlur={() => window.setTimeout(() => setLocationOpen(false), 100)}
            placeholder="e.g. Student Union"
            autoComplete="off"
            required
          />
          {locationOpen && locationMatches.length > 0 && (
            <div className={s.locationDropdown} role="listbox">
              {locationMatches.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  className={s.locationOption}
                  role="option"
                  aria-selected={loc === location}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setLocation(loc);
                    setLocationOpen(false);
                  }}
                >
                  {loc}
                </button>
              ))}
            </div>
          )}
        </label>

        <label className={s.formField}>
          <span className={s.formLabel}>Description</span>
          <textarea
            className={s.formTextarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Condition details, specs, why you're selling..."
            rows={3}
          />
        </label>

        {error && <p className={shared.formError}>{error}</p>}

        <div className={s.modalActions}>
          <button type="button" className={shared.btnGhost} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={shared.btnPrimary} disabled={submitting}>
            {submitting
              ? isEditing
                ? "Saving..."
                : "Posting..."
              : isEditing
                ? "Save Changes"
                : "Post Listing"}
          </button>
        </div>
      </form>
    </>
  );
}
