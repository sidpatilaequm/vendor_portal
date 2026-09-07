import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Button from '../common/Button';

/*
 * Enterprise structure master data — two families, both surfaced here:
 *
 * 1. SAP MM-style: company -> plant, company -> purchasing_org -> purchasing_group,
 *    plant -> plant_location / storage_location -> warehouse -> storage_bin. Backed by
 *    backend_java's /api/mm/* controllers — a separate table family from CompanyDetails
 *    (/api/organization/companies, vendor profile data). View-only here (no create/edit/
 *    delete UI for any of them; a warehouse's bin list can be opened and searched but not
 *    modified).
 *
 * 2. Budget hierarchy: Department -> Project -> Activity -> Sub-Activity, backed by
 *    WorkFlow's /api/budget/* endpoints — the same departments/projects/activities the
 *    Budget Maintenance screen phases and allocates against. Moved here from the old
 *    "Organisation Data" screen (AdminMasterData.jsx, which now only handles Company/
 *    Country/Currency) so all org-structure admin lives in one place. Full create support,
 *    with the same parent-drill-down UX the old screen had (click a department to see its
 *    projects, a project to see its activities, an activity to see its sub-activities).
 */

const MM_TABS = [
  { key: 'companies', label: 'Company', icon: 'fa-building' },
  { key: 'plants', label: 'Plant', icon: 'fa-industry' },
  { key: 'purchasingOrgs', label: 'Purchasing Org', icon: 'fa-sitemap' },
  { key: 'purchasingGroups', label: 'Purchasing Group', icon: 'fa-users' },
  { key: 'plantLocations', label: 'Plant Location', icon: 'fa-map-marker-alt' },
  { key: 'storageLocations', label: 'Storage Location', icon: 'fa-warehouse' },
  { key: 'warehouses', label: 'Warehouse', icon: 'fa-boxes-stacked' },
];

const BUDGET_TABS = [
  { key: 'departments', label: 'Department', icon: 'fa-network-wired' },
  { key: 'projects', label: 'Project', icon: 'fa-folder' },
  { key: 'activities', label: 'Activity', icon: 'fa-file-invoice' },
  { key: 'subActivities', label: 'Sub-Activity', icon: 'fa-tasks' },
];

const TABS = [...MM_TABS, ...BUDGET_TABS];
const BUDGET_TAB_KEYS = new Set(BUDGET_TABS.map((t) => t.key));

