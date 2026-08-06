import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  MessageCircle,
  Plus,
  LogOut,
  UserRound,
  ChevronRight,
  Heart,
  ShoppingBag,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import ninerLogo from "@/assets/NinerMarket.png";
import { avatarUrl } from "@/lib/avatar";
import { useMarketStore } from "@/lib/store";
import { CATEGORIES } from "@/data/categories";
import { Modal } from "@/components/shared/Modal";
import { SellForm } from "@/features/sell/SellForm";
import { MessagesOverlay } from "@/features/messaging/MessagesOverlay";
import { ListingOverlay } from "@/features/listings/ListingOverlay";
import s from "./AppLayout.module.css";

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();

  const user = useMarketStore((s) => s.user);
  const convs = useMarketStore((s) => s.convs);
  const savedCount = useMarketStore((s) => s.savedItems.size);
  const logout = useMarketStore((s) => s.logout);
  const loadListings = useMarketStore((s) => s.loadListings);
  const addListing = useMarketStore((s) => s.addListing);
  const messagesOpen = useMarketStore((s) => s.messagesOpen);
  const openMessagesOverlay = useMarketStore((s) => s.openMessagesOverlay);

  const [q, setQ] = useState(params.get("q") ?? "");
  const [prevPathname, setPrevPathname] = useState(pathname);
  const [sellOpen, setSellOpen] = useState(false);
  const totalUnread = convs.reduce((n, c) => n + c.unread, 0);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (pathname !== "/") setQ("");
  }

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const submitSearch = () => {
    const next = new URLSearchParams(params);
    next.delete("saved");
    next.delete("mine");
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    navigate(`/?${next.toString()}`);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className={s.page}>
      <nav className={s.navbar}>
        <div className={s.navInner}>
          <Link to="/" className={s.logo}>
            <img className={s.logoIcon} src={ninerLogo} alt="NinerMarket" />
            <span className={s.logoText}>NinerMarket</span>
          </Link>

          <div className={s.searchWrap}>
            <span className={s.searchIcon}>
              <Search size={15} />
            </span>
            <input
              className={s.searchInput}
              type="text"
              placeholder="Search listings, textbooks, dorm items..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSearch();
              }}
            />
          </div>

          <div className={s.navActions}>
            <button
              className={`${s.iconBtn} ${messagesOpen ? s.iconBtnActive : ""}`}
              onClick={openMessagesOverlay}
              aria-label="Messages"
            >
              <MessageCircle size={16} />
              {totalUnread > 0 && <span className={s.notifDot} style={{ background: "#f87171" }} />}
            </button>
            <button className={s.sellBtn} onClick={() => setSellOpen(true)}>
              <Plus size={14} />
              <span className={s.sellBtnLabel}>Sell</span>
            </button>

            {user && (
              <div className={s.profileWrap}>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className={s.navAvatar} aria-label="Your profile">
                      <img src={avatarUrl(user.display_name, 64)} alt="Your profile" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className={s.profileMenu} align="end" sideOffset={8}>
                      <div className={s.profileMenuHeader}>
                        <p className={s.profileEmail}>{user.email}</p>
                        <p className={s.profileName}>{user.display_name}</p>
                      </div>
                      <DropdownMenu.Item
                        className={s.profileMenuItem}
                        onSelect={() => navigate(`/user/${user.id}`)}
                      >
                        <UserRound size={14} /> View profile
                      </DropdownMenu.Item>
                      <DropdownMenu.Item className={s.profileMenuItem} onSelect={handleLogout}>
                        <LogOut size={14} /> Sign out
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className={s.body}>
        <aside className={s.sidebar}>
          <div className={s.sidebarInner}>
            <span className={s.sectionLabel}>Browse by Category</span>
            <nav className={s.catNav}>
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const active = (params.get("category") ?? "all") === cat.id;
                return (
                  <Link
                    key={cat.id}
                    to={cat.id === "all" ? "/" : `/?category=${cat.id}`}
                    className={`${s.catBtn} ${active ? s.catBtnActive : ""}`}
                  >
                    <Icon size={15} className={active ? s.catIconActive : s.catIcon} />
                    {cat.label}
                    {active && <ChevronRight size={13} className={s.catChevron} />}
                  </Link>
                );
              })}
            </nav>

            <hr className={s.activityDivider} />
            <span className={s.sectionLabel}>Your Activity</span>
            <nav className={s.catNav}>
              <Link
                to="/?saved=1"
                className={`${s.catBtn} ${params.get("saved") === "1" ? s.catBtnActive : ""}`}
              >
                <Heart size={15} className={s.catIcon} />
                Saved Items
                <span className={s.countBadge}>{savedCount}</span>
              </Link>
              <Link
                to="/?mine=1"
                className={`${s.catBtn} ${params.get("mine") === "1" ? s.catBtnActive : ""}`}
              >
                <ShoppingBag size={15} className={s.catIcon} />
                Your Listings
              </Link>
            </nav>

            <div className={s.promoBox}>
              <p className={s.promoTitle}>Move-In Season!</p>
              <p className={s.promoText}>
                Hundreds of dorm essentials listed this week. Check daily for new drops.
              </p>
            </div>
          </div>
        </aside>

        <main className={s.content}>
          <Outlet />
        </main>
      </div>

      <Modal
        open={sellOpen}
        onOpenChange={setSellOpen}
        ariaLabel="Sell an item"
        className={s.sellDialog}
      >
        <SellForm
          onClose={() => setSellOpen(false)}
          onCreated={(listing) => {
            addListing(listing);
            setSellOpen(false);
          }}
        />
      </Modal>

      <MessagesOverlay />
      <ListingOverlay />
    </div>
  );
}
