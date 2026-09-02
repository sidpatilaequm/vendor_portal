import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [selectedCompanyCode, setSelectedCompanyCode] = useState(null);
  const [companiesList, setCompaniesList] = useState([]);

  useEffect(() => {
    // Restore session on mount
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user_data');
    if (token && user) {
      setAuthToken(token);
      setCurrentUser(JSON.parse(user));
    }
    const storedCompanyCode = localStorage.getItem('selected_company_code');
    if (storedCompanyCode) {
      setSelectedCompanyCode(storedCompanyCode);
    } else {
      setSelectedCompanyCode('1000');
    }

    // Fetch dynamic companies list
    axios.get('/api/mm/companies')
      .then(res => {
        if (res.data && res.data.companies) {
          setCompaniesList(res.data.companies);
        }
      })
      .catch(err => console.error("Failed to load companies list:", err));
  }, []);

  const showAlert = (message, type = 'danger') => {
    setAlert({ type, message });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearAlert = () => setAlert(null);

  // Shared by every way a session can start (password login, Microsoft SSO callback, ...): writes
  // the token/user blob to localStorage + state, and computes which dashboard it belongs on. The
  // role -> route mapping is computed here rather than trusted from the server, since the server
  // can't know in advance which of those routing buckets the caller's UI will land them in — kept
  // in one place so a new sign-in path can't drift from RouteGuards'/the "*" fallback's own
  // categorization in App.jsx.
  const applySession = (data) => {
    const vId = data.permissions?.vendorId || data.vendorId || data.vendor_id || data.companyId || data.company_id || data.userId || data.id;

    const userData = {
      ...data,
      id: data.id || data.userId,
      vendorId: vId,
      vendor_id: vId,
      companyId: vId,
      company_id: vId,
      role: data.role || data.authName || 'EMPLOYEE'
    };

    localStorage.setItem('auth_token', data.token);
    setAuthToken(data.token);
    localStorage.setItem('user_data', JSON.stringify(userData));
    setCurrentUser(userData);

    const role = String(userData.role).toUpperCase();
    const redirectUrl = role === 'VENDOR'
      ? '/vendor/dashboard'
      : (role === 'EMPLOYEE' || role === 'PURCHASE_DEPT')
        ? '/employee/dashboard'
        : '/admin/dashboard';

    return redirectUrl;
  };

  const updateSelectedCompanyCode = (code) => {
    if (code) {
      localStorage.setItem('selected_company_code', code);
    } else {
      localStorage.removeItem('selected_company_code');
    }
    setSelectedCompanyCode(code);
  };

  // Role comes back from the credentials themselves (data.authName, via the super_admin ->
  // user_details/user_authentication/authorization lookup chain AuthController.login already
  // does server-side) — there's no separate "which kind of account" choice for the caller to
  // make, and no separate endpoint per role either; /api/auth/login/ handles vendor, employee
  // and administrator credentials all the same way.
  const login = async (email, password) => {
    setLoading(true);
    setAlert(null);
    try {
      const response = await axios.post('/api/auth/login/', {
        email,
        password
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      const data = response.data;
      if (response.status === 200 && data.token) {
        const redirectUrl = applySession(data);
        showAlert('Login successful! Redirecting...', 'success');
        return { success: true, redirectUrl };
      } else {
        showAlert(data.error || 'Login failed. Please verify credentials.', 'danger');
        return { success: false };
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'Could not connect to the authentication server.';
      showAlert(errMsg, 'danger');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  // Lands here after the Microsoft SSO redirect round trip (see SsoCallback.jsx) — the backend
  // already turned "signed in with Microsoft" into a plain JWT for an existing account, this just
  // needs to trade that token for the same rich session payload /api/auth/login/ would have
  // returned, via /api/users/session (JwtRequestFilter already accepts the bearer token; that
  // endpoint just echoes back who it belongs to, same shape as a password login).
  const loginWithToken = async (token) => {
    setLoading(true);
    setAlert(null);
    try {
      const response = await axios.get('/api/users/session', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // /session mints its own fresh token for the same account rather than echoing the one
      // passed in — response.data.token is that one, already the right shape for applySession.
      const redirectUrl = applySession(response.data);
      showAlert('Signed in with Microsoft. Redirecting...', 'success');
      return { success: true, redirectUrl };
    } catch (err) {
      console.error(err);
      showAlert('Could not complete Microsoft sign-in.', 'danger');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const registerRequest = async (formData, adminId) => {
    setLoading(true);
    setAlert(null);
    const payload = {
      vendor_name: formData.vendorName,
      address: formData.address,
      contact_name: formData.contactName,
      designation: formData.designation,
      email: formData.email,
      phone: formData.phone,
      token: formData.token
    };

    if (adminId) {
      payload.admin_id = adminId;
    }

    try {
      const response = await axios.post('/vendor/register-request/', payload, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = response.data;
      if (response.status === 200 && data.status === 'success') {
        const statusText = formData.token ? "REGISTRATION_SUBMITTED" : "PENDING_APPROVAL";
        showAlert(`Your Supplier registration request has been submitted successfully! Status is set to ${statusText}. Our procurement team will review it.`, 'success');
        return { success: true };
      } else {
        showAlert(data.error || 'Submission failed. Please check the fields.', 'danger');
        return { success: false };
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || 'A network error occurred. Please try again.';
      showAlert(errMsg, 'danger');
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      setAuthToken('');
      setCurrentUser(null);
      setSelectedCompanyCode(null);
      localStorage.removeItem('selected_company_code');
      await axios.get('/logout/');
    } catch (err) {
      console.error("Django logout error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      authToken,
      loading,
      alert,
      setAlert,
      showAlert,
      clearAlert,
      login,
      loginWithToken,
      registerRequest,
      logout,
      selectedCompanyCode,
      updateSelectedCompanyCode,
      companiesList
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
