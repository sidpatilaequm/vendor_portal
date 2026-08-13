import React from 'react';

const Select = ({
  label,
  id,
  options = [], // [{ value: '...', label: '...' }]
  value,
  onChange,
  className = '',
  ...props
}) => {
  return (
    <div className={`mb-3 ${className}`}>
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
        </label>
      )}
      <select
        className="form-select"
        id={id}
        value={value}
        onChange={onChange}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Select;
