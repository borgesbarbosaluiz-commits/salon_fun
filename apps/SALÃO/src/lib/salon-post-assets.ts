import { getSupabaseBrowserClient } from "./supabase-browser";

const SALON_POSTS_BUCKET = "salon-posts";
const MAX_POST_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;
const ALLOWED_POST_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

function randomId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return Math.random().toString(36).slice(2, 12);
}

function inferExtension(file: File) {
  const fileName = file.name.trim().toLowerCase();
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex >= 0 && dotIndex < fileName.length - 1) {
    return fileName.slice(dotIndex + 1);
  }

  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  return "jpg";
}

export function isAbsolutePostAssetUrl(value: string | null | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveSalonPostAssetUrl(assetPath: string | null | undefined) {
  const normalized = assetPath?.trim();
  if (!normalized) {
    return null;
  }

  if (isAbsolutePostAssetUrl(normalized)) {
    return normalized;
  }

  return getSupabaseBrowserClient().storage.from(SALON_POSTS_BUCKET).getPublicUrl(normalized);
}

export function resolveSalonPostAssetUrls(assetPaths: Array<string | null | undefined>) {
  return assetPaths
    .map((assetPath) => resolveSalonPostAssetUrl(assetPath))
    .filter((assetUrl): assetUrl is string => Boolean(assetUrl));
}

export async function uploadSalonPostImages(salonId: string, files: File[]) {
  if (!files.length) {
    return [];
  }

  const supabase = getSupabaseBrowserClient();
  const uploadedPaths: string[] = [];

  for (const file of files) {
    if (!ALLOWED_POST_IMAGE_TYPES.has(file.type)) {
      throw new Error("Envie imagens JPG, PNG, WEBP ou SVG no feed.");
    }

    if (file.size > MAX_POST_IMAGE_SIZE_BYTES) {
      throw new Error("Cada imagem do feed precisa ter no maximo 4 MB.");
    }

    const extension = inferExtension(file);
    const path = `${salonId}/${new Date().toISOString().slice(0, 10)}/${randomId()}.${extension}`;
    const uploadResult = await supabase.storage.from(SALON_POSTS_BUCKET).upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

    if (uploadResult.error) {
      throw new Error(uploadResult.error.message || "Nao foi possivel enviar a foto do feed.");
    }

    uploadedPaths.push(path);
  }

  return uploadedPaths;
}
