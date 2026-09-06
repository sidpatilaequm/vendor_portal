import React, { useState, useEffect } from 'react';
import axios from 'axios';
import BackButton from '../common/BackButton';

const AdminAutomation = ({ onBack }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const fetchConfig = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get('/api/admin/folderit/config', {
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

  const handleSave = async (updatedFields) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post('/api/admin/folderit/config', updatedFields, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setConfig(response.data);
      alert('Configuration saved successfully');
    } catch (err) {
      alert('Failed to save configuration: ' + (err.response?.data?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    if (!window.confirm("Are you sure you want to run the automation job immediately?")) return;
    
    setRunning(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post('/api/admin/folderit/run-now', {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      alert(`Job executed: ${response.data.status}. Files Processed: ${response.data.filesProcessed}`);
      fetchConfig();
    } catch (err) {
      alert('Job failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <div className="p-4 text-center">Loading automation settings...</div>;

  return (
    <div className="container-fluid py-4 fade-in-slide" style={{ backgroundColor: 'var(--background-light)', minHeight: '100vh' }}>
      <BackButton onClick={onBack} />
      
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1">System Automation</h3>
          <p className="text-muted small mb-0">Manage background batch jobs and FolderIt sync rules</p>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm border-0 mb-4" style={{ borderRadius: '12px' }}>
        <div className="card-header bg-white border-0 pt-4 pb-0">
          <h5 className="fw-bold mb-0">
            <i className="fas fa-folder-open text-primary me-2"></i> FolderIt PO Auto-Sync
          </h5>
          <p className="text-muted small mt-1">
            Automatically finds "01 Initial" folders, imports Excel files, creates POs, and moves files to "02 Process".
          </p>
        </div>
        <div className="card-body">
          <div className="row g-4">
            <div className="col-md-6">
              <label className="fw-semibold mb-2 text-dark">Job Status</label>
              <div className="form-check form-switch mb-3">
                <input 
                  className="form-check-input" 
                  type="checkbox" 
                  role="switch" 
                  checked={config?.enabled || false}
                  onChange={(e) => handleSave({ isEnabled: e.target.checked })}
                  disabled={saving}
                  style={{ cursor: 'pointer', transform: 'scale(1.2)', marginLeft: '-2em', marginTop: '0.3em' }}
                />
                <label className="form-check-label ms-3 fw-bold" style={{ color: config?.enabled ? 'var(--success-color)' : 'var(--text-muted)' }}>
                  {config?.enabled ? 'Active / Enabled' : 'Paused / Disabled'}
                </label>
              </div>

              <label className="fw-semibold mb-2 text-dark mt-3">Sync Interval</label>
              <select 
                className="form-select form-select-sm shadow-sm"
                value={config?.intervalMinutes || 60}
                onChange={(e) => handleSave({ intervalMinutes: parseInt(e.target.value) })}
                disabled={saving}
                style={{ borderRadius: '6px', maxWidth: '300px' }}
              >
                <option value={1}>Every 1 Minute (Testing)</option>
                <option value={5}>Every 5 Minutes</option>
                <option value={15}>Every 15 Minutes</option>
                <option value={30}>Every 30 Minutes</option>
                <option value={60}>Every 1 Hour</option>
                <option value={120}>Every 2 Hours</option>
                <option value={1440}>Every 24 Hours</option>
              </select>
            </div>
            
            <div className="col-md-6 border-start ps-4">
              <div className="p-3 rounded bg-light border">
                <h6 className="fw-bold text-dark mb-3">Recent Execution Stats</h6>
                <div className="mb-2">
                  <span className="text-muted small">Last Run Time:</span>
                  <div className="fw-bold">{config?.lastRunTime ? new Date(config.lastRunTime).toLocaleString() : 'Never'}</div>
                </div>
                <div className="mb-2">
                  <span className="text-muted small">Last Status:</span>
                  <div className="fw-bold text-primary">{config?.lastRunStatus || '-'}</div>
                </div>
                <div className="mb-3">
                  <span className="text-muted small">Files Processed:</span>
                  <div className="fw-bold">{config?.filesProcessedLastRun || 0}</div>
                </div>
                
                <button 
                  className="btn btn-sm btn-dark w-100 fw-bold shadow-sm mt-2" 
                  onClick={handleRunNow}
                  disabled={running}
                  style={{ borderRadius: '6px' }}
                >
                  {running ? (
                    <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Running...</>
                  ) : (
                    <><i className="fas fa-play me-2"></i> Run Now (Force Sync)</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAutomation;
