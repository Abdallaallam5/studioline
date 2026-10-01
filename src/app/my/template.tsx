import type { ReactNode } from "react";

/** Re-mounts on every navigation, so each page fades in softly. */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="animate-fade-up [animation-duration:0.4s]">{children}</div>;
}
