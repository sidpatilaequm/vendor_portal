import React, { useState } from 'react';

const Input = ({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  readOnly = false,
  className = '',
  rows, // If rows is passed, render a textarea instead
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`mb-3 ${className}`}>
      {label && (
        <label htmlFor={id} className="form-label">
          {label}
        </label>
      )}
      
      {rows ? (
        <textarea
          className="form-control"
          id={id}
          rows={rows}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          required={required}
          readOnly={readOnly}
          {...props}
        />
      ) : (
        <div className={isPassword ? 'password-container' : undefined}>
          <input
            type={inputType}
            className={`form-control ${isPassword ? 'pe-5' : ''}`}
            id={id}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            required={required}
            readOnly={readOnly}
            {...props}
          />
          {isPassword && (
            <button
              className="password-toggle-btn"
              type="button"
              onClick={() => setShowPassword(!showPassword)}
            >
              <i className={`far ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default Input;
