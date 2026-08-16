import React, { useRef, useState } from 'react';
import { fmtSize } from '../lib/utils';
import DocFieldInput from './DocField';

// Ported from become-a-supplier/app/become-a-supplier/components/DocCard.tsx
const DocCard = ({ doc, file, fields, src, errors, onFile, onRemove, onFieldChange }) => {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const status = file?.status;
  const cardClass = ['doc', status === 'read' ? 'read' : '', status === 'reading' ? 'reading' : '', dragOver ? 'over' : '']
    .filter(Boolean)
    .join(' ');
  const verified = status === 'read' && file?.verifyStatus === 'verified';

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  const ext = file ? (file.name.split('.').pop() || 'file').toUpperCase().slice(0, 4) : '';

  return (
    <div
      className={cardClass}
      onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
      onDrop={handleDrop}
      id={`doc_${doc.id}`}
    >
      <div className="dh">
        <div>
          <div className="dn">{doc.name}</div>
          <div className="dm">{doc.gives}</div>
        </div>
        <span className={'pill ' + (status === 'read' ? (verified ? 'p-pine' : 'p-grey') : doc.req ? 'p-red' : 'p-grey')}>
          {status === 'read' ? (verified ? 'Verified' : 'Uploaded') : doc.req ? 'Needed' : 'If you have it'}
        </span>
      </div>

      {!file && (
        <label className="drop" tabIndex={0}>
          <span>Choose a file, or drop it here</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
          />
        </label>
      )}

      {file && status === 'reading' && (
        <div className="filerow">
          <span className="spin" />
          <span className="sm">Reading {file.name}…</span>
        </div>
      )}

      {file && status === 'read' && (
        <div className="filerow">
          <div className="fi">{ext}</div>
          <div>
            <div className="fn">{file.name}</div>
            <div className="fm">{fmtSize(file.size)} · uploaded {file.at}</div>
          </div>
          <div className="acts">
            <button className="btn ghost sm" type="button" onClick={() => file.url && window.open(file.url, '_blank', 'noopener')}>View</button>
            <button className="btn ghost sm" type="button" onClick={() => inputRef.current?.click()}>Replace</button>
            <button className="btn ghost sm" type="button" onClick={onRemove}>Remove</button>
          </div>
          <input
            ref={inputRef}
            type="file"
            className="hide"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
          />
        </div>
      )}

      {status === 'read' && (
        <div>
          <div className="grid g2">
            {doc.fields.map((f) => (
              <DocFieldInput
                key={f.k}
                field={f}
                value={fields[f.k] || ''}
                source={src[f.k]}
                error={errors[f.k]}
                onChange={(v) => onFieldChange(f.k, v)}
              />
            ))}
          </div>
          {doc.verifyKind ? (
            <div className="fieldnote">
              {file?.verifyStatus === 'checking' && (<><span className="spin" /> Checking against the official record…</>)}
              {file?.verifyStatus === 'verified' && (
                <>
                  <span className="pill p-pine">Verified — {file.verifyMessage}</span>
                  {!!file.verifyDetails?.length && (
                    <div className="grid g2" style={{ marginTop: 8 }}>
                      {file.verifyDetails.map((d) => (
                        <div key={d.label}>
                          <div className="sm" style={{ fontWeight: 600 }}>{d.label}</div>
                          <div className="sm">{d.value || '—'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              {file?.verifyStatus === 'error' && <span className="pill p-red">Could not verify — {file.verifyMessage}</span>}
              {!file?.verifyStatus && 'Read automatically — if this doesn\'t match the document, click Replace above to re-upload.'}
            </div>
          ) : (
            <div className="fieldnote">Read automatically — if this doesn't match the document, click Replace above to re-upload.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default DocCard;
