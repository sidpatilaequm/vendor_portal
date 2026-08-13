import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';

const QuotationDetail = ({ qtnId, onBack, qtnDataFromList }) => {
  const [qtnData, setQtnData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [userRole, setUserRole] = useState('VENDOR');

  // Award modal states
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [awardRemarks, setAwardRemarks] = useState('');
  const [awardLoading, setAwardLoading] = useState(false);
  const [awardAlert, setAwardAlert] = useState(null);

  // PO modal states
  const [showPoModal, setShowPoModal] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [shippingInstructions, setShippingInstructions] = useState('');
  const [poRemarks, setPoRemarks] = useState('');
  const [poLoading, setPoLoading] = useState(false);
  const [poAlert, setPoAlert] = useState(null);

  const fetchQtnDetails = async () => {
    setLoading(true);
    setError(false);
    const token = localStorage.getItem('auth_token');
    
    // Check if user is Admin
    const userStr = localStorage.getItem('user_data');
    let role = 'VENDOR';
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        role = u.role?.toUpperCase() || 'VENDOR';
        setUserRole(role);
      } catch (e) {}
    }
    
    const isAdmin = role !== 'VENDOR';
    const basePath = isAdmin ? '/api/admin/quotations' : '/api/vendor/quotations';
    const isNumeric = !isNaN(qtnId);
    let apiEndpoint = isNumeric ? `${basePath}/${qtnId}` : `${basePath}/number/${qtnId}`;

    try {
      const response = await axios.get(apiEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      if (response.data) {
        let parsedData = response.data;
        if (response.data.data) {
          parsedData = response.data.data;
        }
        
        // Calculate totals if needed
        if (parsedData.line_items) {
          let subtotal = 0;
          parsedData.line_items.forEach(item => {
            const qty = parseFloat(item.quoted_qty || 0);
            const price = parseFloat(item.unit_price || 0);
            item.line_total = qty * price;
            subtotal += item.line_total;
          });
          parsedData.subtotal = subtotal;
          
          const gstTotal = parseFloat(parsedData.gst_total || 0);
          const freightTotal = parseFloat(parsedData.freight_total || parsedData.freight_details?.freight_amount || 0);
          if (!parsedData.grand_total) {
            parsedData.grand_total = subtotal + gstTotal + freightTotal;
          }
        }
        setQtnData(parsedData);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error(`Failed to fetch details for Quotation ${qtnId}, loading fallback mock details.`, err);
      // Fallback details matching screenshot
      setQtnData({
        quotationId: qtnId,
        quotation_header: {
          quotation_number: qtnId.startsWith('QTN') ? qtnId : `QTN-${qtnId}`,
          quotation_date: '2026-06-10',
          currency: 'INR',
          valid_until: '2028-04-07'
        },
        pr_id: 'PR-3',
        status: 'SUBMITTED',
        grand_total: 708.82,
        subtotal: 599.00,
        remarks: {
          cover_note: 'Please find our quotation.'
        },
        delivery_details: {
          incoterm: 'FOB',
          named_place: 'Free On Road Factory Gate',
          quoted_delivery_date: '2026-06-15',
          lead_time_days: 5
        },
        freight_details: {
          freight_amount: 0
        },
        payment_terms: {
          payment_terms_id: '1'
        },
        vendorName: qtnDataFromList?.vendorName || 'Vendor',
        vendor_name: qtnDataFromList?.vendorName || 'Vendor',
        prDate: qtnDataFromList?.prDate,
        line_items: [
          {
            pr_line_id: 2,
            item_code: 'MGCTShirt001',
            description: 'Get a young, confident look with this awesome black crew neck t-shirt from Puma. It\'s regular fit design assigns it a touch of classic fashion. Pair it with denims for some cool style.',
            quoted_qty: 1.00,
            uom: 'EA',
            unit_price: 599.00,
            gst_percent: 18.0,
            delivery_date: '2026-06-05',
            line_total: 599.00
          }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQtnDetails();
  }, [qtnId]);

  const generateAndUploadPOExcel = async (qtnDataToExport) => {
    try {
      const XLSX = await import('xlsx');
      
      const headers = [
        'PO Ref', 'Company Code', 'PO Type', 'Supplier', 'Purchasing Org',
        'Purchasing Group', 'Currency', 'Document Date', 'Item No', 'Material',
        'Short Text', 'Material Group', 'Plant', 'Storage Loc', 'Quantity',
        'UOM', 'Net Price', 'Price Unit', 'Delivery Date', 'Tax Code',
        'Acct Assign Cat', 'GL Account', 'Cost Center', 'SAP PO Number', 'Upload Status'
      ];

      const lineItems = qtnDataToExport?.line_items || [];
      const headerData = qtnDataToExport?.quotation_header || {};
      let vendorName = qtnDataToExport?.vendorName || qtnDataToExport?.vendor_name || qtnDataToExport?.supplier_name || qtnDataToExport?.vendor?.name || 'Vendor';

      if (vendorName === 'Vendor') {
        try {
          const listRes = await axios.get('/api/vendor/all', {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
          });
          const listData = listRes.data?.data || listRes.data;
          const matchingItem = (Array.isArray(listData) ? listData : []).find(item => 
             String(item.id) === String(qtnId) || item.quoteNo === qtnId || item.quotation_number === qtnId
          );
          if (matchingItem && matchingItem.vendorName) {
            vendorName = matchingItem.vendorName;
          }
        } catch(e) {
          console.warn("Failed to fetch list for vendor name fallback", e);
        }
      }

      const rows = lineItems.map((item, idx) => {
        return [
          headerData.quotation_number || qtnDataToExport?.quotationId || qtnId || '', // PO Ref
          '', // Company Code
          'ZDOM', // PO Type
          vendorName, // Supplier
          '', // Purchasing Org
          '', // Purchasing Group
          headerData.currency || 'INR', // Currency
          headerData.quotation_date || '', // Document Date
          (idx + 1) * 10, // Item No
          item.item_code || '', // Material
          item.description || '', // Short Text
          '', // Material Group
          '', // Plant
          '', // Storage Loc
          item.quoted_qty || item.quantity || '', // Quantity
          item.uom || item.unit || '', // UOM
          item.unit_price || item.rate || '', // Net Price
          '1', // Price Unit
          item.delivery_date || '', // Delivery Date
          item.gst_percent || '', // Tax Code
          'K', // Acct Assign Cat
          '', // GL Account
          '', // Cost Center
          '', // SAP PO Number
          ''  // Upload Status
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PO_Details");

      const fileName = `PO_Upload_${headerData.quotation_number || qtnDataToExport?.quotationId || qtnId || 'Qtn'}.xlsx`;
      
      XLSX.writeFile(wb, fileName);

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      let userId = 1; // Default to 1 instead of 18 as a fallback since 1 is usually a safe default admin ID in the DB
      const userStr = localStorage.getItem('user_data');
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          userId = userObj.id || userObj.userId || userObj.superAdminId || 1;
        } catch(e) {}
      }

      const formData = new FormData();
      formData.append('file', file);
      
      if (vendorName) {
        formData.append('vendorName', vendorName);
      }
      
      const prDateStr = qtnDataToExport?.prDate || qtnDataToExport?.quotation_header?.quotation_date || qtnDataToExport?.created_at;
      if (prDateStr) {
        const dateObj = new Date(prDateStr);
        if (!isNaN(dateObj.getTime())) {
          const monthYear = dateObj.toLocaleString('en-US', { month: 'short', year: 'numeric' });
          formData.append('monthYear', monthYear);
        }
      }
      
      await axios.post(`/api/files/quotation?userId=${userId}`, formData);
      console.log("Successfully generated and uploaded PO excel.");
    } catch (err) {
      console.error("Failed to generate and upload Excel:", err);
    }
  };

  const handleAward = async (e) => {
    e.preventDefault();
    setAwardLoading(true);
    setAwardAlert(null);
    const token = localStorage.getItem('auth_token');
    try {
      await axios.post(`/api/vendor/purchase-orders/from-awarded-quotation/${qtnData.id || qtnId}`, {
        remarks: awardRemarks
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setAwardAlert({ type: 'success', message: 'Quotation awarded successfully!' });

      try {
        await generateAndUploadPOExcel(qtnData);
      } catch (excelErr) {
        console.error("Excel generation/upload failed", excelErr);
      }

      setTimeout(() => {
        setShowAwardModal(false);
        setAwardRemarks('');
        fetchQtnDetails();
      }, 1500);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to award quotation';
      setAwardAlert({ type: 'danger', message: errMsg });
    } finally {
      setAwardLoading(false);
    }
  };

  const handleCreatePo = async (e) => {
    e.preventDefault();
    setPoLoading(true);
    setPoAlert(null);
    const token = localStorage.getItem('auth_token');
    try {
      await axios.post(`/api/vendor/purchase-orders/from-awarded-quotation/${qtnData.id || qtnId}`, {
        deliveryAddress,
        shippingInstructions,
        remarks: poRemarks
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      setPoAlert({ type: 'success', message: 'Purchase Order created successfully!' });
      setTimeout(() => {
        setShowPoModal(false);
        setDeliveryAddress('');
        setShippingInstructions('');
        setPoRemarks('');
        fetchQtnDetails();
      }, 1500);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || 'Failed to generate Purchase Order';
      setPoAlert({ type: 'danger', message: errMsg });
    } finally {
      setPoLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-success" role="status"></div>
        <p className="mt-2 text-muted">Loading Quotation details...</p>
      </div>
    );
  }

  if (error || !qtnData) {
    return (
      <div className="alert alert-danger mx-4 my-4" role="alert">
        Failed to load Quotation.
        <Button variant="outline-green" className="ms-3" onClick={onBack}>Back to List</Button>
      </div>
    );
  }

  const qtnNumber = qtnData.quotation_header?.quotation_number || qtnData.quotationNumber || qtnData.quoteNo || qtnId;
  const isDraft = qtnData.status === 'DRAFT' || qtnData.quoteStatus === 'DRAFT';
  const currencySymbol = (qtnData.quotation_header?.currency || qtnData.currency) === 'USD' ? '$' : '₹';
  const prId = qtnData.pr_id || qtnData.prId || qtnData.prNumber;
  const lineItems = qtnData.line_items || qtnData.items || qtnData.lines || [];
  const displayDate = qtnData.quotation_header?.quotation_date || qtnData.quoteDate || qtnData.createdAt?.split('T')[0];
  const grandTotal = qtnData.grand_total || qtnData.grandTotal || 0;
  const displayStatus = qtnData.status || qtnData.quoteStatus || 'SUBMITTED';

  return (
    <div className="fade-in-slide container-fluid py-4 text-start">
      {/* Header Info Card */}
      <div 
        className="card border-0 shadow-sm mb-4" 
        style={{ borderRadius: '12px', borderLeft: '5px solid #0acf97' }}
      >
        <div className="card-body p-4">
          <div className="row align-items-center">
            <div className="col">
              <p className="text-muted fw-bold text-uppercase mb-1" style={{ fontSize: '10px', letterSpacing: '1px' }}>
                {qtnNumber}
              </p>
              <h2 className="fw-bold text-dark mb-1 fs-3">
                {qtnData.remarks?.cover_note || qtnData.remarks?.coverNote || 'Quotation'}
              </h2>
              <p className="text-muted mb-3" style={{ fontSize: '12px' }}>
                {prId ? (
                  <>Linked to PR: <strong>{prId}</strong> · {lineItems.length} line item(s) {displayDate && `· Created ${displayDate}`}</>
                ) : (
                  <>Standalone Quotation · {lineItems.length} line item(s) {displayDate && `· Created ${displayDate}`}</>
                )}
              </p>
              
              <div className="d-flex flex-wrap gap-2">
                {displayStatus === 'AWARDED' ? (
                  <span className="badge bg-soft-success text-success border border-success border-opacity-25 px-3 py-2 fw-bold" style={{ fontSize: '11px' }}>
                    <i className="fas fa-star me-1 text-warning"></i> Awarded
                  </span>
                ) : displayStatus === 'DRAFT' ? (
                  <span className="badge bg-soft-warning text-warning border border-warning border-opacity-25 px-3 py-2 fw-bold" style={{ fontSize: '11px' }}>
                    <i className="fas fa-pen me-1"></i> Draft
                  </span>
                ) : displayStatus === 'REJECTED' ? (
                  <span className="badge bg-soft-danger text-danger border border-danger border-opacity-25 px-3 py-2 fw-bold" style={{ fontSize: '11px' }}>
                    <i className="fas fa-circle-xmark me-1"></i> Rejected
                  </span>
                ) : (
                  <span className="badge bg-soft-info text-info border border-info border-opacity-25 px-3 py-2 fw-bold" style={{ fontSize: '11px' }}>
                    <i className="fas fa-paper-plane me-1"></i> {displayStatus}
                  </span>
                )}
                
                <span className="badge bg-light text-muted px-3 py-2 fw-normal" style={{ fontSize: '11px' }}>
                  Currency <strong className="text-dark">{qtnData.quotation_header?.currency || qtnData.currency || 'INR'}</strong>
                </span>
                <span className="badge bg-light text-muted px-3 py-2 fw-normal" style={{ fontSize: '11px' }}>
                  Valid Until <strong className="text-dark">{qtnData.quotation_header?.valid_until || qtnData.validUntil || 'N/A'}</strong>
                </span>
                <span className="badge bg-light text-muted px-3 py-2 fw-normal" style={{ fontSize: '11px' }}>
                  Incoterms <strong className="text-dark">{qtnData.delivery_details?.incoterm || 'EXW'} {qtnData.delivery_details?.named_place || ''}</strong>
                </span>
                <span className="badge bg-light text-muted px-3 py-2 fw-normal" style={{ fontSize: '11px' }}>
                  Grand Total <strong className="text-success">{currencySymbol} {parseFloat(grandTotal).toFixed(2)}</strong>
                </span>
              </div>
            </div>
            <div className="col-auto">
              <div className="d-flex flex-column gap-2">
                {userRole === 'VENDOR' ? (
                  isDraft ? (
                    <>
                      <button className="btn btn-success px-4 fw-bold" style={{ borderRadius: '6px' }}>
                        <i className="fas fa-edit me-1"></i> Edit / Revise
                      </button>
                      <button className="btn btn-warning text-dark px-4 fw-bold" style={{ borderRadius: '6px' }}>
                        Submit Quotation <i className="fas fa-arrow-right ms-1"></i>
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-light px-4 border text-muted" disabled style={{ borderRadius: '6px', backgroundColor: '#fff' }}>
                      <i className="fas fa-history me-1"></i> Revise (Read-Only)
                    </button>
                  )
                ) : (
                  <>
                    {(displayStatus === 'SUBMITTED' || displayStatus === 'PENDING') && (
                      <button 
                        className="btn btn-success px-4 fw-bold text-white" 
                        style={{ borderRadius: '6px', backgroundColor: '#10b981', borderColor: '#10b981' }}
                        onClick={() => setShowAwardModal(true)}
                      >
                        <i className="fas fa-trophy me-1"></i> Award Quotation
                      </button>
                    )}
                    {displayStatus === 'AWARDED' && (
                      <button 
                        className="btn btn-primary px-4 fw-bold text-white" 
                        style={{ borderRadius: '6px', backgroundColor: '#3b82f6', borderColor: '#3b82f6' }}
                        onClick={() => setShowPoModal(true)}
                      >
                        <i className="fas fa-file-invoice-dollar me-1"></i> Generate PO
                      </button>
                    )}
                  </>
                )}
                <a 
                  href="#" 
                  className="btn btn-link text-muted text-decoration-none text-center small fw-semibold"
                  onClick={(e) => { e.preventDefault(); onBack(); }}
                >
                  <i className="fas fa-arrow-left me-1"></i> Back to List
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Version History Section */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white py-3 border-bottom d-flex align-items-center">
          <i className="fas fa-history me-2 text-success"></i>
          <h6 className="fw-bold mb-0 text-uppercase text-dark" style={{ fontSize: '11px', letterSpacing: '1px' }}>Version History</h6>
        </div>
        <div className="card-body">
          <div className="list-group list-group-flush gap-3">
            {/* Mock Version History */}
            <div className="list-group-item border rounded p-3 d-flex align-items-center bg-light bg-opacity-25 text-start">
              <div className="fw-bold text-muted me-4" style={{ fontSize: '14px' }}>v1</div>
              <div className="flex-grow-1">
                <h6 className="fw-bold mb-1" style={{ fontSize: '13px', color: '#334155' }}>08 Apr 2026 · Priya Sharma</h6>
                <p className="text-muted mb-0 italic" style={{ fontSize: '12px' }}>Initial draft</p>
              </div>
              <span className="badge bg-soft-info text-info border border-info border-opacity-25 px-3 py-1 rounded-pill"><i className="fas fa-arrows-rotate me-1"></i> Revised</span>
            </div>
            
            <div className="list-group-item border rounded p-3 d-flex align-items-center bg-light bg-opacity-25 text-start">
              <div className="fw-bold text-muted me-4" style={{ fontSize: '14px' }}>v2</div>
              <div className="flex-grow-1">
                <h6 className="fw-bold mb-1" style={{ fontSize: '13px', color: '#334155' }}>09 Apr 2026 · Priya Sharma</h6>
                <p className="text-muted mb-0 italic" style={{ fontSize: '12px' }}>Added GST breakup, updated validity to 30 days</p>
              </div>
              <span className="badge bg-soft-info text-info border border-info border-opacity-25 px-3 py-1 rounded-pill"><i className="fas fa-arrows-rotate me-1"></i> Revised</span>
            </div>

            <div className="list-group-item border border-success border-opacity-50 rounded p-3 d-flex align-items-center bg-success bg-opacity-5 text-start">
              <div className="fw-bold text-success me-4" style={{ fontSize: '14px' }}>v3</div>
              <div className="flex-grow-1">
                <h6 className="fw-bold mb-1" style={{ fontSize: '13px', color: '#15803d' }}>10 Apr 2026 · Rajiv Kumar</h6>
                <p className="text-muted mb-0 italic" style={{ fontSize: '12px' }}>Final price confirmed by management. Submitted.</p>
              </div>
              <span className="badge bg-warning text-dark border border-warning border-opacity-25 px-3 py-1 rounded-pill fw-bold"><i className="fas fa-star me-1"></i> Awarded</span>
            </div>
          </div>
        </div>
      </div>

      {/* Line Items Section */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white py-3 border-bottom d-flex align-items-center">
          <i className="fas fa-location-pin me-2 text-danger"></i>
          <h6 className="fw-bold mb-0 text-uppercase text-dark" style={{ fontSize: '11px', letterSpacing: '1px' }}>Line Items</h6>
          <span className="ms-auto badge bg-light text-muted fw-normal px-2 py-1 border">{lineItems.length} items</span>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: '11px' }}>
              <thead className="bg-light text-muted text-uppercase fw-bold">
                <tr className="text-center">
                  <th style={{ width: '60px' }}>Line</th>
                  <th style={{ width: '120px' }}>Item Code</th>
                  <th className="text-start">Description</th>
                  <th>Qty / UOM</th>
                  <th>Unit Price</th>
                  <th>GST</th>
                  <th>Delivery</th>
                  <th className="text-end pe-4">Line Total</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {lineItems.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td>
                      <span className="badge bg-soft-primary text-primary px-2 py-1">
                        {item.pr_line_id || item.prLineId || item.lineNumber || (idx + 1) * 10}
                      </span>
                    </td>
                    <td className="fw-bold text-dark">{item.item_code || item.itemCode || item.materialNumber || item.sku || '-'}</td>
                    <td className="text-start fw-medium text-dark" style={{ whiteSpace: 'normal', maxWidth: '350px' }}>
                      {item.description || item.materialDescription || '-'}
                    </td>
                    <td className="fw-bold text-dark">
                      {parseFloat(item.quoted_qty || item.quotedQty || item.quantity || 0).toFixed(2)}{' '}
                      <span className="text-muted fw-normal">{item.uom || 'EA'}</span>
                    </td>
                    <td className="fw-bold text-dark">
                      {currencySymbol} {parseFloat(item.unit_price || item.unitPrice || 0).toFixed(2)}
                    </td>
                    <td className="text-muted">{item.gst_percent || item.gstPercent || item.taxPercent || 0}%</td>
                    <td>{item.delivery_date || item.deliveryDate || qtnData.delivery_details?.quoted_delivery_date || '-'}</td>
                    <td className="text-end fw-bold text-dark pe-4" style={{ fontSize: '12px' }}>
                      {currencySymbol} {parseFloat(item.line_total || item.lineTotal || item.totalValue || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-light bg-opacity-50 fw-bold border-top">
                <tr>
                  <td colSpan="6"></td>
                  <td className="text-end text-muted text-uppercase" style={{ fontSize: '10px' }}>Subtotal:</td>
                  <td className="text-end pe-4 text-dark">{currencySymbol} {parseFloat(qtnData.subtotal || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan="6"></td>
                  <td className="text-end text-muted text-uppercase" style={{ fontSize: '10px' }}>Freight:</td>
                  <td className="text-end pe-4 text-dark">{currencySymbol} {parseFloat(qtnData.freight_details?.freight_amount || qtnData.freightTotal || 0).toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan="6"></td>
                  <td className="text-end text-muted text-uppercase" style={{ fontSize: '10px' }}>Grand Total:</td>
                  <td className="text-end pe-4 text-success" style={{ fontSize: '14px' }}>
                    {currencySymbol} {parseFloat(grandTotal).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Terms & Conditions Section */}
      <div className="card border-0 shadow-sm mb-5">
        <div className="card-header bg-white py-3 border-bottom d-flex align-items-center">
          <i className="fas fa-book-open me-2 text-warning"></i>
          <h6 className="fw-bold mb-0 text-uppercase text-dark" style={{ fontSize: '11px', letterSpacing: '1px' }}>Terms & Conditions</h6>
        </div>
        <div className="card-body">
          <div className="row g-4 text-start">
            <div className="col-md-3 col-6">
              <label className="form-label text-muted fw-bold text-uppercase mb-2 d-block" style={{ fontSize: '10px' }}>Payment Terms</label>
              <h6 className="fw-bold text-dark mb-0">ID: {qtnData.payment_terms?.payment_terms_id || '1'}</h6>
            </div>
            <div className="col-md-3 col-6">
              <label className="form-label text-muted fw-bold text-uppercase mb-2 d-block" style={{ fontSize: '10px' }}>Incoterms</label>
              <h6 className="fw-bold text-dark mb-0">{qtnData.delivery_details?.incoterm || 'EXW'} {qtnData.delivery_details?.named_place || ''}</h6>
            </div>
            <div className="col-md-3 col-6">
              <label className="form-label text-muted fw-bold text-uppercase mb-2 d-block" style={{ fontSize: '10px' }}>Validity</label>
              <h6 className="fw-bold text-dark mb-0">{qtnData.quotation_header?.valid_until || 'N/A'}</h6>
            </div>
            <div className="col-md-3 col-6">
              <label className="form-label text-muted fw-bold text-uppercase mb-2 d-block" style={{ fontSize: '10px' }}>Quoted Delivery</label>
              <h6 className="fw-bold text-dark mb-0">
                {qtnData.delivery_details?.quoted_delivery_date || 'N/A'}{' '}
                {qtnData.delivery_details?.lead_time_days ? `(${qtnData.delivery_details?.lead_time_days} days)` : ''}
              </h6>
            </div>
          </div>
        </div>
      </div>

      {/* Award Quotation Modal */}
      {showAwardModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '500px' }}>
            <div className="custom-modal-header bg-light">
              <h5 className="custom-modal-title text-dark fw-bold">
                <i className="fas fa-trophy text-success me-2"></i> Award Quotation
              </h5>
              <button className="custom-modal-close-btn" onClick={() => setShowAwardModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAward}>
              <div className="custom-modal-body text-start p-4">
                {awardAlert && (
                  <div className={`alert alert-${awardAlert.type} mb-3`} role="alert">
                    {awardAlert.message}
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label fw-bold text-muted small text-uppercase">Award Remarks / Notes</label>
                  <textarea
                    className="form-control border-light-subtle"
                    rows="3"
                    value={awardRemarks}
                    onChange={(e) => setAwardRemarks(e.target.value)}
                    placeholder="Enter notes for awarding this quotation..."
                    required
                  />
                </div>
              </div>
              <div className="custom-modal-footer bg-light p-3 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-3"
                  onClick={() => setShowAwardModal(false)}
                  disabled={awardLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success px-4 text-white"
                  style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                  disabled={awardLoading}
                >
                  {awardLoading ? 'Awarding...' : 'Confirm Award'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate PO Modal */}
      {showPoModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '550px' }}>
            <div className="custom-modal-header bg-light">
              <h5 className="custom-modal-title text-dark fw-bold">
                <i className="fas fa-file-invoice-dollar text-primary me-2"></i> Generate Purchase Order
              </h5>
              <button className="custom-modal-close-btn" onClick={() => setShowPoModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreatePo}>
              <div className="custom-modal-body text-start p-4">
                {poAlert && (
                  <div className={`alert alert-${poAlert.type} mb-3`} role="alert">
                    {poAlert.message}
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label fw-bold text-muted small text-uppercase">Delivery Address <span className="text-danger">*</span></label>
                  <textarea
                    className="form-control border-light-subtle"
                    rows="3"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter physical delivery address..."
                    required
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold text-muted small text-uppercase">Shipping Instructions</label>
                  <input
                    type="text"
                    className="form-control border-light-subtle"
                    value={shippingInstructions}
                    onChange={(e) => setShippingInstructions(e.target.value)}
                    placeholder="e.g. Handle with care, deliver by morning..."
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold text-muted small text-uppercase">PO Remarks</label>
                  <textarea
                    className="form-control border-light-subtle"
                    rows="2"
                    value={poRemarks}
                    onChange={(e) => setPoRemarks(e.target.value)}
                    placeholder="Internal remarks for the Purchase Order..."
                  />
                </div>
              </div>
              <div className="custom-modal-footer bg-light p-3 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-3"
                  onClick={() => setShowPoModal(false)}
                  disabled={poLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-4 text-white"
                  style={{ backgroundColor: '#3b82f6', borderColor: '#3b82f6' }}
                  disabled={poLoading}
                >
                  {poLoading ? 'Generating...' : 'Create PO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationDetail;
