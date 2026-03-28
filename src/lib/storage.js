import { supabase } from "./supabase";

const BUCKET = "mug-images";

export function getMugImageUrl(path) {
  if (!path) return "";

  // Если в БД уже лежит полный URL, просто возвращаем его
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || "";
}

export async function uploadMugImage(file) {
  if (!file) {
    throw new Error("Файл не выбран.");
  }

  const rawExtension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const extension = rawExtension.replace(/[^a-z0-9]+/g, "") || "jpg";

  const uniqueId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const path = `mugs/${uniqueId}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) {
    throw error;
  }

  return path;
}