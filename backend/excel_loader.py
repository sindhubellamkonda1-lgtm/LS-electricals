import pandas as pd

def load_sheet_fast(excel_path, sheet_name):
    """
    Fast Excel loader.
    Reads sheet with header starting at row 3 (header=2).
    Raises a clear ValueError showing available sheet names if the
    requested sheet is not found.
    """
    # Use a context manager to ensure the file handle is safely closed
    with pd.ExcelFile(excel_path) as xl:
        available = xl.sheet_names

        if sheet_name not in available:
            raise ValueError(
                f"Sheet '{sheet_name}' not found in the uploaded Excel file.\n"
                f"Available sheets: {available}\n"
                f"Please upload the raw PQ analyser export that contains "
                f"'Trend 3 s' and 'Trend 3 s A h f' sheets."
            )

        # Read the dataframe before exiting the 'with' block
        df = pd.read_excel(
            xl,
            sheet_name=sheet_name,
            header=2
        )
        
    return df