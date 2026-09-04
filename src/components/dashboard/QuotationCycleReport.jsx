import React, { useEffect, useState } from 'react';
import axios from 'axios';
import NewQuotationWizard from './NewQuotationWizard';
import BackButton from '../common/BackButton';

export default function QuotationCycleReport({ onBack }) {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [start, setStart] = useState('2026-01-01');
  const [end, setEnd] = useState('2026-12-31');
  const [companyId, setCompanyId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Submitted');
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [showKpis, setShowKpis] = useState(false);

  const [realVendorName, setRealVendorName] = useState('');
  const [realVendorCode, setRealVendorCode] = useState('');
  const [vendorId, setVendorId] = useState('');

  // Quotation Creation States
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [selectedPrForQuote, setSelectedPrForQuote] = useState(null);
  const [showPrSelectModal, setShowPrSelectModal] = useState(false);
  const [availablePrs, setAvailablePrs] = useState([]);
  const [loadingPrs, setLoadingPrs] = useState(false);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user_data');
      if (userStr) {
        const user = JSON.parse(userStr);
        let cId = user.company_id || user.companyId || user.vendor_id || user.vendorId || user.id;
        if (user.email === 'markjhon@gmail.com' && !cId) cId = 1381;
        if (cId) {
          setVendorId(cId);
          axios.get(`/api/vendors/${cId}`)
            .then(res => {
              if (res.data) {
                setRealVendorName(res.data.name);
                setRealVendorCode(res.data.bp_no);
              }
            }).catch(() => { });
        }
      }
    } catch (e) { }
  }, []);

  useEffect(() => {
    if (vendorId || realVendorCode) {
      fetchReport();
    }
  }, [start, end, companyId, vendorId, realVendorCode]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const endpoint = `/api/vendor/quotation-report?vendor_code=${realVendorCode || 'BP-MARK-01'}`;
      const response = await fetch(
        endpoint,
        { headers: { 'X-Employee-Id': 'EMP001' } }
      );
      const resData = await response.json();

      setData(resData.quotations || []);
      setSummary(resData.summary || {});
    } catch (err) {
      console.error('Error fetching quotation report:', err);
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const filtered = data.filter(r => {
    const matchSearch = search === '' || (r.quoteNo || '').toLowerCase().includes(search.toLowerCase()) || (r.prNumber || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || (r.quoteStatus || '').toLowerCase() === statusFilter.toLowerCase();
    return matchSearch && matchStatus;
  });

  const exportCSV = () => {
    const headers = ['Quote No,Quote Date,PR Number,PR Date,Status,Item Code,Qty,Price,Freight,Discount,Delivery Date,Payment Terms\n'];
    const rows = [];
    filtered.forEach(q => {
      if (!q.items || q.items.length === 0) {
        rows.push(`"${q.quoteNo}","${q.quoteDate}","${q.prNumber}","${q.prDate}","${q.quoteStatus}","","","","","","",""\n`);
      } else {
        q.items.forEach(item => {
          rows.push(`"${q.quoteNo}","${q.quoteDate}","${q.prNumber}","${q.prDate}","${q.quoteStatus}","${item.itemCode}",${item.itemQuantity},${item.itemPrice},${item.itemFreight},${item.itemDiscount},"${item.itemDeliveryDate}","${item.itemPaymentTerms}"\n`);
        });
      }
    });
    const csv = headers.join('') + rows.join('');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `quotation_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const num = (val) => val != null ? val.toLocaleString('en-IN') : '0';

  const fetchAvailablePrs = async () => {
    setLoadingPrs(true);
    try {
      const endpoint = `/api/vendor/purchase-requisitions?vendor_code=${realVendorCode || 'BP-MARK-01'}&exclude_quoted=true`;
      const response = await fetch(
        endpoint,
        { headers: { 'X-Employee-Id': 'EMP001' } }
      );
      const resData = await response.json();
      let content = [];
      if (Array.isArray(resData)) {
        content = resData;
      } else if (resData && Array.isArray(resData.prs)) {
        content = resData.prs;
      }
      
      const filtered = content.filter(item => {
        const s = (item.status || item.vendorStatus || item.assignmentStatus || item.vendor_status || '').toUpperCase();
        return s === 'ACCEPTED' || s === 'ACKNOWLEDGED' || s === 'WON'; // Also including WON in case backend maps it
      });
      setAvailablePrs(filtered);
    } catch (err) {
      console.error('Failed to fetch PRs for selection modal, loading fallback.', err);
      setAvailablePrs([]);
    } finally {
      setLoadingPrs(false);
    }
  };

  const openPrSelection = () => {
    fetchAvailablePrs();
    setShowPrSelectModal(true);
  };

  const startQuoteFromPr = async (pr) => {
    const prNo = pr.prNumber || pr.pr_number;
    const vs = (pr.vendorStatus || pr.vendor_status || '').toUpperCase();
    if (vs !== 'ACCEPTED') {
      try {
        const token = localStorage.getItem('auth_token');
        await axios.post(`/api/vendor/purchase-requisitions/${pr.id}/accept`, {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Failed to auto-accept PR:', err);
      }
    }
    setSelectedPrForQuote(prNo);
    setShowPrSelectModal(false);
    setShowCreateWizard(true);
  };

  const getStatusBadge = (status) => {
    if (!status) return 'bg-secondary bg-opacity-10 text-secondary';
    const s = status.toLowerCase();
    if (s === 'won' || s === 'awarded' || s === 'pass' || s === 'compliant' || s === 'met') return 'bg-success bg-opacity-10 text-success';
    if (s === 'rejected' || s === 'fail' || s === 'sla breach') return 'bg-danger bg-opacity-10 text-danger';
    if (s === 'pending' || s === 'partial' || s === 'acknowledged') return 'bg-warning bg-opacity-10 text-warning';
    return 'bg-secondary bg-opacity-10 text-secondary';
  };

  if (showCreateWizard) {
    return (
      <NewQuotationWizard
        prId={selectedPrForQuote}
        onBack={() => {
          setShowCreateWizard(false);
          setSelectedPrForQuote(null);
        }}
        onSuccess={() => {
          setShowCreateWizard(false);
          setSelectedPrForQuote(null);
          fetchReport();
        }}
      />
    );
  }

  return (
    <div className="p-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Poppins", sans-serif' }}>
      <BackButton onClick={onBack} />

      {/* Header */}
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h3 className="fw-bold text-dark mb-0">Quotation</h3>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4 gap-3">
        <div className="d-flex flex-wrap gap-3 align-items-center">
          <input type="text" placeholder="Filter by Quote No or PR Number..." value={search} onChange={e => setSearch(e.target.value)} className="form-control form-control-sm shadow-sm border" style={{ minWidth: '200px' }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-select form-select-sm shadow-sm border" style={{ width: '140px' }}>
            <option value="All">All Statuses</option>
            <option value="Rejected">Rejected</option>
            <option value="Submitted">Submitted</option>
            <option value="Won">Won</option>
          </select>
          <div className="d-flex align-items-center gap-2">
            <label className="text-muted small fw-medium mb-0">Start</label>
            <input
              type="date"
              className="form-control form-control-sm border shadow-sm"
              value={start}
              onChange={e => setStart(e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>
          <div className="d-flex align-items-center gap-2">
            <label className="text-muted small fw-medium mb-0">End</label>
            <input
              type="date"
              className="form-control form-control-sm border shadow-sm"
              value={end}
              onChange={e => setEnd(e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>
        </div>

        <div className="d-flex gap-2">
          <button
            className="btn btn-light text-secondary border shadow-sm d-flex align-items-center justify-content-center"
            style={{ borderRadius: '6px', padding: '0 12px', minWidth: '40px', height: '31px', backgroundColor: showKpis ? '#f8f9fa' : '#ffffff' }}
            onClick={() => setShowKpis(!showKpis)}
            title={showKpis ? 'Hide Stats' : 'Show Stats'}
          >
            <i className={`fas fa-chart-bar fs-15 ${showKpis ? 'text-primary' : ''}`}></i>
          </button>
          <button
            onClick={openPrSelection}
            className="btn btn-sm text-white fw-medium shadow-sm d-flex align-items-center gap-2"
            style={{ backgroundColor: '#0E7C86' }}
          >
            <i className="fas fa-file-contract"></i>
            Create from PR
          </button>
          <button
            onClick={exportCSV}
            className="btn btn-sm text-white fw-medium shadow-sm d-flex align-items-center gap-2"
            style={{ backgroundColor: '#eab308' }}
          >
            <i className="fas fa-download"></i>
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger shadow-sm border-0" role="alert">
          <i className="fas fa-exclamation-circle me-2"></i>{error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="row g-4 mb-4" style={{ display: showKpis ? 'flex' : 'none' }}>
        {[
          { label: 'Requested', val: summary.requested || 0 },
          { label: 'Acknowledged', val: summary.acknowledged || 0 },
          { label: 'Raised', val: summary.raised || 0 },
          { label: 'Won', val: summary.won || 0 },
          { label: 'Rejected', val: summary.rejected || 0 },
          { label: 'SLA', val: `${summary.sla || 0}%` },
          { label: 'Win %', val: `${summary.win || 0}%` },
          { label: 'Not Responded', val: `${summary.notResponded || 0}%` }
        ].map((kpi, i) => (
          <div key={i} className="col-md-3">
            <div className="card h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
              <div className="card-body p-3 text-center">
                <h3 className="fw-bold text-dark mb-1">{kpi.val}</h3>
                <div className="text-muted small">{kpi.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <h4 className="text-dark fw-bold mt-5 mb-3">Summary</h4>

      {/* Data Table */}
      <div className="card border-0 shadow-sm mb-3" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div className="p-5 text-center"><div className="spinner-border text-teal" style={{ color: '#0d9488' }} role="status"></div></div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="bg-light border-bottom">
                <tr>
                  <th className="px-4 py-3" style={{ width: '40px' }}></th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Quote No</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Quote Date</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">PR Number</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">PR Date</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Quote Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-4 text-muted">No records found</td></tr>
                ) : filtered.map((v, idx) => (
                  <React.Fragment key={idx}>
                    <tr>
                      <td className="px-4 py-3">
                        <button onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)} className="btn btn-sm btn-link text-muted p-0 border-0">
                          <i className={`fas fa-chevron-${expandedIdx === idx ? 'down' : 'right'}`}></i>
                        </button>
                      </td>
                      <td className="px-4 py-3 fw-bold text-primary" style={{ fontFamily: 'monospace' }}>{v.quoteNo}</td>
                      <td className="px-4 py-3 text-muted">{v.quoteDate || '-'}</td>
                      <td className="px-4 py-3 fw-bold text-secondary" style={{ fontFamily: 'monospace' }}>{v.prNumber}</td>
                      <td className="px-4 py-3 text-muted">{v.prDate || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge rounded-pill px-3 py-2 fw-medium ${getStatusBadge(v.quoteStatus)}`}>{v.quoteStatus}</span>
                      </td>
                    </tr>
                    {expandedIdx === idx && (
                      <tr>
                        <td colSpan="6" className="p-0 border-0">
                          <div className="bg-light p-4 border-bottom">
                            <div className="d-flex flex-column gap-4">
                              <div className="bg-white border rounded p-4 shadow-sm">
                                <h6 className="text-uppercase fw-bold text-dark mb-3" style={{ fontSize: '13px', letterSpacing: '0.5px' }}>Item Details</h6>
                                <table className="table table-sm text-sm mb-0">
                                  <thead>
                                    <tr className="text-muted text-uppercase small">
                                      <th>Item Code</th>
                                      <th className="text-center">Quantity</th>
                                      <th className="text-end">Price</th>
                                      <th className="text-end">Freight</th>
                                      <th className="text-end">Discount</th>
                                      <th>Delivery Date</th>
                                      <th>Payment Terms</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(!v.items || v.items.length === 0) ? (
                                      <tr><td colSpan="7" className="text-muted py-3 text-center">No items listed</td></tr>
                                    ) : v.items.map((item, i) => (
                                      <tr key={i}>
                                        <td className="font-monospace text-primary">{item.itemCode || '-'}</td>
                                        <td className="text-center fw-medium">{item.itemQuantity || 0}</td>
                                        <td className="text-end fw-medium">{num(item.itemPrice)}</td>
                                        <td className="text-end">{num(item.itemFreight)}</td>
                                        <td className="text-end">{item.itemDiscount || 0}%</td>
                                        <td>{item.itemDeliveryDate || '-'}</td>
                                        <td className="text-muted">{item.itemPaymentTerms || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="bg-white border rounded p-4 shadow-sm">
                                <h6 className="text-uppercase fw-bold text-dark mb-3" style={{ fontSize: '13px', letterSpacing: '0.5px' }}>Standard Comparison & Compliance</h6>
                                <table className="table table-sm text-sm mb-0">
                                  <thead>
                                    <tr className="text-muted text-uppercase small">
                                      <th>Category</th>
                                      <th>Standard</th>
                                      <th>Compliance</th>
                                      <th className="text-center">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(!v.compliance || v.compliance.length === 0) ? (
                                      <tr><td colSpan="4" className="text-muted py-3 text-center">No compliance data</td></tr>
                                    ) : v.compliance.map((c, i) => (
                                      <tr key={i}>
                                        <td className="fw-medium">{c.category || '-'}</td>
                                        <td className="text-muted">{c.standard || '-'}</td>
                                        <td className="fw-medium">{c.compliance || '-'}</td>
                                        <td className="text-center"><span className={`badge ${getStatusBadge(c.status)}`}>{c.status}</span></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
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
      {!loading && <p className="text-muted small text-end">Showing {filtered.length} of {data.length} records</p>}

      {/* PR Selection Modal */}
      {showPrSelectModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '600px' }}>
            <div className="custom-modal-header bg-light">
              <h5 className="custom-modal-title text-dark fw-bold">
                <i className="fas fa-file-circle-check text-success me-2"></i> Select PR for Quotation
              </h5>
              <button className="custom-modal-close-btn" onClick={() => setShowPrSelectModal(false)}>&times;</button>
            </div>
            <div className="custom-modal-body p-0">
              <div className="table-responsive" style={{ maxHeight: '350px' }}>
                <table className="table table-hover align-middle mb-0 text-start" style={{ fontSize: '12px' }}>
                  <thead className="bg-light text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>
                    <tr>
                      <th className="ps-3 py-3">PR Number</th>
                      <th>Created By</th>
                      <th>Date</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingPrs ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4 text-muted">
                          <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                          Loading released purchase requisitions...
                        </td>
                      </tr>
                    ) : availablePrs.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4 text-muted">
                          No released or approved PRs available.
                        </td>
                      </tr>
                    ) : (
                      availablePrs.map((pr) => (
                        <tr key={pr.prNumber || pr.pr_number}>
                          <td className="ps-3 fw-bold text-success">{pr.prNumber || pr.pr_number}</td>
                          <td>{pr.createdBy || pr.created_by || 'System'}</td>
                          <td>{(pr.createdAt || pr.created_date || pr.prDate || '').substring(0, 10)}</td>
                          <td className="text-center">
                            <button
                              className="btn btn-sm btn-success py-1 px-3 fw-bold"
                              style={{ borderRadius: '6px', fontSize: '11px' }}
                              onClick={() => startQuoteFromPr(pr)}
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="custom-modal-footer bg-light p-3 text-end">
              <button
                className="btn btn-outline-success py-2 px-3 fw-bold"
                style={{ borderRadius: '6px' }}
                onClick={() => setShowPrSelectModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
