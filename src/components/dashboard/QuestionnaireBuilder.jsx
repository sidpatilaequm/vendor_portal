import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import './questionnaire-studio.css';

// Questionnaire Studio's editor — a pixel-level port of the Form Studio standalone mockup's
// Build / Fill in / Responses tabs, wired to the real API (Form Studio, reached through
// backend_java's /api/questionnaire/** proxy) instead of the mockup's local in-memory `db`.

const QUESTION_TYPES = [
  { value: 'short_text', name: 'Short answer', hint: 'A single line of free text.', tag: 'TEXT' },
  { value: 'single_choice', name: 'Single choice', hint: 'Options, one of which can be picked.', tag: 'ONE' },
  { value: 'multi_choice', name: 'Multiple choice', hint: 'Options, any number of which can be picked.', tag: 'MANY' },
  { value: 'counter', name: 'Counter', hint: 'A single whole number, optionally bounded.', tag: 'NUM' },
  { value: 'table', name: 'Table', hint: 'Columns you define, filled in row by row.', tag: 'GRID' },
];

const CHOICE_DISPLAYS = [
  { value: 'radio', name: 'Single field', hint: 'Every option on screen, one of them selected.' },
  { value: 'dropdown', name: 'Dropdown', hint: 'One line that opens the list. Better for long lists.' },
];

const COLUMN_TYPES = [
  { value: 'text', name: 'Text', input: 'text' },
  { value: 'number', name: 'Number', input: 'number' },
  { value: 'date', name: 'Date', input: 'date' },
];

const typeInfo = (v) => QUESTION_TYPES.find((t) => t.value === v) ?? QUESTION_TYPES[0];
const columnInfo = (v) => COLUMN_TYPES.find((c) => c.value === v) ?? COLUMN_TYPES[0];
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

let keySeed = 0;
const newOption = (label = '') => ({ key: `opt-${keySeed++}`, label });
const newColumn = (col = {}) => ({
  key: `col-${keySeed++}`,
  label: col.label ?? '',
  column_type: col.column_type ?? 'text',
  is_required: col.is_required ?? false,
});

function draftFrom(question) {
  if (!question) {
    return {
      prompt: '', help_text: '', question_type: 'short_text', is_mandatory: false,
      max_length: '', min_selections: '', max_selections: '',
      is_dropdown: false, min_value: '', max_value: '', min_rows: '', max_rows: '',
      options: [newOption(), newOption()],
      columns: [newColumn(), newColumn()],
    };
  }
  return {
    prompt: question.prompt,
    help_text: question.help_text ?? '',
    question_type: question.question_type,
    is_mandatory: question.is_mandatory,
    max_length: question.max_length ?? '',
    min_selections: question.min_selections ?? '',
    max_selections: question.max_selections ?? '',
    is_dropdown: question.is_dropdown ?? false,
    min_value: question.min_value ?? '',
    max_value: question.max_value ?? '',
    min_rows: question.min_rows ?? '',
    max_rows: question.max_rows ?? '',
    options: question.options?.length ? question.options.map((o) => newOption(o.label)) : [newOption(), newOption()],
    columns: question.columns?.length ? question.columns.map((c) => newColumn(c)) : [newColumn(), newColumn()],
  };
}

/** Client-side mirror of schemas.py::check_shape, so the editor can show the problem
    immediately rather than waiting on a round trip — the API still re-checks on save. */
function checkDraft(draft, mandatoryBlocked) {
  if (!draft.prompt.trim()) return 'Write the question itself.';
  if (mandatoryBlocked && draft.is_mandatory) {
    return "This process already has recorded responses, so a brand-new question can't be marked mandatory — existing respondents were never shown it and can't retroactively answer it. Add it as optional, or duplicate the process if this must be required going forward.";
  }

  if (draft.question_type === 'table') {
    const headings = draft.columns.map((c) => c.label.trim()).filter(Boolean);
    if (headings.length < 1) return 'Give this table at least one column.';
    if (new Set(headings.map((h) => h.toLowerCase())).size !== headings.length)
      return 'Two columns have the same heading.';
    const lo = draft.min_rows ? Number(draft.min_rows) : null;
    const hi = draft.max_rows ? Number(draft.max_rows) : null;
    if (lo && hi && lo > hi) return 'The fewest rows cannot be more than the most rows.';
    return null;
  }

  if (draft.question_type === 'short_text' || draft.question_type === 'counter') {
    if (draft.question_type === 'counter') {
      const lo = draft.min_value !== '' ? Number(draft.min_value) : null;
      const hi = draft.max_value !== '' ? Number(draft.max_value) : null;
      if (lo != null && hi != null && lo > hi) return 'The minimum cannot be larger than the maximum.';
    }
    return null;
  }

  const labels = draft.options.map((o) => o.label.trim()).filter(Boolean);
  if (labels.length < 2) return 'Give this question at least two options.';
  if (new Set(labels.map((l) => l.toLowerCase())).size !== labels.length)
    return 'Two options have the same label.';

  if (draft.question_type === 'multi_choice') {
    const lo = draft.min_selections ? Number(draft.min_selections) : null;
    const hi = draft.max_selections ? Number(draft.max_selections) : null;
    if (lo && hi && lo > hi) return 'The minimum cannot be larger than the maximum.';
    if (hi && hi > labels.length) return 'The maximum is higher than the number of options.';
    if (lo && lo > labels.length) return 'The minimum is higher than the number of options.';
  }
  return null;
}

/** Builds the exact QuestionIn-shaped payload the API expects. */
function draftToPayload(draft) {
  const isTable = draft.question_type === 'table';
  const isChoice = draft.question_type === 'single_choice' || draft.question_type === 'multi_choice';
  return {
    prompt: draft.prompt.trim(),
    help_text: draft.help_text.trim() || null,
    question_type: draft.question_type,
    is_mandatory: draft.is_mandatory,
    max_length: draft.question_type === 'short_text' && draft.max_length ? Number(draft.max_length) : null,
    min_selections: draft.question_type === 'multi_choice' && draft.min_selections ? Number(draft.min_selections) : null,
    max_selections: draft.question_type === 'multi_choice' && draft.max_selections ? Number(draft.max_selections) : null,
    is_dropdown: draft.question_type === 'single_choice' ? !!draft.is_dropdown : false,
    min_value: draft.question_type === 'counter' && draft.min_value !== '' ? Number(draft.min_value) : null,
    max_value: draft.question_type === 'counter' && draft.max_value !== '' ? Number(draft.max_value) : null,
    min_rows: isTable && draft.min_rows !== '' ? Number(draft.min_rows) : null,
    max_rows: isTable && draft.max_rows !== '' ? Number(draft.max_rows) : null,
    options: isChoice ? draft.options.map((o) => ({ label: o.label.trim() })).filter((o) => o.label) : [],
    columns: isTable
      ? draft.columns
          .filter((c) => c.label.trim())
          .map((c) => ({ label: c.label.trim(), column_type: c.column_type, is_required: !!c.is_required }))
      : [],
  };
}

