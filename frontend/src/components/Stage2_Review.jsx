// Stage2_Review.jsx
import { useState } from 'react';
import {
  Card, Form, Input, InputNumber, Switch, Button, Table, Select,
  Typography, Space, Row, Col, Divider, Tag, Tooltip
} from 'antd';
import {
  ArrowRightOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

// ── Deep-clone helper ─────────────────────────────────────────────────────────
const clone = (obj) => JSON.parse(JSON.stringify(obj ?? {}));

// ── Safe nested getter ────────────────────────────────────────────────────────
const get = (obj, ...keys) => keys.reduce((o, k) => (o ?? {})[k], obj);

export default function Stage2_Review({ json, onChange, onNext, onBack }) {
  const [data, setData] = useState(() => clone(json));

  // ── Generic updater — writes a value at a given key path into data ──────────
  const update = (path, value) => {
    const next = clone(data);
    const parts = path.split('.');
    let cur = next;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] === undefined || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    setData(next);
    onChange(next);
  };

  // ── Site measurements shorthand ───────────────────────────────────────────────
  const sm = (subpath) => `site_measurements.0.${subpath}`;

  // ── Site measurements value accessor ─────────────────────────────────────────
  const smVal = (...keys) => {
    const sm0 = (data.site_measurements ?? [])[0] ?? {};
    return get(sm0, ...keys);
  };

  // ── Switching sequence state ──────────────────────────────────────────────────
  const getSeq = () => ((data.site_measurements ?? [])[0] ?? {}).capacitor_switching_sequence ?? [];
  const setSeq = (seq) => {
    const next = clone(data);
    if (!next.site_measurements) next.site_measurements = [{}];
    next.site_measurements[0].capacitor_switching_sequence = seq;
    setData(next);
    onChange(next);
  };

  const addRow = () => setSeq([...getSeq(), { from: '', to: '', status: 'ON' }]);
  const delRow = (idx) => setSeq(getSeq().filter((_, i) => i !== idx));
  const updateRow = (idx, field, val) => {
    const seq = clone(getSeq());
    seq[idx][field] = val;
    setSeq(seq);
  };

  // ── Section card style ────────────────────────────────────────────────────────
  const sectionCard = (icon, title, content) => (
    <Card
      key={title}
      size="small"
      className="review-card"
      title={<span style={{ fontWeight: 600 }}>{icon} {title}</span>}
      style={{ marginBottom: 16 }}
      bordered
    >
      {content}
    </Card>
  );

  const Field = ({ label, path, type = 'text', suffix, tooltip, min, step }) => {
    const currentVal = path.startsWith('site_measurements.0.')
      ? smVal(...path.replace('site_measurements.0.', '').split('.'))
      : get(data, ...path.split('.'));

    const handleChange = (val) => update(path, val);

    return (
      <Form.Item
        label={
          tooltip
            ? <Space size={4}>{label}<Tooltip title={tooltip}><InfoCircleOutlined style={{ color: '#aaa' }} /></Tooltip></Space>
            : label
        }
        style={{ marginBottom: 12 }}
      >
        {type === 'number' ? (
          <InputNumber
            value={currentVal ?? ''}
            onChange={handleChange}
            min={min ?? 0}
            step={step ?? 1}
            style={{ width: '100%' }}
            addonAfter={suffix}
          />
        ) : type === 'switch' ? (
          <Switch
            checked={!!currentVal}
            onChange={handleChange}
            checkedChildren="Yes"
            unCheckedChildren="No"
          />
        ) : (
          <Input
            value={currentVal ?? ''}
            onChange={(e) => handleChange(e.target.value)}
            addonAfter={suffix}
          />
        )}
      </Form.Item>
    );
  };

  // ── Switching sequence columns ────────────────────────────────────────────────
  const seqColumns = [
    {
      title: 'From (HH:MM:SS)',
      dataIndex: 'from',
      render: (val, _, idx) => (
        <Input size="small" value={val ?? ''} onChange={e => updateRow(idx, 'from', e.target.value)} placeholder="10:20:00" />
      ),
    },
    {
      title: 'To (HH:MM:SS)',
      dataIndex: 'to',
      render: (val, _, idx) => (
        <Input size="small" value={val ?? ''} onChange={e => updateRow(idx, 'to', e.target.value)} placeholder="10:22:00" />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 120,
      render: (val, _, idx) => (
        <Select size="small" value={val ?? 'ON'} onChange={v => updateRow(idx, 'status', v)} style={{ width: '100%' }}>
          <Option value="ON"><Tag color="green">ON</Tag></Option>
          <Option value="OFF"><Tag color="red">OFF</Tag></Option>
        </Select>
      ),
    },
    {
      title: '',
      width: 48,
      render: (_, __, idx) => (
        <Button danger size="small" icon={<DeleteOutlined />} onClick={() => delRow(idx)} />
      ),
    },
  ];

  return (
    <div className="stage-container">
      <Title level={4} style={{ marginBottom: 20 }}>
        Review & Edit Extracted Data
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        All fields below were extracted from the PDF by GPT-4.1. Correct any errors before generating the report.
        Fields marked <span style={{ color: '#e53935' }}>★</span> directly affect calculations.
      </Text>

      <Form layout="vertical">

        {/* ── Section 1: Site & Company ─────────────────────── */}
        {sectionCard('📋', 'Site & Company Info', (
          <Row gutter={16}>
            <Col span={12}>
              <Field label={<>Feeder Name <span style={{ color: '#e53935' }}>★</span></>}
                     path={sm('feeder_name')} tooltip="Used in every sheet of the report" />
              <Field label="Recording Date" path={sm('date')} />
            </Col>
            <Col span={12}>
              <Field label="Company Name" path="1_company_details.company_name" />
              <Field label="Location / Address" path="1_company_details.address_or_location" />
              <Field label="Contact Person" path="1_company_details.contact_person" />
            </Col>
          </Row>
        ))}

        {/* ── Section 2: Electricity Details ───────────────── */}
        {sectionCard('⚡', 'Electricity Details', (
          <Row gutter={16}>
            <Col span={12}>
              <Field label="Contract Demand" path="2_electricity_details.contract_demand_kva_kw" suffix="kVA" />
              <Field label="Billed Demand" path="2_electricity_details.billed_demand_kva_kw" suffix="kVA" />
            </Col>
            <Col span={12}>
              <Field label={<>Min PF Required <span style={{ color: '#e53935' }}>★</span></>}
                     path="2_electricity_details.minimum_pf_required_by_seb"
                     tooltip="Shown as reference line on Power Factor Trend graph" />
              <Field label="Average Power Factor" path="2_electricity_details.average_power_factor" />
            </Col>
          </Row>
        ))}

        {/* ── Section 3: Transformer Nameplate ─────────────── */}
        {sectionCard('🔧', 'Transformer Nameplate Details', (
          <Row gutter={16}>
            <Col span={8}>
              <Field label={<>Rating <span style={{ color: '#e53935' }}>★</span></>}
                     path={sm('transformer_nameplate_details.rating_kva')}
                     type="number" suffix="kVA"
                     tooltip="Used for transformer capacity and loading calculation" />
              <Field label={<>Impedance % <span style={{ color: '#e53935' }}>★</span></>}
                     path={sm('transformer_nameplate_details.impedance_percent')}
                     type="number" suffix="%" min={0} step={0.1}
                     tooltip="Used for short-circuit current calculation" />
            </Col>
            <Col span={8}>
              <Field label={<>HV Voltage <span style={{ color: '#e53935' }}>★</span></>}
                     path={sm('transformer_nameplate_details.voltage_level.hv')}
                     tooltip="e.g. 11kV" />
              <Field label={<>LV Voltage <span style={{ color: '#e53935' }}>★</span></>}
                     path={sm('transformer_nameplate_details.voltage_level.lv')}
                     tooltip="e.g. 433V — used to calculate full-load amps" />
            </Col>
            <Col span={8}>
              <Field label="Vector Group" path={sm('transformer_nameplate_details.vector_group')} />
              <Field label={<>LV Full Load Amps <span style={{ color: '#e53935' }}>★</span></>}
                     path={sm('transformer_nameplate_details.hv_lv_amps.lv_amps')}
                     type="number" suffix="A"
                     tooltip="Nameplate LV full-load amps — used for loading %" />
            </Col>
          </Row>
        ))}

        {/* ── Section 4: Capacitor Bank ─────────────────────── */}
        {sectionCard('🔋', 'Capacitor Bank Details', (
          <Row gutter={16}>
            <Col span={6}>
              <Field label={<>Rating <span style={{ color: '#e53935' }}>★</span></>}
                     path={sm('capacitor_bank_details.rating_kvar')}
                     type="number" suffix="kVAr"
                     tooltip="Shown in Measuring Points sheet" />
            </Col>
            <Col span={6}>
              <Field label="Number of Steps" path={sm('capacitor_bank_details.number_of_steps')} type="number" />
            </Col>
            <Col span={6}>
              <Field label={<>kVAr ON Condition</>}
                     path={sm('capacitor_bank_details.kvar_on_condition')}
                     type="number" suffix="kVAr" />
            </Col>
            <Col span={6}>
              <Form.Item label={<>Reactors Present <span style={{ color: '#e53935' }}>★</span></>} style={{ marginBottom: 12 }}>
                <Switch
                  checked={!!smVal('capacitor_bank_details', 'reactors_present')}
                  onChange={(v) => update(sm('capacitor_bank_details.reactors_present'), v)}
                  checkedChildren="Yes"
                  unCheckedChildren="No"
                />
              </Form.Item>
            </Col>
          </Row>
        ))}

        {/* ── Section 5: Timing & Switching Sequence ────────── */}
        {sectionCard('⏱', 'Recording Window & Capacitor Switching Sequence', (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Field label={<>Recording Start <span style={{ color: '#e53935' }}>★</span></>}
                       path={sm('timing.start')}
                       tooltip="e.g. 10:00:00 — sets the analysis window" />
              </Col>
              <Col span={12}>
                <Field label={<>Recording End <span style={{ color: '#e53935' }}>★</span></>}
                       path={sm('timing.end')}
                       tooltip="e.g. 14:00:00" />
              </Col>
            </Row>

            <Divider orientation="left" plain style={{ marginBottom: 12 }}>
              Switching Events <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                (used to identify ON/OFF windows for analysis)
              </Text>
            </Divider>

            <Table
              dataSource={getSeq().map((r, i) => ({ ...r, key: i }))}
              columns={seqColumns}
              pagination={false}
              size="small"
              bordered
              style={{ marginBottom: 12 }}
              locale={{ emptyText: 'No switching events — add at least one ON and one OFF event' }}
            />

            <Button icon={<PlusOutlined />} onClick={addRow} size="small">
              Add Switching Event
            </Button>
          </>
        ))}

      </Form>

      {/* ── Navigation ───────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <Button size="large" icon={<ArrowLeftOutlined />} onClick={onBack}>
          Back
        </Button>
        <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={onNext}>
          Looks Good — Next
        </Button>
      </div>
    </div>
  );
}
