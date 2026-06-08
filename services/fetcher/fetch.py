#!/usr/bin/env python3
"""Fetch US ISO interconnection queues via gridstatus and upsert into Postgres."""

from __future__ import annotations

import io
import json
import os
import sys
import time
import traceback
from datetime import date
from typing import Any

import gridstatus
import pandas as pd
import psycopg2
import psycopg2.extras
import requests

INACTIVE_HINTS = (
    "withdraw",
    "cancel",
    "inactive",
    "terminated",
    "retired",
    "denied",
    "duplicate",
)

# gridstatus-supported interconnection queues (IESO not implemented yet)
MARKET_CONFIG: dict[str, dict[str, Any]] = {
    "ERCOT": {
        "cls": gridstatus.Ercot,
        "snapshot_id": "ercot-gen-queue",
        "category": "Generator interconnection queue",
        "source_label": "ERCOT GIS Report (EMIL pg7-200-er)",
        "source_url": "https://www.ercot.com/mp/data-products/data-product-details?id=pg7-200-er",
    },
    "MISO": {
        "cls": gridstatus.MISO,
        "snapshot_id": "miso-gi-queue",
        "category": "Generator interconnection queue",
        "source_label": "MISO GI interactive queue",
        "source_url": "https://www.misoenergy.org/planning/generator-interconnection/GI_Queue/gi-interactive-queue/",
    },
    "PJM": {
        "fetch": "pjm_public",
        "snapshot_id": "pjm-gi-queue",
        "category": "Generator interconnection queue",
        "source_label": "PJM interconnection queue",
        "source_url": "https://www.pjm.com/planning/service-requests",
    },
    "CAISO": {
        "cls": gridstatus.CAISO,
        "snapshot_id": "caiso-gen-queue",
        "category": "Generator interconnection queue",
        "source_label": "CAISO public queue report",
        "source_url": "https://www.caiso.com/library/public-queue-report",
    },
    "SPP": {
        "cls": gridstatus.SPP,
        "snapshot_id": "spp-gi-queue",
        "category": "Generator interconnection queue",
        "source_label": "SPP generation interconnection queue",
        "source_url": "https://opsportal.spp.org/Studies/GISummary",
    },
    "NYISO": {
        "fetch": "nyiso_public",
        "snapshot_id": "nyiso-gi-queue",
        "category": "Generator interconnection queue",
        "source_label": "NYISO interconnection queue",
        "source_url": "https://www.nyiso.com/interconnections",
    },
    "ISO-NE": {
        "cls": gridstatus.ISONE,
        "snapshot_id": "isone-gi-queue",
        "category": "Generator interconnection queue",
        "source_label": "ISO-NE interconnection queue",
        "source_url": "https://www.iso-ne.com/system-planning/interconnection-service/",
    },
}

DEFAULT_MARKETS = ",".join(MARKET_CONFIG.keys())

# Public subscription key from PJM's interconnection queue web app (not a member API key).
PJM_QUEUE_EXPORT_URL = "https://services.pjm.com/PJMPlanningApi/api/Queue/ExportToXls"
PJM_QUEUE_SUBSCRIPTION_KEY = os.environ.get("PJM_QUEUE_SUBSCRIPTION_KEY", "")

# NYISO serves this xlsx asynchronously — HTTP 202 until the file is ready.
NYISO_QUEUE_URL = (
    "https://www.nyiso.com/documents/20142/1407078/NYISO-Interconnection-Queue.xlsx"
)
NYISO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; interconnection-queue-tracker/1.0)",
    "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
}


def log(msg: str) -> None:
    print(msg, flush=True)


def is_active(status: Any) -> bool:
    if status is None or (isinstance(status, float) and pd.isna(status)):
        return True
    text = str(status).lower()
    return not any(hint in text for hint in INACTIVE_HINTS)


def mw_value(row: pd.Series) -> float:
    for col in (
        "Capacity (MW)",
        "Summer Capacity (MW)",
        "Winter Capacity (MW)",
        "MW Capacity",
        "mw",
        "Net MW",
    ):
        if col in row and pd.notna(row[col]):
            try:
                return float(row[col])
            except (TypeError, ValueError):
                pass
    return 0.0


