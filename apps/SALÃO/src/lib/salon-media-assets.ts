import { getSupabaseBrowserClient } from "./supabase-browser";

type ManagedAssetBucket = "inventory-products" | "salon-assets";

const bucketConfig: Record<
  ManagedAssetBucket,
  {
    allowedTypes: ReadonlySet<string>;
    maxSizeBytes: number;
  }
> = {
  "inventory-products": {
    allowedTypes: new Set(["image/jpeg", "image/png", "image/webp"]),
    maxSizeBytes: 4 * 1024 * 1024,
  },
  "salon-assets": {
    allowedTypes: new Set(["image/jpeg", "image/png", "image/svg+xml", "image/webp"]),
    maxSizeBytes: 2 * 1024 * 1024,
  },
};

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

export function isAbsoluteMediaAssetUrl(value: string | null | undefined) {
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

export function resolveManagedMediaAssetUrl(
  bucket: ManagedAssetBucket,
  assetPath: string | null | undefined,
) {
  const normalized = assetPath?.trim();
  if (!normalized) {
    return null;
  }

  if (isAbsoluteMediaAssetUrl(normalized)) {
    return normalized;
  }

  return getSupabaseBrowserClient().storage.from(bucket).getPublicUrl(normalized);
}

export function resolveManagedMediaAssetUrls(
  bucket: ManagedAssetBucket,
  assetPaths: Array<string | null | undefined>,
) {
  return assetPaths
    .map((assetPath) => resolveManagedMediaAssetUrl(bucket, assetPath))
    .filter((assetUrl): assetUrl is string => Boolean(assetUrl));
}

export async function uploadManagedMediaFiles(input: {
  bucket: ManagedAssetBucket;
  files: File[];
  folder: string;
  salonId: string;
}) {
  if (!input.files.length) {
    return [];
  }

  const config = bucketConfig[input.bucket];
  const supabase = getSupabaseBrowserClient();
  const uploadedPaths: string[] = [];
  const normalizedFolder = input.folder.trim().replace(/^\/+|\/+$/g, "");
  const today = new Date().toISOString().slice(0, 10);

  for (const file of input.files) {
    if (!config.allowedTypes.has(file.type)) {
      throw new Error(
        input.bucket === "salon-assets"
          ? "Envie imagens JPG, PNG, WEBP ou SVG para o app do cliente."
          : "Envie imagens JPG, PNG ou WEBP para os produtos da loja.",
      );
    }

    if (file.size > config.maxSizeBytes) {
      throw new Error(
        input.bucket === "salon-assets"
          ? "Cada imagem do app do cliente precisa ter no maximo 2 MB."
          : "Cada imagem do produto precisa ter no maximo 4 MB.",
      );
    }

    const extension = inferExtension(file);
    const path = `${input.salonId}/${normalizedFolder}/${today}/${randomId()}.${extension}`;
    const uploadResult = await supabase.storage.from(input.bucket).upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

    if (uploadResult.error) {
      throw new Error(
        uploadResult.error.message ||
          (input.bucket === "salon-assets"
            ? "Nao foi possivel enviar a imagem do app do cliente."
            : "Nao foi possivel enviar a imagem do produto."),
      );
    }

    uploadedPaths.push(path);
  }

  return uploadedPaths;
}

export function resolveSalonAssetUrl(assetPath: string | null | undefined) {
  return resolveManagedMediaAssetUrl("salon-assets", assetPath);
}

export function resolveSalonAssetUrls(assetPaths: Array<string | null | undefined>) {
  return resolveManagedMediaAssetUrls("salon-assets", assetPaths);
}

export function resolveInventoryProductAssetUrl(assetPath: string | null | undefined) {
  return resolveManagedMediaAssetUrl("inventory-products", assetPath);
}

export function resolveInventoryProductAssetUrls(assetPaths: Array<string | null | undefined>) {
  return resolveManagedMediaAssetUrls("inventory-products", assetPaths);
}

export async function uploadSalonAssetFiles(input: {
  files: File[];
  folder: string;
  salonId: string;
}) {
  return uploadManagedMediaFiles({
    bucket: "salon-assets",
    files: input.files,
    folder: input.folder,
    salonId: input.salonId,
  });
}

export async function uploadInventoryProductImages(input: { files: File[]; salonId: string }) {
  return uploadManagedMediaFiles({
    bucket: "inventory-products",
    files: input.files,
    folder: "products",
    salonId: input.salonId,
  });
}
