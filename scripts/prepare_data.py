#!/usr/bin/env python3
"""Create Tableau-ready maintenance risk datasets from the sensor extract."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd

SENSORS = {
    "Temperature (F)": ("Temperature Risk", 0.30, 1),
    "Vibration Delta": ("Vibration Risk", 0.30, 1),
    "Oil Level": ("Oil Risk", 0.25, -1),
    "Noise (Db)": ("Noise Risk", 0.15, 1),
}
CAUSES = {
    "Temperature Risk": "High Temperature",
    "Vibration Risk": "High Vibration",
    "Oil Risk": "Low Oil Level",
    "Noise Risk": "High Noise",
}
ACTIONS = {
    "High Temperature": "Inspect cooling system; Check lubrication; Create maintenance work order",
    "High Vibration": "Inspect bearing and alignment; Reduce machine load; Schedule vibration inspection",
    "Low Oil Level": "Check oil leakage; Refill lubrication oil; Inspect lubrication system",
    "High Noise": "Inspect loose components; Check bearing wear; Notify maintenance",
}
REQUIRED = [
    "Line", "Machine ID", "Reading ID", "Reading Timestamp", "Noise (Db)",
    "Oil Level", "Temperature (F)", "Unplanned Maintenance Breakdown",
    "Vibration Delta",
]


def robust_zscore(values: pd.Series) -> pd.Series:
    """Return robust z-scores using median/IQR, with standard deviation fallback."""
    median = values.median()
    iqr = values.quantile(0.75) - values.quantile(0.25)
    scale = iqr / 1.349
    if not np.isfinite(scale) or scale < 1e-9:
        scale = values.std(ddof=0)
    if not np.isfinite(scale) or scale < 1e-9:
        scale = 1.0
    return (values - median) / scale


def status_from_component(component: pd.Series) -> pd.Series:
    return pd.cut(
        component,
        bins=[-np.inf, 35, 65, np.inf],
        labels=["Normal", "Warning", "High"],
        right=False,
    ).astype(str)


def prepare(input_path: Path, output_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    df = pd.read_csv(input_path, encoding="utf-16", sep="\t")
    df.columns = df.columns.str.strip()
    missing = [column for column in REQUIRED if column not in df.columns]
    if missing:
        raise ValueError(f"Required columns missing: {', '.join(missing)}")

    df["Reading Timestamp"] = pd.to_datetime(df["Reading Timestamp"], errors="coerce")
    df["Machine ID"] = df["Machine ID"].astype("string").str.strip()
    numeric_columns = list(SENSORS) + ["Unplanned Maintenance Breakdown"]
    for column in numeric_columns:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    invalid_keys = df["Machine ID"].isna() | df["Reading Timestamp"].isna()
    if invalid_keys.any():
        print(f"Warning: dropping {invalid_keys.sum()} rows with invalid machine/timestamp.", file=sys.stderr)
        df = df.loc[~invalid_keys].copy()
    if df.empty:
        raise ValueError("No valid rows remain after parsing Machine ID and Reading Timestamp.")

    for column in numeric_columns:
        df[column] = df.groupby("Machine ID")[column].transform(
            lambda values: values.fillna(values.median())
        )
        fallback = 0 if column == "Unplanned Maintenance Breakdown" else df[column].median()
        df[column] = df[column].fillna(fallback)
    df["Unplanned Maintenance Breakdown"] = (
        df["Unplanned Maintenance Breakdown"].clip(0, 1).round().astype(int)
    )
    df = df.sort_values(["Machine ID", "Reading Timestamp", "Reading ID"])

    component_columns: list[str] = []
    for sensor, (component, _, direction) in SENSORS.items():
        zscore = df.groupby("Machine ID")[sensor].transform(robust_zscore) * direction
        # z=0 -> 0 risk, z>=3 -> 100. Only adverse-direction deviations contribute.
        df[component] = (zscore.clip(lower=0, upper=3) / 3 * 100).round(2)
        component_columns.append(component)

    df["Risk Score"] = sum(
        df[component] * weight
        for component, weight, _ in SENSORS.values()
    ).clip(0, 100)
    df.loc[df["Unplanned Maintenance Breakdown"].eq(1), "Risk Score"] = (
        df.loc[df["Unplanned Maintenance Breakdown"].eq(1), "Risk Score"].clip(lower=85)
    )
    df["Risk Score"] = df["Risk Score"].round(1)
    df["Risk Level"] = np.select(
        [df["Risk Score"].ge(80), df["Risk Score"].ge(60)],
        ["Critical", "Warning"],
        default="Normal",
    )
    df["Primary Cause"] = df[component_columns].idxmax(axis=1).map(CAUSES)
    # Normal rows should not imply that maintenance is required merely because
    # one component is the largest of four small deviations.
    df.loc[df["Risk Score"].lt(60), "Primary Cause"] = "No Significant Anomaly"
    df["Recommended Action"] = df["Primary Cause"].map(ACTIONS).fillna("Continue monitoring")
    df["Latest Breakdown Status"] = np.where(
        df["Unplanned Maintenance Breakdown"].eq(1), "Breakdown", "No Breakdown"
    )
    df["Temperature Status"] = status_from_component(df["Temperature Risk"])
    df["Noise Status"] = status_from_component(df["Noise Risk"])
    df["Oil Status"] = status_from_component(df["Oil Risk"])
    df["Vibration Status"] = status_from_component(df["Vibration Risk"])

    latest = df.groupby("Machine ID", as_index=False).tail(1).copy()
    latest_columns = [
        "Machine ID", "Line", "Reading Timestamp", "Noise (Db)", "Oil Level",
        "Temperature (F)", "Vibration Delta", "Unplanned Maintenance Breakdown",
        "Risk Score", "Risk Level", "Primary Cause", "Recommended Action",
        "Latest Breakdown Status", "Temperature Status", "Noise Status",
        "Oil Status", "Vibration Status",
    ]
    latest = latest[latest_columns].sort_values("Machine ID")

    summary = df.groupby("Machine ID", as_index=False).agg(
        **{
            "Reading Count": ("Reading ID", "count"),
            "Breakdown Count": ("Unplanned Maintenance Breakdown", "sum"),
            "Breakdown Rate": ("Unplanned Maintenance Breakdown", "mean"),
            "Avg Noise": ("Noise (Db)", "mean"),
            "Avg Oil Level": ("Oil Level", "mean"),
            "Avg Temperature": ("Temperature (F)", "mean"),
            "Avg Vibration": ("Vibration Delta", "mean"),
        }
    )
    summary = summary.merge(
        latest[["Machine ID", "Risk Score", "Risk Level"]].rename(
            columns={"Risk Score": "Latest Risk Score", "Risk Level": "Latest Risk Level"}
        ),
        on="Machine ID",
        how="left",
    )
    summary["Breakdown Rate"] = summary["Breakdown Rate"].round(4)
    for column in ["Avg Noise", "Avg Oil Level", "Avg Temperature", "Avg Vibration"]:
        summary[column] = summary[column].round(3)

    output_dir.mkdir(parents=True, exist_ok=True)
    latest.to_csv(output_dir / "machine_latest_status.csv", index=False)
    summary.to_csv(output_dir / "machine_summary.csv", index=False)
    return latest, summary


def main() -> int:
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        default=project_root / "data" / "VW_MACHINE_DATA(1).csv",
    )
    parser.add_argument("--output-dir", type=Path, default=project_root / "data")
    args = parser.parse_args()
    if not args.input.exists():
        print(
            f"Input file not found: {args.input}\n"
            "Place VW_MACHINE_DATA(1).csv in data/ or pass --input /path/to/file.",
            file=sys.stderr,
        )
        return 2
    try:
        latest, summary = prepare(args.input, args.output_dir)
    except (OSError, UnicodeError, pd.errors.ParserError, ValueError) as exc:
        print(f"Data preparation failed: {exc}", file=sys.stderr)
        return 1
    print(f"Created {args.output_dir / 'machine_latest_status.csv'} ({len(latest)} machines)")
    print(f"Created {args.output_dir / 'machine_summary.csv'} ({len(summary)} machines)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
