import React from 'react';

// Renders whichever questionnaire an admin has published and marked active (Questionnaire tab
// in the admin panel), generically — short_text / single_choice / multi_choice — since the
// question set is admin-authored data, not a fixed field list like the rest of this form.
// Structurally mirrors dynamic_questions/frontend/src/pages/FillForm.jsx's three branches,
// styled with this page's own supplier-form.css classes instead of Form Studio's CSS.
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

  return (
    <section className="sec" id="sec-questions">
      <div className="sh">
        <h2>{questionnaire.name}</h2>
        <span className="n">04</span>
      </div>
      <p className="sdesc">A few more questions before we can review your application.</p>

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

                {q.questionType === 'single_choice' && (
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
