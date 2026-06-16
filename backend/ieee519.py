# ieee519.py
#
# IEEE 519 harmonic limit lookup tables.
# Pure functions — no openpyxl dependency.
# Used by transformer_engine.py and all excel_writer modules.


# ── Current harmonics: TDD limits by Isc/IL ──────────────────────────────────
#   (IEEE 519-2014 Table 2)
#
#   Isc/IL   TDD (%)
#   < 20     5
#   20–50    8
#   50–100   12
#   100–1000 15
#   ≥ 1000   20

def tdd_limit(isc_il: float) -> float:
    """Return the TDD % limit from the Isc/IL ratio (IEEE 519 Table 2)."""
    try:
        r = float(isc_il)
    except (TypeError, ValueError):
        return 8.0   # safe fallback
    if r < 20:
        return 5.0
    if r < 50:
        return 8.0
    if r < 100:
        return 12.0
    if r < 1000:
        return 15.0
    return 20.0


# ── Current harmonics: individual order limits by Isc/IL ─────────────────────
#   (IEEE 519-2014 Table 2)
#
#   Isc/IL    h<11  11≤h<17  17≤h<23  23≤h<35  h≥35
#   < 20       4.0    2.0      1.5      0.6      0.3
#   20–50      7.0    3.5      2.5      1.0      0.5
#   50–100    10.0    4.5      4.0      1.5      0.7
#   100–1000  12.0    5.5      5.0      2.0      1.0
#   ≥ 1000    15.0    7.0      6.0      2.5      1.4

_INDIVIDUAL_LIMITS = [
    # (isc_il_max,  h<11, 11–16, 17–22, 23–34, ≥35)
    (20,   4.0, 2.0, 1.5, 0.6, 0.3),
    (50,   7.0, 3.5, 2.5, 1.0, 0.5),
    (100, 10.0, 4.5, 4.0, 1.5, 0.7),
    (1000,12.0, 5.5, 5.0, 2.0, 1.0),
    (float("inf"), 15.0, 7.0, 6.0, 2.5, 1.4),
]


def individual_current_limit(isc_il: float, harmonic_order: int) -> float:
    """
    Return the individual current harmonic limit (% of IL) for a given
    harmonic order and Isc/IL ratio (IEEE 519 Table 2).
    """
    try:
        r = float(isc_il)
        h = int(harmonic_order)
    except (TypeError, ValueError):
        return 5.0   # safe fallback

    for isc_max, lim_lt11, lim_11_16, lim_17_22, lim_23_34, lim_ge35 in _INDIVIDUAL_LIMITS:
        if r < isc_max:
            if h < 11:
                return lim_lt11
            if h < 17:
                return lim_11_16
            if h < 23:
                return lim_17_22
            if h < 35:
                return lim_23_34
            return lim_ge35

    return 5.0   # should never reach here


# ── Voltage harmonics: THD and individual limits by bus voltage ───────────────
#   (IEEE 519-2014 Table 1)
#
#   Bus voltage at PCC     Individual  THD
#   V ≤ 1.0 kV              5.0%       8.0%
#   1 kV < V ≤ 69 kV        3.0%       5.0%
#   69 kV < V ≤ 161 kV      1.5%       2.5%
#   V > 161 kV              1.0%       1.5%

def voltage_thd_limit(lv_kv: float) -> float:
    """Return the voltage THD % limit from LV bus voltage in kV (IEEE 519 Table 1)."""
    try:
        v = float(lv_kv)
    except (TypeError, ValueError):
        return 8.0
    if v <= 1.0:
        return 8.0
    if v <= 69.0:
        return 5.0
    if v <= 161.0:
        return 2.5
    return 1.5


def voltage_individual_limit(lv_kv: float) -> float:
    """Return the individual voltage harmonic % limit from LV bus voltage in kV (IEEE 519 Table 1)."""
    try:
        v = float(lv_kv)
    except (TypeError, ValueError):
        return 5.0
    if v <= 1.0:
        return 5.0
    if v <= 69.0:
        return 3.0
    if v <= 161.0:
        return 1.5
    return 1.0
