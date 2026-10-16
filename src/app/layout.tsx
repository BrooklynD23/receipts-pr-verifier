import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Receipts PR Verifier",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <header className="border-b border-gray-200 px-4 py-3">
          <nav aria-label="Main" className="flex gap-4">
            <Link href="/" className="underline">
              Home
            </Link>
            <Link href="/results" className="underline">
              Results
            </Link>
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-4xl px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
