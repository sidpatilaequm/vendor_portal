import React, { useEffect, useState } from 'react';
import axios from 'axios';
import BackButton from '../common/BackButton';

export default function MaterialReport({ onBack }) {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [start, setStart] = useState('2026-01-01');
  const [end, setEnd] = useState('2026-12-31');
  const [companyId, setCompanyId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [realVendorName, setRealVendorName] = useState('');
  const [realVendorCode, setRealVendorCode] = useState('');

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user_data');
      if (userStr) {
        const user = JSON.parse(userStr);
        let cId = user.company_id || user.companyId || user.vendor_id || user.vendorId || user.id;

        if (user.email === 'markjhon@gmail.com' && !cId) {
          cId = 1381;
        }

        if (cId) {
          axios.get(`/api/vendors/${cId}`)
            .then(res => {
              if (res.data) {
                setRealVendorName(res.data.name);
                setRealVendorCode(res.data.bp_no);
              }
            })
            .catch(err => console.error(err));
        }
      }
    } catch (e) { }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [start, end, companyId]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const params = {};
      if (start) params.start_date = start;
      if (end) params.end_date = end;
      if (companyId) params.company_id = companyId;

      const res = await axios.get('/api/vendor/material-list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setData(res.data || {});
      setSummary(res.data.summary || {});
    } catch (err) {
      console.error('Error fetching material report:', err);
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const vendor = data.vendorInfo || {};
  const rows = data.materials || [];

  const filtered = rows.filter(r => {
    const matchSearch = search === '' || (r.contractNumber || '').toLowerCase().includes(search.toLowerCase()) || (r.materialCode || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const exportCSV = () => {
    const headers = ['Material Code,Description,Contract Price,UOM,HSN,Contract Number,Payment Terms,Delivery Terms,Contract Value,Start Date,End Date,Status,Company Code\n'];
    const csvRows = filtered.map(v => `"${v.materialCode}","${v.description}",${v.contractPrice || ''},"${v.uom}","${v.hsnCode || ''}","${v.contractNumber || ''}","${v.paymentTerms || ''}","${v.deliveryTerms || ''}",${v.contractValue || ''},"${v.contractStartDate || ''}","${v.contractEndDate || ''}","${v.status || ''}","${v.companyCode || ''}"\n`);
    const csv = headers.join('') + csvRows.join('');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vendor_materials_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const num = (val) => val != null ? val.toLocaleString('en-IN') : '—';

  return (
    <div className="p-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Poppins", sans-serif' }}>
      <BackButton onClick={onBack} />
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h3 className="fw-bold text-dark mb-0">Material List</h3>
        </div>
      </div>

      {/* Table Filters */}
      <div className="d-flex flex-column flex-md-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Filter by Contract No or Material Code..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-control border shadow-sm flex-grow-1"
          style={{ padding: '10px 16px' }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="form-select border shadow-sm"
          style={{ width: '200px', padding: '10px 16px' }}
        >
          <option value="All">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Pending">Pending</option>
          <option value="Expired">Expired</option>
          <option value="Terminated">Terminated</option>
        </select>
      </div>

      {/* Data Table */}
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-teal" style={{ color: '#0d9488' }} role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="bg-light border-bottom">
                <tr>
                  <th className="px-4 py-3" style={{ width: '40px' }}></th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Material code</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Description</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">UOM</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">HSN</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Contract No</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase text-end">Price (₹)</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center py-4 text-muted">No materials found</td>
                  </tr>
                ) : filtered.map((v, idx) => (
                  <React.Fragment key={idx}>
                    <tr>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                          className="btn btn-sm btn-link text-muted p-0 border-0"
                        >
                          <i className={`fas fa-chevron-${expandedIdx === idx ? 'down' : 'right'}`}></i>
                        </button>
                      </td>
                      <td className="px-4 py-3 fw-bold text-primary" style={{ fontFamily: 'monospace' }}>{v.materialCode}</td>
                      <td className="px-4 py-3">
                        <span className="d-inline-block text-truncate" style={{ maxWidth: '220px' }} title={v.description}>
                          {v.description}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{v.uom}</td>
                      <td className="px-4 py-3 text-muted" style={{ fontFamily: 'monospace' }}>{v.hsnCode || '—'}</td>
                      <td className="px-4 py-3 text-muted" style={{ fontFamily: 'monospace' }}>{v.contractNumber || '—'}</td>
                      <td className="px-4 py-3 text-dark fw-bold text-end">{v.contractPrice != null ? num(v.contractPrice) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge rounded-pill px-3 py-2 fw-medium ${v.status === 'Active' ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'}`}>
                          {v.status}
                        </span>
                      </td>
                    </tr>
                    {expandedIdx === idx && (
                      <tr>
                        <td colSpan="8" className="p-0 border-0">
                          <div className="bg-light p-4 border-bottom">
                            <div className="bg-white border rounded p-4 shadow-sm">
                              <h6 className="text-uppercase fw-bold text-dark mb-3" style={{ fontSize: '13px', letterSpacing: '0.5px' }}>Contract Details</h6>
                              <div className="row g-4">
                                <div className="col-md-3">
                                  <p className="text-muted small fw-medium mb-1">Contract Value</p>
                                  <p className="fw-bold text-dark mb-0">₹{num(v.contractValue)}</p>
                                </div>
                                <div className="col-md-3">
                                  <p className="text-muted small fw-medium mb-1">Payment Terms</p>
                                  <p className="fw-semibold text-dark mb-0">{v.paymentTerms}</p>
                                </div>
                                <div className="col-md-3">
                                  <p className="text-muted small fw-medium mb-1">Delivery Terms</p>
                                  <p className="fw-semibold text-dark mb-0">{v.deliveryTerms}</p>
                                </div>
                                <div className="col-md-3">
                                  <p className="text-muted small fw-medium mb-1">Contract Period</p>
                                  <p className="fw-semibold text-dark mb-0">{formatDate(v.contractStartDate)} - {formatDate(v.contractEndDate)}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && (
        <p className="text-muted small text-end">Showing {filtered.length} of {rows.length} records</p>
      )}
    </div>
  );
}
