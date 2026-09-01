import React, { useEffect, useState } from 'react';
import axios from 'axios';

const MaterialModule = ({ onBack }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      // Using /api/vendor/material-list which returns all materials for admins
      const res = await axios.get('/api/vendor/material-list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setData(res.data.materials || []);
    } catch (err) {
      console.error('Error fetching materials:', err);
      setError('Failed to load material data');
    } finally {
      setLoading(false);
    }
  };

  const filtered = data.filter(m => {
    const searchTerm = search.toLowerCase();
    return (
      (m.materialCode || '').toLowerCase().includes(searchTerm) ||
      (m.description || '').toLowerCase().includes(searchTerm)
    );
  });

  return (
    <div className="p-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Poppins", sans-serif' }}>
      {onBack && (
        <div
          onClick={onBack}
          className="d-inline-flex align-items-center text-muted mb-3 cursor-pointer"
          style={{ cursor: 'pointer', transition: 'color 0.2s ease' }}
        >
          <i className="fas fa-arrow-left me-2"></i>
          <span className="fw-medium">Back</span>
        </div>
      )}

      <div className="mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h3 className="fw-bold text-dark mb-0">Material Module</h3>
          <p className="text-muted small">Manage all your materials and view details.</p>
        </div>
      </div>

      <div className="card shadow-sm border-0 mb-4 rounded-3">
        <div className="card-body">
          <div className="d-flex flex-column flex-md-row gap-3 mb-4">
            <div className="input-group">
              <span className="input-group-text bg-light border-end-0">
                <i className="fas fa-search text-muted"></i>
              </span>
              <input
                type="text"
                placeholder="Search by Code or Description..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="form-control border-start-0 ps-0"
              />
            </div>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              <i className="fas fa-exclamation-circle me-2"></i> {error}
            </div>
          )}

          {loading ? (
            <div className="d-flex justify-content-center align-items-center p-5">
              <div className="spinner-border text-teal" style={{ color: '#0d9488' }} role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th className="py-3 px-4 text-secondary small fw-bold text-uppercase">Material No</th>
                    <th className="py-3 px-4 text-secondary small fw-bold text-uppercase">Description</th>
                    <th className="py-3 px-4 text-secondary small fw-bold text-uppercase">HSN Code</th>
                    <th className="py-3 px-4 text-secondary small fw-bold text-uppercase">UOM</th>
                    <th className="py-3 px-4 text-secondary small fw-bold text-uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-5 text-muted">
                        <i className="fas fa-box-open fs-1 text-light mb-3 d-block"></i>
                        No materials found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((m, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 fw-bold text-primary" style={{ fontFamily: 'monospace' }}>{m.materialCode || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="d-inline-block text-truncate" style={{ maxWidth: '300px' }} title={m.description}>
                            {m.description || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">{m.hsnCode || '—'}</td>
                        <td className="px-4 py-3 text-muted">{m.uom || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`badge rounded-pill px-3 py-2 fw-medium ${m.status === 'Active' ? 'bg-success bg-opacity-10 text-success' : 'bg-secondary bg-opacity-10 text-secondary'}`}>
                            {m.status || 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {!loading && data.length > 0 && (
        <div className="text-end text-muted small">
          Showing {filtered.length} of {data.length} records
        </div>
      )}
    </div>
  );
};

export default MaterialModule;
