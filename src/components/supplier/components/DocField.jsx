import React from 'react';

// Ported from become-a-supplier/app/become-a-supplier/components/DocField.tsx
const DocFieldInput = ({ field, value, source, error, onChange }) => {
  const isAuto = source !== undefined && source !== 'you';
  // Cancelled cheque fields stay editable even when OCR-read — bank details are exactly
  // the kind of thing worth letting the applicant correct directly rather than forcing a
  // re-upload via Replace.
  const isReadOnly = isAuto && !field.editable;
  const classNames = [field.mono ? 'mono' : '', isAuto ? 'auto' : '', error ? 'err' : ''].filter(Boolean).join(' ');
  const style = field.upper ? { textTransform: 'uppercase' } : undefined;

  return (
    <div className={field.w || ''}>
      <div className="lab">
        <label htmlFor={field.k}>
          {field.label}
          {field.req && <span className="req"> *</span>}
        </label>
        {source && (
          <span>
            <span className={'pill ' + (source === 'you' ? 'p-grey' : 'p-pine')}>{source === 'you' ? 'you' : 'read'}</span>
          </span>
        )}
      </div>
      {field.area ? (
        <textarea id={field.k} className={classNames} value={value} readOnly={isReadOnly} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          id={field.k}
          className={classNames}
          type={field.type || 'text'}
          value={value}
          style={style}
          readOnly={isReadOnly}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <div className={'emsg' + (error ? ' on' : '')}>{error}</div>
    </div>
  );
};

export default DocFieldInput;
