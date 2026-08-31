import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function OnboardingComplianceDashboard({ onBack }) {
  const [data, setData] = useState({
    total: 0,
    fully_compliant: 0,
    compliance_percentage: 0,
    missing_docs: 0,
    expiring_soon: 0,
    coi_percentage: 0,
    gst_percentage: 0,
    pan_percentage: 0,
    top_missing: []
  });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const handleEditClick = (label) => {
    setSelectedDoc(label);
    setShowModal(true);
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user_data');
    let queryParam = '';
    
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        let role = String(user.role || '').toUpperCase();
        
        // Handle various key formats for vendor ID from different login APIs
        let companyId = user.company_id || user.companyId || user.vendor_id || user.vendorId || user.id;
        
        // Temporary override for testing: Treat markjhon@gmail.com as a Vendor for the dashboard demo
        if (user.email === 'markjhon@gmail.com') {
          role = 'VENDOR';
          companyId = 8;
        }
        
        if ((role === 'VENDOR' || role === 'VENDOR_ADMIN' || companyId) && companyId) {
          queryParam = `?vendor_id=${companyId}`;
        }
      } catch (e) {
        console.error("Could not parse user data", e);
      }
    }

    axios.get(`/api/dashboard/onboarding-compliance/summary${queryParam}`)
      .then(r => {
        setData({
          total: r.data.total || 0,
          fully_compliant: r.data.fully_compliant || 0,
          compliance_percentage: r.data.compliance_percentage || 0,
          missing_docs: r.data.missing_docs || 0,
          expiring_soon: r.data.expiring_soon || 0,
          coi_percentage: r.data.coi_percentage || 0,
          gst_percentage: r.data.gst_percentage || 0,
          pan_percentage: r.data.pan_percentage || 0,
          top_missing: r.data.top_missing || []
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
    
    axios.get(`/api/dashboard/onboarding-compliance/alerts${queryParam}`)
      .then(r => setAlerts(r.data.alerts || []))
      .catch(() => setAlerts([]));
  }, []);

  if (loading) return (
    <div className="p-5 text-center text-muted">
      <div className="spinner-border text-primary" role="status"></div>
      <br/><br/>Loading Compliance Dashboard...
    </div>
  );

  const complianceData = [
    { name: 'Compliant', value: data.compliance_percentage, color: '#0E7C86' },
    { name: 'Non-Compliant', value: 100 - data.compliance_percentage, color: '#C81017' }
  ];

  const extendedCoverage = [
    { label: 'Certificate of Incorporation', value: data.coi_percentage },
    { label: 'GST Registration', value: data.gst_percentage },
    { label: 'PAN Card', value: data.pan_percentage },
    { label: 'TDS Registration', value: 96 },
    { label: 'GST-PAN Linkage', value: 94 },
    { label: 'Bank Account Verification', value: 91 },
    { label: 'ITR Returns Filing', value: 88 },
    { label: 'WHT (International)', value: 85 },
    { label: 'MSME / Udyam', value: 78 },
    { label: 'Form 10F (International)', value: 70 },
    { label: 'ISO 27001', value: 64 },
    { label: 'NABL Accreditation', value: 52 },
    { label: 'AS 9011', value: 48 }
  ];

  const topMissing = data.top_missing && data.top_missing.length > 0 
    ? data.top_missing 
    : [
        { name: 'All Required Documents Submitted', count: 0 }
      ];

  return (
    <div className="container-fluid py-4 fade-in-slide" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Poppins", sans-serif' }}>
      {onBack && (
        <div 
          onClick={onBack} 
          className="d-inline-flex align-items-center text-muted mb-3 cursor-pointer" 
          style={{ cursor: 'pointer', transition: 'color 0.2s ease' }}
        >
          <i className="fas fa-arrow-left me-2"></i>
          <span className="fw-medium">Back to Reports</span>
        </div>
      )}
      {/* Top Header */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-3">
        <div>
          <div className="text-success small fw-bold text-uppercase mb-1" style={{ letterSpacing: '0.5px' }}>P2P Automation › Vendors</div>
          <h3 className="fw-bold text-dark mb-0">Onboarding & compliance</h3>
        </div>
        {data.total !== 1 && (
          <div>
            <span className="badge rounded-pill bg-dark py-2 px-3 fs-6">1,248 PR · 1,116 PO · ₹53.7 Cr</span>
          </div>
        )}
      </div>

      {/* Pipeline Status Bar (Mock) */}
      {data.total !== 1 && (
        <div className="d-flex w-100 rounded-3 overflow-hidden mb-4 shadow-sm flex-wrap" style={{ backgroundColor: '#64748b', minHeight: '60px' }}>
        <div className="px-3 py-2 text-white border-end border-light border-opacity-25" style={{flex: '1 1 auto', backgroundColor: 'rgba(255,255,255,0.1)'}}>
          <div className="small text-white-50"><i className="fas fa-circle text-success me-1" style={{fontSize:'8px'}}></i> PR</div>
          <div className="fw-bold">94% <span className="fw-normal small text-white-50 ms-1">budget verified</span></div>
        </div>
        <div className="px-3 py-2 text-white border-end border-light border-opacity-25" style={{flex: '1 1 auto'}}>
          <div className="small text-white-50"><i className="fas fa-circle text-success me-1" style={{fontSize:'8px'}}></i> PR appr.</div>
          <div className="fw-bold">84% <span className="fw-normal small text-white-50 ms-1">SLA 2d</span></div>
        </div>
        <div className="px-3 py-2 text-white border-end border-light border-opacity-25" style={{flex: '1 1 auto'}}>
          <div className="small text-white-50"><i className="fas fa-circle text-success me-1" style={{fontSize:'8px'}}></i> Quotation</div>
          <div className="fw-bold">81% <span className="fw-normal small text-white-50 ms-1">SLA 5d</span></div>
        </div>
        <div className="px-3 py-2 text-white border-end border-light border-opacity-25" style={{flex: '1 1 auto'}}>
          <div className="small text-white-50"><i className="fas fa-circle text-success me-1" style={{fontSize:'8px'}}></i> PO appr.</div>
          <div className="fw-bold">89% <span className="fw-normal small text-white-50 ms-1">SLA 3d</span></div>
        </div>
        <div className="px-3 py-2 text-white border-end border-light border-opacity-25" style={{flex: '1 1 auto'}}>
          <div className="small text-white-50"><i className="fas fa-circle text-warning me-1" style={{fontSize:'8px'}}></i> ASN</div>
          <div className="fw-bold">71% <span className="fw-normal small text-white-50 ms-1">compliant</span></div>
        </div>
        <div className="px-3 py-2 text-white border-end border-light border-opacity-25" style={{flex: '1 1 auto'}}>
          <div className="small text-white-50"><i className="fas fa-circle text-success me-1" style={{fontSize:'8px'}}></i> Delivery</div>
          <div className="fw-bold">82% <span className="fw-normal small text-white-50 ms-1">OTIF</span></div>
        </div>
        <div className="px-3 py-2 text-white border-end border-light border-opacity-25" style={{flex: '1 1 auto'}}>
          <div className="small text-white-50"><i className="fas fa-circle text-warning me-1" style={{fontSize:'8px'}}></i> GRN</div>
          <div className="fw-bold">76% <span className="fw-normal small text-white-50 ms-1">SLA 48h</span></div>
        </div>
        <div className="px-3 py-2 text-white border-end border-light border-opacity-25" style={{flex: '1 1 auto'}}>
          <div className="small text-white-50"><i className="fas fa-circle text-success me-1" style={{fontSize:'8px'}}></i> Invoice</div>
          <div className="fw-bold">89% <span className="fw-normal small text-white-50 ms-1">3-way pass</span></div>
        </div>
        <div className="px-3 py-2 text-white" style={{flex: '1 1 auto'}}>
          <div className="small text-white-50"><i className="fas fa-circle text-success me-1" style={{fontSize:'8px'}}></i> GST/TDS</div>
          <div className="fw-bold">91% <span className="fw-normal small text-white-50 ms-1">ITC matched</span></div>
        </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="row g-4 mb-4">
        <div className="col-lg-3 col-md-6">
          <div className="card h-100 border-0 shadow-sm" style={{borderRadius: '16px'}}>
            <div className="card-body p-4 position-relative">
              <div className="d-flex justify-content-between">
                <span className="text-muted fw-semibold small">{data.total === 1 ? 'Vendor Account' : 'Vendors onboarded'}</span>
                <div className="bg-primary bg-opacity-10 text-primary rounded d-flex align-items-center justify-content-center" style={{width: '36px', height: '36px'}}><i className="fas fa-users fs-5"></i></div>
              </div>
              <h2 className="fw-bold text-dark mt-3 mb-1" style={{fontSize: '2rem'}}>{data.total === 1 ? 'Active' : data.total}</h2>
              <span className="text-muted small">{data.total === 1 ? 'Your profile is live' : 'domestic + international'}</span>
            </div>
          </div>
        </div>
        
        <div className="col-lg-3 col-md-6">
          <div className="card h-100 border-0 shadow-sm" style={{borderRadius: '16px'}}>
            <div className="card-body p-4 position-relative">
              <div className="d-flex justify-content-between">
                <span className="text-muted fw-semibold small">{data.total === 1 ? 'Your Compliance' : 'Fully compliant'}</span>
                <div className="border border-success text-success rounded d-flex align-items-center justify-content-center" style={{width: '36px', height: '36px'}}><i className="fas fa-shield-alt fs-5"></i></div>
              </div>
              <h2 className="fw-bold text-dark mt-3 mb-1" style={{fontSize: '2rem'}}>{data.compliance_percentage}%</h2>
              <span className="text-muted small">{data.total === 1 ? (data.compliance_percentage === 100 ? 'All docs valid' : 'Action required') : `${data.fully_compliant} vendors · all docs valid`}</span>
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-md-6">
          <div className="card h-100 border-0 shadow-sm" style={{borderRadius: '16px'}}>
            <div className="card-body p-4 position-relative">
              <div className="d-flex justify-content-between">
                <span className="text-muted fw-semibold small">Missing documents</span>
                <div className="border border-warning text-warning rounded d-flex align-items-center justify-content-center" style={{width: '36px', height: '36px'}}><i className="fas fa-exclamation-triangle fs-5"></i></div>
              </div>
              <h2 className="fw-bold text-dark mt-3 mb-1" style={{fontSize: '2rem'}}>{data.missing_docs}</h2>
              <span className="text-muted small">1+ statutory doc not on file</span>
            </div>
          </div>
        </div>

        <div className="col-lg-3 col-md-6">
          <div className="card h-100 border-0 shadow-sm" style={{borderRadius: '16px'}}>
            <div className="card-body p-4 position-relative">
              <div className="d-flex justify-content-between">
                <span className="text-muted fw-semibold small">Expiring in 30 days</span>
                <div className="border border-danger text-danger rounded d-flex align-items-center justify-content-center" style={{width: '36px', height: '36px'}}><i className="fas fa-clock fs-5"></i></div>
              </div>
              <h2 className="fw-bold text-dark mt-3 mb-1" style={{fontSize: '2rem'}}>{data.expiring_soon}</h2>
              <span className="text-muted small">certificates up for renewal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="row g-4">
        {/* Left Column (2/3) */}
        <div className="col-lg-8">
          {/* COMPLIANCE COVERAGE */}
          <div className="card border-0 shadow-sm mb-4" style={{borderRadius: '16px'}}>
            <div className="card-body p-4">
              <h6 className="fw-bold text-dark mb-1 text-uppercase" style={{fontSize: '14px', letterSpacing: '0.5px'}}>Compliance Coverage</h6>
              <p className="text-muted small mb-4">% of vendors with each document valid</p>

              <div className="row g-3">
                {extendedCoverage.map((item, i) => (
                  <div className="col-12" key={i}>
                    <div className="d-flex justify-content-between mb-1" style={{fontSize: '13px'}}>
                      <span className="text-secondary">{item.label}</span>
                      <span className="fw-bold text-dark">{item.value}%</span>
                    </div>
                    <div className="d-flex align-items-center gap-3">
                      <div className="progress rounded-pill bg-light flex-grow-1" style={{height: '8px'}}>
                        <div 
                          className={`progress-bar rounded-pill ${item.value >= 90 ? 'bg-success' : item.value >= 70 ? 'bg-warning' : 'bg-danger'}`} 
                          role="progressbar" 
                          style={{width: `${item.value}%`, backgroundColor: item.value >= 90 ? '#0E7C86' : undefined}}
                        ></div>
                      </div>
                      <button 
                        onClick={() => handleEditClick(item.label)}
                        className="btn btn-sm btn-light border p-1 rounded-circle d-flex align-items-center justify-content-center" 
                        style={{width: '24px', height: '24px', flexShrink: 0}} 
                        title="Edit Document Coverage"
                      >
                        <i className="fas fa-edit text-muted" style={{fontSize: '11px'}}></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ACTIVE COMPLIANCE ALERTS */}
          <div className="card border-0 shadow-sm" style={{borderRadius: '16px'}}>
            <div className="card-body p-4">
              <h6 className="fw-bold text-dark mb-1 text-uppercase" style={{fontSize: '14px', letterSpacing: '0.5px'}}>{data.total === 1 ? 'Your Alerts' : 'Active Compliance Alerts'}</h6>
              <p className="text-muted small mb-3">auto-notify · escalate on no response</p>
              
              <div className="table-responsive">
                <table className="table table-borderless align-middle mb-0" style={{fontSize: '13px'}}>
                  <thead>
                    <tr className="text-muted small border-bottom">
                      <th className="fw-semibold px-0 text-uppercase" style={{letterSpacing: '0.5px'}}>Vendor</th>
                      <th className="fw-semibold text-uppercase" style={{letterSpacing: '0.5px'}}>Document</th>
                      <th className="fw-semibold text-center text-uppercase" style={{letterSpacing: '0.5px'}}>Status</th>
                      <th className="fw-semibold text-end px-0 text-uppercase" style={{letterSpacing: '0.5px'}}>Notification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alerts && alerts.length > 0 ? alerts.map((alert, i) => (
                      <tr key={i} className="border-bottom">
                        <td className="px-0 text-dark">{alert.vendor}</td>
                        <td className="text-secondary">{alert.document}</td>
                        <td className="text-center">
                          <span className={`badge border ${alert.status === 'MISSING' ? 'border-danger text-danger' : 'border-warning text-warning'} bg-white px-3 py-1 rounded-pill`} style={{fontSize: '11px', letterSpacing: '0.5px'}}>
                            {alert.status}
                          </span>
                        </td>
                        <td className="text-end px-0 text-secondary">{alert.notification}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan="4" className="text-center py-4 text-muted">No active alerts</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="d-flex flex-wrap gap-2 mt-4">
                <span className="badge bg-light text-secondary border px-3 py-2 fw-normal rounded-pill">Missing at onboarding → instant alert</span>
                <span className="badge bg-light text-secondary border px-3 py-2 fw-normal rounded-pill">Expiry reminders at 30 / 15 / 7 days</span>
                <span className="badge bg-light text-secondary border px-3 py-2 fw-normal rounded-pill">No response → escalate + hold new POs</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1/3) */}
        <div className="col-lg-4">
          {/* COMPLIANCE STATUS (Donut) */}
          <div className="card border-0 shadow-sm mb-4" style={{borderRadius: '16px'}}>
            <div className="card-body p-4 text-center position-relative">
              <h6 className="fw-bold text-dark mb-1 text-start text-uppercase" style={{fontSize: '14px', letterSpacing: '0.5px'}}>Compliance Status</h6>
              <p className="text-muted small mb-4 text-start">{data.total} vendors onboarded</p>
              
              <div className="position-relative mx-auto mb-4" style={{width: '200px', height: '200px'}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={complianceData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} dataKey="value" stroke="none">
                      {complianceData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="position-absolute top-50 start-50 translate-middle text-center">
                  <h2 className="fw-bold mb-0 text-dark" style={{fontSize: '2rem'}}>{data.compliance_percentage}%</h2>
                  <span className="small text-muted">compliant</span>
                </div>
              </div>

              <div className="text-start mt-2">
                <div className="d-flex justify-content-between small mb-2 align-items-center">
                  <span><i className="fas fa-circle text-success me-2" style={{fontSize:'10px', color: '#0E7C86'}}></i> Fully compliant</span>
                  <span className="fw-bold text-dark">{data.fully_compliant} <span className="text-muted fw-normal ms-1">({data.compliance_percentage}%)</span></span>
                </div>
                <div className="d-flex justify-content-between small align-items-center">
                  <span><i className="fas fa-circle text-danger me-2" style={{fontSize:'10px', color: '#C81017'}}></i> Non-compliant</span>
                  <span className="fw-bold text-dark">{data.total - data.fully_compliant} <span className="text-muted fw-normal ms-1">({100 - data.compliance_percentage}%)</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* TOP MISSING DOCUMENTS */}
          <div className="card border-0 shadow-sm mb-4" style={{borderRadius: '16px'}}>
            <div className="card-body p-4">
              <h6 className="fw-bold text-dark mb-4 text-uppercase" style={{fontSize: '14px', letterSpacing: '0.5px'}}>{data.total === 1 ? 'Your Missing Documents' : 'Top Missing Documents'}</h6>
              <div className="d-flex flex-column gap-3">
                {topMissing.map((doc, i) => (
                  <div key={i}>
                    <div className="d-flex justify-content-between small mb-2">
                      <span className="text-dark fw-medium">{doc.name}</span>
                      <span className="fw-bold text-dark">{doc.count} <span className="text-muted fw-normal">{data.total === 1 ? 'missing' : (doc.count === 1 ? 'vendor' : 'vendors')}</span></span>
                    </div>
                    {doc.count > 0 && (
                      <div className="progress rounded-pill bg-light" style={{height: '6px'}}>
                        <div className="progress-bar bg-danger rounded-pill" role="progressbar" style={{width: `${(doc.count/Math.max(data.total, 1))*100}%`, backgroundColor: '#C81017'}}></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* VERIFICATION CHECKLIST */}
          <div className="card border-0 shadow-sm" style={{borderRadius: '16px', backgroundColor: '#f8fafc'}}>
            <div className="card-body p-4">
              <h6 className="fw-bold text-dark mb-1 text-uppercase" style={{fontSize: '14px', letterSpacing: '0.5px'}}>Verification Checklist</h6>
              <p className="text-muted small mb-4">validated by API before go-live</p>
              
              <div className="mb-4">
                <div className="d-flex align-items-center mb-3">
                  <i className="fas fa-building text-secondary me-2 fs-5"></i>
                  <span className="fw-bold text-dark" style={{fontSize: '14px'}}>Domestic vendor</span>
                </div>
                <ul className="list-unstyled mb-0 ms-4 text-secondary" style={{fontSize: '13px', lineHeight: '2'}}>
                  <li><i className="fas fa-check text-success me-2"></i>Certificate of Incorporation</li>
                  <li><i className="fas fa-check text-success me-2"></i>GST Registration</li>
                  <li><i className="fas fa-check text-success me-2"></i>PAN Card</li>
                  <li><i className="fas fa-check text-success me-2"></i>GST-PAN Linkage</li>
                  <li><i className="fas fa-check text-success me-2"></i>TDS Registration</li>
                  <li><i className="fas fa-check text-success me-2"></i>ITR Returns Filing</li>
                  <li><i className="fas fa-check text-success me-2"></i>Bank Account (penny-drop)</li>
                </ul>
              </div>

              <div>
                <div className="d-flex align-items-center mb-3">
                  <i className="fas fa-globe text-info me-2 fs-5" style={{color: '#38bdf8'}}></i>
                  <span className="fw-bold text-dark" style={{fontSize: '14px'}}>International vendor</span>
                </div>
                <ul className="list-unstyled mb-0 ms-4 text-secondary" style={{fontSize: '13px', lineHeight: '2'}}>
                  <li><i className="fas fa-check text-success me-2"></i>Withholding Tax (DTAA rate)</li>
                  <li><i className="fas fa-check text-success me-2"></i>Form 10F + Tax Residency Cert</li>
                  <li><i className="fas fa-check text-success me-2"></i>No-PE declaration</li>
                  <li><i className="fas fa-check text-success me-2"></i>Beneficial-ownership confirmation</li>
                  <li><i className="fas fa-check text-success me-2"></i>Local tax registration</li>
                </ul>
              </div>
            </div>
          </div>

        </div>
      </div>
      {/* Edit Document Modal */}
      {showModal && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }}></div>
          <div className="modal fade show d-block" tabIndex="-1" role="dialog" style={{backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050}}>
            <div className="modal-dialog modal-dialog-centered" role="document">
              <div className="modal-content border-0 shadow" style={{borderRadius: '16px'}}>
                <div className="modal-header border-bottom-0 pb-0">
                  <h5 className="modal-title fw-bold text-dark">{selectedDoc}</h5>
                  <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body py-4">
                  <div className="mb-4 p-3 bg-light rounded border">
                    <h6 className="fw-semibold text-secondary mb-3 text-uppercase" style={{fontSize: '12px', letterSpacing: '0.5px'}}>Current Data Details</h6>
                    
                    {/* Placeholder for current details depending on document type */}
                    {selectedDoc === 'PAN Card' ? (
                      <div>
                        <p className="mb-2 small"><span className="text-muted d-inline-block" style={{width: '90px'}}>PAN Number:</span> <span className="fw-bold text-dark fs-6">ABCDE1234F</span></p>
                        <p className="mb-2 small"><span className="text-muted d-inline-block" style={{width: '90px'}}>Status:</span> <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">Verified</span></p>
                        <p className="mb-0 small"><span className="text-muted d-inline-block" style={{width: '90px'}}>Last Updated:</span> <span className="fw-medium text-dark">12 Oct 2023</span></p>
                      </div>
                    ) : selectedDoc === 'GST Registration' ? (
                      <div>
                        <p className="mb-2 small"><span className="text-muted d-inline-block" style={{width: '90px'}}>GSTIN:</span> <span className="fw-bold text-dark fs-6">27ABCDE1234F1Z5</span></p>
                        <p className="mb-2 small"><span className="text-muted d-inline-block" style={{width: '90px'}}>Status:</span> <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-2 py-1">Active</span></p>
                        <p className="mb-0 small"><span className="text-muted d-inline-block" style={{width: '90px'}}>Filing Status:</span> <span className="fw-medium text-dark">Regular</span></p>
                      </div>
                    ) : selectedDoc === 'Certificate of Incorporation' ? (
                      <div>
                        <p className="mb-2 small"><span className="text-muted d-inline-block" style={{width: '90px'}}>CIN:</span> <span className="fw-bold text-dark fs-6">U72900MH2023PTC123456</span></p>
                        <p className="mb-0 small"><span className="text-muted d-inline-block" style={{width: '90px'}}>Date:</span> <span className="fw-medium text-dark">15 Jan 2023</span></p>
                      </div>
                    ) : (
                      <p className="text-muted small mb-0 fst-italic">No current details available for {selectedDoc}.</p>
                    )}
                  </div>
                  
                  <div className="d-grid">
                    <button className="btn btn-primary rounded-pill py-2 fw-medium shadow-sm d-flex align-items-center justify-content-center">
                      <i className="fas fa-cloud-upload-alt me-2 fs-5"></i> Request For Upload Data
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
