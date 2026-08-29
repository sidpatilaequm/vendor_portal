import React from 'react';

// Renders whichever questionnaire an admin has published and marked active (Questionnaire tab
// in the admin panel), generically — short_text / single_choice (radio or dropdown) /
// multi_choice / counter — since the question set is admin-authored data, not a fixed field list
// like the rest of this form. Structurally mirrors dynamic_questions/frontend/src/pages/
// FillForm.jsx's branches, styled with this page's own supplier-form.css classes instead of Form
// Studio's CSS.
const DynamicQuestionsSection = ({ state, readiness, setDynamicAnswer }) => {
  const { questionnaire, dynamicAnswers } = state;

  if (!questionnaire?.sections?.length) return null;

  const answerFor = (questionId) => dynamicAnswers[questionId] || {};

  const toggleOption = (question, optionId) => {
    const current = answerFor(question.questionId).optionIds || [];
    if (question.questionType === 'single_choice') {
      setDynamicAnswer(question.questionId, { optionIds: [optionId] });
      return;
    }
    const has = current.includes(optionId);
    const next = has ? current.filter((id) => id !== optionId) : [...current, optionId];
    setDynamicAnswer(question.questionId, { optionIds: next });
  };

  const stepCounter = (question, delta) => {
    const current = answerFor(question.questionId).textValue;
    const base = current !== undefined && current !== '' ? Number(current) : (question.minValue ?? 0);
    let next = base + delta;
    if (question.minValue != null && next < question.minValue) next = question.minValue;
    if (question.maxValue != null && next > question.maxValue) next = question.maxValue;
    setDynamicAnswer(question.questionId, { textValue: String(next) });
  };

  const blankRow = (question) => Object.fromEntries(question.columns.map((c) => [String(c.columnId), '']));
  const rowsFor = (question) => {
    const rows = answerFor(question.questionId).rows;
    return rows && rows.length ? rows : [blankRow(question)];
  };
  const setCell = (question, rowIndex, columnId, value) => {
    const rows = rowsFor(question).map((row, i) => (i === rowIndex ? { ...row, [columnId]: value } : row));
    setDynamicAnswer(question.questionId, { rows });
  };
  const addRow = (question) => setDynamicAnswer(question.questionId, { rows: [...rowsFor(question), blankRow(question)] });
  const removeRow = (question, rowIndex) => {
    const rows = rowsFor(question).filter((_, i) => i !== rowIndex);
    setDynamicAnswer(question.questionId, { rows: rows.length ? rows : [blankRow(question)] });
  };

  return (
    <section className="sec" id="sec-questions">
      {questionnaire.sections.map((section) => (
        <div key={section.sectionId} style={{ marginBottom: 20 }}>
          {section.title && (
            <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              {section.title}
            </h3>
          )}
          {section.questions.map((q) => {
            const answer = answerFor(q.questionId);
            const selected = answer.optionIds || [];
            return (
              <div key={q.questionId} id={`q_${q.questionId}`} style={{ marginBottom: 16 }}>
                <label>
                  {q.prompt} {q.isMandatory && <span className="req">*</span>}
                </label>
                {q.helpText && <p className="sm muted" style={{ marginTop: -4, marginBottom: 6 }}>{q.helpText}</p>}

                {q.questionType === 'short_text' && (
                  <input
                    value={answer.textValue || ''}
                    maxLength={q.maxLength || undefined}
                    onChange={(e) => setDynamicAnswer(q.questionId, { textValue: e.target.value })}
                  />
                )}

                {q.questionType === 'single_choice' && q.isDropdown && (
                  <select
                    value={selected[0] ?? ''}
                    onChange={(e) => toggleOption(q, Number(e.target.value))}
                  >
                    <option value="" disabled>Select</option>
                    {q.options.map((o) => (
                      <option key={o.optionId} value={o.optionId}>{o.label}</option>
                    ))}
                  </select>
                )}

                {q.questionType === 'single_choice' && !q.isDropdown && (
                  <div className="grid g2">
                    {q.options.map((o) => (
                      <label className="chk" key={o.optionId}>
                        <input
                          type="radio"
                          name={`q_${q.questionId}`}
                          checked={selected.includes(o.optionId)}
                          onChange={() => toggleOption(q, o.optionId)}
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.questionType === 'counter' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      className="btn ghost sm"
                      type="button"
                      onClick={() => stepCounter(q, -1)}
                      disabled={q.minValue != null && Number(answer.textValue ?? q.minValue ?? 0) <= q.minValue}
                    >
                      −
                    </button>
                    <input
                      className="mono"
                      style={{ width: 80, textAlign: 'center' }}
                      value={answer.textValue ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9-]/g, '');
                        setDynamicAnswer(q.questionId, { textValue: v });
                      }}
                    />
                    <button
                      className="btn ghost sm"
                      type="button"
                      onClick={() => stepCounter(q, 1)}
                      disabled={q.maxValue != null && Number(answer.textValue ?? q.minValue ?? 0) >= q.maxValue}
                    >
                      +
                    </button>
                  </div>
                )}

                {q.questionType === 'multi_choice' && (
                  <div className="grid g2">
                    {q.options.map((o) => (
                      <label className="chk" key={o.optionId}>
                        <input
                          type="checkbox"
                          checked={selected.includes(o.optionId)}
                          onChange={() => toggleOption(q, o.optionId)}
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.questionType === 'table' && (
                  <div>
                    <div style={{ overflowX: 'auto', border: '1px solid var(--line, #dee4e6)', borderRadius: 6 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                          <tr>
                            {q.columns.map((c) => (
                              <th
                                key={c.columnId}
                                style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--line, #dee4e6)', whiteSpace: 'nowrap' }}
                              >
                                {c.label}{c.isRequired && <span className="req">*</span>}
                              </th>
                            ))}
                            <th style={{ width: 1 }} />
                          </tr>
                        </thead>
                        <tbody>
                          {rowsFor(q).map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {q.columns.map((c) => (
                                <td key={c.columnId} style={{ padding: '4px 6px', borderBottom: '1px solid var(--line, #dee4e6)' }}>
                                  {c.columnType === 'dropdown' ? (
                                    <select
                                      value={row[String(c.columnId)] ?? ''}
                                      onChange={(e) => setCell(q, rowIndex, String(c.columnId), e.target.value)}
                                      style={{ minWidth: 120 }}
                                    >
                                      <option value="">—</option>
                                      {(c.options ?? []).map((o) => (
                                        <option key={o.optionId} value={o.label}>{o.label}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type={c.columnType === 'number' ? 'number' : c.columnType === 'date' ? 'date' : 'text'}
                                      value={row[String(c.columnId)] ?? ''}
                                      onChange={(e) => setCell(q, rowIndex, String(c.columnId), e.target.value)}
                                      style={{ minWidth: 120 }}
                                    />
                                  )}
                                </td>
                              ))}
                              <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--line, #dee4e6)' }}>
                                <button
                                  className="btn ghost sm" type="button"
                                  onClick={() => removeRow(q, rowIndex)}
                                  disabled={rowsFor(q).length <= 1}
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <button
                        className="btn ghost sm" type="button"
                        onClick={() => addRow(q)}
                        disabled={q.maxRows != null && rowsFor(q).length >= q.maxRows}
                      >
                        + Add row
                      </button>
                      {(q.minRows || q.maxRows) && (
                        <span className="sm muted" style={{ marginLeft: 10 }}>
                          {q.minRows ? `At least ${q.minRows} row${q.minRows === 1 ? '' : 's'}` : ''}
                          {q.minRows && q.maxRows ? ' · ' : ''}
                          {q.maxRows ? `At most ${q.maxRows} row${q.maxRows === 1 ? '' : 's'}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="emsg" />
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
};

export default DynamicQuestionsSection;
