import React, { useEffect } from 'react';

const Alert = ({ type = 'danger', message, onClose }) => {
  if (!message) return null;

  const iconMap = {
    danger: 'fa-exclamation-circle',
    success: 'fa-check-circle',
    warning: 'fa-triangle-exclamation',
    info: 'fa-info-circle'
  };

  const iconClass = iconMap[type] || 'fa-info-circle';

  useEffect(() => {
    if (message && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  return (
    <div 
      className={`alert alert-${type} alert-dismissible fade show shadow-lg fade-in-slide`} 
      role="alert"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        minWidth: '300px',
        maxWidth: '450px',
        border: 'none',
        borderRadius: '12px'
      }}
    >
      <div className="d-flex align-items-center gap-2">
        <i className={`fas ${iconClass} fs-5`}></i>
        <div className="fw-medium">{message}</div>
      </div>
      {onClose && (
        <button 
          type="button" 
          className="btn-close" 
          onClick={onClose} 
          aria-label="Close"
        ></button>
      )}
    </div>
  );
};

export default Alert;
