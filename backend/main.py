from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import tempfile, json, os, traceback, sys, base64
import pandas as pd

# ── ReportGenerator modules ──────────────────────────────────────────────────
from excel_loader import load_sheet_fast
from datetime_utils import normalize_excel_datetime
from window_detector import build_max_power_df
from transformer_engine import Trasformer_Limits_Analysis
from harmonic_engine import Harmonic_Analysis, extract_harmonic_max
from graph_service import (
    plot_load, plot_thd, plot_loading, plot_harmonic, plot_triangle,
    plot_3phase_current, plot_phase_imbalance, plot_voltage_profile,
    plot_pf_trend, plot_kvar_trend, plot_thd_trend,
    plot_on_off_comparison, plot_harmonic_on_off,
)
from excel_writer.report_builder import Generate_XLS
from json_normalizer import normalize_json

import uvicorn


# ============================================================
# PYDANTIC MODELS — mirrors Stage1_Upload.jsx schema exactly
# ============================================================

class AdditionalEmail(BaseModel):
    value: Optional[str] = ""

class ElectricityDetail(BaseModel):
    sourceOfSupply: str                     # "EB" | "TG" | "DG"
    contractDemand: Optional[str] = ""
    billedDemand: Optional[str] = ""
    minPfRequired: Optional[str] = ""
    averagePowerFactor: Optional[str] = ""

class EquipmentItem(BaseModel):
    nos: Optional[str] = ""
    rating: Optional[str] = ""

class FacilityDetails(BaseModel):
    transformer: EquipmentItem = EquipmentItem()
    dgTg: EquipmentItem = EquipmentItem()
    capacitors: EquipmentItem = EquipmentItem()
    pccs: EquipmentItem = EquipmentItem()
    mccs: EquipmentItem = EquipmentItem()

class NonLinearLoadItem(BaseModel):
    present: bool = False
    kw: Optional[str] = ""

class NonLinearLoadItemKVA(BaseModel):
    present: bool = False
    kva: Optional[str] = ""

class NonLinearLoadWelding(BaseModel):
    present: bool = False
    value: Optional[str] = ""
    unit: Optional[str] = "kW"
    description: Optional[str] = ""

class NonLinearLoadOthers(BaseModel):
    present: bool = False
    kwKva: Optional[str] = ""
    unit: Optional[str] = "kW"
    description: Optional[str] = ""

class NonLinearLoads(BaseModel):
    totalPresentKW: Optional[str] = ""
    thyristorsVFD: NonLinearLoadItem = NonLinearLoadItem()
    furnace: NonLinearLoadItem = NonLinearLoadItem()
    ups: NonLinearLoadItemKVA = NonLinearLoadItemKVA()
    weldingLoads: NonLinearLoadWelding = NonLinearLoadWelding()
    others: NonLinearLoadOthers = NonLinearLoadOthers()

class OperatingPattern(BaseModel):
    constantKW: Optional[str] = ""
    varyingKW: Optional[str] = ""

class ShutdownAvailability(BaseModel):
    available: Optional[str] = ""          # "yes" | "no"
    possibleTimeMins: Optional[str] = ""

class ProblemsOthers(BaseModel):
    present: Optional[bool] = False
    description: Optional[str] = ""

class ProblemsFaced(BaseModel):
    capacitorFailure: Optional[bool] = False
    drivesFailure: Optional[bool] = False
    electronicCardsFailure: Optional[bool] = False
    nuisanceTripping: Optional[bool] = False
    flickerObservance: Optional[bool] = False
    overheating: Optional[bool] = False
    others: Optional[ProblemsOthers] = ProblemsOthers()

class Page2Header(BaseModel):
    companyName: Optional[str] = ""
    date: Optional[str] = ""
    feederName: Optional[str] = ""
    fileName: Optional[str] = ""

class OverallTiming(BaseModel):
    enabled: Optional[bool] = False
    start: Optional[str] = ""
    end: Optional[str] = ""

