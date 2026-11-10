import fs from "node:fs/promises";
import path from "node:path";
import { cacheLife, cacheTag } from "next/cache";
import { hashPassword } from "./crypto";
import {
  ensureNeonStoreTable,
  executeNeonQuery,
  isNeonConfigured,
} from "./neon-db";
import {
  ChapterUpload,
  Demography,
  Manga,
  ScanlationGroup,
  ScanlationMember,
  UploaderRequest,
  UserAccount,
  UserLibraryRecord,
  UserSession,
  WorkStatus,
  WorkType,
} from "./types";
import {
  createCoverDataUri,
  createMangaPageDataUri,
} from "./svg-placeholders";

export interface DatabaseSchema {
  mangas: Manga[];
  scanlations: ScanlationGroup[];
  users: UserAccount[];
  sessions: UserSession[];
  scanlationMembers: ScanlationMember[];
  uploaderRequests: UploaderRequest[];
  userLibrary: UserLibraryRecord[];
}

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "mangas-db.json");

function buildSamplePages(
  mangaTitle: string,
  chapterNumber: number,
  accentColor: string,
  count = 5
): string[] {
  const dialogues = [
    [
      "¡El sello ancestral se está rompiendo!",
      "Si cruzamos esta puerta no habrá vuelta atrás...",
      "¡ZAAASH!",
    ],
    [
      "Su energía espiritual supera el rango S.",
      "Prepárense, el guardián ha despertado.",
      "¡DOOOM!",
    ],
    [
      "¿Creías que ese ataque bastaría para derrotarme?",
      "Aún no has visto mi verdadera técnica.",
      "¡SHING!",
    ],
    [
      "¡Ahora! ¡Concentra todo el maná en la espada!",
      "Por todos los que quedaron atrás...",
      "¡KRAKOOM!",
    ],
    [
      "El piso 100 de la torre finalmente se abre.",
      "Continuará en el próximo capítulo...",
      "¡BAM!",
    ],
  ];

  return Array.from({ length: count }, (_, idx) => {
    const [d1, d2, sfx] = dialogues[idx % dialogues.length];
    return createMangaPageDataUri({
      mangaTitle,
      chapterNumber,
      pageNumber: idx + 1,
      totalPages: count,
      accentColor,
      dialogue1: d1,
      dialogue2: d2,
      sfx,
    });
  });
}

