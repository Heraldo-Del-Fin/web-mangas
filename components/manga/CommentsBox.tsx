"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { addMangaCommentAction } from "@/lib/actions";
import { MangaComment, SessionUser } from "@/lib/types";

export function CommentsBox({
  mangaId,
  chapterNumber,
  comments = [],
}: {
  mangaId: string;
  chapterNumber?: number;
  comments?: MangaComment[];
}) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revealedSpoilers, setRevealedSpoilers] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setCurrentUser(d.user ?? null))
      .catch(() => {
        // ignore
      });
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("mangaId", mangaId);
    if (chapterNumber !== undefined) {
      formData.set("chapterNumber", String(chapterNumber));
    }

    const res = await addMangaCommentAction(formData);
    setLoading(false);

    if (res.success) {
      setContent("");
      setSpoiler(false);
      router.refresh();
    }
  };

  const roleBadgeMap: Record<string, { label: string; className: string }> = {
    ADMIN: {
      label: "ADMIN",
      className: "bg-[#d9381e] text-white",
    },
    SCAN_LEADER: {
      label: "LÍDER SCAN",
      className: "bg-purple-700 text-white",
    },
    UPLOADER: {
      label: "UPLOADER",
      className: "bg-[#1d4ed8] text-white",
    },
    SCAN_UPLOADER: {
      label: "SCAN UPLOADER",
      className: "bg-emerald-700 text-white",
    },
    READER: {
      label: "LECTOR",
      className: "bg-zinc-200 text-zinc-800 border border-zinc-400",
    },
  };

  return (
    <section className="border border-zinc-300 bg-white shadow-2xs">
      <div className="border-b-2 border-zinc-300 bg-zinc-100 px-4 py-2.5">
        <h2 className="text-sm font-black tracking-wider text-zinc-900 uppercase">
          💬 Comentarios de la Comunidad ({comments.length})
        </h2>
      </div>

      {/* Formulario de nuevo comentario */}
      <form
        onSubmit={handleSubmit}
        className="space-y-3 border-b border-zinc-200 bg-zinc-50 p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          {currentUser ? (
            <span className="font-bold text-zinc-800">
              Comentando como{" "}
              <strong className="text-[#1d4ed8]">{currentUser.username}</strong>
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <label className="font-bold text-zinc-700">Tu nombre:</label>
              <input
                type="text"
                name="authorName"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Lector Invitado"
                className="rounded-none border border-zinc-400 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-900"
              />
            </div>
          )}

          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-rose-700">
            <input
              type="checkbox"
              name="spoiler"
              checked={spoiler}
              onChange={(e) => setSpoiler(e.target.checked)}
              className="accent-rose-600"
            />
            <span>Marcar como [SPOILER]</span>
          </label>
        </div>

        <textarea
          name="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          required
          placeholder="Escribe tu opinión sobre esta obra o capítulo..."
          className="w-full rounded-none border border-zinc-400 bg-white p-2.5 text-xs text-zinc-900 focus:border-[#1d4ed8] focus:outline-none"
        />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="border border-[#1e40af] bg-[#1d4ed8] px-4 py-1.5 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af] disabled:opacity-50"
          >
            {loading ? "Publicando..." : "Publicar Comentario »"}
          </button>
        </div>
      </form>

      {/* Lista de comentarios */}
      {comments.length === 0 ? (
        <div className="p-6 text-center text-xs text-zinc-500">
          Aún no hay comentarios en esta obra. ¡Sé el primero en opinar!
        </div>
      ) : (
        <div className="divide-y divide-zinc-200">
          {comments.map((cmt) => {
            const roleInfo =
              roleBadgeMap[cmt.authorRole || "READER"] || roleBadgeMap.READER;
            const isHiddenSpoiler =
              cmt.spoiler && !revealedSpoilers[cmt.id];

            return (
              <div key={cmt.id} className="p-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <strong className="font-extrabold text-zinc-900">
                      {cmt.authorName}
                    </strong>
                    <span
                      className={`px-1.5 py-0.2 text-[9px] font-black uppercase ${roleInfo.className}`}
                    >
                      {roleInfo.label}
                    </span>
                    {cmt.chapterNumber !== undefined && (
                      <span className="border border-zinc-300 bg-zinc-100 px-1.5 py-0.2 text-[10px] font-bold text-zinc-600">
                        Cap. {cmt.chapterNumber}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    {new Date(cmt.createdAt).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                {isHiddenSpoiler ? (
                  <div className="mt-2 border border-rose-300 bg-rose-50 p-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setRevealedSpoilers((prev) => ({
                          ...prev,
                          [cmt.id]: true,
                        }))
                      }
                      className="font-extrabold text-rose-800 hover:underline"
                    >
                      ⚠️ Este comentario contiene SPOILER — [ Haz clic para
                      mostrar ]
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 leading-relaxed text-zinc-800">
                    {cmt.content}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

