# Planora UAE

One-page UAE property master plan comparison app (HTML/CSS/JS + JSON database).

## Live domain (budget-friendly)

Suggested domain: `planora.bck.life`.

Update these files if you pick another domain:

- `index.html` (canonical + OG + schema URLs)
- `robots.txt`
- `sitemap.xml`

## Run locally

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Data model

- Database: `data/properties.json`
- Images: `assets/` and `assets/scraped/`

## Scraper (developer websites)

Config:

- `config/sources.json`

Run:

```bash
python3 scripts/scrape_masterplans.py
```

What it does:

1. Reads developer source URLs.
2. Fetches page title + `og:image`.
3. Downloads image to `assets/scraped`.
4. Upserts an entry in `data/properties.json`.

## Monetization wiring

- Ad slots: in `index.html` (`data-ad-slot` blocks)
- Google Analytics: `gtag` included in `index.html`
- Affiliate links: `affiliateUrl` per property entry

## Next production step

Replace `G-XXXXXXXXXX` in `index.html` with your GA4 Measurement ID.
