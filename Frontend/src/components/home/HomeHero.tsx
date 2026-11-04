import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import campusHero from "@/assets/campus-hero.png";
import s from "./HomeHero.module.css";

const CHIP_CATEGORIES = [
  { id: "textbooks", label: "Textbooks" },
  { id: "furniture", label: "Furniture" },
  { id: "electronics", label: "Electronics" },
  { id: "bikes", label: "Bikes & Transport" },
  { id: "clothing", label: "Clothing & Greek" },
  { id: "supplies", label: "School Supplies" },
  { id: "housing", label: "Housing & Leasing" },
  { id: "services", label: "Student Services" },
  { id: "movein", label: "Move-In Essentials" },
  { id: "other", label: "Other" },
];

const SHORTLIST_SIZE = 5;

export function HomeHero() {
  const [params] = useSearchParams();
  const [expanded, setExpanded] = useState(false);
  const activeCategory = params.get("category") ?? "all";
  const activeIsShortlisted = CHIP_CATEGORIES.slice(0, SHORTLIST_SIZE).some(
    (category) => category.id === activeCategory
  );
  const showAll = expanded || (activeCategory !== "all" && !activeIsShortlisted);
  const visibleCategories = showAll
    ? CHIP_CATEGORIES
    : CHIP_CATEGORIES.slice(0, SHORTLIST_SIZE);

  const categoryHref = (id: string) => {
    const next = new URLSearchParams(params);
    next.delete("page");
    if (id === "all") next.delete("category");
    else next.set("category", id);
    const qs = next.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <section className={s.hero} aria-labelledby="hero-title">
      <div className={s.copy}>
        <h1 className={s.title} id="hero-title">
          Find it on campus.
        </h1>
        <p className={s.subtitle}>
          Buy, sell, and discover what fellow Niners are listing.
        </p>

        <nav className={s.chipRow} aria-label="Popular categories">
          <Link
            to={categoryHref("all")}
            className={`${s.chip} ${activeCategory === "all" ? s.chipActive : ""}`}
            aria-current={activeCategory === "all" ? "page" : undefined}
          >
            All Items
          </Link>
          {visibleCategories.map((category) => (
            <Link
              key={category.id}
              to={categoryHref(category.id)}
              className={`${s.chip} ${activeCategory === category.id ? s.chipActive : ""}`}
              aria-current={activeCategory === category.id ? "page" : undefined}
            >
              {category.label}
            </Link>
          ))}
          <button
            type="button"
            className={`${s.chip} ${s.moreBtn}`}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={showAll}
          >
            {showAll ? "Less" : "More"}
            <ChevronRight size={14} className={showAll ? s.moreIconOpen : undefined} />
          </button>
        </nav>
      </div>

      <div className={s.photoWrap}>
        <img
          className={s.photo}
          src={campusHero}
          alt="UNC Charlotte campus clock tower"
          loading="eager"
          decoding="async"
        />
      </div>
    </section>
  );
}
