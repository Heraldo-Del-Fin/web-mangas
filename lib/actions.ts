"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSessionUser } from "./auth";
import { readDatabase, writeDatabase } from "./data";
import { uploadMangaImage } from "./r2-storage";
import {
  createCoverDataUri,
} from "./svg-placeholders";
import { Demography, Manga, WorkStatus, WorkType } from "./types";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export async function createMangaAction(formData: FormData): Promise<{
  success: boolean;
  slug?: string;
  error?: string;
}> {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || !currentUser.canUpload) {
      return {
        success: false,
        error:
          "Necesitas una cuenta autorizada (Uploader, miembro de Scanlation o Admin) para registrar nuevas obras.",
      };
    }

    const title = String(formData.get("title") || "").trim();
    const altTitlesRaw = String(formData.get("altTitles") || "").trim();
    const synopsis = String(formData.get("synopsis") || "").trim();
    const author = String(formData.get("author") || "Autor Desconocido").trim();
    const artist = String(formData.get("artist") || author).trim();
    const type = (formData.get("type") as WorkType) || "MANGA";
    const demography = (formData.get("demography") as Demography) || "SHOUNEN";
    const status = (formData.get("status") as WorkStatus) || "EN_PUBLICACION";
    const releaseYear = Number(formData.get("releaseYear")) || 2026;
    const genresRaw = String(formData.get("genres") || "").trim();
    const coverUrlInput = String(formData.get("coverUrl") || "").trim();
    const coverFile = formData.get("coverFile") as File | null;

    if (!title || !synopsis) {
      return {
        success: false,
        error: "El título y la sinopsis son obligatorios.",
      };
    }

    const db = await readDatabase();
    let slug = slugify(title);
    if (!slug) slug = `obra-${Date.now()}`;
    if (db.mangas.some((m) => m.slug === slug)) {
      slug = `${slug}-${Math.floor(Math.random() * 900 + 100)}`;
    }

    let finalCoverUrl = coverUrlInput;
    if (coverFile && coverFile.size > 0) {
      const savedPath = await uploadMangaImage(coverFile, "covers");
      if (savedPath) finalCoverUrl = savedPath;
    }

    if (!finalCoverUrl) {
      const accentByDemo: Record<Demography, string> = {
        SHOUNEN: "#fb923c",
        SEINEN: "#f43f5e",
        SHOUJO: "#f472b6",
        JOSEI: "#c084fc",
        KODOMO: "#38bdf8",
      };
      finalCoverUrl = createCoverDataUri({
        title,
        subtitle: `${author} • ${demography}`,
        primaryColor: "#0f172a",
        secondaryColor: "#1e1b4b",
        accentColor: accentByDemo[demography] || "#38bdf8",
        badge: type,
      });
    }

    const genres = genresRaw
      ? genresRaw
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean)
      : ["Acción", "Fantasía"];

    const altTitles = altTitlesRaw
      ? altTitlesRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const newManga: Manga = {
      id: `manga-${Date.now()}`,
      slug,
      title,
      altTitles,
      synopsis,
      coverUrl: finalCoverUrl,
      bannerUrl: finalCoverUrl,
      type,
      demography,
      status,
      author,
      artist,
      releaseYear,
      genres,
      rating: 0,
      votesCount: 0,
      views: 1,
      createdById: currentUser.id,
      createdByUsername: currentUser.username,
      createdAt: new Date().toISOString(),
      chapters: [],
    };

    db.mangas.unshift(newManga);
    await writeDatabase(db);

    revalidatePath("/", "layout");

    return { success: true, slug: newManga.slug };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al guardar la obra.",
    };
  }
}

