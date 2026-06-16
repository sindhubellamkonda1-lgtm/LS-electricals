# graph_service.py

import os
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import pandas as pd
from utils_numeric import col


# ── Save helper ───────────────────────────────────────────────────────────────
def save(fig, path, name):
    fig.savefig(path, bbox_inches="tight")
    plt.close(fig)
    print("GRAPH:", name)


# ── Shared style ──────────────────────────────────────────────────────────────
def _fmt_time_axis(ax):
    """Apply compact HH:MM time formatting to x-axis."""
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%H:%M"))
    ax.xaxis.set_major_locator(mdates.AutoDateLocator())
    plt.setp(ax.xaxis.get_majorticklabels(), rotation=30, ha="right")


# ═════════════════════════════════════════════════════════════════════════════
# EXISTING GRAPHS
# ═════════════════════════════════════════════════════════════════════════════

def plot_load(graph_df, tmp):
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(graph_df["datetime"], col(graph_df, "PΣ (W)") / 1000, color="steelblue")
    ax.set_title("Load Profile")
    ax.set_xlabel("Time")
    ax.set_ylabel("kW")
    ax.grid(True, alpha=0.3)
    _fmt_time_axis(ax)
    save(fig, os.path.join(tmp, "load_curve.png"), "load_curve.png")


def plot_thd(transformer_list, tmp):
    if not transformer_list:
        print("plot_thd skipped — empty transformer list")
        return
    vals   = [x["Ithd"] for x in transformer_list]
    labels = [x["Type"] for x in transformer_list]
    fig, ax = plt.subplots()
    ax.bar(labels, vals, color=["steelblue", "coral"])
    ax.set_title("Current THD — Cap ON vs OFF")
    ax.set_ylabel("THD (%)")
    ax.grid(True, alpha=0.3, axis="y")
    save(fig, os.path.join(tmp, "thd.png"), "thd.png")


def plot_loading(transformer_list, tmp):
    if not transformer_list:
        print("plot_loading skipped — empty transformer list")
        return
    r   = transformer_list[0]
    pct = (r["Transformer_A"] / r["full_load_amps"]) * 100 if r["full_load_amps"] else 0
    fig, ax = plt.subplots()
    ax.bar(["Loading"], [pct], color="steelblue")
    ax.set_ylim(0, 150)
    ax.axhline(100, color="red", linestyle="--", label="Full Load")
    ax.set_title("Transformer Loading (%)")
    ax.set_ylabel("%")
    ax.legend()
    ax.grid(True, alpha=0.3, axis="y")
    save(fig, os.path.join(tmp, "loading.png"), "loading.png")


def plot_harmonic(df, tmp):
    cols = [c for c in df.columns if "H0" in str(c)]
    if not cols:
        print("No harmonic columns")
        return
    vals = [pd.to_numeric(df[c], errors="coerce").mean() for c in cols[:15]]
    labs = [str(c).split()[-1] for c in cols[:15]]
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.bar(labs, vals, color="steelblue")
    ax.set_title("Harmonic Spectrum (Average)")
    ax.set_xlabel("Harmonic Order")
    ax.set_ylabel("Current (A)")
    ax.grid(True, alpha=0.3, axis="y")
    save(fig, os.path.join(tmp, "harmonic_spectrum.png"), "harmonic_spectrum.png")


def plot_triangle(df, tmp):
    if "PΣ (W)" not in df.columns or "QΣf (var)" not in df.columns:
        print("Triangle skipped")
        return
    P = col(df, "PΣ (W)").mean() / 1000
    Q = col(df, "QΣf (var)").mean() / 1000
    import math
    S = math.sqrt(P**2 + Q**2)
    fig, ax = plt.subplots()
    ax.plot([0, P], [0, 0], "b-", linewidth=2, label=f"P = {P:.1f} kW")
    ax.plot([P, P], [0, Q], "r-", linewidth=2, label=f"Q = {Q:.1f} kVAR")
    ax.plot([0, P], [0, Q], "g-", linewidth=2, label=f"S = {S:.1f} kVA")
    ax.set_title("Power Triangle")
    ax.set_aspect("equal")
    ax.legend()
    ax.grid(True, alpha=0.3)
    save(fig, os.path.join(tmp, "triangle.png"), "triangle.png")


# ═════════════════════════════════════════════════════════════════════════════
# NEW GRAPHS
# ═════════════════════════════════════════════════════════════════════════════