def fuel_value(row: pd.Series) -> str:
    for col in ("Generation Type", "Fuel", "fuelType", "Technology"):
        if col in row and pd.notna(row[col]):
            return str(row[col]).strip()
    return "Other"


def status_value(row: pd.Series) -> str:
    for col in ("Status", "applicationStatus", "Project Status"):
        if col in row and pd.notna(row[col]):
            return str(row[col]).strip()
    return "Unknown"


def queue_id_value(row: pd.Series) -> str:
    for col in ("Queue ID", "Project Number", "projectNumber", "INR", "Queue Pos.", "QP"):
        if col in row and pd.notna(row[col]):
            return str(row[col]).strip()
    return ""


def project_name_value(row: pd.Series) -> str:
    for col in ("Project Name", "Name", "projectName", "Commercial Name"):
        if col in row and pd.notna(row[col]):
            return str(row[col]).strip()
    return ""


def pressure_score(queue_mw: float, request_count: int) -> int:
    mw_score = min(100.0, (queue_mw / 500_000) * 100)
    req_score = min(100.0, (request_count / 2_500) * 100)
    return int(round(0.65 * mw_score + 0.35 * req_score))


def aggregate_mix(active: pd.DataFrame) -> dict[str, int]:
    mix: dict[str, float] = {}
    for _, row in active.iterrows():
        fuel = fuel_value(row)
        mix[fuel] = mix.get(fuel, 0.0) + mw_value(row)
    return {k: int(round(v)) for k, v in sorted(mix.items(), key=lambda x: -x[1])}


def dataframe_to_projects(df: pd.DataFrame, market: str) -> list[dict[str, Any]]:
    projects: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        queue_id = queue_id_value(row)
        if not queue_id:
            continue
        projects.append(
            {
                "market": market,
                "queueId": queue_id,
                "projectName": project_name_value(row) or None,
                "mw": mw_value(row) or None,
                "fuel": fuel_value(row),
                "status": status_value(row),
                "queueDate": None,
                "county": str(row["County"]).strip() if "County" in row and pd.notna(row["County"]) else None,
                "state": str(row["State"]).strip() if "State" in row and pd.notna(row["State"]) else None,
            }
        )
    return projects


def build_snapshot(
    *,
    snapshot_id: str,
    market: str,
    category: str,
    active: pd.DataFrame,
    source_label: str,
    source_url: str,
) -> dict[str, Any]:
    queue_mw = int(round(sum(mw_value(row) for _, row in active.iterrows()))) if len(active) else 0
    request_count = len(active)
    mix = aggregate_mix(active)
    pressure = pressure_score(queue_mw, request_count)
    today = date.today().isoformat()

    top_fuels = sorted(mix.items(), key=lambda x: -x[1])[:3]
    mix_note = ", ".join(f"{name} {mw:,} MW" for name, mw in top_fuels) if top_fuels else "mixed"

    return {
        "id": snapshot_id,
        "market": market,
        "category": category,
        "headline": f"{request_count:,} active queue projects totaling {queue_mw:,} MW",
        "status": "Active",
        "pressure": pressure,
        "updated": today,
        "queueMw": queue_mw,
        "requestCount": request_count,
        "mix": mix,
        "metrics": [
            {"label": "Queue MW", "value": f"{queue_mw:,} MW"},
            {"label": "Projects", "value": f"{request_count:,}"},
            {"label": "Top fuels", "value": mix_note[:80]},
        ],
        "summary": (
            f"Live fetch from {market} public interconnection queue. "
            f"{request_count:,} active projects totaling {queue_mw:,} MW."
        ),
        "sourceLabel": source_label,
        "sourceUrl": source_url,
        "dataMode": "live",
    }


