"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSessionUser } from "./auth";
import { readDatabase, writeDatabase } from "./data";
import { uploadMangaImage } from "./r2-storage";
import {
  createCoverDataUri,
  createMangaPageDataUri,
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
      rating: 5.0,
      votesCount: 1,
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