# ── 1. 3-Phase Current Profile ────────────────────────────────────────────────
def plot_3phase_current(df_trend, tmp):
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(df_trend["datetime"], col(df_trend, "A1ʀᴍꜱ"), label="L1", color="steelblue")
    ax.plot(df_trend["datetime"], col(df_trend, "A2ʀᴍꜱ"), label="L2", color="orange")
    ax.plot(df_trend["datetime"], col(df_trend, "A3ʀᴍꜱ"), label="L3", color="green")
    ax.set_title("3-Phase Current Profile")
    ax.set_xlabel("Time")
    ax.set_ylabel("Current (A)")
    ax.legend()
    ax.grid(True, alpha=0.3)
    _fmt_time_axis(ax)
    save(fig, os.path.join(tmp, "current_3phase.png"), "current_3phase.png")


# ── 2. Phase Imbalance ────────────────────────────────────────────────────────
def plot_phase_imbalance(df_trend, tmp):
    a1 = col(df_trend, "A1ʀᴍꜱ")
    a2 = col(df_trend, "A2ʀᴍꜱ")
    a3 = col(df_trend, "A3ʀᴍꜱ")
    phases     = pd.concat([a1, a2, a3], axis=1)
    phase_mean = phases.mean(axis=1).replace(0, float("nan"))
    imbalance  = (phases.max(axis=1) - phases.min(axis=1)) / phase_mean * 100

    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(df_trend["datetime"], imbalance, color="darkorange")
    ax.axhline(10, color="red", linestyle="--", linewidth=1.5, label="10% limit")
    ax.set_title("Phase Current Imbalance")
    ax.set_xlabel("Time")
    ax.set_ylabel("Imbalance (%)")
    ax.legend()
    ax.grid(True, alpha=0.3)
    _fmt_time_axis(ax)
    save(fig, os.path.join(tmp, "phase_imbalance.png"), "phase_imbalance.png")


# ── 3. 3-Phase Voltage Profile ────────────────────────────────────────────────
def plot_voltage_profile(df_trend, tmp):
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(df_trend["datetime"], col(df_trend, "U12ʀᴍꜱ"), label="U12", color="steelblue")
    ax.plot(df_trend["datetime"], col(df_trend, "U23ʀᴍꜱ"), label="U23", color="orange")
    ax.plot(df_trend["datetime"], col(df_trend, "U31ʀᴍꜱ"), label="U31", color="green")
    ax.set_title("3-Phase Voltage Profile")
    ax.set_xlabel("Time")
    ax.set_ylabel("Voltage (V)")
    ax.legend()
    ax.grid(True, alpha=0.3)
    _fmt_time_axis(ax)
    save(fig, os.path.join(tmp, "voltage_profile.png"), "voltage_profile.png")


# ── 4. Power Factor Trend ────────────────────────────────────────────────────
def plot_pf_trend(df_trend, min_pf, tmp):
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(df_trend["datetime"], col(df_trend, "PFΣ"),
            color="steelblue", label="Power Factor")
    try:
        limit = float(min_pf)
        ax.axhline(limit, color="red", linestyle="--", linewidth=1.5,
                   label=f"Min PF required ({limit})")
    except (TypeError, ValueError):
        pass
    ax.set_title("Power Factor Trend")
    ax.set_xlabel("Time")
    ax.set_ylabel("Power Factor")
    ax.set_ylim(0, 1.05)
    ax.legend()
    ax.grid(True, alpha=0.3)
    _fmt_time_axis(ax)
    save(fig, os.path.join(tmp, "pf_trend.png"), "pf_trend.png")


# ── 5. kVAR Trend with ON/OFF markers ────────────────────────────────────────
def plot_kvar_trend(df_trend, max_df, tmp):
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(df_trend["datetime"], col(df_trend, "QΣf (var)") / 1000,
            color="purple", label="kVAR")

    if not max_df.empty and "status" in max_df.columns:
        seen = set()
        for _, r in max_df.iterrows():
            status = str(r["status"])
            color  = "green" if "ON" in status else "red"
            label  = status if status not in seen else None
            ax.axvline(r["time"], color=color, linestyle="--",
                       alpha=0.8, linewidth=1.5, label=label)
            seen.add(status)

    ax.set_title("Reactive Power (kVAR) Trend")
    ax.set_xlabel("Time")
    ax.set_ylabel("kVAR")
    ax.legend()
    ax.grid(True, alpha=0.3)
    _fmt_time_axis(ax)
    save(fig, os.path.join(tmp, "kvar_trend.png"), "kvar_trend.png")


# ── 6. Current THD Trend ─────────────────────────────────────────────────────
def plot_thd_trend(df_trend, tmp):
    fig, ax = plt.subplots(figsize=(10, 4))
    ax.plot(df_trend["datetime"], col(df_trend, "A1ᴛʜᴅf"), label="L1 THD", color="steelblue")
    ax.plot(df_trend["datetime"], col(df_trend, "A2ᴛʜᴅf"), label="L2 THD", color="orange")
    ax.plot(df_trend["datetime"], col(df_trend, "A3ᴛʜᴅf"), label="L3 THD", color="green")
    ax.axhline(8, color="red", linestyle="--", linewidth=1.5, label="IEEE 519 limit (8%)")
    ax.set_title("Current THD Trend")
    ax.set_xlabel("Time")
    ax.set_ylabel("THD (%)")
    ax.legend()
    ax.grid(True, alpha=0.3)
    _fmt_time_axis(ax)
    save(fig, os.path.join(tmp, "thd_trend.png"), "thd_trend.png")


