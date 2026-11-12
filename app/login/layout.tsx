import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar sesión", description: "Accede a tu cuenta de KuruManga.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) { return children; }