def fetch_pjm_public_queue() -> pd.DataFrame:
    """Fetch PJM queue via the public planning export (no member API key)."""
    if not PJM_QUEUE_SUBSCRIPTION_KEY:
        raise RuntimeError("PJM_QUEUE_SUBSCRIPTION_KEY env var is required for PJM fetch")
    response = requests.post(
        PJM_QUEUE_EXPORT_URL,
        headers={
            "api-subscription-key": PJM_QUEUE_SUBSCRIPTION_KEY,
            "Origin": "https://www.pjm.com",
            "Referer": "https://www.pjm.com/",
        },
        timeout=120,
    )
    response.raise_for_status()

    queue = pd.read_excel(io.BytesIO(response.content))
    queue["Capacity (MW)"] = queue[["MFO", "MW In Service"]].min(axis=1)
    queue = queue.rename(
        columns={
            "Project ID": "Queue ID",
            "Name": "Project Name",
            "Fuel": "Generation Type",
        }
    )
    return queue


def download_nyiso_xlsx(*, max_attempts: int = 12, initial_delay: int = 10) -> io.BytesIO:
    delay = initial_delay
    for attempt in range(1, max_attempts + 1):
        log(f"Downloading NYISO interconnection queue (attempt {attempt}/{max_attempts})...")
        response = requests.get(NYISO_QUEUE_URL, headers=NYISO_HEADERS, timeout=180)
        if response.status_code == 200 and len(response.content) > 5000:
            return io.BytesIO(response.content)
        if response.status_code in (202, 429, 503) and attempt < max_attempts:
            log(f"NYISO xlsx not ready (HTTP {response.status_code}), waiting {delay}s...")
            time.sleep(delay)
            delay = min(delay + 10, 60)
            continue
        if response.status_code == 200:
            raise RuntimeError(
                f"NYISO xlsx response too small ({len(response.content)} bytes)"
            )
        response.raise_for_status()
    raise RuntimeError(f"NYISO xlsx unavailable after {max_attempts} attempts")


def fetch_nyiso_public_queue() -> pd.DataFrame:
    raw = download_nyiso_xlsx()
    iso = gridstatus.NYISO()
    raw.seek(0)
    iso.get_raw_interconnection_queue = lambda: raw  # type: ignore[method-assign]
    return iso.get_interconnection_queue()


def fetch_market(config: dict[str, Any], market: str) -> pd.DataFrame:
    log(f"Fetching {market} interconnection queue...")
    fetcher = config.get("fetch")
    if fetcher == "pjm_public":
        df = fetch_pjm_public_queue()
    elif fetcher == "nyiso_public":
        df = fetch_nyiso_public_queue()
    elif callable(fetcher):
        df = fetcher()
    else:
        iso = config["cls"]()
        df = iso.get_interconnection_queue()
    if "Capacity (MW)" not in df.columns:
        df["Capacity (MW)"] = df.apply(mw_value, axis=1)
    return df


def connect_db():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is required")
    return psycopg2.connect(url)


