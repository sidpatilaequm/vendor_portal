import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

const errorMessage = (err, fallback) =>
  err.response?.data?.detail || err.response?.data?.statusMsg || err.response?.data?.message || fallback;

const PAGE_SIZE = 50;

const Pill = ({ text, className }) => (
  <span className={`badge ${className} px-2.5 py-1 rounded fw-semibold`} style={{ fontSize: '11px' }}>{text}</span>
);

/* ============================================================
   Account Changes — who changed what on employee/admin accounts
   ============================================================ */

const ACTIONS = [
  { value: 'USER_CREATED', label: 'Created', badge: 'bg-success-subtle text-success' },
  { value: 'ROLE_ASSIGNED', label: 'Role assigned', badge: 'bg-info-subtle text-info' },
  { value: 'USER_UPDATED', label: 'Updated', badge: 'bg-primary-subtle text-primary' },
  { value: 'USER_DEACTIVATED', label: 'Deactivated', badge: 'bg-danger-subtle text-danger' },
  { value: 'PLATFORM_CREDENTIAL_UPDATED', label: 'Credential updated', badge: 'bg-warning-subtle text-warning' },
  { value: 'ROLE_PERMISSIONS_UPDATED', label: 'Role permissions updated', badge: 'bg-info-subtle text-info' },
  { value: 'VENDOR_PERMISSIONS_UPDATED', label: 'Vendor permissions updated', badge: 'bg-info-subtle text-info' },
  { value: 'VENDOR_TERMS_CREATED', label: 'Vendor terms created', badge: 'bg-success-subtle text-success' },
  { value: 'VENDOR_TERMS_UPDATED', label: 'Vendor terms updated', badge: 'bg-primary-subtle text-primary' },
  { value: 'BUDGET_UPLOADED', label: 'Budget uploaded', badge: 'bg-success-subtle text-success' },
];

const actionMeta = (value) => ACTIONS.find((a) => a.value === value) || { label: value, badge: 'bg-secondary-subtle text-secondary' };

const FIELD_LABELS = {
  email: 'Email', role: 'Role', firstName: 'First name', lastName: 'Last name',
  phoneNumber: 'Phone', isActive: 'Active',
  permissionsUpdated: 'Permissions changed', fiscalYear: 'Fiscal year', totalAmount: 'Total amount',
  paymentTermsFile: 'Payment terms file', incotermsFile: 'Incoterms file', deliveryTermsFile: 'Delivery terms file',
  'azure.tenant_id': 'Azure tenant ID', 'azure.client_id': 'Azure client ID', 'azure.client_secret': 'Azure client secret',
  'google.client_id': 'Google client ID', 'google.client_secret': 'Google client secret', 'google.hosted_domain': 'Google Workspace domain',
  'folderit.client_id': 'FolderIt client ID', 'folderit.client_secret': 'FolderIt client secret', 'folderit.account_uid': 'FolderIt account UID',
  'microvista.token_id': 'Microvista token ID', 'microvista.token_secret': 'Microvista token secret',
};
const fieldLabel = (f) => FIELD_LABELS[f] || f;

