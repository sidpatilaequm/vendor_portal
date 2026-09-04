import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';
import BackButton from '../common/BackButton';

const CATEGORY_LABELS = {
  PRODUCT: 'Product',
  SERVICE: 'Service',
  SCHEDULING_AGREEMENT: 'Scheduling agreement',
  SUBCONTRACTING: 'Sub-contracting'
};

const AdminApprovedSuppliers = ({ onBack }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const fetchSuppliers = () => {
    setLoading(true);
    setLoadError('');
    const token = localStorage.getItem('auth_token');
    axios.get('/api/supplier-registration/approved-suppliers', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        setSuppliers(res.data?.data?.suppliers || []);
      })
      .catch(err => {
        console.error('Failed to load approved suppliers.', err);
        setLoadError(err.response?.status === 403
          ? 'Your session does not have admin access to this list.'
          : 'Could not load approved suppliers. Try again.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const filteredSuppliers = suppliers.filter(s => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q
      || (s.vendorName || '').toLowerCase().includes(q)
      || (s.email || '').toLowerCase().includes(q)
      || (s.vendorCode || '').toLowerCase().includes(q)
      || (s.gstNumber || '').toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'ALL' || (s.vendorCategory || '').split(',').includes(categoryFilter);
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="fade-in-slide container-fluid py-4 bg-light bg-opacity-50" style={{ minHeight: '100%' }}>
      <BackButton onClick={onBack} />
      <div className="row align-items-center mb-4 text-start">
        <div className="col">
          <h4 className="fw-bold mb-1 text-dark">Approved Suppliers</h4>
        </div>
        <div className="col-auto">
          <Button onClick={fetchSuppliers} className="btn-light border btn-sm">
            <i className="fas fa-sync-alt me-1"></i> Refresh
          </Button>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            <div className="col-md-6 text-start">
              <div className="input-group">
                <span className="input-group-text bg-white border-end-0 text-muted">
                  <i className="fas fa-search"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0 ps-0"
                  placeholder="Search by name, email, vendor code, or GSTIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ fontSize: '13px' }}
                />
              </div>
            </div>
            <div className="col-md-4">
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

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted fw-bold" style={{ fontSize: '11px' }}>
                <tr>
                  <th scope="col" className="ps-4 py-3">Vendor Name</th>
                  <th scope="col">Vendor Code</th>
                  <th scope="col">Contact Info</th>
                  <th scope="col">GSTIN / PAN</th>
                  <th scope="col">Vendor Type</th>
                  <th scope="col">Approved</th>
                  <th scope="col" className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                      Loading approved suppliers...
                    </td>
                  </tr>
                ) : loadError ? (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      <i className="fas fa-triangle-exclamation fa-2x mb-2 d-block opacity-50"></i>
                      {loadError}
                      <div className="mt-2">
                        <Button onClick={fetchSuppliers} className="btn-light border btn-sm">Try again</Button>
                      </div>
                    </td>
                  </tr>
                ) : filteredSuppliers.length > 0 ? (
                  filteredSuppliers.map((s) => (
                    <tr key={s.id}>
                      <td className="ps-4">
                        <div className="fw-bold text-dark" style={{ fontSize: '13.5px' }}>{s.vendorName || '—'}</div>
                        <small className="text-muted d-block">{s.companyType || ''}</small>
                      </td>
                      <td>
                        <div className="small font-monospace">{s.vendorCode || '—'}</div>
                      </td>
                      <td>
                        <div className="small">{s.email}</div>
                        <div className="text-muted small" style={{ fontSize: '11px' }}>{s.phone}</div>
                      </td>
                      <td>
                        <div className="small font-monospace">{s.gstNumber || '—'}</div>
                        <div className="text-muted small font-monospace" style={{ fontSize: '11px' }}>PAN: {s.panNumber || '—'}</div>
                      </td>
                      <td>
                        {s.vendorCategory ? (
                          <div className="d-flex flex-wrap gap-1">
                            {s.vendorCategory.split(',').map((c) => (
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
                        <div className="text-muted small">{s.approvedDate ? new Date(s.approvedDate).toLocaleDateString() : '—'}</div>
                      </td>
                      <td className="text-end pe-4">
                        <button
                          className="btn btn-light btn-sm border px-2 py-1"
                          onClick={() => setSelectedSupplier(s)}
                          title="View Details"
                        >
                          <i className="fas fa-eye text-primary"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="text-center py-5 text-muted">
                      <i className="fas fa-box-open fa-2x mb-2 d-block opacity-50"></i>
                      No approved suppliers matched your query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedSupplier && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '600px' }}>
            <div className="custom-modal-header bg-success bg-opacity-5">
              <h5 className="custom-modal-title fw-bold text-success">
                <i className="fas fa-building me-2"></i>Supplier Detail
              </h5>
              <button className="custom-modal-close-btn" onClick={() => setSelectedSupplier(null)}>&times;</button>
            </div>
            <div className="custom-modal-body p-4 text-start">
              <div className="row g-3">
                <div className="col-12">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Company Legal Name</label>
                  <div className="fw-bold fs-5 text-dark">{selectedSupplier.vendorName || '—'}</div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Vendor Code</label>
                  <div className="small fw-semibold font-monospace">{selectedSupplier.vendorCode || '—'}</div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Vendor Type</label>
                  <div className="small fw-semibold">
                    {selectedSupplier.vendorCategory
                      ? selectedSupplier.vendorCategory.split(',').map((c) => CATEGORY_LABELS[c] || c).join(', ')
                      : 'Not classified'}
                  </div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Contact Email</label>
                  <div className="small fw-semibold">{selectedSupplier.email}</div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Contact Phone</label>
                  <div className="small fw-semibold">{selectedSupplier.phone || '—'}</div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>GSTIN Number</label>
                  <div className="small font-monospace fw-bold">{selectedSupplier.gstNumber || '—'}</div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>PAN Number</label>
                  <div className="small font-monospace fw-bold">{selectedSupplier.panNumber || '—'}</div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Company Type</label>
                  <div className="small fw-semibold">{selectedSupplier.companyType || '—'}</div>
                </div>
                <div className="col-sm-6">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Approved</label>
                  <div className="small fw-semibold">
                    {selectedSupplier.approvedDate ? new Date(selectedSupplier.approvedDate).toLocaleString() : '—'}
                    {selectedSupplier.approvedBy ? ` · ${selectedSupplier.approvedBy}` : ''}
                  </div>
                </div>
                <div className="col-12">
                  <label className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>Registered Address</label>
                  <div className="small fw-semibold">{selectedSupplier.address || '—'}</div>
                </div>
              </div>
            </div>
            <div className="custom-modal-footer">
              <button className="btn btn-outline-secondary px-4 fw-semibold" onClick={() => setSelectedSupplier(null)} style={{ borderRadius: '8px', fontSize: '12px' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminApprovedSuppliers;
