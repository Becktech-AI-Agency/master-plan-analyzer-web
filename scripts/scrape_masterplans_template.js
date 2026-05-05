#!/usr/bin/env node
/*
  Template scraper workflow:
  1) Query property sources
  2) Download plan image into assets/
  3) Extract text (OCR/manual)
  4) Append normalized entry into data/properties.json

  This template is intentionally safe and explicit.
*/

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "properties.json");

function loadDb() {
  return JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
}

function saveDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + "\n", "utf-8");
}

function upsertProperty(entry) {
  const db = loadDb();
  const idx = db.properties.findIndex((p) => p.id === entry.id);
  if (idx >= 0) db.properties[idx] = entry;
  else db.properties.push(entry);
  saveDb(db);
  console.log(`Saved property: ${entry.id}`);
}

function run() {
  // Replace this with real scraping logic.
  // Keep source attribution for each entry in production.
  const demoEntry = {
    id: "sample-plan",
    name: "Sample Plan",
    developer: "Sample Developer",
    community: "Dubai",
    city: "Dubai",
    country: "UAE",
    type: "Townhouse",
    beds: "3BR",
    image: "assets/sample-plan.jpeg",
    affiliateUrl: "https://example.com/sample-plan",
    rooms: {
      "Living Room": "4.0 x 4.0m",
      "Master Bedroom": "4.0 x 3.5m"
    }
  };

  upsertProperty(demoEntry);
}

run();
