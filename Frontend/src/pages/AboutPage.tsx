import { Link } from "react-router-dom";
import { Heart, Lock, MapPin } from "lucide-react";
import ninerLogo from "@/assets/NinerMarket.png";
import s from "./AboutPage.module.css";

const VALUES = [
  { icon: Lock, title: "UNC Verified", text: "@charlotte.edu only" },
  { icon: MapPin, title: "Campus First", text: "Meet locally, no shipping" },
  { icon: Heart, title: "Free Forever", text: "No fees, no catch" },
];

/* Pillar icon treatment — flip to "circle" for the tinted-coin variant. */
const ICON_VARIANT: "bare" | "circle" = "bare";

export function AboutPage() {
  return (
    <div className={s.aPage}>
      {/* Hero */}
      <section className={s.aHero}>
        <img className={s.aHeroLogo} src={ninerLogo} alt="NinerMarket" />
        <span className={s.aHeroName}>NinerMarket</span>
        <h1 className={s.aHeroTitle}>Your local marketplace</h1>
        <p className={s.aHeroSub}>
          The trusted marketplace for UNC Charlotte students.
        </p>
        <Link to="/login" className={`${s.aBtnPrimary} ${s.aHeroCta}`}>
          Sign up / Log in
        </Link>
      </section>

      {/* Core values */}
      <section className={s.aSection}>
        <div className={s.aValues}>
          {VALUES.map((value) => {
            const Icon = value.icon;
            return (
              <div key={value.title} className={s.aValue}>
                <span
                  className={ICON_VARIANT === "bare" ? s.aValueIcon : s.aValueIconCircle}
                  aria-hidden="true"
                >
                  <Icon size={ICON_VARIANT === "bare" ? 28 : 24} />
                </span>
                <h2 className={s.aValueTitle}>{value.title}</h2>
                <p className={s.aValueText}>{value.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mission */}
      <section className={s.aSection}>
        <p className={s.aMission}>
          NinerMarket exists to make campus life a little easier. Whether you&apos;re hunting for a
          textbook, clearing out your dorm, or finding a place to live, everything stays local,
          verified, and free.
        </p>
        <p className={s.aDisclaimer}>
          NinerMarket is an independent student project built by UNC Charlotte students. It is
          not officially affiliated with, endorsed by, or operated by UNC Charlotte.
        </p>
      </section>

      {/* Footer */}
      <footer className={s.aFooter}>
        <Link to="/about" className={s.aFooterLink}>
          About
        </Link>
        <span>·</span>
        <Link to="/privacy" className={s.aFooterLink}>
          Privacy
        </Link>
        <span>·</span>
        <Link to="/login" className={s.aFooterLink}>
          Help
        </Link>
        <span>·</span>
        <Link to="/login" className={s.aFooterLink}>
          Terms
        </Link>
        <span>·</span>
        <span>© 2026 NinerMarket</span>
      </footer>
    </div>
  );
}
