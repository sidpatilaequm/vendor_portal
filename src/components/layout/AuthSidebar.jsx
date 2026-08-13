import React from 'react';

const AuthSidebar = () => {
  return (
    <div className="auth-sidebar">
      <div className="sidebar-content">
        <a href="/" className="brand-logo">
          <i className="fa-solid fa-layer-group me-2"></i>
          <span>Aequm</span>
        </a>
        
        <div className="sidebar-middle">
          <h1 className="sidebar-title">Supplier Onboarding Portal</h1>
          <p className="sidebar-desc">
            One portal for your documents, approvals and payments. Invited vendors complete onboarding in a guided wizard. Track your upload status here — we handle the rest internally.
          </p>
          
          <div className="timeline-steps">
            <div className="timeline-step">
              <div className="step-number">1</div>
              <div className="step-info">
                <div className="step-title">Receive your invite</div>
                <div className="step-desc">A secure link from our procurement team, valid for 72 hours</div>
              </div>
            </div>
            <div className="timeline-step">
              <div className="step-number">2</div>
              <div className="step-info">
                <div className="step-title">Upload documents</div>
                <div className="step-desc">PAN, GSTIN, bank proof and forms - one guided step at a time</div>
              </div>
            </div>
            <div className="timeline-step">
              <div className="step-number">3</div>
              <div className="step-info">
                <div className="step-title">We review and approve</div>
                <div className="step-desc">You'll see live upload status while approvals run internally</div>
              </div>
            </div>
            <div className="timeline-step">
              <div className="step-number">4</div>
              <div className="step-info">
                <div className="step-title">Get your vendor code</div>
                <div className="step-desc">Approval mail with your number, e.g. V-00128</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="sidebar-footer">
          &copy; 2026 aequm Procurement System. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default AuthSidebar;
