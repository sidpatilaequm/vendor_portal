import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import SecureDocumentViewer from '../common/SecureDocumentViewer';
import { DOCS } from '../supplier/data';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

const STATUS_BADGE = {
  PENDING: 'text-warning border-warning',
  APPROVED: 'text-success border-success',
  REJECTED: 'text-danger border-danger',
  ESCALATED: 'text-info border-info',
  CANCELLED: 'text-muted border-secondary',
};

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] || 'text-muted border-secondary';
  return (
    <span className={`badge bg-white border ${cls} bg-opacity-10 px-2 py-1 rounded-pill`} style={{ fontSize: 11 }}>
      {status}
    </span>
  );
}

// Compact re-implementation of the change editor for one dynamic-questionnaire answer — driven
// off the same {questionId, textValue?/optionIds?/rows?} shape DynamicQuestionsSection.jsx (the
// original applicant-facing form) uses, since that's what QuestionnaireService.updateSingleAnswer
// expects on the way back in. Kept self-contained rather than sharing that component because this
// only ever edits one already-known question at a time, not a whole questionnaire.
function AnswerEditor({ question, initialAnswer, value, onChange }) {
  const answer = value || initialAnswer || {};
  const selected = answer.optionIds || [];

  const setPatch = (patch) => onChange({ ...answer, ...patch });

  const toggleOption = (optionId) => {
    if (question.questionType === 'single_choice') {
      setPatch({ optionIds: [optionId] });
      return;
    }
    const has = selected.includes(optionId);
    setPatch({ optionIds: has ? selected.filter((id) => id !== optionId) : [...selected, optionId] });
  };

  const blankRow = () => Object.fromEntries(question.columns.map((c) => [String(c.columnId), '']));
  const rows = answer.rows && answer.rows.length ? answer.rows : [blankRow()];
  const setCell = (rowIndex, columnId, val) => {
    setPatch({ rows: rows.map((row, i) => (i === rowIndex ? { ...row, [columnId]: val } : row)) });
  };
  const addRow = () => setPatch({ rows: [...rows, blankRow()] });
  const removeRow = (rowIndex) => setPatch({ rows: rows.filter((_, i) => i !== rowIndex) || [blankRow()] });

  if (question.questionType === 'short_text' || question.questionType === 'counter') {
    return (
      <input
        className="form-control"
        value={answer.textValue ?? ''}
        onChange={(e) => setPatch({ textValue: e.target.value })}
      />
    );
  }

  if (question.questionType === 'single_choice' || question.questionType === 'multi_choice') {
    const inputType = question.questionType === 'single_choice' ? 'radio' : 'checkbox';
    return (
      <div className="d-flex flex-column gap-1">
        {question.options.map((o) => (
          <label key={o.optionId} className="d-flex align-items-center gap-2">
            <input
              type={inputType}
              name={`q_${question.questionId}`}
              checked={selected.includes(o.optionId)}
              onChange={() => toggleOption(o.optionId)}
            />
            {o.label}
          </label>
        ))}
      </div>
    );
  }

  if (question.questionType === 'table') {
    return (
      <div className="table-responsive">
        <table className="table table-sm table-bordered mb-2">
          <thead>
            <tr>
              {question.columns.map((c) => <th key={c.columnId}>{c.label}</th>)}
              <th style={{ width: 1 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {question.columns.map((c) => (
                  <td key={c.columnId}>
                    <input
                      className="form-control form-control-sm"
                      type={c.columnType === 'number' ? 'number' : c.columnType === 'date' ? 'date' : 'text'}
                      value={row[String(c.columnId)] ?? ''}
                      onChange={(e) => setCell(rowIndex, String(c.columnId), e.target.value)}
                    />
                  </td>
                ))}
                <td>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => removeRow(rowIndex)} disabled={rows.length <= 1}>
                    &times;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={addRow}>+ Add row</button>
      </div>
    );
  }

  return null;
}

/**
 * The real vendor-facing "My Profile" page for an approved supplier — everything shown here
 * comes from the vendor's own registration (documents, extra attachments, dynamic-questionnaire
 * answers), resolved server-side from the JWT login email so a vendor can never see anyone
 * else's data. Every item has a "Request a change" action; nothing is edited directly — a
 * request is submitted into the same approval team/flow that reviewed the original application
 * (see VendorChangeRequestService on the backend) and only takes effect once approved.
 */
export default function VendorMyProfile({ onBack }) {
  const [profile, setProfile] = useState(null);
  const [questionnaire, setQuestionnaire] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [changeModal, setChangeModal] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      axios.get('/api/supplier-registration/my-profile', { headers: authHeaders() }),
      axios.get('/api/public/supplier-registration/questionnaire').catch(() => ({ data: null })),
    ])
      .then(([profileRes, qRes]) => {
        setProfile(profileRes.data?.data?.result || null);
        setQuestionnaire(qRes.data && qRes.data.sections ? qRes.data : null);
        setError(null);
      })
      .catch((e) => setError(e?.response?.data?.errorMessage || e?.response?.data?.statusMsg || 'Could not load your profile.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) return (
    <div className="p-5 text-center text-muted">
      <div className="spinner-border text-primary" role="status"></div>
      <br /><br />Loading your profile...
    </div>
  );

  if (error || !profile) {
    return (
      <div className="container-fluid py-5 text-center">
        <p className="text-danger">{error || 'No supplier profile found for this account.'}</p>
      </div>
    );
  }

  const reg = profile.registration || {};
  const docsByType = Object.fromEntries((profile.documents || []).map((d) => [d.docType, d]));
  const pendingByKey = new Set(
    (profile.changeRequests || [])
      .filter((cr) => cr.status === 'PENDING')
      .map((cr) => `${cr.itemType}:${cr.itemKey}`)
  );

  const openChangeModal = (itemType, itemKey, label, extra = {}) => {
    setChangeModal({ itemType, itemKey, label, reason: '', file: null, answer: {}, ...extra });
  };

  const submitChange = () => {
    if (!changeModal) return;
    if (!changeModal.reason || !changeModal.reason.trim()) {
      setToast({ type: 'error', text: 'Tell us why you need this changed.' });
      return;
    }
    const form = new FormData();
    form.append('itemType', changeModal.itemType);
    form.append('itemKey', String(changeModal.itemKey));
    form.append('reason', changeModal.reason.trim());
    if (changeModal.itemType === 'answer') {
      form.append('newAnswerJson', JSON.stringify(changeModal.answer || {}));
    } else {
      if (!changeModal.file) {
        setToast({ type: 'error', text: 'Attach the replacement file.' });
        return;
      }
      form.append('file', changeModal.file);
    }
    setChangeModal((m) => ({ ...m, submitting: true }));
    axios.post('/api/supplier-registration/change-requests', form, {
      headers: { ...authHeaders(), 'Content-Type': 'multipart/form-data' },
    })
      .then(() => {
        setToast({ type: 'ok', text: 'Change request submitted for review.' });
        setChangeModal(null);
        load();
      })
      .catch((e) => {
        setToast({ type: 'error', text: e?.response?.data?.statusMsg || e?.response?.data?.errorMessage || 'Could not submit the change request.' });
        setChangeModal((m) => ({ ...m, submitting: false }));
      });
  };

  const findQuestion = (questionId) => {
    if (!questionnaire?.sections) return null;
    for (const s of questionnaire.sections) {
      const q = (s.questions || []).find((q) => String(q.questionId) === String(questionId));
      if (q) return q;
    }
    return null;
  };

  return (
    <div className="container-fluid py-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      {onBack && (
        <div onClick={onBack} className="d-inline-flex align-items-center text-muted mb-3" style={{ cursor: 'pointer' }}>
          <i className="fas fa-arrow-left me-2"></i>
          <span className="fw-medium">Back</span>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap gap-3">
        <div>
          <div className="text-success small fw-bold text-uppercase mb-1" style={{ letterSpacing: '0.5px' }}>My Profile</div>
          <h3 className="fw-bold text-dark mb-1">{reg.vendorName || reg.contactName || 'Your profile'}</h3>
          <div className="text-muted small">
            {reg.vendorCode && <>Vendor code <b className="text-dark">{reg.vendorCode}</b> · </>}
            {reg.email}
          </div>
        </div>
        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 rounded-pill">
          {reg.status}
        </span>
      </div>

      {toast && (
        <div className={`alert ${toast.type === 'ok' ? 'alert-success' : 'alert-danger'} py-2`} role="alert">
          {toast.text}
        </div>
      )}

      {/* Documents */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 16 }}>
        <div className="card-body p-4">
          <h6 className="fw-bold text-dark mb-3 text-uppercase" style={{ fontSize: 14, letterSpacing: '0.5px' }}>Documents</h6>
          <div className="table-responsive">
            <table className="table align-middle mb-0" style={{ fontSize: 13 }}>
              <thead>
                <tr className="text-muted small border-bottom">
                  <th className="fw-semibold text-uppercase">Document</th>
                  <th className="fw-semibold text-uppercase">File</th>
                  <th className="fw-semibold text-uppercase"></th>
                  <th className="fw-semibold text-end text-uppercase"></th>
                </tr>
              </thead>
              <tbody>
                {DOCS.map((docDef) => {
                  const d = docsByType[docDef.id];
                  const pending = pendingByKey.has(`document:${docDef.id}`);
                  return (
                    <tr key={docDef.id} className="border-bottom">
                      <td className="text-dark">{docDef.name}{docDef.req && <span className="text-danger"> *</span>}</td>
                      <td className="text-secondary">{d ? d.fileName : <span className="fst-italic text-muted">Not uploaded</span>}</td>
                      <td>{pending && <StatusBadge status="PENDING" />}</td>
                      <td className="text-end">
                        {d?.previewUrl && (
                          <button className="btn btn-sm btn-light border me-2" onClick={() => setViewer({ url: d.previewUrl, title: docDef.name })}>
                            View
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-outline-primary"
                          disabled={pending}
                          onClick={() => openChangeModal('document', docDef.id, docDef.name)}
                        >
                          {pending ? 'Pending review' : 'Request a change'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Extra attachments */}
      {(profile.attachments || []).length > 0 && (
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 16 }}>
          <div className="card-body p-4">
            <h6 className="fw-bold text-dark mb-3 text-uppercase" style={{ fontSize: 14, letterSpacing: '0.5px' }}>Other documents</h6>
            <div className="table-responsive">
              <table className="table align-middle mb-0" style={{ fontSize: 13 }}>
                <tbody>
                  {profile.attachments.map((a) => {
                    const pending = pendingByKey.has(`attachment:${a.id}`);
                    return (
                      <tr key={a.id} className="border-bottom">
                        <td className="text-dark">{a.fileName}</td>
                        <td>{pending && <StatusBadge status="PENDING" />}</td>
                        <td className="text-end">
                          {a.previewUrl && (
                            <button className="btn btn-sm btn-light border me-2" onClick={() => setViewer({ url: a.previewUrl, title: a.fileName })}>
                              View
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-outline-primary"
                            disabled={pending}
                            onClick={() => openChangeModal('attachment', a.id, a.fileName)}
                          >
                            {pending ? 'Pending review' : 'Request a change'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Answers */}
      {(profile.dynamicAnswers || []).length > 0 && (
        <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 16 }}>
          <div className="card-body p-4">
            <h6 className="fw-bold text-dark mb-3 text-uppercase" style={{ fontSize: 14, letterSpacing: '0.5px' }}>Additional questions</h6>
            <div className="d-flex flex-column gap-3">
              {profile.dynamicAnswers.map((a) => {
                const pending = pendingByKey.has(`answer:${a.questionId}`);
                const display = a.questionType === 'table'
                  ? `${(a.rows || []).length} row${(a.rows || []).length === 1 ? '' : 's'}`
                  : (a.selectedLabels && a.selectedLabels.length ? a.selectedLabels.join(', ') : (a.textValue || '(not answered)'));
                return (
                  <div key={a.questionId} className="d-flex justify-content-between align-items-start border-bottom pb-3">
                    <div>
                      <div className="text-dark fw-medium" style={{ fontSize: 13 }}>{a.prompt}</div>
                      <div className="text-secondary small">{display}</div>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                      {pending && <StatusBadge status="PENDING" />}
                      <button
                        className="btn btn-sm btn-outline-primary"
                        disabled={pending || !findQuestion(a.questionId)}
                        onClick={() => openChangeModal('answer', a.questionId, a.prompt, {
                          question: findQuestion(a.questionId),
                          answer: { textValue: a.textValue, rows: a.rows },
                        })}
                      >
                        {pending ? 'Pending review' : 'Request a change'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Change request history */}
      {(profile.changeRequests || []).length > 0 && (
        <div className="card border-0 shadow-sm" style={{ borderRadius: 16 }}>
          <div className="card-body p-4">
            <h6 className="fw-bold text-dark mb-3 text-uppercase" style={{ fontSize: 14, letterSpacing: '0.5px' }}>Your change requests</h6>
            <div className="table-responsive">
              <table className="table align-middle mb-0" style={{ fontSize: 13 }}>
                <thead>
                  <tr className="text-muted small border-bottom">
                    <th className="fw-semibold text-uppercase">Item</th>
                    <th className="fw-semibold text-uppercase">Reason</th>
                    <th className="fw-semibold text-uppercase">Submitted</th>
                    <th className="fw-semibold text-uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.changeRequests.map((cr) => (
                    <tr key={cr.id} className="border-bottom">
                      <td className="text-dark">
                        {cr.itemType === 'document' ? (DOCS.find((d) => d.id === cr.itemKey)?.name || cr.itemKey)
                          : cr.itemType === 'answer' ? (findQuestion(cr.itemKey)?.prompt || `Question ${cr.itemKey}`)
                          : 'Other document'}
                      </td>
                      <td className="text-secondary">{cr.reason}</td>
                      <td className="text-secondary">{cr.createdDate ? new Date(cr.createdDate).toLocaleDateString() : ''}</td>
                      <td><StatusBadge status={cr.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <SecureDocumentViewer
        show={!!viewer}
        fetchUrl={viewer?.url}
        title={viewer?.title}
        onClose={() => setViewer(null)}
      />

      {/* Request-a-change modal */}
      {changeModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
            <div className="modal-dialog modal-dialog-centered modal-lg" role="document">
              <div className="modal-content border-0 shadow" style={{ borderRadius: 16 }}>
                <div className="modal-header border-bottom-0 pb-0">
                  <h5 className="modal-title fw-bold text-dark">Request a change — {changeModal.label}</h5>
                  <button type="button" className="btn-close" onClick={() => setChangeModal(null)}></button>
                </div>
                <div className="modal-body py-3">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold text-secondary text-uppercase">Reason for this change</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={changeModal.reason}
                      onChange={(e) => setChangeModal((m) => ({ ...m, reason: e.target.value }))}
                      placeholder="Tell the approval team why this needs to change..."
                    />
                  </div>

                  {changeModal.itemType === 'answer' ? (
                    changeModal.question ? (
                      <div className="mb-3">
                        <label className="form-label small fw-semibold text-secondary text-uppercase">New answer</label>
                        <AnswerEditor
                          question={changeModal.question}
                          initialAnswer={changeModal.answer}
                          value={changeModal.answer}
                          onChange={(answer) => setChangeModal((m) => ({ ...m, answer }))}
                        />
                      </div>
                    ) : (
                      <p className="text-muted small fst-italic">This question is no longer part of the active questionnaire.</p>
                    )
                  ) : (
                    <div className="mb-3">
                      <label className="form-label small fw-semibold text-secondary text-uppercase">Replacement file</label>
                      <input
                        type="file"
                        className="form-control"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setChangeModal((m) => ({ ...m, file: e.target.files?.[0] || null }))}
                      />
                    </div>
                  )}

                  <div className="d-grid mt-4">
                    <button
                      className="btn btn-primary rounded-pill py-2 fw-medium shadow-sm"
                      disabled={changeModal.submitting}
                      onClick={submitChange}
                    >
                      {changeModal.submitting ? 'Submitting...' : 'Submit for review'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
