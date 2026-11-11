import { NextRequest, NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/lib/auth";
import { recordMangaView } from "@/lib/data";

const BOT_USER_AGENTS =
  /bot|crawler|spider|crawling|googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot/i;

export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get("user-agent") || "";
    if (BOT_USER_AGENTS.test(userAgent)) {
      return NextResponse.json({ ok: true, ignored: true, reason: "BOT" });
    }

    // 1. Si el usuario autenticado tiene rol de ADMIN, ignorar completamente el conteo
    const currentUser = await getCurrentSessionUser();
    if (currentUser && currentUser.role === "ADMIN") {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "ADMIN_ACCOUNT",
      });
    }

    const body = await request.json().catch(() => ({}));
    const { mangaId, uploadId } = body as {
      mangaId?: string;
      uploadId?: string;
    };

    if (!mangaId || typeof mangaId !== "string") {
      return NextResponse.json(
        { ok: false, error: "mangaId es requerido" },
        { status: 400 }
      );
    }

    // 2. Cooldown anti-spam de 30 minutos por manga
    const viewCookieKey = `km_view_${mangaId}`;
    const hasViewCookie = request.cookies.get(viewCookieKey);

    if (hasViewCookie && !uploadId) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "COOLDOWN",
      });
    }

    // Cooldown específico para capítulo si viene uploadId
    if (uploadId) {
      const chapterCookieKey = `km_view_ch_${uploadId}`;
      if (request.cookies.get(chapterCookieKey)) {
        return NextResponse.json({
          ok: true,
          ignored: true,
          reason: "CHAPTER_COOLDOWN",
        });
      }
    }

    // 3. Registrar vista de forma atómica en Neon / base de datos
    const result = await recordMangaView(mangaId, uploadId);

    const response = NextResponse.json({
      ok: true,
      counted: true,
      views: result.mangaViews,
    });

    // Fijar cookies de cooldown (30 min)
    response.cookies.set(viewCookieKey, "1", {
      maxAge: 1800,
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });

    if (uploadId) {
      response.cookies.set(`km_view_ch_${uploadId}`, "1", {
        maxAge: 1800,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
      });
    }

    return response;
  } catch (error) {
    console.error("Error en /api/track-view:", error);
    return NextResponse.json(
      { ok: false, error: "Internal Error" },
      { status: 500 }
    );
  }
}

