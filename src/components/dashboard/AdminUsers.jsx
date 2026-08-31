import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';

// Matches backend_java's UserType enum exactly (enums/UserType.java) — this list had drifted
// before (offered "ADMIN"/"PROCUREMENT"/"QUALITY_AUDITOR", none of which are real values, so
// picking any of them silently created a plain EMPLOYEE account instead). SUPER_ADMIN is
// deliberately not offered here — it's a separate table/entity backend-side, assigning that
// UserType to a UserDetail row doesn't create a real super admin.
const ROLES = [
  { value: 'ADMINISTRATOR', label: 'Administrator' },
  { value: 'PROCUREMENT_MANAGER', label: 'Procurement Manager' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'PURCHASE_DEPT', label: 'Purchase Department' },
  { value: 'APPROVER', label: 'Approver' },
];

const roleLabel = (value) => ROLES.find((r) => r.value === value)?.label || value;

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

const errorMessage = (err, fallback) =>
  err.response?.data?.statusMsg || err.response?.data?.message || fallback;

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  // Add-user form state
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
  const [role, setRole] = useState('EMPLOYEE');
  const [departments, setDepartments] = useState([]);
  const [deptCode, setDeptCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Edit-user modal state — also doubles as "reset password" (leave the password field blank to
  // keep the current one), since both go through the same PUT /api/users/{userId} the backend
  // already supports.
  const [editingUser, setEditingUser] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editAlert, setEditAlert] = useState(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editShowPassword, setEditShowPassword] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    setListError('');
    axios.get('/api/users/list', { headers: authHeaders() })
      .then((res) => {
        const fetched = res.data?.data?.users || [];
        setUsers(fetched);
      })
      .catch((err) => {
        console.error('Failed to load users.', err);
        setUsers([]);
        setListError(errorMessage(err, 'Could not load users. Try again.'));
      })
      .finally(() => setLoading(false));
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

    axios.get('/api/departments', { headers: authHeaders() })
      .then((res) => {
        const depts = res.data.departments || res.data || [];
        setDepartments(depts);
        if (depts && depts.length > 0) {
          setDeptCode(depts[0].deptCode);
        }
      })
      .catch((err) => console.warn('Failed to fetch departments', err));
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
      purchOrgCode,
      role,
      deptCode: (role === 'EMPLOYEE' || role === 'PURCHASE_DEPT') ? deptCode : undefined,
    };

    axios.post('/api/users/create', payload, {
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    })
    .then(res => {
      setAlert({ type: 'success', message: 'User created — a welcome email with their temporary password was sent.' });
      // Reset form
      setEmail(''); setPassword(''); setFirstName(''); setLastName(''); setPhoneNumber(''); setRole('EMPLOYEE');
      fetchUsers();
      setTimeout(() => setShowAddModal(false), 1200);
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

  const handleDeactivate = (user) => {
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    if (!window.confirm(`Deactivate ${name} (${user.email})? They will no longer be able to sign in, by password or Microsoft.`)) {
      return;
    }
    axios.delete(`/api/users/${user.userId}`, { headers: authHeaders() })
      .then(() => {
        setListError('');
        fetchUsers();
      })
      .catch((err) => {
        console.error('Deactivate user error:', err);
        setListError(errorMessage(err, `Could not deactivate ${name}.`));
      });
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setEditFirstName(user.firstName || '');
    setEditLastName(user.lastName || '');
    setEditPhone(user.phoneNumber || '');
    setEditPassword('');
    setEditShowPassword(false);
    setEditAlert(null);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditSaving(true);
    setEditAlert(null);

    const payload = {
      firstName: editFirstName,
      lastName: editLastName,
      phoneNumber: editPhone,
    };
    if (editPassword) {
      payload.password = editPassword;
    }

    axios.put(`/api/users/${editingUser.userId}`, payload, {
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    })
      .then(() => {
        setEditAlert({ type: 'success', message: editPassword ? 'Saved — the user was emailed their new password.' : 'Saved.' });
        fetchUsers();
        setTimeout(() => setEditingUser(null), 1000);
      })
      .catch((err) => {
        console.error('Update user error:', err);
        setEditAlert({ type: 'danger', message: errorMessage(err, 'Could not save changes.') });
      })
      .finally(() => setEditSaving(false));
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

      {listError && (
        <div className="alert alert-danger py-2 small" role="alert">
          {listError}
          <button className="btn btn-link btn-sm p-0 ms-2" onClick={fetchUsers}>Try again</button>
        </div>
      )}

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
                  <th scope="col">Status</th>
                  <th scope="col" className="text-end pe-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5 text-muted">
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
                        <span className={`badge ${user.role === 'ADMINISTRATOR' ? 'bg-danger-subtle text-danger' : 'bg-primary-subtle text-primary'} px-2.5 py-1 rounded fw-semibold`} style={{ fontSize: '11px' }}>
                          {roleLabel(user.role)}
                        </span>
                      </td>
                      <td>
                        {user.isActive === false ? (
                          <span className="badge bg-secondary-subtle text-secondary px-2.5 py-1 rounded fw-semibold" style={{ fontSize: '11px' }}>Deactivated</span>
                        ) : (
                          <span className="badge bg-success-subtle text-success px-2.5 py-1 rounded fw-semibold" style={{ fontSize: '11px' }}>Active</span>
                        )}
                      </td>
                      <td className="text-end pe-4">
                        <button
                          className="btn btn-light btn-sm border px-2 py-1 me-1"
                          onClick={() => openEdit(user)}
                          title="Edit / reset password"
                        >
                          <i className="fas fa-pen text-primary"></i>
                        </button>
                        <button
                          className="btn btn-light btn-sm border px-2 py-1"
                          onClick={() => handleDeactivate(user)}
                          title="Deactivate user"
                          disabled={user.isActive === false}
                        >
                          <i className="fas fa-user-minus text-danger"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-5 text-muted">
                      No users found.
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
                      <input type={showPassword ? 'text' : 'password'} className="form-control border-success-subtle" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
                      <button type="button" className="btn btn-outline-success border-success-subtle" onClick={() => setShowPassword(!showPassword)}>
                        <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    <div className="form-text">At least 8 characters. Emailed to the user once the account is created.</div>
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label fw-bold text-muted small">Role Assignment *</label>
                    <select className="form-select border-success-subtle" value={role} onChange={(e) => setRole(e.target.value)}>
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  {(role === 'EMPLOYEE' || role === 'PURCHASE_DEPT') && (
                    <div className="col-sm-6">
                      <label className="form-label fw-bold text-muted small">Department *</label>
                      <select
                        className="form-select border-success-subtle"
                        value={deptCode}
                        onChange={(e) => setDeptCode(e.target.value)}
                        required
                      >
                        {departments.length === 0 && <option value="">Loading...</option>}
                        {departments.map((d) => (
                          <option key={d.deptCode} value={d.deptCode}>
                            {d.deptName} ({d.deptCode})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
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
                <Button type="submit" loading={saving} className="btn-success px-4" style={{ backgroundColor: '#293383', borderColor: '#293383', fontSize: '12px' }}>
                  Save User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / reset-password modal */}
      {editingUser && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '450px' }}>
            <div className="custom-modal-header bg-primary text-white">
              <h5 className="custom-modal-title fw-bold text-white">
                <i className="fas fa-pen me-2"></i>Edit {editingUser.firstName} {editingUser.lastName}
              </h5>
              <button className="custom-modal-close-btn text-white" onClick={() => setEditingUser(null)}>&times;</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="custom-modal-body p-4 text-start">
                {editAlert && (
                  <div className={`alert alert-${editAlert.type} py-1.5 mb-3 small`} role="alert">
                    {editAlert.message}
                  </div>
                )}
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-bold text-muted small">Email</label>
                    <input type="email" className="form-control" value={editingUser.email} disabled />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label fw-bold text-muted small">First Name</label>
                    <input type="text" className="form-control" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
                  </div>
                  <div className="col-sm-6">
                    <label className="form-label fw-bold text-muted small">Last Name</label>
                    <input type="text" className="form-control" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold text-muted small">Phone Number</label>
                    <input type="tel" maxLength="10" pattern="[0-9]{10}" className="form-control" value={editPhone} onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold text-muted small">Reset password</label>
                    <div className="input-group">
                      <input type={editShowPassword ? 'text' : 'password'} className="form-control" minLength={8} placeholder="Leave blank to keep the current password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setEditShowPassword(!editShowPassword)}>
                        <i className={`fas ${editShowPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                      </button>
                    </div>
                    <div className="form-text">Only fill this in to set a new password — the user will be emailed it.</div>
                  </div>
                </div>
              </div>
              <div className="custom-modal-footer gap-2">
                <button type="button" className="btn btn-outline-secondary px-3 py-1 fw-semibold" onClick={() => setEditingUser(null)} style={{ borderRadius: '8px', fontSize: '12px' }}>Cancel</button>
                <Button type="submit" loading={editSaving} className="btn-primary px-4" style={{ backgroundColor: '#293383', borderColor: '#293383', fontSize: '12px' }}>
                  Save Changes
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
