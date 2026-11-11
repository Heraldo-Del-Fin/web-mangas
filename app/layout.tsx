import type { Metadata } from "next";
import { Suspense } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import "./globals.css";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://kurumanga.dheraldo.workers.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "KuraManga — Leer Manga, Manhwa y Manhua Online en Español",
    template: "%s | KuraManga",
  },
  description:
    "Lee manga, manhwa, manhua y novelas online en español gratis y en alta calidad. Biblioteca editorial con lector en cascada (webtoon) y paginado, capítulos actualizados y traducciones directas de scanlations.",
  applicationName: "KuraManga",
  keywords: [
    "manga en español",
    "leer manga online",
    "manhwa en español",
    "manhua online",
    "lector de manga",
    "scanlations",
    "webtoon español",
    "shounen",
    "seinen",
    "kuramanga",
    "leer comics online",
    "mangas gratis",
  ],
  authors: [{ name: "KuraManga Editorial" }],
  creator: "KuraManga",
  publisher: "KuraManga",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: "KuraManga",
    title: "KuraManga — Biblioteca y Lector de Manga, Manhwa y Manhua en Español",
    description:
      "Directorio editorial y lector online de mangas, manhwas y novelas en español. Modo cascada continuo y paginado con catálogo clasificado por demografías y géneros.",
  },
  twitter: {
    card: "summary_large_image",
    title: "KuraManga — Leer Manga y Manhwa Online",
    description:
      "Catálogo editorial de mangas, manhwas y manhuas en español con lector de alta velocidad.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const jsonLdWebsite = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "KuraManga",
    url: SITE_URL,
    description:
      "Biblioteca y lector de manga, manhwa y manhua en español con lector en cascada y paginado.",
    inLanguage: "es",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/biblioteca?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="es" className="h-full antialiased">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2527032665600488"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }}
        />
      </head>
      <body className="flex min-h-full flex-col bg-[#f4f5f7] font-sans text-zinc-900">
        <Suspense
          fallback={
            <div className="h-16 border-b border-zinc-300 bg-white" />
          }
        >
          <Navbar />
        </Suspense>
        <div className="flex-1">{children}</div>
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </body>
    </html>
  );
}
