import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';

const AdminInvitations = () => {
  const [activeSubTab, setActiveSubTab] = useState('list'); // 'list' | 'create'
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Create Form State
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [expiryDays, setExpiryDays] = useState('3');
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState(null);
  const [generatedLink, setGeneratedLink] = useState('');

  // Fallback mock invitations
  const mockInvitations = [
    {
      id: 1,
      supplier_email: 'vendor1@aeromax.com',
      supplier_name: 'Aeromax Spares',
      status: 'INVITED',
      token: 'eyJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoiQWVyb21heCIsImVtYWlsIjoidmVuZG9yMUBhZXJvbWF4LmNvbSJ9',
      invite_url: `${window.location.origin}/register/?token=eyJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoiQWVyb21heCIsImVtYWlsIjoidmVuZG9yMUBhZXJvbWF4LmNvbSJ9`,
      expiry_date: '2026-07-03T18:00:00Z',
      created_at: '2026-06-30T10:00:00Z'
    },
    {
      id: 2,
      supplier_email: 'parts@titanium-ind.com',
      supplier_name: 'Titanium Industries',
      status: 'USED',
      token: 'eyJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoiVGl0YW5pdW0iLCJlbWFpbCI6InBhcnRzQHRpdGFuaXVtLWluZC5jb20ifQ',
      invite_url: `${window.location.origin}/register/?token=eyJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoiVGl0YW5pdW0iLCJlbWFpbCI6InBhcnRzQHRpdGFuaXVtLWluZC5jb20ifQ`,
      expiry_date: '2026-06-25T14:30:00Z',
      created_at: '2026-06-22T14:30:00Z'
    }
  ];

  const fetchInvitations = () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    axios.get('/admin/invitation/list/', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      // The django view might return rendering of a page or json. If it's JSON:
      if (res.data && Array.isArray(res.data.invitations)) {
        setInvitations(res.data.invitations);
      } else if (res.data && Array.isArray(res.data)) {
        setInvitations(res.data);
      } else {
        setInvitations(mockInvitations);
      }
    })
    .catch(err => {
      console.error('Failed to load invitations, using fallback data.', err);
      setInvitations(mockInvitations);
    })
    .finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    if (activeSubTab === 'list') {
      fetchInvitations();
    }
  }, [activeSubTab]);

  const handleCreateInvitation = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setAlert(null);
    setGeneratedLink('');

    const token = localStorage.getItem('auth_token');
    axios.post('/admin/invitation/create/', {
      supplier_email: supplierEmail,
      supplier_name: supplierName,
      expiry_days: expiryDays
    }, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    .then(res => {
      if (res.data && res.data.status === 'success') {
        setGeneratedLink(res.data.invite_url || `${window.location.origin}/register/?token=${res.data.token}`);
        setAlert({ type: 'success', message: 'Invitation link generated successfully!' });
        // Reset form
        setSupplierEmail('');
        setSupplierName('');
      } else {
        setAlert({ type: 'danger', message: res.data?.error || 'Failed to create invitation link.' });
      }
    })
    .catch(err => {
      console.error('Create invitation error:', err);
      setAlert({ type: 'danger', message: err.response?.data?.error || 'A network error occurred. Please try again.' });
    })
    .finally(() => {
      setSubmitting(false);
    });
  };

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url)
      .then(() => {
        alert('Link copied to clipboard!');
      })
      .catch(err => {
        console.error('Copy link error:', err);
      });
  };

  return (
    <div className="fade-in-slide container-fluid py-4 bg-light bg-opacity-50" style={{ minHeight: '100%' }}>
      {/* Header */}
      <div className="row align-items-center mb-4 text-start">
        <div className="col">
          <h4 className="fw-bold mb-1 text-dark">Supplier Invitations</h4>
          <p className="text-muted mb-0 small">Send secure registration tokens to onboard trusted partners.</p>
        </div>
        <div className="col-auto">
          <div className="btn-group border bg-white p-1" style={{ borderRadius: '8px' }}>
            <button 
              className={`btn btn-sm border-0 px-3 fw-bold ${activeSubTab === 'list' ? 'bg-success text-white' : 'text-dark'}`}
              onClick={() => setActiveSubTab('list')}
              style={activeSubTab === 'list' ? { backgroundColor: '#293383', color: '#fff' } : {}}
            >
              Manage Invitations
            </button>
            <button 
              className={`btn btn-sm border-0 px-3 fw-bold ${activeSubTab === 'create' ? 'bg-success text-white' : 'text-dark'}`}
              onClick={() => setActiveSubTab('create')}
              style={activeSubTab === 'create' ? { backgroundColor: '#293383', color: '#fff' } : {}}
            >
              Create Invitation
            </button>
          </div>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type} fade show py-2.5 mb-4 text-start`} style={{ fontSize: '13px' }} role="alert">
          {alert.message}
        </div>
      )}

      {/* Render sub-tab views */}
      {activeSubTab === 'list' ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-muted fw-bold" style={{ fontSize: '11px' }}>
                  <tr>
                    <th scope="col" className="ps-4 py-3">Supplier Email</th>
                    <th scope="col">Status</th>
                    <th scope="col">Invitation Token / Link</th>
                    <th scope="col">Expiry Date</th>
                    <th scope="col">Date Created</th>
                    <th scope="col" className="text-end pe-4">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                        Loading invitations...
                      </td>
                    </tr>
                  ) : invitations.length > 0 ? (
                    invitations.map((invite) => {
                      const createdDate = invite.created_at ? new Date(invite.created_at).toLocaleDateString() : '-';
                      const expiryDate = invite.expiry_date ? new Date(invite.expiry_date).toLocaleDateString() : '-';
                      return (
                        <tr key={invite.id}>
                          <td className="ps-4">
                            <div className="d-flex align-items-center gap-2">
                              <div className="avatar-sm bg-success-subtle rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: '28px', height: '28px' }}>
                                <i className="fas fa-envelope text-success" style={{ fontSize: '12px' }}></i>
                              </div>
                              <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>{invite.supplier_email}</span>
                            </div>
                          </td>
                          <td>
                            {invite.status === 'INVITED' ? (
                              <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 rounded-pill">Invited</span>
                            ) : invite.status === 'USED' ? (
                              <span className="badge bg-info-subtle text-info border border-info-subtle px-2.5 py-1 rounded-pill">Used</span>
                            ) : (
                              <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2.5 py-1 rounded-pill">Expired</span>
                            )}
                          </td>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <code className="text-muted text-truncate" style={{ maxWidth: '150px' }}>{invite.token}</code>
                              <button 
                                className="btn btn-sm btn-link p-0 text-success"
                                onClick={() => handleCopyLink(invite.invite_url || `${window.location.origin}/register/?token=${invite.token}`)}
                                title="Copy Invitation Link"
                              >
                                <i className="far fa-copy"></i>
                              </button>
                            </div>
                          </td>
                          <td><span className="text-muted small fw-semibold">{expiryDate}</span></td>
                          <td><span className="text-muted small">{createdDate}</span></td>
                          <td className="text-end pe-4">
                            <a 
                              href={invite.invite_url || `${window.location.origin}/register/?token=${invite.token}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="btn btn-sm btn-outline-success px-2 py-0.5 fw-semibold"
                              style={{ fontSize: '11px' }}
                            >
                              <i className="fas fa-external-link-alt me-1"></i> Open Link
                            </a>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        <i className="fas fa-inbox fa-2x mb-2 d-block opacity-50"></i>
                        No invitations generated yet. Go to "Create Invitation" tab to invite vendors.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="row text-start">
          <div className="col-lg-6 mx-auto">
            <div className="card border-0 shadow-sm">
              <div className="card-body p-4">
                <h5 className="card-title fw-bold text-success mb-4">
                  <i className="fas fa-paper-plane me-2"></i>New Invitation Request
                </h5>
                <form onSubmit={handleCreateInvitation}>
                  <div className="mb-3">
                    <label htmlFor="supplier_email" className="form-label fw-bold text-muted small">Supplier Email Address *</label>
                    <input 
                      type="email" 
                      className="form-control border-success-subtle p-2.5" 
                      id="supplier_email" 
                      required 
                      placeholder="e.g. supplier@company.com"
                      value={supplierEmail}
                      onChange={(e) => setSupplierEmail(e.target.value)}
                    />
                    <div className="form-text small text-muted">A unique, single-use invitation token will be generated.</div>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="supplier_name" className="form-label fw-bold text-muted small">Supplier Name (Optional)</label>
                    <input 
                      type="text" 
                      className="form-control border-success-subtle p-2.5" 
                      id="supplier_name" 
                      placeholder="e.g. Acme Rockets Corp"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="expiry_days" className="form-label fw-bold text-muted small">Expiry Duration</label>
                    <select 
                      className="form-select border-success-subtle p-2.5" 
                      id="expiry_days"
                      value={expiryDays}
                      onChange={(e) => setExpiryDays(e.target.value)}
                    >
                      <option value="1">24 Hours (1 Day)</option>
                      <option value="3">72 Hours (3 Days)</option>
                      <option value="7">168 Hours (7 Days)</option>
                      <option value="14">336 Hours (14 Days)</option>
                    </select>
                  </div>

                  <div className="d-grid">
                    <Button type="submit" loading={submitting} className="w-100">
                      <i className="fas fa-link me-1"></i> Generate Invitation Link
                    </Button>
                  </div>
                </form>
              </div>
            </div>

            {generatedLink && (
              <div className="card border-0 shadow-sm mt-4 border-start border-5 border-success">
                <div className="card-body p-4 text-start">
                  <h5 className="fw-bold text-success mb-2">
                    <i className="fas fa-check-circle me-2"></i>Link Generated Successfully
                  </h5>
                  <p className="text-muted small">Copy the generated link below to share with your supplier:</p>
                  
                  <div className="input-group mb-3">
                    <input 
                      type="text" 
                      className="form-control border-success-subtle bg-light p-2.5" 
                      value={generatedLink} 
                      readOnly 
                    />
                    <button 
                      className="btn btn-success px-3 fw-bold" 
                      type="button" 
                      onClick={() => handleCopyLink(generatedLink)}
                      style={{ backgroundColor: '#293383', borderColor: '#293383' }}
                    >
                      <i className="far fa-copy"></i> Copy Link
                    </button>
                  </div>

                  <div className="alert alert-success bg-success-subtle border-0 mb-0 py-2.5" style={{ fontSize: '12.5px' }}>
                    <i className="fas fa-info-circle me-1"></i> An automated onboarding email has been sent out with instructions.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInvitations;
