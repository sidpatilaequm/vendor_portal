import { DOCS, TODAY, fieldError as ruleFieldError } from '../data';

// Ported from become-a-supplier/app/become-a-supplier/lib/validation.ts

export function isFilled(v) {
  return (v || '').trim() !== '';
}

/** Field-level format / expiry validation for a doc field definition. */
export function fieldError(field, rawValue) {
  const v = (rawValue || '').trim();
  if (!v) return '';
  const msg = ruleFieldError(field.k, v.toUpperCase());
  if (msg) return msg;
  if (field.expiry && v < TODAY) return 'This certificate has already expired — upload the current one.';
  return '';
}

/** Same rule table, keyed directly (used for contact email/phone). */
export function ruleError(ruleKey, rawValue) {
  const v = (rawValue || '').trim();
  if (!v) return '';
  return ruleFieldError(ruleKey, v) || '';
}

/**
 * A question with no dependsOnQuestionId is always visible; otherwise only once the respondent
 * picked dependsOnOptionId on that earlier question. Same rule enforced server-side (Java's
 * isQuestionVisible, Form Studio's own _question_is_visible) — shared here between
 * DynamicQuestionsSection (what to render) and computeDynamicReadiness (what to require) so the
 * two can't drift apart client-side.
 */
export function isDynamicQuestionVisible(question, dynamicAnswers) {
  if (!question.dependsOnQuestionId) return true;
  const depAnswer = dynamicAnswers[question.dependsOnQuestionId];
  return !!depAnswer && (depAnswer.optionIds || []).includes(question.dependsOnOptionId);
}

/**
 * Generic readiness pass over the admin-defined questionnaire's questions — mandatory required,
 * choice min/max — since these rules are admin-authored data, not developer-authored code, unlike
 * every other field in this form.
 */
export function computeDynamicReadiness(questionnaire, dynamicAnswers) {
  let total = 0;
  let filled = 0;
  const gaps = [];
  if (!questionnaire?.sections) return { total, filled, gaps };

  for (const section of questionnaire.sections) {
    for (const q of section.questions) {
      if (!q.isMandatory) continue;
      if (!isDynamicQuestionVisible(q, dynamicAnswers)) continue;
      total++;
      const answer = dynamicAnswers[q.questionId] || {};
      let ok;
      if (q.questionType === 'short_text' || q.questionType === 'counter' || q.questionType === 'file_upload') {
        ok = isFilled(answer.textValue);
      } else if (q.questionType === 'table') {
        const floor = q.minRows || 1;
        const complete = (answer.rows || []).filter((row) =>
          q.columns.every((c) => !c.isRequired || isFilled(row[String(c.columnId)]))
        );
        ok = complete.length >= floor;
      } else {
        ok = Array.isArray(answer.optionIds) && answer.optionIds.length > 0;
      }
      if (ok) {
        filled++;
      } else {
        gaps.push({ sec: 'sec-questions', name: q.prompt, id: `q_${q.questionId}` });
      }
    }
  }
  return { total, filled, gaps };
}

export function crossChecks(fields) {
  const out = [];
  const g = (id) => (fields[id] || '').trim().toUpperCase();

  if (g('pan') && g('gstin').length === 15) {
    const ok = g('gstin').slice(2, 12) === g('pan');
    out.push([
      ok ? 'ok' : 'no',
      ok
        ? 'The PAN inside your GSTIN matches your PAN card.'
        : 'The PAN inside your GSTIN is not the PAN on your PAN card — the two documents are for different entities.',
    ]);
  }
  if (g('udyam')) out.push(['ok', 'MSME registration on file — payments to you fall under the 45-day MSMED Act rule.']);

  return out;
}

/** Full readiness pass — the JS equivalent of the original recalc(). */
export function computeReadiness(state) {
  const errors = {};
  const gaps = [];
  let total = 0;
  let filled = 0;
  let bad = 0;

  let docsTotal = 0;
  let docsFilled = 0;
  DOCS.forEach((d) => {
    const uploaded = state.docs[d.id]?.status === 'read';
    if (d.req) {
      total++;
      docsTotal++;
      if (uploaded) {
        filled++;
        docsFilled++;
      } else {
        gaps.push({ sec: 'sec-docs', name: `${d.name} — not uploaded`, id: `doc_${d.id}` });
      }
    }
    if (!uploaded) return;
    d.fields.forEach((f) => {
      if (f.req) {
        total++;
        if (isFilled(state.fields[f.k])) {
          filled++;
        } else {
          gaps.push({ sec: 'sec-docs', name: `${d.name} — ${f.label}`, id: f.k });
        }
      }
      const msg = fieldError(f, state.fields[f.k]);
      if (msg) {
        errors[f.k] = msg;
        bad++;
      }
    });
  });

  const checks = crossChecks(state.fields);
  if (checks.some((c) => c[0] === 'no')) bad++;
  const filesCount = Object.values(state.docs).filter((f) => f.status === 'read').length;

  let youTotal = 0;
  let youFilled = 0;

  const youRequired = [
    { id: 'dTrue', label: 'Declaration', filled: state.declaration },
    { id: 'c1_email', label: 'Contact email', filled: isFilled(state.fields.c1_email) },
  ];
  youRequired.forEach((r) => {
    youTotal++;
    if (r.filled) {
      youFilled++;
    } else {
      gaps.push({ sec: 'sec-you', name: r.label, id: r.id });
    }
  });

  const emailMsg = ruleError('email', state.fields.c1_email);
  if (emailMsg) {
    errors.c1_email = emailMsg;
    bad++;
  }

  total += youTotal;
  filled += youFilled;

  const dynamicReadiness = computeDynamicReadiness(state.questionnaire, state.dynamicAnswers);
  total += dynamicReadiness.total;
  filled += dynamicReadiness.filled;
  gaps.push(...dynamicReadiness.gaps);

  const pct = total ? Math.round((filled / total) * 100) : 0;
  const canSubmit = !state.submitted && filled === total && bad === 0 && total > 0;

  return {
    total, filled, bad, pct, canSubmit, gaps, docsTotal, docsFilled, filesCount, youTotal, youFilled,
    dynamicTotal: dynamicReadiness.total, dynamicFilled: dynamicReadiness.filled,
    errors, crossChecks: checks,
  };
}
