import React, { useEffect, useState } from 'react';
import axios from 'axios';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

const errorMessage = (err, fallback) =>
  err.response?.data?.detail || err.response?.data?.statusMsg || err.response?.data?.message || fallback;

/**
 * Reports published to the "employee" role in Report Designer — fetched through backend_java's
 * own authenticated proxy (EmployeeReportsController), not called directly against the
 * analytics service. Opening a report iframes the URL that proxy already resolved server-side;
 * the analytics service's own share token is never something this component has to know about
 * or construct itself.
 */
const EmployeeDashboards = ({ onBack }) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openReport, setOpenReport] = useState(null);

  useEffect(() => {
    axios.get('/api/employee/reports', { headers: authHeaders() })
      .then((res) => setReports(res.data.reports || []))
      .catch((err) => setError(errorMessage(err, 'Could not load reports.')))
      .finally(() => setLoading(false));
  }, []);

  const open = (report) => {
    setOpenReport(report);
    axios.post(`/api/employee/reports/${encodeURIComponent(report.key)}/view`, {}, { headers: authHeaders() })
      .catch(() => {}); // best-effort audit log — never blocks viewing
  };

  const backButtonStyle = {
    fontFamily: "'Poppins', sans-serif",
    color: 'var(--accent-color)',
    borderColor: 'var(--accent-color)',
  };

  if (openReport) {
    return (
      <div className="p-3">
        <button className="btn btn-sm btn-outline-secondary mb-3" style={backButtonStyle} onClick={() => setOpenReport(null)}>
          <i className="fas fa-arrow-left me-1"></i> Back to Dashboards
        </button>
        <iframe
          title={openReport.name}
          src={openReport.url}
          style={{ width: '100%', height: 'calc(100vh - 160px)', border: 'none', borderRadius: 8 }}
        />
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 min-vh-100 fade-in-slide" style={{ backgroundColor: 'var(--background-light)' }}>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-1" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--text-dark)' }}>Dashboards</h4>
          <p className="mb-0 small" style={{ fontFamily: "'Poppins', sans-serif", color: 'var(--text-muted)' }}>
            Reports published for everyone in your team.
          </p>
        </div>
        {onBack && (
          <button className="btn btn-sm btn-outline-secondary" style={backButtonStyle} onClick={onBack}>
            <i className="fas fa-arrow-left me-1"></i> Back
          </button>
        )}
      </div>

      {error && <p className="small" style={{ color: '#dc2626', fontFamily: "'Poppins', sans-serif" }}>{error}</p>}
      {loading && <p className="small" style={{ color: 'var(--text-muted)', fontFamily: "'Poppins', sans-serif" }}>Loading…</p>}

      {!loading && !error && reports.length === 0 && (
        <p className="small" style={{ color: 'var(--text-muted)', fontFamily: "'Poppins', sans-serif" }}>
          No reports have been published yet.
        </p>
      )}

      <div className="row g-4">
        {reports.map((report) => (
          <div key={report.key} className="col-12 col-sm-6 col-md-4 col-lg-3">
            <div className="card h-100 shadow-sm border-0" style={{ borderRadius: '12px', backgroundColor: 'var(--card-bg)' }}>
              <div className="card-body text-center p-4 d-flex flex-column align-items-center">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mb-3"
                  style={{ width: '60px', height: '60px', backgroundColor: 'var(--accent-light)', color: 'var(--accent-color)' }}
                >
                  <i className="fas fa-chart-pie fs-4"></i>
                </div>
                <h5 className="fw-bold mb-2" style={{ fontFamily: "'Inter', sans-serif", color: 'var(--text-dark)' }}>
                  {report.name}
                </h5>
                {report.updatedAt && (
                  <p className="small mb-4" style={{ fontFamily: "'Poppins', sans-serif", color: 'var(--text-muted)' }}>
                    Updated {new Date(report.updatedAt).toLocaleDateString()}
                  </p>
                )}
                <button
                  className="btn w-100 mt-auto rounded-pill fw-medium"
                  onClick={() => open(report)}
                  style={{
                    fontSize: '14px',
                    fontFamily: "'Poppins', sans-serif",
                    color: 'var(--accent-color)',
                    border: '2px solid var(--accent-color)',
                    backgroundColor: 'transparent',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-color)'; e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--accent-color)'; }}
                >
                  Open <i className="fas fa-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmployeeDashboards;
