import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

/*
 * Enterprise structure master data: company -> plant, company -> purchasing_org ->
 * purchasing_group, plant -> plant_location / storage_location -> warehouse -> storage_bin.
 * Backed by backend_java's /api/mm/* controllers — a separate table family from CompanyDetails
 * (/api/organization/companies, vendor profile data).
 *
 * View-only: this screen only lists company/plant/purchasing org+group/plant location/storage
 * location/warehouse — no create/edit/delete UI for any of them. Storage bins are the one
 * exception with any write action at all — a warehouse's bin list can still be searched and
 * individual bins deleted (opened per warehouse), but bin creation is removed too.
 */

const TABS = [
  { key: 'companies', label: 'Company', icon: 'fa-building' },
  { key: 'plants', label: 'Plant', icon: 'fa-industry' },
  { key: 'purchasingOrgs', label: 'Purchasing Org', icon: 'fa-sitemap' },
  { key: 'purchasingGroups', label: 'Purchasing Group', icon: 'fa-users' },
  { key: 'plantLocations', label: 'Plant Location', icon: 'fa-map-marker-alt' },
  { key: 'storageLocations', label: 'Storage Location', icon: 'fa-warehouse' },
  { key: 'warehouses', label: 'Warehouse', icon: 'fa-boxes-stacked' },
];

