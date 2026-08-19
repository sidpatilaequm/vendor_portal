import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../common/Input';
import Button from '../common/Button';

// Single sign-in form for every account type — the backend resolves the role from the
// credentials themselves (see AuthContext.login), so there's nothing for the person signing in
// to pre-select here. Whichever dashboard their account actually belongs to is where they land.
const LoginForm = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(false);

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
      </div>
    </div>
  );
};

export default LoginForm;
