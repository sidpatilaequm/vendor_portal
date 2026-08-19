import React from 'react';
import { REVIEW_FLOW } from '../data';

// Ported from become-a-supplier/app/become-a-supplier/components/SubmitSection.tsx
const SubmitSection = ({ readiness, onSubmit, busy }) => {
  const jump = (id) => () => {
    const el = document.getElementById(id);
    if (!el) return;
    (el.closest('.doc') || el.closest('.sec') || el).scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section className="sec" id="sec-submit">
      <div className="sh">
        <h2>Submit</h2>
        <span className="n">06</span>
      </div>
      <p className="sdesc">Four reviews, about ten working days. You are told at each step.</p>
      <ul className="flow">
        {REVIEW_FLOW.map((step) => (
          <li key={step.title}>
            <div className="ft">{step.title}</div>
            <div className="fs">{step.sub}</div>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 16 }}>
        {readiness.canSubmit ? (
          <>
            <div className="note pine">
              <strong>Ready.</strong> Submitting releases your documents and details for review and locks the form.
              If a reviewer queries something, only that field reopens.
            </div>
            <div style={{ marginTop: 12 }}>
              <button className="btn sm" style={{ padding: '10px 18px' }} type="button" onClick={onSubmit} disabled={busy}>
                {busy ? 'Submitting…' : 'Submit for approval'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="note amber">
              <strong>{readiness.gaps.length} left{readiness.bad ? `, ${readiness.bad} to fix` : ''}.</strong> Jump to any of them.
            </div>
            <div className="gaps">
              {readiness.gaps.map((g) => (
                <a key={g.id} onClick={jump(g.id)}>{g.name}</a>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default SubmitSection;
