import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crear cuenta", description: "Crea tu cuenta de lector en KuruManga.",
  alternates: { canonical: "/registro" },
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) { return children; }
