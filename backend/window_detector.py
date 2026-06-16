# window_detector.py

import pandas as pd


def build_max_power_df(data, df):
    """
    Detect capacitor ON/OFF switching windows from JSON
    and find timestamp of maximum power in each window.
    """

    rows = []

    # ----------------------------
    # Extract switching intervals
    # ----------------------------
    for m in data.get("site_measurements") or []:
        for e in m.get("capacitor_switching_sequence") or []:
            rows.append({
                "start": str(e["from"]),
                "end": str(e["to"]),
                "status": str(e["status"]).upper()
            })

    # No switching events defined — return empty DataFrame so fallback kicks in
    if not rows:
        return pd.DataFrame(columns=["status", "time"])

    exe = pd.DataFrame(rows)

    # Use first date from dataframe
    base_date = df["datetime"].dt.date.iloc[0]

    exe["start_dt"] = pd.to_datetime(
        str(base_date) + " " + exe["start"],
        errors="coerce"
    )

    exe["end_dt"] = pd.to_datetime(
        str(base_date) + " " + exe["end"],
        errors="coerce"
    )

    # ----------------------------
    # Find max power in each status
    # ----------------------------
    out = []

    for status, group in exe.groupby("status"):

        mask = False

        for _, window in group.iterrows():

            mask = mask | (
                (df["datetime"] >= window["start_dt"]) &
                (df["datetime"] <= window["end_dt"])
            )

        subset = df[mask]

        if not subset.empty:

            watts = pd.to_numeric(
                subset["PΣ (W)"],
                errors="coerce"
            )

            row = subset.loc[watts.idxmax()]

            out.append({
                "status": status,
                "time": row["datetime"]
            })

    return pd.DataFrame(out)
