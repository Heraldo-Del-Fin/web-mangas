export type WorkType =
  | "MANGA"
  | "MANHWA"
  | "MANHUA"
  | "ONE_SHOT"
  | "DOUJINSHI"
  | "NOVELA";

export type Demography =
  | "SHOUNEN"
  | "SEINEN"
  | "SHOUJO"
  | "JOSEI"
  | "KODOMO";

export type WorkStatus =
  | "EN_PUBLICACION"
  | "FINALIZADO"
  | "PAUSADO"
  | "CANCELADO";

export type UserListStatus =
  | "SIGUIENDO"
  | "PENDIENTE"
  | "LEIDO"
  | "FAVORITO"
  | "ABANDONADO";

export type UserRole = "READER" | "UPLOADER" | "ADMIN";

export type ScanlationMemberRole = "SCAN_LEADER" | "SCAN_UPLOADER";

export interface ScanlationMember {
  id: string;
  scanlationId: string;
  scanlationName: string;
  userId: string;
  username: string;
  email: string;
  role: ScanlationMemberRole;
  addedAt: string;
}

export type UploaderRequestType = "BECOME_UPLOADER" | "CREATE_SCANLATION";
export type UploaderRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface UploaderRequest {
  id: string;
  userId: string;
  username: string;
  userEmail: string;
  type: UploaderRequestType;
  reason: string;
  proposedScanName?: string;
  proposedScanDescription?: string;
  proposedScanDiscord?: string;
  status: UploaderRequestStatus;
  reviewedBy?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  bio?: string;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  /** Grupos donde el usuario es SCAN_LEADER o SCAN_UPLOADER */
  memberships: ScanlationMember[];
  /** True si es ADMIN, UPLOADER global, o miembro (SCAN_LEADER/SCAN_UPLOADER) de al menos un Scanlation */
  canUpload: boolean;
  /** True si administra al menos un Scanlation (SCAN_LEADER) o es ADMIN */
  isScanLeader: boolean;
}

export interface UserSession {
  token: string;
  userId: string;
  expiresAt: string;
}

export interface UserLibraryRecord {
  userId: string;
  mangaId: string;
  status: UserListStatus;
  updatedAt: string;
}

export interface ScanlationGroup {
  updatedAt?: string;
  id: string;
  name: string;
  slug: string;
  ownerId?: string;
  verified: boolean;
  description: string;
  discord?: string;
  website?: string;
  membersCount: number;
  uploadsCount: number;
}

export interface ChapterUpload {
  updatedAt?: string;
  id: string;
  chapterId: string;
  mangaId: string;
  mangaSlug: string;
  mangaTitle: string;
  mangaCover: string;
  mangaType: WorkType;
  mangaDemography: Demography;
  chapterNumber: number;
  chapterTitle: string;
  // Empty strings in the application mean no group; PostgreSQL stores NULL.
  scanlationId: string;
  scanlationName: string;
  uploaderId?: string;
  uploaderUsername?: string;
  language: "ES" | "EN";
  pages: string[];
  views: number;
  createdAt: string;
}

export interface Chapter {
  id: string;
  mangaId: string;
  number: number;
  title: string;
  createdAt: string;
  uploads: ChapterUpload[];
}

export interface MangaComment {
  id: string;
  mangaId: string;
  chapterNumber?: number;
  userId?: string;
  authorName: string;
  authorRole?: UserRole | "SCAN_LEADER" | "SCAN_UPLOADER";
  content: string;
  likes: number;
  spoiler?: boolean;
  createdAt: string;
}

export interface Manga {
  updatedAt?: string;
  id: string;
  slug: string;
  title: string;
  altTitles: string[];
  synopsis: string;
  coverUrl: string;
  bannerUrl: string;
  type: WorkType;
  demography: Demography;
  status: WorkStatus;
  author: string;
  artist: string;
  releaseYear: number;
  genres: string[];
  rating: number;
  votesCount: number;
  views: number;
  createdById?: string;
  createdByUsername?: string;
  createdAt: string;
  chapters: Chapter[];
  comments?: MangaComment[];
}

export const USER_ROLES: Record<
  UserRole,
  { label: string; short: string; badgeClass: string; description: string }
