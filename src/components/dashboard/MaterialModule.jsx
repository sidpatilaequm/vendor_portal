import React from 'react';

const MaterialModule = ({ onBack }) => {
  return (
    <div className="container-fluid p-4">
      {onBack && (
        <div 
          onClick={onBack} 
          className="d-inline-flex align-items-center text-muted mb-3 cursor-pointer" 
          style={{ cursor: 'pointer', transition: 'color 0.2s ease' }}
        >
          <i className="fas fa-arrow-left me-2"></i>
          <span className="fw-medium">Back to Reports</span>
        </div>
      )}
      <h2 className="mb-4">Material Module</h2>
      <div className="card shadow-sm border-0">
        <div className="card-body text-center p-5">
          <i className="fas fa-box text-muted mb-3" style={{ fontSize: '3rem' }}></i>
          <h5 className="text-muted">Material Management</h5>
          <p className="text-muted mb-0">This module is under development. Soon you will be able to manage materials here.</p>
        </div>
      </div>
    </div>
  );
};

export default MaterialModule;
