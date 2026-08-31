import React, { useState, useEffect } from 'react';


const Reports = ({ onNavigate }) => {
  const [selectedComingSoon, setSelectedComingSoon] = useState(null);
  const [notified, setNotified] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  const role = (() => {
    try {
      const userStr = localStorage.getItem('user_data');
      if (userStr) {
        return JSON.parse(userStr).role?.toUpperCase();
      }
    } catch (e) {}
    return 'VENDOR';
  })();

  // Both EMPLOYEE and PURCHASE_DEPT use the internal employee dashboard view
  const isEmployeeRole = role === 'EMPLOYEE' || role === 'PURCHASE_DEPT';

  const reportCards = [
    {
      id: 'vendor',
      title: isEmployeeRole ? 'Vendor List' : 'Profile',
      description: isEmployeeRole ? 'View and manage vendor profiles' : 'View and manage all vendor details',
      iconClass: 'fas fa-users',
      themeColor: '#0E7C86', // green
      bgColor: 'rgba(16, 185, 129, 0.1)',
      btnOutlineClass: 'btn-outline-emerald',
      isComingSoon: false,
      tabId: isEmployeeRole ? 'vendorList' : 'vendor-data'
    },
    {
      id: 'material',
      title: 'Material List',
      description: 'View all materials and their specifications',
      iconClass: 'fas fa-box',
      themeColor: '#3b82f6', // blue
      bgColor: 'rgba(59, 130, 246, 0.1)',
      btnOutlineClass: 'btn-outline-blue',
      isComingSoon: false,
      tabId: isEmployeeRole ? 'material' : 'material-report'
    },
    {
      id: 'pr',
      title: isEmployeeRole ? 'Purchase Requisition' : 'Quotation Acknowledgement',
      description: 'Track all purchase requisition requests',
      iconClass: 'fas fa-file-invoice',
      themeColor: '#8b5cf6', // purple
      bgColor: 'rgba(139, 92, 246, 0.1)',
      btnOutlineClass: 'btn-outline-purple',
      isComingSoon: false,
      tabId: isEmployeeRole ? 'pr' : 'pr-approval-report'
    },
    ...(isEmployeeRole ? [
      {
        id: 'indent',
        title: 'Indent',
        description: 'View and manage indents',
        iconClass: 'fas fa-file-alt',
        themeColor: '#4955B6',
        bgColor: 'rgba(99, 102, 241, 0.1)',
        btnOutlineClass: 'btn-outline-primary',
        isComingSoon: false,
        tabId: 'indent'
      },
      {
        id: 'rfq',
        title: 'Request for Quotation',
        description: 'View active RFQs and invite bids',
        iconClass: 'fas fa-file-contract',
        themeColor: '#8B4B4D', // amber
        bgColor: 'rgba(245, 158, 11, 0.1)',
        btnOutlineClass: 'btn-outline-amber',
        isComingSoon: false,
        tabId: 'rfq'
      }
    ] : []),
    {
      id: 'quotation',
      title: 'Quotation',
      description: 'View and compare vendor quotations',
      iconClass: 'fas fa-comments-dollar',
      themeColor: '#eab308', // yellow
      bgColor: 'rgba(234, 179, 8, 0.1)',
      btnOutlineClass: 'btn-outline-yellow',
      isComingSoon: false,
      tabId: isEmployeeRole ? 'quotation' : 'quotation-cycle-report'
    },
    {
      id: 'po',
      title: 'Purchase Orders',
      description: 'Track and analyze all purchase orders',
      iconClass: 'fas fa-shopping-cart',
      themeColor: '#0E7C86', // green
      bgColor: 'rgba(16, 185, 129, 0.1)',
      btnOutlineClass: 'btn-outline-emerald',
      isComingSoon: false,
      tabId: 'po'
    },
    {
      id: 'asn',
      title: 'ASN',
      description: 'View Advance Shipping Notices',
      iconClass: 'fas fa-truck',
      themeColor: '#f97316', // orange
      bgColor: 'rgba(249, 115, 22, 0.1)',
      btnOutlineClass: 'btn-outline-orange',
      isComingSoon: false,
      tabId: 'asn'
    },
    {
      id: 'gate-entry',
      title: 'Gate Entry',
      description: 'Monitor security gate check-ins and logs',
      iconClass: 'fas fa-door-open',
      themeColor: '#06b6d4', // cyan
      bgColor: 'rgba(6, 182, 212, 0.1)',
      btnOutlineClass: 'btn-outline-teal',
      isComingSoon: true
    },
    {
      id: 'stock',
      title: 'Stock',
      description: 'View real-time inventory and stock levels',
      iconClass: 'fas fa-cubes',
      themeColor: '#14b8a6', // teal
      bgColor: 'rgba(20, 184, 166, 0.1)',
      btnOutlineClass: 'btn-outline-teal',
      isComingSoon: true
    },
    {
      id: 'invoice',
      title: 'Invoice',
      description: 'Track and manage all invoices',
      iconClass: 'fas fa-file-invoice-dollar',
      themeColor: '#0d9488', // teal
      bgColor: 'rgba(13, 148, 136, 0.1)',
      btnOutlineClass: 'btn-outline-teal',
      isComingSoon: true
    },
    {
      id: 'vendor-payment',
      title: 'Vendor Payment',
      description: 'Track pending and completed payouts',
      iconClass: 'fas fa-wallet',
      themeColor: '#22c55e', // green
      bgColor: 'rgba(34, 197, 94, 0.1)',
      btnOutlineClass: 'btn-outline-emerald',
      isComingSoon: true
    },
    {
      id: 'vendor-returns',
      title: 'Vendor Returns',
      description: 'Manage purchase returns and debit notes',
      iconClass: 'fas fa-undo',
      themeColor: '#C81017', // red
      bgColor: 'rgba(239, 68, 68, 0.1)',
      btnOutlineClass: 'btn-outline-pink',
      isComingSoon: true
    },
    {
      id: 'credit-note',
      title: 'Credit Notes',
      description: 'View and manage credit notes',
      iconClass: 'fas fa-file-signature',
      themeColor: '#ec4899', // pink
      bgColor: 'rgba(236, 72, 153, 0.1)',
      btnOutlineClass: 'btn-outline-pink',
      isComingSoon: true
    },
    {
      id: 'gst-reconciliation',
      title: 'GST Reconciliation',
      description: 'GST reports and tax summaries',
      iconClass: 'fas fa-university',
      themeColor: '#2563eb', // royal blue
      bgColor: 'rgba(37, 99, 235, 0.1)',
      btnOutlineClass: 'btn-outline-royal',
      isComingSoon: true
    },
    {
      id: 'tds-recon',
      title: 'TDS Reconciliation',
      description: 'TDS reports and deduction summaries',
      iconClass: 'fas fa-percent',
      themeColor: '#7c3aed', // violet/purple
      bgColor: 'rgba(124, 58, 237, 0.1)',
      btnOutlineClass: 'btn-outline-violet',
      isComingSoon: true
    }
  ];

  const handleCardClick = (card) => {
    if (card.isComingSoon) {
      setSelectedComingSoon(card);
      setNotified(false);
      setEmailInput('');
    } else if (onNavigate && card.tabId) {
      onNavigate(card.tabId);
    }
  };

  const handleNotifySubmit = (e) => {
    e.preventDefault();
    if (emailInput.trim()) {
      setNotified(true);
    }
  };

  // Render Coming Soon screen
  if (selectedComingSoon) {
    return (
      <div className="fade-in-slide container-fluid py-5 text-start" style={{ fontFamily: '"Poppins", sans-serif' }}>
        <div className="mb-4">
          <button
            className="btn btn-link text-muted text-decoration-none small fw-semibold ps-0 d-flex align-items-center gap-2"
            onClick={() => setSelectedComingSoon(null)}
          >
            <i className="fas fa-arrow-left"></i> Back to Reports
          </button>
        </div>

        <div className="row justify-content-center mt-4">
          <div className="col-lg-6 col-md-8 col-sm-10 col-12">
            <div className="card border-0 shadow-lg" style={{ borderRadius: '24px', overflow: 'hidden' }}>
              <div
                className="p-5 text-center position-relative"
                style={{
                  background: 'linear-gradient(135deg, #293383 0%, #0F172A 100%)',
                  color: '#ffffff'
                }}
              >
                {/* Decorative floating shapes */}
                <div className="position-absolute" style={{ top: '-40px', right: '-40px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)' }}></div>
                <div className="position-absolute" style={{ bottom: '-30px', left: '-30px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)' }}></div>

                {/* Big Icon Container */}
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-4 bg-white bg-opacity-10 shadow-sm"
                  style={{ width: '80px', height: '80px', color: '#0E7C86' }}
                >
                  <i className={`${selectedComingSoon.iconClass} fs-2`}></i>
                </div>

                <span className="badge px-3 py-2 text-uppercase mb-2" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', fontSize: '10px', letterSpacing: '1px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>Coming Soon</span>
                <h3 className="fw-bold mb-2">{selectedComingSoon.title} Analytical Report</h3>
                <p className="text-light text-opacity-75 mb-0 small mx-auto" style={{ maxWidth: '400px' }}>
                  We are building an advanced analytical report for <strong>{selectedComingSoon.title}</strong>, complete with customizable filters, interactive charts, and Excel exports.
                </p>
              </div>

              <div className="card-body p-5">
                {/* Progress bar */}
                <div className="mb-4">
                  <div className="d-flex justify-content-between mb-1" style={{ fontSize: '11px' }}>
                    <span className="text-muted fw-semibold">Development Progress</span>
                    <span className="text-success fw-bold">85% Completed</span>
                  </div>
                  <div className="progress" style={{ height: '8px', borderRadius: '4px' }}>
                    <div
                      className="progress-bar progress-bar-striped progress-bar-animated bg-success"
                      role="progressbar"
                      style={{ width: '85%', backgroundColor: '#0E7C86' }}
                      aria-valuenow="85"
                      aria-valuemin="0"
                      aria-valuemax="100"
                    ></div>
                  </div>
                </div>

                {/* Notification signup form */}
                {!notified ? (
                  <form onSubmit={handleNotifySubmit} className="mt-4">
                    <h6 className="fw-bold text-dark mb-2 text-center" style={{ fontSize: '13px' }}>Want early access?</h6>
                    <p className="text-muted text-center mb-3" style={{ fontSize: '11px' }}>Be the first to test this report. Enter your email below to receive notifications.</p>
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
                        style={{ backgroundColor: '#293383', borderColor: '#293383', borderRadius: '8px', fontSize: '12px' }}
                      >
                        Notify Me
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="text-center py-3 fade-in-slide">
                    <div className="text-success mb-2">
                      <i className="fas fa-check-circle fs-3"></i>
                    </div>
                    <h6 className="fw-bold text-dark mb-1" style={{ fontSize: '13px' }}>You are on the list!</h6>
                    <p className="text-muted mb-0" style={{ fontSize: '11px' }}>We will notify you at <strong>{emailInput}</strong> as soon as this report goes live.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in-slide container-fluid py-4 bg-light bg-opacity-50" style={{ minHeight: '100%', fontFamily: '"Poppins", sans-serif' }}>
      {/* Grid of Report Cards */}
      <div className="row g-4 mb-4">
        {reportCards.map((card) => (
          <div key={card.id} className="col-xl-3 col-lg-4 col-md-6 col-sm-6 col-12">
            <div className="card h-100 border-0 shadow-sm transition-all hover-translate-y" style={{ borderRadius: '16px' }}>
              <div className="card-body p-4 d-flex flex-column align-items-center text-center">
                {/* Circular Icon Container */}
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center mb-3"
                  style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: card.bgColor,
                    color: card.themeColor
                  }}
                >
                  <i className={`${card.iconClass} fs-3`}></i>
                </div>

                {/* Card Title & Text */}
                <h6 className="fw-bold text-dark mb-2" style={{ fontSize: '14px' }}>{card.title}</h6>
                <p className="text-muted mb-4 flex-grow-1" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                  {card.description}
                </p>

                {/* Customized Outline Button */}
                <button
                  className={`btn w-100 fw-semibold d-flex align-items-center justify-content-center gap-2 py-2 px-3 border ${card.btnOutlineClass}`}
                  style={{
                    fontSize: '11px',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onClick={() => handleCardClick(card)}
                >
                  <span>View Details</span>
                  <i className="fas fa-arrow-right fs-10"></i>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default Reports;