export async function uploadChapterAction(formData: FormData): Promise<{
  success: boolean;
  uploadId?: string;
  mangaSlug?: string;
  error?: string;
}> {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || !currentUser.canUpload) {
      return {
        success: false,
        error:
          "No tienes permisos para subir capítulos. Solicita permiso a un Administrador o pide al líder de tu Scanlation que te agregue a su grupo.",
      };
    }

    const mangaId = String(formData.get("mangaId") || "").trim();
    const chapterNumber = Number(formData.get("chapterNumber"));
    const chapterTitle = String(
      formData.get("chapterTitle") || `Capítulo ${chapterNumber}`
    ).trim();
    const scanlationId = String(formData.get("scanlationId") || "").trim();
    const customScanName = String(formData.get("customScanName") || "").trim();
    const pageUrlsText = String(formData.get("pageUrls") || "").trim();
    const pageFiles = formData.getAll("pageFiles") as File[];

    if (!mangaId || Number.isNaN(chapterNumber) || chapterNumber < 0) {
      return {
        success: false,
        error: "Selecciona una obra válida e indica el número de capítulo.",
      };
    }

    // Si el usuario NO es ADMIN ni UPLOADER global, verificar que esté autorizado en el Scanlation elegido
    if (currentUser.role === "READER") {
      const allowedInScan = currentUser.memberships.some(
        (m) => m.scanlationId === scanlationId
      );
      if (!allowedInScan) {
        return {
          success: false,
          error:
            "Tu cuenta solo tiene permiso para subir capítulos dentro del Scanlation que te designó.",
        };
      }
    }

    const db = await readDatabase();
    const manga = db.mangas.find((m) => m.id === mangaId);
    if (!manga) {
      return { success: false, error: "La obra seleccionada no existe." };
    }

    const pages: string[] = [];

    for (const file of pageFiles) {
      if (file && file.size > 0) {
        const saved = await uploadMangaImage(
          file,
          `chapters/${manga.slug}/cap-${chapterNumber}`
        );
        if (saved) pages.push(saved);
      }
    }

    if (pageUrlsText) {
      const urls = pageUrlsText
        .split(/\r?\n/)
        .map((u) => u.trim())
        .filter(Boolean);
      pages.push(...urls);
    }

    if (pages.length === 0) {
      return {
        success: false,
        error:
          "Debes subir los archivos de imagen de las páginas o ingresar sus URLs.",
      };
    }

    let scanGroup = db.scanlations.find((s) => s.id === scanlationId);
    if (
      !scanGroup &&
      customScanName &&
      (currentUser.role === "ADMIN" || currentUser.role === "UPLOADER")
    ) {
      const newScanId = `scan-${Date.now()}`;
      scanGroup = {
        id: newScanId,
        name: customScanName,
        slug: slugify(customScanName) || newScanId,
        ownerId: currentUser.id,
        verified: currentUser.role === "ADMIN",
        description: `Grupo de traducción administrado por ${currentUser.username}.`,
        membersCount: 1,
        uploadsCount: 0,
      };
      db.scanlations.push(scanGroup);
      db.scanlationMembers.push({
        id: `sm-${Date.now()}`,
        scanlationId: scanGroup.id,
        scanlationName: scanGroup.name,
        userId: currentUser.id,
        username: currentUser.username,
        email: currentUser.email,
        role: "SCAN_LEADER",
        addedAt: new Date().toISOString(),
      });
    }

    if (scanGroup) {
      scanGroup.uploadsCount += 1;
    }

    let chapter = manga.chapters.find((c) => c.number === chapterNumber);
    if (!chapter) {
      chapter = {
        id: `ch-${Date.now()}`,
        mangaId: manga.id,
        number: chapterNumber,
        title: chapterTitle,
        createdAt: new Date().toISOString(),
        uploads: [],
      };
      manga.chapters.push(chapter);
      manga.chapters.sort((a, b) => a.number - b.number);
    } else if (chapterTitle) {
      chapter.title = chapterTitle;
    }

    const newUpload = {
      id: `up-${Date.now()}`,
      chapterId: chapter.id,
      mangaId: manga.id,
      mangaSlug: manga.slug,
      mangaTitle: manga.title,
      mangaCover: manga.coverUrl,
      mangaType: manga.type,
      mangaDemography: manga.demography,
      chapterNumber,
      chapterTitle: chapter.title,
      scanlationId: scanGroup?.id || "scan-1",
      scanlationName: scanGroup?.name || "Scanlation",
      uploaderId: currentUser.id,
      uploaderUsername: currentUser.username,
      language: "ES" as const,
      pages,
      views: 1,
      createdAt: new Date().toISOString(),
    };

    chapter.uploads.unshift(newUpload);
    await writeDatabase(db);

    revalidatePath("/", "layout");

    return {
      success: true,
      uploadId: newUpload.id,
      mangaSlug: manga.slug,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al subir el capítulo.",
    };
  }
}

