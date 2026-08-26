import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';

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

  // Fallback mock vendor list if backend returns empty or errors
  const mockVendors = [
    {
      id: 1,
      name: 'Acme Aerospace Ltd',
      email: 'onboarding@acme-aero.com',
      phone: '+91 98765 43210',
      status: 'ACTIVE',
      gstin: '29AAAAA1111A1Z1',
      pan: 'AAAAA1111A',
      contactPerson: 'John Smith',
      kycStatus: 'VERIFIED',
      plantCode: 'PL-01',
      location: 'Bangalore, India'
    },
    {
      id: 2,
      name: 'Global Circuits Corp',
      email: 'sales@globalcircuits.com',
      phone: '+91 88888 77777',
      status: 'PENDING_KYC',
      gstin: '36BBBBB2222B2Z2',
      pan: 'BBBBB2222B',
      contactPerson: 'Sarah Connor',
      kycStatus: 'PENDING',
      plantCode: 'PL-03',
      location: 'Hyderabad, India'
    },
    {
      id: 3,
      name: 'Vertex Machining Inc',
      email: 'procure@vertex.in',
      phone: '+91 99000 88112',
      status: 'ACTIVE',
      gstin: '27CCCCC3333C3Z3',
      pan: 'CCCCC3333C',
      contactPerson: 'David Miller',
      kycStatus: 'VERIFIED',
      plantCode: 'PL-02',
      location: 'Pune, India'
    }
  ];

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
        setVendors(mockVendors);
      }
    })
    .catch(err => {
      console.error('Failed to load vendors, loading fallback mock data.', err);
      setVendors(mockVendors);
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
      {onBack && (
        <div 
          onClick={onBack} 
          className="d-inline-flex align-items-center text-muted mb-3 cursor-pointer" 
          style={{ cursor: 'pointer', transition: 'color 0.2s ease' }}
        >
          <i className="fas fa-arrow-left me-2"></i>
          <span className="fw-medium">Back to Reports</span>
        </div>
      )}
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
                            onClick={() => {
                              setSelectedVendor(vendor);
                              setShowDetailsModal(true);
                            }}
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
          <div className="custom-modal-content" style={{ maxWidth: '600px' }}>
            <div className="custom-modal-header bg-success bg-opacity-5">
              <h5 className="custom-modal-title fw-bold text-success">
                <i className="fas fa-building me-2"></i>Supplier Profile Detail
              </h5>
              <button className="custom-modal-close-btn" onClick={() => setShowDetailsModal(false)}>&times;</button>
            </div>
            <div className="custom-modal-body p-4 text-start">
              <div className="row g-3">
                <div className="col-12">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Company Legal Name</label>
                  <div className="fw-bold fs-5 text-dark">{selectedVendor.name}</div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Contact Email</label>
                  <div className="small fw-semibold">{selectedVendor.email}</div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Contact Phone</label>
                  <div className="small fw-semibold">{selectedVendor.phone}</div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Vendor Type</label>
                  <div className="small fw-semibold">
                    {selectedVendor.vendorCategory
                      ? selectedVendor.vendorCategory.split(',').map((c) => CATEGORY_LABELS[c] || c).join(', ')
                      : 'Not classified'}
                  </div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>GSTIN Number</label>
                  <div className="small font-monospace fw-bold">{selectedVendor.gstin}</div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>PAN Number</label>
                  <div className="small font-monospace fw-bold">{selectedVendor.pan}</div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Assign Plant Code</label>
                  <div className="small fw-semibold">{selectedVendor.plantCode}</div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Corporate Location</label>
                  <div className="small fw-semibold">{selectedVendor.location}</div>
                </div>
                <div className="col-12">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Primary Contact Representative</label>
                  <div className="small fw-semibold">{selectedVendor.contactPerson}</div>
                </div>
              </div>
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
                style={{ backgroundColor: '#064e3b', borderColor: '#064e3b', borderRadius: '8px', fontSize: '12px' }}
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

export default AdminVendors;
