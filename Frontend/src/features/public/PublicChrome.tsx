import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import ninerLogo from "@/assets/NinerMarket.png";
import { RequestCard } from "@/components/requests/RequestCard";
import { ListingCard } from "@/features/listings/ListingCard";
import {
  PREVIEW_CHAT,
  PREVIEW_LISTINGS,
  PREVIEW_REQUESTS,
} from "@/features/landing/previewData";
import { avatarUrl } from "@/lib/avatar";
import {
  HelpModal,
  PrivacyModal,
  TermsModal,
} from "@/features/login/AuthModals";
import m from "@/features/messaging/Messaging.module.css";
import s from "./publicChrome.module.css";

export type AuthMode = "signin" | "signup";

type AuthActions = {
  onSignUp?: () => void;
  onLogIn?: () => void;
};

const noop = () => {};

/** Marketing navbar: brand, then Log in / Sign up. */
export function PublicNav({ onSignUp, onLogIn }: AuthActions) {
  return (
    <header className={s.nav}>
      <div className={s.navInner}>
        <Link to="/about" className={s.brand} aria-label="NinerMarket home">
          <img className={s.brandImg} src={ninerLogo} alt="" />
          <span className={s.brandName}>NinerMarket</span>
        </Link>

        <nav className={s.navLinks} aria-label="Main">
          <button type="button" className={s.navLink} onClick={() => onLogIn?.()}>
            Log in
          </button>
          <button type="button" className={s.navCta} onClick={() => onSignUp?.()}>
            Sign up
          </button>
        </nav>
      </div>
    </header>
  );
}

/**
 * The hero: a dark green block with the auth card floating in the middle and
 * the "create an account" pill underneath it.
 */
export function PublicHero({
  children,
  onSignUp,
}: {
  children: ReactNode;
  onSignUp?: () => void;
}) {
  return (
    <section className={s.heroSection}>
      <div className={s.hero}>
        <div className={s.heroCard}>{children}</div>
      </div>

      {onSignUp && (
        <button type="button" className={s.heroPill} onClick={onSignUp}>
          New to NinerMarket? <strong>Create an account</strong>
        </button>
      )}
    </section>
  );
}

/**
 * Three example columns: a headline and blurb, then a real piece of the app -
 * a listing card, wanted-request cards, an actual message thread.
 */
export function PublicTiles() {
  return (
    <section className={s.examples} aria-label="What you can do on NinerMarket">
      <article className={s.example}>
        <h2 className={s.exampleTitle}>Shop verified Niners</h2>
        <p className={s.exampleSub}>
          Browse textbooks, dorm gear and electronics from students who verified their @charlotte.edu
          email.
        </p>
        <div className={s.exampleStage} aria-hidden="true">
          <div className={s.exampleListing}>
            <ListingCard
              item={PREVIEW_LISTINGS[0]}
              saved={false}
              onToggleSave={noop}
              onOpen={noop}
            />
          </div>
        </div>
      </article>

      <article className={s.example}>
        <h2 className={s.exampleTitle}>Ask for what you need</h2>
        <p className={s.exampleSub}>
          Can&apos;t find it? Post a wanted request and let fellow Niners send you offers.
        </p>
        <div className={s.exampleStage} aria-hidden="true">
          <div className={s.exampleRequests}>
            <RequestCard request={PREVIEW_REQUESTS[0]} />
          </div>
        </div>
      </article>

      <article className={s.example}>
        <h2 className={s.exampleTitle}>Message and meet up</h2>
        <p className={s.exampleSub}>
          Chat with the seller, agree on a price, and meet somewhere on campus.
        </p>
        <div className={s.exampleStage} aria-hidden="true">
          <div className={s.chatBox}>
            <div className={m.messages}>
              <div className={m.messagesInner}>
                <div className={m.dateDivider}>
                  <div className={m.dateLine} />
                  <span className={m.dateLabel}>Today</span>
                  <div className={m.dateLine} />
                </div>

                {PREVIEW_CHAT.messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`${m.msgRow} ${msg.sent ? m.msgRowSent : ""}`}
                  >
                    <div className={m.msgBubbleRow}>
                      {!msg.sent && (
                        <img
                          src={avatarUrl(PREVIEW_CHAT.name, 56)}
                          alt=""
                          className={m.msgRowAvatar}
                        />
                      )}
                      <div
                        className={`${m.bubble} ${msg.sent ? m.bubbleSent : m.bubbleRecv}`}
                      >
                        {msg.text}
                      </div>
                    </div>
                    <span className={m.msgTime}>{msg.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}

/** "Connect with your campus" band with the single green join button. */
export function PublicJoinBand({ onJoin }: { onJoin: () => void }) {
  return (
    <section className={s.joinBand}>
      <h2 className={s.joinTitle}>Connect with your campus</h2>
      <button type="button" className={s.joinBtn} onClick={onJoin}>
        Join NinerMarket
      </button>
    </section>
  );
}

/** Large marketing footer: link columns and the disclaimer. */
export function PublicFooter({ onSignUp, onLogIn }: AuthActions) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <footer className={s.footer}>
      <div className={s.footerInner}>
        <div className={s.footerCols}>
          <div>
            <p className={s.colTitle}>NinerMarket</p>
            <ul className={s.colList}>
              <li>
                <Link to="/about" className={s.colLink}>
                  About
                </Link>
              </li>
              <li>
                <button type="button" className={s.colLink} onClick={() => onSignUp?.()}>
                  Sign up
                </button>
              </li>
              <li>
                <button type="button" className={s.colLink} onClick={() => onLogIn?.()}>
                  Log in
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className={s.colTitle}>Niners</p>
            <ul className={s.colList}>
              <li>
                <button type="button" className={s.colLink} onClick={() => onSignUp?.()}>
                  Browse listings
                </button>
              </li>
              <li>
                <button type="button" className={s.colLink} onClick={() => onSignUp?.()}>
                  Wanted requests
                </button>
              </li>
              <li>
                <button type="button" className={s.colLink} onClick={() => setHelpOpen(true)}>
                  Help &amp; contact
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className={s.colTitle}>Categories</p>
            <ul className={s.colList}>
              <li>
                <button type="button" className={s.colLink} onClick={() => onSignUp?.()}>
                  Textbooks
                </button>
              </li>
              <li>
                <button type="button" className={s.colLink} onClick={() => onSignUp?.()}>
                  Dorm &amp; furniture
                </button>
              </li>
              <li>
                <button type="button" className={s.colLink} onClick={() => onSignUp?.()}>
                  Electronics
                </button>
              </li>
              <li>
                <button type="button" className={s.colLink} onClick={() => onSignUp?.()}>
                  Services
                </button>
              </li>
            </ul>
          </div>

          <div>
            <p className={s.colTitle}>Legal</p>
            <ul className={s.colList}>
              <li>
                <button type="button" className={s.colLink} onClick={() => setPrivacyOpen(true)}>
                  Privacy
                </button>
              </li>
              <li>
                <button type="button" className={s.colLink} onClick={() => setTermsOpen(true)}>
                  Terms
                </button>
              </li>
              <li>
                <span className={s.colLink}>© 2026 NinerMarket</span>
              </li>
            </ul>
          </div>
        </div>

        <p className={s.footerNote}>
          NinerMarket is an independent student project built by UNC Charlotte students. It is not
          officially affiliated with, endorsed by, or operated by UNC Charlotte.
        </p>
      </div>

      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {termsOpen && (
        <TermsModal
          accepted
          onAccept={() => setTermsOpen(false)}
          onClose={() => setTermsOpen(false)}
        />
      )}
    </footer>
  );
}
