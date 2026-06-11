"""Unit tests for the pure parsing/normalization logic in fetch.py.

Run from services/fetcher: pytest
"""
from __future__ import annotations

import pandas as pd
import pytest

from fetch import (
    MARKET_CONFIG,
    aggregate_mix,
    build_snapshot,
    dataframe_to_projects,
    dedupe_projects,
    fuel_value,
    is_active,
    mw_value,
    pressure_score,
    queue_id_value,
    status_value,
)


# ── is_active ─────────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "status,expected",
    [
        ("Active", True),
        ("In Progress", True),
        ("Withdrawn", False),
        ("WITHDRAWN", False),
        ("Cancelled", False),
        ("Inactive", False),
        ("Terminated", False),
        ("Retired", False),
        ("Denied", False),
        ("Duplicate request", False),
        (None, True),  # missing status treated as active
        (float("nan"), True),
    ],
)
def test_is_active(status, expected):
    assert is_active(status) is expected


# ── mw_value ──────────────────────────────────────────────────────────

def test_mw_value_prefers_capacity_column():
    row = pd.Series({"Capacity (MW)": 150.5, "Summer Capacity (MW)": 99.0})
    assert mw_value(row) == 150.5


def test_mw_value_falls_back_through_columns():
    row = pd.Series({"Winter Capacity (MW)": 42.0})
    assert mw_value(row) == 42.0


def test_mw_value_skips_unparseable_and_returns_zero():
    row = pd.Series({"Capacity (MW)": "not-a-number"})
    assert mw_value(row) == 0.0


def test_mw_value_missing_columns():
    row = pd.Series({"Other": 1})
    assert mw_value(row) == 0.0


def test_mw_value_skips_nan():
    row = pd.Series({"Capacity (MW)": float("nan"), "MW Capacity": 75.0})
    assert mw_value(row) == 75.0


# ── field extractors ─────────────────────────────────────────────────

def test_fuel_value_priority_and_default():
    assert fuel_value(pd.Series({"Generation Type": "Solar"})) == "Solar"
    assert fuel_value(pd.Series({"Fuel": " Wind "})) == "Wind"
    assert fuel_value(pd.Series({"unrelated": 1})) == "Other"


def test_status_value_default():
    assert status_value(pd.Series({"Status": "Active"})) == "Active"
    assert status_value(pd.Series({})) == "Unknown"


def test_queue_id_value():
    assert queue_id_value(pd.Series({"Queue ID": " Q-123 "})) == "Q-123"
    assert queue_id_value(pd.Series({"Project Number": "P9"})) == "P9"
    assert queue_id_value(pd.Series({})) == ""


# ── pressure_score ────────────────────────────────────────────────────

def test_pressure_score_zero():
    assert pressure_score(0, 0) == 0


def test_pressure_score_caps_at_100():
    assert pressure_score(10_000_000, 100_000) == 100


def test_pressure_score_weighting():
    # mw_score = 50, req_score = 0 → 0.65 * 50 = 32.5 → 32 (banker's rounding)
    assert pressure_score(250_000, 0) == 32


# ── dedupe_projects ───────────────────────────────────────────────────

def test_dedupe_keeps_highest_mw():
    projects = [
        {"queueId": "A", "mw": 10},
        {"queueId": "A", "mw": 50},
        {"queueId": "B", "mw": 5},
    ]
    result = {p["queueId"]: p["mw"] for p in dedupe_projects(projects)}
    assert result == {"A": 50, "B": 5}


def test_dedupe_handles_none_mw():
    projects = [
        {"queueId": "A", "mw": None},
        {"queueId": "A", "mw": 20},
    ]
    result = dedupe_projects(projects)
    assert len(result) == 1
    assert result[0]["mw"] == 20


# ── aggregate_mix / dataframe_to_projects ─────────────────────────────

def _sample_df() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {"Queue ID": "Q1", "Capacity (MW)": 100.0, "Generation Type": "Solar", "Status": "Active"},
            {"Queue ID": "Q2", "Capacity (MW)": 200.0, "Generation Type": "Wind", "Status": "Active"},
            {"Queue ID": "Q3", "Capacity (MW)": 50.0, "Generation Type": "Solar", "Status": "Active"},
            {"Queue ID": "", "Capacity (MW)": 999.0, "Generation Type": "Gas", "Status": "Active"},
        ]
    )


def test_aggregate_mix_sums_and_sorts():
    mix = aggregate_mix(_sample_df())
    assert mix["Wind"] == 200
    assert mix["Solar"] == 150
    assert mix["Gas"] == 999
    assert list(mix) == ["Gas", "Wind", "Solar"]  # sorted descending by MW


def test_dataframe_to_projects_skips_missing_queue_id():
    projects = dataframe_to_projects(_sample_df(), "TEST")
    assert [p["queueId"] for p in projects] == ["Q1", "Q2", "Q3"]
    assert all(p["market"] == "TEST" for p in projects)
    assert projects[0]["fuel"] == "Solar"


# ── build_snapshot ────────────────────────────────────────────────────

def test_build_snapshot_totals():
    snapshot = build_snapshot(
        snapshot_id="test-queue",
        market="TEST",
        category="Generator interconnection queue",
        active=_sample_df(),
        source_label="Test source",
        source_url="https://example.com",
    )
    assert snapshot["id"] == "test-queue"
    assert snapshot["queueMw"] == 1349  # 100 + 200 + 50 + 999
    assert snapshot["requestCount"] == 4
    assert snapshot["dataMode"] == "live"
    assert "4 active queue projects" in snapshot["headline"]


def test_build_snapshot_empty_frame():
    snapshot = build_snapshot(
        snapshot_id="empty",
        market="TEST",
        category="Generator interconnection queue",
        active=pd.DataFrame(),
        source_label="Test",
        source_url="https://example.com",
    )
    assert snapshot["queueMw"] == 0
    assert snapshot["requestCount"] == 0


# ── config sanity ─────────────────────────────────────────────────────

def test_market_config_complete():
    for market, config in MARKET_CONFIG.items():
        assert "snapshot_id" in config, market
        assert "source_label" in config, market
        assert "source_url" in config, market
        assert "cls" in config or "fetch" in config, market