const blankRow = (question) => Object.fromEntries(question.columns.map((c) => [String(c.id), '']));
const startingRows = (question) =>
  Array.from({ length: Math.max(question.min_rows ?? 1, 1) }, () => blankRow(question));
const filledRows = (rows) => rows.filter((row) => Object.values(row).some((v) => v.trim()));

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

const QuestionnaireBuilder = ({ processId, onBack }) => {
  const [process, setProcess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('build');
  const [editing, setEditing] = useState(null); // { sectionId, questionId, draft, problem }
  const [responses, setResponses] = useState([]);
  const [responsesLoaded, setResponsesLoaded] = useState(false);
  const [openResponse, setOpenResponse] = useState(null);
  const [fill, setFill] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`/api/questionnaire/processes/${processId}`, { headers: authHeaders() });
      setProcess(data);
    } catch (err) {
      setError('Could not load this questionnaire.');
    } finally {
      setLoading(false);
    }
  }, [processId]);

  useEffect(() => { load(); }, [load]);

  const loadResponses = useCallback(async () => {
    try {
      const { data } = await axios.get(`/api/questionnaire/processes/${processId}/responses`, { headers: authHeaders() });
      setResponses(Array.isArray(data) ? data : []);
      setResponsesLoaded(true);
    } catch (err) {
      setResponses([]);
    }
  }, [processId]);

  useEffect(() => {
    if (tab === 'responses' && !responsesLoaded) loadResponses();
  }, [tab, responsesLoaded, loadResponses]);

  const allQuestions = useMemo(
    () => (process ? process.sections.flatMap((s) => s.questions) : []),
    [process]
  );
  const locked = !!process?.locked;

  const resetFill = useCallback(() => {
    const answers = {};
    for (const q of allQuestions) {
      answers[q.id] = { text: '', options: [], rows: q.question_type === 'table' ? startingRows(q) : [] };
    }
    setFill({ answers, who: { name: '', email: '' }, errors: {}, notice: null, receipt: null });
  }, [allQuestions]);

  useEffect(() => {
    if (tab === 'fill' && !fill) resetFill();
  }, [tab, fill, resetFill]);

  // ---------------- process-level ----------------

  const patchProcess = async (fields) => {
    try {
      const { data } = await axios.put(`/api/questionnaire/processes/${processId}`, {
        name: process.name, description: process.description, status: process.status, ...fields,
      }, { headers: authHeaders() });
      setProcess((p) => ({ ...p, ...data }));
    } catch (err) {
      alert(err.response?.data?.detail || 'Could not save.');
    }
  };

  // ---------------- sections ----------------

  const addSection = async () => {
    setSaving(true);
    try {
      await axios.post(`/api/questionnaire/processes/${processId}/sections`, {
        title: `Section ${process.sections.length + 1}`,
      }, { headers: authHeaders() });
      await load();
    } finally { setSaving(false); }
  };

  const patchSection = async (sectionId, fields) => {
    const section = process.sections.find((s) => s.id === sectionId);
    try {
      await axios.put(`/api/questionnaire/sections/${sectionId}`, {
        title: section.title, description: section.description, ...fields,
      }, { headers: authHeaders() });
      setProcess((p) => ({
        ...p,
        sections: p.sections.map((s) => (s.id === sectionId ? { ...s, ...fields } : s)),
      }));
    } catch (err) {
      alert('Could not save the section.');
    }
  };

  const moveSection = async (sectionId, delta) => {
    const ids = process.sections.map((s) => s.id);
    const index = ids.indexOf(sectionId);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setSaving(true);
    try {
      await axios.put(`/api/questionnaire/processes/${processId}/sections/order`, { section_ids: ids }, { headers: authHeaders() });
      await load();
    } finally { setSaving(false); }
  };

  const deleteSection = async (section) => {
    const warning = section.questions.length
      ? `Delete "${section.title}" and its ${plural(section.questions.length, 'question')}?`
      : `Delete "${section.title}"?`;
    if (!window.confirm(warning)) return;
    setSaving(true);
    try {
      await axios.delete(`/api/questionnaire/sections/${section.id}`, { headers: authHeaders() });
      setEditing(null);
      setFill(null);
      await load();
    } finally { setSaving(false); }
  };

  // ---------------- questions ----------------

  const startAddQuestion = (sectionId) => setEditing({ sectionId, questionId: null, draft: draftFrom(null), problem: null });
  const startEditQuestion = (sectionId, question) => setEditing({ sectionId, questionId: question.id, draft: draftFrom(question), problem: null });
  const cancelEdit = () => setEditing(null);

  const saveQuestion = async () => {
    const problem = checkDraft(editing.draft, locked && !editing.questionId);
    if (problem) { setEditing((e) => ({ ...e, problem })); return; }
    setSaving(true);
    try {
      const payload = draftToPayload(editing.draft);
      if (editing.questionId) {
        await axios.put(`/api/questionnaire/questions/${editing.questionId}`, payload, { headers: authHeaders() });
      } else {
        await axios.post(`/api/questionnaire/sections/${editing.sectionId}/questions`, payload, { headers: authHeaders() });
      }
      setEditing(null);
      setFill(null);
      await load();
    } catch (err) {
      setEditing((e) => ({ ...e, problem: err.response?.data?.detail || 'Could not save this question.' }));
    } finally { setSaving(false); }
  };

  const deleteQuestion = async (questionId) => {
    if (!window.confirm('Delete this question?')) return;
    setSaving(true);
    try {
      await axios.delete(`/api/questionnaire/questions/${questionId}`, { headers: authHeaders() });
      setEditing(null);
      setFill(null);
      await load();
    } finally { setSaving(false); }
  };

  const moveQuestion = async (section, questionId, delta) => {
    const ids = section.questions.map((q) => q.id);
    const index = ids.indexOf(questionId);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setSaving(true);
    try {
      await axios.put(`/api/questionnaire/sections/${section.id}/questions/order`, { question_ids: ids }, { headers: authHeaders() });
      await load();
    } finally { setSaving(false); }
  };

  const moveQuestionToSection = async (fromSection, questionId, targetSectionId) => {
    if (!targetSectionId) return;
    const targetSection = process.sections.find((s) => s.id === Number(targetSectionId));
    const ids = [...targetSection.questions.map((q) => q.id), questionId];
    setSaving(true);
    try {
      await axios.put(`/api/questionnaire/sections/${targetSection.id}/questions/order`, { question_ids: ids }, { headers: authHeaders() });
      await load();
    } finally { setSaving(false); }
  };

  // ---------------- editor: options / columns ----------------

  const updateDraftOption = (key, label) =>
    setEditing((e) => ({ ...e, draft: { ...e.draft, options: e.draft.options.map((o) => (o.key === key ? { ...o, label } : o)) } }));
  const addDraftOption = () => setEditing((e) => ({ ...e, draft: { ...e.draft, options: [...e.draft.options, newOption()] } }));
  const removeDraftOption = (key) => setEditing((e) => ({ ...e, draft: { ...e.draft, options: e.draft.options.filter((o) => o.key !== key) } }));
  const moveDraftOption = (key, delta) => setEditing((e) => {
    const list = [...e.draft.options];
    const i = list.findIndex((o) => o.key === key);
    const t = i + delta;
    if (t < 0 || t >= list.length) return e;
    [list[i], list[t]] = [list[t], list[i]];
    return { ...e, draft: { ...e.draft, options: list } };
  });

  const updateDraftColumn = (key, field, value) =>
    setEditing((e) => ({ ...e, draft: { ...e.draft, columns: e.draft.columns.map((c) => (c.key === key ? { ...c, [field]: value } : c)) } }));
  const addDraftColumn = () => setEditing((e) => ({ ...e, draft: { ...e.draft, columns: [...e.draft.columns, newColumn()] } }));
  const removeDraftColumn = (key) => setEditing((e) => ({ ...e, draft: { ...e.draft, columns: e.draft.columns.filter((c) => c.key !== key) } }));
  const moveDraftColumn = (key, delta) => setEditing((e) => {
    const list = [...e.draft.columns];
    const i = list.findIndex((c) => c.key === key);
    const t = i + delta;
    if (t < 0 || t >= list.length) return e;
    [list[i], list[t]] = [list[t], list[i]];
    return { ...e, draft: { ...e.draft, columns: list } };
  });

  // ---------------- fill-in ----------------

  const setFillText = (qid, text) => setFill((f) => ({ ...f, answers: { ...f.answers, [qid]: { ...f.answers[qid], text } } }));
  const setFillOne = (qid, optionId) => setFill((f) => ({ ...f, answers: { ...f.answers, [qid]: { ...f.answers[qid], options: optionId ? [Number(optionId)] : [] } } }));
  const toggleFillMany = (qid, optionId, checked) => setFill((f) => {
    const cur = f.answers[qid].options;
    const next = checked ? [...cur, optionId] : cur.filter((o) => o !== optionId);
    return { ...f, answers: { ...f.answers, [qid]: { ...f.answers[qid], options: next } } };
  });
  const setFillCell = (qid, rowIndex, columnId, value) => setFill((f) => {
    const rows = f.answers[qid].rows.map((row, i) => (i === rowIndex ? { ...row, [columnId]: value } : row));
    return { ...f, answers: { ...f.answers, [qid]: { ...f.answers[qid], rows } } };
  });
  const addFillRow = (question) => setFill((f) => ({
    ...f, answers: { ...f.answers, [question.id]: { ...f.answers[question.id], rows: [...f.answers[question.id].rows, blankRow(question)] } },
  }));
  const removeFillRow = (qid, rowIndex) => setFill((f) => ({
    ...f, answers: { ...f.answers, [qid]: { ...f.answers[qid], rows: f.answers[qid].rows.filter((_, i) => i !== rowIndex) } },
  }));

  const submitFill = async () => {
    const answers = allQuestions.map((q) => {
      const answer = fill.answers[q.id];
      if (q.question_type === 'table') {
        return { question_id: q.id, rows: filledRows(answer.rows) };
      }
      return { question_id: q.id, text_value: answer.text || null, option_ids: answer.options };
    });
    setSaving(true);
    try {
      const { data } = await axios.post(`/api/questionnaire/processes/${processId}/responses`, {
        respondent_name: fill.who.name.trim() || null,
        respondent_email: fill.who.email.trim() || null,
        answers,
      }, { headers: authHeaders() });
      setFill((f) => ({ ...f, receipt: data, notice: null }));
      setResponsesLoaded(false);
      await load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail && typeof detail === 'object' && detail.errors) {
        setFill((f) => ({ ...f, errors: detail.errors, notice: detail.message || 'Some answers still need attention.' }));
      } else {
        setFill((f) => ({ ...f, notice: typeof detail === 'string' ? detail : 'Could not submit this response.' }));
      }
    } finally { setSaving(false); }
  };

  // ---------------- responses ----------------

  const deleteResponse = async (id) => {
    if (!window.confirm('Delete this response?')) return;
    try {
      await axios.delete(`/api/questionnaire/responses/${id}`, { headers: authHeaders() });
      setResponsesLoaded(false);
      await load();
    } catch (err) {
      alert('Could not delete this response.');
    }
  };

  const exportCsv = () => {
    const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Response', 'Submitted', 'Name', 'Email', ...allQuestions.map((q) => q.prompt)];
    const rows = responses.map((r) => {
      const byQuestion = Object.fromEntries(r.answers.map((a) => [a.question_id, a]));
      return [
        r.id, new Date(r.submitted_at).toLocaleString(), r.respondent_name ?? '', r.respondent_email ?? '',
        ...allQuestions.map((q) => {
          const a = byQuestion[q.id];
          if (!a) return '';
          if (q.question_type === 'short_text' || q.question_type === 'counter') return a.text_value ?? '';
          if (q.question_type === 'table') {
            return (a.rows || [])
              .map((row) => Object.entries(row).map(([k, v]) => `${k}: ${v}`).join('; '))
              .join('\n');
          }
          return (a.selected_labels || []).join('; ');
        }),
      ].map(cell).join(',');
    });
    const blob = new Blob([[header.map(cell).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${process.name.replace(/\s+/g, '-').toLowerCase()}-responses.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ==================================================================
  // Render
  // ==================================================================

  if (loading) return <div className="qstudio"><div className="qs-page"><p className="qs-muted">Loading…</p></div></div>;
  if (error || !process) return <div className="qstudio"><div className="qs-page"><p className="qs-alert">{error || 'Not found.'}</p></div></div>;

  const questionCount = allQuestions.length;

  return (
    <div className="qstudio">
      <header className="qs-topbar">
        <button className="qs-back" onClick={onBack}>← Questionnaires</button>
        <div className="wordmark">
          <span className="wordmark__mark" aria-hidden="true">FS</span>
          <span className="wordmark__text">Questionnaire Studio</span>
        </div>
      </header>

      <div className="qs-page">
        <div className="workspace-head">
          <input
            className="title-input"
            aria-label="Process name"
            value={process.name}
            onChange={(e) => setProcess((p) => ({ ...p, name: e.target.value }))}
            onBlur={(e) => patchProcess({ name: e.target.value })}
          />
          <div className="workspace-meta">
            <span className={`chip chip--${process.status}`}>{process.status}</span>
            <select className="select select--tiny" aria-label="Process status" value={process.status} onChange={(e) => patchProcess({ status: e.target.value })}>
              {['draft', 'published', 'closed'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="counts">
              <span>{plural(process.sections.length, 'section')}</span>
              <span>{plural(questionCount, 'question')}</span>
              <span>{plural(process.response_count, 'response')}</span>
            </div>
          </div>
          <textarea
            className="textarea textarea--quiet" rows={1} placeholder="Optional description."
            value={process.description ?? ''}
            onChange={(e) => setProcess((p) => ({ ...p, description: e.target.value }))}
            onBlur={(e) => patchProcess({ description: e.target.value })}
          />
        </div>

        <nav className="tabs">
          {[['build', 'Build', process.sections.length], ['fill', 'Fill in', questionCount], ['responses', 'Responses', process.response_count]].map(([id, label, count]) => (
            <button key={id} className={`tab ${tab === id ? 'tab--on' : ''}`} onClick={() => setTab(id)}>
              {label}<span className="tab__count">{count}</span>
            </button>
          ))}
        </nav>

        <div style={{ height: 18 }} />

        {tab === 'build' && (
          <BuildTab
            process={process} locked={locked} editing={editing} saving={saving}
            onAddSection={addSection} onPatchSection={patchSection} onMoveSection={moveSection} onDeleteSection={deleteSection}
            onStartAdd={startAddQuestion} onStartEdit={startEditQuestion} onCancelEdit={cancelEdit} onSaveQuestion={saveQuestion}
            onDeleteQuestion={deleteQuestion} onMoveQuestion={moveQuestion} onMoveQuestionToSection={moveQuestionToSection}
            setEditing={setEditing}
            updateDraftOption={updateDraftOption} addDraftOption={addDraftOption} removeDraftOption={removeDraftOption} moveDraftOption={moveDraftOption}
            updateDraftColumn={updateDraftColumn} addDraftColumn={addDraftColumn} removeDraftColumn={removeDraftColumn} moveDraftColumn={moveDraftColumn}
          />
        )}
        {tab === 'fill' && (
          <FillTab process={process} allQuestions={allQuestions} fill={fill} saving={saving}
            setFillText={setFillText} setFillOne={setFillOne} toggleFillMany={toggleFillMany}
            setFillCell={setFillCell} addFillRow={addFillRow} removeFillRow={removeFillRow}
            setFill={setFill} onSubmit={submitFill} onFillAnother={resetFill}
          />
        )}
        {tab === 'responses' && (
          <ResponsesTab responses={responses} openResponse={openResponse} setOpenResponse={setOpenResponse}
            onDelete={deleteResponse} onExport={exportCsv} />
        )}
      </div>
    </div>
  );
};

// ============================================================
// Build tab
// ============================================================

const BuildTab = ({
  process, locked, editing, saving,
  onAddSection, onPatchSection, onMoveSection, onDeleteSection,
  onStartAdd, onStartEdit, onCancelEdit, onSaveQuestion,
  onDeleteQuestion, onMoveQuestion, onMoveQuestionToSection, setEditing,
  updateDraftOption, addDraftOption, removeDraftOption, moveDraftOption,
  updateDraftColumn, addDraftColumn, removeDraftColumn, moveDraftColumn,
}) => (
  <div className="qs-stack">
    {locked && (
      <div className="qs-banner">
        <div>
          <p className="qs-banner__title">{plural(process.response_count, 'response')} stored against this form</p>
          <p className="qs-muted">You can still add sections and questions, and reorder or move existing ones —
            but editing or deleting an existing question, or deleting a section, would break those stored answers.</p>
        </div>
      </div>
    )}

    {process.sections.map((section, sIndex) => (
      <section key={section.id} className="section-block">
        <div className="section-tab">
          <span className="qs-code">S{sIndex + 1}</span>
          <input
            className="section-title" aria-label="Section title" defaultValue={section.title} key={section.id}
            onBlur={(e) => onPatchSection(section.id, { title: e.target.value })}
          />
          <div className="section-tab__actions">
            <button className="icon-btn" title="Move section up" disabled={sIndex === 0} onClick={() => onMoveSection(section.id, -1)}>↑</button>
            <button className="icon-btn" title="Move section down" disabled={sIndex === process.sections.length - 1} onClick={() => onMoveSection(section.id, 1)}>↓</button>
            <button className="icon-btn icon-btn--danger" title="Delete section" disabled={locked} onClick={() => onDeleteSection(section)}>✕</button>
          </div>
        </div>

        <textarea
          className="textarea textarea--quiet" rows={1} placeholder="Optional note shown above this section."
          defaultValue={section.description ?? ''}
          onBlur={(e) => onPatchSection(section.id, { description: e.target.value })}
        />

        {section.questions.length === 0 && !(editing && editing.sectionId === section.id && !editing.questionId) && (
          <p className="qs-muted">No questions in this section yet. Add the first one below.</p>
        )}

        <ol className="q-list">
          {section.questions.map((question, qIndex) => (
            <li key={question.id}>
              {editing && editing.questionId === question.id ? (
                <QuestionEditor
                  editing={editing} saving={saving} onCancel={onCancelEdit} onSave={onSaveQuestion} setEditing={setEditing}
                  updateDraftOption={updateDraftOption} addDraftOption={addDraftOption} removeDraftOption={removeDraftOption} moveDraftOption={moveDraftOption}
                  updateDraftColumn={updateDraftColumn} addDraftColumn={addDraftColumn} removeDraftColumn={removeDraftColumn} moveDraftColumn={moveDraftColumn}
                />
              ) : (
                <QuestionCard
                  question={question} code={`S${sIndex + 1}·Q${qIndex + 1}`} section={section} qIndex={qIndex} locked={locked}
                  elsewhere={process.sections.filter((s) => s.id !== section.id)}
                  onEdit={() => onStartEdit(section.id, question)}
                  onMoveUp={() => onMoveQuestion(section, question.id, -1)}
                  onMoveDown={() => onMoveQuestion(section, question.id, 1)}
                  onMoveToSection={(targetId) => onMoveQuestionToSection(section, question.id, targetId)}
                  onDelete={() => onDeleteQuestion(question.id)}
                />
              )}
            </li>
          ))}
        </ol>

        {editing && editing.sectionId === section.id && !editing.questionId ? (
          <QuestionEditor
            editing={editing} locked={locked} saving={saving} onCancel={onCancelEdit} onSave={onSaveQuestion} setEditing={setEditing}
            updateDraftOption={updateDraftOption} addDraftOption={addDraftOption} removeDraftOption={removeDraftOption} moveDraftOption={moveDraftOption}
            updateDraftColumn={updateDraftColumn} addDraftColumn={addDraftColumn} removeDraftColumn={removeDraftColumn} moveDraftColumn={moveDraftColumn}
          />
        ) : (
          <button className="btn btn--dashed" onClick={() => onStartAdd(section.id)}>+ Add a question to {section.title}</button>
        )}
      </section>
    ))}

    <button className="btn btn--dashed" onClick={onAddSection}>+ Add a section</button>
  </div>
);

const QuestionCard = ({ question: q, code, section, qIndex, locked, elsewhere, onEdit, onMoveUp, onMoveDown, onMoveToSection, onDelete }) => {
  const info = typeInfo(q.question_type);
  let preview;

  if (q.question_type === 'short_text') {
    preview = <p className="q-preview">Free text{q.max_length ? ` · up to ${q.max_length} characters` : ''}</p>;
  } else if (q.question_type === 'counter') {
    preview = (
      <p className="q-preview">
        Whole number{q.min_value != null || q.max_value != null
          ? ` · ${q.min_value != null ? `at least ${q.min_value}` : ''}${q.min_value != null && q.max_value != null ? ', ' : ''}${q.max_value != null ? `at most ${q.max_value}` : ''}`
          : ''}
      </p>
    );
  } else if (q.question_type === 'table') {
    preview = (
      <>
        <div className="table-scroll">
          <table className="data-grid data-grid--preview">
            <thead>
              <tr>
                <th className="data-grid__rownum">#</th>
                {q.columns.map((c) => (
                  <th key={c.id}>{c.label}<span className="data-grid__type">{columnInfo(c.column_type).name}{c.is_required ? ' · required' : ''}</span></th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="data-grid__rownum">1</td>
                {q.columns.map((c) => <td key={c.id} className="data-grid__blank" />)}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="q-preview">
          {plural(q.columns.length, 'column')}
          {q.min_rows ? ` · at least ${plural(q.min_rows, 'row')}` : ''}
          {q.max_rows ? ` · at most ${plural(q.max_rows, 'row')}` : ''}
        </p>
      </>
    );
  } else if (q.question_type === 'single_choice' && q.is_dropdown) {
    preview = (
      <>
        <div className="dropdown-preview" aria-hidden="true">
          <span>{q.options[0]?.label ?? 'No options yet'}</span>
          <span className="dropdown-preview__chev">⌄</span>
        </div>
        <p className="q-preview">{plural(q.options.length, 'option')} · dropdown</p>
      </>
    );
  } else {
    const dot = q.question_type === 'single_choice' ? 'dot--round' : 'dot--square';
    preview = (
      <>
        <ul className="option-preview">
          {q.options.map((o) => <li key={o.id}><span className={`dot ${dot}`} aria-hidden="true" />{o.label}</li>)}
        </ul>
        {q.question_type === 'single_choice' && <p className="q-preview">{plural(q.options.length, 'option')} · single field</p>}
      </>
    );
  }

  const limits = q.question_type === 'multi_choice' && (q.min_selections || q.max_selections)
    ? <p className="q-preview">Pick{q.min_selections ? ` at least ${q.min_selections}` : ''}{q.min_selections && q.max_selections ? ',' : ''}{q.max_selections ? ` no more than ${q.max_selections}` : ''}</p>
    : null;

  return (
    <article className={`q-card ${q.is_mandatory ? 'q-card--required' : ''}`}>
      <div className="q-gutter">
        <span className="qs-code">{code}</span>
        <span className="type-tag">{info.tag}</span>
      </div>
      <div className="q-body">
        <div className="q-head">
          <h3 className="q-prompt">{q.prompt}</h3>
          <span className={`stamp ${q.is_mandatory ? '' : 'stamp--optional'}`}>{q.is_mandatory ? 'Required' : 'Optional'}</span>
        </div>
        {q.help_text && <p className="qs-muted">{q.help_text}</p>}
        {preview}
        {limits}
        <div className="q-actions">
          <button className="btn btn--tiny" disabled={locked} onClick={onEdit}>Edit</button>
          <button className="icon-btn" title="Move up" disabled={qIndex === 0} onClick={onMoveUp}>↑</button>
          <button className="icon-btn" title="Move down" disabled={qIndex === section.questions.length - 1} onClick={onMoveDown}>↓</button>
          {elsewhere.length > 0 && (
            <select className="select select--tiny" aria-label="Move question to another section" value="" onChange={(e) => onMoveToSection(e.target.value)}>
              <option value="">Move to section…</option>
              {elsewhere.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          )}
          <button className="btn btn--tiny btn--danger" disabled={locked} onClick={onDelete}>Delete</button>
        </div>
      </div>
    </article>
  );
};

const QuestionEditor = ({
  editing, locked, saving, onCancel, onSave, setEditing,
  updateDraftOption, addDraftOption, removeDraftOption, moveDraftOption,
  updateDraftColumn, addDraftColumn, removeDraftColumn, moveDraftColumn,
}) => {
  const { draft, questionId, problem } = editing;
  const isTable = draft.question_type === 'table';
  const isSingle = draft.question_type === 'single_choice';
  const isMulti = draft.question_type === 'multi_choice';
  const isChoice = isSingle || isMulti;
  const isText = draft.question_type === 'short_text';
  const isCounter = draft.question_type === 'counter';
  // Only the new-question path is affected — editing an existing question is already blocked
  // entirely upstream (Edit is disabled on the card while locked).
  const mandatoryBlocked = locked && !questionId;

  const setDraft = (field, value) => setEditing((e) => ({ ...e, draft: { ...e.draft, [field]: value }, problem: null }));

  return (
    <div className="editor">
      <p className="qs-eyebrow">{questionId ? 'Editing question' : 'New question'}</p>

      <label className="field">
        <span className="label">Question</span>
        <input className="input" placeholder="What do you want to ask?" value={draft.prompt} onChange={(e) => setDraft('prompt', e.target.value)} />
      </label>

      <label className="field">
        <span className="label">Helper text</span>
        <input className="input" value={draft.help_text} onChange={(e) => setDraft('help_text', e.target.value)}
          placeholder="Optional. Sits under the question to explain what a good answer looks like." />
      </label>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
        <legend className="label">Answer type</legend>
        <div className="type-picker">
          {QUESTION_TYPES.map((type) => (
            <label key={type.value} className={`type-option ${draft.question_type === type.value ? 'type-option--on' : ''}`}>
              <input type="radio" name="question_type" value={type.value} checked={draft.question_type === type.value}
                onChange={() => setDraft('question_type', type.value)} />
              <span className="type-option__name">{type.name}</span>
              <span className="type-option__hint">{type.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="toggle">
        <input type="checkbox" checked={draft.is_mandatory} disabled={mandatoryBlocked} onChange={(e) => setDraft('is_mandatory', e.target.checked)} />
        <span><strong>Mandatory</strong><span className="qs-muted"> — the form cannot be submitted until this one is answered.</span></span>
      </label>
      {mandatoryBlocked && (
        <p className="qs-muted">Can't be mandatory — this form already has responses, and existing respondents were never shown this question.</p>
      )}

      {isText && (
        <label className="field field--narrow">
          <span className="label">Character limit</span>
          <input className="input" type="number" min="1" max="5000" placeholder="No limit" value={draft.max_length} onChange={(e) => setDraft('max_length', e.target.value)} />
        </label>
      )}

      {isCounter && (
        <div className="pair">
          <label className="field field--narrow">
            <span className="label">Minimum</span>
            <input className="input" type="number" placeholder="No minimum" value={draft.min_value} onChange={(e) => setDraft('min_value', e.target.value)} />
          </label>
          <label className="field field--narrow">
            <span className="label">Maximum</span>
            <input className="input" type="number" placeholder="No maximum" value={draft.max_value} onChange={(e) => setDraft('max_value', e.target.value)} />
          </label>
        </div>
      )}

      {isChoice && (
        <div className="field">
          <span className="label">Options</span>
          <ul className="option-editor">
            {draft.options.map((option, index) => (
              <li key={option.key}>
                <span className="qs-code">{index + 1}</span>
                <input className="input" placeholder={`Option ${index + 1}`} value={option.label} onChange={(e) => updateDraftOption(option.key, e.target.value)} />
                <button className="icon-btn" title="Move up" disabled={index === 0} onClick={() => moveDraftOption(option.key, -1)}>↑</button>
                <button className="icon-btn" title="Move down" disabled={index === draft.options.length - 1} onClick={() => moveDraftOption(option.key, 1)}>↓</button>
                <button className="icon-btn icon-btn--danger" title="Remove" disabled={draft.options.length <= 2} onClick={() => removeDraftOption(option.key)}>✕</button>
              </li>
            ))}
          </ul>
          <button className="btn btn--tiny" onClick={addDraftOption}>+ Add option</button>
        </div>
      )}

      {isSingle && (
        <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
          <legend className="label">Show the options as</legend>
          <div className="type-picker type-picker--pair">
            {CHOICE_DISPLAYS.map((style) => {
              const on = (style.value === 'dropdown') === !!draft.is_dropdown;
              return (
                <label key={style.value} className={`type-option ${on ? 'type-option--on' : ''}`}>
                  <input type="radio" name="display_style" checked={on} onChange={() => setDraft('is_dropdown', style.value === 'dropdown')} />
                  <span className="type-option__name">{style.name}</span>
                  <span className="type-option__hint">{style.hint}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {isMulti && (
        <div className="pair">
          <label className="field field--narrow">
            <span className="label">Pick at least</span>
            <input className="input" type="number" min="1" placeholder="No minimum" value={draft.min_selections} onChange={(e) => setDraft('min_selections', e.target.value)} />
          </label>
          <label className="field field--narrow">
            <span className="label">Pick no more than</span>
            <input className="input" type="number" min="1" placeholder="No maximum" value={draft.max_selections} onChange={(e) => setDraft('max_selections', e.target.value)} />
          </label>
        </div>
      )}

      {isTable && (
        <>
          <div className="field">
            <span className="label">Columns</span>
            <p className="qs-muted" style={{ marginBottom: 8 }}>Name each column and pick what it accepts. The respondent fills in one row at a time and adds as many rows as they need.</p>
            <ul className="column-editor">
              {draft.columns.map((column, index) => (
                <li key={column.key}>
                  <span className="qs-code">C{index + 1}</span>
                  <input className="input" placeholder={`Column ${index + 1} heading`} value={column.label} onChange={(e) => updateDraftColumn(column.key, 'label', e.target.value)} />
                  <select className="select select--tiny" aria-label={`Column ${index + 1} accepts`} value={column.column_type} onChange={(e) => updateDraftColumn(column.key, 'column_type', e.target.value)}>
                    {COLUMN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.name}</option>)}
                  </select>
                  <label className="inline-check" title="Every row must fill this column in">
                    <input type="checkbox" checked={column.is_required} onChange={(e) => updateDraftColumn(column.key, 'is_required', e.target.checked)} />
                    <span>Required</span>
                  </label>
                  <button className="icon-btn" title="Move left" disabled={index === 0} onClick={() => moveDraftColumn(column.key, -1)}>←</button>
                  <button className="icon-btn" title="Move right" disabled={index === draft.columns.length - 1} onClick={() => moveDraftColumn(column.key, 1)}>→</button>
                  <button className="icon-btn icon-btn--danger" title="Remove" disabled={draft.columns.length <= 1} onClick={() => removeDraftColumn(column.key)}>✕</button>
                </li>
              ))}
            </ul>
            <button className="btn btn--tiny" onClick={addDraftColumn}>+ Add column</button>
          </div>
          <div className="pair">
            <label className="field field--narrow">
              <span className="label">Fewest rows</span>
              <input className="input" type="number" min="1" max="200" value={draft.min_rows} placeholder={draft.is_mandatory ? '1' : 'No minimum'} onChange={(e) => setDraft('min_rows', e.target.value)} />
            </label>
            <label className="field field--narrow">
              <span className="label">Most rows</span>
              <input className="input" type="number" min="1" max="200" value={draft.max_rows} placeholder="No maximum" onChange={(e) => setDraft('max_rows', e.target.value)} />
            </label>
          </div>
        </>
      )}

      {problem && <p className="qs-alert">{problem}</p>}

      <div className="row-actions" style={{ marginTop: 12 }}>
        <button className="btn btn--primary" disabled={saving} onClick={onSave}>{saving ? 'Saving…' : (questionId ? 'Save changes' : 'Add question')}</button>
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
};

// ============================================================
// Fill-in tab
// ============================================================

const FillTab = ({ process, allQuestions, fill, saving, setFillText, setFillOne, toggleFillMany, setFillCell, addFillRow, removeFillRow, setFill, onSubmit, onFillAnother }) => {
  if (!fill) return null;
  const collecting = process.status === 'published';

  if (fill.receipt) {
    return (
      <div className="card receipt">
        <p className="qs-eyebrow">Response {fill.receipt.id}</p>
        <h2 className="qs-display qs-display--sm">Answers recorded.</h2>
        <p className="qs-muted">Saved at {new Date(fill.receipt.submitted_at).toLocaleString()}. You can see it on the Responses tab.</p>
        <button className="btn btn--primary" onClick={onFillAnother}>Fill in another</button>
      </div>
    );
  }

  if (allQuestions.length === 0) {
    return (
      <div className="qs-empty">
        <p className="qs-empty__title">There is nothing to answer yet.</p>
        <p className="qs-muted">Add questions on the Build tab, then come back.</p>
      </div>
    );
  }

  return (
    <div className="qs-stack">
      {!collecting && (
        <div className="qs-banner">
          <div>
            <p className="qs-banner__title">This process is {process.status === 'draft' ? 'a draft' : 'closed'}</p>
            <p className="qs-muted">You can read through the form, but it will not accept a submission until the status is set to Published.</p>
          </div>
        </div>
      )}
      {process.description && <p className="qs-lede">{process.description}</p>}

      <div className="card who-card">
        <p className="qs-eyebrow">Who is answering</p>
        <div className="pair">
          <label className="field" style={{ margin: 0 }}>
            <span className="label">Name</span>
            <input className="input" placeholder="Optional" value={fill.who.name} onChange={(e) => setFill((f) => ({ ...f, who: { ...f.who, name: e.target.value } }))} />
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span className="label">Email</span>
            <input className="input" type="email" placeholder="Optional" value={fill.who.email} onChange={(e) => setFill((f) => ({ ...f, who: { ...f.who, email: e.target.value } }))} />
          </label>
        </div>
      </div>

      {process.sections.filter((s) => s.questions.length).map((section, sIndex) => (
        <section key={section.id} className="section-block">
          <div className="section-tab">
            <span className="qs-code">S{sIndex + 1}</span>
            <h2 className="section-title" style={{ border: 0, background: 'none' }}>{section.title}</h2>
          </div>
          {section.description && <p className="qs-muted">{section.description}</p>}
          <ol className="q-list">
            {section.questions.map((question, qIndex) => (
              <li key={question.id}>
                <FillQuestion
                  question={question} sIndex={sIndex} qIndex={qIndex}
                  answer={fill.answers[question.id]} bad={fill.errors[question.id]}
                  setFillText={setFillText} setFillOne={setFillOne} toggleFillMany={toggleFillMany}
                  setFillCell={setFillCell} addFillRow={addFillRow} removeFillRow={removeFillRow}
                />
              </li>
            ))}
          </ol>
        </section>
      ))}

      {fill.notice && <p className="qs-alert">{fill.notice}</p>}

      <div className="submit-row">
        <button className="btn btn--primary btn--lg" disabled={!collecting || saving} onClick={onSubmit}>{saving ? 'Submitting…' : 'Submit response'}</button>
        <p className="qs-muted">{allQuestions.filter((q) => q.is_mandatory).length} of {allQuestions.length} questions are required.</p>
      </div>
    </div>
  );
};

const FillQuestion = ({ question: q, sIndex, qIndex, answer, bad, setFillText, setFillOne, toggleFillMany, setFillCell, addFillRow, removeFillRow }) => {
  const inputId = `q-${q.id}`;
  let control = null;

  if (q.question_type === 'short_text') {
    control = (
      <>
        <input id={inputId} className="input" value={answer.text} maxLength={q.max_length || undefined} onChange={(e) => setFillText(q.id, e.target.value)} />
        {q.max_length && <p className="counter">{answer.text.length} / {q.max_length}</p>}
      </>
    );
  } else if (q.question_type === 'counter') {
    control = <input id={inputId} className="input" type="number" min={q.min_value ?? undefined} max={q.max_value ?? undefined} value={answer.text} onChange={(e) => setFillText(q.id, e.target.value)} />;
  } else if (q.question_type === 'single_choice' && q.is_dropdown) {
    control = (
      <select id={inputId} className="select" value={answer.options[0] ?? ''} onChange={(e) => setFillOne(q.id, e.target.value)}>
        <option value="">Choose an option…</option>
        {q.options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
  } else if (q.question_type === 'single_choice') {
    control = (
      <div className="choices" role="radiogroup" aria-labelledby={inputId}>
        {q.options.map((o) => (
          <label key={o.id} className="choice">
            <input type="radio" name={inputId} checked={answer.options[0] === o.id} onChange={() => setFillOne(q.id, o.id)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    );
  } else if (q.question_type === 'multi_choice') {
    control = (
      <div className="choices">
        {q.options.map((o) => (
          <label key={o.id} className="choice">
            <input type="checkbox" checked={answer.options.includes(o.id)} onChange={(e) => toggleFillMany(q.id, o.id, e.target.checked)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    );
  } else if (q.question_type === 'table') {
    const atCap = q.max_rows && answer.rows.length >= q.max_rows;
    control = (
      <>
        <div className="table-scroll">
          <table className="data-grid">
            <thead>
              <tr>
                <th className="data-grid__rownum">#</th>
                {q.columns.map((c) => <th key={c.id}>{c.label}{c.is_required && <span className="data-grid__req" title="Required in every row">*</span>}</th>)}
                <th className="data-grid__rownum"><span className="sr-only">Remove row</span></th>
              </tr>
            </thead>
            <tbody>
              {answer.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  <td className="data-grid__rownum">{rowIndex + 1}</td>
                  {q.columns.map((c) => (
                    <td key={c.id}>
                      <input className="input input--cell" type={columnInfo(c.column_type).input} aria-label={`${c.label}, row ${rowIndex + 1}`}
                        value={row[String(c.id)] ?? ''} onChange={(e) => setFillCell(q.id, rowIndex, String(c.id), e.target.value)} />
                    </td>
                  ))}
                  <td className="data-grid__rownum">
                    <button className="icon-btn icon-btn--danger" title="Remove row" disabled={answer.rows.length <= 1} onClick={() => removeFillRow(q.id, rowIndex)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row-actions">
          <button className="btn btn--tiny" disabled={atCap} onClick={() => addFillRow(q)}>+ Add row</button>
          <span className="qs-muted">{plural(filledRows(answer.rows).length, 'row')} filled in{q.max_rows ? ` · ${q.max_rows} allowed` : ''}</span>
        </div>
      </>
    );
  }

  return (
    <div className={`q-card form-question ${bad ? 'form-question--bad' : ''}`}>
      <div className="q-gutter"><span className="qs-code">S{sIndex + 1}·Q{qIndex + 1}</span></div>
      <div className="q-body">
        <div className="q-head">
          <label className="q-prompt" htmlFor={inputId}>{q.prompt}</label>
          {q.is_mandatory && <span className="stamp">Required</span>}
        </div>
        {q.help_text && <p className="qs-muted">{q.help_text}</p>}
        {control}
        {bad && <p className="field-error">{bad}</p>}
      </div>
    </div>
  );
};

// ============================================================
// Responses tab
// ============================================================

const ResponsesTab = ({ responses, openResponse, setOpenResponse, onDelete, onExport }) => {
  if (responses.length === 0) {
    return (
      <div className="qs-empty">
        <p className="qs-empty__title">No responses yet.</p>
        <p className="qs-muted">Publish the process and use the Fill in tab to record the first one.</p>
      </div>
    );
  }

  return (
    <div className="qs-stack">
      <div className="row-actions">
        <button className="btn" onClick={onExport}>Download CSV</button>
      </div>
      <ul className="qs-stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {responses.map((r) => {
          const open = openResponse === r.id;
          const answered = r.answers.filter((a) => a.text_value || (a.selected_labels || []).length || (a.rows || []).length).length;
          return (
            <li key={r.id} className="card response">
              <button className="response__head" aria-expanded={open} onClick={() => setOpenResponse(open ? null : r.id)}>
                <span className="qs-code">#{r.id}</span>
                <span className="response__who">{r.respondent_name || 'Anonymous'}{r.respondent_email && <span className="qs-muted"> · {r.respondent_email}</span>}</span>
                <span className="qs-muted">{new Date(r.submitted_at).toLocaleString()}</span>
                <span className="qs-muted">{answered}/{r.answers.length} answered</span>
                <span className="response__chev" aria-hidden="true">{open ? '▲' : '▼'}</span>
              </button>
              {open && (
                <div className="response__body">
                  <dl className="answer-list">
                    {r.answers.map((a) => (
                      <div key={a.question_id} className="answer">
                        <dt>{a.prompt}{a.is_mandatory && <span className="stamp">Required</span>}</dt>
                        <dd><AnswerValue answer={a} /></dd>
                      </div>
                    ))}
                  </dl>
                  <button className="btn btn--tiny btn--danger" onClick={() => onDelete(r.id)}>Delete response</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const AnswerValue = ({ answer: a }) => {
  if (a.question_type === 'short_text' || a.question_type === 'counter') {
    return a.text_value ? <p className="answer-value">{a.text_value}</p> : <p className="answer-value answer-value--empty">Left blank</p>;
  }
  if (a.question_type === 'table') {
    if (!a.rows || a.rows.length === 0) return <p className="answer-value answer-value--empty">Left blank</p>;
    return (
      <div className="table-scroll">
        <table className="data-grid">
          <thead><tr><th className="data-grid__rownum">#</th>{a.column_labels.map((l) => <th key={l}>{l}</th>)}</tr></thead>
          <tbody>
            {a.rows.map((row, i) => (
              <tr key={i}>
                <td className="data-grid__rownum">{i + 1}</td>
                {a.column_labels.map((l) => <td key={l}>{row[l] ? row[l] : <span className="qs-muted">—</span>}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (!a.selected_labels || a.selected_labels.length === 0) return <p className="answer-value answer-value--empty">Left blank</p>;
  return <ul className="answer-chips">{a.selected_labels.map((l) => <li key={l}>{l}</li>)}</ul>;
};

export default QuestionnaireBuilder;
