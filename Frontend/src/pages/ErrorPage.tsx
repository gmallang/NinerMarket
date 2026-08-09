import { Link } from "react-router-dom";

export function ErrorPage() {
  return (
    <div
      style={{
        maxWidth: 440,
        margin: "0 auto",
        padding: "80px 24px",
        textAlign: "center",
        color: "var(--color-fg, #333)",
      }}
    >
      <h1>Something went wrong</h1>
      <p style={{ lineHeight: 1.5 }}>
        The page didn't load correctly. This usually happens right after an app update — refresh to
        pick up the latest version.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        style={{
          marginTop: 16,
          padding: "10px 20px",
          borderRadius: 8,
          border: 0,
          background: "var(--color-accent, #00704a)",
          color: "#fff",
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        Reload
      </button>
      <p style={{ marginTop: 16 }}>
        <Link to="/login">Go to login</Link>
      </p>
    </div>
  );
}