class TimingDetail(BaseModel):
    col1: Optional[str] = ""               # Start time / label
    col2: Optional[str] = ""               # End time / notes
    capStatus: Optional[str] = ""          # "ON" | "OFF" | ""

class CapacitorBankDetails(BaseModel):
    rating: Optional[str] = ""
    noOfSteps: Optional[str] = ""
    reactors: Optional[str] = ""
    kvarOn: Optional[str] = ""
    downLevelDetails: Optional[str] = ""

class TransformerNamePlate(BaseModel):
    rating: Optional[str] = ""
    impedance: Optional[str] = ""
    voltageLevel: Optional[str] = ""
    vectorGroup: Optional[str] = ""
    hvLvAmps: Optional[str] = ""

class AuditFormData(BaseModel):
    # ── Step 1 ──────────────────────────────────────────────
    companyNameAddress: str
    contactPerson: str
    designation: str
    phoneNumber: str
    email: str
    additionalEmails: List[AdditionalEmail] = []
    electricityDetails: List[ElectricityDetail]
    facilityDetails: FacilityDetails = FacilityDetails()
    nonLinearLoads: NonLinearLoads = NonLinearLoads()
    totalConnectedLoadKW: Optional[str] = ""
    operatingPattern: OperatingPattern = OperatingPattern()
    ammetersPresent: Optional[str] = ""
    shutdownAvailability: ShutdownAvailability = ShutdownAvailability()
    problemsFaced: ProblemsFaced = ProblemsFaced()
    # ── Step 2 ──────────────────────────────────────────────
    page2Header: Page2Header = Page2Header()
    overallTiming: Optional[OverallTiming] = OverallTiming()
    timingDetails: List[TimingDetail] = []
    capacitorBankDetails: CapacitorBankDetails = CapacitorBankDetails()
    transformerNamePlate: TransformerNamePlate = TransformerNamePlate()


