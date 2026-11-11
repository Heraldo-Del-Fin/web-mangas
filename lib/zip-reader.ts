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
  chapterNumber: number | null;
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

  // IMPORTANTE: no escribir manualmente con writer.write() antes de leer la salida,
  // porque con datos > búfer interno la escritura queda bloqueada (deadlock) esperando
  // a que alguien consuma el readable. pipeThrough consume ambos lados concurrentemente.
  const copy = new Uint8Array(compressed.byteLength);
  copy.set(compressed);
  const stream = new Blob([copy]).stream().pipeThrough(
    new DecompressionStream("deflate-raw")
  );
  const arrayBuffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Lee todas las entradas de un archivo .ZIP o .ZIP64 desde el Central Directory.
 * Utiliza File.slice() para leer únicamente los fragmentos necesarios sin cargar
 * archivos gigantes (1 GB, 2 GB+) completos en memoria RAM.
 */
export async function readZipFile(
  file: File,
  onProgress?: (progress: ZipProgressState) => void
): Promise<ZipExtractedFile[]> {
  const fileSize = file.size;
  if (fileSize < 22) {
    throw new Error("El archivo seleccionado está vacío o dañado.");
  }

  // 1. Buscar la firma "End of Central Directory" (0x06054b50) en los últimos bytes del archivo
  const maxSearch = Math.min(fileSize, 65535 + 22 + 128);
  const searchStart = fileSize - maxSearch;
  const tailBuffer = await file.slice(searchStart, fileSize).arrayBuffer();
  const tailView = new DataView(tailBuffer);

  let eocdRelOffset = -1;
  for (let i = tailBuffer.byteLength - 22; i >= 0; i--) {
    if (tailView.getUint32(i, true) === 0x06054b50) {
      eocdRelOffset = i;
      break;
    }
  }

  if (eocdRelOffset === -1) {
    throw new Error(
      "El archivo seleccionado no es un archivo .ZIP válido o está dañado."
    );
  }

  let totalEntries = tailView.getUint16(eocdRelOffset + 10, true);
  let centralDirSize = tailView.getUint32(eocdRelOffset + 12, true);
  let centralDirOffset = tailView.getUint32(eocdRelOffset + 16, true);

  // 2. Comprobar si existe el encabezado ZIP64 (utilizado en archivos grandes > 1 GB o con muchos archivos)
  let isZip64 = false;
  let zip64EocdOffset = -1;

  // En ZIP64, el localizador de 20 bytes suele estar exactamente 20 bytes antes del EOCD
  if (eocdRelOffset >= 20) {
    if (tailView.getUint32(eocdRelOffset - 20, true) === 0x07064b50) {
      isZip64 = true;
      zip64EocdOffset = Number(
        tailView.getBigUint64(eocdRelOffset - 20 + 8, true)
      );
    }
  }

  // Si no estaba exactamente a -20, buscar en los bytes anteriores
  if (!isZip64) {
    const minCheck = Math.max(0, eocdRelOffset - 128);
    for (let j = eocdRelOffset - 4; j >= minCheck; j--) {
      if (tailView.getUint32(j, true) === 0x07064b50) {
        isZip64 = true;
        zip64EocdOffset = Number(tailView.getBigUint64(j + 8, true));
        break;
      }
    }
  }

  if (isZip64 && zip64EocdOffset >= 0 && zip64EocdOffset < fileSize) {
    // Leer el registro ZIP64 End of Central Directory (0x06064b50)
    const z64Buffer = await file
      .slice(zip64EocdOffset, zip64EocdOffset + 56)
      .arrayBuffer();
    const z64View = new DataView(z64Buffer);
    if (z64View.getUint32(0, true) === 0x06064b50) {
      totalEntries = Number(z64View.getBigUint64(32, true));
      centralDirSize = Number(z64View.getBigUint64(40, true));
      centralDirOffset = Number(z64View.getBigUint64(48, true));
    }
  }

  if (
    centralDirOffset < 0 ||
    centralDirOffset + centralDirSize > fileSize ||
    centralDirSize === 0
  ) {
    throw new Error(
      `Estructura del directorio central del archivo ZIP inválida o incompleta (tamaño: ${(fileSize / (1024 * 1024)).toFixed(1)} MB).`
    );
  }

  // 3. Cargar ÚNICAMENTE el directorio central en memoria (generalmente solo unos cientos de KB)
  const cdBuffer = await file
    .slice(centralDirOffset, centralDirOffset + centralDirSize)
    .arrayBuffer();
  const cdView = new DataView(cdBuffer);
  const cdBytes = new Uint8Array(cdBuffer);

  let cdPtr = 0;
  const decoder = new TextDecoder("utf-8");

  interface EntryMeta {
    fileName: string;
    compressionMethod: number;
    compressedSize: number;
    uncompressedSize: number;
    localHeaderOffset: number;
  }

  const entriesList: EntryMeta[] = [];

  for (let e = 0; e < totalEntries && cdPtr < cdBuffer.byteLength; e++) {
    const cdSig = cdView.getUint32(cdPtr, true);
    if (cdSig !== 0x02014b50) break;

    const compressionMethod = cdView.getUint16(cdPtr + 10, true);
    let compressedSize = cdView.getUint32(cdPtr + 20, true);
    let uncompressedSize = cdView.getUint32(cdPtr + 24, true);
    const fileNameLength = cdView.getUint16(cdPtr + 28, true);
    const extraFieldLength = cdView.getUint16(cdPtr + 30, true);
    const fileCommentLength = cdView.getUint16(cdPtr + 32, true);
    let localHeaderOffset = cdView.getUint32(cdPtr + 42, true);

    const fileNameBytes = cdBytes.subarray(
      cdPtr + 46,
      cdPtr + 46 + fileNameLength
    );
    const fullPath = decoder.decode(fileNameBytes).replace(/\\/g, "/");

    // Si los tamaños exceden 32-bit (0xFFFFFFFF), leer el campo extra ZIP64 (tag 0x0001)
    if (
      extraFieldLength > 0 &&
      (uncompressedSize === 0xffffffff ||
        compressedSize === 0xffffffff ||
        localHeaderOffset === 0xffffffff)
    ) {
      let extraPtr = cdPtr + 46 + fileNameLength;
      const extraEnd = extraPtr + extraFieldLength;
      while (extraPtr + 4 <= extraEnd) {
        const tag = cdView.getUint16(extraPtr, true);
        const tagSize = cdView.getUint16(extraPtr + 2, true);
        extraPtr += 4;
        if (tag === 0x0001) {
          let fPtr = extraPtr;
          if (uncompressedSize === 0xffffffff && fPtr + 8 <= extraEnd) {
            uncompressedSize = Number(cdView.getBigUint64(fPtr, true));
            fPtr += 8;
          }
          if (compressedSize === 0xffffffff && fPtr + 8 <= extraEnd) {
            compressedSize = Number(cdView.getBigUint64(fPtr, true));
            fPtr += 8;
          }
          if (localHeaderOffset === 0xffffffff && fPtr + 8 <= extraEnd) {
            localHeaderOffset = Number(cdView.getBigUint64(fPtr, true));
            fPtr += 8;
          }
        }
        extraPtr += tagSize;
      }
    }

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

    entriesList.push({
      fileName: fullPath,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
  }

  // 4. Extraer cada archivo leyendo únicamente su porción correspondiente del ZIP
  const extracted: ZipExtractedFile[] = [];
  const totalFiles = entriesList.length;

  if (totalFiles === 0) {
    throw new Error(
      "El archivo .zip no contiene archivos legibles (¿está vacío o usa un método de compresión no soportado?)."
    );
  }

  if (onProgress) {
    onProgress({
      current: 0,
      total: totalFiles,
      fileName: "Directorio leído, iniciando extracción...",
      percent: 0,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  for (let idx = 0; idx < totalFiles; idx++) {
    const entry = entriesList[idx];

    // Leer el encabezado local del archivo (30 bytes iniciales)
    const localHeaderSlice = await file
      .slice(entry.localHeaderOffset, entry.localHeaderOffset + 30)
      .arrayBuffer();
    const localView = new DataView(localHeaderSlice);

    if (localView.getUint32(0, true) !== 0x04034b50) {
      continue;
    }

    const localFileNameLen = localView.getUint16(26, true);
    const localExtraLen = localView.getUint16(28, true);
    const dataOffset =
      entry.localHeaderOffset + 30 + localFileNameLen + localExtraLen;

    // Leer ÚNICAMENTE los bytes comprimidos de este archivo específico
    const compressedSlice = await file
      .slice(dataOffset, dataOffset + entry.compressedSize)
      .arrayBuffer();
    const compressedBytes = new Uint8Array(compressedSlice);

    let fileData: Uint8Array;
    try {
      if (entry.compressionMethod === 0) {
        fileData = compressedBytes;
      } else if (entry.compressionMethod === 8) {
        fileData = await decompressDeflateRaw(compressedBytes);
      } else {
        continue;
      }
    } catch {
      // Si un archivo específico está dañado, se omite y continúa con el resto
      continue;
    }

    const parts = entry.fileName.split("/");
    const simpleName = parts[parts.length - 1];

    extracted.push({
      name: simpleName,
      fullPath: entry.fileName,
      data: fileData,
    });

    if (onProgress) {
      onProgress({
        current: idx + 1,
        total: totalFiles,
        fileName: simpleName,
        percent: Math.min(99, Math.round(((idx + 1) / totalFiles) * 100)),
      });

      // Ceder brevemente el control al render loop de React cada 2 archivos
      if (idx % 2 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
  }

  if (onProgress) {
    onProgress({
      current: totalFiles,
      total: totalFiles,
      fileName: "Completado",
      percent: 100,
    });
  }

  return extracted;
}

/**
 * Deduce el tipo MIME y extensión de una imagen a partir de su extensión
 * o inspeccionando los magic bytes del archivo (para archivos nombrados "001", "002" sin extensión).
 */
export function detectImageInfo(
  data: Uint8Array,
  fileName: string
): { mime: string; ext: string } | null {
  const lower = fileName.toLowerCase();

  // 1. Por extensión explícita
  if (lower.endsWith(".png")) return { mime: "image/png", ext: ".png" };
  if (lower.endsWith(".webp")) return { mime: "image/webp", ext: ".webp" };
  if (lower.endsWith(".avif")) return { mime: "image/avif", ext: ".avif" };
  if (lower.endsWith(".gif")) return { mime: "image/gif", ext: ".gif" };
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg"))
    return { mime: "image/jpeg", ext: ".jpg" };

  // 2. Por magic bytes en el encabezado binario
  if (data.length >= 4) {
    // PNG: 89 50 4E 47
    if (
      data[0] === 0x89 &&
      data[1] === 0x50 &&
      data[2] === 0x4e &&
      data[3] === 0x47
    ) {
      return { mime: "image/png", ext: ".png" };
    }
    // JPEG: FF D8 FF
    if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
      return { mime: "image/jpeg", ext: ".jpg" };
    }
    // GIF: GIF8
    if (
      data[0] === 0x47 &&
      data[1] === 0x49 &&
      data[2] === 0x46 &&
      data[3] === 0x38
    ) {
      return { mime: "image/gif", ext: ".gif" };
    }
    // WebP: RIFF....WEBP
    if (
      data.length >= 12 &&
      data[0] === 0x52 &&
      data[1] === 0x49 &&
      data[2] === 0x46 &&
      data[3] === 0x46 &&
      data[8] === 0x57 &&
      data[9] === 0x45 &&
      data[10] === 0x42 &&
      data[11] === 0x50
    ) {
      return { mime: "image/webp", ext: ".webp" };
    }
  }

  // 3. Si el nombre es puramente numérico (ej: "001", "002", "1", "2")
  if (/^\d+$/.test(fileName.trim())) {
    return { mime: "image/jpeg", ext: ".jpg" };
  }

  return null;
}

/**
 * Ordena nombres de archivos numéricamente (ej: 001, 002, 1.jpg, 2.jpg, 10.jpg).
 */
function naturalSortCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Analiza las rutas de los archivos extraídos del ZIP y organiza los capítulos:
 * Estructuras soportadas:
 * 1) "capitulos/1/001.webp", "capitulos/2/001.jpg", etc.
 * 2) "1/001", "2/002", etc. (directo en la raíz del ZIP, con o sin extensión)
 * 3) "capitulo-1/01.jpg", "Cap 1/01.jpg", "ch_1/01.jpg", etc.
 */
export function groupFilesIntoChapters(files: ZipExtractedFile[]): ZipChapterEntry[] {
  // Filtrar archivos de imagen válidos (por extensión o magic bytes)
  const imageFiles = files.filter((f) => detectImageInfo(f.data, f.name) !== null);

  // Mapa de clave de carpeta -> lista de archivos
  const foldersMap = new Map<string, ZipExtractedFile[]>();

  for (const file of imageFiles) {
    const parts = file.fullPath.split("/").filter(Boolean);
    if (parts.length < 2) {
      // Imagen suelta en la raíz sin subcarpeta de capítulo
      continue;
    }

    // Buscar la carpeta que contiene la identificación del capítulo
    let folderName = "";

    // 1) Si alguna carpeta en la ruta es "capitulos", "chapters", etc., tomar la carpeta siguiente
    const capIdx = parts.findIndex((p) =>
      /^(capitulos?|chapters?|chaps?|mangas?)$/i.test(p)
    );
    if (capIdx !== -1 && capIdx + 1 < parts.length - 1) {
      folderName = parts[capIdx + 1];
    } else {
      // 2) Buscar de derecha a izquierda el segmento de carpeta que contenga dígitos (ej: "1", "10.5", "Cap-1")
      for (let i = parts.length - 2; i >= 0; i--) {
        if (/\d/.test(parts[i])) {
          folderName = parts[i];
          break;
        }
      }
      // 3) Si ninguna carpeta tiene números, tomar la carpeta inmediatamente superior a la imagen
      if (!folderName) {
        folderName = parts[parts.length - 2];
      }
    }

    const currentList = foldersMap.get(folderName) ?? [];
    currentList.push(file);
    foldersMap.set(folderName, currentList);
  }

  const results: ZipChapterEntry[] = [];

  for (const [folderName, filesInFolder] of foldersMap.entries()) {
    // Intentar extraer el número del capítulo desde el nombre de la carpeta
    // Ej: "0", "0.5", "1", "10.5", "10,5", "capitulo-10.5", "Cap 0"
    const normalizedFolder = folderName.replace(/(\d+)[,._](\d+)/g, "$1.$2");
    const numberMatch = normalizedFolder.match(/(\d+(?:\.\d+)?)/);
    const chapterNumber = numberMatch ? parseFloat(numberMatch[1]) : null;

    // Ordenar las imágenes de cada capítulo por orden natural (001, 002, 003...)
    filesInFolder.sort((a, b) => naturalSortCompare(a.name, b.name));

    // Convertir Uint8Array a File estándar del navegador
    const domFiles: File[] = filesInFolder.map((f, idx) => {
      const info = detectImageInfo(f.data, f.name) ?? {
        mime: "image/jpeg",
        ext: ".jpg",
      };
      const normalizedName = `${String(idx + 1).padStart(3, "0")}${info.ext}`;
      return new File([f.data as unknown as BlobPart], normalizedName, {
        type: info.mime,
      });
    });

    results.push({
      chapterNumber,
      chapterFolder: folderName,
      files: domFiles,
    });
  }

  // Ordenar los capítulos por número de capítulo (ej: 0, 0.5, 1, 2, 10, 10.5, 11)
  results.sort((a, b) => {
    const numA = a.chapterNumber ?? 999999;
    const numB = b.chapterNumber ?? 999999;
    if (numA !== numB) return numA - numB;
    return naturalSortCompare(a.chapterFolder, b.chapterFolder);
  });

  return results;
}

