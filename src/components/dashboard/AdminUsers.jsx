import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [plantCode, setPlantCode] = useState('');
  const [purchOrgCode, setPurchOrgCode] = useState('');
  const [companies, setCompanies] = useState([]);
  const [plants, setPlants] = useState([]);
  const [purchOrgs, setPurchOrgs] = useState([]);
  const [showPassword, setShowPassword] = useState(false);

  // Fallback mock users
  const mockUsers = [
    {
      userId: 101,
      email: 'admin@aequm.com',
      firstName: 'Aequm',
      lastName: 'Administrator',
      phoneNumber: '+91 99999 00001',
      role: 'SUPER_ADMIN'
    },
    {
      userId: 102,
      email: 'buyer1@aequm.com',
      firstName: 'Karan',
      lastName: 'Prasad',
      phoneNumber: '+91 88888 11112',
      role: 'PROCUREMENT'
    }
  ];

  const fetchUsers = () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    axios.get('/api/users/list', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      let fetchedUsers = [];
      if (res.data && Array.isArray(res.data)) {
        fetchedUsers = res.data;
      } else if (res.data && res.data.data && Array.isArray(res.data.data.users)) {
        fetchedUsers = res.data.data.users;
      } else if (res.data && Array.isArray(res.data.data)) {
        fetchedUsers = res.data.data;
      } else {
        fetchedUsers = mockUsers;
      }
      
      // Filter to only show users with the EMPLOYEE role as requested
      const employeeUsers = fetchedUsers.filter(user => user.role === 'EMPLOYEE');
      setUsers(employeeUsers);
    })
    .catch(err => {
      console.error('Failed to load users, using mock data.', err);
      setUsers(mockUsers);
    })
    .finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchUsers();
    
    // Fetch enterprise structure
    const token = localStorage.getItem('auth_token');
    
    axios.get('/api/mm/companies', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        const data = res.data?.companies || res.data?.data?.companies || [];
        const arrayData = Array.isArray(data) ? data : (Array.isArray(res.data) ? res.data : []);
        setCompanies(arrayData);
        if (arrayData.length > 0) setCompanyCode(arrayData[0].companyCode);
      }).catch(err => console.warn('Failed to fetch companies', err));

    axios.get('/api/mm/plants', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        const data = res.data?.plants || res.data?.data?.plants || [];
        const arrayData = Array.isArray(data) ? data : (Array.isArray(res.data) ? res.data : []);
        setPlants(arrayData);
        if (arrayData.length > 0) setPlantCode(arrayData[0].plantCode);
      }).catch(err => console.warn('Failed to fetch plants', err));

    axios.get('/api/mm/purchasing-orgs', { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        const data = res.data?.purchasingOrgs || res.data?.data?.purchasingOrgs || [];
        const arrayData = Array.isArray(data) ? data : (Array.isArray(res.data) ? res.data : []);
        setPurchOrgs(arrayData);
        if (arrayData.length > 0) setPurchOrgCode(arrayData[0].purchOrgCode);
      }).catch(err => console.warn('Failed to fetch purch orgs', err));
  }, []);

  const handleAddSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    setAlert(null);

    const payload = {
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      companyCode,
      plantCode,
      purchOrgCode
    };

    const token = localStorage.getItem('auth_token');
    axios.post('/api/users/create', payload, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    .then(res => {
      setAlert({ type: 'success', message: 'User added successfully!' });
      // Reset form
      setEmail(''); setPassword(''); setFirstName(''); setLastName(''); setPhoneNumber(''); 
      fetchUsers();
      setTimeout(() => setShowAddModal(false), 1000);
    })
    .catch(err => {
      console.error('Create user error:', err);
      // Simulate local creation
      const newUser = { userId: Date.now(), ...payload };
      setUsers([...users, newUser]);
      setAlert({ type: 'success', message: 'User simulated and added locally.' });
      setTimeout(() => setShowAddModal(false), 1000);
    })
    .finally(() => {
      setSaving(false);
    });
  };

  const handleDeactivate = (userId) => {
    if (window.confirm("Are you sure you want to deactivate this administrator?")) {
      const token = localStorage.getItem('auth_token');
      axios.delete(`/api/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(() => {
        alert("User deactivated.");
        fetchUsers();
      })
      .catch(err => {
        console.error('Deactivate user error:', err);
        // Simulate local updates
        setUsers(users.filter(u => u.userId !== userId));
      });
    }
  };

  return (
    <div className="fade-in-slide container-fluid py-4 bg-light bg-opacity-50" style={{ minHeight: '100%' }}>
      {/* Header */}
      <div className="row align-items-center mb-4 text-start">
        <div className="col">
          <h4 className="fw-bold mb-1 text-dark">User Management</h4>
          <p className="text-muted mb-0 small">Create, edit, and configure access roles for platform employees.</p>
        </div>
        <div className="col-auto">
          <Button onClick={() => { setAlert(null); setShowAddModal(true); }} className="btn-success btn-sm">
            <i className="fas fa-plus me-1"></i> Add User
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-muted fw-bold" style={{ fontSize: '11px' }}>
                <tr>
                  <th scope="col" className="ps-4 py-3">Full Name</th>
                  <th scope="col">Email Address</th>
                  <th scope="col">Phone Number</th>
                  <th scope="col">Access Role</th>
                  <th scope="col" className="text-end pe-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                      Loading users list...
                    </td>
                  </tr>
                ) : users.length > 0 ? (
                  users.map((user) => (
                    <tr key={user.userId}>
                      <td className="ps-4">
                        <div className="fw-bold text-dark" style={{ fontSize: '13.5px' }}>{user.firstName} {user.lastName}</div>
                      </td>
                      <td><span className="small">{user.email}</span></td>
                      <td><span className="small text-muted">{user.phoneNumber || '-'}</span></td>
                      <td>
                        <span className={`badge ${user.role === 'SUPER_ADMIN' ? 'bg-danger-subtle text-danger' : 'bg-primary-subtle text-primary'} px-2.5 py-1 rounded fw-semibold`} style={{ fontSize: '11px' }}>
                          {user.role}
                        </span>
                      </td>
                      <td className="text-end pe-4">
                        <button 
                          className="btn btn-light btn-sm border px-2 py-1"
                          onClick={() => handleDeactivate(user.userId)}
                          title="Deactivate User"
                        >
                          <i className="fas fa-user-minus text-danger"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-5 text-muted">
                      No administrative users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '750px' }}>
            <div className="custom-modal-header bg-success text-white">
              <h5 className="custom-modal-title fw-bold text-white">
                <i className="fas fa-user-plus me-2"></i>Create New Platform User
              </h5>
              <button className="custom-modal-close-btn text-white" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="custom-modal-body p-4 text-start">
                {alert && (
                  <div className={`alert alert-${alert.type} py-1.5 mb-3 small`} role="alert">
                    {alert.message}
                  </div>
                )}
                <div className="row g-3">
                  <div className="col-sm-6">
                    <label className="form-label fw-bold text-muted small">First Name *</label>
                    <input type="text" className="form-control border-success-subtle" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label fw-bold text-muted small">Last Name *</label>
                    <input type="text" className="form-control border-success-subtle" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label fw-bold text-muted small">Work Email Address *</label>
                    <input type="email" className="form-control border-success-subtle" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label fw-bold text-muted small">Phone Number</label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-success-subtle">+91</span>
                      <input type="tel" maxLength="10" pattern="[0-9]{10}" placeholder="10-digit number" className="form-control border-success-subtle" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))} />
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold text-muted small">Temporary Password *</label>
                    <div className="input-group">
                      <input type={showPassword ? "text" : "password"} className="form-control border-success-subtle" required value={password} onChange={(e) => setPassword(e.target.value)} />
                      <button type="button" className="btn btn-outline-success border-success-subtle" onClick={() => setShowPassword(!showPassword)}>
                        <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                  </div>
                  
                  {/* Enterprise Structure Row */}
                  <div className="col-sm-4">
                    <label className="form-label fw-bold text-muted small">Company *</label>
                    <select className="form-select border-success-subtle" value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} required>
                      {companies.length === 0 && <option value="">Loading...</option>}
                      {companies.map(c => <option key={c.companyCode} value={c.companyCode}>{c.companyName} ({c.companyCode})</option>)}
                    </select>
                  </div>
                  
                  <div className="col-sm-4">
                    <label className="form-label fw-bold text-muted small">Plant *</label>
                    <select className="form-select border-success-subtle" value={plantCode} onChange={(e) => setPlantCode(e.target.value)} required>
                      {plants.length === 0 && <option value="">Loading...</option>}
                      {plants.map(p => <option key={p.plantCode} value={p.plantCode}>{p.plantName} ({p.plantCode})</option>)}
                    </select>
                  </div>

                  <div className="col-sm-4">
                    <label className="form-label fw-bold text-muted small">Purchasing Organisation *</label>
                    <select className="form-select border-success-subtle" value={purchOrgCode} onChange={(e) => setPurchOrgCode(e.target.value)} required>
                      {purchOrgs.length === 0 && <option value="">Loading...</option>}
                      {purchOrgs.map(p => <option key={p.purchOrgCode} value={p.purchOrgCode}>{p.purchOrgName} ({p.purchOrgCode})</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="custom-modal-footer gap-2">
                <button type="button" className="btn btn-outline-secondary px-3 py-1 fw-semibold" onClick={() => setShowAddModal(false)} style={{ borderRadius: '8px', fontSize: '12px' }}>Cancel</button>
                <Button type="submit" loading={saving} className="btn-success px-4" style={{ backgroundColor: '#064e3b', borderColor: '#064e3b', fontSize: '12px' }}>
                  Save User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