function getInitialSeedData(): DatabaseSchema {
  const scanlations: ScanlationGroup[] = [
    {
      id: "scan-1",
      name: "Ragnarok Scanlation",
      slug: "ragnarok-scanlation",
      verified: true,
      description:
        "Especialistas en Manhwas de acción, mazmorras y reencarnación al español neutro con limpieza HD.",
      discord: "discord.gg/ragnarokscan",
      website: "https://ragnarokscan.example.com",
      membersCount: 28,
      uploadsCount: 412,
    },
    {
      id: "scan-2",
      name: "Nocturne Traducciones",
      slug: "nocturne-traducciones",
      verified: true,
      description:
        "Traducciones directas del japonés de mangas Seinen, psicológicos y fantasía oscura.",
      discord: "discord.gg/nocturnetrad",
      membersCount: 19,
      uploadsCount: 285,
    },
    {
      id: "scan-3",
      name: "Sakura Moon Fansub",
      slug: "sakura-moon-fansub",
      verified: true,
      description:
        "El hogar del Shoujo, Josei, villanas reencarnadas y comedias románticas.",
      membersCount: 22,
      uploadsCount: 340,
    },
    {
      id: "scan-4",
      name: "Dragón Celeste Scan",
      slug: "dragon-celeste-scan",
      verified: false,
      description:
        "Cultivación, artes marciales y Manhuas de fantasía oriental actualizados a diario.",
      membersCount: 14,
      uploadsCount: 198,
    },
  ];

  const coverSoloMonarch = createCoverDataUri({
    title: "Crónicas del Monarca de las Sombras",
    subtitle: "Sung & Jin • Fantasía Oscura",
    primaryColor: "#0f172a",
    secondaryColor: "#1e1b4b",
    accentColor: "#38bdf8",
    badge: "MANHWA",
  });

  const coverEclipse = createCoverDataUri({
    title: "Berserker del Eclipse Carmesí",
    subtitle: "Kentaro Takahashi • Seinen",
    primaryColor: "#2a0808",
    secondaryColor: "#450a0a",
    accentColor: "#f43f5e",
    badge: "SEINEN",
  });

  const coverVillana = createCoverDataUri({
    title: "La Villana Domó al Emperador Tirano",
    subtitle: "Han So-Hee • Romance Fantasía",
    primaryColor: "#3b0764",
    secondaryColor: "#500724",
    accentColor: "#f472b6",
    badge: "SHOUJO",
  });

  const coverCultivador = createCoverDataUri({
    title: "Retorno del Inmortal Celestial",
    subtitle: "Chen Dong • Artes Marciales",
    primaryColor: "#064e3b",
    secondaryColor: "#0f172a",
    accentColor: "#fbbf24",
    badge: "MANHUA",
  });

  const coverCiber = createCoverDataUri({
    title: "Neo Tokyo Protocolo Cero",
    subtitle: "Akira Sato • Cyberpunk",
    primaryColor: "#090d16",
    secondaryColor: "#164e63",
    accentColor: "#22d3ee",
    badge: "MANGA",
  });

  const coverAlquimista = createCoverDataUri({
    title: "El Último Alquimista de la Torre",
    subtitle: "Yuuichirou Ren • Shounen",
    primaryColor: "#431407",
    secondaryColor: "#1e293b",
    accentColor: "#fb923c",
    badge: "SHOUNEN",
  });

  const coverCafeteria = createCoverDataUri({
    title: "Café de Medianoche en Shibuya",
    subtitle: "Mika Hoshino • Josei",
    primaryColor: "#2e1065",
    secondaryColor: "#1e1b4b",
    accentColor: "#c084fc",
    badge: "JOSEI",
  });

  const coverHorizonte = createCoverDataUri({
    title: "Ecos del Horizonte Estelar",
    subtitle: "Haruka Kujo • One Shot",
    primaryColor: "#0c4a6e",
    secondaryColor: "#1e1b4b",
    accentColor: "#a855f7",
    badge: "ONE SHOT",
  });

  const mangas: Manga[] = [
    {
      id: "manga-1",
      slug: "cronicas-del-monarca-de-las-sombras",
      title: "Crónicas del Monarca de las Sombras",
      altTitles: [
        "Chronicles of the Shadow Monarch",
        "그림자 군주의 연대기",
      ],
      synopsis:
        "Hace diez años apareció el primer Portal conectando nuestro mundo con dimensiones llenas de monstruos. Jin-Woo, un cazador de rango E apenas capaz de sobrevivir, entra en una mazmorra doble oculta y recibe el 'Sistema del Monarca', otorgándole la habilidad única de levantar un ejército de sombras de los enemigos caídos.",
      coverUrl: coverSoloMonarch,
      bannerUrl: coverSoloMonarch,
      type: "MANHWA",
      demography: "SHOUNEN",
      status: "EN_PUBLICACION",
      author: "Chugong / Studio Red",
      artist: "Dubu Art",
      releaseYear: 2024,
      genres: ["Acción", "Fantasía", "Aventura", "Sobrenatural", "Superpoderes"],
      rating: 4.92,
      votesCount: 3420,
      views: 194500,
      createdAt: "2026-10-15T12:00:00Z",
      chapters: [
        {
          id: "ch-101",
          mangaId: "manga-1",
          number: 1,
          title: "El Cazador más débil de la humanidad",
          createdAt: "2026-11-01T14:00:00Z",
          uploads: [
            {
              id: "up-1001",
              chapterId: "ch-101",
              mangaId: "manga-1",
              mangaSlug: "cronicas-del-monarca-de-las-sombras",
              mangaTitle: "Crónicas del Monarca de las Sombras",
              mangaCover: coverSoloMonarch,
              mangaType: "MANHWA",
              mangaDemography: "SHOUNEN",
              chapterNumber: 1,
              chapterTitle: "El Cazador más débil de la humanidad",
              scanlationId: "scan-1",
              scanlationName: "Ragnarok Scanlation",
              language: "ES",
              pages: buildSamplePages(
                "Crónicas del Monarca de las Sombras",
                1,
                "#38bdf8",
                5
              ),
              views: 14200,
              createdAt: "2026-11-01T14:00:00Z",
            },
            {
              id: "up-1002",
              chapterId: "ch-101",
              mangaId: "manga-1",
              mangaSlug: "cronicas-del-monarca-de-las-sombras",
              mangaTitle: "Crónicas del Monarca de las Sombras",
              mangaCover: coverSoloMonarch,
              mangaType: "MANHWA",
              mangaDemography: "SHOUNEN",
              chapterNumber: 1,
              chapterTitle: "El Cazador más débil de la humanidad",
              scanlationId: "scan-2",
              scanlationName: "Nocturne Traducciones",
              language: "ES",
              pages: buildSamplePages(
                "Crónicas del Monarca de las Sombras",
                1,
                "#818cf8",
                5
              ),
              views: 5830,
              createdAt: "2026-11-02T09:30:00Z",
            },
          ],
        },
        {
          id: "ch-102",
          mangaId: "manga-1",
          number: 2,
          title: "El Templo Cartenon y las Leyes Absolutas",
          createdAt: "2026-11-06T18:20:00Z",
          uploads: [
            {
              id: "up-1003",
              chapterId: "ch-102",
              mangaId: "manga-1",
              mangaSlug: "cronicas-del-monarca-de-las-sombras",
              mangaTitle: "Crónicas del Monarca de las Sombras",
              mangaCover: coverSoloMonarch,
              mangaType: "MANHWA",
              mangaDemography: "SHOUNEN",
              chapterNumber: 2,
              chapterTitle: "El Templo Cartenon y las Leyes Absolutas",
              scanlationId: "scan-1",
              scanlationName: "Ragnarok Scanlation",
              language: "ES",
              pages: buildSamplePages(
                "Crónicas del Monarca de las Sombras",
                2,
                "#38bdf8",
                5
              ),
              views: 11890,
              createdAt: "2026-11-06T18:20:00Z",
            },
          ],
        },
        {
          id: "ch-103",
          mangaId: "manga-1",
          number: 3,
          title: "¡Surge de la oscuridad!",
          createdAt: "2026-11-10T02:15:00Z",
          uploads: [
            {
              id: "up-1004",
              chapterId: "ch-103",
              mangaId: "manga-1",
              mangaSlug: "cronicas-del-monarca-de-las-sombras",
              mangaTitle: "Crónicas del Monarca de las Sombras",
              mangaCover: coverSoloMonarch,
              mangaType: "MANHWA",
              mangaDemography: "SHOUNEN",
              chapterNumber: 3,
              chapterTitle: "¡Surge de la oscuridad!",
              scanlationId: "scan-1",
              scanlationName: "Ragnarok Scanlation",
              language: "ES",
              pages: buildSamplePages(
                "Crónicas del Monarca de las Sombras",
                3,
                "#38bdf8",
                6
              ),
              views: 8420,
              createdAt: "2026-11-10T02:15:00Z",
            },
          ],
        },
      ],
    },
    {
      id: "manga-2",
      slug: "berserker-del-eclipse-carmesi",
      title: "Berserker del Eclipse Carmesí",
      altTitles: ["Crimson Eclipse Berserker", "紅の蝕の狂戦士"],
      synopsis:
        "Marcado con el estigma del sacrificio tras la traición de su antiguo camarada de armas, Kael empuña un mandoble de hierro maldito capaz de desgarrar apóstoles inmortales. Una epopeya de fantasía oscura sobre la voluntad humana frente al destino.",
      coverUrl: coverEclipse,
      bannerUrl: coverEclipse,
      type: "MANGA",
      demography: "SEINEN",
      status: "EN_PUBLICACION",
      author: "Kentaro Takahashi",
      artist: "Kentaro Takahashi",
      releaseYear: 2022,
      genres: ["Acción", "Fantasía", "Drama", "Horror", "Psicológico", "Tragedia"],
      rating: 4.95,
      votesCount: 4180,
      views: 215000,
      createdAt: "2026-09-20T10:00:00Z",
      chapters: [
        {
          id: "ch-201",
          mangaId: "manga-2",
          number: 1,
          title: "El Espadachín Negro bajo la lluvia",
          createdAt: "2026-11-04T20:00:00Z",
          uploads: [
            {
              id: "up-2001",
              chapterId: "ch-201",
              mangaId: "manga-2",
              mangaSlug: "berserker-del-eclipse-carmesi",
              mangaTitle: "Berserker del Eclipse Carmesí",
              mangaCover: coverEclipse,
              mangaType: "MANGA",
              mangaDemography: "SEINEN",
              chapterNumber: 1,
              chapterTitle: "El Espadachín Negro bajo la lluvia",
              scanlationId: "scan-2",
              scanlationName: "Nocturne Traducciones",
              language: "ES",
              pages: buildSamplePages(
                "Berserker del Eclipse Carmesí",
                1,
                "#f43f5e",
                5
              ),
              views: 9640,
              createdAt: "2026-11-04T20:00:00Z",
            },
          ],
        },
        {
          id: "ch-202",
          mangaId: "manga-2",
          number: 2,
          title: "La Marca del Sacrificio",
          createdAt: "2026-11-09T23:40:00Z",
          uploads: [
            {
              id: "up-2002",
              chapterId: "ch-202",
              mangaId: "manga-2",
              mangaSlug: "berserker-del-eclipse-carmesi",
              mangaTitle: "Berserker del Eclipse Carmesí",
              mangaCover: coverEclipse,
              mangaType: "MANGA",
              mangaDemography: "SEINEN",
              chapterNumber: 2,
              chapterTitle: "La Marca del Sacrificio",
              scanlationId: "scan-2",
              scanlationName: "Nocturne Traducciones",
              language: "ES",
              pages: buildSamplePages(
                "Berserker del Eclipse Carmesí",
                2,
                "#f43f5e",
                5
              ),
              views: 6120,
              createdAt: "2026-11-09T23:40:00Z",
            },
          ],
        },
      ],
    },
    {
      id: "manga-3",
      slug: "la-villana-domo-al-emperador-tirano",
      title: "La Villana Domó al Emperador Tirano",
      altTitles: ["The Villainess Tamed the Tyrant Emperor", "악녀는 폭군 황제를 길들였다"],
      synopsis:
        "Tras despertar dentro de su novela favorita como Roselia, la villana condenada a la guillotina en el primer acto, decide cambiar su destino proponiendo un matrimonio contractual al temido Duque del Norte antes de que ascienda al trono imperial.",
      coverUrl: coverVillana,
      bannerUrl: coverVillana,
      type: "MANHWA",
      demography: "SHOUJO",
      status: "EN_PUBLICACION",
      author: "Han So-Hee",
      artist: "Yuna Kim",
      releaseYear: 2025,
      genres: ["Romance", "Fantasía", "Reencarnación", "Drama", "Comedia"],
      rating: 4.78,
      votesCount: 1920,
      views: 112400,
      createdAt: "2026-10-01T08:00:00Z",
      chapters: [
        {
          id: "ch-301",
          mangaId: "manga-3",
          number: 1,
          title: "Un contrato antes de la ejecución",
          createdAt: "2026-11-09T19:10:00Z",
          uploads: [
            {
              id: "up-3001",
              chapterId: "ch-301",
              mangaId: "manga-3",
              mangaSlug: "la-villana-domo-al-emperador-tirano",
              mangaTitle: "La Villana Domó al Emperador Tirano",
              mangaCover: coverVillana,
              mangaType: "MANHWA",
              mangaDemography: "SHOUJO",
              chapterNumber: 1,
              chapterTitle: "Un contrato antes de la ejecución",
              scanlationId: "scan-3",
              scanlationName: "Sakura Moon Fansub",
              language: "ES",
              pages: buildSamplePages(
                "La Villana Domó al Emperador Tirano",
                1,
                "#f472b6",
                5
              ),
              views: 7340,
              createdAt: "2026-11-09T19:10:00Z",
            },
          ],
        },
      ],
    },
    {
      id: "manga-4",
      slug: "retorno-del-inmortal-celestial",
      title: "Retorno del Inmortal Celestial",
      altTitles: ["Return of the Celestial Immortal", "天仙归来"],
      synopsis:
        "Traicionado por las Siete Sectas Ortodoxas tras alcanzar el Reino de la Ascensión Divina, el Patriarca Lin Feng reencarna 500 años en el pasado en el cuerpo de un discípulo descartado. Con sus memorias intactas, reconstruirá su camino hacia la cima del continente marcial.",
      coverUrl: coverCultivador,
      bannerUrl: coverCultivador,
      type: "MANHUA",
      demography: "SHOUNEN",
      status: "EN_PUBLICACION",
      author: "Chen Dong",
      artist: "Cloud Dragon Studio",
      releaseYear: 2024,
      genres: ["Artes Marciales", "Acción", "Aventura", "Reencarnación", "Fantasía"],
      rating: 4.65,
      votesCount: 1450,
      views: 98300,
      createdAt: "2026-10-08T15:30:00Z",
      chapters: [
        {
          id: "ch-401",
          mangaId: "manga-4",
          number: 1,
          title: "Quinientos años después",
          createdAt: "2026-11-09T15:00:00Z",
          uploads: [
            {
              id: "up-4001",
              chapterId: "ch-401",
              mangaId: "manga-4",
              mangaSlug: "retorno-del-inmortal-celestial",
              mangaTitle: "Retorno del Inmortal Celestial",
              mangaCover: coverCultivador,
              mangaType: "MANHUA",
              mangaDemography: "SHOUNEN",
              chapterNumber: 1,
              chapterTitle: "Quinientos años después",
              scanlationId: "scan-4",
              scanlationName: "Dragón Celeste Scan",
              language: "ES",
              pages: buildSamplePages(
                "Retorno del Inmortal Celestial",
                1,
                "#fbbf24",
                5
              ),
              views: 4920,
              createdAt: "2026-11-09T15:00:00Z",
            },
          ],
        },
      ],
    },
    {
      id: "manga-5",
      slug: "neo-tokyo-protocolo-cero",
      title: "Neo Tokyo Protocolo Cero",
      altTitles: ["Neo Tokyo Protocol Zero", "ネオ東京プロトコル・ゼロ"],
      synopsis:
        "En el año 2099, los recuerdos humanos pueden almacenarse y venderse en el mercado negro de Neo Tokyo. Una detective cibernética descubre un virus neuronal que está reescribiendo la identidad de los altos ejecutivos de la megacorporación Aegis.",
      coverUrl: coverCiber,
      bannerUrl: coverCiber,
      type: "MANGA",
      demography: "SEINEN",
      status: "FINALIZADO",
      author: "Akira Sato",
      artist: "Kenji Mori",
      releaseYear: 2023,
      genres: ["Ciencia Ficción", "Misterio", "Psicológico", "Acción", "Mecha"],
      rating: 4.84,
      votesCount: 2110,
      views: 134200,
      createdAt: "2026-08-12T11:00:00Z",
      chapters: [
        {
          id: "ch-501",
          mangaId: "manga-5",
          number: 1,
          title: "Fantasma en la Red Neural",
          createdAt: "2026-11-08T21:00:00Z",
          uploads: [
            {
              id: "up-5001",
              chapterId: "ch-501",
              mangaId: "manga-5",
              mangaSlug: "neo-tokyo-protocolo-cero",
              mangaTitle: "Neo Tokyo Protocolo Cero",
              mangaCover: coverCiber,
              mangaType: "MANGA",
              mangaDemography: "SEINEN",
              chapterNumber: 1,
              chapterTitle: "Fantasma en la Red Neural",
              scanlationId: "scan-2",
              scanlationName: "Nocturne Traducciones",
              language: "ES",
              pages: buildSamplePages(
                "Neo Tokyo Protocolo Cero",
                1,
                "#22d3ee",
                5
              ),
              views: 5390,
              createdAt: "2026-11-08T21:00:00Z",
            },
          ],
        },
      ],
    },
    {
      id: "manga-6",
      slug: "el-ultimo-alquimista-de-la-torre",
      title: "El Último Alquimista de la Torre",
      altTitles: ["The Last Alchemist of the Tower"],
      synopsis:
        "Cuando la magia de combate reemplazó a la alquimia antigua, todos los talleres fueron clausurados. Sin embargo, el joven Leo hereda el grimorio prohibido de transmutación estelar capaz de forjar reliquias vivientes.",
      coverUrl: coverAlquimista,
      bannerUrl: coverAlquimista,
      type: "MANGA",
      demography: "SHOUNEN",
      status: "EN_PUBLICACION",
      author: "Yuuichirou Ren",
      artist: "Yuuichirou Ren",
      releaseYear: 2025,
      genres: ["Aventura", "Fantasía", "Magia", "Acción", "Comedia"],
      rating: 4.71,
      votesCount: 980,
      views: 68900,
      createdAt: "2026-10-19T16:00:00Z",
      chapters: [
        {
          id: "ch-601",
          mangaId: "manga-6",
          number: 1,
          title: "La Forja de Ceniza",
          createdAt: "2026-11-08T12:45:00Z",
          uploads: [
            {
              id: "up-6001",
              chapterId: "ch-601",
              mangaId: "manga-6",
              mangaSlug: "el-ultimo-alquimista-de-la-torre",
              mangaTitle: "El Último Alquimista de la Torre",
              mangaCover: coverAlquimista,
              mangaType: "MANGA",
              mangaDemography: "SHOUNEN",
              chapterNumber: 1,
              chapterTitle: "La Forja de Ceniza",
              scanlationId: "scan-1",
              scanlationName: "Ragnarok Scanlation",
              language: "ES",
              pages: buildSamplePages(
                "El Último Alquimista de la Torre",
                1,
                "#fb923c",
                5
              ),
              views: 4120,
              createdAt: "2026-11-08T12:45:00Z",
            },
          ],
        },
      ],
    },
    {
      id: "manga-7",
      slug: "cafe-de-medianoche-en-shibuya",
      title: "Café de Medianoche en Shibuya",
      altTitles: ["Midnight Cafe in Shibuya", "渋谷の真夜中カフェ"],
      synopsis:
        "Entre callejones iluminados por neón en Shibuya existe una cafetería que solo abre de 00:00 a 05:00 AM. Baristas, músicos callejeros y oficinistas agotados cruzan sus vidas mientras buscan una segunda oportunidad en el amor y sus carreras.",
      coverUrl: coverCafeteria,
      bannerUrl: coverCafeteria,
      type: "MANGA",
      demography: "JOSEI",
      status: "EN_PUBLICACION",
      author: "Mika Hoshino",
      artist: "Mika Hoshino",
      releaseYear: 2025,
      genres: ["Romance", "Recuentos de la vida", "Drama"],
      rating: 4.81,
      votesCount: 860,
      views: 51400,
      createdAt: "2026-10-22T19:00:00Z",
      chapters: [
        {
          id: "ch-701",
          mangaId: "manga-7",
          number: 1,
          title: "Espresso para dos desconocidos",
          createdAt: "2026-11-07T22:10:00Z",
          uploads: [
            {
              id: "up-7001",
              chapterId: "ch-701",
              mangaId: "manga-7",
              mangaSlug: "cafe-de-medianoche-en-shibuya",
              mangaTitle: "Café de Medianoche en Shibuya",
              mangaCover: coverCafeteria,
              mangaType: "MANGA",
              mangaDemography: "JOSEI",
              chapterNumber: 1,
              chapterTitle: "Espresso para dos desconocidos",
              scanlationId: "scan-3",
              scanlationName: "Sakura Moon Fansub",
              language: "ES",
              pages: buildSamplePages(
                "Café de Medianoche en Shibuya",
                1,
                "#c084fc",
                5
              ),
              views: 3150,
              createdAt: "2026-11-07T22:10:00Z",
            },
          ],
        },
      ],
    },
    {
      id: "manga-8",
      slug: "ecos-del-horizonte-estelar",
      title: "Ecos del Horizonte Estelar",
      altTitles: ["Echoes of the Starry Horizon"],
      synopsis:
        "Un emotivo One-Shot premiado sobre una joven astrónoma en una Tierra inundada que recibe transmisiones de radio enviadas desde una colonia espacial abandonada hace medio siglo.",
      coverUrl: coverHorizonte,
      bannerUrl: coverHorizonte,
      type: "ONE_SHOT",
      demography: "SEINEN",
      status: "FINALIZADO",
      author: "Haruka Kujo",
      artist: "Haruka Kujo",
      releaseYear: 2026,
      genres: ["Ciencia Ficción", "Drama", "Recuentos de la vida", "Misterio"],
      rating: 4.89,
      votesCount: 1120,
      views: 62000,
      createdAt: "2026-10-28T10:00:00Z",
      chapters: [
        {
          id: "ch-801",
          mangaId: "manga-8",
          number: 1,
          title: "Capítulo Único: La frecuencia del recuerdo",
          createdAt: "2026-11-07T14:00:00Z",
          uploads: [
            {
              id: "up-8001",
              chapterId: "ch-801",
              mangaId: "manga-8",
              mangaSlug: "ecos-del-horizonte-estelar",
              mangaTitle: "Ecos del Horizonte Estelar",
              mangaCover: coverHorizonte,
              mangaType: "ONE_SHOT",
              mangaDemography: "SEINEN",
              chapterNumber: 1,
              chapterTitle: "Capítulo Único: La frecuencia del recuerdo",
              scanlationId: "scan-2",
              scanlationName: "Nocturne Traducciones",
              language: "ES",
              pages: buildSamplePages(
                "Ecos del Horizonte Estelar",
                1,
                "#a855f7",
                5
              ),
              views: 4410,
              createdAt: "2026-11-07T14:00:00Z",
            },
          ],
        },
      ],
    },
  ];

  const defaultAuth = getDefaultAuthSeed();
  return {
    mangas,
    scanlations,
    ...defaultAuth,
  };
}

