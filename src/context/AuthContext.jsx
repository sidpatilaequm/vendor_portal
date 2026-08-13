import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    // Restore session on mount
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('user_data');
    if (token && user) {
      setAuthToken(token);
      setCurrentUser(JSON.parse(user));
    }
  }, []);

  const showAlert = (message, type = 'danger') => {
    setAlert({ type, message });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearAlert = () => setAlert(null);

  const login = async (email, password, loginType) => {
    setLoading(true);
    setAlert(null);
    try {
      const response = await axios.post('/api/auth/login/', {
        email,
        password,
        login_type: loginType
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      const data = response.data;
      if (response.status === 200 && data.status === 'success') {
        let userData = data.user_data;

        // Normalise role — Java /api/employee/login returns 'userType', not 'role'
        if (!userData.role && userData.userType) {
          userData.role = userData.userType;
        }

        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          setAuthToken(data.token);
        }
        if (userData) {
          localStorage.setItem('user_data', JSON.stringify(userData));
          setCurrentUser(userData);
        }

        showAlert('Login successful! Redirecting...', 'success');
        return { success: true, redirectUrl: data.redirect_url };
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
      registerRequest,
      logout
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
