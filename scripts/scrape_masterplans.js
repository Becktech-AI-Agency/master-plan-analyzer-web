#!/usr/bin/env node
/*
  Planora scraper (developer websites first)
  - Reads config/sources.json
  - Fetches page html
  - Extracts title and og:image
  - Downloads image to assets/scraped
  - Upserts entry in data/properties.json

  Notes:
  - Respect each website's Terms of Use and robots policy.
  - Some pages are JS-rendered; those may need a headless browser later.
*/

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const DB_PATH = path.join(ROOT, "data", "properties.json");
const SRC_PATH = path.join(ROOT, "config", "sources.json");
const ASSET_DIR = path.join(ROOT, "assets", "scraped");

if (!fs.existsSync(ASSET_DIR)) fs.mkdirSync(ASSET_DIR, { recursive: true });

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function parseTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim().replace(/\s+/g, " ") : "Unknown Plan";
}

function parseMeta(html, name) {
  const rx = new RegExp(
    `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const m = html.match(rx);
  return m ? m[1].trim() : "";
}

function absolutizeUrl(baseUrl, maybeRelative) {
  try {
    return new URL(maybeRelative, baseUrl).toString();
  } catch {
    return "";
  }
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "PlanoraBot/1.0 (+https://planora.bck.life)",
      accept: "text/html,application/xhtml+xml"
    }
  });
  if (!res.ok) throw new Error(`Failed ${url} (${res.status})`);
  return await res.text();
}

async function downloadFile(url, localPath) {
  const res = await fetch(url, {
    headers: { "user-agent": "PlanoraBot/1.0 (+https://planora.bck.life)" }
  });
  if (!res.ok) throw new Error(`Image failed ${url} (${res.status})`);
  const arr = await res.arrayBuffer();
  fs.writeFileSync(localPath, Buffer.from(arr));
}

function guessExt(url) {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".png")) return ".png";
  if (clean.endsWith(".webp")) return ".webp";
  if (clean.endsWith(".jpeg")) return ".jpeg";
  return ".jpg";
}

function inferNameFromTitle(title) {
  const first = title.split("|")[0].split("-")[0].trim();
  return first.length > 2 ? first : "Master Plan";
}

function upsertProperty(db, entry) {
  const idx = db.properties.findIndex((p) => p.id === entry.id);
  if (idx >= 0) db.properties[idx] = { ...db.properties[idx], ...entry };
  else db.properties.push(entry);
}

async function run() {
  const db = loadJson(DB_PATH);
  const sources = loadJson(SRC_PATH).sources || [];

  for (const src of sources) {
    try {
      const html = await fetchText(src.url);
      const title = parseTitle(html);
      const ogImage = parseMeta(html, "og:image");
      const fullImageUrl = ogImage ? absolutizeUrl(src.url, ogImage) : "";

      const inferredName = inferNameFromTitle(title);
      const idBase = slugify(inferredName || src.community || src.developer || "plan");
      const hash = crypto.createHash("md5").update(src.url).digest("hex").slice(0, 6);
      const id = `${idBase}-${hash}`;

      let imagePath = "";
      if (fullImageUrl) {
        const ext = guessExt(fullImageUrl);
        const localFile = `${id}${ext}`;
        const absLocal = path.join(ASSET_DIR, localFile);
        await downloadFile(fullImageUrl, absLocal);
        imagePath = `assets/scraped/${localFile}`;
      }

      const entry = {
        id,
        name: src.name || inferredName,
        developer: src.developer || "Unknown Developer",
        community: src.community || "Unknown Community",
        city: src.city || "Dubai",
        country: src.country || "UAE",
        type: src.type || "Townhouse",
        beds: src.beds || "N/A",
        image: imagePath || "assets/generated/hero-illustration.svg",
        affiliateUrl: src.url,
        sourceUrl: src.url,
        sourceTitle: title,
        rooms: src.rooms || {}
      };

      upsertProperty(db, entry);
      console.log(`Upserted: ${entry.name} (${entry.id})`);
    } catch (err) {
      console.error(`Source failed: ${src.url}`);
      console.error(String(err.message || err));
    }
  }

  saveJson(DB_PATH, db);
  console.log("Done. Database updated:", DB_PATH);
}

run();
