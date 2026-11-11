import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import ninerLogo from "@/assets/NinerMarket.png";
import s from "./CampusHero.module.css";

export function CampusHero() {
  return (
    <section className={s.hero}>
      <div className={s.bg} aria-hidden="true" />
      <div className={s.overlay} aria-hidden="true" />
      <div className={s.content}>
        <div className={s.topRow}>
          <img src={ninerLogo} alt="NinerMarket" className={s.logo} />
          <div className={s.locationBadge}>
            <MapPin size={14} />
            <span>UNC Charlotte • Charlotte, NC</span>
          </div>
        </div>
        <h1 className={s.title}>Find it on campus.</h1>
        <p className={s.subtitle}>Buy, sell, and discover what fellow Niners are listing.</p>
        <div className={s.ctaRow}>
          <Link to="/?category=all" className={s.ctaPrimary}>
            Browse Listings
          </Link>
        </div>
      </div>
    </section>
  );
}
