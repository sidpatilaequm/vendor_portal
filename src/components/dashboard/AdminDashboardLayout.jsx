import React, { useState } from 'react';
import Header from './Header';
import AdminVendors from './AdminVendors';
import AdminProspects from './AdminProspects';
import AdminInvitations from './AdminInvitations';
import AdminMasterData from './AdminMasterData';
import AdminUsers from './AdminUsers';
import AdminWorkflows from './AdminWorkflows';
import DashboardHome from './DashboardHome';
import PurchaseRequisition from './PurchaseRequisition';
import Quotation from './Quotation';
import PurchaseOrder from './PurchaseOrder';
import ASN from './ASN';
import BudgetApp from './BudgetApp';
import IndentDashboard from './IndentDashboard';

// Unified Coming Soon Component for Unimplemented Admin Screens
const ComingSoonView = ({ moduleName, iconClass }) => {
  const [emailInput, setEmailInput] = useState('');
  const [notified, setNotified] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (emailInput.trim()) {
      setNotified(true);
    }
  };

  return (
    <div className="fade-in-slide container-fluid py-5 text-start" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="row justify-content-center mt-4">
        <div className="col-lg-6 col-md-8 col-sm-10 col-12">
          <div className="card border-0 shadow-lg" style={{ borderRadius: '24px', overflow: 'hidden' }}>
            <div
              className="p-5 text-center position-relative"
              style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
                color: '#ffffff'
              }}
            >
              <div className="position-absolute" style={{ top: '-40px', right: '-40px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)' }}></div>
              <div className="position-absolute" style={{ bottom: '-30px', left: '-30px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)' }}></div>

              <div
                className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-4 bg-white bg-opacity-10 shadow-sm"
                style={{ width: '80px', height: '80px', color: '#10b981' }}
              >
                <i className={`${iconClass || 'fas fa-cogs'} fs-2`}></i>
              </div>

              <span className="badge px-3 py-2 text-uppercase mb-2" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', fontSize: '10px', letterSpacing: '1px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>Coming Soon</span>
              <h3 className="fw-bold mb-2">{moduleName} Module</h3>
              <p className="text-light text-opacity-75 mb-0 small mx-auto" style={{ maxWidth: '400px' }}>
                The administrative panel and workflow automation for <strong>{moduleName}</strong> is currently being migrated to React.
              </p>
            </div>

            <div className="card-body p-5">
              <div className="mb-4">
                <div className="d-flex justify-content-between mb-1" style={{ fontSize: '11px' }}>
                  <span className="text-muted fw-semibold">Migration Progress</span>
                  <span className="text-success fw-bold">90% Completed</span>
                </div>
                <div className="progress" style={{ height: '8px', borderRadius: '4px' }}>
                  <div
                    className="progress-bar progress-bar-striped progress-bar-animated bg-success"
                    role="progressbar"
                    style={{ width: '90%', backgroundColor: '#10b981' }}
                    aria-valuenow="90"
                    aria-valuemin="0"
                    aria-valuemax="100"
                  ></div>
                </div>
              </div>

              {!notified ? (
                <form onSubmit={handleSubmit} className="mt-4">
                  <h6 className="fw-bold text-dark mb-2 text-center" style={{ fontSize: '13px' }}>Notify when live?</h6>
                  <p className="text-muted text-center mb-3" style={{ fontSize: '11px' }}>Enter your email below to get notified of release details.</p>
                  <div className="d-flex gap-2">
                    <input
                      type="email"
                      className="form-control border-light-subtle py-2 px-3"
                      placeholder="name@company.com"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      style={{ borderRadius: '8px', fontSize: '12px' }}
                    />
                    <button
                      type="submit"
                      className="btn btn-success px-4 fw-bold shadow-sm"
                      style={{ backgroundColor: '#064e3b', borderColor: '#064e3b', borderRadius: '8px', fontSize: '12px' }}
                    >
                      Subscribe
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-3">
                  <div className="text-success mb-2">
                    <i className="fas fa-check-circle fs-3"></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-1" style={{ fontSize: '13px' }}>Subscribed!</h6>
                  <p className="text-muted mb-0" style={{ fontSize: '11px' }}>We will notify you at <strong>{emailInput}</strong> as soon as this feature goes live.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminDashboardLayout = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [vendorPovOpen, setVendorPovOpen] = useState(true);
  const [workflowMenuOpen, setWorkflowMenuOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fas fa-chart-line' },
    { id: 'vendors', label: 'Vendors', icon: 'fas fa-building' },
    { id: 'prospects', label: 'Vendor Prospect', icon: 'fas fa-user-clock' }
  ];

  const vendorPovSubItems = [
    { id: 'pr', label: 'Purchase Requisition', icon: 'fas fa-file-invoice' },
    { id: 'indent', label: 'Indent', icon: 'fas fa-file-alt' },
    { id: 'quotation', label: 'Quotation', icon: 'fas fa-file-signature' },
    { id: 'po', label: 'Purchase Order', icon: 'fas fa-shopping-cart' },
    { id: 'asn', label: 'ASN', icon: 'fas fa-truck' },
    { id: 'invoice', label: 'Invoice', icon: 'fas fa-file-invoice-dollar', comingSoon: true },
    { id: 'vendor_payments', label: 'Vendor Payments', icon: 'fas fa-wallet', comingSoon: true },
    { id: 'vendor_returns', label: 'Vendor Returns', icon: 'fas fa-undo', comingSoon: true },
    { id: 'credit', label: 'Credit', icon: 'fas fa-credit-card', comingSoon: true },
    { id: 'credit_payment', label: 'Credit Payment', icon: 'fas fa-money-check-alt', comingSoon: true }
  ];

  const workflowSubItems = [
    { id: 'wf_dashboard', label: 'Dashboard', icon: 'fas fa-tachometer-alt' },
    { id: 'wf_list', label: 'Workflows', icon: 'fas fa-project-diagram' },
    { id: 'wf_requests', label: 'Requests', icon: 'fas fa-tasks' },
    { id: 'wf_groups', label: 'Groups', icon: 'fas fa-users' },
    { id: 'wf_analytics', label: 'Analytics', icon: 'fas fa-chart-pie' },
    { id: 'wf_email_action', label: 'Email Action', icon: 'fas fa-envelope-open-text' },
    { id: 'wf_settings', label: 'Settings', icon: 'fas fa-cog' }
  ];

  const generalMenuItems = [
    { id: 'material_bom', label: 'Material BOM', icon: 'fas fa-clipboard-list', comingSoon: true },
    { id: 'budget', label: 'Budget', icon: 'fas fa-wallet' },
    { id: 'masterdata', label: 'Master Data', icon: 'fas fa-database' },
    { id: 'users', label: 'Users', icon: 'fas fa-users-cog' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardHome isAdmin={true} />;
      case 'vendors':
        return <AdminVendors />;
      case 'prospects':
        return <AdminProspects />;
      case 'masterdata':
        return <AdminMasterData />;
      case 'users':
        return <AdminUsers />;
      case 'workflows':
      case 'wf_dashboard':
      case 'wf_list':
      case 'wf_requests':
      case 'wf_groups':
      case 'wf_analytics':
      case 'wf_email_action':
      case 'wf_settings':
        return <AdminWorkflows subTab={activeTab} onNavigate={(tabId) => setActiveTab(tabId)} />;
      case 'invitations':
        return <AdminInvitations />;
      case 'pr':
        return <PurchaseRequisition />;
      case 'indent':
        return <IndentDashboard />;
      case 'quotation':
        return <Quotation />;
      case 'po':
        return <PurchaseOrder />;
      case 'asn':
        return <ASN />;
      case 'budget':
        return <BudgetApp />;
      default:
        // Check if it matches a coming soon page
        const item = [...vendorPovSubItems, ...generalMenuItems].find(i => i.id === activeTab);
        if (item) {
          return <ComingSoonView moduleName={item.label} iconClass={item.icon} />;
        }
        return <DashboardHome isAdmin={true} />;
    }
  };

  return (
    <div className="min-vh-100 d-flex flex-column bg-light" style={{ fontFamily: '"Inter", sans-serif' }}>
      <Header />
      <div className="d-flex flex-grow-1">
        {/* Sidebar */}
        <div 
          className="dashboard-sidebar bg-white border-end d-flex flex-column transition-all" 
          style={{ 
            width: collapsed ? '70px' : '280px', 
            minHeight: 'calc(100vh - 70px)',
            transition: 'width 0.2s ease-in-out'
          }}
        >
          <div className="p-3 flex-grow-1 sidebar-scrollable" style={{ maxHeight: 'calc(100vh - 140px)' }}>
            <ul className="nav nav-pills flex-column mb-auto">
              {!collapsed && (
                <li className="nav-item mb-2 px-3">
                  <span className="text-uppercase text-muted fw-bold" style={{ fontSize: '10px', letterSpacing: '1px' }}>
                    Menu
                  </span>
                </li>
              )}
              
              {menuItems.map((item) => (
                <li key={item.id} className="nav-item mb-1">
                  <button
                    onClick={() => setActiveTab(item.id)}
                    className={`nav-link w-100 text-start d-flex align-items-center gap-3 border-0 py-2.5 px-3 rounded transition-all ${
                      activeTab === item.id 
                        ? 'active-tab-style' 
                        : 'text-dark hover-tab-style'
                    }`}
                    title={collapsed ? item.label : ''}
                  >
                    <i className={`${item.icon} fs-5`} style={{ width: '20px', textAlign: 'center' }}></i>
                    {!collapsed && <span style={{ fontSize: '13.5px', fontWeight: '500' }}>{item.label}</span>}
                  </button>
                </li>
              ))}

              {/* Vendor POV Collapsible Menu */}
              <li className="nav-item mb-1">
                <button
                  onClick={() => setVendorPovOpen(!vendorPovOpen)}
                  className="nav-link w-100 text-start d-flex align-items-center justify-content-between border-0 py-2.5 px-3 rounded text-dark hover-tab-style transition-all"
                  title={collapsed ? "Vendor POV" : ""}
                >
                  <div className="d-flex align-items-center gap-3">
                    <i className="fas fa-user-tie fs-5" style={{ width: '20px', textAlign: 'center' }}></i>
                    {!collapsed && <span style={{ fontSize: '13.5px', fontWeight: '500' }}>Vendor POV</span>}
                  </div>
                  {!collapsed && <i className={`fas fa-chevron-${vendorPovOpen ? 'down' : 'right'} text-muted`} style={{ fontSize: '11px' }}></i>}
                </button>

                {vendorPovOpen && !collapsed && (
                  <ul className="nav flex-column ms-4 border-start ps-2 mt-1 gap-0.5">
                    {vendorPovSubItems.map((subItem) => (
                      <li key={subItem.id} className="nav-item">
                        <button
                          onClick={() => setActiveTab(subItem.id)}
                          className={`nav-link w-100 text-start d-flex align-items-center gap-2 border-0 py-1.5 px-3 rounded transition-all ${
                            activeTab === subItem.id
                              ? 'active-tab-style'
                              : 'text-muted hover-tab-style'
                          }`}
                          style={{ fontSize: '12.5px', fontWeight: '400' }}
                        >
                          <i className={`${subItem.icon}`} style={{ width: '15px', textAlign: 'center', fontSize: '11px' }}></i>
                          <span>{subItem.label}</span>
                          {subItem.comingSoon && (
                            <span className="badge bg-light text-muted ms-auto px-1.5 py-0.5" style={{ fontSize: '8px' }}>Soon</span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>

              {/* General Administrative Menu Items */}
              {generalMenuItems.map((item) => (
                <React.Fragment key={item.id}>
                  <li className="nav-item mb-1">
                    <button
                      onClick={() => setActiveTab(item.id)}
                      className={`nav-link w-100 text-start d-flex align-items-center gap-3 border-0 py-2.5 px-3 rounded transition-all ${
                        activeTab === item.id 
                          ? 'active-tab-style' 
                          : 'text-dark hover-tab-style'
                      }`}
                      title={collapsed ? item.label : ''}
                    >
                      <i className={`${item.icon} fs-5`} style={{ width: '20px', textAlign: 'center' }}></i>
                      {!collapsed && <span style={{ fontSize: '13.5px', fontWeight: '500' }}>{item.label}</span>}
                      {item.comingSoon && !collapsed && (
                        <span className="badge bg-light text-muted ms-auto px-1.5 py-0.5" style={{ fontSize: '9px' }}>Soon</span>
                      )}
                    </button>
                  </li>

                  {/* Render Collapsible Workflow menu right after Master Data */}
                  {item.id === 'masterdata' && (
                    <li className="nav-item mb-1">
                      <button
                        onClick={() => setWorkflowMenuOpen(!workflowMenuOpen)}
                        className="nav-link w-100 text-start d-flex align-items-center justify-content-between border-0 py-2.5 px-3 rounded text-dark hover-tab-style transition-all"
                        title={collapsed ? "Workflow" : ""}
                      >
                        <div className="d-flex align-items-center gap-3">
                          <i className="fas fa-project-diagram fs-5" style={{ width: '20px', textAlign: 'center' }}></i>
                          {!collapsed && <span style={{ fontSize: '13.5px', fontWeight: '500' }}>Workflow</span>}
                        </div>
                        {!collapsed && <i className={`fas fa-chevron-${workflowMenuOpen ? 'down' : 'right'} text-muted`} style={{ fontSize: '11px' }}></i>}
                      </button>

                      {workflowMenuOpen && !collapsed && (
                        <ul className="nav flex-column ms-4 border-start ps-2 mt-1 gap-0.5">
                          {workflowSubItems.map((subItem) => (
                            <li key={subItem.id} className="nav-item">
                              <button
                                onClick={() => setActiveTab(subItem.id)}
                                className={`nav-link w-100 text-start d-flex align-items-center gap-2 border-0 py-1.5 px-3 rounded transition-all ${
                                  activeTab === subItem.id
                                    ? 'active-tab-style'
                                    : 'text-muted hover-tab-style'
                                }`}
                                style={{ fontSize: '12.5px', fontWeight: '400' }}
                              >
                                <i className={`${subItem.icon}`} style={{ width: '15px', textAlign: 'center', fontSize: '11px' }}></i>
                                <span>{subItem.label}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )}
                </React.Fragment>
              ))}
            </ul>
          </div>

          {/* Sidebar Collapse Toggle Button */}
          <div className="p-3 border-top bg-white">
            <button 
              className="btn btn-light w-100 d-flex align-items-center justify-content-center gap-2 border-0 text-muted"
              style={{ fontSize: '12px', borderRadius: '8px' }}
              onClick={() => setCollapsed(!collapsed)}
            >
              <i className={`fas ${collapsed ? 'fa-angle-double-right' : 'fa-angle-double-left'}`}></i>
              {!collapsed && <span className="fw-bold">Collapse Menu</span>}
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-grow-1 p-0 overflow-auto" style={{ height: 'calc(100vh - 70px)' }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboardLayout;
