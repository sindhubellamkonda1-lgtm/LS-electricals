# json_normalizer.py
#
# Accepts EITHER:
#   A) The new camelCase form payload from Stage1_Upload.jsx  (detected by
#      presence of "companyNameAddress" or "page2Header")
#   B) The legacy GPT-extracted numbered-prefix JSON
#      (detected by presence of "1_company_details")
#
# In both cases the output is the canonical site_data dict expected by all
# ReportGenerator engine modules.



def _parse_voltage_level(raw: str):
    """
    Parse a voltage level string like "11kV / 433V", "11/0.433", "11 kV / 433 V"
    into (hv_str, lv_str) that transformer_engine expects via details["voltage_level"]["hv"/"lv"].
    Falls back to ("?", "433V") if the string cannot be split.
    """
    import re
    raw = (raw or "").strip()
    if not raw:
        return "?", "433V"

    # Split on common separators: " / ", "/", " - ", "|"
    parts = re.split(r"\s*/\s*|\s*-\s*|\|", raw)
    parts = [p.strip() for p in parts if p.strip()]

    if len(parts) >= 2:
        return parts[0], parts[1]
    if len(parts) == 1:
        # Could not split — treat the whole thing as LV, HV unknown
        return "?", parts[0]
    return "?", "433V"

def _normalize_form(data: dict) -> dict:
    """
    Maps the raw react-hook-form payload (Stage1_Upload) to the canonical
    site_data format.
    """
    out = {}

    # ── company_details ───────────────────────────────────────────────────────
    emails = data.get("emails") or []
    primary_email = ""
    if emails and isinstance(emails[0], dict):
        primary_email = emails[0].get("value", "")
    elif emails and isinstance(emails[0], str):
        primary_email = emails[0]
    # also accept flattened email field written by onSubmit
    primary_email = data.get("email") or primary_email

    out["company_details"] = {
        "name":           data.get("companyNameAddress", ""),
        "location":       data.get("companyNameAddress", ""),
        "contact_person": data.get("contactPerson", ""),
        "designation":    data.get("designation", ""),
        "phone":          data.get("phoneNumber", ""),
        "email":          primary_email,
        "additional_emails": data.get("additionalEmails", []),
    }

    # ── electricity_details ───────────────────────────────────────────────────
    # Take the first electricity source entry for global fields; keep all sources
    ed_list = data.get("electricityDetails") or []
    first_ed = ed_list[0] if ed_list else {}
    out["electricity_details"] = {
        "source_of_power":      first_ed.get("sourceOfSupply", ""),
        "contract_demand_kva":  first_ed.get("contractDemand", ""),
        "billed_demand_kva":    first_ed.get("billedDemand", ""),
        "minimum_pf_required":  first_ed.get("minPfRequired", ""),
        "average_power_factor": first_ed.get("averagePowerFactor", ""),
        "all_sources": [
            {
                "source_of_power":      s.get("sourceOfSupply", ""),
                "contract_demand_kva":  s.get("contractDemand", ""),
                "billed_demand_kva":    s.get("billedDemand", ""),
                "minimum_pf_required":  s.get("minPfRequired", ""),
                "average_power_factor": s.get("averagePowerFactor", ""),
            }
            for s in ed_list
        ],
    }

    # ── facility_details ──────────────────────────────────────────────────────
    fd = data.get("facilityDetails") or {}
    out["facility_details"] = {
        "transformer": fd.get("transformer"),
        "dg_set":      fd.get("dgTg"),
        "capacitors":  fd.get("capacitors"),
        "pccs":        fd.get("pccs"),
        "mccs":        fd.get("mccs"),
    }

    # ── non_linear_loads ──────────────────────────────────────────────────────
    nl = data.get("nonLinearLoads") or {}
    out["non_linear_loads"] = {
        "total_present_kw": nl.get("totalPresentKW", ""),
        "thyristors_vfd": {
            "present": nl.get("thyristorsVFD", {}).get("present", False),
            "kw":      nl.get("thyristorsVFD", {}).get("kw", ""),
        },
        "furnace": {
            "present": nl.get("furnace", {}).get("present", False),
            "kw":      nl.get("furnace", {}).get("kw", ""),
        },
        "ups": {
            "present": nl.get("ups", {}).get("present", False),
            "kva":     nl.get("ups", {}).get("kva", ""),
        },
        "welding": {
            "present": nl.get("welding", {}).get("present", False),
            "value":   nl.get("welding", {}).get("value", ""),
            "unit":    nl.get("welding", {}).get("unit", "kW"),
        },
        "others": {
            "present":     nl.get("others", {}).get("present", False),
            "description": nl.get("others", {}).get("description", ""),
            "value":       nl.get("others", {}).get("value", ""),
            "unit":        nl.get("others", {}).get("unit", "kW"),
        },
    }

    # ── load characteristics ──────────────────────────────────────────────────
    op = data.get("operatingPattern") or {}
    out["load_characteristics"] = {
        "total_connected_kw": data.get("totalConnectedLoadKW", ""),
        "constant_kw":        op.get("constantKW", ""),
        "varying_kw":         op.get("varyingKW", ""),
    }

    # ── metering_and_shutdown ─────────────────────────────────────────────────
    sd = data.get("shutdownAvailability") or {}
    out["metering_and_shutdown"] = {
        "ammeters_digital_meters_present": data.get("ammetersPresent", ""),
        "shutdown_available":              sd.get("available", ""),
        "shutdown_time_mins":              sd.get("possibleTimeMins", ""),
    }

    # ── problems_faced ────────────────────────────────────────────────────────
    pf = data.get("problemsFaced") or {}
    out["problems_faced"] = {
        "capacitor_failure":        pf.get("capacitorFailure", False),
        "drives_failure":           pf.get("drivesFailure", False),
        "electronic_cards_failure": pf.get("electronicCardsFailure", False),
        "nuisance_tripping":        pf.get("nuisanceTripping", False),
        "flicker_observance":       pf.get("flickerObservance", False),
        "overheating":              pf.get("overheating", False),
        "others": {
            "present":     (pf.get("others") or {}).get("present", False),
            "description": (pf.get("others") or {}).get("description", ""),
        },
    }

    # ── document / timing info ────────────────────────────────────────────────
    ph  = data.get("page2Header") or {}
    ot  = data.get("overallTiming") or {}
    td  = data.get("timingDetails") or []
    cap = data.get("capacitorBankDetails") or {}
    tx  = data.get("transformerNamePlate") or {}

    feeder = ph.get("feederName", "")

    out["document_info"] = {
        "company_name":  ph.get("companyName", ""),
        "date":          ph.get("date", ""),
        "feeder_name":   feeder,
        "file_name":     ph.get("fileName", ""),
    }

    out["overall_timing"] = {
        "start_time": ot.get("startTime", ""),
        "end_time":   ot.get("endTime", ""),
    }

    out["timing_details"] = [
        {
            "start":      t.get("col1", ""),
            "end":        t.get("col2", ""),
            "cap_status": t.get("capStatus", "N/A"),
        }
        for t in td
    ]

    # ── capacitor_switching_sequence — derived from timingDetails capStatus ───
    # Only include rows where the user explicitly set ON or OFF (skip N/A)
    switching_sequence = [
        {
            "from":   t.get("col1", "").strip(),
            "to":     t.get("col2", "").strip(),
            "status": t.get("capStatus", "N/A").upper(),
        }
        for t in td
        if t.get("capStatus", "N/A").upper() in ("ON", "OFF")
        and t.get("col1", "").strip()   # must have a start time
    ]

    # ── site_measurements — shape expected by transformer_engine ──────────────
    reactors_raw = cap.get("reactors", "") or ""
    reactors_present = reactors_raw.strip().lower() not in ("", "nil", "no", "none", "false")

    # ── Parse voltage_level string → {"hv": "...", "lv": "..."} ─────────────
    # transformer_engine does: details.get("voltage_level") → {"lv":..,"hv":..}
    # The form sends a single string e.g. "11kV / 433V" or "11/0.433"
    voltage_level_raw = tx.get("voltageLevel", "") or ""
    hv_str, lv_str = _parse_voltage_level(voltage_level_raw)

    out["site_measurements"] = [
        {
            "feeder_name": feeder,
            "transformer_nameplate_details": {
                "rating":        tx.get("rating", ""),
                "impedance":     tx.get("impedance", ""),
                # dict so transformer_engine can do .get("lv") / .get("hv")
                "voltage_level": {"hv": hv_str, "lv": lv_str},
                # raw string kept for display/other consumers
                "voltage_level_raw": voltage_level_raw,
                "vector_group":  tx.get("vectorGroup", ""),
                "hv_lv_amps":    tx.get("hvLvAmps", ""),
            },
            "capacitor_bank_details": {
                "rating_kvar":      cap.get("rating", ""),
                "no_of_steps":      cap.get("noOfSteps", ""),
                "reactors_present": reactors_present,
                "reactors_value":   reactors_raw,
                "kvar_on":          cap.get("kvarOn", ""),
                "down_level":       cap.get("downLevelDetails", ""),
            },
            # Used by window_detector.build_max_power_df to find ON/OFF peaks
            "capacitor_switching_sequence": switching_sequence,
        }
    ]

    return out


