import React, { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const auditSchema = z.object({
  companyNameAddress: z.string().min(1, "Required"),
  contactPerson: z.string().min(1, "Required"),
  designation: z.string().min(1, "Required"),
  phoneNumber: z.string().min(1, "Required"),
  email: z.string().email("Invalid email address"),
  additionalEmails: z.array(z.object({ value: z.string().email("Invalid email").or(z.literal("")) })).optional(),
  electricityDetails: z.array(
    z.object({
      sourceOfSupply: z.enum(["EB", "TG", "DG"], { message: "Select source" }),
      contractDemand: z.string(),
      billedDemand: z.string(),
      minPfRequired: z.string(),
      averagePowerFactor: z.string(),
    })
  ).min(1),
  facilityDetails: z.object({
    transformer: z.object({ nos: z.string(), rating: z.string() }),
    dgTg:        z.object({ nos: z.string(), rating: z.string() }),
    capacitors:  z.object({ nos: z.string(), rating: z.string() }),
    pccs:        z.object({ nos: z.string(), rating: z.string() }),
    mccs:        z.object({ nos: z.string(), rating: z.string() }),
  }),
  nonLinearLoads: z.object({
    totalPresentKW: z.string(),
    thyristorsVFD:  z.object({ present: z.boolean(), kw: z.string() }),
    furnace:        z.object({ present: z.boolean(), kw: z.string() }),
    ups:            z.object({ present: z.boolean(), kva: z.string() }),
    weldingLoads:   z.object({ present: z.boolean(), value: z.string(), unit: z.string() }),
    others:         z.object({ present: z.boolean(), kwKva: z.string(), unit: z.string(), description: z.string() }),
  }),
  totalConnectedLoadKW: z.string(),
  operatingPattern: z.object({ constantKW: z.string(), varyingKW: z.string() }),
  ammetersPresent: z.string(),
  shutdownAvailability: z.object({
    available:        z.string().optional(),
    possibleTimeMins: z.string().optional(),
  }),
  problemsFaced: z.object({
    capacitorFailure:        z.boolean().optional(),
    drivesFailure:           z.boolean().optional(),
    electronicCardsFailure:  z.boolean().optional(),
    nuisanceTripping:        z.boolean().optional(),
    flickerObservance:       z.boolean().optional(),
    overheating:             z.boolean().optional(),
    others: z.object({
      present:     z.boolean().optional(),
      description: z.string().optional(),
    }).optional(),
  }),
  page2Header: z.object({
    companyName: z.string().optional(),
    date:        z.string().optional(),
    feederName:  z.string().optional(),
    fileName:    z.string().optional(),
  }),
  overallTiming: z.object({
    enabled: z.boolean().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
  }).optional(),
  timingDetails: z.array(z.object({ col1: z.string(), col2: z.string(), capStatus: z.string() })),
  capacitorBankDetails: z.object({
    rating:           z.string().optional(),
    noOfSteps:        z.string().optional(),
    reactors:         z.string().optional(),
    kvarOn:           z.string().optional(),
    downLevelDetails: z.string().optional(),
  }),
  transformerNamePlate: z.object({
    rating:       z.string().optional(),
    impedance:    z.string().optional(),
    voltageLevel: z.string().optional(),
    vectorGroup:  z.string().optional(),
    hvLvAmps:     z.string().optional(),
  }),
});

const DEFAULT_VALUES = {
  companyNameAddress: "",
  contactPerson:      "",
  designation:        "",
  phoneNumber:        "",
  email:              "",
  additionalEmails:   [],
  electricityDetails: [{
    sourceOfSupply:   "EB",
    contractDemand:   "",
    billedDemand:     "",
    minPfRequired:    "",
    averagePowerFactor: "",
  }],
  facilityDetails: {
    transformer: { nos: "", rating: "" },
    dgTg:        { nos: "", rating: "" },
    capacitors:  { nos: "", rating: "" },
    pccs:        { nos: "", rating: "" },
    mccs:        { nos: "", rating: "" },
  },
  nonLinearLoads: {
    totalPresentKW: "",
    thyristorsVFD:  { present: false, kw: "" },
    furnace:        { present: false, kw: "" },
    ups:            { present: false, kva: "" },
    weldingLoads:   { present: false, value: "", unit: "kW" },
    others:         { present: false, kwKva: "", unit: "kW", description: "" },
  },
  totalConnectedLoadKW: "",
  operatingPattern: { constantKW: "", varyingKW: "" },
  ammetersPresent:  "",
  shutdownAvailability: { available: "", possibleTimeMins: "" },
  problemsFaced: {
    capacitorFailure:       false,
    drivesFailure:          false,
    electronicCardsFailure: false,
    nuisanceTripping:       false,
    flickerObservance:      false,
    overheating:            false,
    others: { present: false, description: "" },
  },
  page2Header: { companyName: "", date: "", feederName: "", fileName: "" },
  overallTiming: { enabled: false, start: "", end: "" },
  timingDetails: [{ col1: "", col2: "", capStatus: "" }],
  capacitorBankDetails: {
    rating: "", noOfSteps: "", reactors: "", kvarOn: "", downLevelDetails: "",
  },
  transformerNamePlate: {
    rating: "", impedance: "", voltageLevel: "", vectorGroup: "", hvLvAmps: "",
  },
};

const styles = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .pqa-wrap { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F7F8FA; min-height: 100vh; color: #111827; font-size: 14px; }
  .pqa-step-pills { display: flex; gap: 6px; }
  .pqa-step-pill { display: flex; align-items: center; gap: 7px; padding: 5px 12px 5px 8px; border-radius: 100px; font-size: 12px; font-weight: 500; border: 1px solid #E5E7EB; background: #fff; color: #9CA3AF; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
  .pqa-step-pill.active { background: #EFF6FF; border-color: #BFDBFE; color: #1D4ED8; }
  .pqa-step-pill.done { background: #F0FDF4; border-color: #BBF7D0; color: #15803D; }
  .pqa-step-badge { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; background: #E5E7EB; color: #6B7280; }
  .pqa-step-pill.active .pqa-step-badge { background: #1D4ED8; color: #fff; }
  .pqa-step-pill.done .pqa-step-badge { background: #16A34A; color: #fff; }
  .pqa-page { max-width: 860px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
  .pqa-page-title { font-size: 20px; font-weight: 600; color: #111827; letter-spacing: -0.02em; margin: 0 0 4px; }
  .pqa-page-sub { font-size: 13px; color: #6B7280; margin: 0 0 28px; }
  .pqa-card { background: #fff; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; margin-bottom: 20px; }
  .pqa-card-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid #F3F4F6; }
  .pqa-card-head-left { display: flex; align-items: center; gap: 10px; }
  .pqa-card-head-icon { width: 30px; height: 30px; border-radius: 8px; background: #EFF6FF; border: 1px solid #DBEAFE; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #1D4ED8; flex-shrink: 0; }
  .pqa-card-head-title { font-size: 14px; font-weight: 600; color: #111827; }
  .pqa-card-head-sub { font-size: 12px; color: #9CA3AF; margin-top: 1px; }
  .pqa-card-body { padding: 20px; }
  .pqa-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .pqa-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  @media (max-width: 640px) { .pqa-grid-2, .pqa-grid-3 { grid-template-columns: 1fr; } .pqa-page { padding: 1rem 1rem 4rem; } }
  .pqa-field { display: flex; flex-direction: column; gap: 5px; }
  .pqa-label { font-size: 12px; font-weight: 500; color: #374151; letter-spacing: 0.01em; }
  .pqa-input, .pqa-select, .pqa-textarea { border: 1px solid #D1D5DB; border-radius: 8px; padding: 8px 11px; font-size: 13.5px; color: #111827; background: #fff; outline: none; transition: border-color 0.15s, box-shadow 0.15s; width: 100%; font-family: inherit; }
  .pqa-input:hover, .pqa-select:hover { border-color: #9CA3AF; }
  .pqa-input:focus, .pqa-select:focus, .pqa-textarea:focus { border-color: #3B82F6; box-shadow: 0 0 0 3px rgba(59,130,246,0.12); }
  .pqa-input.error { border-color: #EF4444; background: #FFF8F8; }
  .pqa-err { font-size: 11px; color: #DC2626; font-weight: 500; }
  .pqa-select { appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; padding-right: 30px; }
  .pqa-textarea { resize: vertical; min-height: 90px; line-height: 1.5; }
  .pqa-source-block { border: 1px solid #E5E7EB; border-radius: 10px; overflow: hidden; background: #FAFAFA; }
  .pqa-source-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; background: #F9FAFB; border-bottom: 1px solid #E5E7EB; }
  .pqa-source-label { font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; }
  .pqa-source-body { padding: 16px; }
  .pqa-radio-pills { display: flex; gap: 6px; }
  .pqa-radio-pill input[type=radio] { display: none; }
  .pqa-radio-pill label { padding: 5px 14px; border-radius: 100px; border: 1px solid #E5E7EB; font-size: 12px; font-weight: 600; color: #6B7280; cursor: pointer; transition: all 0.12s; background: #fff; display: block; }
  .pqa-radio-pill input[type=radio]:checked + label { background: #1D4ED8; border-color: #1D4ED8; color: #fff; }
  .pqa-table { width: 100%; border-collapse: collapse; }
  .pqa-table th { font-size: 11px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.05em; padding: 8px 12px; background: #F9FAFB; border-bottom: 1px solid #E5E7EB; text-align: left; }
  .pqa-table td { padding: 0; border-bottom: 1px solid #F3F4F6; }
  .pqa-table td.desc { padding: 10px 14px; font-size: 13px; color: #374151; font-weight: 500; background: #FAFAFA; border-right: 1px solid #F3F4F6; width: 45%; }
  .pqa-table td input { width: 100%; border: none; outline: none; padding: 10px 12px; font-size: 13px; background: transparent; color: #111827; font-family: inherit; transition: background 0.1s; }
  .pqa-table td input:hover { background: #F9FAFB; }
  .pqa-table td input:focus { background: #EFF6FF; box-shadow: inset 0 0 0 1px #BFDBFE; }
  .pqa-table td.b-left { border-left: 1px solid #F3F4F6; }
  .pqa-table tbody tr:last-child td { border-bottom: none; }
  .pqa-table tbody tr:hover td.desc { background: #F3F4F6; }
  .pqa-check-row { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 8px; transition: background 0.1s; cursor: pointer; }
  .pqa-check-row:hover { background: #F9FAFB; }
  .pqa-check-row input[type=checkbox] { width: 15px; height: 15px; border-radius: 4px; accent-color: #1D4ED8; flex-shrink: 0; cursor: pointer; }
  .pqa-check-row label { font-size: 13px; color: #374151; cursor: pointer; }
  .pqa-nl-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; border: 1px solid #F3F4F6; background: #FAFAFA; margin-bottom: 8px; gap: 10px; }
  .pqa-nl-left { display: flex; align-items: center; gap: 9px; flex: 1; }
  .pqa-nl-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .pqa-nl-input { width: 88px !important; text-align: right; }
  .pqa-nl-expanded { padding: 10px 12px 12px 36px; border-top: 1px solid #F3F4F6; background: #F9FAFB; }
  .pqa-unit-toggle { display: flex; border: 1px solid #E5E7EB; border-radius: 6px; overflow: hidden; }
  .pqa-unit-toggle button { padding: 5px 10px; font-size: 11px; font-weight: 600; border: none; background: #fff; color: #6B7280; cursor: pointer; transition: all 0.12s; font-family: inherit; }
  .pqa-unit-toggle button.active { background: #1D4ED8; color: #fff; }
  .pqa-shutdown-row { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
  .pqa-radio-inline { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #374151; cursor: pointer; }
  .pqa-radio-inline input { accent-color: #1D4ED8; width: 15px; height: 15px; }
  .pqa-timing-row td { border-bottom: 1px solid #F3F4F6; }
  .pqa-timing-row:last-child td { border-bottom: none; }
  .pqa-timing-rm { background: none; border: none; cursor: pointer; color: #D1D5DB; font-size: 16px; padding: 6px 10px; border-radius: 6px; transition: all 0.12s; line-height: 1; }
  .pqa-timing-rm:hover { background: #FEE2E2; color: #DC2626; }
  .pqa-btn-ghost { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 7px; border: 1px solid #E5E7EB; background: #fff; font-size: 12px; font-weight: 600; color: #374151; cursor: pointer; transition: all 0.12s; font-family: inherit; white-space: nowrap; }
  .pqa-btn-ghost:hover { background: #F9FAFB; border-color: #D1D5DB; }
  .pqa-btn-primary { display: inline-flex; align-items: center; gap: 7px; padding: 10px 24px; border-radius: 9px; border: none; background: #1D4ED8; font-size: 14px; font-weight: 600; color: #fff; cursor: pointer; transition: all 0.12s; font-family: inherit; letter-spacing: -0.01em; }
  .pqa-btn-primary:hover { background: #1E40AF; }
  .pqa-btn-primary:active { transform: scale(0.97); }
  .pqa-btn-back { display: inline-flex; align-items: center; gap: 7px; padding: 10px 20px; border-radius: 9px; border: 1px solid #E5E7EB; background: #fff; font-size: 14px; font-weight: 600; color: #374151; cursor: pointer; transition: all 0.12s; font-family: inherit; }
  .pqa-btn-back:hover { background: #F9FAFB; }
  .pqa-rm-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; border: 1px solid #FECACA; background: #FFF8F8; font-size: 11px; font-weight: 600; color: #DC2626; cursor: pointer; transition: all 0.12s; font-family: inherit; }
  .pqa-rm-btn:hover { background: #FEE2E2; border-color: #FCA5A5; }
  .pqa-footer { display: flex; align-items: center; justify-content: space-between; padding: 20px 0 0; border-top: 1px solid #E5E7EB; margin-top: 8px; }
  .pqa-footer-right { display: flex; align-items: center; gap: 10px; }
  .pqa-footer-hint { font-size: 12px; color: #9CA3AF; }
  .pqa-info-stripe { background: #EFF6FF; border: 1px solid #DBEAFE; border-radius: 9px; padding: 12px 16px; font-size: 13px; color: #1E40AF; display: flex; align-items: flex-start; gap: 9px; margin-bottom: 16px; }
  .pqa-divider { height: 1px; background: #F3F4F6; margin: 20px 0; }
  .pqa-spec-table { width: 100%; border-collapse: collapse; }
  .pqa-spec-table td { padding: 0; border-bottom: 1px solid #F3F4F6; }
  .pqa-spec-table tbody tr:last-child td { border-bottom: none; }
  .pqa-spec-table td.spec-label { padding: 10px 14px; font-size: 13px; color: #374151; font-weight: 500; background: #FAFAFA; border-right: 1px solid #F3F4F6; width: 55%; }
  .pqa-spec-table td input { width: 100%; border: none; outline: none; padding: 10px 12px; font-size: 13px; background: transparent; color: #111827; font-family: inherit; transition: background 0.1s; }
  .pqa-spec-table td input:hover { background: #F9FAFB; }
  .pqa-spec-table td input:focus { background: #EFF6FF; box-shadow: inset 0 0 0 1px #BFDBFE; }
  .pqa-email-row { display: flex; align-items: center; gap: 8px; }
  .pqa-email-row .pqa-input { flex: 1; }
  .pqa-add-email-btn { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 6px; border: 1px dashed #BFDBFE; background: #EFF6FF; font-size: 11px; font-weight: 600; color: #1D4ED8; cursor: pointer; transition: all 0.12s; font-family: inherit; margin-top: 6px; }
  .pqa-add-email-btn:hover { background: #DBEAFE; border-color: #93C5FD; }
  .pqa-cap-toggle { display: flex; gap: 4px; }
  .pqa-cap-btn { padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 5px; border: 1.5px solid #E5E7EB; background: #fff; color: #6B7280; cursor: pointer; transition: all 0.12s; font-family: inherit; letter-spacing: 0.02em; }
  .pqa-cap-btn.on { background: #DCFCE7; border-color: #86EFAC; color: #15803D; }
  .pqa-cap-btn.off { background: #FEE2E2; border-color: #FCA5A5; color: #DC2626; }
  .pqa-overall-timing { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; padding: 14px 18px; margin-bottom: 0; }
  .pqa-overall-timing-head { display: flex; align-items: center; gap: 10px; margin-bottom: 0; }
  .pqa-overall-timing-body { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
  .pqa-validation-banner { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 9px; padding: 12px 16px; font-size: 13px; color: #DC2626; display: flex; align-items: flex-start; gap: 9px; margin-bottom: 16px; }
`;

export default function Stage1_Upload({ onDone }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  // Local state for unit toggles (not tied to RHF to avoid complexity)
  const [weldingUnit, setWeldingUnit] = useState("kW");
  const [othersUnit, setOthersUnit] = useState("kW");
  // Cap status per timing row (keyed by row index)
  const [capStatus, setCapStatus] = useState({});
  // Overall timing toggle
  const [overallTimingEnabled, setOverallTimingEnabled] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(auditSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const { fields: electricityFields, append: appendElectricity, remove: removeElectricity } =
    useFieldArray({ control, name: "electricityDetails" });
  const { fields: timingFields, append: appendTiming, remove: removeTiming } =
    useFieldArray({ control, name: "timingDetails" });
  const { fields: additionalEmailFields, append: appendEmail, remove: removeEmail } =
    useFieldArray({ control, name: "additionalEmails" });

  const watchOtherProblems = watch("problemsFaced.others.present");
  const watchWeldingPresent = watch("nonLinearLoads.weldingLoads.present");
  const watchOthersNLPresent = watch("nonLinearLoads.others.present");

  const onSubmit = (data) => {
    // Inject local state into submitted data
    data.nonLinearLoads.weldingLoads.unit = weldingUnit;
    data.nonLinearLoads.others.unit = othersUnit;
    data.timingDetails = data.timingDetails.map((row, i) => ({
      ...row,
      capStatus: capStatus[i] || "",
    }));
    if (onDone) onDone(data);
  };

  const onInvalid = (errs) => {
    setSubmitAttempted(true);
    const step1Fields = ["companyNameAddress", "contactPerson", "designation", "phoneNumber", "email", "electricityDetails"];
    const hasStep1Error = step1Fields.some((f) => errs[f]);
    if (hasStep1Error) {
      setCurrentStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNext = () => { setCurrentStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const handlePrev = () => { setCurrentStep(1); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const toggleCapStatus = (index, status) => {
    setCapStatus(prev => ({ ...prev, [index]: prev[index] === status ? "" : status }));
  };

  const Field = ({ label, name, type = "text", error, placeholder = "" }) => (
    <div className="pqa-field">
      <label className="pqa-label">{label}</label>
      <input type={type} placeholder={placeholder} {...register(name)} className={`pqa-input${error ? " error" : ""}`} />
      {error && <span className="pqa-err">{error.message}</span>}
    </div>
  );

  const FacilityRow = ({ description, fieldName }) => (
    <tr>
      <td className="desc">{description}</td>
      <td className="b-left"><input type="text" {...register(`facilityDetails.${fieldName}.nos`)} placeholder="—" /></td>
      <td className="b-left"><input type="text" {...register(`facilityDetails.${fieldName}.rating`)} placeholder="—" /></td>
    </tr>
  );

  const SpecRow = ({ label, name }) => (
    <tr>
      <td className="spec-label">{label}</td>
      <td><input type="text" {...register(name)} placeholder="—" /></td>
    </tr>
  );

  const UnitToggle = ({ value, onChange, options }) => (
    <div className="pqa-unit-toggle">
      {options.map(opt => (
        <button key={opt} type="button" className={value === opt ? "active" : ""} onClick={() => onChange(opt)}>{opt}</button>
      ))}
    </div>
  );

  const sourceLabels = { EB: "Electricity Board", TG: "Turbo Generator", DG: "Diesel Generator" };

  const step1ErrorFields = ["companyNameAddress", "contactPerson", "designation", "phoneNumber", "email", "electricityDetails"];
  const step1ErrorCount = step1ErrorFields.filter((f) => errors[f]).length;

  return (
    <>
      <style>{styles}</style>
      <div className="pqa-wrap">
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 1.5rem", borderBottom: "1px solid #F3F4F6", background: "#fff" }}>
          <div className="pqa-step-pills">
            <div className={`pqa-step-pill ${currentStep === 1 ? "active" : "done"}`} onClick={() => setCurrentStep(1)}>
              <div className="pqa-step-badge">{currentStep > 1 ? "✓" : "1"}</div>
              Facility Specs
            </div>
            <div className={`pqa-step-pill ${currentStep === 2 ? "active" : ""}`}>
              <div className="pqa-step-badge">2</div>
              Equipment Details
            </div>
          </div>
        </div>

        <div className="pqa-page">
          <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>

            {/* ════ STEP 1 ════ */}
            {currentStep === 1 && (
              <>
                <p className="pqa-page-title">Facility Specifications</p>
                <p className="pqa-page-sub">Fill in company info, supply sources, and load details for this site.</p>

                {/* Company Details */}
                <div className="pqa-card">
                  <div className="pqa-card-head">
                    <div className="pqa-card-head-left">
                      <div className="pqa-card-head-icon">🏢</div>
                      <div>
                        <div className="pqa-card-head-title">Company Details</div>
                        <div className="pqa-card-head-sub">Primary contact &amp; organization</div>
                      </div>
                    </div>
                  </div>
                  <div className="pqa-card-body">
                    <div className="pqa-grid-2" style={{ marginBottom: 16 }}>
                      <Field label="Company Name & Address" name="companyNameAddress" error={errors.companyNameAddress} placeholder="ACME Industries, 12 Industrial Estate…" />
                      <Field label="Contact Person" name="contactPerson" error={errors.contactPerson} placeholder="Full name" />
                    </div>
                    <div className="pqa-grid-3" style={{ marginBottom: 16 }}>
                      <Field label="Designation" name="designation" error={errors.designation} placeholder="e.g. Electrical Engineer" />
                      <Field label="Phone Number" name="phoneNumber" error={errors.phoneNumber} placeholder="+91 98765 43210" />
                      {/* ── CHANGE 1: Primary email + add more ── */}
                      <div className="pqa-field">
                        <label className="pqa-label">Email Address</label>
                        <input type="email" placeholder="name@company.com" {...register("email")} className={`pqa-input${errors.email ? " error" : ""}`} />
                        {errors.email && <span className="pqa-err">{errors.email.message}</span>}
                      </div>
                    </div>
                    {/* Additional emails */}
                    {additionalEmailFields.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                        {additionalEmailFields.map((field, index) => (
                          <div key={field.id} className="pqa-email-row">
                            <input
                              type="email"
                              placeholder={`CC email ${index + 1}`}
                              {...register(`additionalEmails.${index}.value`)}
                              className="pqa-input"
                              style={{ flex: 1 }}
                            />
                            <button type="button" className="pqa-rm-btn" onClick={() => removeEmail(index)}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button type="button" className="pqa-add-email-btn" onClick={() => appendEmail({ value: "" })}>
                      + Add another email
                    </button>
                  </div>
                </div>

                {/* Power Supply Sources */}
                <div className="pqa-card">
                  <div className="pqa-card-head">
                    <div className="pqa-card-head-left">
                      <div className="pqa-card-head-icon">🔌</div>
                      <div>
                        <div className="pqa-card-head-title">Power Supply Sources</div>
                        <div className="pqa-card-head-sub">Add one block per supply source</div>
                      </div>
                    </div>
                    <button type="button" className="pqa-btn-ghost" onClick={() => appendElectricity({ sourceOfSupply: "EB", contractDemand: "", billedDemand: "", minPfRequired: "", averagePowerFactor: "" })}>
                      + Add Source
                    </button>
                  </div>
                  <div className="pqa-card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {electricityFields.map((field, index) => (
                      <div key={field.id} className="pqa-source-block">
                        <div className="pqa-source-head">
                          <span className="pqa-source-label">Source #{index + 1}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div className="pqa-radio-pills">
                              {["EB", "TG", "DG"].map(src => (
                                <div className="pqa-radio-pill" key={src}>
                                  <input type="radio" value={src} id={`src-${index}-${src}`} {...register(`electricityDetails.${index}.sourceOfSupply`)} />
                                  <label htmlFor={`src-${index}-${src}`} title={sourceLabels[src]}>{src}</label>
                                </div>
                              ))}
                            </div>
                            {electricityFields.length > 1 && (
                              <button type="button" className="pqa-rm-btn" onClick={() => removeElectricity(index)}>✕ Remove</button>
                            )}
                          </div>
                        </div>
                        <div className="pqa-source-body">
                          <div className="pqa-grid-2">
                            <Field label="Contract Demand (kVA / kW)" name={`electricityDetails.${index}.contractDemand`} />
                            <Field label="Billed Demand (kVA / kW)" name={`electricityDetails.${index}.billedDemand`} />
                            <Field label="Min PF Required by SEB" name={`electricityDetails.${index}.minPfRequired`} />
                            <Field label="Average Power Factor" name={`electricityDetails.${index}.averagePowerFactor`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Facility Equipment */}
                <div className="pqa-card">
                  <div className="pqa-card-head">
                    <div className="pqa-card-head-left">
                      <div className="pqa-card-head-icon">🏭</div>
                      <div>
                        <div className="pqa-card-head-title">Facility Equipment</div>
                        <div className="pqa-card-head-sub">Nos. &amp; ratings of key equipment</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="pqa-table" style={{ minWidth: 540 }}>
                      <thead>
                        <tr>
                          <th style={{ width: "45%" }}>Description</th>
                          <th style={{ width: "27.5%" }}>Nos.</th>
                          <th style={{ width: "27.5%" }}>Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        <FacilityRow description="Transformer (kVA)" fieldName="transformer" />
                        <FacilityRow description="DG / TG (kVA)" fieldName="dgTg" />
                        <FacilityRow description="Capacitors (kVAr – HT / LT)" fieldName="capacitors" />
                        <FacilityRow description="PCCs" fieldName="pccs" />
                        <FacilityRow description="MCCs" fieldName="mccs" />
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── CHANGE 2 & 3: Non-linear Loads with welding + others with unit toggle ── */}
                <div className="pqa-card">
                  <div className="pqa-card-head">
                    <div className="pqa-card-head-left">
                      <div className="pqa-card-head-icon">⚙️</div>
                      <div>
                        <div className="pqa-card-head-title">Non-linear Loads</div>
                        <div className="pqa-card-head-sub">Tick all that apply and enter value with unit</div>
                      </div>
                    </div>
                  </div>
                  <div className="pqa-card-body">
                    <div style={{ maxWidth: 320, marginBottom: 18 }}>
                      <Field label="Total non-linear load present (kW)" name="nonLinearLoads.totalPresentKW" placeholder="0" />
                    </div>

                    {/* Fixed-unit loads */}
                    <div className="pqa-grid-2" style={{ marginBottom: 8 }}>
                      {[
                        { label: "Thyristors / VFD", cbName: "nonLinearLoads.thyristorsVFD.present", valName: "nonLinearLoads.thyristorsVFD.kw", unit: "kW" },
                        { label: "Furnace",           cbName: "nonLinearLoads.furnace.present",       valName: "nonLinearLoads.furnace.kw",       unit: "kW" },
                        { label: "UPS",               cbName: "nonLinearLoads.ups.present",           valName: "nonLinearLoads.ups.kva",          unit: "kVA" },
                      ].map(({ label, cbName, valName, unit }) => (
                        <div className="pqa-nl-row" key={cbName}>
                          <div className="pqa-nl-left">
                            <input type="checkbox" {...register(cbName)} id={cbName} style={{ width: 15, height: 15, accentColor: "#1D4ED8", cursor: "pointer", flexShrink: 0 }} />
                            <label htmlFor={cbName} style={{ fontSize: 13, color: "#374151", cursor: "pointer" }}>{label}</label>
                          </div>
                          <div className="pqa-nl-right">
                            <input type="text" placeholder={unit} {...register(valName)} className="pqa-input pqa-nl-input" />
                            <span style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, minWidth: 28 }}>{unit}</span>
                          </div>
                        </div>
                      ))}

                      {/* Welding Loads — with kW / kVA toggle (CHANGE 3) */}
                      <div style={{ border: "1px solid #F3F4F6", borderRadius: 8, background: "#FAFAFA", overflow: "hidden", marginBottom: 0 }}>
                        <div className="pqa-nl-row" style={{ border: "none", borderRadius: 0, marginBottom: 0 }}>
                          <div className="pqa-nl-left">
                            <input type="checkbox" {...register("nonLinearLoads.weldingLoads.present")} id="welding-cb" style={{ width: 15, height: 15, accentColor: "#1D4ED8", cursor: "pointer", flexShrink: 0 }} />
                            <label htmlFor="welding-cb" style={{ fontSize: 13, color: "#374151", cursor: "pointer" }}>Welding Loads</label>
                          </div>
                          <div className="pqa-nl-right">
                            <input type="text" placeholder="Value" {...register("nonLinearLoads.weldingLoads.value")} className="pqa-input pqa-nl-input" />
                            <UnitToggle value={weldingUnit} onChange={setWeldingUnit} options={["kW", "kVA"]} />
                          </div>
                        </div>
                        {watchWeldingPresent && (
                          <div style={{ padding: "8px 12px 10px 36px", borderTop: "1px solid #F3F4F6", background: "#F9FAFB" }}>
                            <input type="text" placeholder="Describe welding equipment (e.g. MIG, TIG, Arc welders — 3 × 400A)" {...register("nonLinearLoads.weldingLoads.description")} className="pqa-input" style={{ fontSize: 12 }} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Others — with description + kW / kVA toggle (CHANGE 2) */}
                    <div style={{ border: "1px solid #F3F4F6", borderRadius: 8, background: "#FAFAFA", overflow: "hidden" }}>
                      <div className="pqa-nl-row" style={{ border: "none", borderRadius: 0, marginBottom: 0 }}>
                        <div className="pqa-nl-left">
                          <input type="checkbox" {...register("nonLinearLoads.others.present")} id="nl-others-cb" style={{ width: 15, height: 15, accentColor: "#1D4ED8", cursor: "pointer", flexShrink: 0 }} />
                          <label htmlFor="nl-others-cb" style={{ fontSize: 13, color: "#374151", cursor: "pointer" }}>Others</label>
                        </div>
                        <div className="pqa-nl-right">
                          <input type="text" placeholder="Value" {...register("nonLinearLoads.others.kwKva")} className="pqa-input pqa-nl-input" />
                          <UnitToggle value={othersUnit} onChange={setOthersUnit} options={["kW", "kVA"]} />
                        </div>
                      </div>
                      {watchOthersNLPresent && (
                        <div style={{ padding: "8px 12px 10px 36px", borderTop: "1px solid #F3F4F6", background: "#F9FAFB" }}>
                          <input type="text" placeholder="Describe other non-linear loads…" {...register("nonLinearLoads.others.description")} className="pqa-input" style={{ fontSize: 12 }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Load Characteristics */}
                <div className="pqa-card">
                  <div className="pqa-card-head">
                    <div className="pqa-card-head-left">
                      <div className="pqa-card-head-icon">📊</div>
                      <div>
                        <div className="pqa-card-head-title">Load Characteristics</div>
                        <div className="pqa-card-head-sub">Connected load &amp; operating pattern</div>
                      </div>
                    </div>
                  </div>
                  <div className="pqa-card-body">
                    <div className="pqa-grid-3">
                      <Field label="Total Connected Load (kW)" name="totalConnectedLoadKW" placeholder="0" />
                      <Field label="Constant Load (kW)" name="operatingPattern.constantKW" placeholder="0" />
                      <Field label="Varying Load (kW)" name="operatingPattern.varyingKW" placeholder="0" />
                    </div>
                  </div>
                </div>

                {/* Metering & Operations */}
                <div className="pqa-card">
                  <div className="pqa-card-head">
                    <div className="pqa-card-head-left">
                      <div className="pqa-card-head-icon">🔧</div>
                      <div>
                        <div className="pqa-card-head-title">Metering &amp; Operations</div>
                        <div className="pqa-card-head-sub">Meters present and shutdown window</div>
                      </div>
                    </div>
                  </div>
                  <div className="pqa-card-body">
                    <div style={{ marginBottom: 20 }}>
                      <Field label="Ammeters / Digital Meters on Incomer mains panel (R/Y/B CT inputs from main busbars)" name="ammetersPresent" placeholder="Describe type and presence…" />
                    </div>
                    <div className="pqa-info-stripe">
                      <span>ℹ</span>
                      <span>Shutdown availability is needed for certain diagnostic measurements. Specify even if limited.</span>
                    </div>
                    <div className="pqa-field" style={{ marginBottom: 12 }}>
                      <label className="pqa-label">Shutdown available if required?</label>
                      <div className="pqa-shutdown-row" style={{ marginTop: 6 }}>
                        <label className="pqa-radio-inline"><input type="radio" value="yes" {...register("shutdownAvailability.available")} /> Yes</label>
                        <label className="pqa-radio-inline"><input type="radio" value="no" {...register("shutdownAvailability.available")} /> No</label>
                        <div style={{ flex: 1, maxWidth: 220 }}>
                          <input type="text" placeholder="Possible window (mins)" {...register("shutdownAvailability.possibleTimeMins")} className="pqa-input" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Problems Observed */}
                <div className="pqa-card">
                  <div className="pqa-card-head">
                    <div className="pqa-card-head-left">
                      <div className="pqa-card-head-icon">⚠️</div>
                      <div>
                        <div className="pqa-card-head-title">Problems Observed</div>
                        <div className="pqa-card-head-sub">Select all issues currently or previously experienced</div>
                      </div>
                    </div>
                  </div>
                  <div className="pqa-card-body">
                    <div className="pqa-grid-2">
                      {[
                        { label: "Capacitor Failure",                          name: "problemsFaced.capacitorFailure" },
                        { label: "Drives Failure",                             name: "problemsFaced.drivesFailure" },
                        { label: "Electronic Cards Failure",                   name: "problemsFaced.electronicCardsFailure" },
                        { label: "Nuisance Tripping",                          name: "problemsFaced.nuisanceTripping" },
                        { label: "Flicker Observance",                         name: "problemsFaced.flickerObservance" },
                        { label: "Overheating of Cables / Equipment / Panels", name: "problemsFaced.overheating" },
                      ].map(({ label, name }) => (
                        <div className="pqa-check-row" key={name}>
                          <input type="checkbox" {...register(name)} id={name} />
                          <label htmlFor={name}>{label}</label>
                        </div>
                      ))}
                    </div>
                    <div className="pqa-divider" />
                    <div className="pqa-check-row">
                      <input type="checkbox" {...register("problemsFaced.others.present")} id="others-chk" />
                      <label htmlFor="others-chk" style={{ fontWeight: 500, color: "#111827" }}>Other observations / problems</label>
                    </div>
                    {watchOtherProblems && (
                      <div style={{ marginTop: 10, paddingLeft: 24 }}>
                        <textarea {...register("problemsFaced.others.description")} placeholder="Describe any additional problems or observations in detail…" className="pqa-textarea" style={{ maxWidth: 600 }} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="pqa-footer">
                  <span style={{ fontSize: 12, color: "#9CA3AF" }}>All fields marked above are required unless noted</span>
                  <div className="pqa-footer-right">
                    <button type="button" className="pqa-btn-primary" onClick={handleNext}>Continue to Step 2 →</button>
                  </div>
                </div>
              </>
            )}

            {/* ════ STEP 2 ════ */}
            {currentStep === 2 && (
              <>
                <p className="pqa-page-title">Equipment Details</p>
                <p className="pqa-page-sub">Document meta information, measurement timing, and equipment name-plate data.</p>

                {submitAttempted && step1ErrorCount > 0 && (
                  <div className="pqa-validation-banner">
                    <span>⚠</span>
                    <span>
                      {step1ErrorCount} required field{step1ErrorCount > 1 ? "s" : ""} on Step 1 need attention.{" "}
                      <button type="button" onClick={handlePrev} style={{ background: "none", border: "none", color: "#DC2626", fontWeight: 700, cursor: "pointer", padding: 0, textDecoration: "underline" }}>Go back to fix them</button>
                    </span>
                  </div>
                )}

                {/* Document Information */}
                <div className="pqa-card">
                  <div className="pqa-card-head">
                    <div className="pqa-card-head-left">
                      <div className="pqa-card-head-icon">📄</div>
                      <div>
                        <div className="pqa-card-head-title">Document Information</div>
                        <div className="pqa-card-head-sub">For report reference and filing</div>
                      </div>
                    </div>
                  </div>
                  <div className="pqa-card-body">
                    <div className="pqa-grid-2">
                      <Field label="Company Name" name="page2Header.companyName" />
                      <Field label="Date" type="date" name="page2Header.date" />
                      <Field label="Feeder Name" name="page2Header.feederName" />
                      <Field label="File Name" name="page2Header.fileName" />
                    </div>
                  </div>
                </div>

                {/* ── CHANGE 4: Measurement Timing with overall timing + cap status ── */}
                <div className="pqa-card">
                  <div className="pqa-card-head">
                    <div className="pqa-card-head-left">
                      <div className="pqa-card-head-icon">🕐</div>
                      <div>
                        <div className="pqa-card-head-title">Measurement Timing</div>
                        <div className="pqa-card-head-sub">Define time windows and capacitor bank status per slot</div>
                      </div>
                    </div>
                    <button type="button" className="pqa-btn-ghost" onClick={() => appendTiming({ col1: "", col2: "", capStatus: "" })}>
                      + Add Row
                    </button>
                  </div>

                  {/* Overall timing block */}
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", background: "#FFFDF5" }}>
                    <div className="pqa-overall-timing">
                      <div className="pqa-overall-timing-head">
                        <input
                          type="checkbox"
                          id="overall-timing-chk"
                          checked={overallTimingEnabled}
                          onChange={e => setOverallTimingEnabled(e.target.checked)}
                          style={{ width: 15, height: 15, accentColor: "#D97706", cursor: "pointer", flexShrink: 0 }}
                        />
                        <label htmlFor="overall-timing-chk" style={{ fontSize: 13, fontWeight: 600, color: "#92400E", cursor: "pointer" }}>
                          Set overall measurement window
                        </label>
                        <span style={{ fontSize: 11, color: "#B45309", marginLeft: 4 }}>(applies to entire session)</span>
                      </div>
                      {overallTimingEnabled && (
                        <div className="pqa-overall-timing-body">
                          <div className="pqa-field">
                            <label className="pqa-label" style={{ color: "#92400E" }}>Overall Start Time</label>
                            <input type="time" {...register("overallTiming.start")} className="pqa-input" />
                          </div>
                          <div className="pqa-field">
                            <label className="pqa-label" style={{ color: "#92400E" }}>Overall End Time</label>
                            <input type="time" {...register("overallTiming.end")} className="pqa-input" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: "8px 14px", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", textAlign: "left" }}>Start Time / Label</th>
                          <th style={{ padding: "8px 14px", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", textAlign: "left", borderLeft: "1px solid #F3F4F6" }}>End Time / Notes</th>
                          <th style={{ padding: "8px 14px", fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", textAlign: "center", borderLeft: "1px solid #F3F4F6", whiteSpace: "nowrap" }}>Cap. Bank Status</th>
                          <th style={{ padding: "8px 10px", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", width: 44 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {timingFields.map((field, index) => (
                          <tr key={field.id} className="pqa-timing-row">
                            <td style={{ borderBottom: "1px solid #F3F4F6" }}>
                              <input type="text" {...register(`timingDetails.${index}.col1`)} placeholder="e.g. 08:00 AM"
                                style={{ width: "100%", border: "none", outline: "none", padding: "10px 14px", fontSize: 13, background: "transparent", color: "#111827", fontFamily: "inherit" }} />
                            </td>
                            <td style={{ borderBottom: "1px solid #F3F4F6", borderLeft: "1px solid #F3F4F6" }}>
                              <input type="text" {...register(`timingDetails.${index}.col2`)} placeholder="e.g. 05:00 PM"
                                style={{ width: "100%", border: "none", outline: "none", padding: "10px 14px", fontSize: 13, background: "transparent", color: "#111827", fontFamily: "inherit" }} />
                            </td>
                            <td style={{ borderBottom: "1px solid #F3F4F6", borderLeft: "1px solid #F3F4F6", textAlign: "center", padding: "8px 12px" }}>
                              <div className="pqa-cap-toggle" style={{ justifyContent: "center" }}>
                                <button
                                  type="button"
                                  className={`pqa-cap-btn${capStatus[index] === "ON" ? " on" : ""}`}
                                  onClick={() => toggleCapStatus(index, "ON")}
                                >ON</button>
                                <button
                                  type="button"
                                  className={`pqa-cap-btn${capStatus[index] === "OFF" ? " off" : ""}`}
                                  onClick={() => toggleCapStatus(index, "OFF")}
                                >OFF</button>
                              </div>
                            </td>
                            <td style={{ borderBottom: "1px solid #F3F4F6", textAlign: "center", paddingRight: 4 }}>
                              {timingFields.length > 1 && (
                                <button type="button" className="pqa-timing-rm" onClick={() => { removeTiming(index); setCapStatus(prev => { const n = {...prev}; delete n[index]; return n; }); }} title="Remove row">✕</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ padding: "10px 16px", background: "#F9FAFB", borderTop: "1px solid #F3F4F6" }}>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>💡 Cap. Bank Status — click <strong style={{ color: "#15803D" }}>ON</strong> or <strong style={{ color: "#DC2626" }}>OFF</strong> to record capacitor bank state during each measurement window. Click again to clear.</span>
                  </div>
                </div>

                {/* Capacitor Bank + Transformer name-plates */}
                <div className="pqa-grid-2">
                  <div className="pqa-card" style={{ marginBottom: 0 }}>
                    <div className="pqa-card-head">
                      <div className="pqa-card-head-left">
                        <div className="pqa-card-head-icon">🔋</div>
                        <div>
                          <div className="pqa-card-head-title">Capacitor Bank</div>
                          <div className="pqa-card-head-sub">Name-plate details</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="pqa-spec-table">
                        <tbody>
                          <SpecRow label="Capacitor Bank Rating"                  name="capacitorBankDetails.rating" />
                          <SpecRow label="No. of Steps"                           name="capacitorBankDetails.noOfSteps" />
                          <SpecRow label="Reactors"                               name="capacitorBankDetails.reactors" />
                          <SpecRow label="kVAr ON during Capacitor ON"            name="capacitorBankDetails.kvarOn" />
                          <SpecRow label="Down-level Capacitor Details (when ON)" name="capacitorBankDetails.downLevelDetails" />
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pqa-card" style={{ marginBottom: 0 }}>
                    <div className="pqa-card-head">
                      <div className="pqa-card-head-left">
                        <div className="pqa-card-head-icon">🔄</div>
                        <div>
                          <div className="pqa-card-head-title">Transformer</div>
                          <div className="pqa-card-head-sub">Name-plate details</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="pqa-spec-table">
                        <tbody>
                          <SpecRow label="Transformer Rating" name="transformerNamePlate.rating" />
                          <SpecRow label="Impedance"          name="transformerNamePlate.impedance" />
                          <SpecRow label="Voltage Level"      name="transformerNamePlate.voltageLevel" />
                          <SpecRow label="Vector Group"       name="transformerNamePlate.vectorGroup" />
                          <SpecRow label="HV / LV Amps"       name="transformerNamePlate.hvLvAmps" />
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="pqa-footer" style={{ marginTop: 24 }}>
                  <button type="button" className="pqa-btn-back" onClick={handlePrev}>← Back</button>
                  <div className="pqa-footer-right">
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>Review before submitting</span>
                    <button type="submit" className="pqa-btn-primary">Submit &amp; Continue →</button>
                  </div>
                </div>
              </>
            )}

          </form>
        </div>
      </div>
    </>
  );
}