function getDefaultAuthSeed(): {
  users: UserAccount[];
  sessions: UserSession[];
  scanlationMembers: ScanlationMember[];
  uploaderRequests: UploaderRequest[];
  userLibrary: UserLibraryRecord[];
} {
  const users: UserAccount[] = [
    {
      id: "user-admin",
      username: "AdminKura",
      email: "admin@kuramanga.com",
      passwordHash: hashPassword("admin123"),
      role: "ADMIN",
      bio: "Administrador general de KuraManga.",
      createdAt: "2026-10-01T10:00:00Z",
    },
    {
      id: "user-lider-scan1",
      username: "LiderRagnarok",
      email: "lider@ragnarok.com",
      passwordHash: hashPassword("scan123"),
      role: "UPLOADER",
      bio: "Fundador y líder de Ragnarok Scanlation.",
      createdAt: "2026-10-02T12:00:00Z",
    },
    {
      id: "user-uploader-scan2",
      username: "TraductorNocturne",
      email: "uploader@nocturne.com",
      passwordHash: hashPassword("scan123"),
      role: "READER",
      bio: "Usuario normal designado por Nocturne Traducciones como Uploader exclusivo de su grupo.",
      createdAt: "2026-10-05T15:00:00Z",
    },
    {
      id: "user-reader-1",
      username: "LectorClasico",
      email: "lector@kuramanga.com",
      passwordHash: hashPassword("lector123"),
      role: "READER",
      bio: "Lector habitual de Seinen y Manhwas.",
      createdAt: "2026-10-10T18:00:00Z",
    },
  ];

  const scanlationMembers: ScanlationMember[] = [
    {
      id: "sm-1",
      scanlationId: "scan-1",
      scanlationName: "Ragnarok Scanlation",
      userId: "user-lider-scan1",
      username: "LiderRagnarok",
      email: "lider@ragnarok.com",
      role: "SCAN_LEADER",
      addedAt: "2026-10-02T12:00:00Z",
    },
    {
      id: "sm-2",
      scanlationId: "scan-2",
      scanlationName: "Nocturne Traducciones",
      userId: "user-uploader-scan2",
      username: "TraductorNocturne",
      email: "uploader@nocturne.com",
      role: "SCAN_UPLOADER",
      addedAt: "2026-10-06T09:00:00Z",
    },
  ];

  const uploaderRequests: UploaderRequest[] = [
    {
      id: "req-101",
      userId: "user-reader-1",
      username: "LectorClasico",
      userEmail: "lector@kuramanga.com",
      type: "CREATE_SCANLATION",
      reason:
        "Somos un equipo de 4 traductores y cleaners y queremos publicar mangas clásicos de los 90 en español.",
      proposedScanName: "Avalon Classic Scan",
      proposedScanDescription:
        "Rescate y traducción de mangas clásicos Seinen y Shounen.",
      proposedScanDiscord: "discord.gg/avalonscan",
      status: "PENDING",
      createdAt: "2026-11-09T16:30:00Z",
    },
  ];

  return {
    users,
    sessions: [],
    scanlationMembers,
    uploaderRequests,
    userLibrary: [],
  };
}