def _normalize_gpt(data: dict) -> dict:
    """
    Legacy path: maps GPT-extracted numbered-prefix JSON to the canonical format.
    Kept intact so old JSON files still work.
    """
    out = {}

    cd = data.get("1_company_details") or {}
    out["company_details"] = {
        "name":           cd.get("company_name"),
        "location":       cd.get("address_or_location"),
        "contact_person": cd.get("contact_person"),
        "designation":    cd.get("designation"),
        "phone":          cd.get("phone_number"),
        "email":          cd.get("email"),
    }

    ed = data.get("2_electricity_details") or {}
    out["electricity_details"] = {
        "source_of_power":      ed.get("source_of_power"),
        "contract_demand_kva":  ed.get("contract_demand_kva_kw"),
        "billed_demand_kva":    ed.get("billed_demand_kva_kw"),
        "minimum_pf_required":  ed.get("minimum_pf_required_by_seb"),
        "average_power_factor": ed.get("average_power_factor"),
    }

    fd = data.get("3_facility_details") or {}
    out["facility_details"] = {
        "transformer":     fd.get("transformer"),
        "dg_set":          fd.get("dg_or_tg"),
        "capacitors":      fd.get("capacitors_ht_lt"),
        "pcc_rating_amps": (fd.get("pccs") or {}).get("rating_amps"),
    }

    out["non_linear_loads"] = data.get("4_non_linear_loads")

    out["metering_and_shutdown"] = {
        "ammeters_digital_meters_present": data.get("7_ammeters_digital_meters_present"),
        "shutdown_available": (data.get("8_shutdown_availability") or {}).get("available"),
    }

    out["problems_faced"]  = data.get("9_nature_of_problem_faced")
    out["audit_reason"]    = data.get("10_specific_reason_for_audit")
    out["site_measurements"] = data.get("site_measurements", [])

    return out


def normalize_json(data: dict) -> dict:
    """
    Auto-detects whether the payload is from the new React form or the legacy
    GPT-extracted format, then delegates to the appropriate normaliser.
    """
    if not isinstance(data, dict):
        raise ValueError(f"normalize_json expected a dict, got {type(data).__name__}")

    # Detect new form payload by camelCase keys
    if "companyNameAddress" in data or "page2Header" in data or "electricityDetails" in data:
        return _normalize_form(data)

    # Detect legacy GPT payload by numbered-prefix keys
    if "1_company_details" in data or "site_measurements" in data:
        return _normalize_gpt(data)

    # Unknown shape — attempt form path as best effort
    return _normalize_form(data)