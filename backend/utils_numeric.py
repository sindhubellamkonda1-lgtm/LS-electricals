# utils_numeric.py

import pandas as pd

def num(x):
    """
    Safe float conversion.
    Returns 0.0 if conversion fails.
    """
    try:
        return float(x)
    except:
        return 0.0


def col(df, name):
    """
    Safe numeric dataframe column conversion.
    Used for plotting / calculations.
    """
    return pd.to_numeric(df[name], errors="coerce").fillna(0)
