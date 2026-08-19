import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import SecureDocumentViewer from '../common/SecureDocumentViewer';
import { DOCS } from '../supplier/data';
import './questionnaire-studio.css';

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

const CHIP = {
  PENDING: 'chip--draft',
  APPROVED: 'chip--published',
  REJECTED: 'chip--closed',
  ESCALATED: 'chip--draft',
  CANCELLED: 'chip--closed',
};

function StatusChip({ status }) {
  return <span className={`chip ${CHIP[status] || 'chip--closed'}`}>{status}</span>;
}

// Compact re-implementation of the change editor for one dynamic-questionnaire answer — driven
// off the same {questionId, textValue?/optionIds?/rows?} shape DynamicQuestionsSection.jsx (the
// original applicant-facing form) uses, since that's what QuestionnaireService.updateSingleAnswer
// expects on the way back in. Kept self-contained rather than sharing that component because this
// only ever edits one already-known question at a time, not a whole questionnaire. Styled to match
// the qstudio "Fill in" tab (.choices/.choice, .table-scroll/.data-grid) this same CSS defines.
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
        className="input"
        value={answer.textValue ?? ''}
        onChange={(e) => setPatch({ textValue: e.target.value })}
      />
    );
  }

  if (question.questionType === 'single_choice' || question.questionType === 'multi_choice') {
    const inputType = question.questionType === 'single_choice' ? 'radio' : 'checkbox';
    return (
      <div className="choices">
        {question.options.map((o) => (
          <label key={o.optionId} className="choice">
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
      <div>
        <div className="table-scroll">
          <table className="data-grid">
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
                        className="input input--cell"
                        type={c.columnType === 'number' ? 'number' : c.columnType === 'date' ? 'date' : 'text'}
                        value={row[String(c.columnId)] ?? ''}
                        onChange={(e) => setCell(rowIndex, String(c.columnId), e.target.value)}
                      />
                    </td>
                  ))}
                  <td>
                    <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeRow(rowIndex)} disabled={rows.length <= 1}>
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn btn--tiny" style={{ marginTop: 8 }} onClick={addRow}>+ Add row</button>
      </div>
    );
  }

  return null;
}

const answerDisplay = (a) => {
  if (a.questionType === 'table') {
    return (a.rows || []).length ? `${a.rows.length} row${a.rows.length === 1 ? '' : 's'}` : null;
  }
  if (a.selectedLabels && a.selectedLabels.length) return a.selectedLabels.join(', ');
  return a.textValue || null;
};

