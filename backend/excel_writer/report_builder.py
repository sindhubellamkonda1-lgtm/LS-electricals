from openpyxl import Workbook
from datetime import datetime
import os

from excel_writer.measuring_points_writer import write_feeder_sheet
from excel_writer.transformer_writer import write_transformer_sheet
from excel_writer.harmonic_writer import write_harmonic_sheet
from excel_writer.individual_writer import write_individual_sheet
from excel_writer.graph_writer import write_graph_sheet


def Generate_XLS(
    data,
    max_df,
    transformer_list,
    harmonic_list,
    individual_list,
    img_dir="."
):
    """
    Main Excel report builder.

    Creates workbook,
    calls all sheet writers,
    saves file into the temp directory,
    returns filename.
    """

    # -----------------------------
    # Create workbook
    # -----------------------------
    wb = Workbook()

    # -----------------------------
    # Write sheets (ORDER MATTERS)
    # -----------------------------
    write_feeder_sheet(wb, data)

    write_transformer_sheet(wb, transformer_list)

    write_harmonic_sheet(wb, harmonic_list, transformer_list)

    write_individual_sheet(wb, individual_list, transformer_list)

    write_graph_sheet(wb, img_dir)

    # -----------------------------
    # Save file and Clean up
    # -----------------------------
    # Force the file to save INSIDE the temporary directory (img_dir)
    filename = f"Transformer_Report_{datetime.now().strftime('%H%M%S')}.xlsx"
    filepath = os.path.join(img_dir, filename)

    wb.save(filepath)
    wb.close() # Safely close the openpyxl workbook instance

    return filepath