const AccountChangesTab = () => {
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = (pageToLoad, replace) => {
    setLoading(true);
    setError('');
    const params = { page: pageToLoad, size: PAGE_SIZE };
    if (actionFilter) params.action = actionFilter;
    axios.get('/api/admin/audit-log', { headers: authHeaders(), params })
      .then((res) => {
        setEntries((prev) => (replace ? res.data.entries : [...prev, ...res.data.entries]));
        setPage(res.data.page);
        setTotalPages(res.data.totalPages);
      })
      .catch((err) => setError(errorMessage(err, 'Could not load the audit log.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(0, true); }, [actionFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.actorName, e.actorEmail, e.targetName, e.targetEmail].some((v) => (v || '').toLowerCase().includes(q)));
  }, [entries, search]);

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-end gap-2 mb-3">
        <select className="form-select form-select-sm" style={{ width: 170 }} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <input type="text" className="form-control form-control-sm" style={{ width: 220 }}
          placeholder="Search actor or target…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <p style={{ color: 'var(--iron)', fontSize: 13.5 }}>{error}</p>}

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light text-muted fw-bold" style={{ fontSize: '11px' }}>
            <tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>What changed</th></tr>
          </thead>
          <tbody style={{ fontSize: 13 }}>
            {visible.map((e) => {
              const meta = actionMeta(e.action);
              let changes = [];
              try { changes = e.fieldChanges ? JSON.parse(e.fieldChanges) : []; } catch { changes = []; }
              return (
                <tr key={e.id}>
                  <td className="text-muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(e.createdAt).toLocaleString()}</td>
                  <td>
                    <div className="fw-semibold">{e.actorName || '—'}</div>
                    <div className="text-muted" style={{ fontSize: 11.5 }}>{e.actorEmail}</div>
                  </td>
                  <td><Pill text={meta.label} className={meta.badge} /></td>
                  <td>
                    <div className="fw-semibold">{e.targetName || '—'}</div>
                    <div className="text-muted" style={{ fontSize: 11.5 }}>{e.targetEmail}</div>
                  </td>
                  <td>
                    {changes.map((c, i) => (
                      c.oldValue == null && c.newValue == null ? (
                        <div key={i} style={{ fontSize: 12 }}>
                          <span className="fw-semibold">{fieldLabel(c.field)}</span> <span className="text-muted">changed</span>
                        </div>
                      ) : (
                        <div key={i} style={{ fontSize: 12 }}>
                          <span className="text-muted">{fieldLabel(c.field)}:</span>{' '}
                          {c.oldValue ? <><span className="text-muted">{c.oldValue}</span> {'→'} </> : null}
                          <span className="fw-semibold">{c.newValue}</span>
                        </div>
                      )
                    ))}
                    {e.passwordReset && <Pill text="Password reset" className="bg-warning-subtle text-warning" />}
                    {changes.length === 0 && !e.passwordReset && <span className="text-muted">—</span>}
                  </td>
                </tr>
              );
            })}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted py-4">No matching entries.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && <p className="text-muted text-center mt-3" style={{ fontSize: 13 }}>Loading…</p>}
      {!loading && page + 1 < totalPages && (
        <div className="text-center mt-3">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => load(page + 1, false)}>Load more</button>
        </div>
      )}
    </>
  );
};

/* ============================================================
   Approvals — surfaced from WorkFlow's approval_actions (read-only)
   ============================================================ */

const decisionMeta = (value) => ({
  approved: { label: 'Approved', badge: 'bg-success-subtle text-success' },
  rejected: { label: 'Rejected', badge: 'bg-danger-subtle text-danger' },
  delegated: { label: 'Delegated', badge: 'bg-info-subtle text-info' },
}[value] || { label: value, badge: 'bg-secondary-subtle text-secondary' });

const ApprovalsTab = () => {
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = (pageToLoad, replace) => {
    setLoading(true);
    setError('');
    axios.get('/api/admin/audit-log/approvals', { headers: authHeaders(), params: { page: pageToLoad, size: PAGE_SIZE } })
      .then((res) => {
        setEntries((prev) => (replace ? res.data.entries : [...prev, ...res.data.entries]));
        setPage(res.data.page);
        setTotalPages(res.data.totalPages);
      })
      .catch((err) => setError(errorMessage(err, 'Could not load approvals.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(0, true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.approverName, e.approverEmail, e.requestTitle, e.workflowName].some((v) => (v || '').toLowerCase().includes(q)));
  }, [entries, search]);

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <input type="text" className="form-control form-control-sm" style={{ width: 240 }}
          placeholder="Search approver or request…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <p style={{ color: 'var(--iron)', fontSize: 13.5 }}>{error}</p>}

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light text-muted fw-bold" style={{ fontSize: '11px' }}>
            <tr><th>Time</th><th>Approver</th><th>Decision</th><th>Request</th><th>Comment</th></tr>
          </thead>
          <tbody style={{ fontSize: 13 }}>
            {visible.map((e, i) => {
              const meta = decisionMeta(e.decision);
              return (
                <tr key={i}>
                  <td className="text-muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(e.actedAt).toLocaleString()}</td>
                  <td>
                    <div className="fw-semibold">{e.approverName || '—'}</div>
                    <div className="text-muted" style={{ fontSize: 11.5 }}>{e.approverEmail}</div>
                    {e.delegatedToName && <div className="text-muted" style={{ fontSize: 11 }}>→ delegated to {e.delegatedToName}</div>}
                  </td>
                  <td><Pill text={meta.label} className={meta.badge} /></td>
                  <td>
                    <div className="fw-semibold">{e.requestTitle || '—'}</div>
                    <div className="text-muted" style={{ fontSize: 11.5 }}>
                      {[e.workflowName, e.requestType, e.department].filter(Boolean).join(' · ')}
                      {e.amount != null && ` · ₹${e.amount.toLocaleString()}`}
                    </div>
                  </td>
                  <td style={{ fontSize: 12.5 }}>{e.comment || <span className="text-muted">—</span>}</td>
                </tr>
              );
            })}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted py-4">No matching entries.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && <p className="text-muted text-center mt-3" style={{ fontSize: 13 }}>Loading…</p>}
      {!loading && page + 1 < totalPages && (
        <div className="text-center mt-3">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => load(page + 1, false)}>Load more</button>
        </div>
      )}
    </>
  );
};

