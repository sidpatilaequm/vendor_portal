import React, { useEffect, useRef, useState } from 'react';
import { RULES } from '../data';

// Ported from become-a-supplier/app/become-a-supplier/components/EmailDialog.tsx
const EmailDialog = ({ open, defaultValue, onClose, onConfirm }) => {
  const dialogRef = useRef(null);
  const inputRef = useRef(null);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState('');

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      setValue(defaultValue);
      setError('');
      dlg.showModal();
      setTimeout(() => inputRef.current?.focus(), 0);
    } else if (!open && dlg.open) {
      dlg.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = () => {
    if (!RULES.email.re.test(value.trim())) {
      setError('Enter a working email address — this is the only way back into your draft.');
      return;
    }
    onConfirm(value.trim());
  };

  return (
    <dialog ref={dialogRef} onClose={onClose}>
      <div className="dlg">
        <h3>Where should we send your code?</h3>
        <p className="sm muted" style={{ marginBottom: 16 }}>
          We will email you a code that brings this form back exactly as you left it. We ask once — after this,
          saving just sends to the same address.
        </p>
        <label htmlFor="dlgEmail">Email address</label>
        <input
          ref={inputRef}
          id="dlgEmail"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className={'emsg' + (error ? ' on' : '')}>{error}</div>
        <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
          <button className="btn" type="button" onClick={handleSave}>Save and email me the code</button>
          <button className="btn ghost sm" style={{ width: 'auto' }} type="button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </dialog>
  );
};

export default EmailDialog;
