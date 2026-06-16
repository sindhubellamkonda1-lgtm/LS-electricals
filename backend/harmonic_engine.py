# harmonic_engine.py

from utils_numeric import num



def Harmonic_Analysis(df, feeder, time_val, type_val):
    """
    Extract harmonic summary metrics for a specific timestamp.
    """

    row = df[df["Time"] == time_val]

    if row.empty:
        return None

    row = row.iloc[0]

    return {
        "Feeder_Name": feeder,
        "Type": type_val,

        "Max_A": round(max(
            num(row["A1ʀᴍꜱ"]),
            num(row["A2ʀᴍꜱ"]),
            num(row["A3ʀᴍꜱ"])
        ), 2),

        "Max_U_RMS": round(max(
            num(row["U12ʀᴍꜱ"]),
            num(row["U23ʀᴍꜱ"]),
            num(row["U31ʀᴍꜱ"])
        ), 2),

        "Max_A_THD": round(max(
            num(row["A1ᴛʜᴅf"]),
            num(row["A2ᴛʜᴅf"]),
            num(row["A3ᴛʜᴅf"])
        ), 2),

        "Max_U_THD": round(max(
            num(row["U12ᴛʜᴅf"]),
            num(row["U23ᴛʜᴅf"]),
            num(row["U31ᴛʜᴅf"])
        ), 2),

        "KW": round(num(row["PΣ (W)"]) / 1000, 2),
        "KVAR": round(num(row["QΣf (var)"]) / 1000, 2),
        "KVA": round(num(row["SΣ (VA)"]) / 1000, 2),

        "PF": round(num(row["PFΣ"]), 2),
        "DPF": round(num(row["PFΣf(cos)"]), 2),
    }


def extract_harmonic_max(df, feeder, time_val, type_val):
    """
    Extract individual harmonic spectrum (H1-H13 max across phases).
    """

    row = df[df["Time"] == time_val]

    if row.empty:
        return None

    row = row.iloc[0]

    res = {
        "Feeder Name": feeder,
        "APFC ON/OFF": type_val
    }

    for i in range(1, 14):

        h = f"H{str(i).zfill(3)}"

        res[f"I{i}"] = round(max(
            num(row.get(f"L1 {h}", 0)),
            num(row.get(f"L2 {h}", 0)),
            num(row.get(f"L3 {h}", 0))
        ), 2)

    return res
