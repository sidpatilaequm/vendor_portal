import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';

const LoginForm = ({ onLoginSuccess, initialLoginType }) => {
  const navigate = useNavigate();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginType, setLoginType] = useState(initialLoginType || 'vendor');
  const [keepSignedIn, setKeepSignedIn] = useState(false);

  useEffect(() => {
    if (initialLoginType) {
      setLoginType(initialLoginType);
    }
  }, [initialLoginType]);

  const accountOptions = [
    { value: 'vendor',   label: 'Vendor Portal' },
    { value: 'employee', label: 'Employee (Requester / Purchase Dept)' },
    { value: 'standard', label: 'Administrator' }
  ];

  const getTitle = () => {
    if (loginType === 'vendor')   return 'Vendor Sign in';
    if (loginType === 'employee') return 'Employee Sign in';
    return 'Administrator Sign in';
  };

  const getSubtitle = () => {
    if (loginType === 'vendor')   return 'Access your secure supplier portal dashboard';
    if (loginType === 'employee') return 'Create purchase requisitions and track approvals';
    return 'Access the global procurement & administrative engine';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password, loginType);
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
        <h2 className="form-card-title">{getTitle()}</h2>
        <p className="form-card-subtitle">{getSubtitle()}</p>
      </div>
      <div className="form-card-body">
        <form onSubmit={handleSubmit}>
          {!initialLoginType && (
            <Select
              label="Account Type"
              id="loginType"
              options={accountOptions}
              value={loginType}
              onChange={(e) => setLoginType(e.target.value)}
            />
          )}

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
