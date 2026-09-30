"use client";

/** Last-resort boundary for errors thrown by the root layout itself. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, background: "#f8f7f4", color: "#1b1b19" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#7a7972" }}>Please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 12, padding: "9px 16px", borderRadius: 8, border: 0, background: "#1f5f4f", color: "#fff", fontSize: 14, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
