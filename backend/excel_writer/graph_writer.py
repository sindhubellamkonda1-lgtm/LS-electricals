# excel_writer/graph_writer.py

import os
from openpyxl.drawing.image import Image


def write_graph_sheet(wb, img_dir="."):
    """
    Creates the 'Graphs' sheet
    and inserts generated PNG images.
    """

    ws = wb.create_sheet("Graphs")

    row = 3

    graphs = [
        ("Load Profile",                "load_curve.png"),
        ("THD Comparison",              "thd.png"),
        ("Transformer Loading",         "loading.png"),
        ("Harmonic Spectrum",           "harmonic_spectrum.png"),
        ("Power Triangle",              "triangle.png"),
        ("3-Phase Current Profile",     "current_3phase.png"),
        ("Phase Current Imbalance",     "phase_imbalance.png"),
        ("3-Phase Voltage Profile",     "voltage_profile.png"),
        ("Power Factor Trend",          "pf_trend.png"),
        ("Reactive Power (kVAR) Trend", "kvar_trend.png"),
        ("Current THD Trend",           "thd_trend.png"),
        ("Cap ON vs OFF Comparison",    "on_off_comparison.png"),
        ("Harmonic Spectrum ON vs OFF", "harmonic_on_off.png"),
    ]

    for title, filename in graphs:

        path = os.path.join(img_dir, filename)

        if os.path.exists(path):

            ws[f"A{row}"] = title
            row += 1

            img = Image(path)
            img.width = 900
            img.height = 420

            ws.add_image(img, f"A{row}")

            row += 23

    return ws
