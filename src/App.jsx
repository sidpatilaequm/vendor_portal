import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthLayout from './components/layout/AuthLayout';
import LoginForm from './components/auth/LoginForm';
import SignupForm from './components/auth/SignupForm';
import SsoCallback from './components/auth/SsoCallback';
import Alert from './components/common/Alert';
import DashboardLayout from './components/dashboard/DashboardLayout';
import AdminDashboardLayout from './components/dashboard/AdminDashboardLayout';
import SupplierRegistrationPage from './components/supplier/SupplierRegistrationPage';
import './App.css';

// Helper to decode JWT payload client-side without verification
const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error("Failed to decode token", e);
    return null;
  }
};

// Route wrapper that guards based on authentications and roles
const RouteGuards = ({ children, allowedRole }) => {
  const { currentUser } = useAuth();
  
  if (!currentUser) {
    if (allowedRole === 'standard') {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/vendor/login" replace />;
  }

  const role = String(currentUser.role).toUpperCase();
  
  if (allowedRole === 'standard') {
    if (role === 'VENDOR') {
      return <Navigate to="/vendor/dashboard" replace />;
    } else if (role === 'EMPLOYEE' || role === 'PURCHASE_DEPT') {
      return <Navigate to="/employee/dashboard" replace />;
    }
    return children;
  } else if (allowedRole === 'vendor') {
    if (role !== 'VENDOR') {
      return <Navigate to={(role === 'EMPLOYEE' || role === 'PURCHASE_DEPT') ? "/employee/dashboard" : "/admin/dashboard"} replace />;
    }
    return children;
  } else if (allowedRole === 'employee') {
    if (role !== 'EMPLOYEE' && role !== 'PURCHASE_DEPT') {
      return <Navigate to={role === 'VENDOR' ? "/vendor/dashboard" : "/admin/dashboard"} replace />;
    }
    return children;
  }

  return children;
};

// Handles redirecting logged in users away from login pages
const LoginRedirect = ({ children, loginType }) => {
  const { currentUser } = useAuth();

  if (currentUser) {
    const role = String(currentUser.role).toUpperCase();
    if (role === 'VENDOR') {
      return <Navigate to="/vendor/dashboard" replace />;
    } else if (role === 'EMPLOYEE' || role === 'PURCHASE_DEPT') {
      return <Navigate to="/employee/dashboard" replace />;
    } else {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return children;
};

// Main routing flow handler
const AppRoutes = () => {
  const { alert, clearAlert, currentUser, logout } = useAuth();
  const navigate = useNavigate();

  // States for SignupForm
  const [inviteToken, setInviteToken] = useState('');
  const [adminId, setAdminId] = useState('');
  const [defaultEmail, setDefaultEmail] = useState('');
  const [isEmailReadOnly, setIsEmailReadOnly] = useState(false);

  const query = new URLSearchParams(window.location.search);
  const tokenParam = query.get('token');
  const adminIdParam = query.get('adminId');

  useEffect(() => {
    if (adminIdParam) {
      setAdminId(adminIdParam);
    }
    if (tokenParam) {
      setInviteToken(tokenParam);
      const payload = decodeJwt(tokenParam);
      if (payload) {
        if (payload.email) {
          setDefaultEmail(payload.email);
          setIsEmailReadOnly(true);
        }
      }
    }
  }, [tokenParam, adminIdParam]);

  return (
    <>
      <Alert 
        type={alert?.type} 
        message={alert?.message} 
        onClose={clearAlert} 
      />

      <Routes>
        {/* Auth routes */}
        <Route 
          path="/login" 
          element={
            <LoginRedirect loginType="vendor">
              <AuthLayout screen="login" onToggleScreen={() => navigate('/become-a-supplier')} onLogout={logout}>
                <LoginForm />
              </AuthLayout>
            </LoginRedirect>
          }
        />
        <Route
          path="/become-a-supplier"
          element={<SupplierRegistrationPage />}
        />
        {/* MicrosoftSsoController redirects here with ?token=... once Microsoft sign-in
            finishes — unguarded, same reasoning as /login: the visitor isn't authenticated yet
            when they land on it. */}
        <Route
          path="/auth/callback"
          element={<SsoCallback />}
        />
        <Route
          path="/vendor/login"
          element={
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/admin/login" 
          element={
            <Navigate to="/login" replace />
          } 
        />
        <Route 
          path="/employee/login" 
          element={
            <Navigate to="/login" replace />
          } 
        />

        {/* Invitation Signup route */}
        <Route 
          path="/register" 
          element={
            <AuthLayout screen="signup" onToggleScreen={() => {}} onLogout={logout}>
              <SignupForm
                inviteToken={inviteToken}
                isEmailReadOnly={isEmailReadOnly}
                defaultEmail={defaultEmail}
                adminId={adminId}
                onSignupSuccess={() => {}}
              />
            </AuthLayout>
          } 
        />

        {/* Private Dashboard routes */}
        <Route 
          path="/vendor/dashboard" 
          element={
            <RouteGuards allowedRole="vendor">
              <DashboardLayout />
            </RouteGuards>
          } 
        />
        <Route 
          path="/employee/dashboard" 
          element={
            <RouteGuards allowedRole="employee">
              <DashboardLayout />
            </RouteGuards>
          } 
        />
        <Route 
          path="/admin/dashboard" 
          element={
            <RouteGuards allowedRole="standard">
              <AdminDashboardLayout />
            </RouteGuards>
          } 
        />

        {/* Fallbacks */}
        <Route 
          path="*" 
          element={
            currentUser ? (
              String(currentUser.role).toUpperCase() === 'VENDOR' ? (
                <Navigate to="/vendor/dashboard" replace />
              ) : (String(currentUser.role).toUpperCase() === 'EMPLOYEE' || String(currentUser.role).toUpperCase() === 'PURCHASE_DEPT') ? (
                <Navigate to="/employee/dashboard" replace />
              ) : (
                <Navigate to="/admin/dashboard" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
      </Routes>
    </>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
