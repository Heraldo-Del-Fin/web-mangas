"use client";

import { useEffect, useRef } from "react";

interface ViewTrackerProps {
  mangaId: string;
  uploadId?: string;
}

/**
 * Componente silencioso que envía la señal de vista del manga o capítulo.
 * Si el usuario es administrador, el endpoint ignora la vista.
 * Protegido con ref contra dobles disparos de React 18 / StrictMode.
 */
export function ViewTracker({ mangaId, uploadId }: ViewTrackerProps) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;

    fetch("/api/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mangaId, uploadId }),
    }).catch(() => {
      // Analítica en segundo plano: no interrumpir la experiencia de lectura
    });
  }, [mangaId, uploadId]);

  return null;
}

