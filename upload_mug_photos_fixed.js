#!/usr/bin/env node
/**
 * Upload mug photos to Supabase Storage and create mug_images records
 * Run: node upload_mug_photos.js
 * 
 * Requirements:
 *   npm install @supabase/supabase-js
 *   Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
 *   OR pass as env vars: SUPABASE_URL=... SUPABASE_KEY=... node upload_mug_photos.js
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────

// Load from .env.local
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) env[key.trim()] = val.join('=').trim();
  });
  return env;
}

const env = loadEnv();
const SUPABASE_URL = process.env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY || env.VITE_SUPABASE_ANON_KEY;
const PHOTOS_DIR = path.join(__dirname, 'mug_photos');
const MAPPING_FILE = path.join(__dirname, 'mug_photo_mapping.json');
const STORAGE_BUCKET = 'mug-images'; // Change if your bucket name differs
const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_EXISTING = !process.argv.includes('--force');

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY');
  console.error('   Set them in .env.local or pass as env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  return 'application/octet-stream';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`🚀 Mug photo uploader`);
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log(`   Photos dir: ${PHOTOS_DIR}`);
  console.log(`   Dry run: ${DRY_RUN}`);
  console.log(`   Skip existing: ${SKIP_EXISTING}`);
  console.log('');

  // Load mapping
  const mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
  console.log(`📋 Mapping loaded: ${Object.keys(mapping).length} mugs`);

  // Build set of known filenames (no extension)
  const mappedNames = new Set();
  for (const files of Object.values(mapping)) {
    for (const f of files) mappedNames.add(path.parse(f).name);
  }

  // Get all files in photos dir
  const allFiles = fs.readdirSync(PHOTOS_DIR);
  const imageFiles = allFiles.filter(f => {
    const ext = path.extname(f).toLowerCase();
    return ['.webp', '.jpg', '.jpeg', '.png'].includes(ext);
  });
  const matchedFiles = imageFiles.filter(f => mappedNames.has(path.parse(f).name));
  const unmatchedFiles = imageFiles.filter(f => !mappedNames.has(path.parse(f).name));

  console.log(`📁 Files in folder: ${allFiles.length}`);
  console.log(`🖼️  Image files: ${imageFiles.length}`);
  console.log(`✅ Matched to mugs: ${matchedFiles.length}`);
  console.log(`❌ Unmatched (will skip): ${unmatchedFiles.length}`);
  console.log('');

  // Fetch all mugs from DB to get mug_id by collection_number
  console.log('🔍 Fetching mugs from database...');
  const { data: mugs, error: mugsError } = await supabase
    .from('mugs')
    .select('id, collection_number, slug');

  if (mugsError) {
    console.error('❌ Failed to fetch mugs:', mugsError.message);
    process.exit(1);
  }

  // Build map: collection_number -> mug_id
  const mugByNumber = {};
  for (const mug of mugs) {
    if (mug.collection_number != null) {
      mugByNumber[String(mug.collection_number)] = mug;
    }
  }
  console.log(`✅ Loaded ${mugs.length} mugs from DB`);
  console.log('');

  // Check existing mug_images to skip already uploaded
  let existingImages = new Set();
  if (SKIP_EXISTING) {
    const { data: existing } = await supabase
      .from('mug_images')
      .select('storage_path');
    if (existing) {
      for (const img of existing) {
        existingImages.add(img.storage_path);
      }
    }
    console.log(`ℹ️  Already uploaded: ${existingImages.size} images (will skip)`);
    console.log('');
  }

  // Stats
  let uploaded = 0, skipped = 0, failed = 0, noMug = 0;
  const errors = [];

  // Process each mug
  const mugNumbers = Object.keys(mapping).sort((a, b) => Number(a) - Number(b));

  for (const mugNum of mugNumbers) {
    const mug = mugByNumber[mugNum];
    if (!mug) {
      console.log(`⚠️  Mug #${mugNum}: not found in DB (skip)`);
      noMug++;
      continue;
    }

    const files = mapping[mugNum];
    const mugId = mug.id;

    console.log(`\n📦 Mug #${mugNum} (${mug.slug}) — ${files.length} photos`);

    for (let i = 0; i < files.length; i++) {
      const filename = files[i];
      const nameNoExt = path.parse(filename).name;

      // Find actual file in folder (could be .webp or .jpg)
      const actualFile = allFiles.find(f => path.parse(f).name === nameNoExt);
      if (!actualFile) {
        console.log(`  [${i+1}/${files.length}] ${filename} — FILE NOT FOUND locally`);
        failed++;
        errors.push(`Mug #${mugNum}: file ${filename} not found in mug_photos/`);
        continue;
      }

      const storagePath = `${mugId}/${actualFile}`;
      const mimeType = getMimeType(actualFile);

      // Skip if already exists
      if (SKIP_EXISTING && existingImages.has(storagePath)) {
        console.log(`  [${i+1}/${files.length}] ${actualFile} — already uploaded (skip)`);
        skipped++;
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [${i+1}/${files.length}] ${actualFile} → ${storagePath} (dry run)`);
        uploaded++;
        continue;
      }

      // Upload file to Storage
      const filePath = path.join(PHOTOS_DIR, actualFile);
      const fileBuffer = fs.readFileSync(filePath);

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        if (uploadError.message?.includes('already exists') || uploadError.statusCode === '23505' || uploadError.error === 'Duplicate') {
          // File already in storage — still try to create DB record
          console.log(`  [${i+1}/${files.length}] ${actualFile} — already in storage, creating DB record...`);
        } else {
          console.log(`  [${i+1}/${files.length}] ${actualFile} — ❌ upload error: ${uploadError.message}`);
          failed++;
          errors.push(`Mug #${mugNum} ${actualFile}: ${uploadError.message}`);
          continue;
        }
      }

      // Create mug_images record
      const { error: dbError } = await supabase
        .from('mug_images')
        .insert({
          mug_id: mugId,
          storage_path: storagePath,
          sort_order: i,
          alt_text: mug.slug,
        });

      if (dbError) {
        if (dbError.code === '23505' || dbError.message?.includes('duplicate')) {
          console.log(`  [${i+1}/${files.length}] ${actualFile} — ✅ already in DB (skip)`);
          skipped++;
        } else {
          console.log(`  [${i+1}/${files.length}] ${actualFile} — ❌ DB error: ${dbError.message}`);
          failed++;
          errors.push(`Mug #${mugNum} ${actualFile} DB: ${dbError.message}`);
        }
      } else {
        console.log(`  [${i+1}/${files.length}] ${actualFile} — ✅ uploaded`);
        uploaded++;
      }

      // Small delay to avoid rate limiting
      await sleep(50);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log(`  ✅ Uploaded: ${uploaded}`);
  console.log(`  ⏭️  Skipped (existing): ${skipped}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log(`  ⚠️  Mugs not in DB: ${noMug}`);
  console.log(`  🗑️  Unmatched files (not uploaded): ${unmatchedFiles.length}`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  if (unmatchedFiles.length > 0) {
    const unmatchedPath = path.join(__dirname, 'unmatched_files.txt');
    fs.writeFileSync(unmatchedPath, unmatchedFiles.join('\n'));
    console.log(`\n📄 Unmatched files saved to: unmatched_files.txt`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
