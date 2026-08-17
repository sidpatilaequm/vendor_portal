import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Input from '../common/Input';
import Select from '../common/Select';

const QUESTION_TYPES = [
  { value: 'short_text', label: 'Short text' },
  { value: 'single_choice', label: 'Single choice' },
  { value: 'multi_choice', label: 'Multiple choice' },
];

const emptyQuestionForm = {
  prompt: '',
  help_text: '',
  question_type: 'short_text',
  is_mandatory: false,
  max_length: '',
  min_selections: '',
  max_selections: '',
  options: ['', ''],
};

// Full-screen builder — sections, their questions, reordering, and the three question types.
// Native rebuild of Form Studio's own Builder.jsx/QuestionEditor.jsx/QuestionCard.jsx logic
// against vendor_portal's Bootstrap components instead of Form Studio's own CSS, following the
// same "rebuild natively, don't iframe" precedent the Become-a-Supplier page itself set.
const QuestionnaireBuilder = ({ processId, onBack }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const [sectionModal, setSectionModal] = useState(null); // { id?, title, description }
  const [questionModal, setQuestionModal] = useState(null); // { sectionId, id?, ...emptyQuestionForm }
  const [saving, setSaving] = useState(false);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/questionnaire/processes/${processId}`, { headers: authHeaders() });
      setDetail(data);
    } catch (err) {
      alert('Could not load this questionnaire.');
      onBack();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  useEffect(() => { load(); }, [load]);

  const patch = async (method, url, body) => {
    const { data } = await axios({ method, url, data: body, headers: authHeaders() });
    setDetail(data);
    return data;
  };

  const errorMessage = (err, fallback) => {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (detail?.message) return detail.message;
    return fallback;
  };

  // ── Process-level actions ──────────────────────────────────────────
  const setStatus = async (status) => {
    try {
      await patch('put', `/api/questionnaire/processes/${processId}`, {
        name: detail.name, description: detail.description, status,
      });
    } catch (err) {
      alert(errorMessage(err, 'Could not update status.'));
    }
  };

  const duplicateAndSwitch = async () => {
    try {
      const { data } = await axios.post(`/api/questionnaire/processes/${processId}/duplicate`, null, { headers: authHeaders() });
      alert(`Duplicated as "${data.name}" — you're now editing the copy.`);
      window.location.reload();
    } catch (err) {
      alert('Could not duplicate.');
    }
  };

  // ── Sections ────────────────────────────────────────────────────────
  const saveSection = async () => {
    setSaving(true);
    try {
      if (sectionModal.id) {
        await patch('put', `/api/questionnaire/sections/${sectionModal.id}`, {
          title: sectionModal.title, description: sectionModal.description || null,
        });
      } else {
        await patch('post', `/api/questionnaire/processes/${processId}/sections`, {
          title: sectionModal.title, description: sectionModal.description || null,
        });
      }
      setSectionModal(null);
    } catch (err) {
      alert(errorMessage(err, 'Could not save this section.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteSection = async (id) => {
    if (!window.confirm('Delete this section and every question inside it?')) return;
    try {
      await patch('delete', `/api/questionnaire/sections/${id}`);
    } catch (err) {
      alert(errorMessage(err, 'Could not delete this section.'));
    }
  };

  const moveSection = async (index, direction) => {
    const ids = detail.sections.map((s) => s.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await patch('put', `/api/questionnaire/processes/${processId}/sections/order`, { section_ids: ids });
    } catch (err) {
      alert(errorMessage(err, 'Could not reorder sections.'));
    }
  };

  // ── Questions ───────────────────────────────────────────────────────
  const openNewQuestion = (sectionId) => setQuestionModal({ sectionId, ...emptyQuestionForm });

  const openEditQuestion = (sectionId, q) => setQuestionModal({
    sectionId,
    id: q.id,
    prompt: q.prompt,
    help_text: q.help_text || '',
    question_type: q.question_type,
    is_mandatory: q.is_mandatory,
    max_length: q.max_length ?? '',
    min_selections: q.min_selections ?? '',
    max_selections: q.max_selections ?? '',
    options: q.options.length ? q.options.map((o) => o.label) : ['', ''],
  });

  const saveQuestion = async () => {
    const qm = questionModal;
    const payload = {
      prompt: qm.prompt.trim(),
      help_text: qm.help_text.trim() || null,
      question_type: qm.question_type,
      is_mandatory: qm.is_mandatory,
      max_length: qm.question_type === 'short_text' && qm.max_length !== '' ? Number(qm.max_length) : null,
      min_selections: qm.question_type === 'multi_choice' && qm.min_selections !== '' ? Number(qm.min_selections) : null,
      max_selections: qm.question_type === 'multi_choice' && qm.max_selections !== '' ? Number(qm.max_selections) : null,
      options: qm.question_type === 'short_text' ? [] : qm.options.filter((o) => o.trim()).map((label) => ({ label: label.trim() })),
    };
    setSaving(true);
    try {
      if (qm.id) {
        await patch('put', `/api/questionnaire/questions/${qm.id}`, payload);
      } else {
        await patch('post', `/api/questionnaire/sections/${qm.sectionId}/questions`, payload);
      }
      setQuestionModal(null);
    } catch (err) {
      alert(errorMessage(err, 'Could not save this question.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteQuestion = async (id) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await patch('delete', `/api/questionnaire/questions/${id}`);
    } catch (err) {
      alert(errorMessage(err, 'Could not delete this question.'));
    }
  };

  const moveQuestion = async (section, index, direction) => {
    const ids = section.questions.map((q) => q.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await patch('put', `/api/questionnaire/sections/${section.id}/questions/order`, { question_ids: ids });
    } catch (err) {
      alert(errorMessage(err, 'Could not reorder questions.'));
    }
  };

  const updateOption = (idx, value) => {
    setQuestionModal((qm) => ({ ...qm, options: qm.options.map((o, i) => (i === idx ? value : o)) }));
  };
  const addOption = () => setQuestionModal((qm) => ({ ...qm, options: [...qm.options, ''] }));
  const removeOption = (idx) => setQuestionModal((qm) => ({ ...qm, options: qm.options.filter((_, i) => i !== idx) }));

  if (loading || !detail) return <div className="p-4 text-muted">Loading…</div>;

  const isChoice = questionModal && questionModal.question_type !== 'short_text';

  return (
    <div className="p-4">
      <button className="btn btn-sm btn-outline-secondary mb-3" onClick={onBack}>← Back to questionnaires</button>

      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h4 className="mb-0">{detail.name}</h4>
          {detail.description && <p className="text-muted small mb-0">{detail.description}</p>}
        </div>
        <div className="d-flex gap-2 align-items-center">
          <span className={`badge ${detail.status === 'published' ? 'bg-success' : detail.status === 'closed' ? 'bg-secondary' : 'bg-warning text-dark'}`}>
            {detail.status}
          </span>
          {detail.status === 'draft' && <Button variant="outline-green" onClick={() => setStatus('published')}>Publish</Button>}
          {detail.status === 'published' && <Button variant="outline-green" onClick={() => setStatus('closed')}>Close</Button>}
        </div>
      </div>

      {detail.locked && (
        <div className="alert alert-warning d-flex justify-content-between align-items-center">
          <span>This questionnaire has {detail.response_count} recorded response(s), so its questions are locked.</span>
          <Button variant="outline-green" onClick={duplicateAndSwitch}>Duplicate to keep editing</Button>
        </div>
      )}

      {detail.sections.map((section, sIdx) => (
        <div className="card mb-3" key={section.id}>
          <div className="card-header d-flex justify-content-between align-items-center bg-light">
            <div>
              <strong>{section.title}</strong>
              {section.description && <div className="text-muted small">{section.description}</div>}
            </div>
            <div className="d-flex gap-1">
              <button className="btn btn-sm btn-light border" disabled={sIdx === 0 || detail.locked} onClick={() => moveSection(sIdx, -1)}>↑</button>
              <button className="btn btn-sm btn-light border" disabled={sIdx === detail.sections.length - 1 || detail.locked} onClick={() => moveSection(sIdx, 1)}>↓</button>
              <button className="btn btn-sm btn-light border" disabled={detail.locked} onClick={() => setSectionModal({ id: section.id, title: section.title, description: section.description || '' })}>Edit</button>
              <button className="btn btn-sm btn-outline-danger" disabled={detail.locked} onClick={() => deleteSection(section.id)}>Delete</button>
            </div>
          </div>
          <div className="card-body">
            {section.questions.length === 0 && <div className="text-muted small mb-2">No questions yet.</div>}
            {section.questions.map((q, qIdx) => (
              <div className="d-flex justify-content-between align-items-start border rounded p-2 mb-2" key={q.id}>
                <div>
                  <div className="fw-semibold">
                    {q.prompt}
                    {q.is_mandatory && <span className="text-danger ms-1">*</span>}
                    <span className="badge bg-light text-muted border ms-2" style={{ fontSize: '10px' }}>
                      {QUESTION_TYPES.find((t) => t.value === q.question_type)?.label}
                    </span>
                  </div>
                  {q.help_text && <div className="text-muted small">{q.help_text}</div>}
                  {q.options.length > 0 && (
                    <div className="small text-muted mt-1">{q.options.map((o) => o.label).join(' · ')}</div>
                  )}
                </div>
                <div className="d-flex gap-1">
                  <button className="btn btn-sm btn-light border" disabled={qIdx === 0 || detail.locked} onClick={() => moveQuestion(section, qIdx, -1)}>↑</button>
                  <button className="btn btn-sm btn-light border" disabled={qIdx === section.questions.length - 1 || detail.locked} onClick={() => moveQuestion(section, qIdx, 1)}>↓</button>
                  <button className="btn btn-sm btn-light border" disabled={detail.locked} onClick={() => openEditQuestion(section.id, q)}>Edit</button>
                  <button className="btn btn-sm btn-outline-danger" disabled={detail.locked} onClick={() => deleteQuestion(q.id)}>Delete</button>
                </div>
              </div>
            ))}
            <button className="btn btn-sm btn-outline-primary mt-1" disabled={detail.locked} onClick={() => openNewQuestion(section.id)}>+ Add question</button>
          </div>
        </div>
      ))}

      <Button variant="outline-green" disabled={detail.locked} onClick={() => setSectionModal({ title: '', description: '' })}>
        + Add section
      </Button>

      {/* Section editor */}
      <Modal
        show={!!sectionModal}
        title={sectionModal?.id ? 'Edit section' : 'New section'}
        onClose={() => setSectionModal(null)}
        onSubmit={saveSection}
        submitText="Save"
        loading={saving}
      >
        {sectionModal && (
          <>
            <Input label="Title" id="sectionTitle" value={sectionModal.title} onChange={(e) => setSectionModal({ ...sectionModal, title: e.target.value })} />
            <Input label="Description" id="sectionDescription" rows={2} value={sectionModal.description} onChange={(e) => setSectionModal({ ...sectionModal, description: e.target.value })} />
          </>
        )}
      </Modal>

      {/* Question editor */}
      <Modal
        show={!!questionModal}
        title={questionModal?.id ? 'Edit question' : 'New question'}
        onClose={() => setQuestionModal(null)}
        onSubmit={saveQuestion}
        submitText="Save"
        loading={saving}
        maxWidth="600px"
      >
        {questionModal && (
          <>
            <Input label="Prompt" id="qPrompt" rows={2} value={questionModal.prompt} onChange={(e) => setQuestionModal({ ...questionModal, prompt: e.target.value })} />
            <Input label="Help text (optional)" id="qHelp" value={questionModal.help_text} onChange={(e) => setQuestionModal({ ...questionModal, help_text: e.target.value })} />
            <Select
              label="Type"
              id="qType"
              options={QUESTION_TYPES}
              value={questionModal.question_type}
              onChange={(e) => setQuestionModal({ ...questionModal, question_type: e.target.value })}
            />
            <div className="mb-3 form-check">
              <input
                type="checkbox"
                className="form-check-input"
                id="qMandatory"
                checked={questionModal.is_mandatory}
                onChange={(e) => setQuestionModal({ ...questionModal, is_mandatory: e.target.checked })}
              />
              <label className="form-check-label" htmlFor="qMandatory">Mandatory</label>
            </div>

            {questionModal.question_type === 'short_text' && (
              <Input
                label="Max length (optional)"
                id="qMaxLength"
                type="number"
                value={questionModal.max_length}
                onChange={(e) => setQuestionModal({ ...questionModal, max_length: e.target.value })}
              />
            )}

            {isChoice && (
              <>
                <label className="form-label">Options</label>
                {questionModal.options.map((opt, idx) => (
                  <div className="d-flex gap-2 mb-2" key={idx}>
                    <input
                      className="form-control"
                      value={opt}
                      onChange={(e) => updateOption(idx, e.target.value)}
                      placeholder={`Option ${idx + 1}`}
                    />
                    <button className="btn btn-outline-danger" type="button" onClick={() => removeOption(idx)} disabled={questionModal.options.length <= 2}>×</button>
                  </div>
                ))}
                <button className="btn btn-sm btn-outline-primary mb-3" type="button" onClick={addOption}>+ Add option</button>
              </>
            )}

            {questionModal.question_type === 'multi_choice' && (
              <div className="row">
                <div className="col-6">
                  <Input
                    label="Min selections (optional)"
                    id="qMin"
                    type="number"
                    value={questionModal.min_selections}
                    onChange={(e) => setQuestionModal({ ...questionModal, min_selections: e.target.value })}
                  />
                </div>
                <div className="col-6">
                  <Input
                    label="Max selections (optional)"
                    id="qMax"
                    type="number"
                    value={questionModal.max_selections}
                    onChange={(e) => setQuestionModal({ ...questionModal, max_selections: e.target.value })}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default QuestionnaireBuilder;
