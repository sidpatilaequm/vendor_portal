import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BackButton from '../common/BackButton';

// One toggle per procurement stage. When off, the stage is hidden from vendor/employee/admin
// UI and (for the 5 that have a real write path) blocked at the API too — see backend_java's
// OrgConfigGate and WorkFlow's org_config.py. The other 4 (Invoice Verification, Vendor
// Payments, Vendor Returns, Credit Notes) have no write path anywhere in this system today —
// off only hides their report screens, there is nothing to block.
const TOGGLES = [
  { key: 'vendorOnboardingEnabled', label: 'Vendor Onboarding', desc: 'The Become-a-Supplier registration form.' },
  { key: 'prToPoEnabled', label: 'PR to PO', desc: 'Purchase Requisitions, RFQs, and Purchase Order creation from an awarded quotation. Can’t be turned off while any PR is still in process (not yet a PO, rejected, or closed) — you’ll be told which ones.' },
  { key: 'goodsReceiptWarehouseEnabled', label: 'Goods Receipt — Warehouse', desc: 'Master switch. When off, every material inward is location-only regardless of document type. When on, raw-material document types still require a warehouse + bin as usual.' },
  { key: 'gateEntryShowToVendorEnabled', label: 'Gate Entry — Show to Vendor', desc: "Whether a vendor can see their own gate-entry status. Doesn't affect employees creating gate entries." },
  { key: 'invoiceVerificationEnabled', label: 'Invoice Verification', desc: 'Invoice report screen. (No backend action exists yet for this stage.)' },
  { key: 'vendorPaymentsEnabled', label: 'Vendor Payments', desc: 'Vendor payment report screen. (No backend action exists yet for this stage.)' },
  { key: 'vendorReturnsEnabled', label: 'Vendor Returns', desc: 'Vendor returns report screen. (No backend action exists yet for this stage.)' },
  { key: 'creditNotesEnabled', label: 'Credit Notes', desc: 'Credit notes report screen. (No backend action exists yet for this stage.)' },
  { key: 'budgetingEnabled', label: 'Budgeting', desc: 'Activities, sub-activities, budget versions, and budget Excel uploads/approvals.' },
];

const AdminOrgConfig = ({ onBack }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get('/api/public/org-config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setConfig(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleToggle = async (key, checked) => {
    setSavingKey(key);
    setSaveError('');
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.patch('/api/admin/org-config', { [key]: checked }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setConfig(response.data);
    } catch (err) {
      // Backend validation failures (e.g. "can't disable PR to PO while N PRs are in process")
      // come back as {status: "FAILED: <message>"} — see GlobalExceptionHandler. Strip the
      // "FAILED: " prefix so the admin sees a clean sentence, not the raw wire format.
      const raw = err.response?.data?.status || err.response?.data?.message || err.message;
      setSaveError(raw?.replace(/^FAILED:\s*/, '') || 'Failed to save.');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) return <div className="p-4 text-center">Loading organisation configuration...</div>;

  return (
    <div className="container-fluid py-4 fade-in-slide" style={{ backgroundColor: 'var(--background-light)', minHeight: '100vh' }}>
      <BackButton onClick={onBack} />

      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1">Organisation Configuration</h3>
          <p className="text-muted small mb-0">Turn entire procurement stages on or off for every vendor and employee.</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {saveError && (
        <div className="alert alert-warning d-flex align-items-start justify-content-between gap-3">
          <div><i className="fas fa-triangle-exclamation me-2"></i>{saveError}</div>
          <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setSaveError('')}></button>
        </div>
      )}

      <div className="card shadow-sm border-0" style={{ borderRadius: '12px' }}>
        <div className="card-body p-0">
          {TOGGLES.map((t, idx) => (
            <div
              key={t.key}
              className={`d-flex align-items-start justify-content-between p-4 ${idx < TOGGLES.length - 1 ? 'border-bottom' : ''}`}
            >
              <div className="pe-4">
                <div className="fw-bold text-dark">{t.label}</div>
                <div className="text-muted small mt-1">{t.desc}</div>
              </div>
              <div className="form-check form-switch flex-shrink-0" style={{ marginTop: 4 }}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  checked={config?.[t.key] ?? true}
                  onChange={(e) => handleToggle(t.key, e.target.checked)}
                  disabled={savingKey === t.key}
                  style={{ cursor: 'pointer', transform: 'scale(1.3)' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminOrgConfig;
