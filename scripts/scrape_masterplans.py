#!/usr/bin/env python3
"""
Planora scraper in Python.
- Reads config/sources.json
- Fetches developer pages
- Extracts <title> and og:image
- Downloads image to assets/scraped
- Upserts entries in data/properties.json
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "properties.json"
SRC_PATH = ROOT / "config" / "sources.json"
ASSET_DIR = ROOT / "assets" / "scraped"

ASSET_DIR.mkdir(parents=True, exist_ok=True)

USER_AGENT = "PlanoraBot/1.0 (+https://planora.bck.life)"


def slugify(text: str) -> str:
    text = (text or "").lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:80] or "plan"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def fetch_bytes(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,*/*"})
    with urlopen(req, timeout=30) as resp:
        return resp.read()


def fetch_text(url: str) -> str:
    data = fetch_bytes(url)
    return data.decode("utf-8", errors="replace")


def parse_title(html: str) -> str:
    m = re.search(r"<title[^>]*>([\s\S]*?)</title>", html, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else "Unknown Plan"


def parse_og_image(html: str) -> str:
    patterns = [
        r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\'][^>]*>',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\'][^>]*>',
        r'<meta[^>]+name=["\']og:image["\'][^>]+content=["\']([^"\']+)["\'][^>]*>',
    ]
    for p in patterns:
        m = re.search(p, html, flags=re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return ""


def infer_name_from_title(title: str) -> str:
    part = title.split("|")[0].split("-")[0].strip()
    return part if len(part) > 2 else "Master Plan"


def guess_ext(image_url: str) -> str:
    path = urlparse(image_url).path.lower()
    if path.endswith(".png"):
        return ".png"
    if path.endswith(".webp"):
        return ".webp"
    if path.endswith(".jpeg"):
        return ".jpeg"
    return ".jpg"


def upsert_property(db: dict, entry: dict) -> None:
    props = db.get("properties", [])
    for i, prop in enumerate(props):
        if prop.get("id") == entry["id"]:
            props[i] = {**prop, **entry}
            return
    props.append(entry)


def run() -> None:
    db = load_json(DB_PATH)
    sources = load_json(SRC_PATH).get("sources", [])

    for src in sources:
        url = src.get("url", "").strip()
        if not url:
            continue
        try:
            html = fetch_text(url)
            title = parse_title(html)
            og_image = parse_og_image(html)
            full_image_url = urljoin(url, og_image) if og_image else ""

            inferred_name = infer_name_from_title(title)
            id_base = slugify(inferred_name or src.get("community") or src.get("developer") or "plan")
            hash6 = hashlib.md5(url.encode("utf-8")).hexdigest()[:6]
            prop_id = f"{id_base}-{hash6}"

            image_rel = "assets/generated/hero-illustration.svg"
            if full_image_url:
                ext = guess_ext(full_image_url)
                local_name = f"{prop_id}{ext}"
                local_path = ASSET_DIR / local_name
                local_path.write_bytes(fetch_bytes(full_image_url))
                image_rel = f"assets/scraped/{local_name}"

            entry = {
                "id": prop_id,
                "name": src.get("name") or inferred_name,
                "developer": src.get("developer", "Unknown Developer"),
                "community": src.get("community", "Unknown Community"),
                "city": src.get("city", "Dubai"),
                "country": src.get("country", "UAE"),
                "type": src.get("type", "Townhouse"),
                "beds": src.get("beds", "N/A"),
                "image": image_rel,
                "affiliateUrl": url,
                "sourceUrl": url,
                "sourceTitle": title,
                "rooms": src.get("rooms", {}),
            }

            upsert_property(db, entry)
            print(f"Upserted: {entry['name']} ({entry['id']})")
        except HTTPError as e:
            print(f"Source failed: {url} -> HTTP {e.code}")
        except URLError as e:
            print(f"Source failed: {url} -> URL error: {e.reason}")
        except Exception as e:
            print(f"Source failed: {url} -> {e}")

    save_json(DB_PATH, db)
    print(f"Done. Database updated: {DB_PATH}")


if __name__ == "__main__":
    run()
