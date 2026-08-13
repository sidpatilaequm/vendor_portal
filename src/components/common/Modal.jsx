import React, { useEffect } from 'react';
import Button from './Button';

const Modal = ({
  show,
  title,
  children,
  onClose,
  onSubmit,
  submitText = 'Submit',
  cancelText = 'Cancel',
  loading = false,
  maxWidth = '500px'
}) => {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (show) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [show]);

  if (!show) return null;

  return (
    <div className="custom-modal-overlay" onClick={onClose}>
      <div 
        className="custom-modal-content" 
        style={{ maxWidth }} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="custom-modal-header">
          <h5 className="custom-modal-title">{title}</h5>
          <button 
            type="button" 
            className="custom-modal-close-btn" 
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        
        <div className="custom-modal-body">
          {children}
        </div>
        
        {(onClose || onSubmit) && (
          <div className="custom-modal-footer">
            {onClose && (
              <Button 
                variant="outline-green" 
                onClick={onClose}
                disabled={loading}
              >
                {cancelText}
              </Button>
            )}
            {onSubmit && (
              <Button 
                variant="green" 
                onClick={onSubmit}
                loading={loading}
              >
                {submitText}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
