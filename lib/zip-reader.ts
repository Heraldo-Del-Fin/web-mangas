/**
 * Lector nativo de archivos .ZIP para el navegador.
 * Utiliza la API estándar Web DecompressionStream("deflate-raw") soportada
 * nativamente en todos los navegadores modernos, sin requerir dependencias externas.
 */

export interface ZipExtractedFile {
  name: string; // ej: "01.jpg"
  fullPath: string; // ej: "capitulos/1/01.jpg"
  data: Uint8Array;
}

export interface ZipChapterEntry {
  chapterNumber: number;
  chapterFolder: string;
  files: File[];
}

export interface ZipProgressState {
  current: number;
  total: number;
  fileName: string;
  percent: number;
}

/**
 * Descomprime un búfer usando DecompressionStream("deflate-raw") nativo del navegador.
 */
async function decompressDeflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error(
      "Tu navegador no soporta DecompressionStream. Actualiza a una versión moderna de Chrome, Edge, Firefox o Safari."
    );
  }

  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  // Enviar el búfer comprimido
  await writer.write(compressed as unknown as BufferSource);
  await writer.close();

  const response = new Response(ds.readable);
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Lee todas las entradas de un archivo .ZIP desde el Central Directory.
 */
export async function readZipFile(
  file: File,
  onProgress?: (progress: ZipProgressState) => void
): Promise<ZipExtractedFile[]> {
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // 1. Buscar la firma "End of Central Directory" (0x06054b50) desde el final
  let eocdOffset = -1;
  const maxSearch = Math.min(buffer.byteLength, 65535 + 22);
  const startSearch = buffer.byteLength - 22;

  for (let i = startSearch; i >= buffer.byteLength - maxSearch; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error("El archivo seleccionado no es un archivo .ZIP válido o está dañado.");
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const centralDirSize = view.getUint32(eocdOffset + 12, true);
  const centralDirOffset = view.getUint32(eocdOffset + 16, true);

  if (centralDirOffset + centralDirSize > buffer.byteLength) {
    throw new Error("Estructura de directorio central del archivo ZIP inválida.");
  }

  const extracted: ZipExtractedFile[] = [];
  let cdPtr = centralDirOffset;
  const decoder = new TextDecoder("utf-8");

  for (let e = 0; e < totalEntries && cdPtr < centralDirOffset + centralDirSize; e++) {
    const cdSig = view.getUint32(cdPtr, true);
    if (cdSig !== 0x02014b50) break;

    const compressionMethod = view.getUint16(cdPtr + 10, true);
    const compressedSize = view.getUint32(cdPtr + 20, true);
    const uncompressedSize = view.getUint32(cdPtr + 24, true);
    const fileNameLength = view.getUint16(cdPtr + 28, true);
    const extraFieldLength = view.getUint16(cdPtr + 30, true);
    const fileCommentLength = view.getUint16(cdPtr + 32, true);
    const localHeaderOffset = view.getUint32(cdPtr + 42, true);

    const fileNameBytes = bytes.subarray(cdPtr + 46, cdPtr + 46 + fileNameLength);
    const fullPath = decoder.decode(fileNameBytes).replace(/\\/g, "/");

    cdPtr += 46 + fileNameLength + extraFieldLength + fileCommentLength;

    // Omitir directorios o archivos basura del sistema (Mac/Windows)
    if (
      fullPath.endsWith("/") ||
      fullPath.includes("__MACOSX/") ||
      fullPath.endsWith(".DS_Store") ||
      fullPath.endsWith("Thumbs.db")
    ) {
      continue;
    }

    // 2. Leer los datos desde el Local File Header
    const localSig = view.getUint32(localHeaderOffset, true);
    if (localSig !== 0x04034b50) {
      continue;
    }

    const localFileNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataOffset = localHeaderOffset + 30 + localFileNameLen + localExtraLen;

    const compressedBytes = bytes.subarray(dataOffset, dataOffset + compressedSize);

    let fileData: Uint8Array;
    if (compressionMethod === 0) {
      // Método 0: Sin compresión (Stored)
      fileData = compressedBytes;
    } else if (compressionMethod === 8) {
      // Método 8: Deflate
      fileData = await decompressDeflateRaw(compressedBytes);
    } else {
      // Método de compresión no soportado
      continue;
    }

    const parts = fullPath.split("/");
    const simpleName = parts[parts.length - 1];

    extracted.push({
      name: simpleName,
      fullPath,
      data: fileData,
    });

    if (onProgress) {
      onProgress({
        current: e + 1,
        total: totalEntries,
        fileName: simpleName,
        percent: Math.min(99, Math.round(((e + 1) / totalEntries) * 100)),
      });
      // Ceder brevemente control al bucle de eventos para refresco fluido del UI
      if (e % 2 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  if (onProgress) {
    onProgress({
      current: totalEntries,
      total: totalEntries,
      fileName: "Completado",
      percent: 100,
    });
  }

  return extracted;
}

/**
 * Deduce el tipo MIME de una imagen a partir de su extensión o magic bytes.
 */
function getImageMimeType(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

/**
 * Ordena nombres de archivos numéricamente (ej: 1.jpg, 2.jpg, 10.jpg).
 */
function naturalSortCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Analiza las rutas de los archivos extraídos del ZIP y organiza los capítulos:
 * Estructuras soportadas:
 * 1) "capitulos/1/01.jpg", "capitulos/2/01.jpg", etc.
 * 2) "1/01.jpg", "2/01.jpg", etc. (directo en la raíz del ZIP)
 * 3) "capitulo-1/01.jpg", "Cap 1/01.jpg", "ch_1/01.jpg", etc.
 */
export function groupFilesIntoChapters(files: ZipExtractedFile[]): ZipChapterEntry[] {
  const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif|gif)$/i;

  // Filtrar únicamente imágenes
  const imageFiles = files.filter((f) => IMAGE_EXTENSIONS.test(f.name));

  // Mapa de clave de carpeta -> lista de archivos
  const foldersMap = new Map<string, ZipExtractedFile[]>();

  for (const file of imageFiles) {
    const parts = file.fullPath.split("/").filter(Boolean);
    if (parts.length < 2) {
      // Imagen suelta en la raíz sin subcarpeta de capítulo
      continue;
    }

    // Si la primera carpeta es "capitulos" o similar, la carpeta del capítulo es parts[1]
    let folderName = "";
    if (
      parts.length >= 3 &&
      /^(capitulos?|chapters?|chaps?|manga)$/i.test(parts[0])
    ) {
      folderName = parts[1];
    } else {
      // Estructura directa: "1/01.jpg" o "Subcarpeta/1/01.jpg"
      folderName = parts[parts.length - 2];
    }

    const currentList = foldersMap.get(folderName) ?? [];
    currentList.push(file);
    foldersMap.set(folderName, currentList);
  }

  const results: ZipChapterEntry[] = [];

  for (const [folderName, filesInFolder] of foldersMap.entries()) {
    // Intentar extraer el número del capítulo desde el nombre de la carpeta
    // Ej: "1", "01", "capitulo-1", "Cap 1.5", "ch10"
    const numberMatch = folderName.match(/(\d+(?:\.\d+)?)/);
    const chapterNumber = numberMatch ? parseFloat(numberMatch[1]) : 0;

    // Ordenar las imágenes de cada capítulo por orden natural (01.jpg, 02.jpg...)
    filesInFolder.sort((a, b) => naturalSortCompare(a.name, b.name));

    // Convertir Uint8Array a File estándar del navegador
    const domFiles: File[] = filesInFolder.map((f, idx) => {
      const mime = getImageMimeType(f.name);
      const safeExtension = f.name.includes(".")
        ? f.name.slice(f.name.lastIndexOf("."))
        : ".jpg";
      const normalizedName = `${String(idx + 1).padStart(3, "0")}${safeExtension}`;
      return new File([f.data as unknown as BlobPart], normalizedName, { type: mime });
    });

    results.push({
      chapterNumber,
      chapterFolder: folderName,
      files: domFiles,
    });
  }

  // Ordenar los capítulos por número de capítulo de menor a mayor
  results.sort((a, b) => a.chapterNumber - b.chapterNumber);

  return results;
}

