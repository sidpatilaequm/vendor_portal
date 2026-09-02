import { useEffect, useState } from 'react';
import axios from 'axios';
import BackButton from '../common/BackButton';

export default function PurchaseOrderReport({ onBack }) {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [start, setStart] = useState('2026-01-01');
  const [end, setEnd] = useState('2026-12-31');
  const [companyId, setCompanyId] = useState('');

  useEffect(() => {
    fetchReport();
  }, [start, end, companyId]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const params = {};
      if (start) params.start_date = start;
      if (end) params.end_date = end;
      if (companyId) params.company_id = companyId;

      const res = await axios.get('/api/reports/purchase-order', {
        headers: { 'Authorization': `Bearer ${token}` },
        params: params
      });
      setData(res.data.data || []);
      setSummary(res.data.summary || {});
    } catch (err) {
      console.error('Error fetching purchase order report:', err);
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const num = (val) => val != null ? val.toLocaleString('en-IN') : '—';

  return (
    <div className="p-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Poppins", sans-serif' }}>
      <BackButton onClick={onBack} />
      <div className="mb-4 d-flex justify-content-between align-items-center">
        <div>
          <h3 className="fw-bold text-dark mb-0">Purchase order register</h3>
          <p className="text-muted small">Order release and confirmation tracking · SAP order book</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="d-flex justify-content-between align-items-center mb-4 bg-white p-3 border rounded shadow-sm">
        <div className="d-flex gap-3 align-items-center">
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
          <div className="d-flex align-items-center gap-2">
            <label className="text-muted small fw-medium mb-0">Company ID</label>
            <input
              type="text"
              className="form-control form-control-sm border shadow-sm"
              placeholder="All"
              value={companyId}
              onChange={e => setCompanyId(e.target.value)}
              style={{ width: '100px' }}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger shadow-sm border-0" role="alert">
          <i className="fas fa-exclamation-circle me-2"></i>{error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <div className="card h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
            <div className="card-body p-4">
              <h2 className="fw-bold text-dark mb-1">{num(summary.pos_released) ?? 0}</h2>
              <div className="text-muted small">POs released</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
            <div className="card-body p-4">
              <h2 className="fw-bold text-dark mb-1">{num(summary.order_lines) ?? 0}</h2>
              <div className="text-muted small">Order lines</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
            <div className="card-body p-4">
              <h2 className="fw-bold text-dark mb-1">{num(summary.active_vendors) ?? 0}</h2>
              <div className="text-muted small">Active vendors</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card h-100 border-0 shadow-sm" style={{ borderRadius: '12px' }}>
            <div className="card-body p-4">
              <h2 className="fw-bold text-dark mb-1">{summary.pending_asn ?? '—'}</h2>
              <div className="text-muted small">Pending ASN</div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-info" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead className="bg-light border-bottom">
                <tr>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">PO No</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Vendor</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase text-end">Value (₹)</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">Released</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase text-end">Days</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase text-center">SLA</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">ASN</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase">PO type</th>
                  <th className="px-4 py-3 text-secondary small fw-bold text-uppercase text-end">Lines</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center py-4 text-muted">No purchase orders found</td>
                  </tr>
                ) : data.map((v, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 fw-bold text-dark">{v.po_no}</td>
                    <td className="px-4 py-3">
                      <span className="d-inline-block text-truncate" style={{ maxWidth: '200px' }} title={v.vendor}>
                        {v.vendor}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted text-end">{v.value != null ? num(v.value) : '—'}</td>
                    <td className="px-4 py-3 text-muted">{v.released}</td>
                    <td className="px-4 py-3 text-muted text-end">{v.days ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-muted">·</td>
                    <td className="px-4 py-3 text-muted">{v.asn_status}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-primary bg-opacity-10 text-primary rounded-pill px-3 py-2 fw-medium">
                        {v.po_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted text-end">{v.lines}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {summary.note && (
        <p className="mt-3 text-muted small"><i className="fas fa-info-circle me-1"></i>{summary.note}</p>
      )}
    </div>
  );
}
