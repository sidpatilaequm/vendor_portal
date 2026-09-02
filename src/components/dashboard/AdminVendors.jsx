import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';
import BackButton from '../common/BackButton';

const AdminVendors = ({ onBack }) => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  
  // Modals state
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [kycRemarks, setKycRemarks] = useState('');
  const [kycSuccessMsg, setKycSuccessMsg] = useState('');

  // Full profile — fetched on demand when the details modal opens, since the list row only
  // carries a handful of summary fields (see fetchVendors), not the full application.
  const [vendorDetail, setVendorDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  const openVendorDetails = (vendor) => {
    setSelectedVendor(vendor);
    setShowDetailsModal(true);
    setVendorDetail(null);
    setDetailError('');
    if (!vendor.registrationId) {
      setDetailError('No linked application on file for this vendor.');
      return;
    }
    setLoadingDetail(true);
    const token = localStorage.getItem('auth_token');
    axios.get(`/api/supplier-registration/${vendor.registrationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => setVendorDetail(res.data?.data?.result || null))
      .catch((err) => setDetailError(err.response?.data?.statusMsg || 'Could not load the full profile.'))
      .finally(() => setLoadingDetail(false));
  };

  // Fallback mock vendor list if backend returns empty or errors
  const mockVendors = [];

  const fetchVendors = () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    axios.get('/api/vendors/all', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      let data = [];
      if (res.data) {
        if (Array.isArray(res.data)) {
          data = res.data;
        } else if (res.data.vendors) {
          data = res.data.vendors;
        } else if (res.data.data && res.data.data.vendors) {
          data = res.data.data.vendors;
        } else if (res.data.data && Array.isArray(res.data.data)) {
          data = res.data.data;
        }
      }
      if (data && data.length > 0) {
        // Normalize fields for AdminVendors UI — backend_java's /api/vendors/all returns
        // camelCase keys (Jackson default), not the snake_case this used to assume back when
        // this call was silently misrouted to a different (Python/snake_case) backend and
        // falling back to mock data on every real request. See vite.config.js.
        const mapped = data.map(v => ({
          ...v,
          id: v.vendorId || v.companyId || v.id,
          gstin: v.gstNumber || v.gstin || '',
          pan: v.pan || '',
          phone: v.phoneNumber || v.phone || '',
          contactPerson: v.contactPerson || [v.firstName, v.lastName].filter(Boolean).join(' '),
          kycStatus: v.kycStatus || 'VERIFIED',
          status: v.status || 'ACTIVE',
          location: v.cityName || v.location || 'Location not specified'
        }));
        setVendors(mapped);
      } else {
        setVendors([]);
      }
    })
    .catch(err => {
      console.error('Failed to load vendors, loading fallback mock data.', err);
      setVendors([]);
    })
    .finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleVerifyKyc = (status) => {
    setKycSuccessMsg('');
    const token = localStorage.getItem('auth_token');
    // Call the verification API
    axios.post(`/api/verification/kyc/submit`, {
      vendorId: selectedVendor.id,
      status: status,
      remarks: kycRemarks
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      setKycSuccessMsg(`KYC successfully ${status === 'APPROVED' ? 'Verified' : 'Rejected'}!`);
      // Update vendor state locally
      setVendors(vendors.map(v => v.id === selectedVendor.id ? { 
        ...v, 
        kycStatus: status === 'APPROVED' ? 'VERIFIED' : 'REJECTED',
        status: status === 'APPROVED' ? 'ACTIVE' : 'PENDING_KYC'
      } : v));
      setTimeout(() => {
        setShowKycModal(false);
        setKycSuccessMsg('');
        setKycRemarks('');
      }, 1500);
    })
    .catch(err => {
      console.error('KYC update error:', err);
      setKycSuccessMsg(`Error completing KYC update: ${err.response?.data?.error || err.message}`);
    });
  };

  const handleDeactivate = (vendorId) => {
    if (window.confirm("Are you sure you want to deactivate this vendor?")) {
      setVendors(vendors.map(v => v.id === vendorId ? { ...v, status: 'INACTIVE' } : v));
    }
  };

  // Filters
  const filteredVendors = vendors.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          v.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.gstin.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    const matchesCategory = categoryFilter === 'ALL' || (v.vendorCategory || '').split(',').includes(categoryFilter);
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const CATEGORY_LABELS = {
    PRODUCT: 'Product',
    SERVICE: 'Service',
    SCHEDULING_AGREEMENT: 'Scheduling agreement',
    SUBCONTRACTING: 'Sub-contracting'
  };

  return (
    <div className="fade-in-slide container-fluid py-4 bg-light bg-opacity-50" style={{ minHeight: '100%' }}>
      <BackButton onClick={onBack} />
      {/* Header */}
      <div className="row align-items-center mb-4 text-start">
        <div className="col">
          <h4 className="fw-bold mb-1 text-dark">Vendors Management</h4>
          <p className="text-muted mb-0 small">Approve, audit, and manage compliance details of all suppliers.</p>
        </div>
        <div className="col-auto">
          <Button onClick={fetchVendors} className="btn-light border btn-sm">
            <i className="fas fa-sync-alt me-1"></i> Refresh
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            <div className="col-md-5 text-start">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0 text-muted">
                  <i className="fas fa-search"></i>
                </span>
                <input 
                  type="text" 
                  className="form-control border-start-0 ps-0"
                  placeholder="Search by vendor name, email, or GSTIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
            </div>
            <div className="col-md-4 d-flex gap-2">
              <select 
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ fontSize: '13px' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Vendors</option>
                <option value="PENDING_KYC">Pending KYC</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <select
                className="form-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ fontSize: '13px' }}
              >
                <option value="ALL">All Vendor Types</option>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Vendors Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted fw-bold" style={{ fontSize: '11px' }}>
                <tr>
                  <th scope="col" className="ps-4 py-3">Vendor Name</th>
                  <th scope="col">Contact Info</th>
                  <th scope="col">GSTIN / PAN</th>
                  <th scope="col">Vendor Type</th>
                  <th scope="col">Compliance Status</th>
                  <th scope="col">Account Status</th>
                  <th scope="col" className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                      Loading vendors...
                    </td>
                  </tr>
                ) : filteredVendors.length > 0 ? (
                  filteredVendors.map((vendor) => (
                    <tr key={vendor.id}>
                      <td className="ps-4">
                        <div className="fw-bold text-dark" style={{ fontSize: '13.5px' }}>{vendor.name}</div>
                        <small className="text-muted d-block">{vendor.location || 'Location not specified'}</small>
                      </td>
                      <td>
                        <div className="small">{vendor.email}</div>
                        <div className="text-muted small" style={{ fontSize: '11px' }}>{vendor.phone}</div>
                      </td>
                      <td>
                        <div className="small font-monospace">{vendor.gstin}</div>
                        <div className="text-muted small font-monospace" style={{ fontSize: '11px' }}>PAN: {vendor.pan}</div>
                      </td>
                      <td>
                        {vendor.vendorCategory ? (
                          <div className="d-flex flex-wrap gap-1">
                            {vendor.vendorCategory.split(',').map((c) => (
                              <span key={c} className="badge bg-secondary-subtle text-secondary border border-secondary-subtle px-2.5 py-1 rounded-pill">
                                {CATEGORY_LABELS[c] || c}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted small">Not classified</span>
                        )}
                      </td>
                      <td>
                        {vendor.kycStatus === 'VERIFIED' ? (
                          <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 rounded-pill">KYC Verified</span>
                        ) : (
                          <span className="badge bg-warning-subtle text-warning border border-warning-subtle px-2.5 py-1 rounded-pill">Pending Audit</span>
                        )}
                      </td>
                      <td>
                        {vendor.status === 'ACTIVE' ? (
                          <span className="badge bg-success text-white px-2 py-0.5" style={{ fontSize: '10px', borderRadius: '4px' }}>Active</span>
                        ) : vendor.status === 'PENDING_KYC' ? (
                          <span className="badge bg-warning text-dark px-2 py-0.5" style={{ fontSize: '10px', borderRadius: '4px' }}>Pending KYC</span>
                        ) : (
                          <span className="badge bg-danger text-white px-2 py-0.5" style={{ fontSize: '10px', borderRadius: '4px' }}>Inactive</span>
                        )}
                      </td>
                      <td className="text-end pe-4">
                        <div className="btn-group gap-1">
                          <button
                            className="btn btn-light btn-sm border px-2 py-1"
                            onClick={() => openVendorDetails(vendor)}
                            title="View Profile Details"
                          >
                            <i className="fas fa-eye text-primary"></i>
                          </button>
                          <button 
                            className="btn btn-light btn-sm border px-2 py-1"
                            onClick={() => {
                              setSelectedVendor(vendor);
                              setKycRemarks('');
                              setShowKycModal(true);
                            }}
                            title="Audit Documents"
                          >
                            <i className="fas fa-file-signature text-warning"></i>
                          </button>
                          {vendor.status === 'ACTIVE' && (
                            <button 
                              className="btn btn-light btn-sm border px-2 py-1"
                              onClick={() => handleDeactivate(vendor.id)}
                              title="Deactivate Account"
                            >
                              <i className="fas fa-user-slash text-danger"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      <i className="fas fa-box-open fa-2x mb-2 d-block opacity-50"></i>
                      No vendors matched your query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedVendor && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '760px' }}>
            <div className="custom-modal-header bg-success bg-opacity-5">
              <h5 className="custom-modal-title fw-bold text-success">
                <i className="fas fa-building me-2"></i>Supplier Profile Detail
              </h5>
              <button className="custom-modal-close-btn" onClick={() => setShowDetailsModal(false)}>&times;</button>
            </div>
            <div className="custom-modal-body p-4 text-start" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {loadingDetail && <div className="text-muted small">Loading full profile…</div>}
              {!loadingDetail && detailError && <div className="text-danger small">{detailError}</div>}
              {!loadingDetail && vendorDetail && (
                <VendorFullProfile detail={vendorDetail} />
              )}
            </div>
            <div className="custom-modal-footer">
              <button className="btn btn-outline-secondary px-4 fw-semibold" onClick={() => setShowDetailsModal(false)} style={{ borderRadius: '8px', fontSize: '12px' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* KYC / Audit Modal */}
      {showKycModal && selectedVendor && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '500px' }}>
            <div className="custom-modal-header bg-success bg-opacity-5">
              <h5 className="custom-modal-title fw-bold text-success">
                <i className="fas fa-file-contract me-2"></i>Audit KYC Documents
              </h5>
              <button className="custom-modal-close-btn" onClick={() => setShowKycModal(false)}>&times;</button>
            </div>
            <div className="custom-modal-body p-4 text-start">
              <p className="text-muted small">Perform audit compliance check on <strong>{selectedVendor.name}</strong> files.</p>
              
              <div className="p-3 border rounded bg-light mb-3">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <span className="small fw-bold">GSTIN Certificate (PDF)</span>
                  <a href="#" className="btn btn-link btn-sm text-success p-0 small" onClick={(e) => { e.preventDefault(); alert('Downloading GST Certificate...'); }}><i className="fas fa-download"></i> View File</a>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <span className="small fw-bold">PAN Card Copy (PDF)</span>
                  <a href="#" className="btn btn-link btn-sm text-success p-0 small" onClick={(e) => { e.preventDefault(); alert('Downloading PAN Card Copy...'); }}><i className="fas fa-download"></i> View File</a>
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="kycRemarks" className="form-label fw-bold text-muted text-uppercase" style={{ fontSize: '10px' }}>Audit Verification Remarks</label>
                <textarea 
                  className="form-control" 
                  id="kycRemarks" 
                  rows="3" 
                  placeholder="Enter compliance details or rejection reasons..."
                  value={kycRemarks}
                  onChange={(e) => setKycRemarks(e.target.value)}
                  style={{ fontSize: '12px' }}
                />
              </div>

              {kycSuccessMsg && (
                <div className={`alert ${kycSuccessMsg.includes('Error') ? 'alert-danger' : 'alert-success'} py-2 mb-0`} style={{ fontSize: '12px' }}>
                  {kycSuccessMsg}
                </div>
              )}
            </div>
            <div className="custom-modal-footer gap-2">
              <button 
                className="btn btn-outline-danger px-4 fw-semibold" 
                onClick={() => handleVerifyKyc('REJECTED')}
                style={{ borderRadius: '8px', fontSize: '12px' }}
              >
                Reject KYC
              </button>
              <button 
                className="btn btn-success px-4 fw-bold shadow-sm" 
                onClick={() => handleVerifyKyc('APPROVED')}
                style={{ backgroundColor: '#293383', borderColor: '#293383', borderRadius: '8px', fontSize: '12px' }}
              >
                Approve & Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Full profile shown in the "View Profile Details" modal ────────────────
// Everything on file for this vendor's application — not just the summary
// columns the list view shows. Fed by GET /api/supplier-registration/{id},
// the same detail SupplierRegistrationService builds for the approver's
// review screen (backend_java's buildRegistrationDetail).

const PROFILE_CATEGORY_LABELS = {
  PRODUCT: 'Product',
  SERVICE: 'Service',
  SCHEDULING_AGREEMENT: 'Scheduling agreement',
  SUBCONTRACTING: 'Sub-contracting',
};

const Field = ({ label, value, mono }) => (
  <div className="col-sm-6">
    <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>{label}</label>
    <div className={`small fw-semibold ${mono ? 'font-monospace' : ''}`}>{value || '—'}</div>
  </div>
);

const Section = ({ title, children }) => (
  <div className="mb-4">
    <div className="fw-bold text-success text-uppercase mb-2" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>{title}</div>
    <div className="row g-3">{children}</div>
  </div>
);

function VendorFullProfile({ detail }) {
  const reg = detail.registration || {};
  const documents = detail.documents || [];
  const attachments = detail.attachments || [];
  const dynamicAnswers = detail.dynamicAnswers || [];

  const hasSecondContact = reg.contact2Name || reg.contact2Email || reg.contact2Phone;

  const answerText = (a) => {
    if (a.questionType === 'table') return `${(a.rows || []).length} row(s)`;
    if (a.selectedLabels && a.selectedLabels.length) return a.selectedLabels.join(', ');
    return a.textValue || '—';
  };

  return (
    <>
      <Section title="Company">
        <div className="col-12">
          <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Company Legal Name</label>
          <div className="fw-bold fs-5 text-dark">{reg.vendorName || '—'}</div>
        </div>
        <Field label="Address" value={reg.address} />
        <Field label="Company Type" value={reg.companyType} />
        <Field
          label="Vendor Type"
          value={reg.vendorCategory ? reg.vendorCategory.split(',').map((c) => PROFILE_CATEGORY_LABELS[c] || c).join(', ') : 'Not classified'}
        />
        <Field label="Business Type(s)" value={reg.businessTypes} />
        <Field label="Business Scope" value={reg.businessScope} />
        <Field label="Status" value={reg.status} />
        <Field label="Vendor Code" value={reg.vendorCode} mono />
      </Section>

      <Section title="Primary Contact">
        <Field label="Name" value={reg.contact1Name} />
        <Field label="Designation" value={reg.contact1Role} />
        <Field label="Email" value={reg.contact1Email} />
        <Field label="Phone" value={reg.contact1Phone} />
      </Section>

      {hasSecondContact && (
        <Section title="Secondary Contact">
          <Field label="Name" value={reg.contact2Name} />
          <Field label="Designation" value={reg.contact2Role} />
          <Field label="Email" value={reg.contact2Email} />
          <Field label="Phone" value={reg.contact2Phone} />
        </Section>
      )}

      <Section title="Registration Numbers">
        <Field label="GSTIN" value={reg.gstNumber} mono />
        <Field label="PAN" value={reg.panNumber} mono />
        <Field label="CIN / LLPIN" value={reg.cinNumber} mono />
        <Field label="Udyam / MSME Number" value={reg.msmeNumber} mono />
      </Section>

      <Section title="Certifications">
        <Field label="ISO 9001 — Certificate No." value={reg.isoCertificateNo} mono />
        <Field label="ISO 9001 — Certifying Body" value={reg.isoCertifyingBody} />
        <Field label="ISO 9001 — Valid To" value={reg.isoExpiry} />
        <Field label="ISO 14001 — Certificate No." value={reg.iso14001CertificateNo} mono />
        <Field label="ISO 14001 — Certifying Body" value={reg.iso14001CertifyingBody} />
        <Field label="ISO 14001 — Valid To" value={reg.iso14001Expiry} />
        <Field label="ISO 45001 — Certificate No." value={reg.iso45001CertificateNo} mono />
        <Field label="ISO 45001 — Certifying Body" value={reg.iso45001CertifyingBody} />
        <Field label="ISO 45001 — Valid To" value={reg.iso45001Expiry} />
        <Field label="ISO 27001 — Certificate No." value={reg.iso27001CertificateNo} mono />
        <Field label="ISO 27001 — Certifying Body" value={reg.iso27001CertifyingBody} />
        <Field label="ISO 27001 — Valid To" value={reg.iso27001Expiry} />
        <Field label="AS9100D — Certificate No." value={reg.as9100dCertificateNo} mono />
        <Field label="AS9100D — Certifying Body" value={reg.as9100dCertifyingBody} />
        <Field label="AS9100D — Valid To" value={reg.as9100dExpiry} />
        <Field label="NADCAP — Certificate No." value={reg.nadcapCertificateNo} mono />
        <Field label="NADCAP — Expiration Date" value={reg.nadcapExpiry} />
      </Section>

      <Section title="Bank Details">
        <Field label="Beneficiary Name" value={reg.beneficiaryName} />
        <Field label="Account Number" value={reg.accountNumber} mono />
        <Field label="IFSC Code" value={reg.ifscCode} mono />
        <Field label="Bank Name" value={reg.bankName} />
      </Section>

      <Section title="Business Details">
        <Field label="Telephone" value={reg.telephone} />
        <Field label="Fax" value={reg.fax} />
        <Field label="Weekly Off Day" value={reg.weeklyOff} />
        <Field label="Annual Turnover" value={reg.annualTurnover} />
        <Field label="Turnover Year" value={reg.turnoverYear} />
        <Field label="Regulatory Acts" value={reg.regulatoryActs} />
      </Section>

      <Section title="Manpower & Capacity">
        <Field label="Office Staff" value={reg.manpowerOffice} />
        <Field label="Supervisors" value={reg.manpowerSupervisor} />
        <Field label="Workmen" value={reg.manpowerWorkmen} />
        <Field label="Shifts / Day" value={reg.shiftsPerDay} />
        <Field label="Spare Capacity" value={reg.spareCapacity} />
        <Field label="Floor Space" value={reg.floorSpace} />
        <Field label="Equipment / Facilities" value={reg.equipmentFacilities} />
      </Section>

      {documents.length > 0 && (
        <Section title="Documents on File">
          <div className="col-12">
            <table className="table table-sm">
              <thead><tr><th>Document</th><th>File</th><th>Status</th></tr></thead>
              <tbody>
                {documents.map((d) => (
                  <tr key={d.id}>
                    <td className="small">{d.docName}</td>
                    <td className="small">{d.fileName || '—'}</td>
                    <td className="small text-capitalize">{d.verifyStatus || 'read'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {attachments.length > 0 && (
        <Section title="Additional Attachments">
          <div className="col-12">
            {attachments.map((a) => (
              <div key={a.id} className="small">{a.fileName}</div>
            ))}
          </div>
        </Section>
      )}

      {dynamicAnswers.length > 0 && (
        <Section title="Additional Questions">
          <div className="col-12">
            {dynamicAnswers.map((a) => (
              <div key={a.questionId} className="mb-2">
                <label className="text-muted text-uppercase fw-bold d-block" style={{ fontSize: '10px' }}>{a.prompt}</label>
                <div className="small fw-semibold">{answerText(a)}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

export default AdminVendors;
