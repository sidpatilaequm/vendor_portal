import React from 'react';

const Button = ({
  children,
  type = 'button',
  variant = 'green', // 'green', 'outline-green', 'secondary'
  loading = false,
  disabled = false,
  onClick,
  className = '',
  ...props
}) => {
  const baseClass = variant === 'green' ? 'btn-green-submit' : 'btn-outline-green';
  const disabledState = disabled || loading;

  return (
    <button
      type={type}
      className={`${baseClass} ${className}`}
      disabled={disabledState}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <>
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
          Processing...
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default Button;
