import { Link } from "react-router-dom";
import ninerLogo from "@/assets/NinerMarket.png";
import s from "./PrivacyPage.module.css";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "What we collect",
    body: "Your name, @charlotte.edu email, school year, and a password (stored as a one-way hash, never in plain text) or your Google account identity if you sign in with Google. When you use the app: listing details and photos you post, messages you send to other users, ratings you leave or receive, and which items you've saved.",
  },
  {
    title: "What we don't collect",
    body: "NinerMarket never asks for or stores payment card numbers, bank details, or Venmo/Zelle credentials. Payment happens directly between buyer and seller, outside the app, using whichever method the seller lists — we're never in that transaction.",
  },
  {
    title: "How we use it",
    body: "To run the marketplace: showing your listings to other students, delivering messages between buyers and sellers, verifying you're a real @charlotte.edu community member, and calculating seller ratings. That's it — we don't use your data for advertising, and we don't sell or rent it to anyone.",
  },
  {
    title: "Who can see it",
    body: "Your display name, school year, listings, and rating are visible to other signed-in NinerMarket users, since that's how a marketplace works. Messages are only visible to the two people in that conversation. Your email and password are never shown to other users.",
  },
  {
    title: "When we share it outside NinerMarket",
    body: "Only when required by law, or when a listing or message violates our Terms & Conditions (illegal items, safety threats, fraud) — in which case we may report the account and relevant content to UNC Charlotte officials, including the Dean of Students or University Police, as described in our Terms.",
  },
  {
    title: "Cookies & tracking",
    body: "We use browser local storage to keep you signed in — no ad networks, no third-party analytics, no tracking pixels.",
  },
  {
    title: "How long we keep it",
    body: "We keep your account and activity for as long as your account exists. Email us to request your account and associated data be deleted.",
  },
  {
    title: "Security",
    body: "Passwords are hashed (never stored or logged in plain text). We take reasonable steps to protect your data, but no online service can guarantee absolute security.",
  },
  {
    title: "Contact",
    body: "Questions about this policy or your data? Email gmallang@charlotte.edu or ksaifeld@charlotte.edu.",
  },
];

export function PrivacyPage() {
  return (
    <div className={s.pPage}>
      <section className={s.pHero}>
        <img className={s.pHeroLogo} src={ninerLogo} alt="NinerMarket" />
        <span className={s.pHeroName}>NinerMarket</span>
        <h1 className={s.pHeroTitle}>Privacy Policy</h1>
        <p className={s.pHeroSub}>What we collect, why, and who can see it.</p>
      </section>

      <section className={s.pSection}>
        {SECTIONS.map((sec, i) => (
          <div key={sec.title} className={s.pBlock}>
            <h2 className={s.pBlockTitle}>
              {i + 1}. {sec.title}
            </h2>
            <p className={s.pBlockBody}>{sec.body}</p>
          </div>
        ))}
      </section>

      <footer className={s.pFooter}>
        <Link to="/about" className={s.pFooterLink}>
          About
        </Link>
        <span>·</span>
        <Link to="/privacy" className={s.pFooterLink}>
          Privacy
        </Link>
        <span>·</span>
        <Link to="/login" className={s.pFooterLink}>
          Terms
        </Link>
        <span>·</span>
        <span>© 2026 NinerMarket</span>
      </footer>
    </div>
  );
}