/* ============================================================
   Login Activity — password, Microsoft, Google sign-in attempts
   ============================================================ */

const METHOD_META = {
  PASSWORD: { label: 'Password', icon: 'fa-key' },
  MICROSOFT: { label: 'Microsoft', icon: 'fa-brands fa-microsoft' },
  GOOGLE: { label: 'Google', icon: 'fa-brands fa-google' },
};

const REASON_LABELS = {
  bad_credentials: 'Wrong password',
  account_disabled: 'Account deactivated',
  no_account: 'No matching account',
  cancelled: 'Sign-in cancelled',
  exchange_failed: 'Provider rejected sign-in',
};

const LoginActivityTab = () => {
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = (pageToLoad, replace) => {
    setLoading(true);
    setError('');
    const params = { page: pageToLoad, size: PAGE_SIZE };
    if (resultFilter) params.success = resultFilter === 'success';
    if (methodFilter) params.method = methodFilter;
    axios.get('/api/admin/audit-log/logins', { headers: authHeaders(), params })
      .then((res) => {
        setEntries((prev) => (replace ? res.data.entries : [...prev, ...res.data.entries]));
        setPage(res.data.page);
        setTotalPages(res.data.totalPages);
      })
      .catch((err) => setError(errorMessage(err, 'Could not load login activity.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(0, true); }, [resultFilter, methodFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => (e.email || '').toLowerCase().includes(q));
  }, [entries, search]);

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-end gap-2 mb-3">
        <select className="form-select form-select-sm" style={{ width: 130 }} value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
          <option value="">All results</option>
          <option value="success">Success</option>
          <option value="failure">Failed</option>
        </select>
        <select className="form-select form-select-sm" style={{ width: 140 }} value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
          <option value="">All methods</option>
          <option value="PASSWORD">Password</option>
          <option value="MICROSOFT">Microsoft</option>
          <option value="GOOGLE">Google</option>
        </select>
        <input type="text" className="form-control form-control-sm" style={{ width: 200 }}
          placeholder="Search email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <p style={{ color: 'var(--iron)', fontSize: 13.5 }}>{error}</p>}

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light text-muted fw-bold" style={{ fontSize: '11px' }}>
            <tr><th>Time</th><th>Email</th><th>Method</th><th>Result</th><th>Reason</th></tr>
          </thead>
          <tbody style={{ fontSize: 13 }}>
            {visible.map((e) => {
              const method = METHOD_META[e.method] || { label: e.method, icon: 'fa-question' };
              return (
                <tr key={e.id}>
                  <td className="text-muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{new Date(e.createdAt).toLocaleString()}</td>
                  <td>{e.email}</td>
                  <td><i className={`fa ${method.icon} me-1 text-muted`}></i>{method.label}</td>
                  <td>{e.success
                    ? <Pill text="Success" className="bg-success-subtle text-success" />
                    : <Pill text="Failed" className="bg-danger-subtle text-danger" />}
                  </td>
                  <td className="text-muted" style={{ fontSize: 12.5 }}>{REASON_LABELS[e.failureReason] || e.failureReason || '—'}</td>
                </tr>
              );
            })}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted py-4">No matching entries.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && <p className="text-muted text-center mt-3" style={{ fontSize: 13 }}>Loading…</p>}
      {!loading && page + 1 < totalPages && (
        <div className="text-center mt-3">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => load(page + 1, false)}>Load more</button>
        </div>
      )}
    </>
  );
};

/* ============================================================
   PR Lifecycle — one PR's full journey: workflow approval, RFQ,
   quotations, PO, ASN, Gate Entry, Material Inward
   ============================================================ */