const ENDPOINTS = {
  companies: '/api/mm/companies',
  plants: '/api/mm/plants',
  purchasingOrgs: '/api/mm/purchasing-orgs',
  purchasingGroups: '/api/mm/purchasing-groups',
  plantLocations: '/api/mm/plant-locations',
  storageLocations: '/api/mm/storage-locations',
  warehouses: '/api/mm/warehouses',
  departments: '/api/budget/departments',
  projects: '/api/budget/projects',
  activities: '/api/budget/activities',
  subActivities: '/api/budget/sub-activities',
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

const AdminEnterpriseStructure = () => {
  const [activeTab, setActiveTab] = useState('companies');
  const [rows, setRows] = useState({
    companies: [], plants: [], purchasingOrgs: [], purchasingGroups: [],
    plantLocations: [], storageLocations: [], warehouses: [],
    departments: [], projects: [], activities: [], subActivities: [],
  });
  const [loading, setLoading] = useState(false);

  // Drill-down filter for the budget tabs: { key, value, label } — mirrors the old
  // Organisation Data screen's click-through (department -> its projects -> ... ).
  const [parentFilter, setParentFilter] = useState(null);

  // Cross-reference lookups for the budget tabs — parent-name display, the Add modal's
  // parent/owner selects, and the drill-down. Fetched once on mount, not per-tab-switch.
  const [orgCompanies, setOrgCompanies] = useState([]); // /api/organization/companies — Department's "Parent Company" picker
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [subActivities, setSubActivities] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Bin manager — opened per warehouse from the Warehouse tab's row action.
  const [binWarehouse, setBinWarehouse] = useState(null);
  const [binEntries, setBinEntries] = useState([]);
  const [binTotal, setBinTotal] = useState(0);
  const [binOffset, setBinOffset] = useState(0);
  const [binLimit] = useState(50);
  const [binSearch, setBinSearch] = useState('');
  const [binLoading, setBinLoading] = useState(false);
  const [binAlert, setBinAlert] = useState(null);

  // Add-record modal (budget tabs only — the MM tabs stay view-only)
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);
  const [deptName, setDeptName] = useState('');
  const [parentCompCode, setParentCompCode] = useState('');
  const [projName, setProjName] = useState('');
  const [parentDeptCode, setParentDeptCode] = useState('');
  const [actName, setActName] = useState('');
  const [parentProjCode, setParentProjCode] = useState('');
  const [ownerCode, setOwnerCode] = useState('');
  const [allocatedBudget, setAllocatedBudget] = useState('');
  const [subActName, setSubActName] = useState('');
  const [parentActCode, setParentActCode] = useState('');
  const [level, setLevel] = useState('1');
  const [costTypeCode, setCostTypeCode] = useState('Opex');

  const fetchTab = useCallback((tabKey) => {
    setLoading(true);
    axios.get(ENDPOINTS[tabKey], { headers: authHeaders() })
      .then(({ data }) => {
        // MM endpoints wrap the array in an object (e.g. {companies: [...]}); WorkFlow's
        // budget endpoints return a bare array — handle both.
        let list = [];
        if (Array.isArray(data)) {
          list = data;
        } else if (data && typeof data === 'object') {
          const key = Object.keys(data).find((k) => Array.isArray(data[k]));
          list = key ? data[key] : [];
        }
        setRows((r) => ({ ...r, [tabKey]: list }));
      })
      .catch((err) => {
        console.error(`Failed to load ${tabKey}`, err);
        setRows((r) => ({ ...r, [tabKey]: [] }));
      })
      .finally(() => setLoading(false));
  }, []);

  const fetchBudgetLookups = useCallback(() => {
    const headers = authHeaders();
    Promise.all([
      axios.get('/api/organization/companies/', { headers }).catch(() => ({ data: [] })),
      axios.get('/api/budget/departments', { headers }).catch(() => ({ data: [] })),
      axios.get('/api/budget/projects', { headers }).catch(() => ({ data: [] })),
      axios.get('/api/budget/activities', { headers }).catch(() => ({ data: [] })),
      axios.get('/api/budget/sub-activities', { headers }).catch(() => ({ data: [] })),
      axios.get('/api/budget/employees', { headers }).catch(() => ({ data: [] })),
    ]).then(([compsRes, deptsRes, projsRes, actsRes, subsRes, empsRes]) => {
      let comps = [];
      if (Array.isArray(compsRes.data)) {
        comps = compsRes.data;
      } else if (compsRes.data?.data?.companies && Array.isArray(compsRes.data.data.companies)) {
        comps = compsRes.data.data.companies;
      }
      setOrgCompanies(comps);
      setDepartments(deptsRes.data || []);
      setProjects(projsRes.data || []);
      setActivities(actsRes.data || []);
      setSubActivities(subsRes.data || []);
      setEmployees(empsRes.data || []);
    });
  }, []);

  useEffect(() => { fetchBudgetLookups(); }, [fetchBudgetLookups]);
  useEffect(() => { fetchTab(activeTab); }, [activeTab, fetchTab]);

  const selectTab = (key) => {
    setActiveTab(key);
    setParentFilter(null);
  };

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

  // ── Add-record modal (budget tabs only) ────────────────────────────────

  const getTabLabel = (key) => TABS.find((t) => t.key === key)?.label || key;

  const openAddModal = () => {
    setAlert(null);
    setShowAddModal(true);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);
    const headers = { ...authHeaders(), 'Content-Type': 'application/json' };

    let url = '';
    let payload = {};

    if (activeTab === 'departments') {
      url = '/api/budget/departments';
      const wbs = '1.' + (departments.length + 1);
      payload = { name: deptName.trim(), org_code: 'ORG-001', wbs };
    } else if (activeTab === 'projects') {
      url = '/api/budget/projects';
      const parentDept = departments.find((d) => d.dept_code === parentDeptCode);
      const siblings = projects.filter((p) => p.dept_code === parentDeptCode);
      const wbs = (parentDept?.wbs || '1.x') + '.' + (siblings.length + 1);
      payload = { name: projName.trim(), dept_code: parentDeptCode, wbs };
    } else if (activeTab === 'activities') {
      url = '/api/budget/activities';
      const parentProj = projects.find((p) => p.project_code === parentProjCode);
      const siblings = activities.filter((a) => a.project_code === parentProjCode);
      const wbs = (parentProj?.wbs || '1.x.x') + '.' + (siblings.length + 1);
      payload = {
        name: actName.trim(),
        project_code: parentProjCode,
        cost_type_code: (costTypeCode || 'Opex').toUpperCase(),
        employee_code: ownerCode || null,
        status_code: 'STS-NS',
        wbs,
        is_leaf: 1,
        allocated: Number(allocatedBudget) || 0,
      };
    } else if (activeTab === 'subActivities') {
      url = '/api/budget/sub-activities';
      const parentAct = activities.find((a) => a.activity_code === parentActCode);
      const siblings = subActivities.filter((s) => s.parent_activity_code === parentActCode);
      const wbs = (parentAct?.wbs || '1.x.x.x') + '.' + (siblings.length + 1);
      payload = {
        name: subActName.trim(),
        parent_activity_code: parentActCode,
        level: Number(level) || 1,
        cost_type_code: (costTypeCode || 'Opex').toUpperCase(),
        employee_code: ownerCode || null,
        status_code: 'STS-NS',
        wbs,
        is_leaf: 1,
        allocated: Number(allocatedBudget) || 0,
      };
    }

    axios.post(url, payload, { headers })
      .then(() => {
        setAlert({ type: 'success', message: 'Record added successfully!' });
        setDeptName(''); setParentCompCode('');
        setProjName(''); setParentDeptCode('');
        setActName(''); setParentProjCode(''); setCostTypeCode('Opex'); setOwnerCode(''); setAllocatedBudget('');
        setSubActName(''); setParentActCode(''); setLevel('1');
        fetchTab(activeTab);
        fetchBudgetLookups();
        setTimeout(() => setShowAddModal(false), 1000);
      })
      .catch((err) => {
        console.error('Add record error:', err);
        setAlert({ type: 'danger', message: err.response?.data?.detail || err.response?.data?.message || 'Could not add this record.' });
      })
      .finally(() => setSaving(false));
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
      case 'departments':
        return <tr><th className="ps-4 py-3" style={{ width: 120 }}>WBS</th><th>Department Name</th><th className="pe-4">Department Code</th></tr>;
      case 'projects':
        return <tr><th className="ps-4 py-3" style={{ width: 120 }}>WBS</th><th>Project Name</th><th>Parent Department</th><th className="pe-4">Project Code</th></tr>;
      case 'activities':
        return <tr><th className="ps-4 py-3" style={{ width: 120 }}>WBS</th><th>Activity Name</th><th>Parent Project</th><th className="pe-4">Owner</th></tr>;
      case 'subActivities':
        return <tr><th className="ps-4 py-3" style={{ width: 120 }}>WBS</th><th>Sub-Activity Name</th><th>Parent Activity</th><th>Owner</th><th className="pe-4">Level</th></tr>;
      default:
        return null;
    }
  };

  const renderRows = () => {
    const data = BUDGET_TAB_KEYS.has(activeTab) && parentFilter
      ? (rows[activeTab] || []).filter((item) => item[parentFilter.key] === parentFilter.value)
      : (rows[activeTab] || []);

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
      case 'departments':
        return data.map((item) => (
          <tr key={item.dept_code}>
            <td className="ps-4 font-monospace text-muted fw-semibold" style={{ fontSize: 13 }}>{item.wbs || '-'}</td>
            <td>
              <div
                className="fw-semibold text-primary"
                style={{ fontSize: 13.5, cursor: 'pointer' }}
                onClick={() => { setParentFilter({ key: 'dept_code', value: item.dept_code, label: `Department: ${item.name}` }); selectTab('projects'); }}
                title="View Projects"
              >
                <i className="fas fa-folder me-2 small text-muted"></i>{item.name}
              </div>
            </td>
            <td className="pe-4"><code className="bg-light px-2 py-0.5 rounded text-success fw-bold font-monospace" style={{ fontSize: 12 }}>{item.dept_code}</code></td>
          </tr>
        ));
      case 'projects':
        return data.map((item) => {
          const parentDept = departments.find((d) => d.dept_code === item.dept_code);
          return (
            <tr key={item.project_code}>
              <td className="ps-4 font-monospace text-muted fw-semibold" style={{ fontSize: 13 }}>{item.wbs}</td>
              <td>
                <div
                  className="fw-semibold text-primary"
                  style={{ fontSize: 13.5, cursor: 'pointer' }}
                  onClick={() => { setParentFilter({ key: 'project_code', value: item.project_code, label: `Project: ${item.name}` }); selectTab('activities'); }}
                  title="View Activities"
                >
                  <i className="fas fa-file-invoice me-2 small text-muted"></i>{item.name}
                </div>
              </td>
              <td><span className="text-muted small">{parentDept ? parentDept.name : item.dept_code}</span></td>
              <td className="pe-4"><code className="bg-light px-2 py-0.5 rounded text-success fw-bold font-monospace" style={{ fontSize: 12 }}>{item.project_code}</code></td>
            </tr>
          );
        });
      case 'activities':
        return data.map((item) => {
          const parentProj = projects.find((p) => p.project_code === item.project_code);
          const owner = employees.find((e) => e.employee_code === item.employee_code);
          return (
            <tr key={item.activity_code}>
              <td className="ps-4 font-monospace text-muted fw-semibold" style={{ fontSize: 13 }}>{item.wbs}</td>
              <td>
                <div
                  className="fw-semibold text-primary"
                  style={{ fontSize: 13.5, cursor: 'pointer' }}
                  onClick={() => { setParentFilter({ key: 'parent_activity_code', value: item.activity_code, label: `Activity: ${item.name}` }); selectTab('subActivities'); }}
                  title="View Sub-Activities"
                >
                  <i className="fas fa-tasks me-2 small text-muted"></i>{item.name}
                </div>
              </td>
              <td><span className="text-muted small">{parentProj ? parentProj.name : item.project_code}</span></td>
              <td className="pe-4"><span className="text-muted small">{owner ? owner.name : (item.employee_name || '—')}</span></td>
            </tr>
          );
        });
      case 'subActivities':
        return data.map((item) => {
          const parentAct = activities.find((a) => a.activity_code === item.parent_activity_code);
          const owner = employees.find((e) => e.employee_code === item.employee_code);
          return (
            <tr key={item.subactivity_code}>
              <td className="ps-4 font-monospace text-muted fw-semibold" style={{ fontSize: 13 }}>{item.wbs}</td>
              <td><div className="fw-semibold text-dark" style={{ fontSize: 13.5 }}>{item.name}</div></td>
              <td><span className="text-muted small">{parentAct ? parentAct.name : item.parent_activity_code}</span></td>
              <td><span className="text-muted small">{owner ? owner.name : (item.employee_name || '—')}</span></td>
              <td className="pe-4"><span className="badge bg-secondary-subtle text-secondary px-2 py-1" style={{ fontSize: 11 }}>Level {item.level || 1}</span></td>
            </tr>
          );
        });
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
        {BUDGET_TAB_KEYS.has(activeTab) && (
          <div className="col-auto">
            <Button onClick={openAddModal} className="btn-success btn-sm">
              <i className="fas fa-plus me-1"></i> Add Record
            </Button>
          </div>
        )}
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-2">
          <div className="d-flex flex-wrap gap-2 text-start">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`btn border-0 d-flex align-items-center gap-2 py-2 px-3 rounded ${activeTab === t.key ? 'active-tab-style' : 'text-dark hover-tab-style'}`}
                onClick={() => selectTab(t.key)}
              >
                <i className={`fas ${t.icon} text-success`}></i>
                <span className="fw-semibold small">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {parentFilter && (
        <div className="d-flex align-items-center mb-3">
          <div className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 d-flex align-items-center gap-2 fs-6 rounded-pill">
            <i className="fas fa-filter small"></i>
            <span>Showing results for <strong>{parentFilter.label}</strong></span>
            <button className="btn-close btn-close-sm ms-2" style={{ fontSize: 10 }} onClick={() => setParentFilter(null)} aria-label="Clear filter"></button>
          </div>
        </div>
      )}

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
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => loadBins(binWarehouse, 0, binSearch)}>
                  <i className="fas fa-search me-1"></i> Search
                </button>
              </div>

              <div className="table-responsive" style={{ maxHeight: 260 }}>
                <table className="table table-sm table-hover align-middle mb-0">
                  <thead className="table-light text-muted fw-bold" style={{ fontSize: 11 }}>
                    <tr><th>Bin</th><th>Type</th><th>Section</th><th>Bin Type</th></tr>
                  </thead>
                  <tbody>
                    {binLoading ? (
                      <tr><td colSpan="4" className="text-center py-4 text-muted"><div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>Loading…</td></tr>
                    ) : binEntries.length === 0 ? (
                      <tr><td colSpan="4" className="text-center py-4 text-muted">No bins yet.</td></tr>
                    ) : binEntries.map((b) => (
                      <tr key={b.binCode}>
                        <td><code className="font-monospace" style={{ fontSize: 12 }}>{b.binCode}</code></td>
                        <td className="text-muted small">{b.storageType}</td>
                        <td className="text-muted small">{b.storageSection}</td>
                        <td className="text-muted small">{b.binType || '—'}</td>
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

      {showAddModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '450px' }}>
            <div className="custom-modal-header bg-white border-bottom-0 pb-0 pt-4 px-4">
              <h5 className="custom-modal-title fw-bold text-dark fs-5">Add {getTabLabel(activeTab)} Record</h5>
              <button className="btn-close shadow-none" onClick={() => setShowAddModal(false)}></button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="custom-modal-body p-4 text-start">
                {alert && <div className={`alert alert-${alert.type} py-1.5 mb-3 small`} role="alert">{alert.message}</div>}

                {activeTab === 'departments' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Parent Company *</label>
                      <select className="form-select" required value={parentCompCode} onChange={(e) => setParentCompCode(e.target.value)}>
                        <option value="">— Select Company —</option>
                        {orgCompanies.map((c) => <option key={c.companyCode || c.code} value={c.companyCode || c.code}>{c.companyName || c.name} ({c.companyCode || c.code})</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Department Name *</label>
                      <input type="text" className="form-control" required value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Engineering" />
                    </div>
                  </>
                )}
                {activeTab === 'projects' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Parent Department *</label>
                      <select className="form-select" required value={parentDeptCode} onChange={(e) => setParentDeptCode(e.target.value)}>
                        <option value="">— Select Department —</option>
                        {departments.map((d) => <option key={d.dept_code} value={d.dept_code}>{d.name} ({d.wbs})</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Project Name *</label>
                      <input type="text" className="form-control" required value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="e.g. Platform Migration 2027" />
                    </div>
                  </>
                )}
                {activeTab === 'activities' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Parent Project *</label>
                      <select className="form-select" required value={parentProjCode} onChange={(e) => setParentProjCode(e.target.value)}>
                        <option value="">— Select Project —</option>
                        {projects.map((p) => <option key={p.project_code} value={p.project_code}>{p.name} ({p.wbs})</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Activity Name *</label>
                      <input type="text" className="form-control" required value={actName} onChange={(e) => setActName(e.target.value)} placeholder="e.g. Cloud Infrastructure" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Owner (Optional)</label>
                      <select className="form-select" value={ownerCode} onChange={(e) => setOwnerCode(e.target.value)}>
                        <option value="">— Select Owner —</option>
                        {employees.map((e) => <option key={e.employee_code} value={e.employee_code}>{e.name}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {activeTab === 'subActivities' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Parent Activity *</label>
                      <select className="form-select" required value={parentActCode} onChange={(e) => setParentActCode(e.target.value)}>
                        <option value="">— Select Activity —</option>
                        {activities.map((a) => <option key={a.activity_code} value={a.activity_code}>{a.name} ({a.wbs})</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Sub-Activity Name *</label>
                      <input type="text" className="form-control" required value={subActName} onChange={(e) => setSubActName(e.target.value)} placeholder="e.g. AWS Instance Hosting" />
                    </div>
                    <div className="row g-2 mb-3">
                      <div className="col-4">
                        <label className="form-label fw-bold text-muted small">Level</label>
                        <select className="form-select" value={level} onChange={(e) => setLevel(e.target.value)}>
                          <option value="1">Level 1</option>
                          <option value="2">Level 2</option>
                          <option value="3">Level 3</option>
                        </select>
                      </div>
                      <div className="col-4">
                        <label className="form-label fw-bold text-muted small">Cost Type</label>
                        <select className="form-select" value={costTypeCode} onChange={(e) => setCostTypeCode(e.target.value)}>
                          <option value="Opex">Opex</option>
                          <option value="Capex">Capex</option>
                        </select>
                      </div>
                      <div className="col-4">
                        <label className="form-label fw-bold text-muted small">Owner</label>
                        <select className="form-select" value={ownerCode} onChange={(e) => setOwnerCode(e.target.value)}>
                          <option value="">— Select —</option>
                          {employees.map((e) => <option key={e.employee_code} value={e.employee_code}>{e.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Allocated Budget (INR) *</label>
                      <input type="number" className="form-control" required value={allocatedBudget} onChange={(e) => setAllocatedBudget(e.target.value)} placeholder="0" />
                    </div>
                  </>
                )}
              </div>
              <div className="custom-modal-footer gap-2">
                <button type="button" className="btn btn-outline-secondary px-3 py-1 fw-semibold" onClick={() => setShowAddModal(false)} style={{ borderRadius: 8, fontSize: 12 }}>Cancel</button>
                <Button type="submit" loading={saving} className="btn-success px-4" style={{ backgroundColor: '#293383', borderColor: '#293383', fontSize: 12 }}>
                  Save Record
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
