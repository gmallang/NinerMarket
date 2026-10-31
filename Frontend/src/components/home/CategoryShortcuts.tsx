import { Link, useSearchParams } from "react-router-dom";
import { BookOpen, Sofa, Laptop, Bike, Shirt, Package, Building2, Handshake } from "lucide-react";
import s from "./CategoryShortcuts.module.css";

const shortcuts = [
  { id: "textbooks", label: "Textbooks", icon: BookOpen },
  { id: "furniture", label: "Furniture", icon: Sofa },
  { id: "electronics", label: "Electronics", icon: Laptop },
  { id: "bikes", label: "Bikes & Transport", icon: Bike },
  { id: "clothing", label: "Clothing & Greek", icon: Shirt },
  { id: "supplies", label: "School Supplies", icon: Package },
  { id: "housing", label: "Housing & Leasing", icon: Building2 },
  { id: "services", label: "Student Services", icon: Handshake },
];

export function CategoryShortcuts() {
  const [params] = useSearchParams();
  const activeCategory = params.get("category") ?? "all";

  return (
    <section className={s.section}>
      <div className={s.header}>
        <h2 className={s.title}>Browse by category</h2>
      </div>
      <div className={s.grid}>
        {shortcuts.map((item) => {
          const Icon = item.icon;
          const isActive = activeCategory === item.id;
          return (
            <Link
              key={item.id}
              // Clicking the active category clears it, so there's always a way
              // back to the full marketplace without a separate "All" tile.
              to={isActive ? "/" : `/?category=${item.id}`}
              className={`${s.card} ${isActive ? s.cardActive : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={20} className={s.icon} />
              <span className={s.label}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

