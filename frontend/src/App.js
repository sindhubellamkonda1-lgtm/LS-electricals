// App.js — Enterprise Power Quality Report Wizard
import { useState } from 'react';
import { ConfigProvider, Steps, theme } from 'antd';
import {
  FilePdfOutlined, EditOutlined, FileExcelOutlined, BarChartOutlined
} from '@ant-design/icons';

import Stage1_Upload  from './components/Stage1_Upload';
import Stage3_Excel   from './components/Stage3_Excel';
import Stage4_Results from './components/Stage4_Results';

import logo from './assets/Sangam_logo_2025.png';
import './App.css';

const STEPS = [
  { title: 'Upload Form',    description: 'Upload details in form',    icon: <FilePdfOutlined /> },
  { title: 'Upload Excel',   description: 'PQ Analyser trend data', icon: <FileExcelOutlined /> },
  { title: 'Results',        description: 'Tables & graphs',        icon: <BarChartOutlined /> },
];

export default function App() {
  const [stage,          setStage]        = useState(0);   // 0-indexed for Steps
  const [extractedJson, setExtractedJson] = useState(null);
  const [editedJson,  setEditedJson]  = useState(null);
  const [excelFile,   setExcelFile]   = useState(null);
  const [results,     setResults]     = useState(null);

  // Triggered when Stage 1 (Form) submits
  const handleExtractDone = (json) => {
    setExtractedJson(json);
    setEditedJson(json);
    setStage(1); // Moves to Stage 3 Excel (Index 1)
  };

  // Triggered when Stage 3 (Excel) submits
  const handleGenerateDone = (res, excel) => {
    setResults(res);
    setExcelFile(excel);
    setStage(2); // Moves to Stage 4 Results (Index 2)
  };

  // Back button handlers
  const handleGenerateBack = () => setStage(0); // From Excel back to Form
  const handleResultsBack  = () => setStage(1); // From Results back to Excel

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary:    '#1a5f9e',
          borderRadius:    8,
          fontFamily:      "'Inter', 'Segoe UI', Arial, sans-serif",
        },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <div className="app-root">

        {/* ── Header ─────────────────────────────────────── */}
        <header className="app-header">
          <img src={logo} alt="LS Electrical" className="app-logo" />
          <div className="app-header-text">
            <h1>Power Quality Analyzer</h1>
            <p>Transformer &amp; Harmonic Analysis Platform</p>
          </div>
        </header>

        {/* ── Stepper ────────────────────────────────────── */}
        <div className="app-stepper">
          <Steps
            current={stage}
            items={STEPS}
            size="default"
            responsive
          />
        </div>

        {/* ── Stage content ──────────────────────────────── */}
        <main className="app-main">
          {/* Index 0: Form */}
          {stage === 0 && (
            <Stage1_Upload onDone={handleExtractDone} />
          )}
          
          {/* Index 1: Excel */}
          {stage === 1 && (
            <Stage3_Excel
              editedJson={editedJson}
              onDone={handleGenerateDone}
              onBack={handleGenerateBack}
            />
          )}
          
          {/* Index 2: Results */}
          {stage === 2 && (
            <Stage4_Results
              results={results}
              editedJson={editedJson}
              excelFile={excelFile}
              onBack={handleResultsBack}
            />
          )}
        </main>

        {/* ── Footer ─────────────────────────────────────── */}
        <footer className="app-footer">
          LS Electrical — Power Quality Report Platform &nbsp;|&nbsp; Powered by GPT-4.1
        </footer>

      </div>
    </ConfigProvider>
  );
}