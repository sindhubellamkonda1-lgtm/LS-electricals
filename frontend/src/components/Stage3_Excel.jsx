// Stage3_Excel.jsx
import { useState } from 'react';
import {
  Upload, Button, Card, Typography, Alert, Spin, Tag, Space
} from 'antd';
import {
  InboxOutlined, FileExcelOutlined, CheckCircleFilled,
  ArrowLeftOutlined, ThunderboltOutlined
} from '@ant-design/icons';

const { Dragger } = Upload;
const { Title, Text } = Typography;
const API = 'https://ls-electricals-api.onrender.com';

export default function Stage3_Excel({ editedJson, onDone, onBack }) {
  const [excelFile, setExcelFile] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // ── Read display fields from the form shape Stage1_Upload produces ──────────
  // editedJson is the raw react-hook-form output (camelCase, from onDone(data))
  const feederName = editedJson?.page2Header?.feederName || 'Site';
  const company    = editedJson?.page2Header?.companyName
                  || editedJson?.companyNameAddress
                  || '';

  const draggerProps = {
    name: 'file',
    accept: '.xlsx,.xls',
    multiple: false,
    beforeUpload: (file) => {
      setExcelFile(file);
      setError(null);
      return false;          // prevent antd auto-upload
    },
    onRemove: () => setExcelFile(null),
    fileList: excelFile ? [excelFile] : [],
  };

  const handleGenerate = async () => {
    if (!excelFile) {
      setError('Please upload the PQ Analyser Excel file first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fd = new FormData();

      // ── NEW API shape: form_data (JSON string) + excel_file ──────────────
      fd.append('form_data', JSON.stringify(editedJson));
      fd.append('excel_file', excelFile);

      const res = await fetch(`${API}/generate-preview/`, {
        method: 'POST',
        body: fd,
      });

      if (!res.ok) {
        // Try to extract the FastAPI detail string
        let msg = `Server error ${res.status}`;
        try {
          const body = await res.json();
          // FastAPI wraps errors as { detail: "..." } or { detail: [{...}] }
          if (typeof body.detail === 'string') {
            msg = body.detail;
          } else if (Array.isArray(body.detail)) {
            msg = body.detail.map(e => `${e.loc?.join('.')}: ${e.msg}`).join('\n');
          } else {
            msg = JSON.stringify(body);
          }
        } catch (_) {
          // response wasn't JSON — use status text
          msg = res.statusText || msg;
        }
        throw new Error(msg);
      }

      const results = await res.json();
      onDone(results, excelFile);

    } catch (err) {
      // err.message is always a plain string here
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stage-container">
      <Card className="stage-card" bordered={false}>
        <Title level={4} style={{ marginBottom: 4 }}>
          <FileExcelOutlined style={{ marginRight: 8, color: '#217346' }} />
          Upload PQ Analyser Trend Data
        </Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          Upload the raw export from the power quality analyser. It must contain the
          <Tag color="blue" style={{ margin: '0 4px' }}>Trend 3 s</Tag> and
          <Tag color="blue" style={{ margin: '0 4px' }}>Trend 3 s A h f</Tag> sheets.
        </Text>

        {/* Site JSON ready banner */}
        <div className="locked-json-banner">
          <CheckCircleFilled style={{ color: '#52c41a', marginRight: 8 }} />
          <Text>
            <strong>Site JSON ready:</strong>&nbsp;
            {company && <><Tag color="geekblue">{company}</Tag>&nbsp;</>}
            Feeder: <Tag color="purple">{feederName}</Tag>
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
              (using your reviewed data from Stage 2)
            </Text>
          </Text>
        </div>

        <Dragger {...draggerProps} style={{ padding: '20px 0', marginTop: 20 }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#217346', fontSize: 48 }} />
          </p>
          <p className="ant-upload-text">Click or drag PQ Analyser Excel export here</p>
          <p className="ant-upload-hint">
            Accepts .xlsx files. This is the raw trend export, not the generated report.
          </p>
        </Dragger>

        {/* Error display — always shows the string message, never [object Object] */}
        {error && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}
            message="Report generation failed"
            description={error}
          />
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
          <Button size="large" icon={<ArrowLeftOutlined />} onClick={onBack} disabled={loading}>
            Back
          </Button>

          <Button
            type="primary"
            size="large"
            icon={loading ? <Spin size="small" /> : <ThunderboltOutlined />}
            onClick={handleGenerate}
            disabled={loading || !excelFile}
            style={{ minWidth: 200, background: '#1a5f9e' }}
          >
            {loading ? 'Generating Report…' : 'Generate Report'}
          </Button>
        </div>
      </Card>
    </div>
  );
}