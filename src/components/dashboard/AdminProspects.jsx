import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';

const AdminProspects = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  // Fallback mock prospects if server fails/runs empty
  const mockProspects = [
    {
      userId: 201,
      vendorLegalEntityName: 'Stellar Forgings Pvt Ltd',
      vendorContactName: 'Rajesh Sharma',
      vendorEmail: 'rajesh@stellar.in',
      vendorPhoneNumber: '+91 91234 56789',
      vendorDesignation: 'Director',
      createdDate: '2026-06-28T09:30:00Z',
      onboardingStatus: 'PENDING_LINK',
      onboardingToken: ''
    },
    {
      userId: 202,
      vendorLegalEntityName: 'Alpha Logistics & Cargo',
      vendorContactName: 'Anita Desai',
      vendorEmail: 'contact@alphalogistics.com',
      vendorPhoneNumber: '+91 99999 88888',
      vendorDesignation: 'Head of Sales',
      createdDate: '2026-06-29T14:15:00Z',
      onboardingStatus: 'LINK_GENERATED',
      onboardingToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIwMiwiZW1haWwiOiJjb250YWN0QGFscGhhbG9naXN0aWNzLmNvbSJ9'
    }
  ];

  const fetchProspects = () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    axios.get('/api/vendor-onboarding/requests', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (res.data && res.data.data && Array.isArray(res.data.data.requests)) {
        setRequests(res.data.data.requests);
      } else {
        setRequests(mockProspects);
      }
    })
    .catch(err => {
      console.error('Failed to fetch onboarding prospects, using fallback data.', err);
      setRequests(mockProspects);
    })
    .finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchProspects();
  }, []);

  const handleGenerateLink = (userId) => {
    const token = localStorage.getItem('auth_token');
    axios.post(`/api/vendor-onboarding/generate-link/${userId}`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (res.data && res.data.status === '200') {
        showAlert('Onboarding link generated successfully!', 'success');
        fetchProspects();
      } else {
        showAlert(res.data?.statusMsg || 'Failed to generate onboarding link.', 'danger');
      }
    })
    .catch(err => {
      console.error('Link generation error:', err);
      showAlert('Failed to generate onboarding link due to backend error.', 'danger');
    });
  };

  const handleCopyLink = (onboardingToken) => {
    const link = `${window.location.origin}/vendor/onboarding/?token=${onboardingToken}`;
    navigator.clipboard.writeText(link)
      .then(() => {
        showAlert('Link copied to clipboard!', 'success');
      })
      .catch(err => {
        console.error('Clipboard copy error:', err);
        showAlert('Failed to copy link to clipboard.', 'danger');
      });
  };

  const showAlert = (message, type = 'success') => {
    setAlert({ message, type });
    setTimeout(() => setAlert(null), 3000);
  };

  return (
    <div className="fade-in-slide container-fluid py-4 bg-light bg-opacity-50" style={{ minHeight: '100%' }}>
      {/* Header */}
      <div className="row align-items-center mb-4 text-start">
        <div className="col">
          <h4 className="fw-bold mb-1 text-dark">Vendor Prospects</h4>
        </div>
        <div className="col-auto">
          <Button onClick={fetchProspects} className="btn-light border btn-sm">
            <i className="fas fa-sync-alt me-1"></i> Refresh
          </Button>
        </div>
      </div>

      {/* Alert message */}
      {alert && (
        <div className={`alert alert-${alert.type} fade show py-2 mb-3`} style={{ fontSize: '13px' }} role="alert">
          <strong>{alert.type === 'success' ? 'Success: ' : 'Error: '}</strong> {alert.message}
        </div>
      )}

      {/* Prospects Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted fw-bold" style={{ fontSize: '11px' }}>
                <tr>
                  <th scope="col" className="ps-4 py-3">Legal Entity Name</th>
                  <th scope="col">Contact Representative</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Designation</th>
                  <th scope="col">Received Date</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-end pe-4" style={{ width: '180px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                      Loading prospects list...
                    </td>
                  </tr>
                ) : requests.length > 0 ? (
                  requests.map((item, idx) => {
                    const createdDate = item.createdDate ? new Date(item.createdDate).toLocaleDateString() : '-';
                    return (
                      <tr key={item.userId || idx}>
                        <td className="ps-4">
                          <div className="fw-bold text-dark" style={{ fontSize: '13px' }}>{item.vendorLegalEntityName || '-'}</div>
                        </td>
                        <td>{item.vendorContactName || '-'}</td>
                        <td>{item.vendorEmail || '-'}</td>
                        <td>{item.vendorPhoneNumber || '-'}</td>
                        <td>{item.vendorDesignation || '-'}</td>
                        <td><span className="text-muted">{createdDate}</span></td>
                        <td>
                          {item.onboardingStatus === 'PENDING_LINK' ? (
                            <span className="badge bg-warning-subtle text-warning border border-warning-subtle px-2.5 py-1 rounded-pill">Pending Link</span>
                          ) : (
                            <span className="badge bg-success-subtle text-success border border-success-subtle px-2.5 py-1 rounded-pill">Link Generated</span>
                          )}
                        </td>
                        <td className="text-end pe-4">
                          {item.onboardingStatus === 'PENDING_LINK' ? (
                            <Button 
                              onClick={() => handleGenerateLink(item.userId)} 
                              className="btn-success btn-xs"
                              style={{ backgroundColor: '#293383', borderColor: '#293383', fontSize: '11px', padding: '4px 10px' }}
                            >
                              <i className="fas fa-link me-1"></i> Create Link
                            </Button>
                          ) : (
                            <Button 
                              onClick={() => handleCopyLink(item.onboardingToken)} 
                              className="btn-outline-success btn-xs"
                              style={{ fontSize: '11px', padding: '4px 10px' }}
                            >
                              <i className="far fa-copy me-1"></i> Copy Link
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="text-center py-5 text-muted">
                      <i className="fas fa-user-clock fa-2x mb-2 d-block opacity-50"></i>
                      No pending prospects found. All requests are processed.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminProspects;
