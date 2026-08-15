import React, { useRef } from 'react';
import Input from '../common/Input';
import Button from '../common/Button';

const STATUS_LABEL = {
  idle: null,
  reading: 'Reading…',
  read: 'Read',
  verifying: 'Verifying…',
  verified: 'Verified',
  error: 'Could not verify',
};

const STATUS_CLASS = {
  read: 'text-emerald',
  verified: 'text-emerald',
  error: 'text-danger',
  verifying: 'text-muted',
  reading: 'text-muted',
};

// One document's upload + OCR'd fields + verify status, for the Become a Supplier page.
// Mirrors become-a-supplier's DocCard/DocField behavior (OCR-filled fields are read-only —
// fix a misread via Replace, not by typing over it) using vendor_portal's own Input/Button.
const DocUploadCard = ({ doc, state, onUpload, onFieldChange, onVerify, onRemove }) => {
  const fileInputRef = useRef(null);
  const values = state?.values || {};
  const source = state?.source || {}; // per-field: 'ocr' | 'you'
  const uncertain = state?.uncertain || [];

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (file) onUpload(doc.id, file);
    e.target.value = '';
  };

  return (
    <div className="card mb-3">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div>
            <h6 className="mb-0">
              {doc.name} {doc.req && <span className="text-danger">*</span>}
            </h6>
            <small className="text-muted">{doc.gives}</small>
          </div>
          {STATUS_LABEL[state?.status] && (
            <small className={STATUS_CLASS[state?.status] || 'text-muted'}>{STATUS_LABEL[state.status]}</small>
          )}
        </div>

        {!state?.fileName ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="d-none"
              onChange={handleFilePick}
            />
            <Button variant="outline-green" onClick={() => fileInputRef.current?.click()}>
              <i className="fas fa-upload me-1"></i> Upload
            </Button>
          </>
        ) : (
          <>
            <div className="d-flex align-items-center gap-2 mb-3">
              <i className="far fa-file-pdf text-emerald"></i>
              <span className="small">{state.fileName}</span>
              <Button
                variant="outline-green"
                className="btn-sm ms-auto"
                onClick={() => fileInputRef.current?.click()}
              >
                Replace
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="d-none"
                onChange={handleFilePick}
              />
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onRemove(doc.id)}>
                Remove
              </button>
            </div>

            {doc.fields.map((f) => (
              <Input
                key={f.k}
                label={f.label + (uncertain.includes(f.k) ? ' — reads disagreed, please check' : '')}
                id={`${doc.id}-${f.k}`}
                type={f.type || 'text'}
                value={values[f.k] || ''}
                readOnly={source[f.k] === 'ocr'}
                onChange={(e) => onFieldChange(doc.id, f.k, e.target.value)}
                className={f.mono ? 'font-monospace' : ''}
                style={f.upper ? { textTransform: 'uppercase' } : undefined}
              />
            ))}

            {doc.verifyKind && (
              <Button
                variant="outline-green"
                onClick={() => onVerify(doc.id)}
                loading={state?.status === 'verifying'}
                disabled={state?.status === 'verified'}
              >
                {state?.status === 'verified' ? 'Verified' : 'Verify'}
              </Button>
            )}

            {state?.verifyMessage && (
              <div className={`small mt-2 ${state.status === 'verified' ? 'text-emerald' : 'text-danger'}`}>
                {state.verifyMessage}
              </div>
            )}
            {state?.verifyDetails?.length > 0 && (
              <ul className="small text-muted mt-1 mb-0">
                {state.verifyDetails.map((d, i) => (
                  <li key={i}>
                    {d.label}: {d.value}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DocUploadCard;
