import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Button from '../common/Button';

/*
 * Enterprise structure master data: company -> plant, company -> purchasing_org ->
 * purchasing_group, plant -> plant_location / storage_location -> warehouse -> storage_bin.
 * Backed by backend_java's /api/mm/* controllers — a separate table family from CompanyDetails
 * (/api/organization/companies, vendor profile data).
 *
 * View-only by design: list + create only for company/plant/purchasing org+group/plant
 * location/storage location/warehouse, matching the backend (GET + POST only, no PUT/DELETE).
 * POST will be removed once this master data has been populated for real.
 *
 * Storage bins are the one exception — a warehouse can hold thousands, so bins get their own
 * add-by-range/preview/search/delete manager (opened per warehouse) instead of the flat
 * list+create pattern everything else here uses.
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

const emptyForm = {
  companyCode: '', companyName: '', gstNumber: '',
  plantCode: '', plantName: '', plantGstNumber: '', plantCompanyCode: '',
  purchOrgCode: '', purchOrgName: '', purchOrgCompanyCode: '',
  purchGroupCode: '', purchGroupName: '', purchGroupOrgCode: '',
  plocPlantCode: '', plocLocationId: '', plocName: '',
  slocPlantCode: '', slocId: '', slocDescription: '', slocIsWarehouseManaged: false,
  whNo: '', whDescription: '', whPlantCode: '', whSlocId: '',
};

const AdminEnterpriseStructure = () => {
  const [activeTab, setActiveTab] = useState('companies');
  const [rows, setRows] = useState({
    companies: [], plants: [], purchasingOrgs: [], purchasingGroups: [],
    plantLocations: [], storageLocations: [], warehouses: [],
  });
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [form, setForm] = useState(emptyForm);

  // Bin manager — opened per warehouse from the Warehouse tab's row action.
  const [binWarehouse, setBinWarehouse] = useState(null);
  const [binEntries, setBinEntries] = useState([]);
  const [binTotal, setBinTotal] = useState(0);
  const [binOffset, setBinOffset] = useState(0);
  const [binLimit] = useState(50);
  const [binSearch, setBinSearch] = useState('');
  const [binLoading, setBinLoading] = useState(false);
  const [binAlert, setBinAlert] = useState(null);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

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

  // Companies, plants and purchasing orgs are needed as parent-select lookups regardless of
  // which tab is active, so the "Add" form always has fresh options.
  useEffect(() => {
    fetchTab('companies');
    fetchTab('plants');
    fetchTab('purchasingOrgs');
  }, [fetchTab]);

  useEffect(() => { fetchTab(activeTab); }, [activeTab, fetchTab]);

  const openAdd = () => {
    setForm(emptyForm);
    setAlert(null);
    setShowAddModal(true);
  };

  const submit = (e) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);

    let url = ENDPOINTS[activeTab];
    let payload = {};
    if (activeTab === 'companies') {
      payload = { companyCode: form.companyCode.trim(), companyName: form.companyName.trim(), gstNumber: form.gstNumber.trim() || null };
    } else if (activeTab === 'plants') {
      payload = { plantCode: form.plantCode.trim(), plantName: form.plantName.trim(), gstNumber: form.plantGstNumber.trim() || null, companyCode: form.plantCompanyCode };
    } else if (activeTab === 'purchasingOrgs') {
      payload = { purchOrgCode: form.purchOrgCode.trim(), purchOrgName: form.purchOrgName.trim(), companyCode: form.purchOrgCompanyCode };
    } else if (activeTab === 'purchasingGroups') {
      payload = { purchGroupCode: form.purchGroupCode.trim(), purchGroupName: form.purchGroupName.trim(), purchOrgCode: form.purchGroupOrgCode };
    } else if (activeTab === 'plantLocations') {
      payload = { plantCode: form.plocPlantCode, locationId: form.plocLocationId.trim(), name: form.plocName.trim() };
    } else if (activeTab === 'storageLocations') {
      payload = { plantCode: form.slocPlantCode, slocId: form.slocId.trim(), description: form.slocDescription.trim(), isWarehouseManaged: form.slocIsWarehouseManaged };
    } else if (activeTab === 'warehouses') {
      payload = { warehouseNo: form.whNo.trim(), description: form.whDescription.trim(), plantCode: form.whPlantCode, slocId: form.whSlocId };
    }

    axios.post(url, payload, { headers: authHeaders() })
      .then(() => {
        setAlert({ type: 'success', message: 'Saved.' });
        fetchTab(activeTab);
        if (activeTab === 'companies') fetchTab('purchasingOrgs'); // dependent lookups may need it too
        if (activeTab === 'purchasingOrgs') fetchTab('purchasingGroups');
        if (activeTab === 'storageLocations') fetchTab('storageLocations'); // warehouse form's dropdown depends on this
        setTimeout(() => setShowAddModal(false), 700);
      })
      .catch((err) => {
        setAlert({ type: 'danger', message: err.response?.data?.message || 'Could not save this record.' });
      })
      .finally(() => setSaving(false));
  };

  const companyOptions = rows.companies;
  const plantOptions = rows.plants;
  const purchOrgOptions = rows.purchasingOrgs;
  const warehouseManagedSlocOptions = (rows.storageLocations || []).filter((s) => s.isWarehouseManaged);

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

  const tabLabel = TABS.find((t) => t.key === activeTab)?.label || activeTab;

  return (
    <div className="fade-in-slide container-fluid py-4 bg-light bg-opacity-50" style={{ minHeight: '100%' }}>
      <div className="row align-items-center mb-4 text-start">
        <div className="col">
          <h4 className="fw-bold mb-1 text-dark">Enterprise Structure</h4>
        </div>
        <div className="col-auto">
          <Button onClick={openAdd} className="btn-success btn-sm">
            <i className="fas fa-plus me-1"></i> Add {tabLabel}
          </Button>
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

      {showAddModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: 450 }}>
            <div className="custom-modal-header bg-white border-bottom-0 pb-0 pt-4 px-4">
              <h5 className="custom-modal-title fw-bold text-dark fs-5">Add {tabLabel}</h5>
              <button className="btn-close shadow-none" onClick={() => setShowAddModal(false)}></button>
            </div>
            <form onSubmit={submit}>
              <div className="custom-modal-body p-4 text-start">
                {alert && <div className={`alert alert-${alert.type} py-1.5 mb-3 small`} role="alert">{alert.message}</div>}

                {activeTab === 'companies' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Company Code * (max 4 chars)</label>
                      <input className="form-control font-monospace" required maxLength={4} value={form.companyCode} onChange={(e) => setField('companyCode', e.target.value.toUpperCase())} placeholder="e.g. 1000" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Company Name *</label>
                      <input className="form-control" required value={form.companyName} onChange={(e) => setField('companyName', e.target.value)} placeholder="e.g. Acme Industries" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">GSTIN (optional)</label>
                      <input className="form-control font-monospace" maxLength={15} value={form.gstNumber} onChange={(e) => setField('gstNumber', e.target.value.toUpperCase())} placeholder="15-character GSTIN" />
                    </div>
                  </>
                )}

                {activeTab === 'plants' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Parent Company *</label>
                      <select className="form-select" required value={form.plantCompanyCode} onChange={(e) => setField('plantCompanyCode', e.target.value)}>
                        <option value="">— Select Company —</option>
                        {companyOptions.map((c) => <option key={c.companyCode} value={c.companyCode}>{c.companyName} ({c.companyCode})</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Plant Code * (max 4 chars)</label>
                      <input className="form-control font-monospace" required maxLength={4} value={form.plantCode} onChange={(e) => setField('plantCode', e.target.value.toUpperCase())} placeholder="e.g. 1010" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Plant Name *</label>
                      <input className="form-control" required value={form.plantName} onChange={(e) => setField('plantName', e.target.value)} placeholder="e.g. Bengaluru Works" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">GSTIN (optional — plants can hold their own)</label>
                      <input className="form-control font-monospace" maxLength={15} value={form.plantGstNumber} onChange={(e) => setField('plantGstNumber', e.target.value.toUpperCase())} placeholder="15-character GSTIN" />
                    </div>
                  </>
                )}

                {activeTab === 'purchasingOrgs' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Parent Company *</label>
                      <select className="form-select" required value={form.purchOrgCompanyCode} onChange={(e) => setField('purchOrgCompanyCode', e.target.value)}>
                        <option value="">— Select Company —</option>
                        {companyOptions.map((c) => <option key={c.companyCode} value={c.companyCode}>{c.companyName} ({c.companyCode})</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Purchasing Org Code * (max 4 chars)</label>
                      <input className="form-control font-monospace" required maxLength={4} value={form.purchOrgCode} onChange={(e) => setField('purchOrgCode', e.target.value.toUpperCase())} placeholder="e.g. 1000" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Purchasing Org Name *</label>
                      <input className="form-control" required value={form.purchOrgName} onChange={(e) => setField('purchOrgName', e.target.value)} placeholder="e.g. Central Purchasing" />
                    </div>
                  </>
                )}

                {activeTab === 'purchasingGroups' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Parent Purchasing Org *</label>
                      <select className="form-select" required value={form.purchGroupOrgCode} onChange={(e) => setField('purchGroupOrgCode', e.target.value)}>
                        <option value="">— Select Purchasing Org —</option>
                        {purchOrgOptions.map((o) => <option key={o.purchOrgCode} value={o.purchOrgCode}>{o.purchOrgName} ({o.purchOrgCode})</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Purchasing Group Code * (max 3 chars)</label>
                      <input className="form-control font-monospace" required maxLength={3} value={form.purchGroupCode} onChange={(e) => setField('purchGroupCode', e.target.value.toUpperCase())} placeholder="e.g. 101" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Purchasing Group Name *</label>
                      <input className="form-control" required value={form.purchGroupName} onChange={(e) => setField('purchGroupName', e.target.value)} placeholder="e.g. Raw Materials" />
                    </div>
                  </>
                )}

                {activeTab === 'plantLocations' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Parent Plant *</label>
                      <select className="form-select" required value={form.plocPlantCode} onChange={(e) => setField('plocPlantCode', e.target.value)}>
                        <option value="">— Select Plant —</option>
                        {plantOptions.map((p) => <option key={p.plantCode} value={p.plantCode}>{p.plantName} ({p.plantCode})</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Location ID * (max 10 chars — e.g. AAPL_PM01)</label>
                      <input className="form-control font-monospace" required maxLength={10} value={form.plocLocationId} onChange={(e) => setField('plocLocationId', e.target.value.toUpperCase())} placeholder="e.g. AAPL_PM01" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Name *</label>
                      <input className="form-control" required value={form.plocName} onChange={(e) => setField('plocName', e.target.value)} placeholder="e.g. Shop Floor" />
                    </div>
                    <div className="form-text">Maintenance object (T499S) — where equipment lives. Not the same as a storage location.</div>
                  </>
                )}

                {activeTab === 'storageLocations' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Parent Plant *</label>
                      <select className="form-select" required value={form.slocPlantCode} onChange={(e) => setField('slocPlantCode', e.target.value)}>
                        <option value="">— Select Plant —</option>
                        {plantOptions.map((p) => <option key={p.plantCode} value={p.plantCode}>{p.plantName} ({p.plantCode})</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Storage Location Code * (exactly 4 chars)</label>
                      <input className="form-control font-monospace" required maxLength={4} value={form.slocId} onChange={(e) => setField('slocId', e.target.value.toUpperCase())} placeholder="e.g. 1100" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Description *</label>
                      <input className="form-control" required value={form.slocDescription} onChange={(e) => setField('slocDescription', e.target.value)} placeholder="e.g. Main Store" />
                    </div>
                    <div className="form-check mb-2">
                      <input className="form-check-input" type="checkbox" id="slocWhManaged" checked={form.slocIsWarehouseManaged} onChange={(e) => setField('slocIsWarehouseManaged', e.target.checked)} />
                      <label className="form-check-label small fw-semibold" htmlFor="slocWhManaged">Warehouse managed</label>
                    </div>
                    <div className="form-text">Only a warehouse-managed storage location can carry a warehouse (and its bins).</div>
                  </>
                )}

                {activeTab === 'warehouses' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Warehouse-Managed Storage Location *</label>
                      <select className="form-select" required value={form.whSlocId ? `${form.whPlantCode}|${form.whSlocId}` : ''}
                        onChange={(e) => {
                          const [plantCode, slocId] = e.target.value.split('|');
                          setField('whPlantCode', plantCode || '');
                          setField('whSlocId', slocId || '');
                        }}>
                        <option value="">— Select Storage Location —</option>
                        {warehouseManagedSlocOptions.map((s) => (
                          <option key={`${s.plantCode}-${s.slocId}`} value={`${s.plantCode}|${s.slocId}`}>
                            {s.description} ({s.plantCode} / {s.slocId})
                          </option>
                        ))}
                      </select>
                      {warehouseManagedSlocOptions.length === 0 && (
                        <div className="form-text text-warning">No warehouse-managed storage locations yet — add one on the Storage Location tab first.</div>
                      )}
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Warehouse No. * (max 3 chars)</label>
                      <input className="form-control font-monospace" required maxLength={3} value={form.whNo} onChange={(e) => setField('whNo', e.target.value.toUpperCase())} placeholder="e.g. 100" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Description *</label>
                      <input className="form-control" required value={form.whDescription} onChange={(e) => setField('whDescription', e.target.value)} placeholder="e.g. Main Warehouse" />
                    </div>
                  </>
                )}
              </div>
              <div className="custom-modal-footer gap-2">
                <button type="button" className="btn btn-outline-secondary px-3 py-1 fw-semibold" onClick={() => setShowAddModal(false)} style={{ borderRadius: 8, fontSize: 12 }}>Cancel</button>
                <Button type="submit" loading={saving} className="btn-success px-4" style={{ backgroundColor: '#293383', borderColor: '#293383', fontSize: 12 }}>
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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
