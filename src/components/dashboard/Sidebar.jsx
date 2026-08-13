import React from 'react';

const Sidebar = ({ activeTab, onTabChange, isCollapsed, toggleCollapse }) => {
  const userStr = localStorage.getItem('user_data');
  let role = 'VENDOR';
  if (userStr) {
    try { role = JSON.parse(userStr).role?.toUpperCase() || 'VENDOR'; } catch(e) {}
  }

  let menuItems = [];
  
  let vendorMenuItems = [];

  if (role === 'VENDOR' || role === 'VENDOR_ADMIN') {
    vendorMenuItems = [
      { id: 'reports', label: 'Vendor Profile', icon: 'fas fa-id-badge' },
    ];
  } else if (role === 'EMPLOYEE' || role === 'PURCHASE_DEPT' || role === 'SUBMITTER' || role === 'APPROVER') {
    vendorMenuItems = [
      { id: 'vendorList', label: 'Vendor List', icon: 'fas fa-users' },
      { id: 'material', label: 'Material List', icon: 'fas fa-box' },
      { id: 'pr', label: 'Create PR', icon: 'fas fa-file-invoice' },
      { id: 'quotation', label: 'Award Quotation', icon: 'fas fa-file-signature' },
      { id: 'po', label: 'Purchase Orders', icon: 'fas fa-shopping-cart' },
    ];
  } else if (role === 'ADMIN' || role === 'PROC_MGR') {
    vendorMenuItems = [
      { id: 'vendorList', label: 'Vendor List', icon: 'fas fa-users' },
      { id: 'pr', label: 'Indent', icon: 'fas fa-file-invoice' },
      { id: 'material', label: 'Material Module', icon: 'fas fa-box' },
      { id: 'quotation', label: 'Quotation', icon: 'fas fa-file-signature' },
      { id: 'po', label: 'Create PO', icon: 'fas fa-shopping-cart' },
      { id: 'asn', label: 'ASN (Advance Shipment Notice)', icon: 'fas fa-truck' },
      { id: 'reports', label: 'Vendor Profile', icon: 'fas fa-id-badge' },
    ];
  }

  return (
    <div className={`dashboard-sidebar bg-white border-end d-flex flex-column flex-shrink-0 transition-all`} style={{ width: isCollapsed ? '80px' : '260px', minHeight: 'calc(100vh - 70px)', transition: 'width 0.3s' }}>
      <div className="p-3 flex-grow-1 sidebar-scrollable overflow-hidden" style={{ maxHeight: 'calc(100vh - 70px)' }}>
        <ul className="nav nav-pills flex-column mb-auto">
          {menuItems.map((item) => (
            <li key={item.id} className="nav-item mb-1">
              <button
                onClick={() => onTabChange(item.id)}
                className={`nav-link w-100 text-start d-flex align-items-center gap-3 border-0 py-2 px-3 rounded ${
                  activeTab === item.id 
                    ? 'active-tab-style' 
                    : 'text-dark hover-tab-style'
                }`}
              >
                <i className={`${item.icon} fs-5`}></i>
                {!isCollapsed && <span className="fw-semibold">{item.label}</span>}
              </button>
            </li>
          ))}

          <li className="nav-item mt-4 mb-2">
            {!isCollapsed ? (
              <span className="text-uppercase text-muted fw-bold px-3" style={{ fontSize: '11px', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                Vendor Module
              </span>
            ) : (
              <hr className="text-muted" />
            )}
          </li>

          {vendorMenuItems.map((item) => (
            <li key={item.id} className="nav-item mb-1">
              <button
                onClick={() => onTabChange(item.id)}
                className={`nav-link w-100 text-start d-flex align-items-center gap-3 border-0 py-2 px-3 rounded ${
                  activeTab === item.id 
                    ? 'active-tab-style' 
                    : 'text-dark hover-tab-style'
                }`}
              >
                <i className={`${item.icon} fs-5`}></i>
                {!isCollapsed && <span className="fw-semibold">{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="p-3 border-top mt-auto">
        <div className={`d-flex ${isCollapsed ? 'justify-content-center' : 'justify-content-end'}`}>
          <button onClick={toggleCollapse} className="btn btn-sm btn-light border-0 text-muted shadow-none">
            <i className={`fas ${isCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'}`}></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