# ============================================================
# HELPER — map AuditFormData → internal analysis JSON shape
# ============================================================
def _form_to_internal(form: AuditFormData) -> dict:
    """
    Converts the AuditFormData (from the React form) into the internal JSON
    structure expected by the analysis engines.
    """
    feeder = form.page2Header.feederName or ""
    cap    = form.capacitorBankDetails
    tx     = form.transformerNamePlate

    # Safely parse the "HV / LV" strings into dictionaries
    v_level_str = tx.voltageLevel or ""
    if "/" in v_level_str:
        v_parts = v_level_str.split("/", 1)
        v_dict = {"hv": v_parts[0].strip(), "lv": v_parts[1].strip()}
    else:
        v_dict = {"hv": v_level_str, "lv": ""}

    amps_str = tx.hvLvAmps or ""
    if "/" in amps_str:
        a_parts = amps_str.split("/", 1)
        a_dict = {"hv": a_parts[0].strip(), "lv": a_parts[1].strip()}
    else:
        a_dict = {"hv": amps_str, "lv": ""}

    # Build transformer_nameplate_details in the shape transformer_engine expects
    transformer_nameplate = {
        "rating":        tx.rating        or "",
        "impedance":     tx.impedance     or "",
        "voltage_level": v_dict,
        "vector_group":  tx.vectorGroup   or "",
        "hv_lv_amps":    a_dict,
    }

    # Build capacitor_bank_details in the shape the engines expect
    capacitor_bank = {
        "rating_kvar":      cap.rating         or "",
        "no_of_steps":      cap.noOfSteps      or "",
        "reactors_present": (cap.reactors or "").strip().lower() not in ("", "nil", "no", "none"),
        "kvar_on":          cap.kvarOn         or "",
        "down_level":       cap.downLevelDetails or "",
    }

    # Build electricity_details list (pick min_pf from first EB source by default)
    electricity_details_list = []
    min_pf = None
    for ed in form.electricityDetails:
        entry = {
            "source_of_supply":    ed.sourceOfSupply,
            "contract_demand":     ed.contractDemand,
            "billed_demand":       ed.billedDemand,
            "minimum_pf_required": ed.minPfRequired,
            "average_power_factor":ed.averagePowerFactor,
        }
        electricity_details_list.append(entry)
        if min_pf is None and ed.minPfRequired:
            try:
                min_pf = float(ed.minPfRequired)
            except ValueError:
                pass

    # Non-linear loads
    nl = form.nonLinearLoads
    non_linear_loads = {
        "total_present_kw": nl.totalPresentKW,
        "thyristors_vfd":   {"present": nl.thyristorsVFD.present, "kw": nl.thyristorsVFD.kw},
        "furnace":          {"present": nl.furnace.present,       "kw": nl.furnace.kw},
        "ups":              {"present": nl.ups.present,           "kva": nl.ups.kva},
        "welding_loads": {
            "present":     nl.weldingLoads.present,
            "value":       nl.weldingLoads.value,
            "unit":        nl.weldingLoads.unit,
            "description": nl.weldingLoads.description,
        },
        "others": {
            "present":     nl.others.present,
            "kw_kva":      nl.others.kwKva,
            "unit":        nl.others.unit,
            "description": nl.others.description,
        },
    }

    # Problems faced
    pf = form.problemsFaced
    problems = {
        "capacitor_failure":        pf.capacitorFailure,
        "drives_failure":           pf.drivesFailure,
        "electronic_cards_failure": pf.electronicCardsFailure,
        "nuisance_tripping":        pf.nuisanceTripping,
        "flicker_observance":       pf.flickerObservance,
        "overheating":              pf.overheating,
        "others": {
            "present":     pf.others.present     if pf.others else False,
            "description": pf.others.description if pf.others else "",
        },
    }

    # Assemble into the shape normalize_json / analysis engines consume
    return {
        "company_info": {
            "name_address":      form.companyNameAddress,
            "contact_person":    form.contactPerson,
            "designation":       form.designation,
            "phone":             form.phoneNumber,
            "email":             form.email,
            "additional_emails": [e.value for e in form.additionalEmails if e.value],
        },
        "electricity_details": {
            "sources":             electricity_details_list,
            "minimum_pf_required": min_pf,
        },
        "facility_details": {
            "transformer": {"nos": form.facilityDetails.transformer.nos, "rating": form.facilityDetails.transformer.rating},
            "dg_tg":       {"nos": form.facilityDetails.dgTg.nos,        "rating": form.facilityDetails.dgTg.rating},
            "capacitors":  {"nos": form.facilityDetails.capacitors.nos,  "rating": form.facilityDetails.capacitors.rating},
            "pccs":        {"nos": form.facilityDetails.pccs.nos,        "rating": form.facilityDetails.pccs.rating},
            "mccs":        {"nos": form.facilityDetails.mccs.nos,        "rating": form.facilityDetails.mccs.rating},
        },
        "non_linear_loads": non_linear_loads,
        "load_characteristics": {
            "total_connected_kw": form.totalConnectedLoadKW,
            "constant_kw":        form.operatingPattern.constantKW,
            "varying_kw":         form.operatingPattern.varyingKW,
        },
        "metering": {
            "ammeters_present": form.ammetersPresent,
        },
        "shutdown_availability": {
            "available":          form.shutdownAvailability.available,
            "possible_time_mins": form.shutdownAvailability.possibleTimeMins,
        },
        "problems_faced": problems,
        "document_info": {
            "company_name": form.page2Header.companyName,
            "date":         form.page2Header.date,
            "feeder_name":  feeder,
            "file_name":    form.page2Header.fileName,
        },
        "overall_timing": {
            "enabled": form.overallTiming.enabled,
            "start":   form.overallTiming.start,
            "end":     form.overallTiming.end,
        },
        "timing_details": [
            {"start": t.col1, "end": t.col2, "cap_status": t.capStatus} for t in form.timingDetails
        ],
        # Used directly by transformer_engine and harmonic_engine via site_measurements
        "site_measurements": [
            {
                "feeder_name":                   feeder,
                "transformer_nameplate_details": transformer_nameplate,
                "capacitor_bank_details":        capacitor_bank,
            }
        ],
    }