export async function rateMangaAction(
  mangaId: string,
  stars: number
): Promise<{
  success: boolean;
  newRating?: number;
  votesCount?: number;
  error?: string;
}> {
  try {
    const clamped = Math.max(1, Math.min(5, Math.round(stars)));
    if (!Number.isFinite(stars)) return { success: false, error: "Puntuación no válida." };
    const db = await readDatabase();
    const manga = db.mangas.find((m) => m.id === mangaId);
    if (!manga) {
      return { success: false, error: "Obra no encontrada." };
    }

    const totalScore = manga.rating * manga.votesCount + clamped;
    manga.votesCount += 1;
    manga.rating = Number((totalScore / manga.votesCount).toFixed(2));

    await writeDatabase(db);
    revalidatePath("/", "layout");

    return {
      success: true,
      newRating: manga.rating,
      votesCount: manga.votesCount,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al votar.",
    };
  }
}

export async function addMangaCommentAction(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const currentUser = await getCurrentSessionUser();
    const mangaId = String(formData.get("mangaId") || "").trim();
    const guestName =
      String(formData.get("authorName") || "").trim() || "Lector Invitado";
    const content = String(formData.get("content") || "").trim();
    const spoiler = formData.get("spoiler") === "on";
    const chapterNumRaw = formData.get("chapterNumber");
    const chapterNumber = chapterNumRaw ? Number(chapterNumRaw) : undefined;

    if (!mangaId || !content) {
      return {
        success: false,
        error: "Escribe un comentario antes de publicar.",
      };
    }

    const db = await readDatabase();
    const manga = db.mangas.find((m) => m.id === mangaId);
    if (!manga) {
      return { success: false, error: "Obra no encontrada." };
    }

    if (!manga.comments) {
      manga.comments = [];
    }

    let resolvedRole:
      | "ADMIN"
      | "UPLOADER"
      | "READER"
      | "SCAN_LEADER"
      | "SCAN_UPLOADER" = "READER";

    if (currentUser) {
      if (currentUser.role === "ADMIN") resolvedRole = "ADMIN";
      else if (currentUser.isScanLeader) resolvedRole = "SCAN_LEADER";
      else if (currentUser.role === "UPLOADER") resolvedRole = "UPLOADER";
      else if (currentUser.memberships.length > 0)
        resolvedRole = "SCAN_UPLOADER";
    }

    manga.comments.unshift({
      id: `cmt-${Date.now()}`,
      mangaId: manga.id,
      chapterNumber,
      userId: currentUser?.id,
      authorName: currentUser ? currentUser.username : guestName,
      authorRole: resolvedRole,
      content,
      likes: 1,
      spoiler,
      createdAt: new Date().toISOString(),
    });

    await writeDatabase(db);
    revalidatePath("/", "layout");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al guardar el comentario.",
    };
  }
}

