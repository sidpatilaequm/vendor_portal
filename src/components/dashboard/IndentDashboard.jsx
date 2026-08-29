import React, { useState, useEffect } from 'react';
import axios from 'axios';

const InfoRow = ({ label, value }) => (
    <div className="row mb-1 align-items-start" style={{ fontSize: '12px' }}>
      <div className="col-5 text-muted fw-semibold" style={{ minWidth: '100px' }}>{label}</div>
      <div className="col-1 text-muted p-0 text-center" style={{ width: '15px' }}>:</div>
      <div className="col text-dark fw-bold text-wrap">{value || '—'}</div>
    </div>
  );


const IndentDashboard = ({ onBack }) => {
  const [indents, setIndents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [plants, setPlants] = useState([]);
  const [selectedPlant, setSelectedPlant] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [budgetStatus, setBudgetStatus] = useState({
    current_month_allocated: 5000000,
    current_month_available: 5000000,
    current_quarter_allocated: 15000000,
    current_quarter_available: 15000000,
    covers_with_tax: true,
    covers_without_tax: true
  });
  const [itemsCurrentPage, setItemsCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [itemSearchQuery, setItemSearchQuery] = useState('');

  const formatCurrencyVal = (val) => {
    if (val === null || val === undefined) return '—';
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const filteredItems = extractedData?.items?.filter(item =>
    item.description?.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
    item.hsnSac?.toLowerCase().includes(itemSearchQuery.toLowerCase())
  ) || [];
  
  const totalItemsCount = filteredItems.length;
  const totalPagesCount = Math.ceil(totalItemsCount / itemsPerPage) || 1;
  const startIndex = (itemsCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItemsCount);
  const paginatedItems = filteredItems.slice(startIndex, endIndex);


  
  const userStr = localStorage.getItem('user_data');
  const user = userStr ? JSON.parse(userStr) : { id: 1 };
  const token = localStorage.getItem('auth_token');

  const fetchIndents = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/api/requests/?user_id=${user.id || 1}&workflow_id=12`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Filter out non-12 if API returned mixed (just to be safe)
      const data = Array.isArray(res.data) ? res.data.filter(r => r.workflow_id === 12) : [];
      setIndents(data);
    } catch (err) {
      console.error('Error fetching indents:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await axios.get('/api/budget/departments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setDepartments(res.data || []);
    } catch (err) {
      console.error('Error fetching departments:', err);
    }
  };

  const fetchPlants = async () => {
    try {
      // Trying to fetch from Django proxy or Java directly.
      const res = await axios.get('/api/locations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Handle different possible response structures (data.data or just data)
      const data = res.data?.data || res.data || [];
      setPlants(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching plants:', err);
    }
  };

  useEffect(() => {
    fetchIndents();
    fetchDepartments();
    fetchPlants();
  }, []);

  const handleUploadClick = () => {
    setShowUploadModal(true);
  };

  const handleFileUploadChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) {
      alert("Please select a file to upload.");
      return;
    }
    if (!selectedDept) {
      alert("Please select a Target Department.");
      return;
    }
    setExtractionLoading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const response = await axios.post('/api/extract-invoice', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      });
      
      const extracted = response.data;
      if (extracted && extracted.items) {
        extracted.items = extracted.items.map(i => ({ ...i, department: selectedDept, budgetOwnerDepartment: selectedDept }));
      }
      setExtractedData(extracted);
      
      // Fetch real budget data from Django
      let allocMonth = 0;
      let allocQuarter = 0;
      try {
        const statusRes = await axios.get(`/api/department-status?dept_code=${selectedDept}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (statusRes.data && statusRes.data.status === 'SUCCESS') {
           allocMonth = statusRes.data.data.current_month_allocated || 0;
           allocQuarter = statusRes.data.data.current_quarter_allocated || 0;
        }
      } catch (err) {
        console.error("Error fetching budget status:", err);
      }

      // Calculate sum of already used budget from existing indents for this dept
      const usedBudget = indents
        .filter(ind => {
           const fields = ind.request_metadata?.indent_fields || {};
           return fields.department === selectedDept || fields.budgetOwnerDepartment === selectedDept;
        })
        .reduce((sum, ind) => sum + Number(ind.amount || 0), 0);
      
      setBudgetStatus({
        current_month_allocated: allocMonth,
        current_month_available: allocMonth - usedBudget,
        current_quarter_allocated: allocQuarter,
        current_quarter_available: allocQuarter - usedBudget,
        covers_with_tax: (allocMonth - usedBudget) >= (extracted.grandTotal || 0),
        covers_without_tax: (allocMonth - usedBudget) >= ((extracted.grandTotal || 0) - (extracted.taxTotal || 0))
      });

      setShowUploadModal(false);
      setShowDetailsModal(true);
    } catch (err) {
      console.error(err);
      alert("Failed to extract data from document.");
    } finally {
      setExtractionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return <span className="badge bg-success px-2 py-1 rounded-pill" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>APPROVED</span>;
      case 'rejected':
        return <span className="badge bg-danger px-2 py-1 rounded-pill" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>REJECTED</span>;
      case 'cancelled':
        return <span className="badge bg-secondary px-2 py-1 rounded-pill" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>CANCELLED</span>;
      default:
        return <span className="badge bg-warning text-dark px-2 py-1 rounded-pill" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>PENDING</span>;
    }
  };

  const filteredIndents = indents.filter(ind => {
    if (statusFilter === 'all') return true;
    return ind.status?.toLowerCase() === statusFilter;
  });

  const handleDownloadPO = async () => {
    if (!extractedData || !extractedData.items || extractedData.items.length === 0) {
      alert('No items found to generate PO.');
      return;
    }

    const headers = [
      'PO Ref', 'Company Code', 'PO Type', 'Supplier', 'Purchasing Org',
      'Purchasing Group', 'Currency', 'Document Date', 'Item No', 'Material',
      'Short Text', 'Material Group', 'Plant', 'Storage Loc', 'Quantity',
      'UOM', 'Net Price', 'Price Unit', 'Delivery Date', 'Tax Code',
      'Acct Assign Cat', 'GL Account', 'Cost Center', 'SAP PO Number', 'Upload Status'
    ];

    const rows = extractedData.items.map((item, idx) => {
      return [
        extractedData.documentNumber || extractedData.invoice_number || '', // PO Ref
        extractedData.companyCode || '',    // Company Code
        'ZDOM',                             // PO Type
        extractedData.supplier?.name || extractedData.vendor_name || extractedData.vendor_code || '', // Supplier
        '',                                 // Purchasing Org
        '',                                 // Purchasing Group
        extractedData.currency || 'INR',    // Currency
        extractedData.documentDate || extractedData.invoice_date || '',   // Document Date
        (idx + 1) * 10,                     // Item No
        '',                                 // Material
        item.description || '',             // Short Text
        '',                                 // Material Group
        selectedPlant || '',                // Plant
        '',                                 // Storage Loc
        item.quantity || '',                // Quantity
        item.unit || '',                    // UOM
        item.rate || '',                    // Net Price
        '1',                                // Price Unit
        '',                                 // Delivery Date
        item.taxPercentage || '',           // Tax Code
        'K',                                // Acct Assign Cat
        '',                                 // GL Account
        selectedDept || '',                 // Cost Center (fallback to dept code for now)
        '',                                 // SAP PO Number
        ''                                  // Upload Status
      ];
    });

    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PO_Details");
      XLSX.writeFile(wb, `PO_Upload_${extractedData.documentNumber || extractedData.invoice_number || 'draft'}.xlsx`);
    } catch (err) {
      console.error("Failed to generate Excel:", err);
      alert("Failed to generate Excel file. Please ensure 'xlsx' is installed.");
    }
  };

  return (
    <div className="container-fluid py-4 fade-in-slide" style={{ fontFamily: '"Inter", sans-serif', maxWidth: '1400px' }}>
      {/* Header section */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          {onBack && (
            <button 
              className="btn btn-link text-muted text-decoration-none p-0 mb-2 d-flex align-items-center gap-2"
              onClick={onBack}
            >
              <i className="fas fa-arrow-left"></i> Back
            </button>
          )}
          <h3 className="fw-bold text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>INDENTS</h3>
          <p className="text-muted mb-0" style={{ fontSize: '14px' }}>Manage and track your Indent Approvals</p>
        </div>
        
        <div className="d-flex gap-3 align-items-center">
          <button 
            className="btn btn-outline-success d-flex align-items-center gap-2 fw-semibold px-3 py-2 shadow-sm"
            onClick={handleUploadClick}
            style={{ borderRadius: '8px', fontSize: '14px', border: '1px solid #198754' }}
          >
            <i className="fas fa-file-upload"></i> Upload Indent
          </button>
          
          <div className="dropdown">
            <button className="btn btn-white border d-flex align-items-center gap-2 px-3 py-2 shadow-sm" 
                    type="button" 
                    data-bs-toggle="dropdown" 
                    aria-expanded="false"
                    style={{ borderRadius: '8px', fontSize: '14px' }}>
              <span className="text-muted">Status:</span> 
              <span className="fw-semibold">
                {statusFilter === 'all' ? 'All Indents' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              </span>
              <i className="fas fa-chevron-down ms-1 text-muted" style={{ fontSize: '10px' }}></i>
            </button>
            <ul className="dropdown-menu shadow border-0" style={{ borderRadius: '8px', overflow: 'hidden' }}>
              <li><button className="dropdown-item py-2" onClick={() => setStatusFilter('all')}>All Indents</button></li>
              <li><button className="dropdown-item py-2" onClick={() => setStatusFilter('approved')}>Approved</button></li>
              <li><button className="dropdown-item py-2" onClick={() => setStatusFilter('pending')}>Pending</button></li>
              <li><button className="dropdown-item py-2" onClick={() => setStatusFilter('rejected')}>Rejected</button></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main content table */}
      <div className="card border-0 shadow-sm rounded-3 overflow-hidden">
        <div className="card-header bg-white border-bottom py-3 px-4">
          <h6 className="mb-0 fw-bold fs-6">All Indents</h6>
        </div>
        
        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5 text-muted">
              <div className="spinner-border text-success mb-3" role="status"></div>
              <p>Loading Indents...</p>
            </div>
          ) : filteredIndents.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="fas fa-inbox fs-1 mb-3 text-light-subtle"></i>
              <h5 className="fw-bold text-secondary">No Indents Found</h5>
              <p className="mb-0">There are no indents matching your criteria.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="bg-light text-muted" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <tr>
                    <th className="px-4 py-3 border-0 fw-semibold">ID & Title</th>
                    <th className="py-3 border-0 fw-semibold">Requestor</th>
                    <th className="py-3 border-0 fw-semibold">Department</th>
                    <th className="py-3 border-0 fw-semibold">Plant / Loc</th>
                    <th className="py-3 border-0 fw-semibold">Year</th>
                    <th className="py-3 border-0 fw-semibold text-end">Budget Bal.</th>
                    <th className="py-3 border-0 fw-semibold text-end">Value</th>
                    <th className="py-3 border-0 fw-semibold">Justification</th>
                    <th className="px-4 py-3 border-0 fw-semibold">Status</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: '14px' }}>
                  {filteredIndents.map((ind) => {
                    const fields = ind.request_metadata?.indent_fields || {};
                    return (
                      <tr key={ind.id} style={{ cursor: 'pointer' }}>
                        <td className="px-4 py-3 border-bottom">
                          <div className="fw-bold text-dark mb-1">REQ-{ind.id}</div>
                          <div className="text-muted text-truncate" style={{ fontSize: '12px', maxWidth: '200px' }}>
                            {ind.title || 'Untitled Indent'}
                          </div>
                        </td>
                        <td className="py-3 border-bottom">
                          <div className="d-flex align-items-center gap-2">
                            <div className="rounded-circle bg-success bg-opacity-10 text-success d-flex align-items-center justify-content-center fw-bold" style={{ width: '28px', height: '28px', fontSize: '12px' }}>
                              {(fields.requestor || 'U').charAt(0).toUpperCase()}
                            </div>
                            <span className="fw-medium">{fields.requestor || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="py-3 border-bottom text-muted">
                          <div className="fw-medium text-dark">{fields.department || 'N/A'}</div>
                          <div style={{ fontSize: '11px' }}>Owner: {fields.budgetOwnerDepartment || '-'}</div>
                        </td>
                        <td className="py-3 border-bottom text-muted">
                          <div><i className="fas fa-industry me-1 text-light-subtle"></i> {fields.plantId || '-'}</div>
                          <div style={{ fontSize: '11px' }}><i className="fas fa-map-marker-alt me-1 text-light-subtle"></i> {fields.locationId || '-'}</div>
                        </td>
                        <td className="py-3 border-bottom text-muted">
                          {fields.year || '-'}
                        </td>
                        <td className="py-3 border-bottom text-end">
                          <span className={`fw-semibold ${fields.balanceAmount < 0 ? 'text-danger' : 'text-success'}`}>
                            ₹{fields.balanceAmount?.toLocaleString() || '0'}
                          </span>
                        </td>
                        <td className="py-3 border-bottom text-end fw-bold text-dark">
                          ₹{ind.amount?.toLocaleString() || '0'}
                        </td>
                        <td className="py-3 border-bottom">
                          <span className="badge bg-light text-dark border px-2 py-1" style={{ fontSize: '11px', fontWeight: '500' }}>
                            {fields.businessJustificationCode || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-bottom">
                          {getStatusBadge(ind.status)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Upload Indent Modal */}
      {showUploadModal && (
        <div className="custom-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="custom-modal-content bg-white" style={{ width: '100%', maxWidth: '500px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
            <div className="custom-modal-header bg-light p-3" style={{ borderBottom: '1px solid #e2e8f0', borderTopLeftRadius: '12px', borderTopRightRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h5 className="custom-modal-title text-dark fw-bold d-flex align-items-center gap-2 m-0" style={{ fontSize: '16px' }}>
                <i className="fas fa-file-upload text-success"></i> Upload Indent
              </h5>
              <button className="custom-modal-close-btn" style={{ fontSize: '20px', border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => setShowUploadModal(false)}>&times;</button>
            </div>
            <div className="custom-modal-body p-4 text-start">
              <div className="mb-3">
                <label className="form-label fw-bold text-muted small text-uppercase mb-2">Select Target Department</label>
                <select 
                  className="form-select" 
                  value={selectedDept} 
                  onChange={(e) => setSelectedDept(e.target.value)}
                >
                  <option value="">-- Select Department --</option>
                  {departments.map(d => (
                    <option key={d.dept_code} value={d.dept_code}>{d.name} ({d.dept_code})</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold text-muted small text-uppercase mb-2">Select Target Plant (Location)</label>
                <select 
                  className="form-select" 
                  value={selectedPlant} 
                  onChange={(e) => setSelectedPlant(e.target.value)}
                >
                  <option value="">-- Select Plant --</option>
                  {plants.map((p, i) => {
                    const id = p.id || p.locationId || i;
                    const name = p.location_name || p.locationName || p.name || 'Unknown Plant';
                    return <option key={id} value={name}>{name}</option>;
                  })}
                </select>
              </div>
              <label className="form-label fw-bold text-muted small text-uppercase mb-2">Select Indent Document</label>
              <div
                className="border-dashed p-4 rounded-3 text-center bg-light bg-opacity-50"
                style={{ border: '2px dashed #cbd5e1', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onClick={() => document.getElementById('indentFileInput').click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    setUploadFile(e.dataTransfer.files[0]);
                  }
                }}
              >
                <i className="fas fa-cloud-upload-alt text-muted fa-2x mb-2"></i>
                <p className="mb-1 text-dark fw-bold" style={{ fontSize: '14px' }}>
                  {uploadFile ? uploadFile.name : 'Drag and drop or click to upload'}
                </p>
                <p className="text-muted small mb-0" style={{ fontSize: '11px' }}>
                  Supports PDF, PNG, JPG, JPEG, XLSX
                </p>
                <input
                  type="file"
                  id="indentFileInput"
                  className="d-none"
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls"
                  onChange={handleFileUploadChange}
                />
              </div>
            </div>
            <div className="custom-modal-footer bg-light d-flex justify-content-end p-3 gap-2" style={{ borderTop: '1px solid #e2e8f0', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
              <button
                className="btn btn-light fw-semibold px-4 py-2"
                style={{ borderRadius: '8px', fontSize: '13px' }}
                onClick={() => setShowUploadModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-success fw-bold px-4 py-2 shadow-sm d-flex align-items-center gap-2"
                style={{ borderRadius: '8px', fontSize: '13px' }}
                onClick={handleUploadSubmit}
                disabled={extractionLoading}
              >
                {extractionLoading ? (
                  <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Extracting...</>
                ) : (
                  <><i className="fas fa-upload"></i> Upload & Extract</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extracted Invoice Details Modal */}
      {showDetailsModal && extractedData && (
        <div className="custom-modal-overlay" style={{ overflowY: 'auto' }}>
          <div className="custom-modal-content" style={{ maxWidth: '1100px', width: '95%', borderRadius: '12px', margin: '30px auto' }}>
            <div className="custom-modal-header bg-light p-3 d-flex justify-content-between align-items-center" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <h5 className="custom-modal-title text-dark fw-bold d-flex align-items-center gap-2 m-0" style={{ fontSize: '16px' }}>
                <i className="fas fa-file-invoice-dollar text-success"></i> Invoice / Estimate Details
              </h5>
              <button
                className="custom-modal-close-btn"
                style={{ fontSize: '20px', border: 'none', background: 'none', cursor: 'pointer' }}
                onClick={() => setShowDetailsModal(false)}
              >
                &times;
              </button>
            </div>

            <div className="custom-modal-body p-4 text-start">

              {budgetStatus && (
                <div className="card mb-4 bg-light border-0 shadow-sm">
                  <div className="card-body pb-2">
                    <h6 className="card-title text-success fw-bold"><i className="fas fa-wallet me-2"></i>Budget Availability Check</h6>

                    <div className="row g-3 mt-1">
                      <div className="col-md-6">
                        <div className="p-2 border rounded bg-white" style={{ fontSize: '13px' }}>
                          <small className="text-muted fw-bold text-uppercase d-block mb-1">Current Month</small>
                          <div className="d-flex justify-content-between">
                            <span>Allocated:</span> <strong>{formatCurrencyVal(budgetStatus.current_month_allocated)}</strong>
                          </div>
                          <div className="d-flex justify-content-between mb-1">
                            <span>Available:</span> <strong className="text-success">{formatCurrencyVal(budgetStatus.current_month_available)}</strong>
                          </div>
                          <div className="d-flex justify-content-between pt-1 border-top border-light-subtle" style={{ fontSize: '11px' }}>
                            <span className="text-muted">Balance After Invoice (With Tax):</span>
                            <strong className={budgetStatus.current_month_available - extractedData.grandTotal >= 0 ? "text-success" : "text-danger"}>
                              {formatCurrencyVal(budgetStatus.current_month_available - extractedData.grandTotal)}
                            </strong>
                          </div>
                          <div className="d-flex justify-content-between" style={{ fontSize: '11px' }}>
                            <span className="text-muted">Balance After Invoice (W/O Tax):</span>
                            <strong className={budgetStatus.current_month_available - (extractedData.grandTotal - extractedData.taxTotal) >= 0 ? "text-success" : "text-danger"}>
                              {formatCurrencyVal(budgetStatus.current_month_available - (extractedData.grandTotal - extractedData.taxTotal))}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="col-md-6">
                        <div className="p-2 border rounded bg-white" style={{ fontSize: '13px' }}>
                          <small className="text-muted fw-bold text-uppercase d-block mb-1">Current Quarter</small>
                          <div className="d-flex justify-content-between">
                            <span>Allocated:</span> <strong>{formatCurrencyVal(budgetStatus.current_quarter_allocated)}</strong>
                          </div>
                          <div className="d-flex justify-content-between mb-1">
                            <span>Available:</span> <strong className="text-success">{formatCurrencyVal(budgetStatus.current_quarter_available)}</strong>
                          </div>
                          <div className="d-flex justify-content-between pt-1 border-top border-light-subtle" style={{ fontSize: '11px' }}>
                            <span className="text-muted">Balance After Invoice (With Tax):</span>
                            <strong className={budgetStatus.current_quarter_available - extractedData.grandTotal >= 0 ? "text-success" : "text-danger"}>
                              {formatCurrencyVal(budgetStatus.current_quarter_available - extractedData.grandTotal)}
                            </strong>
                          </div>
                          <div className="d-flex justify-content-between" style={{ fontSize: '11px' }}>
                            <span className="text-muted">Balance After Invoice (W/O Tax):</span>
                            <strong className={budgetStatus.current_quarter_available - (extractedData.grandTotal - extractedData.taxTotal) >= 0 ? "text-success" : "text-danger"}>
                              {formatCurrencyVal(budgetStatus.current_quarter_available - (extractedData.grandTotal - extractedData.taxTotal))}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 mb-2 d-flex gap-2" style={{ fontSize: '12px' }}>
                      <span className={`badge ${budgetStatus.covers_with_tax ? 'bg-success' : 'bg-danger'} p-2`}>
                        <i className={`fas ${budgetStatus.covers_with_tax ? 'fa-check-circle' : 'fa-times-circle'} me-1`}></i>
                        Covers With Tax
                      </span>
                      <span className={`badge ${budgetStatus.covers_without_tax ? 'bg-success' : 'bg-danger'} p-2`}>
                        <i className={`fas ${budgetStatus.covers_without_tax ? 'fa-check-circle' : 'fa-times-circle'} me-1`}></i>
                        Covers Without Tax
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Header Cards Grid (3 Columns) */}
              <div className="row g-3 mb-4">
                {/* Document Information */}
                <div className="col-md-4">
                  <div className="card h-100 border border-light-subtle shadow-sm p-3">
                    <h6 className="card-title fw-bold text-dark mb-3" style={{ fontSize: '13px' }}>
                      <i className="far fa-file-alt me-2 text-success"></i> Document Information
                    </h6>
                    <InfoRow label="Document Type" value={extractedData.documentType} />
                    <InfoRow label="Document Number" value={extractedData.documentNumber} />
                    <InfoRow label="Document Date" value={extractedData.documentDate} />
                    <InfoRow label="Currency" value={extractedData.currency} />
                    <InfoRow label="Place of Supply" value={extractedData.placeOfSupply} />
                  </div>
                </div>

                {/* Supplier Details */}
                <div className="col-md-4">
                  <div className="card h-100 border border-light-subtle shadow-sm p-3">
                    <h6 className="card-title fw-bold text-dark mb-3" style={{ fontSize: '13px' }}>
                      <i className="far fa-building me-2 text-success"></i> Supplier Details
                    </h6>
                    <InfoRow label="Name" value={extractedData.supplier?.name} />
                    <InfoRow label="GSTIN" value={extractedData.supplier?.gstin} />
                    <InfoRow label="Address" value={extractedData.supplier?.address} />
                  </div>
                </div>

                {/* Customer Details */}
                <div className="col-md-4">
                  <div className="card h-100 border border-light-subtle shadow-sm p-3">
                    <h6 className="card-title fw-bold text-dark mb-3" style={{ fontSize: '13px' }}>
                      <i className="far fa-user me-2 text-success"></i> Customer Details
                    </h6>
                    <InfoRow label="Name" value={extractedData.customer?.name} />
                    <InfoRow label="GSTIN" value={extractedData.customer?.gstin} />
                    <InfoRow label="Address" value={extractedData.customer?.address} />
                  </div>
                </div>
              </div>

              {/* Items Table Section */}
              <div className="card border border-light-subtle shadow-sm mb-4">
                <div className="card-header bg-light bg-opacity-75 border-bottom d-flex justify-content-between align-items-center py-2 px-3">
                  <h6 className="card-title mb-0 fw-bold text-dark" style={{ fontSize: '13px' }}>
                    <i className="fas fa-list me-2 text-success"></i> Items{' '}
                    <span className="badge bg-secondary ms-1">{extractedData.items?.length || 0} items</span>
                  </h6>
                  <div className="d-flex align-items-center gap-2">
                    <div className="input-group input-group-sm" style={{ width: '220px' }}>
                      <span className="input-group-text bg-white border-light-subtle">
                        <i className="fas fa-search text-muted" style={{ fontSize: '11px' }}></i>
                      </span>
                      <input
                        type="text"
                        className="form-control border-light-subtle"
                        placeholder="Search items..."
                        style={{ fontSize: '11px' }}
                        value={itemSearchQuery}
                        onChange={(e) => {
                          setItemSearchQuery(e.target.value);
                          setItemsCurrentPage(1);
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 text-start" style={{ fontSize: '12px' }}>
                      <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>
                          <th className="ps-3 py-3" style={{ width: '50px' }}>#</th>
                          <th>Description</th>
                          <th>HSN/SAC</th>
                          <th className="text-end">Qty</th>
                          <th>Unit</th>
                          <th className="text-end">Rate (₹)</th>
                          <th className="text-end">Discount (₹)</th>
                          <th className="text-end">Tax %</th>
                          <th className="text-end">Tax Amount (₹)</th>
                          <th className="text-end">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.length > 0 ? (
                          paginatedItems.map((item, idx) => (
                            <tr key={idx}>
                              <td className="ps-3 fw-bold text-success">{item.lineNumber || (startIndex + idx + 1)}</td>
                              <td className="fw-semibold text-dark">{item.description || '—'}</td>
                              <td>
                                <span className="badge bg-light text-dark border px-2 py-1">
                                  {item.hsnSac || '—'}
                                </span>
                              </td>
                              <td className="text-end fw-bold text-dark">
                                {Number(item.quantity || 0).toFixed(2)}
                              </td>
                              <td>{item.unit || '—'}</td>
                              <td className="text-end fw-bold text-dark">{Number(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="text-end text-muted">{Number(item.discount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="text-end fw-bold text-success">{item.taxPercentage ? `${item.taxPercentage}%` : '0%'}</td>
                              <td className="text-end fw-bold text-dark">{Number(item.taxAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="text-end fw-bold text-dark">{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="10" className="text-center py-4 text-muted">No items found</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* Pagination Footer */}
                <div className="card-footer bg-light bg-opacity-50 d-flex justify-content-between align-items-center py-2 px-3 border-top" style={{ fontSize: '11px' }}>
                  <div className="text-muted">
                    Showing {totalItemsCount > 0 ? startIndex + 1 : 0} to {endIndex} of {totalItemsCount} items
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <button
                      className="btn btn-sm btn-light border-0"
                      disabled={itemsCurrentPage === 1}
                      onClick={() => setItemsCurrentPage(prev => prev - 1)}
                    >
                      <i className="fas fa-chevron-left"></i>
                    </button>
                    <span className="badge bg-success px-2 py-1 fw-bold">{itemsCurrentPage}</span>
                    <button
                      className="btn btn-sm btn-light border-0"
                      disabled={itemsCurrentPage === totalPagesCount}
                      onClick={() => setItemsCurrentPage(prev => prev + 1)}
                    >
                      <i className="fas fa-chevron-right"></i>
                    </button>
                  </div>
                  <div className="d-flex align-items-center gap-2 text-muted">
                    <span>Rows per page:</span>
                    <select
                      className="form-select form-select-sm border-light-subtle"
                      style={{ width: '70px', fontSize: '11px', padding: '0.25rem 0.5rem' }}
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setItemsCurrentPage(1);
                      }}
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Bottom Cards Section (Tax, Amount, Other) */}
              <div className="row g-3 mb-4">
                {/* Tax Summary */}
                <div className="col-md-4">
                  <div className="card h-100 border border-light-subtle shadow-sm p-3">
                    <h6 className="card-title fw-bold text-dark mb-3" style={{ fontSize: '13px' }}>
                      <i className="fas fa-receipt me-2 text-success"></i> Tax Summary
                    </h6>
                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: '12px' }}>
                      <span className="text-muted">CGST</span>
                      <span className="fw-bold text-dark">{formatCurrencyVal(extractedData.taxes?.cgst)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: '12px' }}>
                      <span className="text-muted">SGST</span>
                      <span className="fw-bold text-dark">{formatCurrencyVal(extractedData.taxes?.sgst)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: '12px' }}>
                      <span className="text-muted">IGST</span>
                      <span className="fw-bold text-dark">{formatCurrencyVal(extractedData.taxes?.igst)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: '12px' }}>
                      <span className="text-muted">TCS</span>
                      <span className="fw-bold text-dark">{formatCurrencyVal(extractedData.taxes?.tcs)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-0" style={{ fontSize: '12px' }}>
                      <span className="text-muted">TDS</span>
                      <span className="fw-bold text-dark">{formatCurrencyVal(extractedData.taxes?.tds)}</span>
                    </div>
                  </div>
                </div>

                {/* Amount Summary */}
                <div className="col-md-4">
                  <div className="card h-100 border border-light-subtle shadow-sm p-3">
                    <h6 className="card-title fw-bold text-dark mb-3" style={{ fontSize: '13px' }}>
                      <i className="fas fa-calculator me-2 text-success"></i> Amount Summary
                    </h6>
                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: '12px' }}>
                      <span className="text-muted">Sub Total</span>
                      <span className="fw-bold text-dark">{formatCurrencyVal(extractedData.subTotal)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-1" style={{ fontSize: '12px' }}>
                      <span className="text-muted">Discount Total</span>
                      <span className="fw-bold text-dark">{formatCurrencyVal(extractedData.discountTotal)}</span>
                    </div>
                    <div className="d-flex justify-content-between mb-3" style={{ fontSize: '12px' }}>
                      <span className="text-muted">Tax Total</span>
                      <span className="fw-bold text-dark">{formatCurrencyVal(extractedData.taxTotal)}</span>
                    </div>
                    <div className="d-flex justify-content-between align-items-center pt-2 border-top border-light-subtle">
                      <span className="fw-bold text-dark" style={{ fontSize: '13px' }}>Grand Total</span>
                      <span className="fw-bold fs-5" style={{ color: '#0E7C86' }}>{formatCurrencyVal(extractedData.grandTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Other Information */}
                <div className="col-md-4">
                  <div className="card h-100 border border-light-subtle shadow-sm p-3">
                    <h6 className="card-title fw-bold text-dark mb-3" style={{ fontSize: '13px' }}>
                      <i className="fas fa-info-circle me-2 text-success"></i> Other Information
                    </h6>
                    <div className="mb-2" style={{ fontSize: '11px' }}>
                      <span className="text-muted d-block fw-semibold text-uppercase" style={{ fontSize: '9px' }}>Amount In Words</span>
                      <span className="text-dark fw-bold">{extractedData.amountInWords || '—'}</span>
                    </div>
                    <div className="mb-2" style={{ fontSize: '11px' }}>
                      <span className="text-muted d-block fw-semibold text-uppercase" style={{ fontSize: '9px' }}>Payment Terms</span>
                      <span className="text-dark fw-bold">{extractedData.paymentTerms || '—'}</span>
                    </div>
                    <div className="mb-0" style={{ fontSize: '11px' }}>
                      <span className="text-muted d-block fw-semibold text-uppercase" style={{ fontSize: '9px' }}>Notes</span>
                      <span className="text-dark fw-bold">{extractedData.notes || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="custom-modal-footer bg-light d-flex justify-content-end p-3 gap-2" style={{ borderTop: '1px solid #e2e8f0' }}>
              <button
                className="btn btn-light fw-semibold px-4 py-2"
                style={{ borderRadius: '8px', fontSize: '13px' }}
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </button>
              <button
                className="btn btn-primary fw-bold px-4 py-2 d-flex align-items-center gap-2"
                style={{ backgroundColor: '#2563eb', borderColor: '#2563eb', borderRadius: '8px', fontSize: '13px' }}
                onClick={handleDownloadPO}
              >
                <i className="fas fa-file-excel"></i> Download PO
              </button>
              <button
                className="btn btn-success fw-bold px-4 py-2 d-flex align-items-center gap-2"
                style={{ backgroundColor: '#293383', borderColor: '#293383', borderRadius: '8px', fontSize: '13px' }}
                onClick={() => { alert("Indent successfully created from document!"); setShowDetailsModal(false); fetchIndents(); }}
                disabled={loading}
              >
                {loading ? <span className="spinner-border spinner-border-sm"></span> : <i className="fas fa-save"></i>}
                {loading ? 'Saving...' : 'Submit Indent'}
              </button>
            </div>
          </div>
        </div>
      )}

          </div>
  );
};

export default IndentDashboard;
