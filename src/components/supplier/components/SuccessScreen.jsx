import React from 'react';
import { REVIEW_FLOW } from '../data';

// Ported from become-a-supplier/app/become-a-supplier/components/SuccessScreen.tsx
// The prototype's fake tracking URL (portal.ankitaerospace.in/...) is dropped —
// there's no such tracking portal here, so the note is generalised instead.
const SuccessScreen = ({ submission }) => (
  <div className="sec" style={{ borderColor: 'var(--pine)' }}>
    <div className="eyebrow">Submitted for approval</div>
    <div className="refno" style={{ margin: '8px 0 4px' }}>{submission.ref}</div>
    <p className="sm muted">Acknowledgement sent to {submission.primaryEmail} · {submission.legalName}</p>
    <p style={{ marginTop: 16 }}>
      Your {submission.files.length} documents have moved from the draft to the registration and are now with our
      procurement team. Nothing was retyped along the way, so what finance verifies is exactly what your
      certificates say.
    </p>
    <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 600, margin: '18px 0 8px' }}>
      Released with this submission
    </h3>
    <table>
      <tbody>
        {submission.files.map((f) => (
          <tr key={f.label}>
            <td>{f.label}</td>
            <td className="sm muted mono">{f.fileName} · {f.size}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <ul className="flow" style={{ marginTop: 18 }}>
      {REVIEW_FLOW.map((step, i) => (
        <li key={step.title} className={i === 0 ? 'now' : undefined}>
          <div className="ft">{step.title}</div>
          <div className="fs">{i === 0 ? 'In progress · ' + step.sub : 'Not started · ' + step.sub}</div>
        </li>
      ))}
    </ul>
    <div className="note" style={{ marginTop: 16 }}>
      Your reference number for this registration: <span className="mono">{submission.ref}</span>
    </div>
  </div>
);

export default SuccessScreen;
