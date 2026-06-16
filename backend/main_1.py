from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from utils_numeric import col

import tempfile, json, os, importlib.util, traceback, sys
import matplotlib.pyplot as plt
import pandas as pd
import base64
from graph_service import (
    plot_load,
    plot_thd,
    plot_loading,
    plot_harmonic,
    plot_triangle
)
from excel_writer.report_builder import Generate_XLS


app = FastAPI(title="Transformer Harmonic API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ---------------- LOAD ENGINE ----------------
def load_core():
    spec=importlib.util.spec_from_file_location("core","3_Excelt_parquet.py")
    core=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(core)
    return core


# ---------------- API ----------------
@app.post("/generate-report/")
async def generate(json_file: UploadFile = File(...), excel_file: UploadFile = File(...)):

    try:

        core=load_core()

        with tempfile.TemporaryDirectory() as tmp:

            jp=os.path.join(tmp,"j.json")
            xp=os.path.join(tmp,"x.xlsx")

            open(jp,"wb").write(await json_file.read())
            open(xp,"wb").write(await excel_file.read())

            data=json.load(open(jp))

            df_trend=core.normalize_excel_datetime(core.load_sheet_fast(xp,"Trend 3 s"))
            df_ind=core.normalize_excel_datetime(core.load_sheet_fast(xp,"Trend 3 s A h f"))

            max_df=core.build_max_power_df(data,df_trend)

            feeder=data["site_measurements"][0]["feeder_name"]
            details=data["site_measurements"][0]["transformer_nameplate_details"]

            on=max_df[max_df["status"].str.contains("ON")]["time"].iloc[0].strftime("%H:%M:%S")
            off=max_df[max_df["status"].str.contains("OFF")]["time"].iloc[0].strftime("%H:%M:%S")

            transformer=[
                core.Trasformer_Limits_Analysis(details,df_trend,feeder,on,"ON"),
                core.Trasformer_Limits_Analysis(details,df_trend,feeder,off,"OFF")
            ]

            harmonic=[
                core.Harmonic_Analysis(df_trend,feeder,on,"ON"),
                core.Harmonic_Analysis(df_trend,feeder,off,"OFF")
            ]

            individual=[
                core.extract_harmonic_max(df_ind,feeder,on,"ON"),
                core.extract_harmonic_max(df_ind,feeder,off,"OFF")
            ]

            transformer=[x for x in transformer if x]
            harmonic=[x for x in harmonic if x]
            individual=[x for x in individual if x]

            # CREATE ALL GRAPHS
            plot_load(df_trend,tmp)
            plot_thd(transformer,tmp)
            plot_loading(transformer,tmp)
            plot_harmonic(df_ind,tmp)
            plot_triangle(df_trend,tmp)

            print("TOTAL PNG:",[f for f in os.listdir(tmp) if f.endswith(".png")])

            file=core.Generate_XLS(data,max_df,transformer,harmonic,individual,img_dir=tmp)

            content=open(file,"rb").read()

        return StreamingResponse(iter([content]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition":f"attachment; filename={os.path.basename(file)}"}
        )

    except Exception as e:
        traceback.print_exc(file=sys.stdout)
        raise HTTPException(status_code=500,detail=str(e))

@app.post("/generate-graphs/")
async def generate_graphs(
    json_file: UploadFile = File(...),
    excel_file: UploadFile = File(...)
):

    try:

        core=load_core()

        with tempfile.TemporaryDirectory() as tmp:

            jp=os.path.join(tmp,"j.json")
            xp=os.path.join(tmp,"x.xlsx")

            open(jp,"wb").write(await json_file.read())
            open(xp,"wb").write(await excel_file.read())

            data=json.load(open(jp))

            df_trend=core.normalize_excel_datetime(
                core.load_sheet_fast(xp,"Trend 3 s")
            )

            df_ind=core.normalize_excel_datetime(
                core.load_sheet_fast(xp,"Trend 3 s A h f")
            )

            max_df=core.build_max_power_df(data,df_trend)

            feeder=data["site_measurements"][0]["feeder_name"]
            details=data["site_measurements"][0]["transformer_nameplate_details"]

            on=max_df[max_df["status"].str.contains("ON")]["time"].iloc[0].strftime("%H:%M:%S")
            off=max_df[max_df["status"].str.contains("OFF")]["time"].iloc[0].strftime("%H:%M:%S")

            transformer=[
                core.Trasformer_Limits_Analysis(details,df_trend,feeder,on,"ON"),
                core.Trasformer_Limits_Analysis(details,df_trend,feeder,off,"OFF")
            ]

            transformer=[x for x in transformer if x]

            # -------- CREATE GRAPHS --------
            plot_load(df_trend,tmp)
            plot_thd(transformer,tmp)
            plot_loading(transformer,tmp)
            plot_harmonic(df_ind,tmp)
            plot_triangle(df_trend,tmp)

            # -------- RETURN BASE64 IMAGES --------
            graphs={}

            for f in os.listdir(tmp):
                if f.endswith(".png"):
                    with open(os.path.join(tmp,f),"rb") as img:
                        graphs[f]=base64.b64encode(img.read()).decode()

            return {"graphs":graphs}

    except Exception as e:
        traceback.print_exc(file=sys.stdout)
        raise HTTPException(status_code=500,detail=str(e))
