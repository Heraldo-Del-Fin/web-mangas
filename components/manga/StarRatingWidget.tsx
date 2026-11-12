"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { rateMangaAction } from "@/lib/actions";

export function StarRatingWidget({
  mangaId,
  initialRating,
  initialVotes,
}: {
  mangaId: string;
  initialRating: number;
  initialVotes: number;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(initialRating);
  const [votes, setVotes] = useState(initialVotes);
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const [votedStar, setVotedStar] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleVote = async (stars: number) => {
    if (submitting) return;
    setSubmitting(true);
    const res = await rateMangaAction(mangaId, stars);
    setSubmitting(false);

    if (res.success && res.newRating !== undefined && res.votesCount !== undefined) {
      setRating(res.newRating);
      setVotes(res.votesCount);
      setVotedStar(stars);
      router.refresh();
    }
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-3 border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = (hoverStar ?? votedStar ?? Math.round(rating)) >= star;
          return (
            <button
              key={star}
              type="button"
              disabled={submitting}
              onMouseEnter={() => setHoverStar(star)}
              onMouseLeave={() => setHoverStar(null)}
              onClick={() => handleVote(star)}
              className={`px-0.5 text-base leading-none transition ${
                active
                  ? "text-amber-500 hover:scale-110"
                  : "text-zinc-300 hover:text-amber-400"
              }`}
              title={`Votar ${star} estrellas`}
            >
              ★
            </button>
          );
        })}
      </div>

      <div className="border-l border-zinc-300 pl-2.5 font-bold text-zinc-800">
        <span>{votes > 0 ? `${rating.toFixed(2)} / 5` : "Sin votos"}</span>
        <span className="ml-1 font-normal text-zinc-500">({votes} votos)</span>
        {votedStar && (
          <span className="ml-2 text-[11px] font-extrabold text-emerald-700">
            ✓ ¡Gracias por votar!
          </span>
        )}
      </div>
    </div>
  );
}

