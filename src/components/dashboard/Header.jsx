import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';

const Header = ({ onNavigate }) => {
  const { currentUser, logout, selectedCompanyCode, updateSelectedCompanyCode } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [vendorCode, setVendorCode] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [companies, setCompanies] = useState([]); // [{companyCode, companyName}] — real SAP company codes, not the vendor's own profile

  useEffect(() => {
    if (currentUser?.role?.toUpperCase() !== 'VENDOR') return;
    const token = localStorage.getItem('auth_token');
    axios.get('/api/mm/companies', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setCompanies(res.data?.companies || []))
      .catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user_data');
      if (userStr) {
        const user = JSON.parse(userStr);
        let companyId = user.company_id || user.companyId || user.vendor_id || user.vendorId || user.id;
        
        if (user.email === 'markjhon@gmail.com' && !companyId) {
          companyId = 1381;
        }

        if (companyId) {
          axios.get(`/api/vendors/${companyId}`)
            .then(res => {
              if (res.data) {
                setVendorName(res.data.name);
                setVendorCode(res.data.bp_no);
              }
            })
            .catch(err => console.error("Error fetching vendor in header:", err));
        }
      }
    } catch (e) {}
  }, []);

  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom sticky-top px-4 py-2" style={{ height: '70px', zIndex: 1000 }}>
      <div className="container-fluid d-flex justify-content-between align-items-center">
        {/* Brand logo */}
        <div className="d-flex align-items-center">
          <img src="/ankit-logo.png" alt="Ankit Group" style={{ height: 34, width: 'auto' }} />
        </div>

        {/* Right side profile info */}
        <div className="d-flex align-items-center gap-3">
          {vendorCode && (
            <div className="d-none d-md-flex align-items-center bg-light rounded-pill px-3 py-1 me-2 border">
              <i className="fas fa-building text-success me-2" style={{ fontSize: '12px' }}></i>
              <span className="fw-semibold text-dark" style={{ fontSize: '13px' }}>
                {vendorCode} - {vendorName}
              </span>
            </div>
          )}

          {/* Company Code Dropdown - Only for Vendors */}
          {currentUser?.role?.toUpperCase() === 'VENDOR' && (
            <div className="me-2">
              <select
                className="form-select form-select-sm"
                value={selectedCompanyCode || '1000'}
                onChange={(e) => updateSelectedCompanyCode(e.target.value)}
                style={{ minWidth: '150px', fontSize: '13px' }}
              >
                {companies.map((c) => (
                  <option key={c.companyCode} value={c.companyCode}>{c.companyName}</option>
                ))}
              </select>
            </div>
          )}
          <div className="position-relative">
            <button 
              className="btn btn-link text-decoration-none text-dark d-flex align-items-center gap-2 border-0 p-0 shadow-none"
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop" 
                alt="Profile" 
                className="rounded-circle border" 
                style={{ width: '36px', height: '36px', objectFit: 'cover' }}
              />
              <span className="fw-semibold text-muted d-none d-sm-inline" style={{ fontSize: '14px' }}>
                {currentUser?.email || 'markjhon@gmail.com'}
              </span>
              <i className="fas fa-chevron-down text-muted" style={{ fontSize: '11px' }}></i>
            </button>

            {dropdownOpen && (
              <div 
                className="position-absolute end-0 mt-2 bg-white border-0 rounded-3 shadow py-2"
                style={{ minWidth: '180px', zIndex: 1001, animation: 'fadeIn 0.15s ease-out' }}
              >
                <div className="px-3 pb-2 mb-2 border-bottom border-light">
                  <span className="d-block fw-semibold text-dark" style={{ fontSize: '13px' }}>
                    {currentUser?.firstName || 'Mark Jhon'}
                  </span>
                  <span className="d-block text-muted" style={{ fontSize: '11px' }}>
                    {currentUser?.email || 'markjhon@gmail.com'}
                  </span>
                </div>
                <button 
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate('vendor-data');
                      setDropdownOpen(false);
                    }
                  }} 
                  className="dropdown-item d-flex align-items-center gap-2 px-3 py-2 text-dark"
                  style={{ fontSize: '13px', transition: 'background-color 0.15s' }}
                >
                  <i className="fas fa-user-circle text-muted" style={{ fontSize: '14px' }}></i> My profile
                </button>
                <button 
                  onClick={logout} 
                  className="dropdown-item text-danger d-flex align-items-center gap-2 px-3 py-2 mt-1"
                  style={{ fontSize: '13px', transition: 'background-color 0.15s' }}
                >
                  <i className="fas fa-sign-out-alt text-danger" style={{ fontSize: '14px' }}></i> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Header;