> = {
  READER: {
    label: "Usuario Lector",
    short: "LECTOR",
    badgeClass: "bg-zinc-200 text-zinc-800 border-zinc-400",
    description:
      "Cuenta estándar de lectura. Puede seguir obras, puntuar, comentar y solicitar permisos de subida.",
  },
  UPLOADER: {
    label: "Uploader Autorizado",
    short: "UPLOADER",
    badgeClass: "bg-[#1d4ed8] text-white border-[#1e40af]",
    description:
      "Cuenta aprobada por administración para registrar nuevas obras y subir capítulos.",
  },
  ADMIN: {
    label: "Administrador General",
    short: "ADMIN",
    badgeClass: "bg-[#d9381e] text-white border-[#991b1b]",
    description:
      "Control total de la plataforma: aprueba solicitudes de Uploader/Scanlations, verifica grupos y modera el catálogo.",
  },
};

export const WORK_TYPES: Record<
  WorkType,
  { label: string; badgeClass: string; short: string }
> = {
  MANGA: {
    label: "Manga",
    short: "MANGA",
    badgeClass: "bg-[#1d4ed8] text-white border-[#1e40af]",
  },
  MANHWA: {
    label: "Manhwa",
    short: "MANHWA",
    badgeClass: "bg-[#15803d] text-white border-[#166534]",
  },
  MANHUA: {
    label: "Manhua",
    short: "MANHUA",
    badgeClass: "bg-[#b45309] text-white border-[#92400e]",
  },
  ONE_SHOT: {
    label: "One Shot",
    short: "ONE SHOT",
    badgeClass: "bg-[#6d28d9] text-white border-[#5b21b6]",
  },
  DOUJINSHI: {
    label: "Doujinshi",
    short: "DOUJINSHI",
    badgeClass: "bg-[#be185d] text-white border-[#9d174d]",
  },
  NOVELA: {
    label: "Novela",
    short: "NOVELA",
    badgeClass: "bg-[#374151] text-white border-[#1f2937]",
  },
};

export const DEMOGRAPHIES: Record<
  Demography,
  {
    label: string;
    colorClass: string;
    bgBarClass: string;
    textClass: string;
    description: string;
  }
> = {
  SHOUNEN: {
    label: "Shounen",
    colorClass: "bg-[#e67e22] text-white",
    bgBarClass: "bg-[#e67e22] text-white",
    textClass: "text-[#d35400]",
    description: "Acción, aventura y superación juvenil",
  },
  SEINEN: {
    label: "Seinen",
    colorClass: "bg-[#c0392b] text-white",
    bgBarClass: "bg-[#c0392b] text-white",
    textClass: "text-[#c0392b]",
    description: "Tramas maduras, psicológicas y complejas",
  },
  SHOUJO: {
    label: "Shoujo",
    colorClass: "bg-[#d81b60] text-white",
    bgBarClass: "bg-[#d81b60] text-white",
    textClass: "text-[#c2185b]",
    description: "Romance, drama y relaciones personales",
  },
  JOSEI: {
    label: "Josei",
    colorClass: "bg-[#7b1fa2] text-white",
    bgBarClass: "bg-[#7b1fa2] text-white",
    textClass: "text-[#7b1fa2]",
    description: "Romance adulto y vida cotidiana realista",
  },
  KODOMO: {
    label: "Kodomo",
    colorClass: "bg-[#0288d1] text-white",
    bgBarClass: "bg-[#0288d1] text-white",
    textClass: "text-[#0277bd]",
    description: "Historias familiares y para todas las edades",
  },
};

export const WORK_STATUSES: Record<
  WorkStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  EN_PUBLICACION: {
    label: "En publicación",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300",
    dotClass: "bg-emerald-600",
  },
  FINALIZADO: {
    label: "Finalizado",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-300",
    dotClass: "bg-blue-600",
  },
  PAUSADO: {
    label: "En pausa",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-300",
    dotClass: "bg-amber-600",
  },
  CANCELADO: {
    label: "Cancelado",
    badgeClass: "bg-rose-50 text-rose-800 border-rose-300",
    dotClass: "bg-rose-600",
  },
};

export const ALL_GENRES: string[] = [
  "Acción",
  "Aventura",
  "Comedia",
  "Drama",
  "Fantasía",
  "Isekai",
  "Magia",
  "Artes Marciales",
  "Misterio",
  "Psicológico",
  "Romance",
  "Ciencia Ficción",
  "Recuentos de la vida",
  "Sobrenatural",
  "Superpoderes",
  "Tragedia",
  "Horror",
  "Deportes",
  "Histórico",
  "Mecha",
  "Apocalíptico",
  "Reencarnación",
];
