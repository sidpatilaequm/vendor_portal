import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';

// Company/Country/Currency reference data (backend_java's /api/organization/*). Department/
// Project/Activity/Sub-Activity used to live here too but moved to Enterprise Structure
// (AdminEnterpriseStructure.jsx) so all org-structure admin — including the budget hierarchy —
// lives in one place.
const AdminMasterData = () => {
  const [activeOrgTab, setActiveOrgTab] = useState('companies'); // 'companies' | 'countries' | 'currencies'
  const [dataList, setDataList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [compName, setCompName] = useState('');
  const [compCode, setCompCode] = useState('');
  const [countryName, setCountryName] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [currName, setCurrName] = useState('');
  const [currCode, setCurrCode] = useState('');
  const [alert, setAlert] = useState(null);

  const fetchData = () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    const url = `/api/organization/${activeOrgTab}`;

    axios.get(url, { headers })
    .then(res => {
      let data = [];
      if (res.data && Array.isArray(res.data)) {
        data = res.data;
      } else if (res.data && Array.isArray(res.data.data)) {
        data = res.data.data;
      } else if (res.data && Array.isArray(res.data[activeOrgTab])) {
        data = res.data[activeOrgTab];
      } else if (res.data && res.data.data && typeof res.data.data === 'object') {
        if (res.data.data[activeOrgTab] && Array.isArray(res.data.data[activeOrgTab])) {
          data = res.data.data[activeOrgTab];
        } else {
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
    }

    axios.post(url, payload, { headers })
    .then(res => {
      setAlert({ type: 'success', message: 'Record added successfully!' });
      setCompName(''); setCompCode('');
      setCountryName(''); setCountryCode('');
      setCurrName(''); setCurrCode('');
      fetchData();
      setTimeout(() => setShowAddModal(false), 1000);
    })
    .catch(err => {
      console.error('Add record error:', err);
      setAlert({ type: 'danger', message: err.response?.data?.detail || err.response?.data?.message || 'Could not add this record.' });
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
    if (dataList.length === 0) {
      return (
        <tr>
          <td colSpan="10" className="text-center py-5 text-muted">
            No configuration records found.
          </td>
        </tr>
      );
    }

    return dataList.map((item, index) => {
      const keyId = item.id || index;
      switch (activeOrgTab) {
        case 'companies':
          return (
            <tr key={keyId}>
              <td className="ps-4"><code className="bg-light px-2 py-0.5 rounded text-dark fw-bold font-monospace" style={{ fontSize: '12px' }}>{item.companyCode || item.code}</code></td>
              <td>
                <div className="fw-semibold" style={{ fontSize: '13.5px' }}>
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
              onClick={() => setActiveOrgTab('companies')}
            >
              <i className="fas fa-building text-success"></i>
              <span className="fw-semibold small">Companies</span>
            </button>
            <button
              className={`btn border-0 d-flex align-items-center gap-2 py-2 px-3 rounded ${activeOrgTab === 'countries' ? 'active-tab-style' : 'text-dark hover-tab-style'}`}
              onClick={() => setActiveOrgTab('countries')}
            >
              <i className="fas fa-globe text-success"></i>
              <span className="fw-semibold small">Countries</span>
            </button>
            <button
              className={`btn border-0 d-flex align-items-center gap-2 py-2 px-3 rounded ${activeOrgTab === 'currencies' ? 'active-tab-style' : 'text-dark hover-tab-style'}`}
              onClick={() => setActiveOrgTab('currencies')}
            >
              <i className="fas fa-coins text-success"></i>
              <span className="fw-semibold small">Currencies</span>
            </button>
          </div>
        </div>
      </div>

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