/**
 * The real vendor-facing "My Profile" page for an approved supplier — everything shown here
 * comes from the vendor's own registration (documents, extra attachments, dynamic-questionnaire
 * answers), resolved server-side from the JWT login email so a vendor can never see anyone
 * else's data. Every item has a "Request a change" action; nothing is edited directly — a
 * request is submitted into the same approval team/flow that reviewed the original application
 * (see VendorChangeRequestService on the backend) and only takes effect once approved. Styled
 * with the same "Questionnaire Studio" (.qstudio) design system as the admin questionnaire
 * builder, since this page is essentially a read + request-a-change view over the same kind of
 * data (documents, answers) that builder edits.
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

  if (loading) {
    return (
      <div className="qstudio">
        <div className="qs-page"><p className="qs-muted">Loading your profile…</p></div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="qstudio">
        <div className="qs-page">
          <p className="qs-alert">{error || 'No supplier profile found for this account.'}</p>
        </div>
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
    <div className="qstudio">
      <div className="qs-page">
        <div className="qs-stack">
          <div className="workspace-head">
            <div className="row-actions" style={{ justifyContent: 'space-between' }}>
              <div>
                {onBack && (
                  <button className="qs-back" style={{ marginBottom: 8 }} onClick={onBack}>← Back</button>
                )}
                <p className="qs-eyebrow">My Profile</p>
                <h1 className="qs-display">{reg.vendorName || reg.contactName || 'Your profile'}</h1>
                <p className="qs-lede">
                  {reg.vendorCode && <>Vendor code <span className="qs-code">{reg.vendorCode}</span> · </>}
                  {reg.email}
                </p>
              </div>
              <span className="chip chip--published">{reg.status}</span>
            </div>
          </div>

          {toast && <p className={toast.type === 'ok' ? 'qs-muted' : 'qs-alert'}>{toast.text}</p>}

          {/* Documents */}
          <div className="qs-stack" style={{ gap: 6 }}>
            <p className="qs-eyebrow" style={{ margin: 0 }}>Documents</p>
            <ul className="q-list">
              {DOCS.map((docDef) => {
                const d = docsByType[docDef.id];
                const pending = pendingByKey.has(`document:${docDef.id}`);
                return (
                  <li key={docDef.id} className={`q-card${docDef.req ? ' q-card--required' : ''}`}>
                    <div className="q-gutter">
                      <span className="type-tag">DOC</span>
                      {docDef.req ? <span className="stamp">Required</span> : <span className="stamp stamp--optional">Optional</span>}
                    </div>
                    <div className="q-body">
                      <div className="q-head">
                        <p className="q-prompt">{docDef.name}</p>
                        {pending && <StatusChip status="PENDING" />}
                      </div>
                      <p className="q-preview">
                        {d ? d.fileName : <span className="qs-muted">Not uploaded</span>}
                      </p>
                      <div className="q-actions">
                        {d?.previewUrl && (
                          <button className="btn btn--tiny" onClick={() => setViewer({ url: d.previewUrl, title: docDef.name })}>View</button>
                        )}
                        <button
                          className="btn btn--tiny btn--primary"
                          disabled={pending}
                          onClick={() => openChangeModal('document', docDef.id, docDef.name)}
                        >
                          {pending ? 'Pending review' : 'Request a change'}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Extra attachments */}
          {(profile.attachments || []).length > 0 && (
            <div className="qs-stack" style={{ gap: 6 }}>
              <p className="qs-eyebrow" style={{ margin: 0 }}>Other documents</p>
              <ul className="q-list">
                {profile.attachments.map((a) => {
                  const pending = pendingByKey.has(`attachment:${a.id}`);
                  return (
                    <li key={a.id} className="q-card">
                      <div className="q-gutter">
                        <span className="type-tag">FILE</span>
                      </div>
                      <div className="q-body">
                        <div className="q-head">
                          <p className="q-prompt">{a.fileName}</p>
                          {pending && <StatusChip status="PENDING" />}
                        </div>
                        <div className="q-actions">
                          {a.previewUrl && (
                            <button className="btn btn--tiny" onClick={() => setViewer({ url: a.previewUrl, title: a.fileName })}>View</button>
                          )}
                          <button
                            className="btn btn--tiny btn--primary"
                            disabled={pending}
                            onClick={() => openChangeModal('attachment', a.id, a.fileName)}
                          >
                            {pending ? 'Pending review' : 'Request a change'}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Answers */}
          {(profile.dynamicAnswers || []).length > 0 && (
            <div className="qs-stack" style={{ gap: 6 }}>
              <p className="qs-eyebrow" style={{ margin: 0 }}>Additional questions</p>
              <ul className="q-list">
                {profile.dynamicAnswers.map((a) => {
                  const pending = pendingByKey.has(`answer:${a.questionId}`);
                  const display = answerDisplay(a);
                  return (
                    <li key={a.questionId} className="q-card">
                      <div className="q-gutter">
                        <span className="type-tag">{a.questionType?.replace('_', ' ')}</span>
                      </div>
                      <div className="q-body">
                        <div className="q-head">
                          <p className="q-prompt">{a.prompt}</p>
                          {pending && <StatusChip status="PENDING" />}
                        </div>
                        {display ? <p className="q-preview">{display}</p> : <p className="q-preview qs-muted">(not answered)</p>}
                        <div className="q-actions">
                          <button
                            className="btn btn--tiny btn--primary"
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
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Change request history */}
          {(profile.changeRequests || []).length > 0 && (
            <div className="qs-stack" style={{ gap: 6 }}>
              <p className="qs-eyebrow" style={{ margin: 0 }}>Your change requests</p>
              <div className="card" style={{ padding: 0 }}>
                <table className="qs-list-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Reason</th>
                      <th>Submitted</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profile.changeRequests.map((cr) => (
                      <tr key={cr.id}>
                        <td>
                          {cr.itemType === 'document' ? (DOCS.find((d) => d.id === cr.itemKey)?.name || cr.itemKey)
                            : cr.itemType === 'answer' ? (findQuestion(cr.itemKey)?.prompt || `Question ${cr.itemKey}`)
                            : 'Other document'}
                        </td>
                        <td className="qs-muted">{cr.reason}</td>
                        <td className="qs-muted">{cr.createdDate ? new Date(cr.createdDate).toLocaleDateString() : ''}</td>
                        <td><StatusChip status={cr.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <SecureDocumentViewer
        show={!!viewer}
        fetchUrl={viewer?.url}
        title={viewer?.title}
        onClose={() => setViewer(null)}
      />

      {/* Request-a-change modal */}
      {changeModal && (
        <div
          className="qstudio"
          style={{ position: 'fixed', inset: 0, background: 'rgba(21,34,46,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setChangeModal(null)}
        >
          <div className="card" style={{ width: 520, maxWidth: '90vw', maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <p className="qs-eyebrow">Request a change</p>
            <h2 className="qs-display qs-display--sm" style={{ marginBottom: 14 }}>{changeModal.label}</h2>

            <label className="field">
              <span className="label">Reason for this change</span>
              <textarea
                className="textarea"
                rows={3}
                value={changeModal.reason}
                onChange={(e) => setChangeModal((m) => ({ ...m, reason: e.target.value }))}
                placeholder="Tell the approval team why this needs to change..."
              />
            </label>

            {changeModal.itemType === 'answer' ? (
              changeModal.question ? (
                <label className="field">
                  <span className="label">New answer</span>
                  <AnswerEditor
                    question={changeModal.question}
                    initialAnswer={changeModal.answer}
                    value={changeModal.answer}
                    onChange={(answer) => setChangeModal((m) => ({ ...m, answer }))}
                  />
                </label>
              ) : (
                <p className="qs-muted">This question is no longer part of the active questionnaire.</p>
              )
            ) : (
              <label className="field">
                <span className="label">Replacement file</span>
                <input
                  type="file"
                  className="input"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setChangeModal((m) => ({ ...m, file: e.target.files?.[0] || null }))}
                />
              </label>
            )}

            <div className="row-actions" style={{ marginTop: 8 }}>
              <button className="btn btn--primary" disabled={changeModal.submitting} onClick={submitChange}>
                {changeModal.submitting ? 'Submitting…' : 'Submit for review'}
              </button>
              <button className="btn btn--ghost" onClick={() => setChangeModal(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
