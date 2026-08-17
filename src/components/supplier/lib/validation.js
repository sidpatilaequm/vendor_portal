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
    { id: 'businessTypeCount', label: 'At least one business type', filled: state.businessTypes.length > 0 },
    { id: 'businessScope', label: 'Detail scope of business', filled: isFilled(state.fields.businessScope) },
    { id: 'companyType', label: 'Type of the company', filled: isFilled(state.fields.companyType) },
    { id: 'telephone', label: 'Telephone', filled: isFilled(state.fields.telephone) },
    { id: 'dTrue', label: 'Declaration', filled: state.declaration },
    { id: 'c1_name', label: 'Contact name', filled: isFilled(state.fields.c1_name) },
    { id: 'c1_role', label: 'Contact designation', filled: isFilled(state.fields.c1_role) },
    { id: 'c1_email', label: 'Contact email', filled: isFilled(state.fields.c1_email) },
    { id: 'c1_phone', label: 'Contact number', filled: isFilled(state.fields.c1_phone) },
  ];
  if (state.contactsCount === 2) {
    youRequired.push(
      { id: 'c2_name', label: 'Second contact name', filled: isFilled(state.fields.c2_name) },
      { id: 'c2_role', label: 'Second contact designation', filled: isFilled(state.fields.c2_role) },
      { id: 'c2_email', label: 'Second contact email', filled: isFilled(state.fields.c2_email) },
      { id: 'c2_phone', label: 'Second contact number', filled: isFilled(state.fields.c2_phone) }
    );
  }
  youRequired.forEach((r) => {
    youTotal++;
    if (r.filled) {
      youFilled++;
    } else {
      gaps.push({ sec: 'sec-you', name: r.label, id: r.id });
    }
  });

  ['c1_email', 'c2_email'].forEach((id) => {
    if (state.contactsCount === 1 && id === 'c2_email') return;
    const msg = ruleError('email', state.fields[id]);
    if (msg) {
      errors[id] = msg;
      bad++;
    }
  });
  ['c1_phone', 'c2_phone'].forEach((id) => {
    if (state.contactsCount === 1 && id === 'c2_phone') return;
    const msg = ruleError('phone', state.fields[id]);
    if (msg) {
      errors[id] = msg;
      bad++;
    }
  });

  total += youTotal;
  filled += youFilled;

  const pct = total ? Math.round((filled / total) * 100) : 0;
  const canSubmit = !state.submitted && filled === total && bad === 0 && total > 0;

  return { total, filled, bad, pct, canSubmit, gaps, docsTotal, docsFilled, filesCount, youTotal, youFilled, errors, crossChecks: checks };
}
