import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Bible Ready — Genesis study & quiz",
  description: "Study and quiz app for the book of Genesis, built for youth ministry and Bible study groups.",
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
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <nav className="top no-print">
          <Link href="/" style={{ fontFamily: "var(--font-voice)", fontWeight: 600 }}>
            Bible Ready
          </Link>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <Link href="/study/chapters" className="btn">Study</Link>
            <Link href="/search" className="btn">Search</Link>
            <ThemeToggle />
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
