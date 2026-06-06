# Interconnection Queue Tracker

Search **generator interconnection queue projects** across US ISOs/RTOs — the public list of power projects waiting to connect to the grid.

**Live ISOs:** ERCOT, MISO, PJM, CAISO, SPP, NYISO, ISO-NE — each from that market’s **public queue report**. The fetcher uses the open-source [gridstatus](https://opensource.gridstatus.io/en/stable/interconnection_queues.html) library for six markets; PJM is fetched directly from PJM’s public export API.

---

## Project layout

```
interconnection-queue-tracker/
├── web/                  # Next.js app (deploy this on Railway)
│   ├── app/              # routes, layout, metadata
│   ├── components/       # UI
│   ├── data/             # curated fallback JSON
│   └── lib/              # DB access, analytics, markets
├── services/fetcher/     # Python job — loads ISO feeds into Postgres
├── scripts/              # local fetch helper
├── docker-compose.yml
├── Dockerfile.web
└── .github/workflows/    # daily fetch CI
```

---

## Quick start

```bash
docker compose up -d postgres

cd web && cp .env.local.example .env.local && npm install && npm run dev

# Load all ISO queues (~2–5 min)
docker compose --profile fetch run --rm fetcher
```

Open **http://localhost:3000**

### Fetch specific ISOs only

```bash
FETCH_MARKETS=PJM,CAISO docker compose --profile fetch run --rm fetcher
```

Or locally without Docker:

```bash
./scripts/fetch-queues.sh
```

---

## Stack

| Layer | Tech |
|---|---|
| UI | Next.js 16, Tailwind v4 |
| Data | Postgres (`queue_projects`, `queue_market_snapshots`) |
| Fetcher | Python (gridstatus + direct ISO feeds) |

The web app reads Postgres directly — no separate API service.

---

## Supported markets

| ISO/RTO | Source |
|---------|--------|
| ERCOT | GIS Report |
| MISO | GI interactive queue |
| PJM | Public interconnection queue export |
| CAISO | Public queue report |
| SPP | Generation interconnection summary |
| NYISO | Interconnection queue |
| ISO-NE | Interconnection queue |

**Not yet:** IESO, AESO

---

## Environment

**Web (`web/.env.local`)**

| Variable | Example | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://queue:queue@127.0.0.1:5434/queue` | Live queue data |
| `CURATED_PATH` | `./data/curated.json` | Fallback signals |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.up.railway.app` | OG metadata |

**Fetcher** — uses `DATABASE_URL` and optional `FETCH_MARKETS`.

---

## Production

### Railway (web only)

1. Create a Railway project with **PostgreSQL** + a **web service**.
2. Set the web service **root directory** to `web`.
3. Link Postgres → injects `DATABASE_URL`.
4. Set `NEXT_PUBLIC_SITE_URL` to your Railway URL.
5. Add GitHub secret `DATABASE_URL` (Railway Postgres **public** URL) for the daily fetch workflow.
6. Run the fetcher once before launch (Actions → “Fetch ISO queues” → Run workflow).

### Docker

```bash
docker compose up -d postgres web
docker compose --profile fetch run --rm fetcher
```

### Scheduled fetch (daily)

**GitHub Actions** — runs at **06:00 UTC**; needs repo secret `DATABASE_URL`.

**Docker cron (self-hosted):**

```bash
docker compose --profile cron up -d fetcher-cron
```

---

## Launch checklist

- [ ] Postgres running with `DATABASE_URL` set on web
- [ ] Fetcher has populated `queue_projects` at least once
- [ ] `NEXT_PUBLIC_SITE_URL` matches your public URL
- [ ] `npm run lint` and `npm run build` pass in `web/`