// The 11 stages the user actually cares about, in order — several raw event "stage" codes from
// the backend collapse into one of these (e.g. the workflow approval trail is 3 event types:
// submitted / each approver's action / resolved).
const STAGE_GROUPS = [
  { label: 'PR Created', keys: ['PR_CREATED'] },
  { label: 'Workflow Approval', keys: ['WORKFLOW_SUBMITTED', 'WORKFLOW_ACTION', 'WORKFLOW_RESOLVED'] },
  { label: 'RFQ Sent', keys: ['RFQ_SENT'] },
  { label: 'Quotation Acknowledged', keys: ['QUOTATION_ACK'] },
  { label: 'Quotation Sent to Company', keys: ['QUOTATION_SUBMITTED'] },
  { label: 'Quotation Awarded', keys: ['QUOTATION_AWARDED'] },
  { label: 'PO Generated', keys: ['PO_GENERATED'] },
  { label: 'PO Acknowledged', keys: ['PO_ACK'] },
  { label: 'ASN Sent', keys: ['ASN_SENT'] },
  { label: 'Gate Entry Created', keys: ['GATE_ENTRY'] },
  { label: 'Material Inward', keys: ['MATERIAL_INWARD'] },
];

const stageDecisionMeta = (status) => {
  const s = (status || '').toUpperCase();
  if (['AWARDED', 'ACCEPTED', 'ACKNOWLEDGED', 'APPROVED', 'ALLOW', 'ACCEPT'].includes(s)) {
    return { badge: 'bg-success-subtle text-success border-success-subtle', card: 'border-success-subtle bg-success bg-opacity-10' };
  }
  if (['REJECTED', 'REJECT', 'HOLD'].includes(s)) {
    return { badge: 'bg-danger-subtle text-danger border-danger-subtle', card: 'border-light bg-light' };
  }
  return { badge: 'bg-secondary-subtle text-secondary border-secondary-subtle', card: 'border-light bg-white' };
};