const ENDPOINTS = {
  companies: '/api/mm/companies',
  plants: '/api/mm/plants',
  purchasingOrgs: '/api/mm/purchasing-orgs',
  purchasingGroups: '/api/mm/purchasing-groups',
  plantLocations: '/api/mm/plant-locations',
  storageLocations: '/api/mm/storage-locations',
  warehouses: '/api/mm/warehouses',
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

const AdminEnterpriseStructure = () => {
  const [activeTab, setActiveTab] = useState('companies');
  const [rows, setRows] = useState({
    companies: [], plants: [], purchasingOrgs: [], purchasingGroups: [],
    plantLocations: [], storageLocations: [], warehouses: [],
  });
  const [loading, setLoading] = useState(false);

  // Bin manager — opened per warehouse from the Warehouse tab's row action.
  const [binWarehouse, setBinWarehouse] = useState(null);
  const [binEntries, setBinEntries] = useState([]);
  const [binTotal, setBinTotal] = useState(0);
  const [binOffset, setBinOffset] = useState(0);
  const [binLimit] = useState(50);
  const [binSearch, setBinSearch] = useState('');
  const [binLoading, setBinLoading] = useState(false);
  const [binAlert, setBinAlert] = useState(null);

  const fetchTab = useCallback((tabKey) => {
    setLoading(true);
    axios.get(ENDPOINTS[tabKey], { headers: authHeaders() })
      .then(({ data }) => {
        const key = Object.keys(data).find((k) => Array.isArray(data[k])) || tabKey;
        setRows((r) => ({ ...r, [tabKey]: data[key] || [] }));
      })
      .catch((err) => {
        console.error(`Failed to load ${tabKey}`, err);
        setRows((r) => ({ ...r, [tabKey]: [] }));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchTab(activeTab); }, [activeTab, fetchTab]);

  // ── Bin manager ──────────────────────────────────────────────────────

  const loadBins = useCallback((wh, offset, search) => {
    if (!wh) return;
    setBinLoading(true);
    axios.get(`/api/mm/warehouses/${wh.warehouseNo}/bins`, {
      headers: authHeaders(),
      params: { offset, limit: binLimit, search: search || undefined },
    })
      .then(({ data }) => {
        setBinEntries(data.bins || []);
        setBinTotal(data.total || 0);
        setBinOffset(offset);
      })
      .catch(() => { setBinEntries([]); setBinTotal(0); })
      .finally(() => setBinLoading(false));
  }, [binLimit]);

  const openBinManager = (wh) => {
    setBinWarehouse(wh);
    setBinSearch('');
    setBinAlert(null);
    loadBins(wh, 0, '');
  };

  const closeBinManager = () => {
    setBinWarehouse(null);
    fetchTab('warehouses'); // bin counts on the list may have changed
  };

  const deleteBin = (binCode) => {
    axios.delete(`/api/mm/warehouses/${binWarehouse.warehouseNo}/bins/${encodeURIComponent(binCode)}`, { headers: authHeaders() })
      .then(() => loadBins(binWarehouse, binOffset, binSearch))
      .catch((err) => setBinAlert({ type: 'danger', message: err.response?.data?.message || 'Could not delete this bin.' }));
  };

  const deleteAllBins = () => {
    if (!window.confirm(`Remove all ${binTotal} bins in warehouse ${binWarehouse.warehouseNo}? This cannot be undone.`)) return;
    axios.delete(`/api/mm/warehouses/${binWarehouse.warehouseNo}/bins`, { headers: authHeaders(), params: { confirm: true } })
      .then(({ data }) => {
        setBinAlert({ type: 'success', message: `Deleted ${data.deleted} bins.` });
        loadBins(binWarehouse, 0, '');
        setBinSearch('');
      })
      .catch((err) => setBinAlert({ type: 'danger', message: err.response?.data?.message || 'Could not delete these bins.' }));
  };

  // ── Table rendering ──────────────────────────────────────────────────

  const renderHeader = () => {
    switch (activeTab) {
      case 'companies':
        return <tr><th className="ps-4" style={{ width: 120 }}>Code</th><th>Name</th><th className="pe-4">GSTIN</th></tr>;
      case 'plants':
        return <tr><th className="ps-4" style={{ width: 120 }}>Code</th><th>Name</th><th>GSTIN</th><th className="pe-4">Company</th></tr>;
      case 'purchasingOrgs':
        return <tr><th className="ps-4" style={{ width: 120 }}>Code</th><th>Name</th><th className="pe-4">Company</th></tr>;
      case 'purchasingGroups':
        return <tr><th className="ps-4" style={{ width: 120 }}>Code</th><th>Name</th><th className="pe-4">Purchasing Org</th></tr>;
      case 'plantLocations':
        return <tr><th className="ps-4" style={{ width: 120 }}>Location</th><th>Name</th><th className="pe-4">Plant</th></tr>;
      case 'storageLocations':
        return <tr><th className="ps-4" style={{ width: 120 }}>Sloc</th><th>Description</th><th>Plant</th><th className="pe-4">Warehouse Managed</th></tr>;
      case 'warehouses':
        return <tr><th className="ps-4" style={{ width: 120 }}>No.</th><th>Description</th><th>Plant / Sloc</th><th>Bins</th><th className="pe-4"></th></tr>;
      default:
        return null;
    }
  };

  const renderRows = () => {
    const data = rows[activeTab] || [];
    if (loading) {
      return <tr><td colSpan="5" className="text-center py-5 text-muted"><div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>Loading…</td></tr>;
    }
    if (data.length === 0) {
      return <tr><td colSpan="5" className="text-center py-5 text-muted">No records yet.</td></tr>;
    }
    switch (activeTab) {
      case 'companies':
        return data.map((c) => (
          <tr key={c.companyCode}>
            <td className="ps-4"><code className="bg-light px-2 py-0.5 rounded text-dark fw-bold font-monospace" style={{ fontSize: 12 }}>{c.companyCode}</code></td>
            <td className="fw-semibold" style={{ fontSize: 13.5 }}>{c.companyName}</td>
            <td className="pe-4 text-muted small">{c.gstNumber || '—'}</td>
          </tr>
        ));
      case 'plants':
        return data.map((p) => (
          <tr key={p.plantCode}>
            <td className="ps-4"><code className="bg-light px-2 py-0.5 rounded text-dark fw-bold font-monospace" style={{ fontSize: 12 }}>{p.plantCode}</code></td>
            <td className="fw-semibold" style={{ fontSize: 13.5 }}>{p.plantName}</td>
            <td className="text-muted small">{p.gstNumber || '—'}</td>
            <td className="pe-4 text-muted small">{p.companyCode}</td>
          </tr>
        ));
      case 'purchasingOrgs':
        return data.map((o) => (
          <tr key={o.purchOrgCode}>
            <td className="ps-4"><code className="bg-light px-2 py-0.5 rounded text-dark fw-bold font-monospace" style={{ fontSize: 12 }}>{o.purchOrgCode}</code></td>
            <td className="fw-semibold" style={{ fontSize: 13.5 }}>{o.purchOrgName}</td>
            <td className="pe-4 text-muted small">{o.companyCode}</td>
          </tr>
        ));
      case 'purchasingGroups':
        return data.map((g) => (
          <tr key={g.purchGroupCode}>
            <td className="ps-4"><code className="bg-light px-2 py-0.5 rounded text-dark fw-bold font-monospace" style={{ fontSize: 12 }}>{g.purchGroupCode}</code></td>
            <td className="fw-semibold" style={{ fontSize: 13.5 }}>{g.purchGroupName}</td>
            <td className="pe-4 text-muted small">{g.purchOrgCode}</td>
          </tr>
        ));
      case 'plantLocations':
        return data.map((l) => (
          <tr key={`${l.plantCode}-${l.locationId}`}>
            <td className="ps-4"><code className="bg-light px-2 py-0.5 rounded text-dark fw-bold font-monospace" style={{ fontSize: 12 }}>{l.locationId}</code></td>
            <td className="fw-semibold" style={{ fontSize: 13.5 }}>{l.name}</td>
            <td className="pe-4 text-muted small">{l.plantCode}</td>
          </tr>
        ));
      case 'storageLocations':
        return data.map((s) => (
          <tr key={`${s.plantCode}-${s.slocId}`}>
            <td className="ps-4"><code className="bg-light px-2 py-0.5 rounded text-dark fw-bold font-monospace" style={{ fontSize: 12 }}>{s.slocId}</code></td>
            <td className="fw-semibold" style={{ fontSize: 13.5 }}>{s.description}</td>
            <td className="text-muted small">{s.plantCode}</td>
            <td className="pe-4">
              {s.isWarehouseManaged
                ? <span className="badge bg-success-subtle text-success">Yes</span>
                : <span className="badge bg-secondary-subtle text-secondary">No</span>}
            </td>
          </tr>
        ));
      case 'warehouses':
        return data.map((w) => (
          <tr key={w.warehouseNo}>
            <td className="ps-4"><code className="bg-light px-2 py-0.5 rounded text-dark fw-bold font-monospace" style={{ fontSize: 12 }}>{w.warehouseNo}</code></td>
            <td className="fw-semibold" style={{ fontSize: 13.5 }}>{w.description}</td>
            <td className="text-muted small">{w.plantCode} / {w.slocId}</td>
            <td className="text-muted small">{w.binCount}</td>
            <td className="pe-4 text-end">
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openBinManager(w)}>
                <i className="fas fa-th me-1"></i> Manage bins
              </button>
            </td>
          </tr>
        ));
      default:
        return null;
    }
  };

  return (
    <div className="fade-in-slide container-fluid py-4 bg-light bg-opacity-50" style={{ minHeight: '100%' }}>
      <div className="row align-items-center mb-4 text-start">
        <div className="col">
          <h4 className="fw-bold mb-1 text-dark">Enterprise Structure</h4>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-2">
          <div className="d-flex flex-wrap gap-2 text-start">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`btn border-0 d-flex align-items-center gap-2 py-2 px-3 rounded ${activeTab === t.key ? 'active-tab-style' : 'text-dark hover-tab-style'}`}
                onClick={() => setActiveTab(t.key)}
              >
                <i className={`fas ${t.icon} text-success`}></i>
                <span className="fw-semibold small">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted fw-bold" style={{ fontSize: 11 }}>{renderHeader()}</thead>
              <tbody>{renderRows()}</tbody>
            </table>
          </div>
        </div>
      </div>

      {binWarehouse && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: 760 }}>
            <div className="custom-modal-header bg-white border-bottom-0 pb-0 pt-4 px-4">
              <h5 className="custom-modal-title fw-bold text-dark fs-5">
                Bins — {binWarehouse.description} <span className="text-muted fw-normal">({binWarehouse.warehouseNo})</span>
              </h5>
              <button className="btn-close shadow-none" onClick={closeBinManager}></button>
            </div>
            <div className="custom-modal-body p-4 text-start" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {binAlert && <div className={`alert alert-${binAlert.type} py-1.5 mb-3 small`} role="alert">{binAlert.message}</div>}

              <div className="d-flex justify-content-between align-items-center mb-2">
                <input className="form-control form-control-sm font-monospace" style={{ maxWidth: 220 }} placeholder="Search bin code…"
                  value={binSearch} onChange={(e) => setBinSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadBins(binWarehouse, 0, binSearch); }} />
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadBins(binWarehouse, 0, binSearch)}>
                    <i className="fas fa-search me-1"></i> Search
                  </button>
                  {binTotal > 0 && (
                    <button type="button" className="btn btn-sm btn-outline-danger" onClick={deleteAllBins}>
                      <i className="fas fa-trash me-1"></i> Delete all
                    </button>
                  )}
                </div>
              </div>

              <div className="table-responsive" style={{ maxHeight: 260 }}>
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light text-muted fw-bold" style={{ fontSize: 11 }}>
                    <tr><th>Bin</th><th>Type</th><th>Section</th><th>Bin Type</th><th></th></tr>
                  </thead>
                  <tbody>
                    {binLoading ? (
                      <tr><td colSpan="5" className="text-center py-4 text-muted"><div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>Loading…</td></tr>
                    ) : binEntries.length === 0 ? (
                      <tr><td colSpan="5" className="text-center py-4 text-muted">No bins yet.</td></tr>
                    ) : binEntries.map((b) => (
                      <tr key={b.binCode}>
                        <td><code className="font-monospace" style={{ fontSize: 12 }}>{b.binCode}</code></td>
                        <td className="text-muted small">{b.storageType}</td>
                        <td className="text-muted small">{b.storageSection}</td>
                        <td className="text-muted small">{b.binType || '—'}</td>
                        <td className="text-end">
                          <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => deleteBin(b.binCode)}>
                            <i className="fas fa-times"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {binTotal > binLimit && (
                <div className="d-flex justify-content-between align-items-center mt-2">
                  <span className="text-muted small">{binOffset + 1}–{Math.min(binOffset + binLimit, binTotal)} of {binTotal}</span>
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-sm btn-outline-secondary" disabled={binOffset === 0} onClick={() => loadBins(binWarehouse, Math.max(binOffset - binLimit, 0), binSearch)}>Previous</button>
                    <button type="button" className="btn btn-sm btn-outline-secondary" disabled={binOffset + binLimit >= binTotal} onClick={() => loadBins(binWarehouse, binOffset + binLimit, binSearch)}>Next</button>
                  </div>
                </div>
              )}
            </div>
            <div className="custom-modal-footer gap-2">
              <button type="button" className="btn btn-outline-secondary px-3 py-1 fw-semibold" onClick={closeBinManager} style={{ borderRadius: 8, fontSize: 12 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEnterpriseStructure;
