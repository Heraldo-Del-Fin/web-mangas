export function createCoverDataUri({
  title,
  subtitle,
  primaryColor,
  secondaryColor,
  accentColor,
  badge,
}: {
  title: string;
  subtitle: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  badge: string;
}): string {
  const safeTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeSub = subtitle.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeBadge = badge.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const words = safeTitle.split(" ");
  const line1 = words.slice(0, 2).join(" ");
  const line2 = words.slice(2, 5).join(" ");
  const line3 = words.slice(5).join(" ");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${primaryColor}" />
        <stop offset="55%" stop-color="${secondaryColor}" />
        <stop offset="100%" stop-color="#090d16" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="38%" r="48%">
        <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.55" />
        <stop offset="100%" stop-color="${accentColor}" stop-opacity="0" />
      </radialGradient>
      <pattern id="halftone" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="1.5" fill="#ffffff" fill-opacity="0.07" />
        <circle cx="16" cy="16" r="1.5" fill="#ffffff" fill-opacity="0.05" />
      </pattern>
    </defs>
    <rect width="600" height="900" fill="url(#bg)" />
    <rect width="600" height="900" fill="url(#halftone)" />
    <circle cx="300" cy="340" r="240" fill="url(#glow)" />
    <!-- Manga speed lines & geometric emblem -->
    <g stroke="${accentColor}" stroke-opacity="0.28" stroke-width="2">
      <line x1="0" y1="120" x2="600" y2="480" />
      <line x1="0" y1="480" x2="600" y2="160" />
      <circle cx="300" cy="340" r="165" fill="none" stroke-width="3" />
      <circle cx="300" cy="340" r="130" fill="none" stroke-dasharray="12 8" />
    </g>
    <!-- Stylized Character Silhouette / Emblem -->
    <path d="M300 185 L370 315 L330 330 L385 450 L295 385 L215 450 L270 330 L230 315 Z" fill="${accentColor}" fill-opacity="0.35" stroke="#ffffff" stroke-opacity="0.5" stroke-width="2" />
    <!-- Top Japanese / Korean stylized watermark -->
    <text x="45" y="110" fill="#ffffff" fill-opacity="0.14" font-family="sans-serif" font-weight="900" font-size="72" letter-spacing="6">${safeBadge}</text>
    <!-- Bottom gradient overlay -->
    <linearGradient id="darkBottom" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#090d16" stop-opacity="0" />
      <stop offset="35%" stop-color="#090d16" stop-opacity="0.82" />
      <stop offset="100%" stop-color="#05070c" stop-opacity="0.98" />
    </linearGradient>
    <rect x="0" y="480" width="600" height="420" fill="url(#darkBottom)" />
    <!-- Accent bar -->
    <rect x="44" y="610" width="76" height="6" rx="3" fill="${accentColor}" />
    <!-- Title text -->
    <text x="44" y="670" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="44" letter-spacing="-0.5">${line1}</text>
    <text x="44" y="724" fill="#f8fafc" font-family="sans-serif" font-weight="800" font-size="40" letter-spacing="-0.5">${line2}</text>
    <text x="44" y="774" fill="${accentColor}" font-family="sans-serif" font-weight="700" font-size="34">${line3}</text>
    <text x="44" y="835" fill="#94a3b8" font-family="sans-serif" font-weight="600" font-size="20" letter-spacing="2">${safeSub.toUpperCase()}</text>
    <rect x="18" y="18" width="564" height="864" rx="14" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="2" />
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function createMangaPageDataUri({
  mangaTitle,
  chapterNumber,
  pageNumber,
  totalPages,
  accentColor = "#38bdf8",
  dialogue1,
  dialogue2,
  sfx,
}: {
  mangaTitle: string;
  chapterNumber: number;
  pageNumber: number;
  totalPages: number;
  accentColor?: string;
  dialogue1: string;
  dialogue2: string;
  sfx: string;
}): string {
  const safeTitle = mangaTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeD1 = dialogue1.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeD2 = dialogue2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeSfx = sfx.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1350" width="900" height="1350">
    <defs>
      <pattern id="screentone" width="12" height="12" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r="1.3" fill="#1e293b" fill-opacity="0.18" />
      </pattern>
      <linearGradient id="panelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
    </defs>
    <!-- Paper background -->
    <rect width="900" height="1350" fill="#f8fafc" />
    <rect x="28" y="28" width="844" height="1294" fill="none" stroke="#0f172a" stroke-width="4" />

    <!-- Header info -->
    <text x="52" y="64" fill="#475569" font-family="sans-serif" font-weight="700" font-size="18">${safeTitle} — Capítulo ${chapterNumber}</text>
    <text x="848" y="64" text-anchor="end" fill="#475569" font-family="sans-serif" font-weight="700" font-size="18">Pág. ${pageNumber} / ${totalPages}</text>

    <!-- Panel 1 (Top Wide Action Panel) -->
    <g>
      <rect x="52" y="84" width="796" height="390" fill="url(#panelGrad)" stroke="#0f172a" stroke-width="5" />
      <!-- Action speedlines -->
      <g stroke="#ffffff" stroke-opacity="0.18" stroke-width="2">
        <line x1="52" y1="100" x2="450" y2="280" />
        <line x1="52" y1="220" x2="450" y2="280" />
        <line x1="52" y1="380" x2="450" y2="280" />
        <line x1="848" y1="110" x2="450" y2="280" />
        <line x1="848" y1="260" x2="450" y2="280" />
        <line x1="848" y1="430" x2="450" y2="280" />
      </g>
      <circle cx="450" cy="280" r="115" fill="${accentColor}" fill-opacity="0.22" stroke="${accentColor}" stroke-width="3" />
      <path d="M450 155 L495 255 L590 275 L505 335 L525 430 L450 375 L375 430 L395 335 L310 275 L405 255 Z" fill="#ffffff" fill-opacity="0.14" stroke="#ffffff" stroke-width="2" />
      <!-- SFX -->
      <text x="110" y="425" fill="${accentColor}" stroke="#0f172a" stroke-width="4" font-family="sans-serif" font-weight="900" font-style="italic" font-size="68" letter-spacing="4">${safeSfx}</text>
      <!-- Speech bubble 1 -->
      <ellipse cx="670" cy="185" rx="145" ry="68" fill="#ffffff" stroke="#0f172a" stroke-width="4" />
      <polygon points="575,235 530,275 615,248" fill="#ffffff" stroke="#0f172a" stroke-width="4" />
      <text x="670" y="180" text-anchor="middle" fill="#0f172a" font-family="sans-serif" font-weight="800" font-size="19">${safeD1.slice(0, 28)}</text>
      <text x="670" y="206" text-anchor="middle" fill="#334155" font-family="sans-serif" font-weight="700" font-size="17">${safeD1.slice(28, 60)}</text>
    </g>

    <!-- Panel 2 (Middle Left Close-up) -->
    <g>
      <polygon points="52,498 465,498 425,885 52,885" fill="#ffffff" stroke="#0f172a" stroke-width="5" />
      <polygon points="52,498 465,498 425,885 52,885" fill="url(#screentone)" />
      <!-- Dramatic eyes/silhouette illustration -->
      <rect x="95" y="610" width="290" height="95" rx="12" fill="#0f172a" />
      <circle cx="175" cy="658" r="22" fill="${accentColor}" />
      <circle cx="305" cy="658" r="22" fill="${accentColor}" />
      <circle cx="175" cy="658" r="8" fill="#ffffff" />
      <circle cx="305" cy="658" r="8" fill="#ffffff" />
      <text x="240" y="795" text-anchor="middle" fill="#0f172a" font-family="sans-serif" font-weight="900" font-size="26">« ¡NO RETROCEDERÉ! »</text>
    </g>

    <!-- Panel 3 (Middle Right Diagonal) -->
    <g>
      <polygon points="488,498 848,498 848,885 448,885" fill="#e2e8f0" stroke="#0f172a" stroke-width="5" />
      <line x1="488" y1="520" x2="848" y2="860" stroke="#94a3b8" stroke-width="3" stroke-dasharray="10 6" />
      <circle cx="665" cy="690" r="95" fill="#0f172a" />
      <path d="M620 670 Q665 610 710 670 Q665 750 620 670 Z" fill="${accentColor}" />
      <!-- Speech bubble 2 -->
      <rect x="505" y="525" width="315" height="92" rx="22" fill="#ffffff" stroke="#0f172a" stroke-width="4" />
      <text x="662" y="566" text-anchor="middle" fill="#0f172a" font-family="sans-serif" font-weight="800" font-size="18">${safeD2.slice(0, 30)}</text>
      <text x="662" y="592" text-anchor="middle" fill="#334155" font-family="sans-serif" font-weight="700" font-size="16">${safeD2.slice(30, 64)}</text>
    </g>

    <!-- Panel 4 (Bottom Wide Climax Panel) -->
    <g>
      <rect x="52" y="910" width="796" height="360" fill="#090d16" stroke="#0f172a" stroke-width="5" />
      <circle cx="450" cy="1090" r="260" fill="${accentColor}" fill-opacity="0.16" />
      <g stroke="${accentColor}" stroke-opacity="0.35" stroke-width="2">
        <line x1="52" y1="910" x2="848" y2="1270" />
        <line x1="848" y1="910" x2="52" y2="1270" />
      </g>
      <rect x="190" y="1025" width="520" height="120" rx="16" fill="#0f172a" fill-opacity="0.9" stroke="${accentColor}" stroke-width="3" />
      <text x="450" y="1078" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-weight="900" font-size="30" letter-spacing="1">CAPÍTULO ${chapterNumber} • PÁGINA ${pageNumber}</text>
      <text x="450" y="1118" text-anchor="middle" fill="${accentColor}" font-family="sans-serif" font-weight="700" font-size="20">TMO Lector Online — Modo Cascada / Paginado</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