const StageStep = ({ index, label, events, awardedVendor }) => {
  const done = events.length > 0;
  // Group same-stage events by branch (vendor / PO / etc.) so parallel activity (multiple RFQ
  // recipients, multiple quotations) shows as separate chips within this one step.
  const byBranch = useMemo(() => {
    const map = new Map();
    events.forEach((e) => {
      const key = e.branchKey || '—';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return [...map.entries()];
  }, [events]);

  return (
    <div className="d-flex gap-3" style={{ position: 'relative' }}>
      <div className="d-flex flex-column align-items-center" style={{ flexShrink: 0 }}>
        <div
          className="d-flex align-items-center justify-content-center fw-bold"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: done ? 'var(--bs-success-bg-subtle, #d1e7dd)' : '#f1f2f6',
            border: `2px solid ${done ? '#198754' : '#ced4da'}`,
            color: done ? '#198754' : '#adb5bd',
            fontSize: 13,
          }}
        >
          {index + 1}
        </div>
        {index < STAGE_GROUPS.length - 1 && (
          <div style={{ width: 2, flexGrow: 1, minHeight: 24, background: '#e2e5ea', marginTop: 4, marginBottom: 4 }} />
        )}
      </div>
      <div className="pb-4" style={{ flexGrow: 1, minWidth: 0 }}>
        <div className="fw-semibold" style={{ fontSize: 13.5, color: done ? '#212529' : '#adb5bd' }}>{label}</div>
        {!done && <div className="text-muted" style={{ fontSize: 12 }}>Not reached yet</div>}
        {done && (
          <div className="d-flex flex-column gap-2 mt-2">
            {byBranch.map(([branch, branchEvents]) => {
              const isAwardedBranch = awardedVendor && branch === awardedVendor;
              return (
                <div
                  key={branch}
                  className={`border rounded p-2 ${isAwardedBranch ? 'border-success-subtle bg-success bg-opacity-10' : 'border-light bg-light'}`}
                >
                  {branch !== '—' && <div className="fw-semibold" style={{ fontSize: 12 }}>{branch}</div>}
                  {branchEvents.map((e, i) => {
                    const meta = stageDecisionMeta(e.status);
                    return (
                      <div key={i} className="d-flex flex-wrap align-items-center gap-2 mt-1" style={{ fontSize: 11.5 }}>
                        <span className="text-muted">{e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}</span>
                        {e.status && <Pill text={e.status} className={meta.badge} />}
                        {e.actorName && <span className="text-muted">by {e.actorName}</span>}
                        {e.detail && <span className="text-muted">· {e.detail}</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const PrLifecycleTab = () => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [prNumber, setPrNumber] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query.trim() || query === prNumber) { setSuggestions([]); return; }
    const t = setTimeout(() => {
      axios.get('/api/admin/audit-log/pr-lifecycle/search', { headers: authHeaders(), params: { q: query } })
        .then((res) => setSuggestions(res.data.prNumbers || []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [query, prNumber]);

  const load = (pr) => {
    setPrNumber(pr);
    setQuery(pr);
    setSuggestions([]);
    setLoading(true);
    setError('');
    setData(null);
    axios.get('/api/admin/audit-log/pr-lifecycle', { headers: authHeaders(), params: { prNumber: pr } })
      .then((res) => setData(res.data))
      .catch((err) => setError(errorMessage(err, 'Could not load this PR.')))
      .finally(() => setLoading(false));
  };

  const awardedVendor = useMemo(() => {
    const awarded = (data?.events || []).find((e) => e.stage === 'QUOTATION_AWARDED');
    return awarded ? awarded.branchKey : null;
  }, [data]);

  return (
    <>
      <div className="d-flex justify-content-end mb-3">
        <div style={{ position: 'relative', width: 280 }}>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Search PR number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && query.trim()) load(query.trim()); }}
          />
          {suggestions.length > 0 && (
            <div className="border rounded shadow-sm bg-white position-absolute w-100 mt-1" style={{ zIndex: 10 }}>
              {suggestions.map((s) => (
                <div key={s} className="px-2 py-1" style={{ fontSize: 13, cursor: 'pointer' }}
                  onClick={() => load(s)}
                  onMouseDown={(e) => e.preventDefault()}>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <p style={{ color: 'var(--iron)', fontSize: 13.5 }}>{error}</p>}
      {loading && <p className="text-muted text-center mt-3" style={{ fontSize: 13 }}>Loading…</p>}

      {!loading && !data && !error && (
        <p className="text-muted text-center py-4" style={{ fontSize: 13 }}>Search for a PR number to see its full journey.</p>
      )}

      {data && (
        <>
          <div className="mb-4">
            <div className="fw-bold" style={{ fontSize: 15 }}>{data.prNumber}</div>
            <div className="text-muted" style={{ fontSize: 12.5 }}>
              {data.requestedBy && <>Created by {data.requestedBy} · </>}
              Current status: {data.prStatus}
            </div>
          </div>

          <div className="mb-4">
            {STAGE_GROUPS.map((g, i) => (
              <StageStep
                key={g.label}
                index={i}
                label={g.label}
                events={(data.events || []).filter((e) => g.keys.includes(e.stage))}
                awardedVendor={awardedVendor}
              />
            ))}
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted fw-bold" style={{ fontSize: '11px' }}>
                <tr><th>Time</th><th>Stage</th><th>Branch</th><th>Actor</th><th>Status</th><th>Detail</th></tr>
              </thead>
              <tbody style={{ fontSize: 13 }}>
                {(data.events || []).map((e, i) => {
                  const meta = stageDecisionMeta(e.status);
                  return (
                    <tr key={i}>
                      <td className="text-muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}</td>
                      <td>{e.stageLabel}</td>
                      <td>{e.branchKey || <span className="text-muted">—</span>}</td>
                      <td>{e.actorName || <span className="text-muted">—</span>}</td>
                      <td>{e.status ? <Pill text={e.status} className={meta.badge} /> : <span className="text-muted">—</span>}</td>
                      <td style={{ fontSize: 12.5 }}>{e.detail || <span className="text-muted">—</span>}</td>
                    </tr>
                  );
                })}
                {(data.events || []).length === 0 && (
                  <tr><td colSpan={6} className="text-center text-muted py-4">No events recorded for this PR yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
};

/* ============================================================
   Main component — tabbed shell
   ============================================================ */

const TABS = [
  { key: 'accounts', label: 'Account Changes', render: () => <AccountChangesTab /> },
  { key: 'approvals', label: 'Approvals', render: () => <ApprovalsTab /> },
  { key: 'logins', label: 'Login Activity', render: () => <LoginActivityTab /> },
  { key: 'pr-lifecycle', label: 'PR Lifecycle', render: () => <PrLifecycleTab /> },
];

const AdminAuditLog = () => {
  const [activeTab, setActiveTab] = useState('accounts');

  return (
    <div className="cfg">
      <section className="card">
        <div className="card-body">
          <div className="mb-3">
            <h2 className="card-head mb-1">Audit Log</h2>
            <p className="text-muted mb-0" style={{ fontSize: 12.5 }}>
              Who did what — account changes, approvals, and sign-in activity.
            </p>
          </div>

          <ul className="nav nav-tabs mb-3">
            {TABS.map((t) => (
              <li className="nav-item" key={t.key}>
                <button
                  className={`nav-link ${activeTab === t.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                </button>
              </li>
            ))}
          </ul>

          {TABS.find((t) => t.key === activeTab)?.render()}
        </div>
      </section>
    </div>
  );
};

export default AdminAuditLog;
