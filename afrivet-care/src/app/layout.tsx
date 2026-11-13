import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ClerkProvider, UserButton } from "@clerk/nextjs";
import { Nav } from "@/components/Nav";
import { getConfig } from "@/lib/config";
import "./globals.css";

// Every screen shows per-user, live data, so nothing is pre-rendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "AFRIVet Care", template: "%s · AFRIVet Care" },
  description: "Health records, vaccinations and vet visits for your animals — in one place.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#14532d" };

export default function RootLayout({ children }: { children: ReactNode }) {
  const config = getConfig();
  const shell = (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <rect width="32" height="32" rx="9" fill="#e9b949" />
            <path d="M16 25c-4 0-6.5-1.6-6.5-4.2 0-2.4 2.8-5.3 6.5-5.3s6.5 2.9 6.5 5.3C22.5 23.4 20 25 16 25Z" fill="#14532d" />
            <ellipse cx="9.5" cy="14" rx="2" ry="2.6" fill="#14532d" />
            <ellipse cx="13.5" cy="9.8" rx="2" ry="2.6" fill="#14532d" />
            <ellipse cx="18.5" cy="9.8" rx="2" ry="2.6" fill="#14532d" />
            <ellipse cx="22.5" cy="14" rx="2" ry="2.6" fill="#14532d" />
          </svg>
          <span>AFRIVet Care</span>
        </Link>
        {config.clerk ? <UserButton /> : <span className="demo-pill">Demo</span>}
      </header>
      <Nav />
      <main className="main">
        {config.demo && (
          <p className="notice">
            <strong>Demo mode.</strong> You are looking at sample data. Changes are temporary and are not saved to a
            database.
          </p>
        )}
        {children}
      </main>
    </div>
  );

  return (
    <html lang="en">
      <body>
        {config.clerk ? (
          <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up">{shell}</ClerkProvider>
        ) : (
          shell
        )}
      </body>
    </html>
  );
}
