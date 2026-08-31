import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Lands here after MicrosoftSsoController redirects the browser back with ?token=... — trades
// that token for a real session (see AuthContext.loginWithToken) and continues on to whichever
// dashboard the account belongs to, same as a password login would.
const SsoCallback = () => {
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      navigate('/login?sso_error=missing_token', { replace: true });
      return;
    }

    loginWithToken(token).then((result) => {
      navigate(result.success ? result.redirectUrl : '/login?sso_error=session_failed', { replace: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="auth-container">
      <div className="auth-content" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-muted">Signing you in…</p>
      </div>
    </div>
  );
};

export default SsoCallback;
