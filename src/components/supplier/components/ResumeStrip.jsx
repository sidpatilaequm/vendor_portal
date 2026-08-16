import React, { useState } from 'react';

// Ported from become-a-supplier/app/become-a-supplier/components/ResumeStrip.tsx
const ResumeStrip = ({ onResume, message }) => {
  const [code, setCode] = useState('');

  return (
    <div className="resume">
      <div>
        <div className="rt">Already started?</div>
        <div className="xs muted">Enter the code from your email.</div>
      </div>
      <input placeholder="ABCD1234" maxLength={13} value={code} onChange={(e) => setCode(e.target.value)} />
      <button className="btn ghost sm" type="button" onClick={() => onResume(code)}>Resume</button>
      {message && <span className="sm" style={{ color: message.ok ? 'var(--pine)' : 'var(--red)' }}>{message.text}</span>}
    </div>
  );
};

export default ResumeStrip;
