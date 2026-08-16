import React, { useState } from 'react';

// Ported from become-a-supplier/app/become-a-supplier/components/TopBar.tsx
// "Ankit Aerospace" (the prototype's fictional demo company) is replaced with
// this system's real brand, Aequm.
const TopBar = ({ code, email, savedAt, dirty, submitted, onSave }) => {
  const [copied, setCopied] = useState(false);

  const saveState = submitted ? 'Submitted' : dirty ? (code ? 'Unsaved changes' : 'Not saved yet') : savedAt || 'Not saved yet';

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard access denied — silently ignore
    }
  };

  return (
    <div className="bar">
      <div className="bar-in">
        <div className="brand">
          <div className="mark">A</div>
          <div>
            <div className="b1">Become a supplier</div>
            <div className="b2">Aequm</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {code && (
            <div className="codechip">
              <div>
                <div className="cl">Your code</div>
                <div className="cv">{code}</div>
                <div className="ce">{email ? 'emailed to ' + email : ''}</div>
              </div>
              <button className="btn ghost sm" onClick={copyCode} type="button">{copied ? 'Copied' : 'Copy'}</button>
            </div>
          )}
          <span className="sm muted">{saveState}</span>
          <button className="btn ghost sm" onClick={onSave} type="button" disabled={submitted}>Save draft</button>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