# ============================================================
# HELPERS — reused across endpoints
# ============================================================
def _get_on_off_times(max_df, df_trend):
    watts    = pd.to_numeric(df_trend["PΣ (W)"], errors="coerce")
    fallback = df_trend.loc[watts.idxmax(), "datetime"].strftime("%H:%M:%S")
    on = off = fallback

    if not max_df.empty and "status" in max_df.columns:
        rows_on  = max_df[max_df["status"].str.contains("ON",  case=False, na=False)]
        rows_off = max_df[max_df["status"].str.contains("OFF", case=False, na=False)]
        if not rows_on.empty:
            on  = rows_on["time"].iloc[0].strftime("%H:%M:%S")
        if not rows_off.empty:
            off = rows_off["time"].iloc[0].strftime("%H:%M:%S")

    return on, off

def _get_site_fields(data: dict):
    sm0     = ((data.get("site_measurements") or [{}])[0]) or {}
    feeder  = sm0.get("feeder_name") or ""
    details = sm0.get("transformer_nameplate_details") or {}
    return feeder, details


# ============================================================
# CONFIG
# ============================================================
_THIS_DIR  = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(_THIS_DIR, "config.json")) as f:
    CONFIG = json.load(f)

OUTPUT_DIR = os.path.join(_THIS_DIR, CONFIG.get("OUTPUT_DIR", "output_json"))
os.makedirs(OUTPUT_DIR, exist_ok=True)


