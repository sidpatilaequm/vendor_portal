import React from 'react';
import { SECTIONS as ALL_SECTIONS } from '../data';

// Ported from become-a-supplier/app/become-a-supplier/components/Rail.tsx
const Rail = ({ readiness, submitted, activeSection, onSubmit, onSaveDraft, busy, sections = ALL_SECTIONS }) => {
  const leftLabel = readiness.canSubmit
    ? 'All done. You can submit.'
    : readiness.bad
    ? `${readiness.total - readiness.filled} left, ${readiness.bad} to fix`
    : readiness.total
    ? `${readiness.total - readiness.filled} left`
    : 'Start by uploading your documents';

  const pctLabel = readiness.total === 0 ? 'nothing yet' : `${readiness.filled} of ${readiness.total} done`;

  const jump = (id) => (e) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <aside className="rail">
      <div className="gate">
        <div className="eyebrow">Ready to submit</div>
        <div className="pct">{readiness.pct}%</div>
        <div className="pcl">{pctLabel}</div>
        <div className="meter"><i style={{ width: readiness.pct + '%' }} /></div>
        <div className={'leftm' + (readiness.canSubmit ? ' ok' : '')}>{leftLabel}</div>
      </div>

      <nav className="steps" aria-label="Sections">
        {sections.map((sec) => {
          const total = sec.id === 'sec-docs' ? readiness.docsTotal : sec.id === 'sec-you' ? readiness.youTotal : sec.id === 'sec-questions' ? readiness.dynamicTotal : 0;
          const filledCount = sec.id === 'sec-docs' ? readiness.docsFilled : sec.id === 'sec-you' ? readiness.youFilled : sec.id === 'sec-questions' ? readiness.dynamicFilled : 0;
          const isFile = sec.id === 'sec-file';
          const status = isFile
            ? (readiness.filesCount ? 'done' : '')
            : total && filledCount === total
            ? 'done'
            : filledCount
            ? 'part'
            : '';
          const cnt = isFile ? (readiness.filesCount ? readiness.filesCount + ' files' : '—') : total ? `${filledCount}/${total}` : '—';
          return (
            <a key={sec.id} href={`#${sec.id}`} onClick={jump(sec.id)} className={activeSection === sec.id ? 'cur' : undefined}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className={'dot' + (status ? ' ' + status : '')} />
                {sec.name}
              </span>
              <span className="cnt">{cnt}</span>
            </a>
          );
        })}
      </nav>

      <div className="railbtns">
        <button className="btn" disabled={!readiness.canSubmit || busy} onClick={onSubmit} type="button">
          {busy ? 'Submitting…' : 'Submit for approval'}
        </button>
        <button className="btn ghost" onClick={onSaveDraft} disabled={submitted} type="button">Save draft</button>
      </div>
      <p className="xs muted" style={{ marginTop: 9 }}>
        We email your code so you can come back to it. Files stay attached to the draft until you submit.
      </p>
    </aside>
  );
};

export default Rail;
