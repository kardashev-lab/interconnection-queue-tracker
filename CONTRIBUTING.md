# Contributing to Interconnection Queue Tracker

Thanks for helping make US interconnection queue data easier to use. This project tracks generator interconnection queues across the major US ISO/RTO markets and turns scattered public files into one searchable product.

## What this repo does

- Fetches public queue reports for ERCOT, MISO, PJM, CAISO, SPP, NYISO, and ISO-NE.
- Stores normalized project records in Postgres.
- Serves a Next.js web app for search, filtering, maps, and CSV export.

Stack: Next.js, TypeScript, Postgres, Python fetcher, Docker Compose, GitHub Actions.

## Local setup

```bash
docker compose up -d postgres

cd web
cp .env.local.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

To load data:

```bash
docker compose --profile fetch run --rm fetcher
```

To fetch a smaller slice while developing:

```bash
FETCH_MARKETS=PJM,CAISO docker compose --profile fetch run --rm fetcher
```

## Before opening a PR

From `web/`:

```bash
npm run lint
npm run build
```

If you change the Python fetcher, run the affected fetch locally and include the markets you tested in the PR.

## Good first contributions

- Add or improve a market-specific data-quality warning.
- Improve empty states for filtered searches.
- Add a filter for queue status, fuel type, county, or capacity.
- Improve mobile layout for project detail cards.
- Document one ISO source and its known quirks.

## Data contribution guidelines

- Keep raw source assumptions documented in code or README.
- Do not silently drop rows. If data is malformed, log it or flag it.
- Prefer additive schema changes.
- Include a small sample or screenshot when changing parser behavior.

## PR guidelines

- Keep one market/source change per PR when possible.
- Do not commit database dumps or credentials.
- Explain what source file/API you tested against.
- Include screenshots for UI changes.
