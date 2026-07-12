"""Compute empirical ERCOT interconnection timelines from ercot_gis_snapshots.

For each project that has ever reached Approved for Energization, take its
most complete known milestone dates (max across all snapshots, since these
fields only get filled in over time, never retracted) and compute:
  - Screening Study Started -> Energization (full process duration)
  - IA Signed -> Energization (post-agreement build duration)
  - Projected COD slippage: first-seen Projected COD vs actual Energization date

Grouped by zone and by fuel type.
"""
import os

import pandas as pd
import psycopg2

NA = {"NaN", "nan", "None", ""}


def parse_date(s):
    if s is None or str(s).strip() in NA:
        return pd.NaT
    return pd.to_datetime(s, errors="coerce")


def main():
    conn = psycopg2.connect(os.environ["DATABASE_URL"], connect_timeout=10)
    df = pd.read_sql("SELECT * FROM ercot_gis_snapshots", conn)
    conn.close()

    for col in ["screening_study_started", "screening_study_complete", "ia_signed",
                "approved_for_energization", "approved_for_synchronization", "projected_cod"]:
        df[col] = df[col].apply(parse_date)

    # first-seen projected COD (earliest snapshot's value, as originally filed)
    df_sorted = df.sort_values("snapshot_month")
    first_seen_cod = df_sorted.groupby("queue_id")["projected_cod"].first()

    # final known milestone dates: max non-null value per project across all snapshots
    agg = df.groupby("queue_id").agg({
        "zone": "last",
        "fuel": "last",
        "capacity_mw": "last",
        "project_name": "last",
        "screening_study_started": "max",
        "ia_signed": "max",
        "approved_for_energization": "max",
    })
    agg["first_seen_projected_cod"] = first_seen_cod

    energized = agg[agg["approved_for_energization"].notna()].copy()
    print(f"Projects ever reaching Approved for Energization: {len(energized)}")

    energized["full_process_days"] = (
        energized["approved_for_energization"] - energized["screening_study_started"]
    ).dt.days
    energized["build_phase_days"] = (
        energized["approved_for_energization"] - energized["ia_signed"]
    ).dt.days
    energized["cod_slip_days"] = (
        energized["approved_for_energization"] - energized["first_seen_projected_cod"]
    ).dt.days

    # sanity filter: drop negative/absurd durations (data errors, re-filed queue IDs)
    def clean(s, lo=0, hi=6000):
        return s[(s >= lo) & (s <= hi)]

    print("\n=== Full process: Screening Study Started -> Approved for Energization, by zone ===")
    fp = energized.assign(full_process_days=clean(energized["full_process_days"]))
    stats = fp.groupby("zone")["full_process_days"].agg(["count", "median", "mean"]).round(0)
    stats["median_years"] = (stats["median"] / 365).round(1)
    stats["mean_years"] = (stats["mean"] / 365).round(1)
    print(stats.sort_values("median"))

    print("\n=== Full process, by fuel type ===")
    stats_fuel = fp.groupby("fuel")["full_process_days"].agg(["count", "median", "mean"]).round(0)
    stats_fuel["median_years"] = (stats_fuel["median"] / 365).round(1)
    print(stats_fuel[stats_fuel["count"] >= 10].sort_values("median"))

    print("\n=== Build phase: IA Signed -> Approved for Energization, by zone ===")
    bp = energized.assign(build_phase_days=clean(energized["build_phase_days"]))
    stats_bp = bp.groupby("zone")["build_phase_days"].agg(["count", "median", "mean"]).round(0)
    stats_bp["median_years"] = (stats_bp["median"] / 365).round(1)
    print(stats_bp.sort_values("median"))

    print("\n=== Projected COD slippage: actual Energization vs originally filed Projected COD, by zone ===")
    slip = energized.assign(cod_slip_days=clean(energized["cod_slip_days"], lo=-2000, hi=6000))
    stats_slip = slip.groupby("zone")["cod_slip_days"].agg(["count", "median", "mean"]).round(0)
    stats_slip["median_years_late"] = (stats_slip["median"] / 365).round(1)
    print(stats_slip.sort_values("median"))

    print("\n=== Currently in-queue projects (never energized), by zone, with elapsed time since screening ===")
    pending = agg[agg["approved_for_energization"].isna()].copy()
    pending = pending[pending["screening_study_started"].notna()]
    now = pd.Timestamp("2026-06-01")
    pending["years_in_queue"] = ((now - pending["screening_study_started"]).dt.days / 365).round(1)
    pending_clean = pending[(pending["years_in_queue"] >= 0) & (pending["years_in_queue"] <= 20)]
    stats_pending = pending_clean.groupby("zone")["years_in_queue"].agg(["count", "median", "mean"]).round(1)
    print(stats_pending.sort_values("median", ascending=False))
    print(f"\nTotal currently-pending projects with screening start date: {len(pending_clean)}")
    total_pending_mw = pending_clean["capacity_mw"].sum()
    print(f"Total pending capacity (MW): {total_pending_mw:,.0f}")


if __name__ == "__main__":
    main()
