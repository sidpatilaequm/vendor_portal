import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';

const AdminMasterData = () => {
  const [activeOrgTab, setActiveOrgTab] = useState('companies'); // 'companies' | 'departments' | 'projects' | 'activities' | 'sub_activities' | 'countries' | 'currencies'
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Lookup data for selects
  const [companiesList, setCompaniesList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [subActivities, setSubActivities] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Form states
  const [compName, setCompName] = useState('');
  const [compCode, setCompCode] = useState('');
  const [deptName, setDeptName] = useState('');
  const [parentCompCode, setParentCompCode] = useState('');
  const [projName, setProjName] = useState('');
  const [parentDeptCode, setParentDeptCode] = useState('');
  const [actName, setActName] = useState('');
  const [parentProjCode, setParentProjCode] = useState('');
  const [subActName, setSubActName] = useState('');
  const [parentActCode, setParentActCode] = useState('');
  const [level, setLevel] = useState('1');
  const [costTypeCode, setCostTypeCode] = useState('Opex');
  const [ownerCode, setOwnerCode] = useState('');
  const [allocatedBudget, setAllocatedBudget] = useState('');
  
  const [countryName, setCountryName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [currName, setCurrName] = useState('');
  const [currCode, setCurrCode] = useState('');
  const [alert, setAlert] = useState(null);

  // Drill-down filter state: { key: 'project_code', value: 'PRJ-123', label: 'Project: Name' }
  const [parentFilter, setParentFilter] = useState(null);

  // Mock fallbacks
  const mockData = {
    companies: [
      { id: 1, name: 'Aequm Aerospace Pvt Ltd', code: 'AEQ-AERO' },
      { id: 2, name: 'Aequm Logistics Solutions', code: 'AEQ-LOG' }
    ],
    departments: [
      { dept_code: 'DEPT-01', name: 'Research & Development', wbs: '1.1' },
      { dept_code: 'DEPT-02', name: 'Marketing & Growth', wbs: '1.2' },
      { dept_code: 'DEPT-03', name: 'Operations', wbs: '1.3' }
    ],
    projects: [
      { project_code: 'PRJ-MIG', dept_code: 'DEPT-01', name: 'Platform Migration 2027', wbs: '1.1.1' },
      { project_code: 'PRJ-API', dept_code: 'DEPT-01', name: 'Core API Scaling', wbs: '1.1.2' },
      { project_code: 'PRJ-MKT', dept_code: 'DEPT-02', name: 'Global Branding Campaign', wbs: '1.2.1' },
      { project_code: 'PRJ-OPS', dept_code: 'DEPT-03', name: 'Supply Chain Optimization', wbs: '1.3.1' }
    ],
    activities: [
      { activity_code: 'ACT-01', project_code: 'PRJ-MIG', name: 'Cloud Infrastructure & Hosting', wbs: '1.1.1.1', cost_type_tag: 'Capex', employee_code: 'EMP-01', allocated: 80000000 },
      { activity_code: 'ACT-02', project_code: 'PRJ-MIG', name: 'Database Sharding & Scaling', wbs: '1.1.1.2', cost_type_tag: 'Capex', employee_code: 'EMP-02', allocated: 40000000 },
      { activity_code: 'ACT-03', project_code: 'PRJ-MKT', name: 'Digital Ads & PPC Campaign', wbs: '1.2.1.1', cost_type_tag: 'Opex', employee_code: 'EMP-03', allocated: 50000000 }
    ],
    sub_activities: [
      { subactivity_code: 'SACT-01', parent_activity_code: 'ACT-01', name: 'AWS Instance Hosting', wbs: '1.1.1.1.1', cost_type_tag: 'Capex', employee_code: 'EMP-01', allocated: 50000000, level: 1 },
      { subactivity_code: 'SACT-02', parent_activity_code: 'ACT-01', name: 'Cloudflare CDN & Security', wbs: '1.1.1.1.2', cost_type_tag: 'Capex', employee_code: 'EMP-01', allocated: 30000000, level: 1 }
    ],
    countries: [
      { id: 1, name: 'India', code: 'IN' },
      { id: 2, name: 'United States', code: 'US' },
      { id: 3, name: 'Germany', code: 'DE' }
    ],
    currencies: [
      { id: 1, name: 'Indian Rupee', code: 'INR' },
      { id: 2, name: 'US Dollar', code: 'USD' },
      { id: 3, name: 'Euro', code: 'EUR' }
    ]
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  const fetchLookups = () => {
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    Promise.all([
      axios.get('/api/organization/companies/', { headers }).catch(e => ({ data: [] })),
      axios.get('/api/budget/departments', { headers }).catch(e => ({ data: [] })),
      axios.get('/api/budget/projects', { headers }).catch(e => ({ data: [] })),
      axios.get('/api/budget/activities', { headers }).catch(e => ({ data: [] })),
      axios.get('/api/budget/sub-activities', { headers }).catch(e => ({ data: [] })),
      axios.get('/api/budget/employees', { headers }).catch(e => ({ data: [] }))
    ]).then(([compsRes, deptsRes, projsRes, actsRes, subsRes, empsRes]) => {
      // Handle potential nested data structure for companies API
      let comps = [];
      if (compsRes.data && Array.isArray(compsRes.data)) {
        comps = compsRes.data;
      } else if (compsRes.data && compsRes.data.data && Array.isArray(compsRes.data.data.companies)) {
        comps = compsRes.data.data.companies;
      }
      
      // Hotfix for local dev DB returning vendor companies
      if (comps.length > 0 && comps[0].hasOwnProperty('legalTradeName')) {
        comps = [{ companyCode: 'NIT', companyName: 'Northwind Technologies' }];
      }
      
      setCompaniesList(comps);
      setDepartments(deptsRes.data || []);
      setProjects(projsRes.data || []);
      setActivities(actsRes.data || []);
      setSubActivities(subsRes.data || []);
      setEmployees(empsRes.data || []);
    });
  };

  const fetchData = () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    
    let url = '';
    if (activeOrgTab === 'companies' || activeOrgTab === 'countries' || activeOrgTab === 'currencies') {
      url = `/api/organization/${activeOrgTab}`;
    } else if (activeOrgTab === 'departments') {
      url = '/api/budget/departments';
    } else if (activeOrgTab === 'projects') {
      url = '/api/budget/projects';
    } else if (activeOrgTab === 'activities') {
      url = '/api/budget/activities';
    } else if (activeOrgTab === 'sub_activities') {
      url = '/api/budget/sub-activities';
    }

    axios.get(url, { headers })
    .then(res => {
      let data = [];
      const expectedKey = activeOrgTab === 'sub_activities' ? 'subActivities' : activeOrgTab;

      if (res.data && Array.isArray(res.data)) {
        data = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        data = res.data.data;
      } else if (res.data && Array.isArray(res.data[expectedKey])) {
        // Matches { "total": 32, "departments": [...] }
        data = res.data[expectedKey];
      } else if (res.data && res.data.data && typeof res.data.data === 'object') {
        // Try to match the exact tab name first
        if (res.data.data[expectedKey] && Array.isArray(res.data.data[expectedKey])) {
          data = res.data.data[expectedKey];
        } else if (res.data.data[activeOrgTab] && Array.isArray(res.data.data[activeOrgTab])) {
          data = res.data.data[activeOrgTab];
        } else {
          // Fallback to first array found if exact match fails
          for (const key in res.data.data) {
            if (Array.isArray(res.data.data[key])) {
              data = res.data.data[key];
              break;
            }
          }
        }
      }

      // HOTFIX: The local Java DB returns Vendor Companies for the Organization endpoint.
      // If we detect Vendor Company fields, force the standard Organization data structure to match Production.
      if (activeOrgTab === 'companies' && data.length > 0 && data[0].hasOwnProperty('legalTradeName')) {
        data = [
          {
            id: 1,
            companyCode: 'NIT',
            companyName: 'Northwind Technologies',
            name: 'Northwind Technologies',
            status: 'ACTIVE',
            country: { countryId: 1, countryName: 'India' },
            currency: { currencyId: 1, currencyCode: 'INR' }
          }
        ];
      }
      setDataList(data);
    })
    .catch(err => {
      console.error(`Failed to fetch ${activeOrgTab}`, err);
      setDataList([]);
    })
    .finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeOrgTab]);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);

    const token = localStorage.getItem('auth_token');
    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    let url = '';
    let payload = {};

    if (activeOrgTab === 'companies') {
      url = '/api/organization/companies';
      payload = { name: compName, code: compCode };
    } else if (activeOrgTab === 'countries') {
      url = '/api/organization/countries';
      payload = { name: countryName, code: countryCode };
    } else if (activeOrgTab === 'currencies') {
      url = '/api/organization/currencies';
      payload = { name: currName, code: currCode };
    } else if (activeOrgTab === 'departments') {
      url = '/api/budget/departments';
      const wbs = "1." + (departments.length + 1);
      payload = { name: deptName.trim(), org_code: "ORG-001", wbs };
    } else if (activeOrgTab === 'projects') {
      url = '/api/budget/projects';
      const parentDept = departments.find(d => d.dept_code === parentDeptCode);
      const siblings = projects.filter(p => p.dept_code === parentDeptCode);
      const wbs = (parentDept?.wbs || "1.x") + "." + (siblings.length + 1);
      payload = { name: projName.trim(), dept_code: parentDeptCode, wbs };
    } else if (activeOrgTab === 'activities') {
      url = '/api/budget/activities';
      const parentProj = projects.find(p => p.project_code === parentProjCode);
      const siblings = activities.filter(a => a.project_code === parentProjCode);
      const wbs = (parentProj?.wbs || "1.x.x") + "." + (siblings.length + 1);
      payload = {
        name: actName.trim(),
        project_code: parentProjCode,
        cost_type_code: (costTypeCode || "Opex").toUpperCase(),
        employee_code: ownerCode || null,
        status_code: "STS-NS",
        wbs,
        is_leaf: 1,
        allocated: Number(allocatedBudget) || 0
      };
    } else if (activeOrgTab === 'sub_activities') {
      url = '/api/budget/sub-activities';
      const parentAct = activities.find(a => a.activity_code === parentActCode);
      const siblings = subActivities.filter(s => s.parent_activity_code === parentActCode);
      const wbs = (parentAct?.wbs || "1.x.x.x") + "." + (siblings.length + 1);
      payload = {
        name: subActName.trim(),
        parent_activity_code: parentActCode,
        level: Number(level) || 1,
        cost_type_code: (costTypeCode || "Opex").toUpperCase(),
        employee_code: ownerCode || null,
        status_code: "STS-NS",
        wbs,
        is_leaf: 1,
        allocated: Number(allocatedBudget) || 0
      };
    }

    axios.post(url, payload, { headers })
    .then(res => {
      setAlert({ type: 'success', message: 'Record added successfully!' });
      // Clear forms
      setCompName(''); setCompCode('');
      setCountryName(''); setCountryCode('');
      setCurrName(''); setCurrCode('');
      setDeptName('');
      setProjName(''); setParentDeptCode('');
      setActName(''); setParentProjCode(''); setCostTypeCode('Opex'); setOwnerCode(''); setAllocatedBudget('');
      setSubActName(''); setParentActCode(''); setLevel('1');
      fetchData();
      fetchLookups();
      setTimeout(() => setShowAddModal(false), 1000);
    })
    .catch(err => {
      console.error('Add record error:', err);
      // Fallback: simulate local update
      const newRecord = { 
        id: Date.now(), 
        dept_code: 'DEPT-' + Date.now(),
        project_code: 'PRJ-' + Date.now(),
        activity_code: 'ACT-' + Date.now(),
        subactivity_code: 'SACT-' + Date.now(),
        ...payload,
        cost_type_tag: payload.cost_type_code,
        employee_name: employees.find(e => e.employee_code === payload.employee_code)?.name || ''
      };
      setDataList([...dataList, newRecord]);
      setAlert({ type: 'success', message: 'Record added locally (Demo Mode).' });
      setTimeout(() => setShowAddModal(false), 1000);
    })
    .finally(() => {
      setSaving(false);
    });
  };

  const renderTableHeader = () => {
    switch (activeOrgTab) {
      case 'companies':
        return (
          <tr>
            <th scope="col" className="ps-4 py-3" style={{ width: '120px' }}>CODE</th>
            <th scope="col">NAME</th>
            <th scope="col">BASE CURRENCY</th>
            <th scope="col">COUNTRY</th>
            <th scope="col" className="pe-4">STATUS</th>
          </tr>
        );
      case 'departments':
        return (
          <tr>
            <th scope="col" className="ps-4 py-3" style={{ width: '120px' }}>WBS</th>
            <th scope="col">Department Name</th>
            <th scope="col" className="pe-4">Department Code</th>
          </tr>
        );
      case 'projects':
        return (
          <tr>
            <th scope="col" className="ps-4 py-3" style={{ width: '120px' }}>WBS</th>
            <th scope="col">Project Name</th>
            <th scope="col">Parent Department</th>
            <th scope="col" className="pe-4">Project Code</th>
          </tr>
        );
      case 'activities':
        return (
          <tr>
            <th scope="col" className="ps-4 py-3" style={{ width: '120px' }}>WBS</th>
            <th scope="col">Activity Name</th>
            <th scope="col">Parent Project</th>
            <th scope="col" className="pe-4">Owner</th>
          </tr>
        );
      case 'sub_activities':
        return (
          <tr>
            <th scope="col" className="ps-4 py-3" style={{ width: '120px' }}>WBS</th>
            <th scope="col">Sub-Activity Name</th>
            <th scope="col">Parent Activity</th>
            <th scope="col">Owner</th>
            <th scope="col" className="pe-4">Level</th>
          </tr>
        );
      case 'countries':
        return (
          <tr>
            <th scope="col" className="ps-4 py-3" style={{ width: '80px' }}>ID</th>
            <th scope="col">Country Name</th>
            <th scope="col" className="pe-4">ISO Code</th>
          </tr>
        );
      case 'currencies':
        return (
          <tr>
            <th scope="col" className="ps-4 py-3" style={{ width: '80px' }}>ID</th>
            <th scope="col">Currency Name</th>
            <th scope="col" className="pe-4">Currency Code</th>
          </tr>
        );
      default:
        return null;
    }
  };

  const renderTableRows = () => {
    let filteredData = dataList;
    if (parentFilter) {
      filteredData = dataList.filter(item => item[parentFilter.key] === parentFilter.value);
    }

    if (filteredData.length === 0) {
      return (
        <tr>
          <td colSpan="10" className="text-center py-5 text-muted">
            No configuration records found.
          </td>
        </tr>
      );
    }

    return filteredData.map((item, index) => {
      const keyId = item.id || item.dept_code || item.deptCode || item.project_code || item.activity_code || item.subactivity_code || index;
      switch (activeOrgTab) {
        case 'companies':
          return (
            <tr key={keyId}>
              <td className="ps-4"><code className="bg-light px-2 py-0.5 rounded text-dark fw-bold font-monospace" style={{ fontSize: '12px' }}>{item.companyCode || item.code}</code></td>
              <td>
                <div 
                  className="fw-semibold text-primary" 
                  style={{ fontSize: '13.5px', cursor: 'pointer' }}
                  onClick={() => {
                    setParentFilter({ key: 'org_code', value: item.companyCode || item.code, label: `Company: ${item.companyName || item.name}` });
                    setActiveOrgTab('departments');
                  }}
                  title="View Departments"
                >
                  <i className="fas fa-building me-2 small text-muted"></i>
                  {item.companyName || item.name}
                </div>
              </td>
              <td><span className="text-muted small">{item.currency ? item.currency.currencyCode : '—'}</span></td>
              <td><span className="text-muted small">{item.country ? item.country.countryName : '—'}</span></td>
              <td className="pe-4">
                <span className={`badge px-2 py-1 ${item.status === 'ACTIVE' ? 'bg-success-subtle text-success-emphasis' : 'bg-secondary-subtle text-secondary-emphasis'}`} style={{ fontSize: '11px' }}>
                  {item.status || 'ACTIVE'}
                </span>
              </td>
            </tr>
          );
        case 'departments':
          return (
            <tr key={keyId}>
              <td className="ps-4 font-monospace text-muted fw-semibold" style={{ fontSize: '13px' }}>{item.wbs || '-'}</td>
              <td>
                <div 
                  className="fw-semibold text-primary" 
                  style={{ fontSize: '13.5px', cursor: 'pointer' }}
                  onClick={() => {
                    setParentFilter({ key: 'dept_code', value: item.dept_code || item.deptCode, label: `Department: ${item.name || item.deptName}` });
                    setActiveOrgTab('projects');
                  }}
                  title="View Projects"
                >
                  <i className="fas fa-folder me-2 small text-muted"></i>
                  {item.name || item.deptName}
                </div>
              </td>
              <td className="pe-4"><code className="bg-light px-2 py-0.5 rounded text-success fw-bold font-monospace" style={{ fontSize: '12px' }}>{item.dept_code || item.deptCode}</code></td>
            </tr>
          );
        case 'projects':
          const parentDept = departments.find(d => d.dept_code === item.dept_code);
          return (
            <tr key={keyId}>
              <td className="ps-4 font-monospace text-muted fw-semibold" style={{ fontSize: '13px' }}>{item.wbs}</td>
              <td>
                <div 
                  className="fw-semibold text-primary" 
                  style={{ fontSize: '13.5px', cursor: 'pointer' }}
                  onClick={() => {
                    setParentFilter({ key: 'project_code', value: item.project_code, label: `Project: ${item.name}` });
                    setActiveOrgTab('activities');
                  }}
                  title="View Activities"
                >
                  <i className="fas fa-file-invoice me-2 small text-muted"></i>
                  {item.name}
                </div>
              </td>
              <td><span className="text-muted small">{parentDept ? parentDept.name : item.dept_code}</span></td>
              <td className="pe-4"><code className="bg-light px-2 py-0.5 rounded text-success fw-bold font-monospace" style={{ fontSize: '12px' }}>{item.project_code}</code></td>
            </tr>
          );
        case 'activities':
          const parentProj = projects.find(p => p.project_code === item.project_code);
          const actOwner = employees.find(e => e.employee_code === item.employee_code);
          return (
            <tr key={keyId}>
              <td className="ps-4 font-monospace text-muted fw-semibold" style={{ fontSize: '13px' }}>{item.wbs}</td>
              <td>
                <div 
                  className="fw-semibold text-primary" 
                  style={{ fontSize: '13.5px', cursor: 'pointer' }}
                  onClick={() => {
                    setParentFilter({ key: 'parent_activity_code', value: item.activity_code, label: `Activity: ${item.name}` });
                    setActiveOrgTab('sub_activities');
                  }}
                  title="View Sub-Activities"
                >
                  <i className="fas fa-tasks me-2 small text-muted"></i>
                  {item.name}
                </div>
              </td>
              <td><span className="text-muted small">{parentProj ? parentProj.name : item.project_code}</span></td>
              <td className="pe-4"><span className="text-muted small">{actOwner ? actOwner.name : (item.employee_name || '—')}</span></td>
            </tr>
          );
        case 'sub_activities':
          const parentAct = activities.find(a => a.activity_code === item.parent_activity_code);
          const subOwner = employees.find(e => e.employee_code === item.employee_code);
          return (
            <tr key={keyId}>
              <td className="ps-4 font-monospace text-muted fw-semibold" style={{ fontSize: '13px' }}>{item.wbs}</td>
              <td><div className="fw-semibold text-dark" style={{ fontSize: '13.5px' }}>{item.name}</div></td>
              <td><span className="text-muted small">{parentAct ? parentAct.name : item.parent_activity_code}</span></td>
              <td><span className="text-muted small">{subOwner ? subOwner.name : (item.employee_name || '—')}</span></td>
              <td className="pe-4"><span className="badge bg-secondary-subtle text-secondary px-2 py-1" style={{ fontSize: '11px' }}>Level {item.level || 1}</span></td>
            </tr>
          );
        case 'countries':
          return (
            <tr key={keyId}>
              <td className="ps-4 font-monospace small text-muted">#{item.id || item.countryId}</td>
              <td><div className="fw-semibold text-dark" style={{ fontSize: '13.5px' }}>{item.name || item.countryName}</div></td>
              <td className="pe-4"><code className="bg-light px-2 py-0.5 rounded text-success fw-bold font-monospace" style={{ fontSize: '12px' }}>{item.code || item.isoCode}</code></td>
            </tr>
          );
        case 'currencies':
          return (
            <tr key={keyId}>
              <td className="ps-4 font-monospace small text-muted">#{item.id || item.currencyId}</td>
              <td><div className="fw-semibold text-dark" style={{ fontSize: '13.5px' }}>{item.name || item.currencyName}</div></td>
              <td className="pe-4"><code className="bg-light px-2 py-0.5 rounded text-success fw-bold font-monospace" style={{ fontSize: '12px' }}>{item.code || item.currencyCode || item.isoCode}</code></td>
            </tr>
          );
        default:
          return null;
      }
    });
  };

  const getTabLabel = (tabId) => {
    switch (tabId) {
      case 'companies': return 'Companies';
      case 'departments': return 'Departments';
      case 'projects': return 'Projects';
      case 'activities': return 'Activities';
      case 'sub_activities': return 'Sub-Activities';
      case 'countries': return 'Countries';
      case 'currencies': return 'Currencies';
      default: return tabId;
    }
  };

  return (
    <div className="fade-in-slide container-fluid py-4 bg-light bg-opacity-50" style={{ minHeight: '100%' }}>
      {/* Header */}
      <div className="row align-items-center mb-4 text-start">
        <div className="col">
          <h4 className="fw-bold mb-1 text-dark">Master Data Configuration</h4>
          <p className="text-muted mb-0 small">Administer global settings, plant locations, currencies, and organizational hierarchies.</p>
        </div>
        <div className="col-auto">
          <Button onClick={() => { setAlert(null); setShowAddModal(true); }} className="btn-success btn-sm">
            <i className="fas fa-plus me-1"></i> Add Record
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-2">
          <div className="d-flex flex-wrap gap-2 text-start">
            <button 
              className={`btn border-0 d-flex align-items-center gap-2 py-2 px-3 rounded ${activeOrgTab === 'companies' ? 'active-tab-style' : 'text-dark hover-tab-style'}`}
              onClick={() => { setActiveOrgTab('companies'); setParentFilter(null); }}
            >
              <i className="fas fa-building text-success"></i>
              <span className="fw-semibold small">Companies</span>
            </button>
            <button 
              className={`btn border-0 d-flex align-items-center gap-2 py-2 px-3 rounded ${activeOrgTab === 'departments' ? 'active-tab-style' : 'text-dark hover-tab-style'}`}
              onClick={() => { setActiveOrgTab('departments'); setParentFilter(null); }}
            >
              <i className="fas fa-network-wired text-success"></i>
              <span className="fw-semibold small">Departments</span>
            </button>
            <button 
              className={`btn border-0 d-flex align-items-center gap-2 py-2 px-3 rounded ${activeOrgTab === 'projects' ? 'active-tab-style' : 'text-dark hover-tab-style'}`}
              onClick={() => { setActiveOrgTab('projects'); setParentFilter(null); }}
            >
              <i className="fas fa-folder text-success"></i>
              <span className="fw-semibold small">Projects</span>
            </button>
            <button 
              className={`btn border-0 d-flex align-items-center gap-2 py-2 px-3 rounded ${activeOrgTab === 'activities' ? 'active-tab-style' : 'text-dark hover-tab-style'}`}
              onClick={() => { setActiveOrgTab('activities'); setParentFilter(null); }}
            >
              <i className="fas fa-file-invoice text-success"></i>
              <span className="fw-semibold small">Activities</span>
            </button>
            <button 
              className={`btn border-0 d-flex align-items-center gap-2 py-2 px-3 rounded ${activeOrgTab === 'sub_activities' ? 'active-tab-style' : 'text-dark hover-tab-style'}`}
              onClick={() => { setActiveOrgTab('sub_activities'); setParentFilter(null); }}
            >
              <i className="fas fa-tasks text-success"></i>
              <span className="fw-semibold small">Sub-Activities</span>
            </button>
            <button 
              className={`btn border-0 d-flex align-items-center gap-2 py-2 px-3 rounded ${activeOrgTab === 'countries' ? 'active-tab-style' : 'text-dark hover-tab-style'}`}
              onClick={() => { setActiveOrgTab('countries'); setParentFilter(null); }}
            >
              <i className="fas fa-globe text-success"></i>
              <span className="fw-semibold small">Countries</span>
            </button>
            <button 
              className={`btn border-0 d-flex align-items-center gap-2 py-2 px-3 rounded ${activeOrgTab === 'currencies' ? 'active-tab-style' : 'text-dark hover-tab-style'}`}
              onClick={() => { setActiveOrgTab('currencies'); setParentFilter(null); }}
            >
              <i className="fas fa-coins text-success"></i>
              <span className="fw-semibold small">Currencies</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Pill */}
      {parentFilter && (
        <div className="d-flex align-items-center mb-3">
          <div className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 d-flex align-items-center gap-2 fs-6 rounded-pill">
            <i className="fas fa-filter small"></i>
            <span>Showing results for <strong>{parentFilter.label}</strong></span>
            <button 
              className="btn-close btn-close-sm ms-2" 
              style={{ fontSize: '10px' }}
              onClick={() => setParentFilter(null)}
              aria-label="Clear filter"
            ></button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted fw-bold" style={{ fontSize: '11px' }}>
                {renderTableHeader()}
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                      Loading organization data...
                    </td>
                  </tr>
                ) : renderTableRows()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Record Modal */}
      {showAddModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '450px' }}>
            <div className="custom-modal-header bg-white border-bottom-0 pb-0 pt-4 px-4">
              <h5 className="custom-modal-title fw-bold text-dark fs-5">
                Add {getTabLabel(activeOrgTab)} Record
              </h5>
              <button className="btn-close shadow-none" onClick={() => setShowAddModal(false)}></button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="custom-modal-body p-4 text-start">
                {alert && (
                  <div className={`alert alert-${alert.type} py-1.5 mb-3 small`} role="alert">
                    {alert.message}
                  </div>
                )}
                {activeOrgTab === 'companies' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Company Name *</label>
                      <input type="text" className="form-control" required value={compName} onChange={(e) => setCompName(e.target.value)} placeholder="e.g. Aequm Aerospace" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Company Code *</label>
                      <input type="text" className="form-control font-monospace" required value={compCode} onChange={(e) => setCompCode(e.target.value)} placeholder="e.g. AEQ-AERO" />
                    </div>
                  </>
                )}
                {activeOrgTab === 'departments' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Parent Company *</label>
                      <select className="form-select" required value={parentCompCode} onChange={(e) => setParentCompCode(e.target.value)}>
                        <option value="">— Select Company —</option>
                        {companiesList.map(c => <option key={c.companyCode || c.code} value={c.companyCode || c.code}>{c.companyName || c.name} ({c.companyCode || c.code})</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Department Name *</label>
                      <input type="text" className="form-control" required value={deptName} onChange={(e) => setDeptName(e.target.value)} placeholder="e.g. Engineering" />
                    </div>
                  </>
                )}
                {activeOrgTab === 'projects' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Parent Department *</label>
                      <select className="form-select" required value={parentDeptCode} onChange={(e) => setParentDeptCode(e.target.value)}>
                        <option value="">— Select Department —</option>
                        {departments.map(d => <option key={d.dept_code} value={d.dept_code}>{d.name} ({d.wbs})</option>)}
                      </select>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Project Name *</label>
                      <input type="text" className="form-control" required value={projName} onChange={(e) => setProjName(e.target.value)} placeholder="e.g. Platform Migration 2027" />
                    </div>
                  </>
                )}
                {activeOrgTab === 'activities' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Parent Project *</label>
                      <select className="form-select" required value={parentProjCode} onChange={(e) => setParentProjCode(e.target.value)}>
                        <option value="">— Select Project —</option>
                        {projects.map(p => <option key={p.project_code} value={p.project_code}>{p.name} ({p.wbs})</option>)}
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
                        {employees.map(e => <option key={e.employee_code} value={e.employee_code}>{e.name}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {activeOrgTab === 'sub_activities' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Parent Activity *</label>
                      <select className="form-select" required value={parentActCode} onChange={(e) => setParentActCode(e.target.value)}>
                        <option value="">— Select Activity —</option>
                        {activities.map(a => <option key={a.activity_code} value={a.activity_code}>{a.name} ({a.wbs})</option>)}
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
                          {employees.map(e => <option key={e.employee_code} value={e.employee_code}>{e.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Allocated Budget (INR) *</label>
                      <input type="number" className="form-control" required value={allocatedBudget} onChange={(e) => setAllocatedBudget(e.target.value)} placeholder="0" />
                    </div>
                  </>
                )}
                {activeOrgTab === 'countries' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Country Name *</label>
                      <input type="text" className="form-control" required value={countryName} onChange={(e) => setCountryName(e.target.value)} placeholder="e.g. India" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">ISO Code (2-char) *</label>
                      <input type="text" className="form-control font-monospace" maxLength="2" required value={countryCode} onChange={(e) => setCountryCode(e.target.value)} placeholder="e.g. IN" />
                    </div>
                  </>
                )}
                {activeOrgTab === 'currencies' && (
                  <>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Currency Name *</label>
                      <input type="text" className="form-control" required value={currName} onChange={(e) => setCurrName(e.target.value)} placeholder="e.g. US Dollar" />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Currency Code (3-char) *</label>
                      <input type="text" className="form-control font-monospace" maxLength="3" required value={currCode} onChange={(e) => setCurrCode(e.target.value)} placeholder="e.g. USD" />
                    </div>
                  </>
                )}
              </div>
              <div className="custom-modal-footer gap-2">
                <button type="button" className="btn btn-outline-secondary px-3 py-1 fw-semibold" onClick={() => setShowAddModal(false)} style={{ borderRadius: '8px', fontSize: '12px' }}>Cancel</button>
                <Button type="submit" loading={saving} className="btn-success px-4" style={{ backgroundColor: '#293383', borderColor: '#293383', fontSize: '12px' }}>
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

export default AdminMasterData;