def upsert_snapshot(conn, snapshot: dict[str, Any]) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO queue_market_snapshots (
              id, market, category, headline, status, pressure, updated,
              queue_mw, request_count, mix, metrics, summary,
              source_label, source_url, data_mode, fetched_at
            ) VALUES (
              %(id)s, %(market)s, %(category)s, %(headline)s, %(status)s, %(pressure)s, %(updated)s,
              %(queueMw)s, %(requestCount)s, %(mix)s::jsonb, %(metrics)s::jsonb, %(summary)s,
              %(sourceLabel)s, %(sourceUrl)s, %(dataMode)s, NOW()
            )
            ON CONFLICT (id) DO UPDATE SET
              market = EXCLUDED.market,
              category = EXCLUDED.category,
              headline = EXCLUDED.headline,
              status = EXCLUDED.status,
              pressure = EXCLUDED.pressure,
              updated = EXCLUDED.updated,
              queue_mw = EXCLUDED.queue_mw,
              request_count = EXCLUDED.request_count,
              mix = EXCLUDED.mix,
              metrics = EXCLUDED.metrics,
              summary = EXCLUDED.summary,
              source_label = EXCLUDED.source_label,
              source_url = EXCLUDED.source_url,
              data_mode = EXCLUDED.data_mode,
              fetched_at = NOW()
            """,
            {
                "id": snapshot["id"],
                "market": snapshot["market"],
                "category": snapshot["category"],
                "headline": snapshot["headline"],
                "status": snapshot["status"],
                "pressure": snapshot["pressure"],
                "updated": snapshot["updated"],
                "queueMw": snapshot["queueMw"],
                "requestCount": snapshot["requestCount"],
                "mix": json.dumps(snapshot.get("mix") or {}),
                "metrics": json.dumps(snapshot.get("metrics") or []),
                "summary": snapshot["summary"],
                "sourceLabel": snapshot["sourceLabel"],
                "sourceUrl": snapshot["sourceUrl"],
                "dataMode": snapshot["dataMode"],
            },
        )


def dedupe_projects(projects: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """ISO feeds occasionally repeat queue IDs; keep the row with highest MW."""
    best: dict[str, dict[str, Any]] = {}
    for project in projects:
        queue_id = project["queueId"]
        prev = best.get(queue_id)
        if not prev or (project.get("mw") or 0) >= (prev.get("mw") or 0):
            best[queue_id] = project
    return list(best.values())


def replace_projects(conn, market: str, projects: list[dict[str, Any]]) -> None:
    projects = dedupe_projects(projects)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM queue_projects WHERE market = %s", (market,))
        if not projects:
            return
        psycopg2.extras.execute_batch(
            cur,
            """
            INSERT INTO queue_projects (
              market, queue_id, project_name, mw, fuel, status,
              queue_date, county, state, fetched_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            """,
            [
                (
                    market,
                    p["queueId"],
                    p.get("projectName"),
                    p.get("mw"),
                    p.get("fuel"),
                    p.get("status"),
                    p.get("queueDate"),
                    p.get("county"),
                    p.get("state"),
                )
                for p in projects
            ],
        )


def process_market(conn, market: str, config: dict[str, Any]) -> None:
    df = fetch_market(config, market)
    active = df[df.apply(lambda row: is_active(status_value(row)), axis=1)].copy()
    active = active[active.apply(lambda row: mw_value(row) > 0, axis=1)]

    projects = dataframe_to_projects(active, market)
    snapshot = build_snapshot(
        snapshot_id=config["snapshot_id"],
        market=market,
        category=config["category"],
        active=active,
        source_label=config["source_label"],
        source_url=config["source_url"],
    )

    replace_projects(conn, market, projects)
    upsert_snapshot(conn, snapshot)
    log(f"{market}: {snapshot['requestCount']} projects, {snapshot['queueMw']:,} MW")


def ensure_schema(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS queue_projects (
              market TEXT NOT NULL,
              queue_id TEXT NOT NULL,
              project_name TEXT,
              mw NUMERIC,
              fuel TEXT,
              status TEXT,
              queue_date DATE,
              county TEXT,
              state TEXT,
              fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
              PRIMARY KEY (market, queue_id)
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS queue_market_snapshots (
              id TEXT PRIMARY KEY,
              market TEXT NOT NULL,
              category TEXT NOT NULL,
              headline TEXT,
              status TEXT,
              pressure INTEGER NOT NULL DEFAULT 0,
              updated DATE,
              queue_mw NUMERIC,
              request_count INTEGER,
              mix JSONB,
              metrics JSONB,
              summary TEXT,
              source_label TEXT,
              source_url TEXT,
              data_mode TEXT NOT NULL DEFAULT 'curated',
              fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
    conn.commit()


def main() -> int:
    requested = os.environ.get("FETCH_MARKETS", DEFAULT_MARKETS).split(",")
    markets = [m.strip().upper() for m in requested if m.strip()]

    try:
        conn = connect_db()
        ensure_schema(conn)
    except Exception as exc:
        log(f"Database connection failed: {exc}")
        return 1

    ok = 0
    failed = 0

    try:
        conn.autocommit = False
        for market in markets:
            config = MARKET_CONFIG.get(market)
            if not config:
                log(f"Skipping unknown market: {market} (supported: {', '.join(MARKET_CONFIG)})")
                continue
            try:
                process_market(conn, market, config)
                conn.commit()
                ok += 1
            except Exception as exc:
                conn.rollback()
                failed += 1
                log(f"{market} FAILED: {exc}")
                traceback.print_exc()

        log(f"Fetch complete: {ok} succeeded, {failed} failed.")
        return 0 if failed == 0 else (0 if ok > 0 else 1)
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