# ── 7. ON vs OFF Comparison ───────────────────────────────────────────────────
def plot_on_off_comparison(transformer_list, harmonic_list, tmp):
    t_on  = next((x for x in transformer_list if x.get("Type") == "ON"),  None)
    t_off = next((x for x in transformer_list if x.get("Type") == "OFF"), None)
    h_on  = next((x for x in harmonic_list   if x.get("Type") == "ON"),  None)
    h_off = next((x for x in harmonic_list   if x.get("Type") == "OFF"), None)

    if not (t_on and t_off):
        print("ON/OFF comparison skipped — missing data")
        return

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle("Capacitor ON vs OFF Comparison", fontsize=13, fontweight="bold")
    width = 0.35

    # ── Left: Power/Current magnitudes ──
    mag_labels = ["Current (A)", "KW", "KVAR", "KVA"]
    mag_on  = [
        t_on.get("Transformer_A", 0),
        h_on.get("KW",   0) if h_on else 0,
        h_on.get("KVAR", 0) if h_on else 0,
        h_on.get("KVA",  0) if h_on else 0,
    ]
    mag_off = [
        t_off.get("Transformer_A", 0),
        h_off.get("KW",   0) if h_off else 0,
        h_off.get("KVAR", 0) if h_off else 0,
        h_off.get("KVA",  0) if h_off else 0,
    ]
    x1 = range(len(mag_labels))
    ax1.bar([i - width/2 for i in x1], mag_on,  width, label="Cap ON",  color="steelblue")
    ax1.bar([i + width/2 for i in x1], mag_off, width, label="Cap OFF", color="coral")
    ax1.set_xticks(list(x1))
    ax1.set_xticklabels(mag_labels)
    ax1.set_title("Power & Current")
    ax1.legend()
    ax1.grid(True, alpha=0.3, axis="y")

    # ── Right: PF and THD percentages ──
    pct_labels = ["THD (%)", "Power Factor"]
    pct_on  = [t_on.get("Ithd", 0),  h_on.get("PF",  0) if h_on  else 0]
    pct_off = [t_off.get("Ithd", 0), h_off.get("PF", 0) if h_off else 0]
    x2 = range(len(pct_labels))
    ax2.bar([i - width/2 for i in x2], pct_on,  width, label="Cap ON",  color="steelblue")
    ax2.bar([i + width/2 for i in x2], pct_off, width, label="Cap OFF", color="coral")
    ax2.set_xticks(list(x2))
    ax2.set_xticklabels(pct_labels)
    ax2.set_title("Power Quality")
    ax2.legend()
    ax2.grid(True, alpha=0.3, axis="y")

    plt.tight_layout()
    save(fig, os.path.join(tmp, "on_off_comparison.png"), "on_off_comparison.png")


# ── 8. Harmonic Spectrum ON vs OFF ────────────────────────────────────────────
def plot_harmonic_on_off(df_ind, on, off, tmp):

    def get_spectrum(df, time_val):
        row = df[df["Time"] == time_val]
        if row.empty:
            return [0] * 13
        row = row.iloc[0]
        result = []
        for i in range(1, 14):
            h   = f"H{str(i).zfill(3)}"
            val = max(
                pd.to_numeric(row.get(f"L1 {h}", 0), errors="coerce") or 0,
                pd.to_numeric(row.get(f"L2 {h}", 0), errors="coerce") or 0,
                pd.to_numeric(row.get(f"L3 {h}", 0), errors="coerce") or 0,
            )
            result.append(round(float(val), 2))
        return result

    on_vals  = get_spectrum(df_ind, on)
    off_vals = get_spectrum(df_ind, off)

    labels = [f"H{i}" for i in range(1, 14)]
    x      = range(len(labels))
    width  = 0.35

    fig, ax = plt.subplots(figsize=(12, 5))
    ax.bar([i - width/2 for i in x], on_vals,  width, label="Cap ON",  color="steelblue")
    ax.bar([i + width/2 for i in x], off_vals, width, label="Cap OFF", color="coral")
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels)
    ax.set_title("Harmonic Spectrum: Cap ON vs Cap OFF")
    ax.set_xlabel("Harmonic Order")
    ax.set_ylabel("Current (A)")
    ax.legend()
    ax.grid(True, alpha=0.3, axis="y")
    save(fig, os.path.join(tmp, "harmonic_on_off.png"), "harmonic_on_off.png")
