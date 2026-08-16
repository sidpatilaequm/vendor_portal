import React from 'react';

// Ported from become-a-supplier/app/become-a-supplier/components/ContactCard.tsx
const ContactCard = ({ n, isPrimary, values, errors, onFieldChange, onSetPrimary, onRemove }) => {
  const prefix = `c${n}`;
  return (
    <div className={'contact' + (isPrimary ? ' primary' : '')}>
      <div className="ch">
        <div className="cn">{n === 1 ? 'Contact person' : 'Second contact'}</div>
        <div className="cright">
          {isPrimary && <span className="pill p-pine">All emails go here</span>}
          <label className="radio">
            <input type="radio" name="primaryContact" checked={isPrimary} onChange={onSetPrimary} />
            <span>Primary</span>
          </label>
          {n === 2 && onRemove && (
            <button className="btn ghost sm" type="button" onClick={onRemove}>Remove</button>
          )}
        </div>
      </div>
      <div className="grid g2">
        <div>
          <label htmlFor={`${prefix}_name`}>Name <span className="req">*</span></label>
          <input id={`${prefix}_name`} value={values.name} onChange={(e) => onFieldChange(`${prefix}_name`, e.target.value)} />
          <div className="emsg" />
        </div>
        <div>
          <label htmlFor={`${prefix}_role`}>Designation <span className="req">*</span></label>
          <input id={`${prefix}_role`} value={values.role} onChange={(e) => onFieldChange(`${prefix}_role`, e.target.value)} />
          <div className="emsg" />
        </div>
        <div>
          <label htmlFor={`${prefix}_email`}>Email <span className="req">*</span></label>
          <input
            id={`${prefix}_email`}
            type="email"
            className={errors[`${prefix}_email`] ? 'err' : ''}
            value={values.email}
            onChange={(e) => onFieldChange(`${prefix}_email`, e.target.value)}
          />
          <div className={'emsg' + (errors[`${prefix}_email`] ? ' on' : '')}>{errors[`${prefix}_email`]}</div>
        </div>
        <div>
          <label htmlFor={`${prefix}_phone`}>Contact number <span className="req">*</span></label>
          <input
            id={`${prefix}_phone`}
            className={'mono' + (errors[`${prefix}_phone`] ? ' err' : '')}
            maxLength={10}
            value={values.phone}
            onChange={(e) => onFieldChange(`${prefix}_phone`, e.target.value)}
          />
          <div className={'emsg' + (errors[`${prefix}_phone`] ? ' on' : '')}>{errors[`${prefix}_phone`]}</div>
        </div>
      </div>
    </div>
  );
};

export default ContactCard;
