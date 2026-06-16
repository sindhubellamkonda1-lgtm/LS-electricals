// Stage4_Results.jsx
import { useState } from 'react';
import {
  Tabs, Table, Button, Typography, Spin, Alert, Tag, Card, Tooltip, Modal
} from 'antd';
import {
  DownloadOutlined, ArrowLeftOutlined, CheckCircleOutlined,
  BarChartOutlined, ZoomInOutlined, FullscreenOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const API = 'http://127.0.0.1:8000';

const GRAPH_TITLES = {
  'load_curve.png':        'Load Profile',
  'thd.png':               'Current THD — Cap ON vs OFF',
  'loading.png':           'Transformer Loading (%)',
  'harmonic_spectrum.png': 'Harmonic Spectrum (Average)',
  'triangle.png':          'Power Triangle',
  'current_3phase.png':    '3-Phase Current Profile',
  'phase_imbalance.png':   'Phase Current Imbalance',
  'voltage_profile.png':   '3-Phase Voltage Profile',
  'pf_trend.png':          'Power Factor Trend',
  'kvar_trend.png':        'Reactive Power (kVAR) Trend',
  'thd_trend.png':         'Current THD Trend',
  'on_off_comparison.png': 'Capacitor ON vs OFF Comparison',
  'harmonic_on_off.png':   'Harmonic Spectrum: Cap ON vs OFF',
};

function makeColumns(rows, customRenders = {}) {
  if (!rows || rows.length === 0) return [];
  return Object.keys(rows[0])
    .filter(k => k !== 'key')
    .map(k => ({
      title: k,
      dataIndex: k,
      key: k,
      ellipsis: true,
      render: customRenders[k] ?? ((v) => {
        if (v === null || v === undefined) return <Text type="secondary">—</Text>;
        if (typeof v === 'boolean') return v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>;
        return String(v);
      }),
    }));
}

const typeRender = (v) =>
  v === 'ON'  ? <Tag color="green">ON</Tag>
  : v === 'OFF' ? <Tag color="volcano">OFF</Tag>
  : <span>{v}</span>;

export default function Stage4_Results({ results, editedJson, excelFile, onBack }) {
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError]         = useState(null);
  const [zoomGraph, setZoomGraph]     = useState(null);

  const tabs   = results?.tabs   ?? {};
  const graphs = results?.graphs ?? {};

  // ── Download Excel ─────────────────────────────────────────────────────────
  const downloadExcel = async () => {
    setDownloading(true);
    setDlError(null);
    try {
      const fd = new FormData();
      // ✅ New API: form_data (JSON string) + excel_file
      fd.append('form_data', JSON.stringify(editedJson));
      fd.append('excel_file', excelFile);

      const res = await fetch(`${API}/generate-report/`, { method: 'POST', body: fd });

      if (!res.ok) {
        let msg = `Server error ${res.status}`;
        try {
          const body = await res.json();
          if (typeof body.detail === 'string') {
            msg = body.detail;
          } else if (Array.isArray(body.detail)) {
            msg = body.detail.map(e => `${e.loc?.join('.')}: ${e.msg}`).join('\n');
          }
        } catch (_) {
          msg = res.statusText || msg;
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'Power_Quality_Report.xlsx';
      a.click();
      URL.revokeObjectURL(url);

    } catch (err) {
      setDlError(err.message || 'Download failed.');
    } finally {
      setDownloading(false);
    }
  };

  // ── Table rows ─────────────────────────────────────────────────────────────
  const mpRows = (tabs.measuring_points     ?? []).map((r, i) => ({ key: i, ...r }));
  const tlRows = (tabs.transformer_limits   ?? []).map((r, i) => ({ key: i, ...r }));
  const haRows = (tabs.harmonic_analysis    ?? []).map((r, i) => ({ key: i, ...r }));
  const ihRows = (tabs.individual_harmonics ?? []).map((r, i) => ({ key: i, ...r }));

  const mpCols = makeColumns(mpRows);
  const tlCols = makeColumns(tlRows, { Type: typeRender });
  const haCols = makeColumns(haRows, { Type: typeRender });
  const ihCols = makeColumns(ihRows, { Type: typeRender });

  const graphEntries = Object.entries(graphs);

  const GraphCard = ({ name, b64 }) => (
    <div className="graph-card" onClick={() => setZoomGraph({ name, b64 })} title="Click to zoom">
      <div className="graph-card-header">
        <span className="graph-title">{GRAPH_TITLES[name] || name.replace('.png', '')}</span>
        <ZoomInOutlined className="graph-zoom-icon" />
      </div>
      <img src={`data:image/png;base64,${b64}`} alt={name}
        style={{ width: '100%', borderRadius: 4, display: 'block' }} />
    </div>
  );

  const tabItems = [
    {
      key: 'measuring_points',
      label: '📍 Measuring Points',
      children: <Table dataSource={mpRows} columns={mpCols} pagination={false} size="small" bordered scroll={{ x: true }} />,
    },
    {
      key: 'transformer_limits',
      label: '🔧 Transformer Limits',
      children: <Table dataSource={tlRows} columns={tlCols} pagination={false} size="small" bordered scroll={{ x: true }} />,
    },
    {
      key: 'harmonic_analysis',
      label: '📊 Harmonic Analysis',
      children: <Table dataSource={haRows} columns={haCols} pagination={false} size="small" bordered scroll={{ x: true }} />,
    },
    {
      key: 'individual_harmonics',
      label: '📈 Individual Harmonics',
      children: <Table dataSource={ihRows} columns={ihCols} pagination={false} size="small" bordered scroll={{ x: true }} />,
    },
    {
      key: 'graphs',
      label: (
        <span>
          <BarChartOutlined /> Graphs
          <Tag color="blue" style={{ marginLeft: 8 }}>{graphEntries.length}</Tag>
        </span>
      ),
      children: graphEntries.length === 0 ? (
        <Text type="secondary">No graphs available.</Text>
      ) : (
        <>
          <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
            <ZoomInOutlined style={{ marginRight: 4 }} />
            Click any graph to zoom in full screen.
          </Text>
          <div className="graph-grid">
            {graphEntries.map(([name, b64]) => (
              <GraphCard key={name} name={name} b64={b64} />
            ))}
          </div>
        </>
      ),
    },
  ];

  return (
    <div className="stage-container">

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
            Report Generated Successfully
          </Title>
          <Text type="secondary">Review the results below. Download the full Excel report when ready.</Text>
        </div>
        <Tooltip title="Downloads the full formatted .xlsx report">
          <Button
            type="primary"
            size="large"
            icon={downloading ? <Spin size="small" /> : <DownloadOutlined />}
            onClick={downloadExcel}
            disabled={downloading}
            style={{ background: '#217346', borderColor: '#217346', minWidth: 200 }}
          >
            {downloading ? 'Downloading...' : 'Download Excel Report'}
          </Button>
        </Tooltip>
      </div>

      {/* Error */}
      {dlError && (
        <Alert
          type="error"
          showIcon
          message="Download failed"
          description={<pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{dlError}</pre>}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Tabs */}
      <Card bordered={false} style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <Tabs
          defaultActiveKey="measuring_points"
          items={tabItems}
          size="large"
          tabBarStyle={{ fontWeight: 500 }}
        />
      </Card>

      {/* Back */}
      <div style={{ marginTop: 20 }}>
        <Button size="large" icon={<ArrowLeftOutlined />} onClick={onBack}>
          Back to Excel Upload
        </Button>
      </div>

      {/* Zoom Modal */}
      <Modal
        open={!!zoomGraph}
        onCancel={() => setZoomGraph(null)}
        footer={[
          <Button key="dl" icon={<DownloadOutlined />}
            onClick={() => {
              if (!zoomGraph) return;
              const a = document.createElement('a');
              a.href = `data:image/png;base64,${zoomGraph.b64}`;
              a.download = zoomGraph.name;
              a.click();
            }}>
            Download PNG
          </Button>,
          <Button key="close" type="primary" onClick={() => setZoomGraph(null)}>Close</Button>,
        ]}
        title={
          <span>
            <FullscreenOutlined style={{ marginRight: 8, color: '#1a5f9e' }} />
            {zoomGraph ? (GRAPH_TITLES[zoomGraph.name] || zoomGraph.name.replace('.png', '')) : ''}
          </span>
        }
        width="90vw"
        style={{ top: 20 }}
        styles={{ body: { padding: '16px 0 0', textAlign: 'center' } }}
        destroyOnHide
      >
        {zoomGraph && (
          <img src={`data:image/png;base64,${zoomGraph.b64}`} alt={zoomGraph.name}
            style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 6 }} />
        )}
      </Modal>
    </div>
  );
}