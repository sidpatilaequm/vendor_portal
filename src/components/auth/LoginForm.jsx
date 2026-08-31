import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../common/Input';
import Button from '../common/Button';

// What MicrosoftSsoController appends to /login?sso_error=... on failure — kept here rather than
// in AuthContext since it's purely about how this page explains a redirect that already happened,
// not session state.
const SSO_ERROR_MESSAGES = {
  not_configured: 'Microsoft sign-in isn’t set up yet — ask an admin to add it under System Settings.',
  cancelled: 'Microsoft sign-in was cancelled.',
  exchange_failed: 'Could not complete Microsoft sign-in — try again.',
  no_account: 'No account here matches that Microsoft sign-in — ask an admin to add you first.',
  account_disabled: 'This account has been deactivated.',
  missing_token: 'Microsoft sign-in did not complete — try again.',
  session_failed: 'Could not complete Microsoft sign-in — try again.',
};

// Single sign-in form for every account type — the backend resolves the role from the
// credentials themselves (see AuthContext.login), so there's nothing for the person signing in
// to pre-select here. Whichever dashboard their account actually belongs to is where they land.
const LoginForm = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const { login, loading, showAlert } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(false);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('sso_error');
    if (reason) {
      showAlert(SSO_ERROR_MESSAGES[reason] || 'Microsoft sign-in did not complete.', 'danger');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      if (onLoginSuccess) {
        onLoginSuccess(result.redirectUrl);
      } else {
        navigate(result.redirectUrl || '/dashboard');
      }
    }
  };

  return (
    <div className="form-card card fade-in-slide">
      <div className="form-card-header">
        <h2 className="form-card-title">Sign in</h2>
        <p className="form-card-subtitle">Access your account</p>
      </div>
      <div className="form-card-body">
        <form onSubmit={handleSubmit}>
          <Input
            label="Work email"
            id="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            id="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="mb-4 form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id="keepSignedIn"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
            />
            <label className="form-check-label text-muted small" htmlFor="keepSignedIn">
              Keep me signed in
            </label>
          </div>

          <Button type="submit" loading={loading} className="w-100">
            Sign in
          </Button>
        </form>

        <div className="divider-text">or</div>

        {/* Plain navigation, not an axios call — this has to leave the SPA and hit Microsoft's
            real login page, then come back to /auth/callback (see App.jsx / SsoCallback.jsx). */}
        <a href="/api/auth/microsoft/authorize" className="btn-outline-green w-100 d-flex align-items-center justify-content-center gap-2 text-decoration-none">
          <i className="fa-brands fa-microsoft"></i>
          Sign in with Microsoft
        </a>
      </div>
    </div>
  );
};

export default LoginForm;
