import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: {
    template: "%s • BookWorm",
    default: "BookWorm — Git-like Version Control for Structured Notes",
  },
  description: "Collaborative, block-structured note platform with Content-Addressed Storage, zero-cost forking, deterministic block locking, and Git-like branching.",
  keywords: [
    "BookWorm",
    "Version Control for Notes",
    "Git for Notes",
    "Content-Addressed Storage",
    "Collaborative Notes",
    "LexoRank",
    "Next.js",
    "PostgreSQL",
  ],
  authors: [{ name: "BookWorm Team" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://bookworm.dev",
    siteName: "BookWorm",
    title: "BookWorm — Git-like Version Control for Structured Notes",
    description: "Branch, collaborate, and version control your modular notes with 3-layer Content-Addressed Storage.",
  },
  twitter: {
    card: "summary_large_image",
    title: "BookWorm — Git-like Version Control for Structured Notes",
    description: "Collaborative, block-structured notes with Git branching & CAS deduplication.",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
        {/* Screen Reader Accessibility Skip Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 z-50 px-4 py-2 rounded-lg bg-emerald-500 text-zinc-950 font-bold text-xs shadow-xl outline-none"
        >
          Skip to main content
        </a>
        <div id="main-content" className="min-h-full flex flex-col flex-1">
          {children}
        </div>
      </body>
    </html>
  );
}
