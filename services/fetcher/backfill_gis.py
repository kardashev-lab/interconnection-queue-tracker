"""Backfill historical ERCOT GIS Report snapshots (reportTypeId 15933).

Unlike fetch_ercot_direct() (which only keeps the latest monthly filing for
the live queue_projects table), this pulls every available monthly GIS_Report
document and stores each one as a dated snapshot, so a project's timeline
(Projected COD, milestone dates) can be tracked across months instead of only
seeing its current state. That history is what makes a real "how long did
interconnection actually take, by zone" statistic possible instead of citing
a national average.

Usage: python backfill_gis.py          (needs DATABASE_URL in env)
       python backfill_gis.py --dry-run
"""
from __future__ import annotations

import argparse
import io
import os
import sys
import time

import pandas as pd
import psycopg2
import requests
from psycopg2.extras import execute_values

REPORT_TYPE_ID = 15933

# ERCOT renamed this sheet at some point ("Project Details" -> "Project
# Details - Large Gen") and the header row position drifts month to month
# (variable-length disclaimer/footnote text above it shifts everything down).
# So: try each known sheet name, but locate the header row dynamically by
# scanning for the row whose first cell is literally "INR", rather than
# assuming a fixed skiprows offset.
SHEET_NAMES = ["Project Details - Large Gen", "Project Details"]

COLUMN_ALIASES = {
    "GINR Study Phase": "GIM Study Phase",
}


def find_header_row(raw: pd.DataFrame, max_scan: int = 60) -> int | None:
    for i in range(min(max_scan, len(raw))):
        if str(raw.iat[i, 0]).strip() == "INR":
            return i
    return None

SCHEMA = """
CREATE TABLE IF NOT EXISTS ercot_gis_snapshots (
  queue_id TEXT NOT NULL,
  snapshot_month TEXT NOT NULL,
  project_name TEXT,
  gim_study_phase TEXT,
  county TEXT,
  zone TEXT,
  projected_cod TEXT,
  fuel TEXT,
  technology TEXT,
  capacity_mw NUMERIC,
  screening_study_started TEXT,
  screening_study_complete TEXT,
  ia_signed TEXT,
  construction_start TEXT,
  construction_end TEXT,
  approved_for_energization TEXT,
  approved_for_synchronization TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (queue_id, snapshot_month)
);
"""

COLS = [
    "queue_id", "snapshot_month", "project_name", "gim_study_phase", "county",
    "zone", "projected_cod", "fuel", "technology", "capacity_mw",
    "screening_study_started", "screening_study_complete", "ia_signed",
    "construction_start", "construction_end", "approved_for_energization",
    "approved_for_synchronization",
]


def list_gis_docs() -> list[dict]:
    listing = requests.get(
        "https://www.ercot.com/misapp/servlets/IceDocListJsonWS",
        params={"reportTypeId": REPORT_TYPE_ID}, timeout=60,
    )
    listing.raise_for_status()
    docs = listing.json()["ListDocsByRptTypeRes"]["DocumentList"]
    return [d["Document"] for d in docs
            if str(d["Document"].get("FriendlyName", "")).startswith("GIS_Report")]


def snapshot_month_from_name(name: str) -> str:
    # "GIS_Report_April_2020" / "GIS_Report_Jun2026" -> "2020-04" / "2026-06"
    import re
    from datetime import datetime
    m = re.search(r"GIS_Report_?([A-Za-z]+)_?(\d{4})", name)
    if not m:
        return name
    month_str, year = m.group(1), int(m.group(2))
    try:
        month = datetime.strptime(month_str[:3], "%b").month
    except ValueError:
        return name
    return f"{year:04d}-{month:02d}"


def download_and_parse(doc: dict) -> pd.DataFrame | None:
    resp = requests.get(
        "https://www.ercot.com/misdownload/servlets/mirDownload",
        params={"doclookupId": doc["DocID"]}, timeout=180,
    )
    resp.raise_for_status()
    content = resp.content

    for sheet in SHEET_NAMES:
        try:
            raw = pd.read_excel(io.BytesIO(content), sheet_name=sheet, header=None)
        except Exception:
            continue
        header_row = find_header_row(raw)
        if header_row is None:
            continue
        header = raw.iloc[header_row].tolist()
        data = raw.iloc[header_row + 1:].reset_index(drop=True)
        data.columns = header
        data = data.rename(columns=COLUMN_ALIASES)
        # blank separator row(s) between header and real data, then rows with
        # no queue ID at all (end of table / footnotes) — drop both
        data = data.dropna(subset=["INR"]) if "INR" in data.columns else data
        if "INR" in data.columns and len(data) > 0:
            return data

    print(f"  SKIP {doc['FriendlyName']}: no header row found", file=sys.stderr)
    return None


def to_rows(df: pd.DataFrame, snapshot_month: str) -> list[tuple]:
    def s(col):
        return df[col].astype(str).where(df[col].notna(), None) if col in df.columns else None

    out = []
    for _, r in df.iterrows():
        qid = r.get("INR")
        if pd.isna(qid) or str(qid).strip() == "":
            continue
        mw = r.get("Capacity (MW)")
        try:
            mw = float(mw) if pd.notna(mw) else None
        except (TypeError, ValueError):
            mw = None
        out.append((
            str(qid).strip(), snapshot_month,
            r.get("Project Name"), r.get("GIM Study Phase"), r.get("County"),
            r.get("CDR Reporting Zone"), r.get("Projected COD"), r.get("Fuel"),
            r.get("Technology"), mw,
            r.get("Screening Study Started"), r.get("Screening Study Complete"),
            r.get("IA Signed"), r.get("Construction Start"), r.get("Construction End"),
            r.get("Approved for Energization"), r.get("Approved for Synchronization"),
        ))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=None, help="only process N docs (testing)")
    args = ap.parse_args()

    docs = list_gis_docs()
    docs = sorted(docs, key=lambda d: d["PublishDate"])
    if args.limit:
        docs = docs[:args.limit]
    print(f"{len(docs)} GIS_Report documents to process")

    conn = None if args.dry_run else psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=10)
    if conn is not None:
        with conn, conn.cursor() as cur:
            cur.execute(SCHEMA)

    total_rows = 0
    for i, doc in enumerate(docs):
        name = doc["FriendlyName"]
        month = snapshot_month_from_name(name)
        print(f"[{i+1}/{len(docs)}] {name} -> {month}")
        df = download_and_parse(doc)
        if df is None:
            continue
        rows = to_rows(df, month)
        print(f"  {len(rows)} projects")
        total_rows += len(rows)
        if conn is not None and rows:
            with conn, conn.cursor() as cur:
                execute_values(cur, f"""
                    INSERT INTO ercot_gis_snapshots ({', '.join(COLS)})
                    VALUES %s
                    ON CONFLICT (queue_id, snapshot_month) DO NOTHING
                """, rows)
        time.sleep(1)  # be polite to ERCOT's servers

    print(f"done. {total_rows} total project-month rows{' (dry run, not written)' if args.dry_run else ''}")
    if conn is not None:
        conn.close()


if __name__ == "__main__":
    main()