export async function updateChapterAction(formData: FormData): Promise<{
  success: boolean;
  uploadId?: string;
  mangaSlug?: string;
  error?: string;
}> {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser) {
      return { success: false, error: "Debes iniciar sesión para editar." };
    }

    const uploadId = String(formData.get("uploadId") || "").trim();
    const chapterNumber = Number(formData.get("chapterNumber"));
    const chapterTitle = String(formData.get("chapterTitle") || "").trim();
    const scanlationId = String(formData.get("scanlationId") || "").trim();
    const pageUrlsRaw = String(formData.get("pageUrls") || "").trim();

    if (!uploadId || Number.isNaN(chapterNumber) || chapterNumber < 0) {
      return {
        success: false,
        error: "Indica un número de capítulo válido.",
      };
    }

    const pages = pageUrlsRaw
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter(Boolean);

    if (pages.length === 0) {
      return {
        success: false,
        error: "El capítulo debe tener al menos una página de imagen.",
      };
    }

    const db = await readDatabase();

    // Localizar el upload, su capítulo y la obra correspondiente
    let targetManga: Manga | null = null;
    let targetChapter: { id: string; number: number; title: string; uploads: typeof db.mangas[0]["chapters"][0]["uploads"] } | null = null;
    let targetUploadIndex = -1;

    for (const m of db.mangas) {
      for (const ch of m.chapters) {
        const uIdx = ch.uploads.findIndex((u) => u.id === uploadId);
        if (uIdx !== -1) {
          targetManga = m;
          targetChapter = ch;
          targetUploadIndex = uIdx;
          break;
        }
      }
      if (targetManga) break;
    }

    if (!targetManga || !targetChapter || targetUploadIndex === -1) {
      return { success: false, error: "El capítulo no existe." };
    }

    const existingUpload = targetChapter.uploads[targetUploadIndex];

    // Verificar permisos: ADMIN, Líder del scanlation o el uploader original
    const isLeaderOfScan = currentUser.memberships.some(
      (m) =>
        m.scanlationId === existingUpload.scanlationId &&
        m.role === "SCAN_LEADER"
    );
    const isOwnerUploader = existingUpload.uploaderId === currentUser.id;

    if (currentUser.role !== "ADMIN" && !isLeaderOfScan && !isOwnerUploader) {
      return {
        success: false,
        error: "No tienes permiso para editar este capítulo.",
      };
    }

    // Actualizar datos del scanlation si cambió
    let resolvedScanName = existingUpload.scanlationName;
    let resolvedScanId = existingUpload.scanlationId;
    if (scanlationId && scanlationId !== existingUpload.scanlationId) {
      const scanGroup = db.scanlations.find((s) => s.id === scanlationId);
      if (scanGroup) {
        resolvedScanId = scanGroup.id;
        resolvedScanName = scanGroup.name;
      }
    }

    const updatedUpload = {
      ...existingUpload,
      chapterNumber,
      chapterTitle: chapterTitle || `Capítulo ${chapterNumber}`,
      scanlationId: resolvedScanId,
      scanlationName: resolvedScanName,
      pages,
    };

    // Si el número de capítulo cambió, reubicarlo en el chapter correspondiente
    if (targetChapter.number !== chapterNumber) {
      // Quitar de capítulo anterior
      targetChapter.uploads.splice(targetUploadIndex, 1);
      if (targetChapter.uploads.length === 0) {
        targetManga.chapters = targetManga.chapters.filter(
          (c) => c.id !== targetChapter!.id
        );
      }

      // Buscar o crear el nuevo capítulo
      let destChapter = targetManga.chapters.find(
        (c) => c.number === chapterNumber
      );
      if (!destChapter) {
        destChapter = {
          id: `ch-${Date.now()}`,
          mangaId: targetManga.id,
          number: chapterNumber,
          title: chapterTitle || `Capítulo ${chapterNumber}`,
          createdAt: new Date().toISOString(),
          uploads: [],
        };
        targetManga.chapters.push(destChapter);
        targetManga.chapters.sort((a, b) => a.number - b.number);
      } else if (chapterTitle) {
        destChapter.title = chapterTitle;
      }

      updatedUpload.chapterId = destChapter.id;
      destChapter.uploads.unshift(updatedUpload);
    } else {
      // Mismo número, actualizar en su lugar
      targetChapter.title = chapterTitle || targetChapter.title;
      targetChapter.uploads[targetUploadIndex] = updatedUpload;
    }

    await writeDatabase(db);
    revalidatePath("/", "layout");

    return {
      success: true,
      uploadId: updatedUpload.id,
      mangaSlug: targetManga.slug,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al actualizar el capítulo.",
    };
  }
}

