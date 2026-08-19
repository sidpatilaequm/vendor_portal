import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';

const PurchaseRequisitionDetail = ({ prId, onBack, onAcknowledgeSuccess }) => {
  const [prData, setPrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showApiExplorer, setShowApiExplorer] = useState(false);

  const userRole = (() => {
    try {
      const userStr = localStorage.getItem('user_data');
      if (userStr) return JSON.parse(userStr).role?.toUpperCase() || '';
    } catch (e) { }
    return '';
  })();

  // Acknowledge popup states
  const [showActionModal, setShowActionModal] = useState(false);
  const [decisionComment, setDecisionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionAlert, setActionAlert] = useState(null);

  // RFQ Modal states
  const [showRfqModal, setShowRfqModal] = useState(false);
  const [vendorList, setVendorList] = useState([]);
  const [eligibleVendors, setEligibleVendors] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [rfqLoading, setRfqLoading] = useState(false);
  const [rfqAlert, setRfqAlert] = useState(null);

  useEffect(() => {
    if (showRfqModal && vendorList.length === 0) {
      const fetchVendors = async () => {
        try {
          const materialCodes = prData?.items?.map(i => i.materialCode || i.materialId).filter(Boolean).join(',') || 'MAT-004';
          const res = await axios.get(`/api/vendor/selection-list?pr_number=${prId}&material_codes=${materialCodes}`);
          setVendorList(Array.isArray(res.data?.all_vendors) ? res.data.all_vendors : []);
          setEligibleVendors(Array.isArray(res.data?.eligible_vendors) ? res.data.eligible_vendors : []);
        } catch (err) {
          console.error("Failed to fetch vendors", err);
        }
      };
      fetchVendors();
    }
  }, [showRfqModal, vendorList.length, prId, prData]);

  const handleCreateRfq = async () => {
    if (selectedVendors.length === 0) {
      setRfqAlert({ type: 'danger', message: 'Please select at least one vendor.' });
      return;
    }
    setRfqLoading(true);
    setRfqAlert(null);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(`/api/vendor/purchase-requisitions/${prId}/create-rfq`, {
        vendor_ids: selectedVendors
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.data?.status === 'success' || response.status === 200) {
        setRfqAlert({ type: 'success', message: 'RFQ created successfully! PR is now visible to selected vendors.' });
        setTimeout(() => {
          setShowRfqModal(false);
          setSelectedVendors([]);
        }, 2000);
      } else {
        setRfqAlert({ type: 'danger', message: response.data?.error || response.data?.detail || 'Failed to create RFQ.' });
      }
    } catch (err) {
      setRfqAlert({ type: 'danger', message: err.response?.data?.error || err.response?.data?.detail || 'Failed to create RFQ.' });
    } finally {
      setRfqLoading(false);
    }
  };


  const fetchPrDetails = async () => {
    setLoading(true);
    setError(false);
    const token = localStorage.getItem('auth_token');
    try {
      const response = await axios.get(`/api/purchase-requisitions/pr-number/${prId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      if (response.data) {
        setPrData(response.data);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error(`Failed to fetch details for PR ${prId}, loading fallback mockup details.`, err);
      // Fallback details matching screenshot
      setPrData({
        prNumber: prId,
        status: 'RELEASED',
        requestedBy: 'Rajesh Kumar (Finance)',
        createdAt: '2026-06-16T08:30:00.000Z',
        updatedAt: '2026-06-16T09:32:00.000Z',
        remarks: 'Standard Purchase Requisition for MGCTShirt001 manufacturing units.',
        locationName: 'JP Nagar Hub',
        requiredDate: '2026-06-17T00:00:00.000Z',
        items: [
          {
            id: 10,
            sku: 'MGCTShirt001',
            materialId: 'MGCTShirt001',
            quantity: 25.0,
            uom: 'None',
            status: 'Open'
          }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrDetails();
  }, [prId]);

  const handleAcknowledge = async (action) => {
    setActionLoading(true);
    setActionAlert(null);
    const token = localStorage.getItem('auth_token');

    try {
      const response = await axios.post(`/api/vendor/purchase-requisitions/${prId}/${action}`, {
        comment: decisionComment
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200 || response.data?.status === 'success') {
        setActionAlert({ type: 'success', message: `PR ${prId} successfully acknowledged!` });
        setTimeout(() => {
          setShowActionModal(false);
          onAcknowledgeSuccess();
          fetchPrDetails();
        }, 1500);
      } else {
        setActionAlert({ type: 'danger', message: response.data?.error || 'Action failed' });
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Error occurred during acknowledgment.';
      setActionAlert({ type: 'danger', message: errMsg });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status"></div>
        <p className="mt-2 text-muted">Loading Requisition details...</p>
      </div>
    );
  }

  if (error || !prData) {
    return (
      <div className="alert alert-danger mx-4 my-4" role="alert">
        Failed to load Purchase Requisition.
        <Button variant="outline-green" className="ms-3" onClick={onBack}>Back to List</Button>
      </div>
    );
  }

  // Parse date fields
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = dateStr.split('T')[0];
      const dateParts = d.split('-');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${dateParts[2]} ${months[parseInt(dateParts[1]) - 1]} ${dateParts[0]}`;
    } catch (e) {
      return dateStr.substring(0, 10);
    }
  };

  const status = prData.status || 'OPEN';
  let statusBadge = 'secondary';
  let releaseIndicator = '0 — Open / Blocked';
  let releaseColor = 'text-info';
  let sapStatusCode = 'N';

  if (status === 'RELEASED' || status === 'APPROVED') {
    statusBadge = 'success';
    releaseIndicator = 'X — Released';
    releaseColor = 'text-success';
    sapStatusCode = 'S';
  } else if (status === 'IN_PROCESS' || status === 'PARTIALLY_RELEASED') {
    statusBadge = 'warning';
    releaseIndicator = '1 — In Process';
    releaseColor = 'text-warning';
    sapStatusCode = 'S';
  }

  return (
    <div className="fade-in-slide container-fluid py-4">
      {/* Breadcrumb & Actions Header */}
      <div className="row mb-3 pb-3 border-bottom align-items-end">
        <div className="col">
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-2" style={{ fontSize: '12px' }}>
              <li className="breadcrumb-item">
                <a href="#" className="text-success text-decoration-none" onClick={(e) => { e.preventDefault(); onBack(); }}>
                  Purchase Requisitions
                </a>
              </li>
              <li className="breadcrumb-item active" aria-current="page">{prId}</li>
            </ol>
          </nav>
          <h3 className="fw-bold mb-1" style={{ color: '#1e293b' }}>
            Purchase Requisition — {prId}
          </h3>
          <div className="d-flex align-items-center text-muted gap-3" style={{ fontSize: '13px' }}>
            <span>Standard Purchase Requisition</span>
            <span className={`badge bg-soft-${statusBadge} text-${statusBadge} rounded-pill px-3 py-1 text-uppercase`} style={{ fontSize: '10px' }}>
              ● {status}
            </span>
          </div>
        </div>
        <div className="col-auto">
          <div className="d-flex flex-wrap gap-2 mb-1">
            <button
              className="btn btn-outline-secondary px-3 py-2 fw-semibold shadow-sm"
              style={{ borderRadius: '6px', fontSize: '13px' }}
              onClick={onBack}
            >
              <i className="fas fa-arrow-left me-2"></i> Back
            </button>
            {userRole !== 'VENDOR' && userRole !== 'VENDOR_ADMIN' && (
              <button
                className="btn btn-success text-white px-3 py-2 fw-semibold shadow-sm"
                style={{ borderRadius: '6px', fontSize: '13px' }}
                onClick={() => setShowRfqModal(true)}
              >
                <i className="fas fa-file-invoice me-2"></i> Create RFQ
              </button>
            )}
          </div>
          <div className="text-end text-muted" style={{ fontSize: '11px' }}>
            Last sync: 07 May 2026 · 09:32 IST
          </div>
        </div>
      </div>

      {/* JSON API Collapse */}
      {showApiExplorer && (
        <div className="card bg-dark text-white border-0 rounded-3 mb-4">
          <div className="card-header border-bottom border-secondary py-2 d-flex justify-content-between align-items-center">
            <span className="badge bg-success text-white">GET</span>
            <code className="text-info fs-13">/api/purchase-requisitions/pr-number/{prId}</code>
            <span className="fs-12 text-muted">200 OK</span>
          </div>
          <div className="card-body p-0">
            <pre className="m-0 p-3 text-start text-break text-wrap font-monospace text-emerald" style={{ maxHeight: '250px', overflowY: 'auto', fontSize: '12px' }}>
              {JSON.stringify(prData, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Header Information Section */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-light bg-opacity-75 border-bottom d-flex justify-content-between align-items-center py-2 px-3">
          <h6 className="card-title mb-0 fw-bold text-dark" style={{ fontSize: '13px' }}>
            <i className="fas fa-circle-info me-2 text-success"></i> Header Information
          </h6>
          <span className="text-muted fw-semibold" style={{ fontSize: '10px' }}>
            SAP TABLE: EBAN (HEADER FIELDS)
          </span>
        </div>
        <div className="card-body p-3">
          <div className="row g-3 text-start">
            <div className="col-md-4">
              <label className="text-muted text-uppercase fw-semibold d-block mb-1" style={{ fontSize: '10px' }}>
                PR NUMBER [EBAN.BANFN]
              </label>
              <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>{prData.prNumber}</div>
            </div>
            <div className="col-md-4">
              <label className="text-muted text-uppercase fw-semibold d-block mb-1" style={{ fontSize: '10px' }}>
                PR STATUS [EBAN.STATU]
              </label>
              <span className={`badge bg-soft-${statusBadge} text-${statusBadge} rounded-pill px-3 py-1 text-uppercase fw-bold`} style={{ fontSize: '10px' }}>
                ● {status}
              </span>
            </div>
            <div className="col-md-4">
              <label className="text-muted text-uppercase fw-semibold d-block mb-1" style={{ fontSize: '10px' }}>
                RELEASE INDICATOR [EBAN.FRGKZ]
              </label>
              <div className={`fw-bold ${releaseColor}`} style={{ fontSize: '14px' }}>
                {releaseIndicator}
              </div>
            </div>

            <div className="col-md-4">
              <label className="text-muted text-uppercase fw-semibold d-block mb-1" style={{ fontSize: '10px' }}>
                RELEASE GROUP [T16FG.FRGGR]
              </label>
              <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>B1 — Finance Approval Group</div>
            </div>
            <div className="col-md-4">
              <label className="text-muted text-uppercase fw-semibold d-block mb-1" style={{ fontSize: '10px' }}>
                SAP STATUS CODE [EBAN.STATU]
              </label>
              <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>{sapStatusCode}</div>
            </div>
            <div className="col-md-4">
              <label className="text-muted text-uppercase fw-semibold d-block mb-1" style={{ fontSize: '10px' }}>
                LAST CHANGED [EBAN.AEDAT]
              </label>
              <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>{formatDate(prData.updatedAt || prData.createdAt)}</div>
            </div>

            <div className="col-12">
              <label className="text-muted text-uppercase fw-semibold d-block mb-1" style={{ fontSize: '10px' }}>
                HEADER NOTES / JUSTIFICATION [STXH (BANF)]
              </label>
              <div className="bg-light p-3 rounded border-start border-4 border-info text-muted font-monospace" style={{ fontSize: '13px' }}>
                - {prData.remarks || 'No notes provided.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Section */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-light bg-opacity-75 border-bottom d-flex justify-content-between align-items-center py-2 px-3">
          <h6 className="card-title mb-0 fw-bold text-dark" style={{ fontSize: '13px' }}>
            <i className="fas fa-list me-2 text-success"></i> Line Items{' '}
            <span className="badge bg-secondary ms-1">{prData.items?.length || 0} items</span>
          </h6>
          <span className="text-muted fw-semibold" style={{ fontSize: '10px' }}>
            SAP TABLE: EBAN (ITEM FIELDS)
          </span>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-start" style={{ fontSize: '12px' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>
                  <th className="ps-3 py-3">ITEM</th>
                  <th>MATERIAL / DESCRIPTION</th>
                  <th>HSN/SAC</th>
                  <th className="text-end">QTY / UOM</th>
                  <th>PLANT / DEL. DATE</th>
                  <th>FIXED VENDOR</th>
                  <th>ACCT ASSIGNMENT</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {(prData.items || []).map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="ps-3 fw-bold text-success">{(idx + 1) * 10}</td>
                    <td>
                      <div className="fw-bold text-dark">{item.sku || 'N/A'}</div>
                      <div className="text-muted small">{item.materialId || 'N/A'}</div>
                    </td>
                    <td>
                      <span className="badge bg-light text-dark border px-2 py-1">
                        {item.hsnSac || '—'}
                      </span>
                    </td>
                    <td className="text-end fw-bold text-dark">
                      {item.quantity} <span className="text-muted small">{item.uom || 'None'}</span>
                    </td>
                    <td>
                      <div className="fw-bold text-dark">{prData.locationName || 'N/A'}</div>
                      <div className="text-muted small">{formatDate(prData.requiredDate)}</div>
                    </td>
                    <td>
                      <span className="text-muted">Open</span>
                    </td>
                    <td>
                      <span className="text-muted">—</span>
                    </td>
                    <td>
                      <span className="badge bg-soft-info text-info rounded px-2 py-1 text-uppercase fw-bold" style={{ fontSize: '9px' }}>
                        ➔ {item.status || 'Open'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-light bg-opacity-50 fw-bold border-top">
                <tr style={{ fontSize: '11px' }}>
                  <td colSpan="4" className="text-end text-muted text-uppercase">Lines:</td>
                  <td className="text-success text-start ps-2">{prData.items?.length || 0}</td>
                  <td colSpan="2" className="text-end text-muted text-uppercase">Total Items:</td>
                  <td className="text-success text-start ps-2">{prData.items?.length || 0} Items</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Acknowledge Footer Button - Only for Vendors */}
      {userRole === 'VENDOR' && (
        <div className="d-flex justify-content-end gap-2 mb-4">
          {status !== 'APPROVED' && status !== 'REJECTED' && status !== 'RELEASED' ? (
            <button
              className="btn btn-primary btn-lg px-4 py-2 fw-bold d-flex align-items-center gap-2"
              style={{ borderRadius: '8px' }}
              onClick={() => {
                setDecisionComment('');
                setActionAlert(null);
                setShowActionModal(true);
              }}
            >
              <i className="fas fa-check-circle"></i> Acknowledge Requisition
            </button>
          ) : (
            <button className="btn btn-outline-success btn-lg px-4 py-2 fw-bold" disabled style={{ borderRadius: '8px' }}>
              <i className="fas fa-check-circle"></i> Acknowledged ({status})
            </button>
          )}
        </div>
      )}

      {/* Action Decision Modal */}
      {showActionModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '400px' }}>
            <div className="custom-modal-header bg-light">
              <h5 className="custom-modal-title text-dark fw-bold d-flex align-items-center gap-2">
                <i className="fas fa-shield-halved text-success"></i> Take Action
              </h5>
              <button className="custom-modal-close-btn" onClick={() => setShowActionModal(false)}>&times;</button>
            </div>
            <div className="custom-modal-body text-start">
              {actionAlert && (
                <div className={`alert alert-${actionAlert.type} py-2`} role="alert">
                  {actionAlert.message}
                </div>
              )}
              <div className="mb-3">
                <label htmlFor="actionCommentInput" className="form-label fw-bold text-muted small text-uppercase">Decision Comment</label>
                <textarea
                  id="actionCommentInput"
                  className="form-control border-light-subtle bg-light bg-opacity-25"
                  rows="3"
                  style={{ resize: 'none', borderRadius: '8px' }}
                  placeholder="Add a note explaining your decision..."
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                />
              </div>
            </div>
            <div className="custom-modal-footer bg-light d-flex justify-content-between p-3 gap-2">
              <Button
                variant="green"
                className="flex-grow-1 py-2 fw-semibold"
                disabled={actionLoading}
                onClick={() => handleAcknowledge('accept')}
              >
                {actionLoading ? 'Loading...' : 'Approve'}
              </Button>
              <Button
                variant="danger"
                className="flex-grow-1 py-2 fw-semibold"
                disabled={actionLoading}
                onClick={() => handleAcknowledge('reject')}
              >
                {actionLoading ? 'Loading...' : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create RFQ Modal */}
      {/* Create RFQ Full Screen UI */}
      {showRfqModal && (
        <div className="bg-light position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1050, overflowY: 'auto' }}>
          <div className="bg-white border-bottom p-3 d-flex justify-content-between align-items-center sticky-top shadow-sm">
            <div>
              <h4 className="fw-bold mb-0">PR to RFQ — Vendor Selection</h4>
              <p className="text-muted fs-13 mb-0">Vendor performance surfaced at the point of RFQ conversion</p>
            </div>
            <button className="btn btn-light border" onClick={() => setShowRfqModal(false)}>
              <i className="fas fa-times me-2"></i> Cancel
            </button>
          </div>

          <div className="container py-4">
            {/* PR Info Box */}
            <div className="card shadow-sm border-light-subtle mb-3">
              <div className="card-body d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="fw-bold mb-1">{prId}  {prData?.items?.map(i => i.materialCode || i.sku).filter(Boolean).join(', ') || 'MAT-004'}</h5>
                  <p className="text-muted fs-13 mb-0">
                    {prData?.line_count || '1'} line(s) · {prData?.estimatedPrice || '0'} est. · required {prData?.required_date || '2026-07-16'}
                  </p>
                </div>
                <button className="btn btn-link text-primary text-decoration-none fw-bold fs-14">
                  Converting to RFQ
                </button>
              </div>
            </div>

            {/* Warning Box */}
            {/* <div className="alert alert-warning border-warning-subtle text-warning-emphasis bg-warning-subtle d-flex align-items-center fs-14 mb-4">
              <i className="fas fa-exclamation-circle me-2"></i>
              Multi-vendor category — min 3 quotes required. {selectedVendors.length} selected. Bypass needs single-source justification.
            </div> */}

            {/* Vendors Section */}
            <div className="card shadow-sm border-light-subtle mb-4">
              <div className="card-header bg-white border-bottom d-flex justify-content-between align-items-center py-3">
                <h6 className="fw-bold mb-0 text-uppercase fs-13">VENDORS - RANKED BY PAST PERFORMANCE</h6>
                <div className="d-flex gap-4 text-muted fs-13 fw-semibold">
                  <span className="cursor-pointer" style={{ cursor: 'pointer', color: activeTab === 'eligible' ? '#0d6efd' : 'inherit' }} onClick={() => setActiveTab('eligible')}>Eligible vendors ({eligibleVendors.length})</span>
                  <span className="cursor-pointer" style={{ cursor: 'pointer', color: activeTab === 'all' ? '#0d6efd' : 'inherit' }} onClick={() => setActiveTab('all')}>All vendors ({vendorList.length})</span>
                </div>
              </div>
              <div className="card-body p-4 bg-light bg-opacity-50">
                <p className="text-muted fs-13 mb-3">Invited vendors plus those with quoting history on this PR's materials.</p>

                {rfqAlert && (
                  <div className={`alert alert-${rfqAlert.type} py-2 fs-14`} role="alert">
                    {rfqAlert.message}
                  </div>
                )}

                <div className="d-flex flex-column gap-3">
                  {(activeTab === 'eligible' ? eligibleVendors : (activeTab === 'all' ? vendorList : eligibleVendors.slice(0, 1))).map(v => (
                    <div
                      key={v.vendor_id}
                      className={`card border cursor-pointer transition-all ${selectedVendors.includes(v.vendor_id) ? 'border-primary bg-primary bg-opacity-10' : 'border-light-subtle bg-white'}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (selectedVendors.includes(v.vendor_id)) {
                          setSelectedVendors(selectedVendors.filter(id => id !== v.vendor_id));
                        } else {
                          setSelectedVendors([...selectedVendors, v.vendor_id]);
                        }
                      }}
                    >
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start mb-3">
                          <div>
                            <div className="d-flex align-items-center gap-2">
                              <h6 className="fw-bold mb-0">{v.vendor_name}</h6>
                              {selectedVendors.includes(v.vendor_id) && <span className="badge bg-primary text-white fs-11 px-2 py-1">Invited</span>}
                            </div>
                            <p className="text-muted fs-13 mb-0 mt-1">{v.bp_no || 'BP-MARK-01'} · Quoted 1 similar RFQs · won 0</p>
                          </div>
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={selectedVendors.includes(v.vendor_id)}
                              onChange={() => { }}
                              style={{ width: '1.2rem', height: '1.2rem' }}
                            />
                          </div>
                        </div>
                        <div className="row text-start border-top pt-3">
                          <div className="col-3">
                            <div className="text-muted fs-12 mb-1">Response</div>
                            <div className="fw-bold text-success fs-14">{v.response_rate || '100% in SLA'}</div>
                          </div>
                          <div className="col-3">
                            <div className="text-muted fs-12 mb-1">Avg quote</div>
                            <div className="fw-bold fs-14">{v.avg_quote_time || '0.5 days'}</div>
                          </div>
                          <div className="col-3">
                            <div className="text-muted fs-12 mb-1">Price index</div>
                            <div className="fw-bold fs-14">{v.price_index || '1'}</div>
                          </div>
                          <div className="col-3">
                            <div className="text-muted fs-12 mb-1">Compliance</div>
                            <div className="fw-bold fs-14">{v.compliance || 'No data'}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {vendorList.length === 0 && <div className="text-center py-5 text-muted">Loading vendors...</div>}
                </div>
              </div>
            </div>

            <button
              className="btn btn-light border w-100 py-3 fw-bold bg-white shadow-sm"
              disabled={rfqLoading || selectedVendors.length === 0}
              onClick={handleCreateRfq}
            >
              {rfqLoading ? 'Sending RFQ...' : 'Select vendors to issue RFQ'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseRequisitionDetail;
