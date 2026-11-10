import type { Metadata } from "next";
import { Suspense } from "react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import "./globals.css";

export const metadata: Metadata = {
  title: "KuraManga — Biblioteca y Lector Clásico de Manga, Manhwa y Manhua",
  description:
    "Portal editorial de lectura y publicación de mangas, manhwas, manhuas y novelas en español con lector clásico en cascada y paginado.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
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
