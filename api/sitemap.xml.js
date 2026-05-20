import { createClient } from "@supabase/supabase-js";

const BASE = "https://khodar-starbucks-collection.vercel.app";

function translit(str) {
  const map = {а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya"};
  return String(str||"").toLowerCase().split("").map(c=>map[c]??c).join("").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
function personSlug(p) {
  const name = [p.first_name, p.last_name].filter(Boolean).join("-");
  return translit(name) || String(p.id);
}

function url(loc, priority = "0.7") {
  return `  <url>\n    <loc>${loc}</loc>\n    <priority>${priority}</priority>\n  </url>`;
}

export default async function handler(req, res) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  );

  const [{ data: mugs }, { data: people }] = await Promise.all([
    supabase.from("mugs").select("collection_number").eq("is_published", true),
    supabase.from("people").select("id, first_name, last_name").eq("is_visible", true),
  ]);

  const urls = [
    url(BASE, "1.0"),
    ...(mugs  || []).map(m => url(`${BASE}/mug/${m.collection_number}`, "0.6")),
    ...(people || []).map(p => url(`${BASE}/people/${personSlug(p)}`, "0.5")),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
  res.status(200).send(xml);
}
