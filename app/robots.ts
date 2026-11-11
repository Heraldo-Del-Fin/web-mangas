import { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://web-mangas.serato14luis.workers.dev";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/biblioteca", "/manga/", "/leer/", "/grupos", "/grupos/"],
        disallow: [
          "/panel",
          "/panel/",
          "/api/",
          "/subir",
          "/subir/",
          "/mis-listas",
          "/mis-listas/",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: ["/panel", "/api/", "/subir"],
      },
      {
        userAgent: "Googlebot-Image",
        allow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

