import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });
const errorMessage = (err, fallback) =>
  err.response?.data?.detail || err.response?.data?.statusMsg || err.response?.data?.message || fallback;

const EMPTY_FORM = {
  roleCode: '', roleName: '', assigneeType: '', assigneeRef: '', validTo: '', companyCodes: [],
};

const STEPS = ['Role name', 'Assign to', 'Company codes', 'Document types', 'Review'];

/**
 * Purchasing role management — ported from the standalone role-manager prototype into the real
 * admin panel. Grants specific document types per company code, at an access level that depends
 * on whether the role belongs to a vendor or an employee. Company codes come from the existing
 * SAP-style enterprise structure (GET /api/mm/companies), not a new table.
 */
const AdminPurchaseRoles = ({ onBack }) => {
  const [companies, setCompanies] = useState([]);
  const [docTypes, setDocTypes] = useState([]);
  const [levels, setLevels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');

  const [form, setForm] = useState(EMPTY_FORM);
  const [grants, setGrants] = useState({}); // "DOCTYPE|CC" -> access level
  const [editingId, setEditingId] = useState(null);
  const [codeTouched, setCodeTouched] = useState(false);
  const [stage, setStage] = useState(1);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ code: '', description: '', docCategory: 'F', classification: 'Product' });
  const [addPicked, setAddPicked] = useState([]);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    Promise.all([
      axios.get('/api/mm/companies', { headers: authHeaders() }),
      axios.get('/api/purchase-roles/document-types', { headers: authHeaders() }),
    ]).then(([c, d]) => {
      setCompanies(c.data.companies || []);
      setDocTypes(d.data || []);
    }).catch((e) => setBanner({ kind: 'danger', text: errorMessage(e, 'Could not reach the API.') }))
      .finally(() => setLoading(false));
  }, []);

  const reloadDocTypes = () =>
    axios.get('/api/purchase-roles/document-types', { headers: authHeaders() })
      .then((d) => setDocTypes(d.data || []));

  const reloadRoles = React.useCallback(() => {
    axios.get('/api/purchase-roles', { headers: authHeaders(), params: roleFilter ? { assigneeType: roleFilter } : {} })
      .then((r) => setRoles(r.data || []))
      .catch((e) => setBanner({ kind: 'danger', text: errorMessage(e, 'Could not load roles.') }));
  }, [roleFilter]);

  useEffect(() => { reloadRoles(); }, [reloadRoles]);

  useEffect(() => {
    if (!form.assigneeType) { setLevels([]); return; }
    axios.get('/api/purchase-roles/access-levels', { headers: authHeaders(), params: { assigneeType: form.assigneeType } })
      .then((r) => setLevels(r.data || []))
      .catch((e) => setBanner({ kind: 'danger', text: errorMessage(e, 'Could not load access levels.') }));
  }, [form.assigneeType]);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onName = (v) => {
    setForm((f) => ({
      ...f,
      roleName: v,
      roleCode: codeTouched ? f.roleCode
        : v ? `Z_MM_${v.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24)}` : '',
    }));
  };

  const toggleCompany = (code) => {
    setForm((f) => {
      const has = f.companyCodes.includes(code);
      const next = has ? f.companyCodes.filter((c) => c !== code) : [...f.companyCodes, code].sort();
      if (has) {
        setGrants((g) => Object.fromEntries(Object.entries(g).filter(([k]) => !k.endsWith(`|${code}`))));
      }
      return { ...f, companyCodes: next };
    });
  };

  const defaultLevel = levels.length ? levels[0].code : 'display';

  const toggleGrant = (docCode, cc) =>
    setGrants((g) => {
      const key = `${docCode}|${cc}`;
      if (g[key]) { const { [key]: _drop, ...rest } = g; return rest; }
      return { ...g, [key]: defaultLevel };
    });

  const setGrantLevel = (docCode, cc, level) => setGrants((g) => ({ ...g, [`${docCode}|${cc}`]: level }));

  const selectAllForCc = (cc, codes) =>
    setGrants((g) => {
      const next = { ...g };
      codes.forEach((code) => { if (!next[`${code}|${cc}`]) next[`${code}|${cc}`] = defaultLevel; });
      return next;
    });

  const startNew = () => {
    setForm(EMPTY_FORM); setGrants({}); setEditingId(null); setStage(1);
    setCodeTouched(false); setErrors({}); setBanner(null); setAddOpen(false);
  };

  const loadRole = (id) => {
    axios.get(`/api/purchase-roles/${id}`, { headers: authHeaders() })
      .then((r) => {
        const role = r.data;
        setForm({
          roleCode: role.roleCode, roleName: role.roleName, assigneeType: role.assigneeType,
          assigneeRef: role.assigneeRef ?? '', validTo: role.validTo ?? '', companyCodes: role.companyCodes,
        });
        setGrants(Object.fromEntries(role.grants.map((g) => [`${g.docTypeCode}|${g.companyCode}`, g.accessLevel])));
        setEditingId(id); setCodeTouched(true); setStage(5); setErrors({}); setBanner(null);
      })
      .catch((e) => setBanner({ kind: 'danger', text: errorMessage(e, 'Could not load role.') }));
  };

  const advance = (from) => {
    const e = {};
    if (from === 1 && (!form.roleName.trim() || !form.roleCode.trim())) e[1] = 'Enter a role name.';
    if (from === 2) {
      if (!form.assigneeType) e[2] = 'Choose vendor or employee.';
      else if (form.assigneeType === 'VENDOR' && !form.assigneeRef.trim()) e[2] = 'Enter the vendor code this role is limited to.';
    }
    if (from === 3 && form.companyCodes.length === 0) e[3] = 'Select at least one company code.';
    if (from === 4 && Object.keys(grants).length === 0) e[4] = 'Grant at least one document type.';
    setErrors(e);
    if (Object.keys(e).length === 0) setStage(from + 1);
  };

  const stateOf = (n) => (n === stage ? 'active' : n < stage ? 'done' : 'locked');

  const payload = useMemo(() => ({
    roleCode: form.roleCode,
    roleName: form.roleName,
    assigneeType: form.assigneeType,
    assigneeRef: form.assigneeRef || null,
    validTo: form.validTo || null,
    companyCodes: form.companyCodes,
    grants: Object.entries(grants).map(([k, level]) => {
      const [docTypeCode, companyCode] = k.split('|');
      return { docTypeCode, companyCode, accessLevel: level };
    }),
  }), [form, grants]);

  const canSave = form.roleCode && form.roleName && form.assigneeType
    && (form.assigneeType !== 'VENDOR' || form.assigneeRef)
    && form.companyCodes.length > 0 && Object.keys(grants).length > 0;

  const save = () => {
    setSaving(true);
    const req = editingId
      ? axios.put(`/api/purchase-roles/${editingId}`, payload, { headers: authHeaders() })
      : axios.post('/api/purchase-roles', payload, { headers: authHeaders() });
    req.then((r) => {
      setEditingId(r.data.id);
      setBanner({ kind: 'success', text: `${r.data.roleCode} saved.` });
      reloadRoles();
    }).catch((e) => setBanner({ kind: 'danger', text: errorMessage(e, 'Could not save role.') }))
      .finally(() => setSaving(false));
  };

  const remove = () => {
    if (!editingId) return;
    axios.delete(`/api/purchase-roles/${editingId}`, { headers: authHeaders() })
      .then(() => { setBanner({ kind: 'success', text: 'Role deleted.' }); startNew(); reloadRoles(); })
      .catch((e) => setBanner({ kind: 'danger', text: errorMessage(e, 'Could not delete role.') }));
  };

  const submitAddDocType = () => {
    setAddError('');
    if (!/^[A-Z0-9]{2,4}$/.test(addForm.code)) return setAddError('Document type must be 2 to 4 characters, A-Z or 0-9.');
    if (!addForm.description.trim()) return setAddError('Enter a description.');
    if (addPicked.length === 0) return setAddError('Select at least one company code.');
    axios.post('/api/purchase-roles/document-types', {
      ...addForm,
      assignments: addPicked.map((c) => ({ companyCode: c })),
    }, { headers: authHeaders() })
      .then(() => {
        setBanner({ kind: 'success', text: `${addForm.code} registered.` });
        setAddOpen(false);
        reloadDocTypes();
      })
      .catch((e) => setAddError(errorMessage(e, 'Could not register document type.')));
  };

  const openAdd = () => {
    setAddForm({ code: '', description: '', docCategory: 'F', classification: 'Product' });
    setAddPicked([...form.companyCodes]);
    setAddError('');
    setAddOpen(true);
  };

  const nGrants = Object.keys(grants).length;

  if (loading) {
    return <div className="p-4 text-muted small">Loading reference data…</div>;
  }

  return (
    <div className="container-fluid py-4" style={{ backgroundColor: 'var(--background-light, #f4f7f6)', minHeight: '100vh' }}>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div>
          <h4 className="fw-bold mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>Purchasing Roles</h4>
          <p className="text-muted mb-0 small">
            Name the role, decide whether it belongs to a vendor or an employee, then grant the
            document types available in the company codes it covers.
          </p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-sm btn-outline-primary" onClick={startNew}>New role</button>
          {onBack && <button className="btn btn-sm btn-outline-secondary" onClick={onBack}>Back</button>}
        </div>
      </div>

      {banner && (
        <div className={`alert alert-${banner.kind === 'danger' ? 'danger' : 'success'} py-2 small`} role="alert">
          {banner.text}
        </div>
      )}

      <div className="row g-4">
        {/* Role list */}
        <div className="col-12 col-lg-3">
          <div className="card shadow-sm border-0">
            <div className="card-header bg-white d-flex align-items-center justify-content-between">
              <span className="fw-semibold small">Roles</span>
            </div>
            <div className="p-2 border-bottom">
              <select className="form-select form-select-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="">All role types</option>
                <option value="VENDOR">Vendor roles</option>
                <option value="EMPLOYEE">Employee roles</option>
              </select>
            </div>
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {roles.length === 0 && <div className="p-3 text-muted small text-center">No roles yet.</div>}
              {roles.map((r) => (
                <div
                  key={r.id}
                  className={`p-2 px-3 border-bottom d-flex justify-content-between align-items-start ${r.id === editingId ? 'bg-light' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => loadRole(r.id)}
                >
                  <div className="min-w-0">
                    <div className="small text-muted" style={{ fontFamily: 'monospace' }}>{r.roleCode}</div>
                    <div className="fw-semibold small">{r.roleName}</div>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {(r.companyCodes || []).join(' · ') || 'no company code'} · {r.grantCount} grant{r.grantCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span className={`badge ${r.assigneeType === 'VENDOR' ? 'bg-info-subtle text-info' : 'bg-primary-subtle text-primary'}`} style={{ fontSize: 10 }}>
                    {r.assigneeType === 'VENDOR' ? 'Vendor' : 'Employee'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Wizard */}
        <div className="col-12 col-lg-9">
          {/* Step 1 */}
          <StepCard index={1} title="Role name" state={stateOf(1)} onReopen={() => setStage(1)}
            summary={form.roleName ? <><b>{form.roleName}</b> · <code>{form.roleCode}</code></> : ''}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small">Role name</label>
                <input className="form-control" value={form.roleName} onChange={(e) => onName(e.target.value)}
                  placeholder="Buyer — unit 1 direct materials" />
                <div className="form-text">How the role appears to administrators.</div>
              </div>
              <div className="col-md-6">
                <label className="form-label small">Role code</label>
                <input className="form-control" style={{ fontFamily: 'monospace' }} value={form.roleCode}
                  onChange={(e) => { setCodeTouched(true); setField('roleCode', e.target.value.toUpperCase()); }}
                  placeholder="Z_MM_BUYER_1000" />
                <div className="form-text">Generated from the name. Edit if your naming standard differs.</div>
              </div>
            </div>
            <div className="mt-3 d-flex align-items-center gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => advance(1)}>Continue</button>
              {errors[1] && <span className="text-danger small">{errors[1]}</span>}
            </div>
          </StepCard>

          {/* Step 2 */}
          <StepCard index={2} title="Assign to" state={stateOf(2)} onReopen={() => setStage(2)}
            summary={form.assigneeType ? <><b>{form.assigneeType === 'VENDOR' ? 'Vendor' : 'Employee'}</b>{form.assigneeRef ? <> · <code>{form.assigneeRef}</code></> : null}</> : ''}>
            <div className="row g-3">
              {[
                ['VENDOR', 'Vendor', 'An external supplier working through the portal. Read and confirm only — vendors never create, change or approve a purchasing document.'],
                ['EMPLOYEE', 'Employee', 'An internal user in SAP. Can be granted creation, change and approval rights depending on the document type.'],
              ].map(([v, n, d]) => (
                <div className="col-md-6" key={v}>
                  <div
                    className={`card h-100 p-3 ${form.assigneeType === v ? 'border-primary' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => { setField('assigneeType', v); setGrants({}); }}
                  >
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <input type="radio" readOnly checked={form.assigneeType === v} />
                      <span className="fw-semibold">{n}</span>
                    </div>
                    <div className="text-muted small">{d}</div>
                  </div>
                </div>
              ))}
            </div>
            {form.assigneeType && (
              <div className="row g-3 mt-1">
                <div className="col-md-6">
                  <label className="form-label small">{form.assigneeType === 'VENDOR' ? 'Vendor code' : 'User ID or department'}</label>
                  <input className="form-control" style={{ fontFamily: 'monospace' }} value={form.assigneeRef}
                    onChange={(e) => setField('assigneeRef', e.target.value)}
                    placeholder={form.assigneeType === 'VENDOR' ? '2100188' : 'S.KULKARNI'} />
                  <div className="form-text">
                    {form.assigneeType === 'VENDOR'
                      ? 'The portal filters every document to this vendor code. Nothing in SAP does this on its own.'
                      : 'Optional. Leave blank to create the role before assigning users.'}
                  </div>
                </div>
              </div>
            )}
            <div className="mt-3 d-flex align-items-center gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => advance(2)}>Continue</button>
              {errors[2] && <span className="text-danger small">{errors[2]}</span>}
            </div>
          </StepCard>

          {/* Step 3 */}
          <StepCard index={3} title="Company codes" state={stateOf(3)} onReopen={() => setStage(3)}
            summary={form.companyCodes.length ? <b>{form.companyCodes.join(' + ')}</b> : ''}>
            <div className="row g-2">
              {companies.map((c) => {
                const n = docTypes.filter((d) => (d.assignments || []).some((a) => a.companyCode === c.companyCode)).length;
                const on = form.companyCodes.includes(c.companyCode);
                return (
                  <div className="col-md-6" key={c.companyCode}>
                    <div className={`card p-2 px-3 d-flex flex-row align-items-center gap-2 ${on ? 'border-primary' : ''}`}
                      style={{ cursor: 'pointer' }} onClick={() => toggleCompany(c.companyCode)}>
                      <input type="checkbox" readOnly checked={on} />
                      <div>
                        <div className="fw-semibold small">{c.companyCode}</div>
                        <div className="text-muted small">{c.companyName}</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>{n} document type{n === 1 ? '' : 's'} available</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {companies.length === 0 && <div className="text-muted small">No company codes configured yet — add them under Master Data → Enterprise Structure.</div>}
            </div>
            <div className="mt-3 d-flex align-items-center gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => advance(3)}>Continue</button>
              {errors[3] && <span className="text-danger small">{errors[3]}</span>}
            </div>
          </StepCard>

          {/* Step 4 */}
          <StepCard index={4} title="Document types" state={stateOf(4)} onReopen={() => setStage(4)}
            summary={nGrants ? <><b>{nGrants}</b> document type{nGrants === 1 ? '' : 's'} granted</> : ''}>
            {form.companyCodes.map((cc) => {
              const co = companies.find((c) => c.companyCode === cc);
              const rows = docTypes
                .filter((d) => (d.assignments || []).some((a) => a.companyCode === cc))
                .map((d) => ({ ...d, assignment: d.assignments.find((a) => a.companyCode === cc) }));
              return (
                <div key={cc} className="mb-3">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                    <span className="fw-semibold small">Company code {cc} <span className="text-muted fw-normal">— {co?.companyName}</span></span>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => selectAllForCc(cc, rows.map((r) => r.code))}>
                      Select all
                    </button>
                  </div>
                  {rows.length === 0 && <div className="text-muted small mb-2">No document types assigned to this company code.</div>}
                  {rows.map((d) => {
                    const key = `${d.code}|${cc}`;
                    const on = Boolean(grants[key]);
                    return (
                      <div key={key} className={`d-flex align-items-center gap-2 p-2 border-bottom ${on ? 'bg-light' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => toggleGrant(d.code, cc)} />
                        <code style={{ minWidth: 44 }}>{d.code}</code>
                        <div className="flex-grow-1 min-w-0">
                          <div className="small fw-semibold">{d.description}</div>
                          <div className="text-muted" style={{ fontSize: 11 }}>
                            {d.classification} · category {d.docCategory} ·{' '}
                            {d.source === 'MANUAL' ? 'registered manually, no history'
                              : `${(d.assignment?.docVolume2y ?? 0).toLocaleString('en-IN')} documents in two years`}
                          </div>
                        </div>
                        <span className={`badge ${d.docCategory === 'L' ? 'bg-warning-subtle text-warning' : 'bg-secondary-subtle text-secondary'}`} style={{ fontSize: 10 }}>
                          {d.docCategory === 'L' ? 'Scheduling agreement' : 'Purchase order'}
                        </span>
                        <select className="form-select form-select-sm" style={{ width: 170 }}
                          value={grants[key] ?? defaultLevel} disabled={!on}
                          onChange={(e) => setGrantLevel(d.code, cc, e.target.value)}>
                          {levels.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            <div className="mt-3 pt-3 border-top">
              <p className="text-muted small">
                Document types are maintained in SAP. If one has been created since the reference
                data was refreshed, register it here so the role can be built now.
              </p>
              <button className="btn btn-sm btn-outline-secondary mb-2" onClick={() => (addOpen ? setAddOpen(false) : openAdd())}>
                {addOpen ? 'Cancel' : 'Add a document type'}
              </button>
              {addOpen && (
                <div className="card p-3">
                  <div className="row g-2">
                    <div className="col-md-3">
                      <label className="form-label small">Document type</label>
                      <input className="form-control" style={{ fontFamily: 'monospace' }} maxLength={4} value={addForm.code}
                        onChange={(e) => setAddForm((f) => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                        placeholder="ZFNC" />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small">Description</label>
                      <input className="form-control" value={addForm.description}
                        onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Standard purchase order" />
                    </div>
                    <div className="col-md-2">
                      <label className="form-label small">Category</label>
                      <select className="form-select" value={addForm.docCategory}
                        onChange={(e) => setAddForm((f) => ({ ...f, docCategory: e.target.value, classification: e.target.value === 'L' ? 'Scheduling' : f.classification }))}>
                        <option value="F">F — PO</option>
                        <option value="L">L — Sched. agreement</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small">Classification</label>
                      <select className="form-select" value={addForm.classification}
                        onChange={(e) => setAddForm((f) => ({ ...f, classification: e.target.value }))}>
                        <option>Product</option><option>Services</option>
                        <option>Subcontracting</option><option>Scheduling</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="form-label small">Assigned company codes</label>
                    <div className="d-flex flex-wrap gap-2">
                      {companies.map((c) => (
                        <div key={c.companyCode}
                          className={`badge ${addPicked.includes(c.companyCode) ? 'bg-primary' : 'bg-light text-dark border'}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setAddPicked((p) => p.includes(c.companyCode) ? p.filter((x) => x !== c.companyCode) : [...p, c.companyCode])}>
                          {c.companyCode} — {c.companyName}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 d-flex align-items-center gap-2">
                    <button className="btn btn-primary btn-sm" onClick={submitAddDocType}>Add document type</button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
                    {addError && <span className="text-danger small">{addError}</span>}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 d-flex align-items-center gap-2">
              <button className="btn btn-primary btn-sm" onClick={() => advance(4)}>Review</button>
              {errors[4] && <span className="text-danger small">{errors[4]}</span>}
            </div>
          </StepCard>

          {/* Step 5 */}
          <StepCard index={5} title="Review" state={stateOf(5)} onReopen={() => setStage(5)} summary="">
            <h5>{form.roleName || 'Untitled role'}</h5>
            <div className="text-muted small mb-3" style={{ fontFamily: 'monospace' }}>{form.roleCode}</div>
            <dl className="row small">
              <dt className="col-sm-3">Assigned to</dt>
              <dd className="col-sm-9">
                {form.assigneeType === 'VENDOR' ? 'Vendor' : 'Employee'}
                {form.assigneeRef && <> · <code>{form.assigneeRef}</code></>}
              </dd>
              <dt className="col-sm-3">Company codes</dt>
              <dd className="col-sm-9"><code>{form.companyCodes.join(', ')}</code></dd>
              <dt className="col-sm-3">Grants</dt>
              <dd className="col-sm-9">
                {Object.entries(grants).sort().map(([k, v]) => {
                  const [t, c] = k.split('|');
                  const label = levels.find((l) => l.code === v)?.label ?? v;
                  return <div key={k}><code>{t}</code> · {c} · {label}</div>;
                })}
              </dd>
            </dl>
            {form.assigneeType === 'VENDOR' ? (
              <div className="alert alert-warning small">
                <b>Vendor scoping is not enforced by SAP.</b> No purchasing authorisation object
                carries a vendor field, so these grants apply to every supplier's documents.
                Restricting them to vendor {form.assigneeRef || '—'} must be done by the portal,
                and the objects should sit on a portal service user rather than a named supplier contact.
              </div>
            ) : Object.values(grants).includes('approve') ? (
              <div className="alert alert-warning small">
                <b>This role can approve.</b> Approval alongside maintenance removes segregation
                of duties. Consider splitting approval into its own role unless the value
                threshold is trivial.
              </div>
            ) : null}
          </StepCard>

          <div className="d-flex align-items-center justify-content-between mt-3 p-3 bg-white border rounded">
            <div className="small text-muted">
              {canSave
                ? <><b>{form.roleCode}</b> · {form.companyCodes.join(' + ')} · {nGrants} grant{nGrants === 1 ? '' : 's'}</>
                : 'Complete every step to save the role.'}
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-danger" onClick={remove} disabled={!editingId}>Delete</button>
              <button className="btn btn-sm btn-outline-secondary" onClick={startNew}>Start over</button>
              <button className="btn btn-sm btn-primary" onClick={save} disabled={!canSave || saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create role'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StepCard = ({ index, title, state, summary, onReopen, children }) => (
  <div className={`card mb-3 shadow-sm border-0 ${state === 'locked' ? 'opacity-50' : ''}`}>
    <div className="card-header bg-white d-flex align-items-center gap-2" style={{ cursor: state === 'done' ? 'pointer' : 'default' }}
      onClick={() => state === 'done' && onReopen()}>
      <span className={`badge rounded-circle ${state === 'active' ? 'bg-primary' : state === 'done' ? 'bg-success' : 'bg-secondary'}`}
        style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {state === 'done' ? '✓' : index}
      </span>
      <span className="fw-semibold">{title}</span>
      {state !== 'active' && summary && <span className="text-muted small ms-auto">{summary}</span>}
    </div>
    {state === 'active' && <div className="card-body">{children}</div>}
  </div>
);

export default AdminPurchaseRoles;
