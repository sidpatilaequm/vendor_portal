import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Button from '../common/Button';

// Admin screen: for each report type, define which Excel column feeds which column of the real
// table(s). Talks to backend_java's /api/admin/excel-mappings/*. The 5 SAP report excels (Vendor
// Payments, Vendor Returns, Credit Notes, Invoices, Vendor Stock) are import-only for now — saving
// a mapping there does not import data or start any folder-watching yet. ASN's mapping backs a
// real, working export ("Export to Excel" on the ASN list screen, and the "Download export"
// button below) — same mapping mechanism, reverse direction.

const REPORT_TYPES = [
  { value: 'VENDOR_PAYMENTS', label: 'Vendor Payments', table: 'vendor_payments' },
  { value: 'VENDOR_RETURNS', label: 'Vendor Returns', table: 'vendor_returns' },
  { value: 'CREDIT_NOTES', label: 'Credit Notes', table: 'vendor_credit_notes' },
  { value: 'INVOICES', label: 'Invoices', table: 'vendor_invoice' },
  { value: 'VENDOR_STOCK', label: 'Vendor Stock', table: 'current_stock' },
  { value: 'ASN', label: 'Advance Shipment Notice (ASN)', table: 'asns' },
];

const NOT_MAPPED = '';

const AdminExcelMappings = () => {
  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

  const [selected, setSelected] = useState(REPORT_TYPES[0].value);
  const [statusByType, setStatusByType] = useState({}); // value -> { configured, updatedAt }

  const [targetColumns, setTargetColumns] = useState([]);
  const [sheetName, setSheetName] = useState('');
  const [headerRow, setHeaderRow] = useState(5);
  const [excelHeaders, setExcelHeaders] = useState([]); // headers seen from the last inspected file
  const [availableSheets, setAvailableSheets] = useState([]);
  const [columnMap, setColumnMap] = useState({}); // dbColumn -> excelColumn

  const [file, setFile] = useState(null);
  const [inspecting, setInspecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [alert, setAlert] = useState(null);

  const loadStatuses = useCallback(() => {
    axios.get('/api/admin/excel-mappings', { headers: authHeaders() })
      .then((res) => {
        const map = {};
        (res.data || []).forEach((m) => { map[m.reportType] = { configured: m.configured, updatedAt: m.updatedAt }; });
        setStatusByType(map);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReportType = useCallback((reportType) => {
    setLoading(true);
    setAlert(null);
    setFile(null);
    setExcelHeaders([]);
    setAvailableSheets([]);
    const headers = authHeaders();
    Promise.all([
      axios.get(`/api/admin/excel-mappings/${reportType}`, { headers }).catch(() => ({ data: null })),
      axios.get(`/api/admin/excel-mappings/${reportType}/target-columns`, { headers }).catch(() => ({ data: [] })),
    ]).then(([mRes, cRes]) => {
      const mapping = mRes.data;
      const cols = cRes.data || [];
      setTargetColumns(cols);
      setSheetName(mapping?.sheetName || '');
      setHeaderRow(mapping?.headerRow || 5);
      const cm = {};
      cols.forEach((c) => { cm[c.name] = NOT_MAPPED; });
      (mapping?.mapping || []).forEach((row) => { cm[row.dbColumn] = row.excelColumn; });
      setColumnMap(cm);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadStatuses(); }, [loadStatuses]);
  useEffect(() => { loadReportType(selected); }, [selected, loadReportType]);

  const runInspect = () => {
    if (!file) {
      setAlert({ type: 'danger', message: 'Choose a sample Excel file first.' });
      return;
    }
    setInspecting(true);
    setAlert(null);
    const form = new FormData();
    form.append('file', file);
    const params = new URLSearchParams();
    if (sheetName) params.set('sheet', sheetName);
    params.set('headerRow', String(headerRow || 5));
    axios.post(`/api/admin/excel-mappings/${selected}/inspect?${params.toString()}`, form, {
      headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
    }).then((res) => {
      setExcelHeaders(res.data.headers || []);
      setAvailableSheets(res.data.sheets || []);
      setSheetName(res.data.sheet || sheetName);
      setAlert({ type: 'success', message: `Found ${res.data.headers?.length || 0} columns in "${res.data.sheet}" at row ${headerRow}.` });
    }).catch((err) => {
      setAlert({ type: 'danger', message: err.response?.data?.message || 'Could not read that file.' });
    }).finally(() => setInspecting(false));
  };

  const setMappingFor = (dbColumn, excelColumn) => {
    setColumnMap((m) => ({ ...m, [dbColumn]: excelColumn }));
  };

  const save = () => {
    setSaving(true);
    setAlert(null);
    const mapping = Object.entries(columnMap)
      .filter(([, excelColumn]) => excelColumn)
      .map(([dbColumn, excelColumn]) => ({ dbColumn, excelColumn }));
    axios.put(`/api/admin/excel-mappings/${selected}`, {
      sheetName: sheetName || null,
      headerRow: Number(headerRow) || 5,
      mapping,
    }, { headers: { ...authHeaders(), 'Content-Type': 'application/json' } })
      .then(() => {
        setAlert({ type: 'success', message: 'Mapping saved.' });
        loadStatuses();
      })
      .catch((err) => {
        setAlert({ type: 'danger', message: err.response?.data?.message || 'Could not save this mapping.' });
      })
      .finally(() => setSaving(false));
  };

  // Every excel header we can offer in the dropdown: whatever the last inspect found, plus
  // anything already saved (so a saved mapping never disappears just because the admin hasn't
  // re-inspected a file yet this session).
  const headerOptions = Array.from(new Set([...excelHeaders, ...Object.values(columnMap).filter(Boolean)]))
    .sort((a, b) => a.localeCompare(b));

  const currentType = REPORT_TYPES.find((t) => t.value === selected);
  const mappableColumns = targetColumns.filter((c) => !c.systemManaged);
  const mappedCount = Object.values(columnMap).filter(Boolean).length;
  const headerColumns = targetColumns.filter((c) => (c.table || 'header') === 'header');
  const itemColumns = targetColumns.filter((c) => c.table === 'item');

  const downloadExport = () => {
    setDownloading(true);
    setAlert(null);
    const url = selected === 'ASN'
      ? '/api/vendor/asns/export.xlsx'
      : `/api/admin/excel-mappings/${selected}/export.xlsx`;
    axios.get(url, { headers: authHeaders(), responseType: 'blob' })
      .then((res) => {
        const objectUrl = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = objectUrl;
        link.setAttribute('download', `${selected.toLowerCase()}-export.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        setAlert({ type: 'danger', message: 'Could not generate the export — make sure the mapping is saved with at least one column.' });
      })
      .finally(() => setDownloading(false));
  };

  return (
    <div className="p-4">
      <div className="mb-3">
        <h5 className="fw-bold mb-0">Excel Column Mappings</h5>
        <div className="text-muted small">
          Which column of each SAP report excel feeds which column of the real table. Config only —
          this does not import data yet.
        </div>
      </div>

      <div className="d-flex gap-2 flex-wrap mb-4">
        {REPORT_TYPES.map((t) => {
          const status = statusByType[t.value];
          const active = selected === t.value;
          return (
            <button
              key={t.value}
              className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setSelected(t.value)}
              style={{ borderRadius: 8 }}
            >
              {t.label}
              <span
                className={`badge ms-2 ${status?.configured ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}
              >
                {status?.configured ? 'Configured' : 'Empty'}
              </span>
            </button>
          );
        })}
      </div>

      {alert && <div className={`alert alert-${alert.type} py-1.5 mb-3 small`}>{alert.message}</div>}

      {loading ? (
        <div className="text-muted small">Loading…</div>
      ) : (
        <>
          <div className="border rounded p-3 mb-4">
            <div className="fw-semibold small mb-2">1. Read a sample "{currentType.label}" excel (optional)</div>
            <div className="text-muted small mb-2">
              Only needed if you have a real file to match column names against — you can also just type the excel column name directly in step 2 below, no file required.
            </div>
            <div className="d-flex gap-2 flex-wrap align-items-end">
              <div>
                <label className="form-label small text-muted mb-1 d-block">File</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="form-control form-control-sm"
                  style={{ width: 260 }}
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </div>
              <div>
                <label className="form-label small text-muted mb-1 d-block">Sheet (optional)</label>
                {availableSheets.length > 0 ? (
                  <select className="form-select form-select-sm" style={{ width: 180 }} value={sheetName} onChange={(e) => setSheetName(e.target.value)}>
                    {availableSheets.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    style={{ width: 180 }}
                    placeholder="first sheet"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                  />
                )}
              </div>
              <div>
                <label className="form-label small text-muted mb-1 d-block">Header row</label>
                <input
                  type="number"
                  min={1}
                  className="form-control form-control-sm"
                  style={{ width: 90 }}
                  value={headerRow}
                  onChange={(e) => setHeaderRow(e.target.value)}
                />
              </div>
              <Button onClick={runInspect} disabled={inspecting}>{inspecting ? 'Reading…' : 'Read columns'}</Button>
            </div>
            <div className="form-text">
              SAP exports for this app put the real header on row 5 (title + legend rows above it) — adjust if this file is different.
            </div>
          </div>

          <div className="border rounded p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="fw-semibold small">
                2. Map "{currentType.table}" columns to excel columns
                <span className="text-muted fw-normal ms-2">({mappedCount} of {mappableColumns.length} mapped)</span>
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={downloadExport}
                  disabled={downloading || mappedCount === 0}
                  title={mappedCount === 0 ? 'Save a mapping with at least one column first' : 'Download a real export using this mapping'}
                >
                  {downloading ? 'Generating…' : 'Download export'}
                </button>
                <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save mapping'}</Button>
              </div>
            </div>
            {targetColumns.length === 0 ? (
              <div className="text-muted small">No columns found for this table.</div>
            ) : itemColumns.length === 0 ? (
              <ColumnMappingTable columns={headerColumns} columnMap={columnMap} setMappingFor={setMappingFor} headerOptions={headerOptions} />
            ) : (
              <>
                <div className="text-uppercase text-muted small fw-bold mb-1" style={{ letterSpacing: '0.03em' }}>Header</div>
                <ColumnMappingTable columns={headerColumns} columnMap={columnMap} setMappingFor={setMappingFor} headerOptions={headerOptions} />
                <div className="text-uppercase text-muted small fw-bold mb-1 mt-3" style={{ letterSpacing: '0.03em' }}>Line items</div>
                <ColumnMappingTable columns={itemColumns} columnMap={columnMap} setMappingFor={setMappingFor} headerOptions={headerOptions} />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const ColumnMappingTable = ({ columns, columnMap, setMappingFor, headerOptions }) => {
  const datalistId = React.useId();
  return (
  <div className="table-responsive mb-2">
    <table className="table table-sm align-middle">
      <thead>
        <tr>
          <th style={{ width: '35%' }}>Column</th>
          <th style={{ width: '15%' }}>Type</th>
          <th>Excel column</th>
        </tr>
      </thead>
      <tbody>
        {columns.map((c) => (
          <tr key={c.name} className={c.systemManaged ? 'text-muted' : undefined}>
            <td>
              <span className="fw-semibold" style={{ fontSize: 13 }}>{c.name}</span>
              {!c.nullable && !c.systemManaged && <span className="text-danger ms-1" title="required">*</span>}
            </td>
            <td className="text-muted small">{c.type}</td>
            <td>
              {c.systemManaged ? (
                <span className="badge bg-secondary-subtle text-secondary" title={c.systemManagedReason}>
                  <i className="fas fa-lock me-1" style={{ fontSize: 10 }} />
                  {c.systemManagedReason}
                </span>
              ) : (
                <input
                  type="text"
                  list={datalistId}
                  className="form-control form-control-sm"
                  placeholder="— not mapped — (type or pick a column name)"
                  value={columnMap[c.name] || NOT_MAPPED}
                  onChange={(e) => setMappingFor(c.name, e.target.value)}
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <datalist id={datalistId}>
      {headerOptions.map((h) => <option key={h} value={h} />)}
    </datalist>
  </div>
  );
};

export default AdminExcelMappings;
