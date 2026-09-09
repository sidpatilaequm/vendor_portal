import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Button from '../common/Button';

// Admin screen for recurring "email this report" sends — config (which
// analytics report, recipients, how often) lives entirely in WorkFlow
// (report_schedules table); this just talks to WorkFlow's
// /api/report-schedules/* endpoints. The report itself, its rendering, and
// the actual sending stay in the separate analytics (NexD Designer) service —
// WorkFlow only orchestrates timing and calls analytics' existing "email
// this report" endpoint on a schedule's behalf.

const INTERVAL_PRESETS = [
  { label: 'Daily', hours: 24 },
  { label: 'Weekly', hours: 168 },
  { label: 'Monthly', hours: 720 },
  { label: 'Custom', hours: null },
];

const emptyForm = () => ({
  reportChoice: '', // "processKey|token|role|reportName" packed together for the <select>
  recipientsText: '',
  intervalPreset: 'Daily',
  customHours: 24,
  message: '',
});

const AdminReportSchedules = () => {
  const currentUser = JSON.parse(localStorage.getItem('user_data') || '{"userId": 1}');
  const userId = currentUser.userId || 1;
  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

  const [schedules, setSchedules] = useState([]);
  const [availableReports, setAvailableReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = creating new
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(() => {
    setLoading(true);
    const headers = authHeaders();
    Promise.all([
      axios.get(`/api/report-schedules/?user_id=${userId}`, { headers }).catch(() => ({ data: [] })),
      axios.get(`/api/report-schedules/available-reports?user_id=${userId}`, { headers }).catch(() => ({ data: [] })),
    ]).then(([sRes, rRes]) => {
      setSchedules(sRes.data || []);
      setAvailableReports(rRes.data || []);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setAlert(null);
    setShowModal(true);
  };

  const openEdit = (sched) => {
    setEditingId(sched.id);
    const preset = INTERVAL_PRESETS.find((p) => p.hours === sched.interval_hours);
    setForm({
      reportChoice: `${sched.process_key}|${sched.token}|${sched.role}|${sched.report_name}`,
      recipientsText: (sched.recipients || []).join('\n'),
      intervalPreset: preset ? preset.label : 'Custom',
      customHours: sched.interval_hours,
      message: sched.message || '',
    });
    setAlert(null);
    setShowModal(true);
  };

  const intervalHours = () => {
    const preset = INTERVAL_PRESETS.find((p) => p.label === form.intervalPreset);
    return preset && preset.hours ? preset.hours : Number(form.customHours) || 24;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const recipients = form.recipientsText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      setAlert({ type: 'danger', message: 'Add at least one recipient email.' });
      return;
    }

    setSaving(true);
    setAlert(null);
    const headers = { ...authHeaders(), 'Content-Type': 'application/json' };

    const finish = (promise) => {
      promise
        .then(() => {
          setAlert({ type: 'success', message: 'Saved.' });
          fetchAll();
          setTimeout(() => setShowModal(false), 700);
        })
        .catch((err) => {
          setAlert({ type: 'danger', message: err.response?.data?.detail || 'Could not save this schedule.' });
        })
        .finally(() => setSaving(false));
    };

    if (editingId) {
      finish(axios.patch(`/api/report-schedules/${editingId}?user_id=${userId}`, {
        recipients,
        interval_hours: intervalHours(),
        message: form.message,
      }, { headers }));
    } else {
      const [processKey, token, role, reportName] = form.reportChoice.split('|');
      if (!processKey) {
        setSaving(false);
        setAlert({ type: 'danger', message: 'Pick a report first.' });
        return;
      }
      finish(axios.post(`/api/report-schedules/?user_id=${userId}`, {
        process_key: processKey,
        token,
        role,
        report_name: reportName,
        recipients,
        interval_hours: intervalHours(),
        message: form.message,
      }, { headers }));
    }
  };

  const toggleActive = (sched) => {
    axios.patch(`/api/report-schedules/${sched.id}?user_id=${userId}`,
      { is_active: !sched.is_active },
      { headers: authHeaders() })
      .then(fetchAll)
      .catch((err) => console.error('Failed to toggle schedule', err));
  };

  const remove = (sched) => {
    if (!window.confirm(`Delete the schedule for "${sched.report_name}" (${sched.role})? This can't be undone.`)) return;
    axios.delete(`/api/report-schedules/${sched.id}?user_id=${userId}`, { headers: authHeaders() })
      .then(fetchAll)
      .catch((err) => console.error('Failed to delete schedule', err));
  };

  const intervalLabel = (hours) => {
    const preset = INTERVAL_PRESETS.find((p) => p.hours === hours);
    return preset ? preset.label : `Every ${hours}h`;
  };

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-0">Report Email Schedules</h5>
          <div className="text-muted small">Recurring sends of analytics reports to specified people.</div>
        </div>
        <Button onClick={openCreate}>+ New Schedule</Button>
      </div>

      {loading ? (
        <div className="text-muted small">Loading…</div>
      ) : schedules.length === 0 ? (
        <div className="text-muted small border rounded p-4 text-center">
          No schedules yet. Click "New Schedule" to send a report to someone on a recurring basis.
        </div>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Report</th>
                <th>Recipients</th>
                <th>Interval</th>
                <th>Last sent</th>
                <th>Status</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="fw-semibold" style={{ fontSize: 13.5 }}>{s.report_name}</div>
                    <div className="text-muted small text-uppercase">{s.role}</div>
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {(s.recipients || []).slice(0, 2).join(', ')}
                    {s.recipients && s.recipients.length > 2 && ` +${s.recipients.length - 2} more`}
                  </td>
                  <td>{intervalLabel(s.interval_hours)}</td>
                  <td className="small text-muted">
                    {s.last_sent_at ? new Date(s.last_sent_at).toLocaleString() : 'Never'}
                    {s.last_error && (
                      <div className="text-danger" title={s.last_error} style={{ fontSize: 11 }}>
                        <i className="fas fa-exclamation-triangle me-1" />partial failure
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`badge ${s.is_active ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleActive(s)}
                      title="Click to toggle"
                    >
                      {s.is_active ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  <td className="text-end">
                    <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => openEdit(s)}>Edit</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => remove(s)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: 480 }}>
            <div className="custom-modal-header bg-white border-bottom-0 pb-0 pt-4 px-4">
              <h5 className="custom-modal-title fw-bold text-dark fs-5">
                {editingId ? 'Edit Schedule' : 'New Report Schedule'}
              </h5>
              <button className="btn-close shadow-none" onClick={() => setShowModal(false)}></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="custom-modal-body p-4 text-start">
                {alert && <div className={`alert alert-${alert.type} py-1.5 mb-3 small`}>{alert.message}</div>}

                {!editingId && (
                  <div className="mb-3">
                    <label className="form-label fw-bold text-muted small">Report *</label>
                    <select
                      className="form-select"
                      required
                      value={form.reportChoice}
                      onChange={(e) => setForm((f) => ({ ...f, reportChoice: e.target.value }))}
                    >
                      <option value="">— Select a published report —</option>
                      {availableReports.map((r) => (
                        <option
                          key={`${r.process_key}|${r.token}`}
                          value={`${r.process_key}|${r.token}|${r.role}|${r.report_name}`}
                        >
                          {r.report_name} ({r.role})
                        </option>
                      ))}
                    </select>
                    {availableReports.length === 0 && (
                      <div className="form-text">No published reports found — publish one in NexD Designer first.</div>
                    )}
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label fw-bold text-muted small">Recipients *</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    required
                    placeholder="One email per line (or comma-separated)"
                    value={form.recipientsText}
                    onChange={(e) => setForm((f) => ({ ...f, recipientsText: e.target.value }))}
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label fw-bold text-muted small">Interval *</label>
                  <div className="d-flex gap-2 align-items-center">
                    <select
                      className="form-select"
                      value={form.intervalPreset}
                      onChange={(e) => setForm((f) => ({ ...f, intervalPreset: e.target.value }))}
                    >
                      {INTERVAL_PRESETS.map((p) => (
                        <option key={p.label} value={p.label}>{p.label}</option>
                      ))}
                    </select>
                    {form.intervalPreset === 'Custom' && (
                      <input
                        type="number"
                        min={1}
                        className="form-control"
                        style={{ width: 110 }}
                        value={form.customHours}
                        onChange={(e) => setForm((f) => ({ ...f, customHours: e.target.value }))}
                      />
                    )}
                    {form.intervalPreset === 'Custom' && <span className="text-muted small">hours</span>}
                  </div>
                </div>

                <div className="mb-2">
                  <label className="form-label fw-bold text-muted small">Message (optional)</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="A short note included with the email"
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  />
                </div>
              </div>
              <div className="custom-modal-footer gap-2">
                <button type="button" className="btn btn-outline-secondary px-3 py-1 fw-semibold" onClick={() => setShowModal(false)} style={{ borderRadius: 8, fontSize: 12 }}>
                  Cancel
                </button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReportSchedules;
