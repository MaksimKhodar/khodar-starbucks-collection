import { supabase } from "./supabase";

const BUCKET = "mug-images";

// ── URL helpers ───────────────────────────────────────────────────────────────

// width/quality opts are used when Supabase image transform is available (Pro plan).
// On free plan the transform is ignored and the original is served — no errors.
export function getMugImageUrl(path, { width, quality } = {}) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const opts = (width || quality)
    ? { transform: { format: "webp", width: width || 800, quality: quality || 80 } }
    : undefined;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path, opts);
  return data?.publicUrl || "";
}

// ── Single-file upload (avatars, cover images) ────────────────────────────────

export async function uploadMugImage(file) {
  if (!file) throw new Error("Файл не выбран.");
  const ext = (file.name.split(".").pop()?.toLowerCase() || "jpg").replace(/[^a-z0-9]+/g, "") || "jpg";
  const id  = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const path = `mugs/${id}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600", upsert: false, contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

// ── Mug image management (gallery) ───────────────────────────────────────────

export async function listMugImages(mugId) {
  const { data, error } = await supabase
    .from("mug_images")
    .select("id, mug_id, storage_path, sort_order, alt_text, created_at")
    .eq("mug_id", mugId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function uploadImagesForMug(mugId, files, existingCount = 0) {
  if (!mugId) throw new Error("Сначала сохраните кружку.");
  if (!files?.length) return [];
  if (existingCount + files.length > 10)
    throw new Error("У одной кружки может быть максимум 10 изображений.");

  const uploaded = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const imageId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const ext  = (file.name.split(".").pop()?.toLowerCase() || "jpg").replace(/[^a-z0-9]+/g, "") || "jpg";
    const path = `mugs/${mugId}/${imageId}.${ext}`;

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600", upsert: false, contentType: file.type || undefined,
    });
    if (upErr) throw upErr;

    const { data: row, error: insErr } = await supabase
      .from("mug_images")
      .insert({ id: imageId, mug_id: mugId, storage_path: path, sort_order: existingCount + i, alt_text: file.name })
      .select().single();
    if (insErr) throw insErr;
    uploaded.push(row);
  }
  return uploaded;
}

export async function deleteMugImage(imageRow) {
  const { error: storageErr } = await supabase.storage.from(BUCKET).remove([imageRow.storage_path]);
  if (storageErr) throw storageErr;
  const { error: rowErr } = await supabase.from("mug_images").delete().eq("id", imageRow.id);
  if (rowErr) throw rowErr;
}

export async function replaceMugImage(imageRow, file) {
  const newId  = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const ext     = (file.name.split(".").pop()?.toLowerCase() || "jpg").replace(/[^a-z0-9]+/g, "") || "jpg";
  const newPath = `mugs/${imageRow.mug_id}/${newId}.${ext}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(newPath, file, {
    cacheControl: "3600", upsert: false, contentType: file.type || undefined,
  });
  if (upErr) throw upErr;

  const { error: updErr } = await supabase.from("mug_images")
    .update({ storage_path: newPath, alt_text: file.name || imageRow.alt_text })
    .eq("id", imageRow.id);
  if (updErr) throw updErr;

  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([imageRow.storage_path]);
  if (rmErr) throw rmErr;
}

export async function reorderMugImages(mugId, orderedIds) {
  const { error } = await supabase.rpc("reorder_mug_images", { p_mug_id: mugId, p_image_ids: orderedIds });
  if (error) throw error;
}

export { getMugImageUrl as mugImagePublicUrl };
