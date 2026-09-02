import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import './DashboardHome.css';

// A picked document type's classification -> which "Procure to pay" tile(s) it grants. There's no
// dedicated tile for Raw Material or Capital Expenditure, so those fall back onto the closest
// existing ones instead of being silently dropped (confirmed: Raw Material -> Products,
// Capital Expenditure -> both Products and Services).
const CLASSIFICATION_TILES = {
  PRODUCTS: ['products'],
  SERVICE: ['services'],
  SUBCONTRACTING: ['subcontracting'],
  SCHEDULING_AGREEMENT: ['scheduling'],
  RAW_MATERIAL: ['products'],
  CAPITAL_EXPENDITURE: ['products', 'services'],
};
const ALL_PROCURE_TILES = ['products', 'services', 'subcontracting', 'scheduling'];

const DashboardHome = ({ isAdmin, onNavigate }) => {
  const { currentUser, logout, selectedCompanyCode } = useAuth();
  const role = String(currentUser?.role || '').toUpperCase();
  const resolvedIsAdmin = isAdmin || role === 'SUPER_ADMIN' || role === 'ADMIN';

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [vendorCode, setVendorCode] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [workflowRequests, setWorkflowRequests] = useState([]);
  const [myDocTypeSelections, setMyDocTypeSelections] = useState(null); // null = not loaded yet

  useEffect(() => {
    if (!resolvedIsAdmin) {
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
              .catch(err => console.error("Error fetching vendor in dashboard:", err));
          }
        }
      } catch (e) { }
    }
  }, [resolvedIsAdmin]);

  // Which "Procure to pay" tiles this vendor is allowed to see, driven by the approver's
  // per-company document type picks (see AdminWorkflows' Document Types picker). Only the actual
  // vendor tile-grid view below needs this — the employee "cards" branch never renders it.
  const isVendorTileGridRole = !resolvedIsAdmin
    && role !== 'EMPLOYEE' && role !== 'PURCHASE_DEPT' && role !== 'SUBMITTER' && role !== 'APPROVER';
  useEffect(() => {
    if (!isVendorTileGridRole) return;
    const fetchDocTypeSelections = () => {
      axios.get('/api/supplier-registration/my-profile', { headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` } })
        .then((res) => setMyDocTypeSelections(res.data?.data?.result?.documentTypeSelections || []))
        .catch(() => setMyDocTypeSelections([])); // no supplier_registration row for this login (or load failed) — fall back to showing everything
    };
    fetchDocTypeSelections();
    // An approver can grant/change this vendor's document types at any time — this component
    // fetches once on mount, so a tab left open from before that happened would otherwise show
    // stale tiles until a manual reload. Re-check whenever the tab regains focus instead.
    const onVisible = () => { if (document.visibilityState === 'visible') fetchDocTypeSelections(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVendorTileGridRole]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!resolvedIsAdmin && (role === 'EMPLOYEE' || role === 'PURCHASE_DEPT' || role === 'SUBMITTER' || role === 'APPROVER')) {
      const fetchWorkflowRequests = async () => {
        try {
          const userStr = localStorage.getItem('user_data');
          let userId = 1;
          if (userStr) userId = JSON.parse(userStr).id || 1;
          
          const response = await axios.get(`/api/requests/?user_id=${userId}`);
          setWorkflowRequests(response.data || []);
        } catch (error) {
          console.error("Error fetching workflow requests", error);
        }
      };
      fetchWorkflowRequests();
    }
  }, [resolvedIsAdmin, role]);

  const handleNavigation = (e, path) => {
    e.preventDefault();
    e.stopPropagation();
    if (onNavigate) {
      onNavigate(path);
    }
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  if (resolvedIsAdmin) {
    return (
      <div className="fade-in-slide container-fluid py-5 bg-light bg-opacity-50" style={{ minHeight: '100%' }}>
        <div className="card shadow-sm border-0 mx-auto" style={{ maxWidth: '800px', borderRadius: '12px' }}>
          <div className="card-body p-4 text-center">
            <h3 className="fw-bold mb-4 text-dark">
              Administrative Operations Dashboard
            </h3>

            <div className="border border-light-subtle rounded overflow-hidden shadow-sm">
              <div className="p-3 d-flex align-items-center justify-content-center gap-2" style={{ backgroundColor: '#EEF0FB', color: '#293383' }}>
                <i className="fas fa-user-shield fs-5"></i>
                <span className="fw-bold">
                  System Administrator Profile
                </span>
              </div>

              <div className="p-4 bg-white">
                <div className="row py-2.5 border-bottom text-start">
                  <div className="col-4 fw-bold text-dark">Primary Name:</div>
                  <div className="col-8 text-muted">
                    {currentUser?.firstName || currentUser?.lastName
                      ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim()
                      : 'System Administrator'}
                  </div>
                </div>
                <div className="row py-2.5 border-bottom text-start">
                  <div className="col-4 fw-bold text-dark">Work Email:</div>
                  <div className="col-8 text-muted font-monospace">
                    {currentUser?.email || 'admin@aequm.com'}
                  </div>
                </div>
                <div className="row py-2.5 border-bottom text-start">
                  <div className="col-4 fw-bold text-dark">Contact Number:</div>
                  <div className="col-8 text-muted">
                    {currentUser?.phoneNumber || currentUser?.phone || '+91 99999 88888'}
                  </div>
                </div>
                <div className="row py-2.5 text-start">
                  <div className="col-4 fw-bold text-dark">Assigned Role:</div>
                  <div className="col-8">
                    <span className="badge bg-danger-subtle text-danger px-2.5 py-1 rounded fw-bold" style={{ fontSize: '11px' }}>
                      {role || 'ADMIN'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Employee Portal Dashboard UI (Old Grid Layout)
  if (role === 'EMPLOYEE' || role === 'PURCHASE_DEPT' || role === 'SUBMITTER' || role === 'APPROVER') {
    const cards = [
      { title: "Vendor List", desc: "View and manage vendor profiles", icon: "fa-users", colorClass: "success" },
      { title: "Material List", desc: "View all materials and their specifications", icon: "fa-box", colorClass: "primary" },
      { title: "Indent", desc: "Create and track indents", icon: "fa-clipboard-list", colorClass: "info" },
      { title: "Purchase Requisition", desc: "Track all purchase requisition requests", icon: "fa-file-alt", colorClass: "primary" },
      { title: "Request for Quotation", desc: "View active RFQs and invite bids", icon: "fa-file-signature", colorClass: "warning" },
      { title: "Quotation", desc: "View and compare vendor quotations", icon: "fa-comments-dollar", colorClass: "warning" },
      { title: "Purchase Orders", desc: "Track and analyze all purchase orders", icon: "fa-shopping-cart", colorClass: "success" },
      { title: "ASN", desc: "View Advance Shipping Notices", icon: "fa-truck", colorClass: "warning" },
      { title: "Gate Entry", desc: "Monitor security gate check-ins and logs", icon: "fa-door-open", colorClass: "info" },
      { title: "Material Inward", desc: "Verify and receive incoming material against gate entries", icon: "fa-box-open", colorClass: "success" },
      { title: "Stock", desc: "Manage store inventory and stock levels", icon: "fa-cubes", colorClass: "success" },
      { title: "Invoice", desc: "Track pending and completed invoices", icon: "fa-file-invoice-dollar", colorClass: "success" },
      { title: "Vendor Payment", desc: "Track vendor payments", icon: "fa-wallet", colorClass: "secondary" },
      { title: "Vendor Returns", desc: "Manage purchase returns and debit notes", icon: "fa-undo", colorClass: "danger" },
      { title: "Work Flow Approval", desc: "View and manage pending workflow requests", icon: "fa-check-circle", colorClass: "primary" },
      { title: "Dashboards", desc: "Reports published for everyone in your team", icon: "fa-chart-pie", colorClass: "info" },
    ];

    const routeMap = {
      "Vendor List": "vendorList",
      "Material List": "material",
      "Indent": "indent",
      "Purchase Requisition": "pr",
      "Request for Quotation": "rfq",
      "Quotation": "quotation",
      "Purchase Orders": "po",
      "ASN": "asn",
      "Gate Entry": "gate-entry",
      "Material Inward": "material-inward",
      "Stock": "stock",
      "Invoice": "invoice",
      "Vendor Payment": "vendor-payment",
      "Vendor Returns": "vendor-returns",
      "Work Flow Approval": "admin-workflows",
      "Dashboards": "dashboards"
    };

    return (
      <div className="container-fluid py-4 bg-light bg-opacity-50 min-vh-100 fade-in-slide">
        <div className="row g-4">
          {/* Render standard cards */}
          {cards.map((card, idx) => (
            <div key={idx} className="col-12 col-sm-6 col-md-4 col-lg-3">
              <div className="card h-100 shadow-sm border-0" style={{ borderRadius: '12px' }}>
                <div className="card-body text-center p-4 d-flex flex-column align-items-center">
                  <div className={`rounded-circle bg-light d-flex align-items-center justify-content-center mb-3 text-${card.colorClass}`} style={{ width: '60px', height: '60px' }}>
                    <i className={`fas ${card.icon} fs-4`}></i>
                  </div>
                  <h5 className="fw-bold mb-2 text-dark">{card.title}</h5>
                  <p className="text-muted small mb-4">{card.desc}</p>
                  <button 
                    className={`btn btn-outline-${card.colorClass} w-100 mt-auto rounded-pill fw-medium`}
                    onClick={(e) => handleNavigation(e, routeMap[card.title])}
                    style={{ fontSize: '14px' }}
                  >
                    View Details <i className="fas fa-arrow-right ms-1"></i>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Which of the 4 "Procure to pay" tiles show for the currently selected company code.
  // myDocTypeSelections is null until the fetch resolves — showing "all 4" during that brief
  // window (as if nothing were ever recorded) is exactly as wrong as showing none, it's just a
  // different flash of incorrect content before the real answer arrives a moment later. Show
  // nothing while genuinely still loading; only fall back to "all 4" once the fetch has actually
  // come back and confirmed there's nothing recorded for this vendor/company (predates this
  // feature, or truly not yet decided).
  const picksForCompany = myDocTypeSelections === null
    ? null
    : myDocTypeSelections.filter((s) => s.companyCode === selectedCompanyCode);
  const visibleTiles = picksForCompany === null
    ? new Set()
    : picksForCompany.length === 0
      ? new Set(ALL_PROCURE_TILES)
      : new Set(picksForCompany.flatMap((s) => CLASSIFICATION_TILES[s.classification] || []));

  // Vendor Portal Dashboard UI
  return (
    <div className="supplier-portal-home">
      <div className="wrap">


        {/* greeting */}
        <div className="hello">
          <div>
            <h1>{vendorName || currentUser?.firstName || 'Vendor'}</h1>
          </div>
        </div>

        <div className="tile-grid">

          {picksForCompany === null && (
            <div className="tile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
              <div className="d-flex align-items-center gap-2 text-muted">
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                <span>Loading what you're approved for…</span>
              </div>
            </div>
          )}

          {/* Procure to pay: Products */}
          {visibleTiles.has('products') && (
          <div className="tile" onClick={(e) => handleNavigation(e, 'pr')}>
            <div className="thead">
              <div className="ico i-blue">
                <svg viewBox="0 0 24 24"><path d="M3.6 8 12 4l8.4 4v8L12 20l-8.4-4z" /><path d="M3.6 8 12 12l8.4-4" /><path d="M12 12v8" /><path d="M7.8 6 16.2 10" /></svg>
              </div>
              <div><div className="tname">Procure to pay</div><div className="tkind">Products · material PO</div></div>
            </div>

            <div className="chain">
              <span className="node" onClick={(e) => handleNavigation(e, 'pr-approval-report')}><i className="ni c-violet"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 3.4h8L18 6.9v13.7H6.4z" /><path d="M14.4 3.4v3.5h3.6" /><path d="M9.2 11h5.6M9.2 14.2h5.6M9.2 17.4h3.2" /></svg></i><span className="nl">Quotation Acknowledgement</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'quotation')}><i className="ni c-amber"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.6 5.2h16.8v9.8h-8.2L7.6 18.8v-3.8H3.6z" /><path d="M12 7.4v5.4" /><path d="M13.7 8.7a1.7 1.7 0 0 0-3.1.5c0 1.6 3 .9 3 2.4a1.7 1.7 0 0 1-3.1.5" /></svg></i><span className="nl">Quotation</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'po')}><i className="ni c-teal"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9.8" cy="19" r="1.5" /><circle cx="17.4" cy="19" r="1.5" /><path d="M2.6 4h2.7l2.5 11.4h10.6l1.9-7.8H7.3" /></svg></i><span className="nl">Purchase Orders</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'asn')}><i className="ni c-orange"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 7.2h9.6v8.6H2.8z" /><path d="M12.4 10.2h3.7l2.6 2.9v2.7h-6.3z" /><circle cx="6.6" cy="17.8" r="1.7" /><circle cx="16.4" cy="17.8" r="1.7" /></svg></i><span className="nl">ASN</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'gate-entry')}><i className="ni c-blue"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20.6V7.4h7.4v13.2" /><path d="M11.4 12.4h8.6v8.2h-8.6" /><path d="M7 10.6h1.4M7 14.2h1.4" /><path d="M14.4 16.4h3.8M16.6 14.6l1.8 1.8-1.8 1.8" /></svg></i><span className="nl">Gate Entry</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'stock')}><i className="ni c-teal"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6.4" r="2.5" /><circle cx="6.8" cy="16.2" r="2.5" /><circle cx="17.2" cy="16.2" r="2.5" /><path d="M10.7 8.6 8.1 13.9M13.3 8.6l2.6 5.3M9.3 16.2h5.4" /></svg></i><span className="nl">Stock</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'invoice')}><i className="ni c-teal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 3.4h8L18 7v13.6H6.2z" /><path d="M14.2 3.4v3.6H18" /><path d="M12 9.8v7" /><path d="M13.7 11a1.6 1.6 0 0 0-3-.4c0 1.5 3 .8 3 2.3a1.6 1.6 0 0 1-3 .4" /></svg></i><span className="nl">Invoice</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'vendor-payment')}><i className="ni c-green"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 6.8h17.2v10.4H3.4z" /><path d="M3.4 10.4h17.2" /><path d="M6.6 14.2h3.6" /></svg></i><span className="nl">Vendor Payment</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'vendor-returns')}><i className="ni c-red"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.4 5.4v5.4h5.4" /><path d="M5.2 10.6a7.4 7.4 0 1 1 1.2 5.6" /></svg></i><span className="nl">Vendor Returns</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'credit-note')}><i className="ni c-pink"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 3.4h8L18 7v4.4" /><path d="M14.2 3.4v3.6H18" /><path d="M6.2 3.4v17.2h5.6" /><path d="M20.4 13.4 14.8 19l-2.8.8.8-2.8 5.6-5.6z" /></svg></i><span className="nl">Credit Notes</span></span>
            </div>
          </div>
          )}

          {/* Procure to pay: Services */}
          {visibleTiles.has('services') && (
          <div className="tile" onClick={(e) => handleNavigation(e, 'pr')}>
            <div className="thead">
              <div className="ico i-pine">
                <svg viewBox="0 0 24 24"><path d="M15.2 3.4a5.2 5.2 0 0 0-4.4 7.9l-7 7a2.1 2.1 0 0 0 3 3l7-7a5.2 5.2 0 0 0 6.6-6.7l-3 3-2.9-.7-.7-2.9 3-3a5.2 5.2 0 0 0-1.6-.6Z" /></svg>
              </div>
              <div><div className="tname">Procure to pay</div><div className="tkind">Services · service PO</div></div>
            </div>
            <div className="chain">
              <span className="node" onClick={(e) => handleNavigation(e, 'pr-approval-report')}><i className="ni c-violet"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.4 3.4h8L18 6.9v13.7H6.4z" /><path d="M14.4 3.4v3.5h3.6" /><path d="M9.2 11h5.6M9.2 14.2h5.6M9.2 17.4h3.2" /></svg></i><span className="nl">Quotation Acknowledgement</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'quotation')}><i className="ni c-amber"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.6 5.2h16.8v9.8h-8.2L7.6 18.8v-3.8H3.6z" /><path d="M12 7.4v5.4" /><path d="M13.7 8.7a1.7 1.7 0 0 0-3.1.5c0 1.6 3 .9 3 2.4a1.7 1.7 0 0 1-3.1.5" /></svg></i><span className="nl">Quotation</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'po')}><i className="ni c-teal"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9.8" cy="19" r="1.5" /><circle cx="17.4" cy="19" r="1.5" /><path d="M2.6 4h2.7l2.5 11.4h10.6l1.9-7.8H7.3" /></svg></i><span className="nl">Purchase Orders</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'po')}><i className="ni c-violet"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.4h12v17.2H6z" /><path d="M9 8.4h6M9 12h6M9 15.6h3.4" /></svg></i><span className="nl">Service Entry Sheet</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'po')}><i className="ni c-green"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2" /><path d="M8.4 12.2l2.6 2.6 4.8-4.8" /></svg></i><span className="nl">Acceptance</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'invoice')}><i className="ni c-teal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 3.4h8L18 7v13.6H6.2z" /><path d="M14.2 3.4v3.6H18" /><path d="M12 9.8v7" /><path d="M13.7 11a1.6 1.6 0 0 0-3-.4c0 1.5 3 .8 3 2.3a1.6 1.6 0 0 1-3 .4" /></svg></i><span className="nl">Invoice</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'vendor-payment')}><i className="ni c-green"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 6.8h17.2v10.4H3.4z" /><path d="M3.4 10.4h17.2" /><path d="M6.6 14.2h3.6" /></svg></i><span className="nl">Vendor Payment</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'credit-note')}><i className="ni c-pink"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 3.4h8L18 7v4.4" /><path d="M14.2 3.4v3.6H18" /><path d="M6.2 3.4v17.2h5.6" /><path d="M20.4 13.4 14.8 19l-2.8.8.8-2.8 5.6-5.6z" /></svg></i><span className="nl">Credit Notes</span></span>
            </div>
          </div>
          )}

          {/* Procure to pay: Subcontracting */}
          {visibleTiles.has('subcontracting') && (
          <div className="tile" onClick={(e) => handleNavigation(e, 'po')}>
            <div className="thead">
              <div className="ico i-amber">
                <svg viewBox="0 0 24 24"><path d="M3.6 8h11.6" /><path d="M12.4 5.2 15.2 8l-2.8 2.8" /><path d="M20.4 16H8.8" /><path d="M11.6 13.2 8.8 16l2.8 2.8" /></svg>
              </div>
              <div><div className="tname">Procure to pay</div><div className="tkind">Subcontracting · job work</div></div>
            </div>
            <div className="chain">
              <span className="node" onClick={(e) => handleNavigation(e, 'po')}><i className="ni c-teal"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9.8" cy="19" r="1.5" /><circle cx="17.4" cy="19" r="1.5" /><path d="M2.6 4h2.7l2.5 11.4h10.6l1.9-7.8H7.3" /></svg></i><span className="nl">Purchase Orders</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'asn')}><i className="ni c-amber"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 8.6 8 6l4.6 2.6v5.2L8 16.4l-4.6-2.6z" /><path d="M15.6 12h5.2" /><path d="M18.4 9.4 21 12l-2.6 2.6" /></svg></i><span className="nl">Components Issued</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'asn')}><i className="ni c-orange"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 7.2h9.6v8.6H2.8z" /><path d="M12.4 10.2h3.7l2.6 2.9v2.7h-6.3z" /><circle cx="6.6" cy="17.8" r="1.7" /><circle cx="16.4" cy="17.8" r="1.7" /></svg></i><span className="nl">ASN</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'gate-entry')}><i className="ni c-blue"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20.6V7.4h7.4v13.2" /><path d="M11.4 12.4h8.6v8.2h-8.6" /><path d="M7 10.6h1.4M7 14.2h1.4" /><path d="M14.4 16.4h3.8M16.6 14.6l1.8 1.8-1.8 1.8" /></svg></i><span className="nl">Gate Entry</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'stock')}><i className="ni c-teal"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6.4" r="2.5" /><circle cx="6.8" cy="16.2" r="2.5" /><circle cx="17.2" cy="16.2" r="2.5" /><path d="M10.7 8.6 8.1 13.9M13.3 8.6l2.6 5.3M9.3 16.2h5.4" /></svg></i><span className="nl">Stock</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'invoice')}><i className="ni c-teal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 3.4h8L18 7v13.6H6.2z" /><path d="M14.2 3.4v3.6H18" /><path d="M12 9.8v7" /><path d="M13.7 11a1.6 1.6 0 0 0-3-.4c0 1.5 3 .8 3 2.3a1.6 1.6 0 0 1-3 .4" /></svg></i><span className="nl">Invoice</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'vendor-payment')}><i className="ni c-green"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 6.8h17.2v10.4H3.4z" /><path d="M3.4 10.4h17.2" /><path d="M6.6 14.2h3.6" /></svg></i><span className="nl">Vendor Payment</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'vendor-returns')}><i className="ni c-red"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.4 5.4v5.4h5.4" /><path d="M5.2 10.6a7.4 7.4 0 1 1 1.2 5.6" /></svg></i><span className="nl">Vendor Returns</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'credit-note')}><i className="ni c-pink"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 3.4h8L18 7v4.4" /><path d="M14.2 3.4v3.6H18" /><path d="M6.2 3.4v17.2h5.6" /><path d="M20.4 13.4 14.8 19l-2.8.8.8-2.8 5.6-5.6z" /></svg></i><span className="nl">Credit Notes</span></span>
            </div>
          </div>
          )}

          {/* Procure to pay: Scheduling agreement */}
          {visibleTiles.has('scheduling') && (
          <div className="tile" onClick={(e) => handleNavigation(e, 'po')}>
            <div className="thead">
              <div className="ico i-violet">
                <svg viewBox="0 0 24 24"><path d="M4 5.6h16v14.2H4V5.6Z" /><path d="M4 10h16" /><path d="M8.2 3.4v4.2M15.8 3.4v4.2" /><path d="M7.6 13.4h2.2M7.6 16.6h2.2M13.4 13.4h3.4M13.4 16.6h3.4" /></svg>
              </div>
              <div><div className="tname">Procure to pay</div><div className="tkind">Scheduling agreement · releases</div></div>
            </div>
            <div className="chain">
              <span className="node" onClick={(e) => handleNavigation(e, 'po')}><i className="ni c-violet"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.6 6h14.8v14.4H4.6z" /><path d="M4.6 10h14.8" /><path d="M8.6 3.6v4M15.4 3.6v4" /><path d="M8.2 13.4h2M8.2 16.8h2M13.8 13.4h2M13.8 16.8h2" /></svg></i><span className="nl">Scheduling Agreement</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'po')}><i className="ni c-violet"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.6 6h14.8v14.4H4.6z" /><path d="M4.6 10h14.8" /><path d="M8.6 3.6v4M15.4 3.6v4" /><path d="M8.6 15.6h6" /><path d="M12.6 13.4l2.2 2.2-2.2 2.2" /></svg></i><span className="nl">Schedule Release</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'asn')}><i className="ni c-orange"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 7.2h9.6v8.6H2.8z" /><path d="M12.4 10.2h3.7l2.6 2.9v2.7h-6.3z" /><circle cx="6.6" cy="17.8" r="1.7" /><circle cx="16.4" cy="17.8" r="1.7" /></svg></i><span className="nl">ASN</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'gate-entry')}><i className="ni c-blue"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20.6V7.4h7.4v13.2" /><path d="M11.4 12.4h8.6v8.2h-8.6" /><path d="M7 10.6h1.4M7 14.2h1.4" /><path d="M14.4 16.4h3.8M16.6 14.6l1.8 1.8-1.8 1.8" /></svg></i><span className="nl">Gate Entry</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'stock')}><i className="ni c-teal"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="6.4" r="2.5" /><circle cx="6.8" cy="16.2" r="2.5" /><circle cx="17.2" cy="16.2" r="2.5" /><path d="M10.7 8.6 8.1 13.9M13.3 8.6l2.6 5.3M9.3 16.2h5.4" /></svg></i><span className="nl">Stock</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'invoice')}><i className="ni c-teal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 3.4h8L18 7v13.6H6.2z" /><path d="M14.2 3.4v3.6H18" /><path d="M12 9.8v7" /><path d="M13.7 11a1.6 1.6 0 0 0-3-.4c0 1.5 3 .8 3 2.3a1.6 1.6 0 0 1-3 .4" /></svg></i><span className="nl">Invoice</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'vendor-payment')}><i className="ni c-green"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 6.8h17.2v10.4H3.4z" /><path d="M3.4 10.4h17.2" /><path d="M6.6 14.2h3.6" /></svg></i><span className="nl">Vendor Payment</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'vendor-returns')}><i className="ni c-red"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.4 5.4v5.4h5.4" /><path d="M5.2 10.6a7.4 7.4 0 1 1 1.2 5.6" /></svg></i><span className="nl">Vendor Returns</span></span>
              <span className="node" onClick={(e) => handleNavigation(e, 'credit-note')}><i className="ni c-pink"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.2 3.4h8L18 7v4.4" /><path d="M14.2 3.4v3.6H18" /><path d="M6.2 3.4v17.2h5.6" /><path d="M20.4 13.4 14.8 19l-2.8.8.8-2.8 5.6-5.6z" /></svg></i><span className="nl">Credit Notes</span></span>
            </div>
          </div>
          )}

          {/* Reference and reconciliation */}
          <div className="tile small" onClick={(e) => handleNavigation(e, 'material-report')}>
            <div className="thead">
              <div className="ico i-blue">
                <svg viewBox="0 0 24 24"><path d="M9 6.4h11M9 12h11M9 17.6h11" /><path d="M4.6 6.4h.02M4.6 12h.02M4.6 17.6h.02" /></svg>
              </div>
              <div><div className="tname">Material List</div><div className="tkind">Parts · specifications · revisions</div></div>
            </div>
            {/* <div className="tdesc">Every part you are approved to supply, with its current drawing revision.</div> */}
          </div>

          <div className="tile small" onClick={(e) => handleNavigation(e, 'gst-reconciliation')}>
            <div className="thead">
              <div className="ico i-blue">
                <svg viewBox="0 0 24 24"><path d="M3.4 9.6 12 4.5l8.6 5.1" /><path d="M5.6 9.8v8.8M9.8 9.8v8.8M14.2 9.8v8.8M18.4 9.8v8.8" /><path d="M3 19.4h18" /></svg>
              </div>
              <div><div className="tname">GST Reconciliation</div><div className="tkind">Returns · ITC · 2B matching</div></div>
            </div>
            {/* <div className="tdesc">Your invoices as they appear to us in GSTR-2B.</div> */}
          </div>

          <div className="tile small" onClick={(e) => handleNavigation(e, 'tds-recon')}>
            <div className="thead">
              <div className="ico i-violet">
                <svg viewBox="0 0 24 24"><path d="M6.4 17.6 17.6 6.4" /><circle cx="8" cy="8" r="2.3" /><circle cx="16" cy="16" r="2.3" /></svg>
              </div>
              <div><div className="tname">TDS Reconciliation</div><div className="tkind">Deductions · 26AS · certificates</div></div>
            </div>
            {/* <div className="tdesc">Every deduction made against your PAN, with certificates to download.</div> */}
          </div>

          <div className="tile small" onClick={(e) => handleNavigation(e, 'reports')}>
            <div className="thead">
              <div className="ico i-pine">
                <svg viewBox="0 0 24 24"><path d="M6.2 3.4h8L18 7v13.6H6.2z" /><path d="M14.2 3.4v3.6H18" /><path d="M9.4 17.2v-3.4M12 17.2v-6.2M14.6 17.2v-4.6" /></svg>
              </div>
              <div><div className="tname">Reports</div><div className="tkind">Scorecard · ledger · statements</div></div>
            </div>
            {/* <div className="tdesc">Your scorecard, ledger and registers, downloadable as Excel or PDF.</div> */}
          </div>

        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
