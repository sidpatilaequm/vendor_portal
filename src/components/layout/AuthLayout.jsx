import React from 'react';
import AuthSidebar from './AuthSidebar';
import Button from '../common/Button';

const AuthLayout = ({ children, screen, onToggleScreen, onLogout }) => {
  return (
    <div className="auth-container">
      {/* Onboarding Timeline Sidebar */}
      <AuthSidebar />

      {/* Main Content Area */}
      <div className="auth-content">
        {/* Navigation Bar */}
        <div className="auth-nav">
          {screen === 'login' && (
            <Button variant="outline-green" onClick={() => onToggleScreen('signup')}>
              Become a Supplier
            </Button>
          )}
          {screen === 'signup' && (
            <Button variant="outline-green" onClick={() => onToggleScreen('login')}>
              Sign In
            </Button>
          )}
          {screen === 'dashboard' && (
            <Button variant="outline-green" onClick={onLogout}>
              Logout
            </Button>
          )}
        </div>

        {/* Content Wrapper */}
        <div className="auth-form-wrapper">
          {children}
        </div>

        {/* Footer */}
        <div className="right-footer">
          Need support? <a href="#support">Contact Procurement Support</a>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
