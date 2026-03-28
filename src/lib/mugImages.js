import { supabase } from "./supabase";
import { getMugImageUrl } from "./storage";

const BUCKET = "mug-images";

function fileExtension(file) {
  const raw = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return raw.replace(/[^a-z0-9]+/g, "") || "jpg";
}

function imagePath(mugId, imageId, ext) {
  return `mugs/${mugId}/${imageId}.${ext}`;
}

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

  if (existingCount + files.length > 10) {
    throw new Error("У одной кружки может быть максимум 10 изображений.");
  }

  const uploadedRows = [];

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];
    const imageId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const ext = fileExtension(file);
    const path = imagePath(mugId, imageId, ext);

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) throw uploadError;

    const { data: row, error: insertError } = await supabase
      .from("mug_images")
      .insert({
        id: imageId,
        mug_id: mugId,
        storage_path: path,
        sort_order: existingCount + i,
        alt_text: file.name,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    uploadedRows.push(row);
  }

  return uploadedRows;
}

export async function deleteMugImage(imageRow) {
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove([imageRow.storage_path]);

  if (storageError) throw storageError;

  const { error: rowError } = await supabase
    .from("mug_images")
    .delete()
    .eq("id", imageRow.id);

  if (rowError) throw rowError;
}

export async function replaceMugImage(imageRow, file) {
  const newId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const ext = fileExtension(file);
  const newPath = imagePath(imageRow.mug_id, newId, ext);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(newPath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from("mug_images")
    .update({
      storage_path: newPath,
      alt_text: file.name || imageRow.alt_text,
    })
    .eq("id", imageRow.id);

  if (updateError) throw updateError;

  const { error: removeError } = await supabase.storage
    .from(BUCKET)
    .remove([imageRow.storage_path]);

  if (removeError) throw removeError;
}

export async function reorderMugImages(mugId, orderedIds) {
  const { error } = await supabase.rpc("reorder_mug_images", {
    p_mug_id: mugId,
    p_image_ids: orderedIds,
  });

  if (error) throw error;
}

export function mugImagePublicUrl(storagePath) {
  return getMugImageUrl(storagePath);
}