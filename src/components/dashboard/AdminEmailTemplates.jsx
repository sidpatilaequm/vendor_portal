import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Button from '../common/Button';
import Input from '../common/Input';

// Admin editor for the live transactional emails WorkFlow sends — mirrors the
// three-pane shape of the original mockup (rail / editor / live preview). A
// new template starts as a bare mail_key/label/process stub (disabled by
// default) — everything else is filled in through this same editor
// afterward. Creating a row here does not wire it up to anything; actually
// sending it still needs a send_triggered_email(mail_key, ...) call added in
// code at whatever point should trigger it, same as every other template.
// The rail groups rows by process_key so unrelated flows (e.g. vendor
// onboarding vs. a vendor's own change requests) read as separate sections.
const TONE_OPTIONS = [
  { value: 'info', label: 'Neutral (blue)' },
  { value: 'ok', label: 'Good (green)' },
  { value: 'warn', label: 'Attention (amber)' },
  { value: 'bad', label: 'Problem (red)' },
];

const PROCESS_LABELS = {
  vendor_onboarding: 'Vendor Onboarding',
  vendor_change_request: 'Vendor Change Requests',
};

const AdminEmailTemplates = () => {
  const currentUser = JSON.parse(localStorage.getItem('user_data') || '{"userId": 1}');
  const userId = currentUser.userId || 1;
  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

  const [templates, setTemplates] = useState([]);
  const [footers, setFooters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTab, setPreviewTab] = useState('mail');
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testStatus, setTestStatus] = useState('');

  const [creating, setCreating] = useState(null); // null = modal closed, else {mailKey, mailLabel, processKey}
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, fRes] = await Promise.all([
        axios.get(`/api/email-templates/?user_id=${userId}`, { headers: authHeaders() }),
        axios.get(`/api/email-templates/footers/?user_id=${userId}`, { headers: authHeaders() }),
      ]);
      setTemplates(tRes.data || []);
      setFooters(fRes.data || []);
      if (!selectedId && tRes.data && tRes.data.length) {
        setSelectedId(tRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load email templates', err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const selected = templates.find((t) => t.id === selectedId) || null;

  useEffect(() => {
    if (selected) {
      setForm({ ...selected, detail_rows: selected.detail_rows ? selected.detail_rows.map((r) => [...r]) : [] });
      setTestStatus('');
    }
  }, [selectedId, templates.length]);

  const fetchPreview = useCallback(async (id) => {
    if (!id) return;
    setPreviewLoading(true);
    try {
      const { data } = await axios.post(`/api/email-templates/${id}/preview?user_id=${userId}`, null, { headers: authHeaders() });
      setPreview(data);
    } catch (err) {
      console.error('Failed to render preview', err);
    } finally {
      setPreviewLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (selectedId) fetchPreview(selectedId); }, [selectedId, fetchPreview]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const setDetailRow = (idx, col, value) => {
    setForm((f) => {
      const rows = f.detail_rows.map((r) => [...r]);
      rows[idx][col] = value;
      return { ...f, detail_rows: rows };
    });
  };
  const addDetailRow = () => setForm((f) => ({ ...f, detail_rows: [...f.detail_rows, ['', '']] }));
  const removeDetailRow = (idx) => setForm((f) => ({ ...f, detail_rows: f.detail_rows.filter((_, i) => i !== idx) }));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        enabled: form.enabled,
        from_address: form.from_address,
        reply_to: form.reply_to,
        status_strip_text: form.status_strip_text,
        status_strip_tone: form.status_strip_tone,
        subject: form.subject,
        preheader: form.preheader,
        heading: form.heading,
        intro: form.intro,
        detail_rows: form.detail_rows.filter((r) => r[0]),
        cta_label: form.cta_label,
        cta_url: form.cta_url,
        outro: form.outro,
        footer_id: form.footer_id,
        footer_override_reason: form.footer_override_reason,
        footer_override_legal: form.footer_override_legal,
      };
      const { data } = await axios.patch(`/api/email-templates/${form.id}?user_id=${userId}`, payload, { headers: authHeaders() });
      setTemplates((list) => list.map((t) => (t.id === data.id ? data : t)));
      await fetchPreview(data.id);
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not save this mail.');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true);
    setTestStatus('');
    try {
      await axios.post(`/api/email-templates/${form.id}/test-send?user_id=${userId}`, { to_email: testEmail.trim() }, { headers: authHeaders() });
      setTestStatus(`Test sent to ${testEmail.trim()}`);
    } catch (err) {
      setTestStatus(err.response?.data?.detail || 'Could not send the test.');
    } finally {
      setTestSending(false);
    }
  };

  const usedFooterCount = (footerId) => templates.filter((t) => t.footer_id === footerId && !t.footer_override_reason).length;

  const createTemplate = async () => {
    if (!creating.mailKey.trim() || !creating.mailLabel.trim() || !creating.processKey.trim()) {
      setCreateError('Fill in all three fields.');
      return;
    }
    setCreateBusy(true);
    setCreateError('');
    try {
      const { data } = await axios.post(
        `/api/email-templates/?user_id=${userId}`,
        { mail_key: creating.mailKey.trim(), mail_label: creating.mailLabel.trim(), process_key: creating.processKey.trim() },
        { headers: authHeaders() }
      );
      setTemplates((list) => [...list, data]);
      setSelectedId(data.id);
      setCreating(null);
    } catch (err) {
      setCreateError(err.response?.data?.detail || 'Could not create this template.');
    } finally {
      setCreateBusy(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-muted">Loading email templates…</div>;
  }

  const groups = templates.reduce((acc, t) => {
    (acc[t.process_key] = acc[t.process_key] || []).push(t);
    return acc;
  }, {});

  return (
    <div className="d-flex" style={{ minHeight: 'calc(100vh - 60px)' }}>
      {/* Rail */}
      <div style={{ width: 240, borderRight: '1px solid #e4ebf0', background: '#fff', flexShrink: 0, overflowY: 'auto' }} className="py-3">
        <div className="px-3 mb-3">
          <button
            className="btn btn-sm btn-outline-primary w-100"
            onClick={() => { setCreating({ mailKey: '', mailLabel: '', processKey: '' }); setCreateError(''); }}
          >
            + New template
          </button>
        </div>
        {Object.entries(groups).map(([processKey, group]) => (
          <div key={processKey} className="mb-2">
            <p className="text-muted px-3 mb-2" style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {PROCESS_LABELS[processKey] || processKey}
            </p>
            {group.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className="btn w-100 text-start border-0 rounded-0 d-flex align-items-center gap-2 px-3 py-2"
                style={{
                  background: selectedId === t.id ? '#e3eef9' : 'transparent',
                  borderLeft: selectedId === t.id ? '3px solid #10508c' : '3px solid transparent',
                  fontSize: 13,
                }}
              >
                <span className="text-muted" style={{ fontFamily: 'monospace', fontSize: 10.5 }}>{t.mail_key}</span>
                <span className="flex-grow-1">{t.mail_label}</span>
                <span
                  title={t.enabled ? 'Sending' : 'Not sending'}
                  style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: t.enabled ? '#1c6047' : '#d3dde5',
                    flexShrink: 0,
                  }}
                />
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Editor */}
      {form && (
        <div className="flex-grow-1 p-4" style={{ maxWidth: 620, overflowY: 'auto' }}>
          <p className="text-muted mb-1" style={{ fontFamily: 'monospace', fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {selected.mail_key}
          </p>
          <h4 className="mb-3">{selected.mail_label}</h4>

          <div className="card mb-3">
            <div className="card-header d-flex align-items-center justify-content-between">
              <span className="fw-semibold">Delivery</span>
              <div className="form-check form-switch mb-0">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={!!form.enabled}
                  onChange={(e) => setField('enabled', e.target.checked)}
                  id="enabledToggle"
                />
                <label className="form-check-label small" htmlFor="enabledToggle">
                  {form.enabled ? 'Sending' : 'Not sending'}
                </label>
              </div>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-6">
                  <Input label="From" id="from" value={form.from_address || ''} onChange={(e) => setField('from_address', e.target.value)} />
                </div>
                <div className="col-6">
                  <Input label="Reply-to" id="replyTo" value={form.reply_to || ''} onChange={(e) => setField('reply_to', e.target.value)} />
                </div>
              </div>
              <div className="row">
                <div className="col-8">
                  <Input
                    label="Status strip"
                    id="statusText"
                    value={form.status_strip_text || ''}
                    onChange={(e) => setField('status_strip_text', e.target.value)}
                    placeholder="Leave blank for no strip"
                  />
                </div>
                <div className="col-4">
                  <label className="form-label">Tone</label>
                  <select className="form-select" value={form.status_strip_tone || 'info'} onChange={(e) => setField('status_strip_tone', e.target.value)}>
                    {TONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header fw-semibold">Subject</div>
            <div className="card-body">
              <Input label="Subject line" id="subject" value={form.subject || ''} onChange={(e) => setField('subject', e.target.value)} />
              <Input label="Preheader" id="preheader" value={form.preheader || ''} onChange={(e) => setField('preheader', e.target.value)} />
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header fw-semibold">Body</div>
            <div className="card-body">
              <Input label="Heading" id="heading" value={form.heading || ''} onChange={(e) => setField('heading', e.target.value)} />
              <Input label="Opening" id="intro" rows={4} value={form.intro || ''} onChange={(e) => setField('intro', e.target.value)} />

              <label className="form-label">Detail panel</label>
              {form.detail_rows.map((row, i) => (
                <div className="d-flex gap-2 mb-2" key={i}>
                  <input className="form-control form-control-sm" placeholder="Label" value={row[0]} onChange={(e) => setDetailRow(i, 0, e.target.value)} />
                  <input className="form-control form-control-sm" placeholder="Value or {{variable}}" value={row[1]} onChange={(e) => setDetailRow(i, 1, e.target.value)} />
                  <button className="btn btn-sm btn-outline-secondary" onClick={() => removeDetailRow(i)}>✕</button>
                </div>
              ))}
              <button className="btn btn-sm btn-outline-secondary mb-3" onClick={addDetailRow}>+ Add a row</button>

              <div className="row">
                <div className="col-6">
                  <Input label="Button label" id="ctaLabel" value={form.cta_label || ''} onChange={(e) => setField('cta_label', e.target.value)} placeholder="Leave blank for no button" />
                </div>
                <div className="col-6">
                  <Input label="Button link" id="ctaUrl" value={form.cta_url || ''} onChange={(e) => setField('cta_url', e.target.value)} placeholder="{{some_url}}" />
                </div>
              </div>
              <Input label="After the button" id="outro" rows={3} value={form.outro || ''} onChange={(e) => setField('outro', e.target.value)} />
            </div>
          </div>

          <div className="card mb-3">
            <div className="card-header fw-semibold">Footer</div>
            <div className="card-body">
              <label className="form-label">Shared footer</label>
              <select
                className="form-select mb-3"
                value={form.footer_id || ''}
                disabled={!!form.footer_override_reason}
                onChange={(e) => setField('footer_id', Number(e.target.value))}
              >
                {footers.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({usedFooterCount(f.id)} using it)</option>
                ))}
              </select>
              <Input
                label="Override for this mail only"
                id="footerOverride"
                rows={3}
                value={form.footer_override_reason || ''}
                onChange={(e) => setField('footer_override_reason', e.target.value)}
                placeholder="Leave blank to use the shared footer above"
              />
            </div>
          </div>

          <div className="d-flex gap-2 mb-4">
            <Button onClick={save} loading={saving}>Save this mail</Button>
          </div>

          <div className="card mb-4">
            <div className="card-header fw-semibold">Send a test</div>
            <div className="card-body d-flex gap-2 align-items-end">
              <div className="flex-grow-1">
                <Input label="Send to" id="testEmail" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="you@company.com" className="mb-0" />
              </div>
              <Button variant="outline-green" onClick={sendTest} loading={testSending}>Send test</Button>
            </div>
            {testStatus && <div className="card-body pt-0 small text-muted">{testStatus}</div>}
          </div>
        </div>
      )}

      {/* Preview */}
      <div className="flex-grow-1 p-4" style={{ background: '#e3e9ef', overflowY: 'auto' }}>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <span className="fw-semibold">Preview</span>
          <div className="btn-group btn-group-sm">
            {['mail', 'html', 'text'].map((t) => (
              <button
                key={t}
                className={`btn ${previewTab === t ? 'btn-dark' : 'btn-outline-secondary'}`}
                onClick={() => setPreviewTab(t)}
              >
                {t === 'mail' ? 'Email' : t.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        {previewLoading || !preview ? (
          <div className="text-muted">Rendering…</div>
        ) : previewTab === 'mail' ? (
          <div className="d-flex justify-content-center">
            <iframe
              title="Email preview"
              srcDoc={preview.html}
              style={{ width: 600, maxWidth: '100%', height: 720, border: 0, background: '#fff', borderRadius: 2, boxShadow: '0 2px 12px rgba(21,34,46,.16)' }}
            />
          </div>
        ) : previewTab === 'html' ? (
          <pre style={{ background: '#0f1b26', color: '#cfe0ee', padding: 14, fontSize: 11, borderRadius: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{preview.html}</pre>
        ) : (
          <pre style={{ background: '#fff', padding: 14, fontSize: 11.5, borderRadius: 4, whiteSpace: 'pre-wrap' }}>{preview.text}</pre>
        )}
      </div>

      {/* New template modal */}
      {creating && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">New template</h5>
                  <button type="button" className="btn-close" onClick={() => setCreating(null)}></button>
                </div>
                <div className="modal-body">
                  <p className="text-muted small">
                    Creates a disabled stub with these three fields — everything else (subject, body,
                    footer) is filled in on the next screen. Wiring this mail_key up to an actual send
                    still needs a code change wherever it should trigger.
                  </p>
                  <Input
                    label="Mail key" id="newMailKey" value={creating.mailKey}
                    onChange={(e) => setCreating((c) => ({ ...c, mailKey: e.target.value }))}
                    placeholder="e.g. PR.1"
                  />
                  <Input
                    label="Label" id="newMailLabel" value={creating.mailLabel}
                    onChange={(e) => setCreating((c) => ({ ...c, mailLabel: e.target.value }))}
                    placeholder="e.g. Requisition submitted"
                  />
                  <Input
                    label="Process key" id="newProcessKey" value={creating.processKey}
                    onChange={(e) => setCreating((c) => ({ ...c, processKey: e.target.value }))}
                    placeholder="e.g. purchase_requisition"
                  />
                  {createError && <div className="text-danger small mt-2">{createError}</div>}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setCreating(null)}>Cancel</button>
                  <Button onClick={createTemplate} loading={createBusy}>Create</Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminEmailTemplates;