export async function readDatabase(): Promise<DatabaseSchema> {
  let neonEmpty = false;
  // 1. Si Neon está configurado, intentar leer el estado sincronizado en Neon
  if (isNeonConfigured()) {
    try {
      const neonRes = await executeNeonQuery<{ payload: DatabaseSchema }>(
        "SELECT payload FROM kuramanga_store WHERE id = 'main' LIMIT 1;"
      );
      if (neonRes.ok && neonRes.rows.length > 0 && neonRes.rows[0].payload) {
        return neonRes.rows[0].payload;
      }
      if (neonRes.ok && neonRes.rows.length === 0) {
        neonEmpty = true;
      }
    } catch {
      // Fallback a espejo local si no hay conexión saliente
    }
  }

  try {
    const raw = await fs.readFile(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    const defaultAuth = getDefaultAuthSeed();

    let needsSave = neonEmpty;
    if (!parsed.users || parsed.users.length === 0) {
      parsed.users = defaultAuth.users;
      needsSave = true;
    }
    if (!parsed.sessions) {
      parsed.sessions = [];
      needsSave = true;
    }
    if (!parsed.scanlationMembers) {
      parsed.scanlationMembers = defaultAuth.scanlationMembers;
      needsSave = true;
    }
    if (!parsed.uploaderRequests) {
      parsed.uploaderRequests = defaultAuth.uploaderRequests;
      needsSave = true;
    }
    if (!parsed.userLibrary) {
      parsed.userLibrary = [];
      needsSave = true;
    }

    const fullDb = parsed as DatabaseSchema;
    if (needsSave) {
      try {
        await writeDatabase(fullDb);
      } catch {
        // ignore
      }
    }
    return fullDb;
  } catch {
    const seed = getInitialSeedData();
    try {
      await writeDatabase(seed);
    } catch {
      // Fallback if read-only filesystem
    }
    return seed;
  }
}

export async function writeDatabase(db: DatabaseSchema): Promise<void> {
  try {
    await fs.mkdir(DB_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch {
    // ignore local write errors in serverless environments
  }

  if (isNeonConfigured()) {
    try {
      await ensureNeonStoreTable();
      await executeNeonQuery(
        `INSERT INTO kuramanga_store (id, payload, updated_at)
         VALUES ('main', $1::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE
         SET payload = EXCLUDED.payload, updated_at = NOW();`,
        [JSON.stringify(db)]
      );
    } catch {
      // ignore network errors when offline
    }
  }
}

export async function getAllMangas(): Promise<Manga[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("mangas");

  const db = await readDatabase();
  return db.mangas;
}

export async function getMangaBySlug(slug: string): Promise<Manga | undefined> {
  "use cache";
  cacheLife("minutes");
  cacheTag("mangas", `manga-${slug}`);

  const db = await readDatabase();
  return db.mangas.find((m) => m.slug === slug);
}

export async function getLatestUploads(limit = 12): Promise<ChapterUpload[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("mangas", "uploads");

  const db = await readDatabase();
  const allUploads: ChapterUpload[] = [];

  for (const manga of db.mangas) {
    for (const chapter of manga.chapters) {
      for (const upload of chapter.uploads) {
        allUploads.push(upload);
      }
    }
  }

  return allUploads
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, limit);
}

export async function getUploadById(uploadId: string): Promise<{
  upload: ChapterUpload;
  manga: Manga;
  prevUploadId: string | null;
  nextUploadId: string | null;
  allChapterUploads: { chapterNumber: number; chapterTitle: string; uploadId: string }[];
} | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("mangas", "uploads", `upload-${uploadId}`);

  const db = await readDatabase();

  for (const manga of db.mangas) {
    const sortedChapters = [...manga.chapters].sort(
      (a, b) => a.number - b.number
    );

    const flatList = sortedChapters
      .filter((c) => c.uploads.length > 0)
      .map((c) => ({
        chapterNumber: c.number,
        chapterTitle: c.title,
        uploadId: c.uploads[0].id,
      }));

    for (let cIdx = 0; cIdx < sortedChapters.length; cIdx++) {
      const ch = sortedChapters[cIdx];
      const foundUpload = ch.uploads.find((u) => u.id === uploadId);
      if (foundUpload) {
        const prevChapter = cIdx > 0 ? sortedChapters[cIdx - 1] : null;
        const nextChapter =
          cIdx < sortedChapters.length - 1 ? sortedChapters[cIdx + 1] : null;

        return {
          upload: foundUpload,
          manga,
          prevUploadId: prevChapter?.uploads[0]?.id ?? null,
          nextUploadId: nextChapter?.uploads[0]?.id ?? null,
          allChapterUploads: flatList,
        };
      }
    }
  }

  return null;
}

export async function getScanlationGroups(): Promise<ScanlationGroup[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("scanlations", "mangas");

  const db = await readDatabase();
  return db.scanlations;
}

export async function getScanlationBySlug(slug: string): Promise<{
  group: ScanlationGroup;
  uploads: ChapterUpload[];
  mangas: Manga[];
} | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("scanlations", "mangas", "uploads");

  const db = await readDatabase();
  const group = db.scanlations.find((s) => s.slug === slug);
  if (!group) return null;

  const uploads: ChapterUpload[] = [];
  const mangaMap = new Map<string, Manga>();

  for (const manga of db.mangas) {
    for (const ch of manga.chapters) {
      for (const up of ch.uploads) {
        if (up.scanlationId === group.id || up.scanlationName === group.name) {
          uploads.push(up);
          mangaMap.set(manga.id, manga);
        }
      }
    }
  }

  uploads.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return {
    group,
    uploads,
    mangas: Array.from(mangaMap.values()),
  };
}

