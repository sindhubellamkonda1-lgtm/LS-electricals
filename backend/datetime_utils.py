# datetime_utils.py

import pandas as pd


def normalize_excel_datetime(df):
    """
    Normalize Excel Date + Time columns into a proper datetime column.

    Handles:
    - Excel numeric time values
    - String time values
    - Mixed formats
    """

    df = df.copy()

    # Convert Date column
    df["Date"] = pd.to_datetime(
        df["Date"],
        errors="coerce",
        dayfirst=True
    )

    # Convert Time column (Excel numeric OR string)
    if pd.api.types.is_numeric_dtype(df["Time"]):
        df["Time"] = pd.to_datetime(
            df["Time"],
            unit="d",
            origin="1899-12-30",
            errors="coerce"
        )
    else:
        df["Time"] = pd.to_datetime(
            df["Time"],
            errors="coerce"
        )

    # Combine Date + Time
    df["datetime"] = pd.to_datetime(
        df["Date"].dt.strftime("%Y-%m-%d") + " " +
        df["Time"].dt.strftime("%H:%M:%S"),
        errors="coerce"
    )

    # Remove invalid rows
    df = df.dropna(subset=["datetime"])

    # Store cleaned time back
    df["Time"] = df["datetime"].dt.strftime("%H:%M:%S")

    return df
