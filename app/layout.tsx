import type { Metadata } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Bible Ready",
  description: "Study and quiz app for the Bible's main events and storyline, built for youth ministry and Bible study groups.",
};

// Set the theme before paint to avoid a light/dark flash. Reads the same
// localStorage key ThemeToggle writes to.
const themeInitScript = `
try {
  var t = localStorage.getItem('bible-ready:theme');
  if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#faf6ef" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#14120f" media="(prefers-color-scheme: dark)" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">Skip to content</a>
        <div className="nav-bar no-print">
          <nav className="top">
            <Link href="/" className="btn" style={{ width: "44px", padding: 0 }} aria-label="Home">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <ThemeToggle />
            </div>
          </nav>
        </div>
        <div id="main-content">{children}</div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