export interface LibraryFilterParams {
  q?: string;
  type?: WorkType | "ALL";
  demography?: Demography | "ALL";
  status?: WorkStatus | "ALL";
  genre?: string | "ALL";
  sort?: "rating" | "views" | "latest" | "az";
}

export async function filterMangas(params: LibraryFilterParams): Promise<Manga[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("mangas");

  const db = await readDatabase();
  let list = [...db.mangas];

  if (params.q && params.q.trim() !== "") {
    const q = params.q.trim().toLowerCase();
    list = list.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.author.toLowerCase().includes(q) ||
        m.altTitles.some((alt) => alt.toLowerCase().includes(q))
    );
  }

  if (params.type && params.type !== "ALL") {
    list = list.filter((m) => m.type === params.type);
  }

  if (params.demography && params.demography !== "ALL") {
    list = list.filter((m) => m.demography === params.demography);
  }

  if (params.status && params.status !== "ALL") {
    list = list.filter((m) => m.status === params.status);
  }

  if (params.genre && params.genre !== "ALL") {
    list = list.filter((m) =>
      m.genres.some((g) => g.toLowerCase() === params.genre!.toLowerCase())
    );
  }

  const sort = params.sort ?? "views";
  if (sort === "rating") {
    list.sort((a, b) => b.rating - a.rating);
  } else if (sort === "latest") {
    list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } else if (sort === "az") {
    list.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    list.sort((a, b) => b.views - a.views);
  }

  return list;
}

