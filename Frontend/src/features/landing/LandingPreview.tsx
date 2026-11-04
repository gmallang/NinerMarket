import { Heart, Home, Menu, MessageCircle, Plus, Search, UserRound } from "lucide-react";
import ninerLogo from "@/assets/NinerMarket.png";
import { ListingCard } from "@/features/listings/ListingCard";
import { PREVIEW_LISTINGS } from "./previewData";
import p from "./landingPreview.module.css";

const noop = () => {};

const CHIPS = ["All Items", "Textbooks", "Furniture", "Electronics"];

/**
 * Decorative hero illustration: the marketplace UI itself (app navbar, the
 * home hero's category chips and the real ListingCard component) inside a
 * browser window and a phone, filled with sample listings. Purely visual -
 * pointer events are off and the wrapper is hidden from assistive tech.
 */
export function LandingPreview() {
  return (
    <div className={p.wrap} aria-hidden="true">
      <div className={p.window}>
        <div className={p.chrome}>
          <span className={p.dot} />
          <span className={p.dot} />
          <span className={p.dot} />
          <span className={p.url}>ninermarket.app</span>
        </div>

        <div className={p.screen}>
          <div className={p.nav}>
            <span className={p.logo}>
              <img className={p.logoImg} src={ninerLogo} alt="" />
              <span className={p.logoText}>NinerMarket</span>
            </span>
            <span className={p.search}>
              <Search size={9} />
              Search listings, textbooks, dorm items…
            </span>
            <span className={p.navIcon}>
              <MessageCircle size={9} />
            </span>
            <span className={p.sell}>
              <Plus size={9} />
              Sell
            </span>
          </div>

          <div className={p.body}>
            <div className={p.heroStrip}>
              <strong>Find it on campus.</strong>
              <span>Buy, sell, and discover what fellow Niners are listing.</span>
              <div className={p.chipRow}>
                {CHIPS.map((chip, index) => (
                  <span key={chip} className={`${p.chip} ${index === 0 ? p.chipActive : ""}`}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div className={p.sectionHead}>
              <span>Recently Listed</span>
              <span className={p.viewAll}>View all →</span>
            </div>

            <div className={p.cardGrid}>
              {PREVIEW_LISTINGS.slice(0, 3).map((item) => (
                <ListingCard
                  key={item.id}
                  item={item}
                  saved={false}
                  onToggleSave={noop}
                  onOpen={noop}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={p.phone}>
        <div className={p.phoneScreen}>
          <div className={p.phoneNav}>
            <div className={p.phoneNavTop}>
              <Menu size={10} className={p.phoneMenu} />
              <span className={p.phoneLogo}>
                <img className={p.phoneLogoImg} src={ninerLogo} alt="" />
                NinerMarket
              </span>
              <MessageCircle size={10} className={p.phoneAction} />
              <span className={p.phoneSell}>
                <Plus size={9} />
                Sell
              </span>
            </div>
            <span className={p.phoneSearch}>
              <Search size={8} />
              Search listings…
            </span>
          </div>

          <div className={p.phoneBody}>
            <ListingCard item={PREVIEW_LISTINGS[3]} saved={false} onToggleSave={noop} onOpen={noop} />
          </div>

          <div className={p.bottomNav}>
            <span className={`${p.bottomItem} ${p.bottomActive}`}>
              <Home size={11} />
              Home
            </span>
            <span className={p.bottomItem}>
              <MessageCircle size={11} />
              Messages
            </span>
            <span className={p.bottomItem}>
              <Plus size={11} />
              Sell
            </span>
            <span className={p.bottomItem}>
              <Heart size={11} />
              Saved
            </span>
            <span className={p.bottomItem}>
              <UserRound size={11} />
              Profile
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