export async function updateMangaAction(formData: FormData): Promise<{
  success: boolean;
  slug?: string;
  error?: string;
}> {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || !currentUser.canUpload) {
      return {
        success: false,
        error:
          "Necesitas una cuenta autorizada (Uploader, miembro de Scanlation o Admin) para editar información de las obras.",
      };
    }

    const mangaId = String(formData.get("mangaId") || "").trim();
    if (!mangaId) {
      return { success: false, error: "Identificador de obra inválido." };
    }

    const db = await readDatabase();
    const manga = db.mangas.find((m) => m.id === mangaId);
    if (!manga) {
      return { success: false, error: "La obra solicitada no existe." };
    }

    const title = String(formData.get("title") || "").trim();
    const altTitlesRaw = String(formData.get("altTitles") || "").trim();
    const synopsis = String(formData.get("synopsis") || "").trim();
    const author = String(formData.get("author") || manga.author).trim();
    const artist = String(formData.get("artist") || author).trim();
    const type = (formData.get("type") as WorkType) || manga.type;
    const demography =
      (formData.get("demography") as Demography) || manga.demography;
    const status = (formData.get("status") as WorkStatus) || manga.status;
    const releaseYear =
      Number(formData.get("releaseYear")) || manga.releaseYear;
    const genresRaw = String(formData.get("genres") || "").trim();
    const coverUrlInput = String(formData.get("coverUrl") || "").trim();
    const bannerUrlInput = String(formData.get("bannerUrl") || "").trim();
    const coverFile = formData.get("coverFile") as File | null;
    const bannerFile = formData.get("bannerFile") as File | null;

    if (!title || !synopsis) {
      return {
        success: false,
        error: "El título y la sinopsis son obligatorios.",
      };
    }

    // Gestionar nueva portada si se subió un archivo
    let finalCoverUrl = coverUrlInput || manga.coverUrl;
    if (coverFile && coverFile.size > 0) {
      const savedPath = await uploadMangaImage(coverFile, "covers");
      if (savedPath) finalCoverUrl = savedPath;
    }

    // Gestionar nuevo banner si se subió un archivo
    let finalBannerUrl = bannerUrlInput || manga.bannerUrl;
    if (bannerFile && bannerFile.size > 0) {
      const savedBanner = await uploadMangaImage(bannerFile, "banners");
      if (savedBanner) finalBannerUrl = savedBanner;
    }

    const genres = genresRaw
      ? genresRaw
          .split(",")
          .map((g) => g.trim())
          .filter(Boolean)
      : manga.genres;

    const altTitles = altTitlesRaw
      ? altTitlesRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    // Actualizar slug si el título cambió sustancialmente
    let newSlug = manga.slug;
    if (title !== manga.title) {
      let candidateSlug = slugify(title);
      if (!candidateSlug) candidateSlug = manga.slug;
      if (
        candidateSlug !== manga.slug &&
        db.mangas.some((m) => m.slug === candidateSlug && m.id !== manga.id)
      ) {
        candidateSlug = `${candidateSlug}-${Math.floor(Math.random() * 900 + 100)}`;
      }
      newSlug = candidateSlug;
    }

    // Actualizar campos de la obra
    manga.title = title;
    manga.slug = newSlug;
    manga.altTitles = altTitles;
    manga.synopsis = synopsis;
    manga.author = author;
    manga.artist = artist;
    manga.type = type;
    manga.demography = demography;
    manga.status = status;
    manga.releaseYear = releaseYear;
    manga.genres = genres;
    manga.coverUrl = finalCoverUrl;
    if (finalBannerUrl) manga.bannerUrl = finalBannerUrl;

    // Actualizar metadatos desnormalizados en chapter_uploads de esta obra
    for (const ch of manga.chapters) {
      for (const up of ch.uploads) {
        up.mangaTitle = title;
        up.mangaSlug = newSlug;
        up.mangaCover = finalCoverUrl;
        up.mangaType = type;
        up.mangaDemography = demography;
      }
    }

    await writeDatabase(db);
    revalidatePath("/", "layout");
    revalidatePath(`/manga/${newSlug}`);
    revalidatePath("/biblioteca");

    return {
      success: true,
      slug: newSlug,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al actualizar la obra.",
    };
  }
}

export async function deleteMangaAction(mangaId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const currentUser = await getCurrentSessionUser();
    if (!currentUser || currentUser.role !== "ADMIN") {
      return {
        success: false,
        error:
          "Acceso denegado: Únicamente los Administradores generales pueden eliminar obras completas.",
      };
    }

    if (!mangaId) {
      return { success: false, error: "Identificador de obra inválido." };
    }

    const db = await readDatabase();
    const mangaIdx = db.mangas.findIndex((m) => m.id === mangaId);
    if (mangaIdx === -1) {
      return {
        success: false,
        error: "La obra no existe o ya fue eliminada previamente.",
      };
    }

    const removedManga = db.mangas[mangaIdx];

    // Eliminar la obra de la lista
    db.mangas.splice(mangaIdx, 1);

    // Eliminar registros de user_library asociados a esta obra
    db.userLibrary = db.userLibrary.filter((ul) => ul.mangaId !== mangaId);

    // Guardar en la base de datos (sync_kuramanga_relational eliminará en cascada
    // mangas, chapters, chapter_uploads, manga_comments y user_library en Neon)
    await writeDatabase(db);

    revalidatePath("/", "layout");
    revalidatePath(`/manga/${removedManga.slug}`);
    revalidatePath("/biblioteca");
    revalidatePath("/sitemap.xml");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al eliminar la obra.",
    };
  }
}