# ============================================================
# FASTAPI SETUP
# ============================================================
app = FastAPI(title="LS Electrical Report API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "https://predict.actoryx.ai",
        "http://predict.actoryx.ai:3000",
        "https://sindhubellamkonda1-lgtm.github.io",  # ← GitHub Pages
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# ENDPOINT 1 — Submit form → return structured JSON
# ============================================================
@app.post("/submit-form/")
async def submit_form(form_data: AuditFormData):
    """
    Accepts the Stage1_Upload form payload and returns it as a
    normalised internal JSON structure (no file processing).
    """
    try:
        return _form_to_internal(form_data)
    except Exception as e:
        traceback.print_exc(file=sys.stdout)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 2 — Generate Excel report (form JSON + Excel file)
# ============================================================
@app.post("/generate-report/")
async def generate(
    form_data: str = Form(...),          # JSON string of AuditFormData
    excel_file: UploadFile = File(...),
):
    """
    Accepts the form as a JSON string (multipart field) plus the
    raw Excel measurement file, and streams back the finished Excel report.
    """
    try:
        form = AuditFormData.model_validate(json.loads(form_data))

        with tempfile.TemporaryDirectory() as tmp:
            xp = os.path.join(tmp, "x.xlsx")
            
            contents = await excel_file.read()
            with open(xp, "wb") as f:
                f.write(contents)

            data = _form_to_internal(form)
            data = normalize_json(data)
            
            # --- SAFETY NET FIX ---
            if isinstance(data, str):
                data = json.loads(data)
            # ----------------------

            df_trend = normalize_excel_datetime(load_sheet_fast(xp, "Trend 3 s"))
            df_ind   = normalize_excel_datetime(load_sheet_fast(xp, "Trend 3 s A h f"))

            max_df          = build_max_power_df(data, df_trend)
            feeder, details = _get_site_fields(data)
            on, off         = _get_on_off_times(max_df, df_trend)

            transformer = [
                Trasformer_Limits_Analysis(details, df_trend, feeder, on,  "ON"),
                Trasformer_Limits_Analysis(details, df_trend, feeder, off, "OFF"),
            ]
            harmonic = [
                Harmonic_Analysis(df_trend, feeder, on,  "ON"),
                Harmonic_Analysis(df_trend, feeder, off, "OFF"),
            ]
            individual = [
                extract_harmonic_max(df_ind, feeder, on,  "ON"),
                extract_harmonic_max(df_ind, feeder, off, "OFF"),
            ]

            transformer = [x for x in transformer if x]
            harmonic    = [x for x in harmonic    if x]
            individual  = [x for x in individual  if x]

            min_pf = (data.get("electricity_details") or {}).get("minimum_pf_required")

            plot_load(df_trend, tmp)
            plot_thd(transformer, tmp)
            plot_loading(transformer, tmp)
            plot_harmonic(df_ind, tmp)
            plot_triangle(df_trend, tmp)
            plot_3phase_current(df_trend, tmp)
            plot_phase_imbalance(df_trend, tmp)
            plot_voltage_profile(df_trend, tmp)
            plot_pf_trend(df_trend, min_pf, tmp)
            plot_kvar_trend(df_trend, max_df, tmp)
            plot_thd_trend(df_trend, tmp)
            plot_on_off_comparison(transformer, harmonic, tmp)
            plot_harmonic_on_off(df_ind, on, off, tmp)

            file = Generate_XLS(
                data,
                max_df,
                transformer,
                harmonic,
                individual,
                img_dir=tmp,
            )

            with open(file, "rb") as f:
                content = f.read()

            return StreamingResponse(
                iter([content]),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={os.path.basename(file)}"},
            )

    except Exception as e:
        traceback.print_exc(file=sys.stdout)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 3 — Generate graphs only (base64 PNG)
# ============================================================
@app.post("/generate-graphs/")
async def generate_graphs(
    form_data: str = Form(...),
    excel_file: UploadFile = File(...),
):
    try:
        form = AuditFormData.model_validate(json.loads(form_data))

        with tempfile.TemporaryDirectory() as tmp:
            xp = os.path.join(tmp, "x.xlsx")
            
            contents = await excel_file.read()
            with open(xp, "wb") as f:
                f.write(contents)

            data = _form_to_internal(form)
            data = normalize_json(data)
            
            # --- SAFETY NET FIX ---
            if isinstance(data, str):
                data = json.loads(data)
            # ----------------------

            df_trend = normalize_excel_datetime(load_sheet_fast(xp, "Trend 3 s"))
            df_ind   = normalize_excel_datetime(load_sheet_fast(xp, "Trend 3 s A h f"))

            max_df          = build_max_power_df(data, df_trend)
            feeder, details = _get_site_fields(data)
            on, off         = _get_on_off_times(max_df, df_trend)

            transformer = [
                Trasformer_Limits_Analysis(details, df_trend, feeder, on,  "ON"),
                Trasformer_Limits_Analysis(details, df_trend, feeder, off, "OFF"),
            ]
            transformer = [x for x in transformer if x]

            harmonic = [
                Harmonic_Analysis(df_trend, feeder, on,  "ON"),
                Harmonic_Analysis(df_trend, feeder, off, "OFF"),
            ]
            harmonic = [x for x in harmonic if x]

            min_pf = (data.get("electricity_details") or {}).get("minimum_pf_required")

            plot_load(df_trend, tmp)
            plot_thd(transformer, tmp)
            plot_loading(transformer, tmp)
            plot_harmonic(df_ind, tmp)
            plot_triangle(df_trend, tmp)
            plot_3phase_current(df_trend, tmp)
            plot_phase_imbalance(df_trend, tmp)
            plot_voltage_profile(df_trend, tmp)
            plot_pf_trend(df_trend, min_pf, tmp)
            plot_kvar_trend(df_trend, max_df, tmp)
            plot_thd_trend(df_trend, tmp)
            plot_on_off_comparison(transformer, harmonic, tmp)
            plot_harmonic_on_off(df_ind, on, off, tmp)

            graphs = {}
            for f in os.listdir(tmp):
                if f.endswith(".png"):
                    with open(os.path.join(tmp, f), "rb") as img:
                        graphs[f] = base64.b64encode(img.read()).decode()
            return {"graphs": graphs}

    except Exception as e:
        traceback.print_exc(file=sys.stdout)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ENDPOINT 4 — Preview: form JSON + Excel → tab data + graphs
# ============================================================
@app.post("/generate-preview/")
async def generate_preview(
    form_data: str = Form(...),
    excel_file: UploadFile = File(...),
):
    """
    Returns all analysis data as JSON for the React UI:
      - tabs: {measuring_points, transformer_limits, harmonic_analysis, individual_harmonics}
      - graphs: {filename: base64_png}
    """
    try:
        form = AuditFormData.model_validate(json.loads(form_data))

        with tempfile.TemporaryDirectory() as tmp:
            xp = os.path.join(tmp, "x.xlsx")
            
            contents = await excel_file.read()
            with open(xp, "wb") as f:
                f.write(contents)

            data = _form_to_internal(form)
            data = normalize_json(data)
            
            # --- SAFETY NET FIX ---
            if isinstance(data, str):
                data = json.loads(data)
            # ----------------------

            df_trend = normalize_excel_datetime(load_sheet_fast(xp, "Trend 3 s"))
            df_ind   = normalize_excel_datetime(load_sheet_fast(xp, "Trend 3 s A h f"))

            max_df          = build_max_power_df(data, df_trend)
            feeder, details = _get_site_fields(data)
            on, off         = _get_on_off_times(max_df, df_trend)

            transformer = [
                Trasformer_Limits_Analysis(details, df_trend, feeder, on,  "ON"),
                Trasformer_Limits_Analysis(details, df_trend, feeder, off, "OFF"),
            ]
            harmonic = [
                Harmonic_Analysis(df_trend, feeder, on,  "ON"),
                Harmonic_Analysis(df_trend, feeder, off, "OFF"),
            ]
            individual = [
                extract_harmonic_max(df_ind, feeder, on,  "ON"),
                extract_harmonic_max(df_ind, feeder, off, "OFF"),
            ]

            transformer = [x for x in transformer if x]
            harmonic    = [x for x in harmonic    if x]
            individual  = [x for x in individual  if x]

            # ── Build tab data ────────────────────────────────────────────────
            cap          = form.capacitorBankDetails
            rating_kvar  = cap.rating   or "?"
            reactor_val  = cap.reactors or "Nil"

            tabs = {
                "measuring_points": [
                    {"S.No": 1, "Feeder": feeder, "Remarks": "Recording with Capacitor ON and OFF condition"},
                    {"S.No": 2, "Feeder": feeder, "Remarks": f"APFC Banks – {rating_kvar} kVAr, Reactors – {reactor_val}"},
                ],
                "transformer_limits": [
                    {k: (str(v) if v is not None else "—") for k, v in row.items()}
                    for row in transformer
                ],
                "harmonic_analysis": [
                    {k: (str(v) if v is not None else "—") for k, v in row.items()}
                    for row in harmonic
                ],
                "individual_harmonics": [
                    {k: (str(v) if v is not None else "—") for k, v in row.items()}
                    for row in individual
                ],
            }

            # ── Generate all graphs ───────────────────────────────────────────
            min_pf = (data.get("electricity_details") or {}).get("minimum_pf_required")

            plot_load(df_trend, tmp)
            plot_thd(transformer, tmp)
            plot_loading(transformer, tmp)
            plot_harmonic(df_ind, tmp)
            plot_triangle(df_trend, tmp)
            plot_3phase_current(df_trend, tmp)
            plot_phase_imbalance(df_trend, tmp)
            plot_voltage_profile(df_trend, tmp)
            plot_pf_trend(df_trend, min_pf, tmp)
            plot_kvar_trend(df_trend, max_df, tmp)
            plot_thd_trend(df_trend, tmp)
            plot_on_off_comparison(transformer, harmonic, tmp)
            plot_harmonic_on_off(df_ind, on, off, tmp)

            graphs = {}
            for f in os.listdir(tmp):
                if f.endswith(".png"):
                    with open(os.path.join(tmp, f), "rb") as img:
                        graphs[f] = base64.b64encode(img.read()).decode()

            return {"tabs": tabs, "graphs": graphs}

    except Exception as e:
        traceback.print_exc(file=sys.stdout)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# RUN SERVER
# ============================================================
if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
