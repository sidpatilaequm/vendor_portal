import React, { useEffect, useState } from 'react';
import axios from 'axios';
import BackButton from '../common/BackButton';
import { useAuth } from '../../context/AuthContext';

export default function PrApprovalReport({ onBack }) {
  const { selectedCompanyCode } = useAuth();
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');
  const [company, setCompany] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Open');
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [showKpis, setShowKpis] = useState(false);

  const [realVendorName, setRealVendorName] = useState('');
  const [realVendorCode, setRealVendorCode] = useState('');
  const [vendorId, setVendorId] = useState('');

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
  }, [startDate, endDate, company, vendorId, realVendorCode, selectedCompanyCode]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const vId = vendorId || 1381; // fallback to 1381 if vendorId is somehow missing
      let endpoint = `/api/vendor/purchase-requisitions?vendor_id=${vId}`;
      if (company && company !== 'ALL') {
        endpoint += `&company_code=${company}`;
      } else {
        const cCode = selectedCompanyCode || localStorage.getItem('selected_company_code') || '1000';
        endpoint += `&company_code=${cCode}`;
      }
      const token = localStorage.getItem('auth_token');
      const response = await fetch(endpoint, {
        headers: {
          'X-Employee-Id': 'EMP001',
          'Authorization': `Bearer ${token}`
        }
      });
      const resData = await response.json();

      let items = [];
      if (Array.isArray(resData)) {
        items = resData;
      } else if (resData && Array.isArray(resData.prs)) {
        items = resData.prs;
      } else if (resData && Array.isArray(resData.content)) {
        items = resData.content;
      }

      // Group flat assignments into PRs with items
      if (items.length > 0 && items[0].assignmentId) {
        const groupedMap = {};
        items.forEach(item => {
          const prNum = item.prNumber || item.pr_number;
          if (!prNum) return;
          if (!groupedMap[prNum]) {
            groupedMap[prNum] = {
              id: item.id || item.assignmentId, 
              prNumber: prNum,
              createdAt: item.createdAt || item.sentDate || item.prDate,
              requiredDate: item.requiredDate || item.requestedDeliveryDate,
              paymentTerms: item.paymentTerms || item.requestedPaymentTerms,
              assignmentStatus: item.assignmentStatus || item.status,
              items: []
            };
          }
          groupedMap[prNum].items.push({
            id: item.assignmentId || item.id, 
            itemCode: item.materialSku || item.itemCode,
            itemDescription: item.materialName || `Material ${item.materialSku}`,
            quantity: item.quantity,
            uom: item.uom,
            requiredDate: item.requiredDate,
            status: item.assignmentStatus
          });
          
          if (['OPEN', 'PENDING', 'SENT', 'NOT RESPONDED'].includes(item.assignmentStatus?.toUpperCase())) {
            groupedMap[prNum].assignmentStatus = item.assignmentStatus;
          }
        });
        items = Object.values(groupedMap);
      }

      setData(items);

      if (resData && resData.summary) {
        setSummary(resData.summary);
      } else {
        setSummary({
          prApproved: 0,
          quoteToPR: 0,
          quoteWon: 0,
          quotationRejected: 0,
          prNotResponded: 0,
          slaAdherence: 0,
          winRate: 0,
          notRespondedPct: 0
        });
      }
    } catch (err) {
      setError('Failed to load requisition data');
      console.error("Error fetching PR data:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = data.filter(r => {
    const matchSearch = search === '' || (r.prNumber || '').toLowerCase().includes(search.toLowerCase());
    const rowStatus = r.vendorStatus || r.status || r.assignmentStatus || 'CREATED';
    const matchStatus = statusFilter === 'All' ||
      (statusFilter.toUpperCase() === 'OPEN' && ['PENDING', 'OPEN', 'SENT', 'NOT RESPONDED'].includes(rowStatus.toUpperCase())) ||
      rowStatus.toUpperCase() === statusFilter.toUpperCase();
    return matchSearch && matchStatus;
  }).sort((a, b) => {
    const prA = a.prNumber || '';
    const prB = b.prNumber || '';
    return prB.localeCompare(prA);
  });

  const exportCSV = () => {
    const headers = ['PR Number,PR Date,Item Code,Requested Delivery Date,Payment Terms,Status\n'];
    const rows = filtered.map(v => {
      const items = v.items || [];
      const vStatus = v.vendorStatus || v.status || v.assignmentStatus || 'CREATED';
      if (items.length === 0) {
        return `"${v.prNumber}","${v.createdAt || ''}","","${v.requiredDate || ''}","${v.paymentTerms || ''}","${vStatus}"\n`;
      }
      return items.map(item => `"${v.prNumber}","${v.createdAt || v.prDate || ''}","${item.itemCode || item.sku || ''}","${item.requestedDeliveryDate || item.requiredDate || v.requestedDeliveryDate || v.requiredDate || ''}","${v.requestedPaymentTerms || v.paymentTerms || ''}","${vStatus}"\n`).join('');
    });
    const csv = headers.join('') + rows.join('');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `purchase_requisition_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const [actionLoading, setActionLoading] = useState(null);

  const handleVendorAction = async (prId, action) => {
    setActionLoading(prId);
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(`/api/vendor/purchase-requisitions/${prId}/${action}`, {
        vendor_id: vendorId,
        vendor_code: realVendorCode
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchReport(); // Refresh the list
    } catch (err) {
      alert('Failed to ' + action + ' the PR. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status) => {
    if (!status) return 'bg-secondary bg-opacity-10 text-secondary';
    status = status.toUpperCase();
    if (status === 'ACKNOWLEDGED' || status === 'ACCEPTED' || status === 'APPROVED') return 'bg-success bg-opacity-10 text-success';
    if (status === 'CLOSED') return 'bg-info bg-opacity-10 text-info';
    if (status === 'REJECTED') return 'bg-danger bg-opacity-10 text-danger';
    if (status === 'NOT RESPONDED' || status === 'PENDING' || status === 'SENT' || status === 'OPEN') return 'bg-warning bg-opacity-10 text-warning';
    return 'bg-secondary bg-opacity-10 text-secondary';
  };


  return (
    <div className="p-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Poppins", sans-serif' }}>
      <BackButton onClick={onBack} />
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold text-dark mb-0">Purchase Requisition</h3>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger shadow-sm border-0"><i className="fas fa-exclamation-circle me-2"></i>{error}</div>
      )}

      {/* Vendor Summary Card */}
      {/* <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px', background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)' }}>
        <div className="card-body p-4">
          <div className="row">
            <div className="col-md-4 border-end">
              <p className="text-muted small text-uppercase fw-bold mb-1">Vendor Name</p>
              <p className="fw-bold fs-5 text-dark mb-0">{realVendorName || '-'}</p>
            </div>
            <div className="col-md-4">
              <p className="text-muted small text-uppercase fw-bold mb-1">Company Code</p>
              <p className="fw-bold fs-5 text-dark mb-0">{company || 'All'}</p>
            </div>
          </div>
        </div>
      </div> */}

      {/* KPI Cards */}


      {/* <h4 className="text-dark fw-bold mt-5 mb-3">Purchase Requisition</h4> */}

      {/* Filters */}
      <div className="d-flex flex-column flex-md-row gap-3 mb-4">
        <input type="text" placeholder="Filter by PR Number..." value={search} onChange={e => setSearch(e.target.value)} className="form-control shadow-sm border" style={{ padding: '10px 16px' }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-select shadow-sm border" style={{ width: '200px', padding: '10px 16px' }}>
          <option value="All">All Statuses</option>
          <option value="Open">Open</option>
          <option value="Acknowledged">Acknowledged</option>
          <option value="Closed">Closed</option>
          <option value="Rejected">Rejected</option>
          <option value="Accepted">Accepted</option>
        </select>
        <button
          className="btn btn-light text-secondary border shadow-sm d-flex align-items-center justify-content-center"
          style={{ borderRadius: '8px', padding: '10px 16px', minWidth: '48px', backgroundColor: showKpis ? '#f8f9fa' : '#ffffff' }}
          onClick={() => setShowKpis(!showKpis)}
          title={showKpis ? 'Hide Stats' : 'Show Stats'}
        >
          <i className={`fas fa-chart-bar fs-15 ${showKpis ? 'text-primary' : ''}`}></i>
        </button>
      </div>

      <div className="row g-4 mb-4" style={{ display: showKpis ? 'flex' : 'none' }}>
        {[
          { label: 'PR Approved', val: summary.prApproved || summary.approved_prs || summary.total || 0 },
          { label: 'PR to Quote', val: summary.quoteToPR || 0 },
          { label: 'Quote Won', val: summary.quoteWon || 0 },
          { label: 'Quotation Rejected', val: summary.quotationRejected || 0 },
          { label: 'PR Pending', val: summary.prNotResponded || 0 },
          { label: 'SLA Adherence', val: `${summary.slaAdherence || summary.within_sla_pct || 0}%` },
          { label: 'Win %', val: `${summary.winRate || 0}%` },
          { label: 'Pending %', val: `${summary.notRespondedPct || 0}%` }
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
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">PR Number</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">PR Date</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Requested Delivery Date</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Payment Terms</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Status</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-center text-uppercase">Action</th>

                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-4 text-muted">No records found</td></tr>
                ) : filtered.map((v, idx) => {
                  const items = v.items || [];
                  const displayStatus = v.vendorStatus || v.status || v.assignmentStatus || 'CREATED';
                  let dateStr = v.prDate || v.createdAt || '';
                  if (dateStr && dateStr.includes('T')) dateStr = dateStr.split('T')[0];

                  return (
                    <React.Fragment key={idx}>
                      <tr>
                        <td className="px-4 py-3">
                          <button onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)} className="btn btn-sm btn-link text-muted p-0 border-0">
                            <i className={`fas fa-chevron-${expandedIdx === idx ? 'down' : 'right'}`}></i>
                          </button>
                        </td>
                        <td className="px-4 py-3 fw-bold text-primary" style={{ fontFamily: 'monospace' }}>{v.prNumber}</td>
                        <td className="px-4 py-3 text-muted">{dateStr || '-'}</td>
                        <td className="px-4 py-3 text-muted">{v.requestedDeliveryDate || v.requiredDate || '-'}</td>
                        <td className="px-4 py-3 text-muted">{v.requestedPaymentTerms || v.paymentTerms || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`badge rounded-pill px-3 py-2 fw-medium ${getStatusBadge(displayStatus)}`}>{displayStatus}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {(!displayStatus || displayStatus.toUpperCase() === 'PENDING' || displayStatus.toUpperCase() === 'SENT' || displayStatus.toUpperCase() === 'NOT RESPONDED' || displayStatus.toUpperCase() === 'OPEN') ? (
                            <div className="d-flex justify-content-center gap-2">
                              <button
                                className="btn btn-sm btn-outline-success rounded-pill fw-bold"
                                style={{ fontSize: '11px', padding: '4px 12px' }}
                                disabled={actionLoading === v.id}
                                onClick={() => handleVendorAction(v.id, 'accept')}
                              >
                                {actionLoading === v.id ? <i className="fas fa-spinner fa-spin"></i> : 'Acknowledge'}
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger rounded-pill fw-bold"
                                style={{ fontSize: '11px', padding: '4px 12px' }}
                                disabled={actionLoading === v.id}
                                onClick={() => handleVendorAction(v.id, 'reject')}
                              >
                                {actionLoading === v.id ? <i className="fas fa-spinner fa-spin"></i> : 'Reject'}
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted small">-</span>
                          )}
                        </td>
                      </tr>
                      {expandedIdx === idx && (
                        <tr>
                          <td colSpan="6" className="p-0 border-0">
                            <div className="bg-light p-4 border-bottom">
                              <div className="bg-white border rounded p-4 shadow-sm">
                                <h6 className="text-uppercase fw-bold text-dark mb-3" style={{ fontSize: '13px', letterSpacing: '0.5px' }}>Item Details</h6>
                                <table className="table table-sm text-sm mb-0">
                                  <thead>
                                    <tr className="text-muted text-uppercase small">
                                      <th>Item Code</th>
                                      <th>Description</th>
                                      <th className="text-center">Quantity</th>
                                      <th>Delivery Date</th>
                                      <th>Payment Terms</th>
                                      <th className="text-center">Status</th>

                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.length === 0 ? (
                                      <tr><td colSpan="6" className="text-muted py-3 text-center">No items listed</td></tr>
                                    ) : items.map((item, i) => (
                                      <tr key={i}>
                                        <td className="font-monospace text-primary">{item.itemCode || item.sku || '-'}</td>
                                        <td className="text-muted">{item.itemDescription || '-'}</td>
                                        <td className="text-center fw-medium">{item.itemQuantity || item.quantity || 0}</td>
                                        <td>{item.requestedDeliveryDate || item.requiredDate || '-'}</td>
                                        <td className="text-muted">{item.requestedPaymentTerms || v.requestedPaymentTerms || v.paymentTerms || '-'}</td>
                                        <td className="text-center"><span className={`badge ${getStatusBadge(item.status || displayStatus)}`}>{item.status || displayStatus}</span></td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {!loading && <p className="text-muted small text-end">Showing {filtered.length} of {data.length} records</p>}
    </div>
  );
}
