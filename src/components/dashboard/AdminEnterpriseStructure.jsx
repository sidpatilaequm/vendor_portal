import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Button from '../common/Button';

/*
 * Enterprise structure master data: company -> plant, company -> purchasing_org ->
 * purchasing_group. Backed by backend_java's /api/mm/* controllers — a separate table
 * family from CompanyDetails (/api/organization/companies, vendor profile data).
 *
 * View-only by design: list + create only, no edit/delete anywhere in this screen, matching
 * the backend (GET + POST only, no PUT/DELETE endpoints exist at all). POST will be removed
 * once this master data has been populated for real.
 */

const TABS = [
  { key: 'companies', label: 'Company', icon: 'fa-building' },
  { key: 'plants', label: 'Plant', icon: 'fa-industry' },
  { key: 'purchasingOrgs', label: 'Purchasing Org', icon: 'fa-sitemap' },
  { key: 'purchasingGroups', label: 'Purchasing Group', icon: 'fa-users' },
];

const ENDPOINTS = {
  companies: '/api/mm/companies',
  plants: '/api/mm/plants',
  purchasingOrgs: '/api/mm/purchasing-orgs',
  purchasingGroups: '/api/mm/purchasing-groups',
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

const emptyForm = {
  companyCode: '', companyName: '', gstNumber: '',
  plantCode: '', plantName: '', plantGstNumber: '', plantCompanyCode: '',
  purchOrgCode: '', purchOrgName: '', purchOrgCompanyCode: '',
  purchGroupCode: '', purchGroupName: '', purchGroupOrgCode: '',
};

const AdminEnterpriseStructure = () => {
  const [activeTab, setActiveTab] = useState('companies');
  const [rows, setRows] = useState({ companies: [], plants: [], purchasingOrgs: [], purchasingGroups: [] });
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [form, setForm] = useState(emptyForm);

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

  // Companies + purchasing orgs are needed as parent-select lookups regardless of which tab
  // is active, so the "Add" form always has fresh options.
  useEffect(() => {
    fetchTab('companies');
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
    }

    axios.post(url, payload, { headers: authHeaders() })
      .then(() => {
        setAlert({ type: 'success', message: 'Saved.' });
        fetchTab(activeTab);
        if (activeTab === 'companies') fetchTab('purchasingOrgs'); // dependent lookups may need it too
        if (activeTab === 'purchasingOrgs') fetchTab('purchasingGroups');
        setTimeout(() => setShowAddModal(false), 700);
      })
      .catch((err) => {
        setAlert({ type: 'danger', message: err.response?.data?.message || 'Could not save this record.' });
      })
      .finally(() => setSaving(false));
  };

  const companyOptions = rows.companies;
  const purchOrgOptions = rows.purchasingOrgs;

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
          <p className="text-muted mb-0 small">Company, plant and purchasing organisation/group master data — view-only, plus adding new records.</p>
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
              </div>
              <div className="custom-modal-footer gap-2">
                <button type="button" className="btn btn-outline-secondary px-3 py-1 fw-semibold" onClick={() => setShowAddModal(false)} style={{ borderRadius: 8, fontSize: 12 }}>Cancel</button>
                <Button type="submit" loading={saving} className="btn-success px-4" style={{ backgroundColor: '#064e3b', borderColor: '#064e3b', fontSize: 12 }}>
                  Save
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminEnterpriseStructure;
