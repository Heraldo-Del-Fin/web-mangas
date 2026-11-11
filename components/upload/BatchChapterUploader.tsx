"use client";

import Link from "next/link";
import { useState } from "react";
import { uploadChapterAction } from "@/lib/actions";
import { Manga, ScanlationGroup, WORK_TYPES } from "@/lib/types";
import {
  groupFilesIntoChapters,
  readZipFile,
  ZipProgressState,
} from "@/lib/zip-reader";
import {
  PageUploadState,
  uploadPagesInParallel,
} from "./chapter-uploader";
import { UploadPhase, UploadProgressPanel } from "./UploadProgressPanel";

export interface BatchItem {
  id: string;
  chapterNumber: number;
  chapterTitle: string;
  files: File[];
  status: "idle" | "uploading" | "done" | "error";
  error?: string;
  uploadId?: string;
}

export function BatchChapterUploader({
  mangas,
  scanlations,
}: {
  mangas: Manga[];
  scanlations: ScanlationGroup[];
}) {
  const [selectedMangaId, setSelectedMangaId] = useState<string>(
    mangas[0]?.id || ""
  );
  const [selectedScanId, setSelectedScanId] = useState<string>(
    scanlations[0]?.id || ""
  );
  const [customScanName, setCustomScanName] = useState("");
  const [useCustomScan, setUseCustomScan] = useState(scanlations.length === 0);

  const selectedManga = mangas.find((m) => m.id === selectedMangaId);
  const nextInitialChapter =
    (selectedManga?.chapters.length ?? 0) + 1;

  // Cola de capítulos a subir
  const [queue, setQueue] = useState<BatchItem[]>([
    {
      id: "item-1",
      chapterNumber: nextInitialChapter,
      chapterTitle: "",
      files: [],
      status: "idle",
    },
    {
      id: "item-2",
      chapterNumber: nextInitialChapter + 1,
      chapterTitle: "",
      files: [],
      status: "idle",
    },
  ]);

  // Estado del proceso de subida
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);

  // Estados del panel de progreso del capítulo actual
  const [currentPhase, setCurrentPhase] = useState<UploadPhase>("uploading");
  const [currentPages, setCurrentPages] = useState<PageUploadState[]>([]);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentError, setCurrentError] = useState<string | null>(null);

  // Estados de extracción del ZIP
  const [isExtractingZip, setIsExtractingZip] = useState(false);
  const [zipStatus, setZipStatus] = useState<string | null>(null);
  const [zipError, setZipError] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<ZipProgressState | null>(null);

  // Manejar carga e importación desde archivo .ZIP
  const handleZipSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setZipError("El archivo seleccionado debe ser un archivo comprimido .zip válido.");
      return;
    }

    setIsExtractingZip(true);
    setZipError(null);
    setZipProgress({
      current: 0,
      total: 100,
      fileName: "Leyendo archivo...",
      percent: 0,
    });
    setZipStatus("Leyendo y analizando archivo .zip...");

    try {
      const extractedFiles = await readZipFile(file, (progress) => {
        setZipProgress(progress);
        setZipStatus(
          `Extrayendo archivos: ${progress.current} de ${progress.total} (${progress.percent}%)`
        );
      });

      setZipStatus(
        `Se extrajeron ${extractedFiles.length} archivos. Clasificando carpetas de capítulos...`
      );

      const chapters = groupFilesIntoChapters(extractedFiles);

      if (chapters.length === 0) {
        throw new Error(
          "No se detectaron carpetas con imágenes válidas. Asegúrate de estructurar el .zip como 'capitulos/1/01.jpg' o directamente '1/01.jpg', '2/01.jpg', etc."
        );
      }

      const totalImages = chapters.reduce((sum, ch) => sum + ch.files.length, 0);

      const newQueue: BatchItem[] = chapters.map((ch, idx) => ({
        id: `zip-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        chapterNumber:
          ch.chapterNumber > 0 ? ch.chapterNumber : nextInitialChapter + idx,
        chapterTitle: `Capítulo ${
          ch.chapterNumber > 0 ? ch.chapterNumber : nextInitialChapter + idx
        }`,
        files: ch.files,
        status: "idle",
      }));

      setQueue(newQueue);
      setZipStatus(
        `✓ ¡Éxito! Se cargaron ${chapters.length} capítulos (${totalImages} páginas en total) desde "${file.name}". Revisa los datos abajo e inicia la subida cuando estés listo.`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error al procesar el archivo .zip";
      setZipError(msg);
      setZipStatus(null);
    } finally {
      setIsExtractingZip(false);
      e.target.value = "";
    }
  };

  // Agregar un nuevo capítulo a la cola
  const addChapter = () => {
    setQueue((prev) => {
      const lastNumber =
        prev.length > 0 ? prev[prev.length - 1].chapterNumber : nextInitialChapter;
      return [
        ...prev,
        {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          chapterNumber: Math.round((lastNumber + 1) * 10) / 10,
          chapterTitle: "",
          files: [],
          status: "idle",
        },
      ];
    });
  };

  // Generar N capítulos de una vez
  const generateMultiple = (count: number) => {
    setQueue((prev) => {
      const startNum =
        prev.length > 0 ? prev[prev.length - 1].chapterNumber + 1 : nextInitialChapter;
      const newItems: BatchItem[] = Array.from({ length: count }, (_, i) => ({
        id: `item-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        chapterNumber: Math.round((startNum + i) * 10) / 10,
        chapterTitle: "",
        files: [],
        status: "idle",
      }));
      return [...prev, ...newItems];
    });
  };

  const removeChapter = (id: string) => {
    if (isProcessing) return;
    setQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id: string, patch: Partial<BatchItem>) => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  };

  const handleFilesSelected = (id: string, files: File[]) => {
    setQueue((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, files, status: "idle", error: undefined } : item
      )
    );
  };

  // Iniciar la subida secuencial del lote
  const startBatchUpload = async () => {
    if (!selectedManga) return;
    if (queue.length === 0) return;

    // Validar que todos los capítulos tengan archivos seleccionados
    const emptyChapters = queue.filter(
      (item) => item.status !== "done" && item.files.length === 0
    );
    if (emptyChapters.length > 0) {
      alert(
        `Hay ${emptyChapters.length} capítulo(s) en la cola sin imágenes seleccionadas. Asigna las imágenes antes de iniciar.`
      );
      return;
    }

    setIsProcessing(true);
    setCurrentError(null);

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];

      // Omitir los que ya se hayan completado en un intento previo
      if (item.status === "done") continue;

      setActiveItemIndex(i);
      updateItem(item.id, { status: "uploading", error: undefined });
      setCurrentPhase("uploading");
      setCurrentPages([]);
      setCurrentSpeed(0);

      try {
        // 1) Subir las páginas en paralelo a R2
        const uploadedUrls = await uploadPagesInParallel({
          files: item.files,
          mangaSlug: selectedManga.slug,
          chapterNumber: String(item.chapterNumber),
          onUpdate: (pages, speed) => {
            setCurrentPages(pages);
            setCurrentSpeed(speed);
          },
        });

        // 2) Registrar en Neon
        setCurrentPhase("saving");

        const formData = new FormData();
        formData.set("mangaId", selectedManga.id);
        formData.set("chapterNumber", String(item.chapterNumber));
        formData.set(
          "chapterTitle",
          item.chapterTitle || `Capítulo ${item.chapterNumber}`
        );
        formData.set("scanlationId", useCustomScan ? "" : selectedScanId);
        formData.set("customScanName", useCustomScan ? customScanName : "");
        formData.set("pageUrls", uploadedUrls.join("\n"));

        const res = await uploadChapterAction(formData);

        if (!res.success) {
          throw new Error(res.error || "Error al registrar en base de datos.");
        }

        updateItem(item.id, {
          status: "done",
          uploadId: res.uploadId,
          error: undefined,
        });
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Error durante la subida.";
        updateItem(item.id, { status: "error", error: errorMsg });
        setCurrentPhase("error");
        setCurrentError(errorMsg);
        setIsProcessing(false);
        return; // Pausar para que el usuario pueda reintentar o corregir
      }
    }

    setIsProcessing(false);
    setActiveItemIndex(null);
    setCurrentPhase("done");
  };

  const completedCount = queue.filter((i) => i.status === "done").length;
  const totalCount = queue.length;
  const isAllDone = totalCount > 0 && completedCount === totalCount;

  return (
    <div className="space-y-6">
      {/* Sección 1: Selección de Obra y Scanlation */}
      <div className="border border-zinc-300 bg-white p-5 shadow-2xs sm:p-6">
        <h3 className="border-b-2 border-zinc-300 pb-2 text-base font-black text-zinc-900 uppercase">
          Configuración del Lote
        </h3>
        <p className="mt-1 text-xs text-zinc-600">
          Selecciona la obra a la que pertenecerán todos los capítulos del lote y el
          grupo Scanlation que los publica.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-extrabold text-zinc-800 uppercase">
              Obra de Destino *
            </label>
            <select
              value={selectedMangaId}
              onChange={(e) => setSelectedMangaId(e.target.value)}
              disabled={isProcessing}
              className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900"
            >
              {mangas.map((m) => (
                <option key={m.id} value={m.id}>
                  [{WORK_TYPES[m.type].short}] {m.title} ({m.chapters.length} caps)
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-extrabold text-zinc-800 uppercase">
                Scanlation / Grupo *
              </label>
              <button
                type="button"
                onClick={() => setUseCustomScan((v) => !v)}
                disabled={isProcessing}
                className="text-xs font-bold text-[#1d4ed8] hover:underline"
              >
                {useCustomScan
                  ? "Elegir grupo existente"
                  : "+ Escribir nuevo Scanlation"}
              </button>
            </div>

            {useCustomScan ? (
              <input
                type="text"
                value={customScanName}
                onChange={(e) => setCustomScanName(e.target.value)}
                disabled={isProcessing}
                placeholder="Nombre de tu Scanlation..."
                className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900"
              />
            ) : (
              <select
                value={selectedScanId}
                onChange={(e) => setSelectedScanId(e.target.value)}
                disabled={isProcessing}
                className="w-full rounded-none border border-zinc-400 bg-white px-3 py-2 text-xs font-bold text-zinc-900"
              >
                {scanlations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.verified ? "✓" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Sección 2: Importar Lote Completo desde .ZIP */}
      <div className="border border-blue-200 bg-blue-50/50 p-5 shadow-2xs sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center bg-[#1d4ed8] text-[10px] font-black text-white">
                ZIP
              </span>
              <h3 className="text-sm font-black text-zinc-900 uppercase">
                Importar Capítulos por Archivo .ZIP
              </h3>
            </div>
            <p className="mt-1 text-xs text-zinc-700">
              Carga un único archivo <strong>.zip</strong> con los capítulos organizados por carpetas. El navegador lo descomprime localmente al instante y rellena la cola de subida automáticamente.
            </p>
            <div className="mt-2.5 border border-blue-200 bg-white/90 p-3 font-mono text-[11px] text-zinc-800">
              <div className="font-bold text-zinc-900">Estructura requerida del .ZIP:</div>
              <div className="mt-1 text-zinc-700">
                📦 tu-archivo.zip<br />
                &nbsp;├── <span className="font-semibold text-[#1d4ed8]">capitulos</span>/<br />
                &nbsp;│&nbsp;&nbsp;&nbsp;├── <span className="font-semibold text-emerald-700">1</span>/ (01.jpg, 02.jpg, 03.png...)<br />
                &nbsp;│&nbsp;&nbsp;&nbsp;├── <span className="font-semibold text-emerald-700">2</span>/ (01.jpg, 02.jpg...)<br />
                &nbsp;│&nbsp;&nbsp;&nbsp;└── <span className="font-semibold text-emerald-700">3</span>/ (01.jpg, 02.jpg...)<br />
                <span className="font-sans text-[10px] text-zinc-500 italic">
                  * También se detecta si las carpetas de capítulos están directamente en la raíz (ej: <code>1/</code>, <code>2/</code>, <code>3/</code>...).
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-1 sm:items-end">
            <label
              className={`cursor-pointer border-2 border-dashed border-[#1d4ed8] bg-white px-5 py-3 text-center text-xs font-black text-[#1d4ed8] uppercase shadow-xs transition hover:bg-blue-50 ${
                isProcessing || isExtractingZip ? "pointer-events-none opacity-50" : ""
              }`}
            >
              <input
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={handleZipSelected}
                disabled={isProcessing || isExtractingZip}
                className="hidden"
              />
              {isExtractingZip ? "⏳ Descomprimiendo..." : "📁 Seleccionar Archivo .ZIP"}
            </label>
            <span className="text-[10px] text-zinc-500">
              100% en el navegador (rápido y seguro)
            </span>
          </div>
        </div>

        {isExtractingZip && (
          <div
            className="mt-4 border-2 border-zinc-900 bg-white shadow-xs"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center justify-between border-b border-zinc-300 bg-zinc-900 px-4 py-2 text-xs font-extrabold tracking-wider text-white uppercase">
              <span className="flex items-center gap-2">
                <span className="upload-spinner inline-block h-3 w-3 border-2 border-white border-t-transparent" />
                Descomprimiendo y Analizando .ZIP ({zipProgress?.current ?? 0}/{zipProgress?.total ?? 0})
              </span>
              <span className="text-amber-400 tabular-nums">
                {zipProgress?.percent ?? 0}%
              </span>
            </div>

            <div className="space-y-2.5 p-4">
              <div className="h-5 w-full border border-zinc-400 bg-zinc-100">
                <div
                  className="upload-bar h-full bg-[#1d4ed8] upload-stripes"
                  style={{ width: `${Math.max(5, zipProgress?.percent ?? 5)}%` }}
                />
              </div>

              <div className="flex flex-wrap justify-between gap-2 text-[11px] font-semibold text-zinc-600">
                <span className="max-w-sm truncate sm:max-w-md">
                  Extrayendo: <strong>{zipProgress?.fileName || "Leyendo archivos..."}</strong>
                </span>
                <span className="tabular-nums">
                  {zipProgress?.current ?? 0} de {zipProgress?.total ?? 0} archivos analizados
                </span>
              </div>
            </div>
          </div>
        )}

        {zipStatus && !isExtractingZip && (
          <div className="mt-3 border border-emerald-400 bg-emerald-50 p-3 text-xs font-bold text-emerald-900">
            {zipStatus}
          </div>
        )}

        {zipError && (
          <div className="mt-3 border border-rose-400 bg-rose-50 p-3 text-xs font-bold text-rose-900">
            ⚠️ {zipError}
          </div>
        )}
      </div>

      {/* Sección 3: Cola de Capítulos */}
      <div className="border border-zinc-300 bg-white p-5 shadow-2xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-zinc-300 pb-3">
          <div>
            <h3 className="text-base font-black text-zinc-900 uppercase">
              Cola de Capítulos ({completedCount} de {totalCount} subidos)
            </h3>
            <p className="text-xs text-zinc-600">
              Cada capítulo se procesará secuencialmente, subiendo sus páginas en
              paralelo a R2.
            </p>
          </div>

          {!isProcessing && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addChapter}
                className="border border-[#1e40af] bg-[#1d4ed8] px-3 py-1 text-xs font-extrabold text-white uppercase hover:bg-[#1e40af]"
              >
                + Añadir 1 Capítulo
              </button>
              <button
                type="button"
                onClick={() => generateMultiple(3)}
                className="border border-zinc-400 bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-800 hover:bg-zinc-200"
              >
                + 3 Capítulos en Serie
              </button>
              <button
                type="button"
                onClick={() => generateMultiple(5)}
                className="border border-zinc-400 bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-800 hover:bg-zinc-200"
              >
                + 5 Capítulos
              </button>
              {queue.length > 0 && (
                <button
                  type="button"
                  onClick={() => setQueue([])}
                  className="border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                  title="Vaciar toda la cola"
                >
                  Vaciar Cola
                </button>
              )}
            </div>
          )}
        </div>

        {/* Panel animado de progreso del lote y capítulo en curso (Medidor completo) */}
        {isProcessing && activeItemIndex !== null && (
          <div className="mt-4 space-y-3 border-2 border-[#1d4ed8] bg-blue-50/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="upload-spinner inline-block h-3.5 w-3.5 border-2 border-[#1d4ed8] border-t-transparent" />
                <strong className="text-xs font-black uppercase text-zinc-900">
                  Subiendo Lote: Capítulo {queue[activeItemIndex]?.chapterNumber} ({activeItemIndex + 1} de {queue.length})
                </strong>
              </div>
              <span className="text-xs font-black text-[#1d4ed8]">
                {Math.round((completedCount / totalCount) * 100)}% Global del Lote ({completedCount} de {totalCount} listos)
              </span>
            </div>

            {/* Barra de progreso global del lote */}
            <div className="h-2.5 w-full border border-blue-300 bg-white">
              <div
                className="upload-bar h-full bg-[#1d4ed8]"
                style={{
                  width: `${Math.round((completedCount / totalCount) * 100)}%`,
                }}
              />
            </div>

            {/* Medidor visual completo de páginas (idéntico a capítulos individuales) */}
            <UploadProgressPanel
              pages={currentPages}
              phase={currentPhase}
              speed={currentSpeed}
              errorMessage={currentError}
            />
          </div>
        )}

        {/* Lista de filas de la cola */}
        <div className="mt-4 space-y-3">
          {queue.map((item, idx) => {
            const isCurrent = activeItemIndex === idx;

            return (
              <div
                key={item.id}
                className={`border p-4 transition-colors ${
                  isCurrent
                    ? "border-[#1d4ed8] bg-blue-50/40"
                    : item.status === "done"
                      ? "border-emerald-400 bg-emerald-50/50"
                      : item.status === "error"
                        ? "border-rose-400 bg-rose-50/50"
                        : "border-zinc-300 bg-zinc-50"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center border border-zinc-800 bg-zinc-900 text-xs font-black text-white">
                      {idx + 1}
                    </span>
                    <strong className="text-xs uppercase text-zinc-900">
                      Capítulo {item.chapterNumber}
                    </strong>
                    {item.status === "done" && (
                      <span className="bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white uppercase">
                        ✓ Publicado
                      </span>
                    )}
                    {item.status === "uploading" && (
                      <span className="bg-[#1d4ed8] px-2 py-0.5 text-[10px] font-black text-white uppercase">
                        ⏳ Subiendo{" "}
                        {currentPages.length > 0 &&
                          `(${currentPages.filter((p) => p.status === "done").length}/${currentPages.length} págs)`}
                      </span>
                    )}
                    {item.status === "error" && (
                      <span className="bg-rose-600 px-2 py-0.5 text-[10px] font-black text-white uppercase">
                        ✕ Error
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.uploadId && (
                      <Link
                        href={`/leer/${item.uploadId}`}
                        target="_blank"
                        className="text-xs font-extrabold text-[#1d4ed8] hover:underline"
                      >
                        Abrir Lector ↗
                      </Link>
                    )}
                    {!isProcessing && queue.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeChapter(item.id)}
                        className="text-xs font-bold text-rose-700 hover:underline"
                      >
                        ✕ Quitar
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-[11px] font-extrabold text-zinc-700 uppercase">
                      Número de Cap.
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={item.chapterNumber}
                      onChange={(e) =>
                        updateItem(item.id, {
                          chapterNumber: Number(e.target.value),
                        })
                      }
                      disabled={isProcessing || item.status === "done"}
                      className="w-full rounded-none border border-zinc-400 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-900"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-[11px] font-extrabold text-zinc-700 uppercase">
                      Título (opcional)
                    </label>
                    <input
                      type="text"
                      value={item.chapterTitle}
                      onChange={(e) =>
                        updateItem(item.id, { chapterTitle: e.target.value })
                      }
                      placeholder={`Capítulo ${item.chapterNumber}`}
                      disabled={isProcessing || item.status === "done"}
                      className="w-full rounded-none border border-zinc-400 bg-white px-2.5 py-1.5 text-xs text-zinc-900"
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <label className="mb-1 block text-[11px] font-extrabold text-zinc-700 uppercase">
                      Imágenes del Capítulo ({item.files.length} seleccionadas)
                    </label>

                    <div className="flex items-center gap-2">
                      <label
                        className={`flex-1 cursor-pointer border border-dashed px-3 py-1.5 text-center text-xs font-bold ${
                          item.files.length > 0
                            ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                            : "border-zinc-400 bg-white text-[#1d4ed8] hover:bg-zinc-50"
                        } ${isProcessing || item.status === "done" ? "pointer-events-none opacity-60" : ""}`}
                      >
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={(e) =>
                            handleFilesSelected(
                              item.id,
                              Array.from(e.target.files || [])
                            )
                          }
                          disabled={isProcessing || item.status === "done"}
                          className="hidden"
                        />
                        {item.files.length > 0
                          ? `✓ ${item.files.length} páginas listas`
                          : "[ Seleccionar páginas ]"}
                      </label>

                      {item.files.length > 0 && !isProcessing && item.status !== "done" && (
                        <button
                          type="button"
                          onClick={() => handleFilesSelected(item.id, [])}
                          className="text-xs text-rose-700 hover:font-bold"
                          title="Vaciar"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {item.error && (
                  <p className="mt-2 text-xs font-bold text-rose-700">
                    ⚠️ {item.error}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Resumen final al completar el lote */}
        {isAllDone && (
          <div className="mt-6 border-2 border-emerald-500 bg-emerald-50 p-5 text-center">
            <h4 className="text-base font-black uppercase text-emerald-900">
              🎉 ¡Lote Completado con Éxito!
            </h4>
            <p className="mt-1 text-xs text-emerald-800">
              Se han subido y publicado los {totalCount} capítulos correctamente en{" "}
              <strong>{selectedManga?.title}</strong>.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href={`/manga/${selectedManga?.slug}`}
                className="border border-emerald-800 bg-emerald-700 px-4 py-2 text-xs font-extrabold text-white uppercase hover:bg-emerald-800"
              >
                Ver Ficha de la Obra »
              </Link>
            </div>
          </div>
        )}

        {/* Botón de inicio del lote */}
        {!isAllDone && (
          <div className="mt-6 border-t border-zinc-200 pt-4">
            <button
              type="button"
              onClick={startBatchUpload}
              disabled={isProcessing || queue.length === 0}
              className="w-full border border-[#1e40af] bg-[#1d4ed8] py-3 text-xs font-extrabold tracking-wider text-white uppercase hover:bg-[#1e40af] disabled:opacity-50"
            >
              {isProcessing
                ? `Subiendo Lote... (Capítulo ${
                    activeItemIndex !== null ? activeItemIndex + 1 : 1
                  } de ${queue.length})`
                : `🚀 Iniciar Subida del Lote (${queue.length} Capítulos)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

