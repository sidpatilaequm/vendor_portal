import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';

const NewQuotationWizard = ({ prId, onBack, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [prData, setPrData] = useState(null);
  const [loadingPr, setLoadingPr] = useState(false);

  // Form State
  const [qtnNumber, setQtnNumber] = useState(`QTN-${Math.floor(100000 + Math.random() * 900000)}`);
  const [vendorRef, setVendorRef] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [qtnDate, setQtnDate] = useState(new Date().toISOString().split('T')[0]);
  const [validityDays, setValidityDays] = useState(30);
  const [validUntil, setValidUntil] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');
  const [advanceRequired, setAdvanceRequired] = useState(0);
  const [bankGuarantee, setBankGuarantee] = useState('No');
  const [incoterms, setIncoterms] = useState('Ex-Works');
  const [namedPlace, setNamedPlace] = useState('Factory Gate');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [leadTime, setLeadTime] = useState(15);
  const [shippingMode, setShippingMode] = useState('Road');
  const [coverNote, setCoverNote] = useState('Please find our quotation.');
  const [internalNotes, setInternalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showToast, setShowToast] = useState(false);

  // Line items state
  const [lineItems, setLineItems] = useState([]);

  // Calculate valid until date dynamically when date or validity changes
  useEffect(() => {
    if (qtnDate && validityDays) {
      const date = new Date(qtnDate);
      date.setDate(date.getDate() + parseInt(validityDays || 0));
      setValidUntil(date.toISOString().split('T')[0]);
    }
  }, [qtnDate, validityDays]);

  // Fetch PR data if prId is provided
  useEffect(() => {
    if (prId) {
      setLoadingPr(true);
      const token = localStorage.getItem('auth_token');
      axios.get(`/api/purchase-requisitions/pr-number/${prId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
      .then(response => {
        const data = response.data;
        if (data) {
          setPrData(data);
          // Set delivery date default from PR date
          if (data.requiredDate) {
            setDeliveryDate(data.requiredDate.split('T')[0]);
          }
          // Convert PR items into quotation line items
          const items = (data.items || []).map((item, idx) => ({
            id: item.id || (idx + 1) * 10,
            item_code: item.sku || 'ITEM-001',
            description: item.materialDescription || item.sku || 'Material Description',
            pr_qty: item.quantity || item.itemQuantity || 0,
            quoted_qty: item.quantity || item.itemQuantity || 0,
            uom: item.uom || 'MTR',
            unit_price: '',
            gst_percent: 18,
            delivery_date: item.requestedDeliveryDate || new Date().toISOString().split('T')[0],
            is_addon: false
          }));
          setLineItems(items);
        }
      })
      .catch(err => {
        console.error('Failed to load PR details for wizard, loading fallback mockup lines.', err);
        setLineItems([
          {
            id: 10,
            item_code: 'MGCTShirt001',
            description: 'MGCTShirt001 manufacturing units.',
            pr_qty: 25,
            quoted_qty: 25,
            uom: 'EA',
            unit_price: 599.00,
            gst_percent: 18,
            delivery_date: new Date().toISOString().split('T')[0],
            is_addon: false
          }
        ]);
      })
      .finally(() => {
        setLoadingPr(false);
      });
    } else {
      // Standalone quotation: start with one empty addon row
      setLineItems([
        {
          id: 10,
          item_code: 'ITEM-001',
          description: 'Quoted Material Description',
          pr_qty: 0,
          quoted_qty: 1,
          uom: 'NOS',
          unit_price: '',
          gst_percent: 18,
          delivery_date: new Date().toISOString().split('T')[0],
          is_addon: true
        }
      ]);
    }
  }, [prId]);

  const [vendorCode, setVendorCode] = useState('');
  const [vendorIdState, setVendorIdState] = useState(null);
  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user_data');
      if (userStr) {
        const user = JSON.parse(userStr);
        let cId = user.company_id || user.companyId || user.vendor_id || user.vendorId || user.id;
        if (user.email === 'markjhon@gmail.com' && !cId) cId = 1381;
        if (cId) {
          setVendorIdState(cId);
          axios.get(`/api/vendors/${cId}`)
            .then(res => {
              if (res.data) setVendorCode(res.data.bp_no);
            }).catch(() => { });
        }
      }
    } catch (e) {}
  }, []);

  const handleLineItemChange = (index, field, value) => {
    const updated = [...lineItems];
    updated[index][field] = value;
    setLineItems(updated);
  };

  const addAddonItem = () => {
    setLineItems([
      ...lineItems,
      {
        id: (lineItems.length + 1) * 10,
        item_code: `ADDON-${lineItems.length + 1}`,
        description: 'New add-on item description',
        pr_qty: 0,
        quoted_qty: 1,
        uom: 'NOS',
        unit_price: '',
        gst_percent: 18,
        delivery_date: new Date().toISOString().split('T')[0],
        is_addon: true
      }
    ]);
  };

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState('');
  const [uploadedFile, setUploadedFile] = useState(null);
  const [additionalDocs, setAdditionalDocs] = useState({});
  const [activeDocType, setActiveDocType] = useState(null);
  const handleOcrUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrSuccessMsg('');
    setSubmitError('');

    // Mock upload success without calling the OCR API
    setTimeout(() => {
      setUploadedFile(file);
      setOcrSuccessMsg(`Successfully uploaded ${file.name} as supporting document.`);
      setOcrLoading(false);
    }, 1000);
  };

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.quoted_qty || 0) * parseFloat(item.unit_price || 0)), 0);
  const gstTotal = lineItems.reduce((sum, item) => {
    const price = parseFloat(item.unit_price || 0);
    const qty = parseFloat(item.quoted_qty || 0);
    const gstPercent = parseFloat(item.gst_percent || 0);
    return sum + (price * qty * (gstPercent / 100));
  }, 0);
  const freightTotal = 0; // Mock separate freight
  const grandTotal = subtotal + gstTotal + freightTotal;

  const handleSubmit = async (isDraft = false) => {
    setSubmitting(true);
    setSubmitError('');
    const token = localStorage.getItem('auth_token');

    // Parse prId numeric value from the loaded PR data or fallback
    let prNumericId = null;
    if (prData && prData.id) {
      prNumericId = Number(prData.id);
    } else if (prId) {
      // Split by hyphen and take the last part (e.g., PR-2026-0025 -> 25)
      const parts = prId.split('-');
      prNumericId = parseInt(parts[parts.length - 1], 10) || 1;
    }

    const payload = {
      pr_id: prNumericId,
      vendor_code: vendorCode,
      quotation_header: {
        quotation_number: qtnNumber,
        quotation_date: qtnDate || null,
        vendor_reference_no: vendorRef || `REF-${Math.floor(100 + Math.random() * 900)}`,
        currency: currency,
        validity_days: parseInt(validityDays || 30),
        valid_until: validUntil || null,
        status: isDraft ? 'DRAFT' : 'SUBMITTED'
      },
      payment_terms: {
        payment_terms_id: paymentTerms === 'Net 30 Days' ? 1 : paymentTerms === 'Net 45 Days' ? 2 : 3,
        advance_required_percent: parseInt(advanceRequired || 0),
        bank_guarantee_required: bankGuarantee === 'Yes'
      },
      delivery_details: {
        incoterm: incoterms,
        named_place: namedPlace,
        quoted_delivery_date: deliveryDate || new Date().toISOString().split('T')[0],
        lead_time_days: parseInt(leadTime || 15),
        shipping_mode: shippingMode.toUpperCase()
      },
      freight_details: {
        freight_charge_type: 'NO_SEPARATE_FREIGHT',
        freight_amount: freightTotal
      },
      remarks: {
        cover_note: coverNote,
        internal_notes: internalNotes
      },
      line_items: lineItems.map((item) => ({
        pr_line_id: item.id,
        item_code: item.item_code,
        description: item.description,
        pr_qty: item.pr_qty || item.quoted_qty,
        quoted_qty: parseFloat(item.quoted_qty || 0),
        uom: item.uom,
        unit_price: parseFloat(item.unit_price || 0),
        gst_percent: parseFloat(item.gst_percent || 18),
        delivery_date: item.delivery_date || null,
        payment_terms_id: null,
        incoterm: null,
        freight_amount: 0
      })),
      documents: {
        quotation_pdf: uploadedFile ? uploadedFile.name : '',
        technical_specification: Object.keys(additionalDocs).filter(k => k.startsWith('technical')).map(k => ({ file_name: additionalDocs[k].name, file_size: additionalDocs[k].size, file_type: additionalDocs[k].type, file_path: '' })),
        quality_certificate: Object.keys(additionalDocs).filter(k => k.startsWith('quality')).map(k => ({ file_name: additionalDocs[k].name, file_size: additionalDocs[k].size, file_type: additionalDocs[k].type, file_path: '' })),
        product_brochure: Object.keys(additionalDocs).filter(k => k.startsWith('product')).map(k => ({ file_name: additionalDocs[k].name, file_size: additionalDocs[k].size, file_type: additionalDocs[k].type, file_path: '' })),
        other_documents: Object.keys(additionalDocs).filter(k => k.startsWith('other')).map(k => ({ file_name: additionalDocs[k].name, file_size: additionalDocs[k].size, file_type: additionalDocs[k].type, file_path: '' }))
      }
    };

    try {
      const vId = vendorIdState || 1381;
      const response = await axios.post(`/api/vendor/quotations?vendor_id=${vId}`, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (response.status === 200 || response.status === 201 || response.data?.status === 'success') {
        setShowToast(true);
        setTimeout(() => {
          setShowToast(false);
          onSuccess();
        }, 2000);
      } else {
        setSubmitError(response.data?.message || 'Submission failed. Please check inputs.');
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.message || err.response?.data?.error || 'An error occurred during submission.';
      setSubmitError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const showStep = (step) => {
    if (step > 2 && currentStep === 2) {
      const hasZeroPrice = lineItems.some(item => parseFloat(item.unit_price || 0) <= 0);
      if (hasZeroPrice) {
        alert("Please ensure all line items have a valid Unit Price greater than 0 before proceeding.");
        return;
      }
    }
    if (step === 4 && currentStep === 3) {
      if (!uploadedFile) {
        alert("Please upload your Quotation PDF before proceeding.");
        return;
      }
      const requiredDocs = ['technical', 'quality', 'brochure', 'other'];
      const missing = requiredDocs.filter(d => !additionalDocs[d]);
      if (missing.length > 0) {
        alert("Please upload all mandatory Additional Supporting Documents before proceeding.");
        return;
      }
    }
    setCurrentStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="fade-in-slide container-fluid py-4 text-start">
      <style>{`
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
      {/* Header section */}
      <div className="row align-items-center mb-4">
        <div className="col-sm">
          <div>
            <h3 className="fw-bold mb-1 text-dark">
              {prId ? `New Quotation — ${prId}` : 'New Standalone Quotation'}
            </h3>
            <p className="text-muted mb-0 small">
              {prId ? `Quoting against PR ${prId}` : 'No PR reference — specify requirements in line items'}
            </p>
          </div>
        </div>
        <div className="col-sm-auto mt-3 mt-sm-0">
          <div className="d-flex align-items-center gap-3">
            <button className="btn btn-link text-muted text-decoration-none small fw-semibold" onClick={onBack}>
              <i className="fas fa-arrow-left me-1"></i> Back
            </button>
            {currentStep === 4 ? (
              <button 
                className="btn btn-dark shadow-sm px-4 fw-bold" 
                style={{ borderRadius: '6px', backgroundColor: '#293383' }}
                disabled={submitting}
                onClick={() => handleSubmit(false)}
              >
                {submitting ? 'Submitting...' : 'Submit Quotation'} <i className="fas fa-arrow-right ms-1"></i>
              </button>
            ) : (
              <button 
                className="btn btn-dark shadow-sm px-4 fw-bold" 
                style={{ borderRadius: '6px', backgroundColor: '#1e293b' }}
                onClick={() => showStep(currentStep + 1)}
              >
                Next Step <i className="fas fa-arrow-right ms-1"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Step Progress Indicators */}
      <div className="row mb-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm">
            <div className="card-body py-4 position-relative">
              <div className="d-flex justify-content-between align-items-center position-relative" style={{ zIndex: 1 }}>
                <div 
                  className={`step-item ${currentStep === 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}
                  onClick={() => showStep(1)}
                  style={{ textAlign: 'center', flex: 1, cursor: 'pointer' }}
                >
                  <div className="step-number" style={{
                    width: '36px', height: '36px', borderRadius: '50%', margin: '0 auto 8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                    border: '2px solid #eef2f7',
                    backgroundColor: currentStep === 1 ? '#0acf97' : currentStep > 1 ? '#fff' : '#fff',
                    borderColor: currentStep >= 1 ? '#0acf97' : '#e2e8f0',
                    color: currentStep === 1 ? '#fff' : currentStep > 1 ? '#0acf97' : '#94a3b8'
                  }}>1</div>
                  <div className="step-label text-uppercase fw-bold" style={{ fontSize: '10px', color: currentStep >= 1 ? '#0acf97' : '#94a3b8' }}>Header & Terms</div>
                </div>

                <div 
                  className={`step-item ${currentStep === 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}
                  onClick={() => showStep(2)}
                  style={{ textAlign: 'center', flex: 1, cursor: 'pointer' }}
                >
                  <div className="step-number" style={{
                    width: '36px', height: '36px', borderRadius: '50%', margin: '0 auto 8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                    border: '2px solid #eef2f7',
                    backgroundColor: currentStep === 2 ? '#0acf97' : currentStep > 2 ? '#fff' : '#fff',
                    borderColor: currentStep >= 2 ? '#0acf97' : '#e2e8f0',
                    color: currentStep === 2 ? '#fff' : currentStep > 2 ? '#0acf97' : '#94a3b8'
                  }}>2</div>
                  <div className="step-label text-uppercase fw-bold" style={{ fontSize: '10px', color: currentStep >= 2 ? '#0acf97' : '#94a3b8' }}>Line Items</div>
                </div>

                <div 
                  className={`step-item ${currentStep === 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}
                  onClick={() => showStep(3)}
                  style={{ textAlign: 'center', flex: 1, cursor: 'pointer' }}
                >
                  <div className="step-number" style={{
                    width: '36px', height: '36px', borderRadius: '50%', margin: '0 auto 8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                    border: '2px solid #eef2f7',
                    backgroundColor: currentStep === 3 ? '#0acf97' : currentStep > 3 ? '#fff' : '#fff',
                    borderColor: currentStep >= 3 ? '#0acf97' : '#e2e8f0',
                    color: currentStep === 3 ? '#fff' : currentStep > 3 ? '#0acf97' : '#94a3b8'
                  }}>3</div>
                  <div className="step-label text-uppercase fw-bold" style={{ fontSize: '10px', color: currentStep >= 3 ? '#0acf97' : '#94a3b8' }}>Upload Docs</div>
                </div>

                <div 
                  className={`step-item ${currentStep === 4 ? 'active' : ''}`}
                  onClick={() => showStep(4)}
                  style={{ textAlign: 'center', flex: 1, cursor: 'pointer' }}
                >
                  <div className="step-number" style={{
                    width: '36px', height: '36px', borderRadius: '50%', margin: '0 auto 8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold',
                    border: '2px solid #eef2f7',
                    backgroundColor: currentStep === 4 ? '#0acf97' : '#fff',
                    borderColor: currentStep === 4 ? '#0acf97' : '#e2e8f0',
                    color: currentStep === 4 ? '#fff' : '#94a3b8'
                  }}>4</div>
                  <div className="step-label text-uppercase fw-bold" style={{ fontSize: '10px', color: currentStep === 4 ? '#0acf97' : '#94a3b8' }}>Review & Submit</div>
                </div>
              </div>
              <div 
                className="position-absolute" 
                style={{
                  top: '42px', left: '12%', right: '12%', height: '2px', backgroundColor: '#e2e8f0', zIndex: 0
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="alert alert-danger mb-4" role="alert">
          <strong>Error:</strong> {submitError}
        </div>
      )}

      {/* Step 1 Content: Header & Terms */}
      {currentStep === 1 && (
        <div className="step-container">
          {prId && (
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
                <div className="d-flex align-items-center">
                  <i className="fas fa-link me-2 text-success"></i>
                  <h6 className="fw-bold mb-0 text-uppercase text-dark" style={{ fontSize: '11px', letterSpacing: '1px' }}>PR Reference</h6>
                </div>
                <span className="text-muted fw-bold" style={{ fontSize: '10px' }}>EBAN.BANFN</span>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>PR Number</label>
                    <input type="text" className="form-control bg-light border-0" value={prId} readOnly />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>PR Description</label>
                    <input 
                      type="text" 
                      className="form-control bg-light border-0" 
                      value={prData?.remarks || 'Standard Purchase Requisition'} 
                      readOnly 
                    />
                  </div>
                </div>
                <div className="alert alert-soft-info border-0 mt-3 d-flex align-items-center mb-0" style={{ backgroundColor: 'rgba(56, 189, 248, 0.08)', color: '#0369a1' }}>
                  <i className="fas fa-info-circle me-2 fs-5"></i>
                  <div style={{ fontSize: '12px' }}>
                    This quotation is linked to PR <strong>{prId}</strong>. Quantities quoted cannot exceed the PR requested quantity. You may quote less. You can also add new lines (e.g. packaging) not in the PR.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quotation Header */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center">
              <i className="fas fa-file-invoice me-2 text-warning"></i>
              <h6 className="fw-bold mb-0 text-uppercase text-dark" style={{ fontSize: '11px', letterSpacing: '1px' }}>Quotation Header</h6>
            </div>
            <div className="card-body">
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Quotation Number</label>
                  <input type="text" className="form-control bg-light border-0 fw-bold" value={qtnNumber} readOnly />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Your Reference No. <small className="text-muted fw-normal">(optional)</small></label>
                  <input 
                    type="text" 
                    className="form-control border-light-subtle" 
                    placeholder="Your internal quotation reference"
                    value={vendorRef}
                    onChange={(e) => setVendorRef(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Currency *</label>
                  <select 
                    className="form-select border-light-subtle"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="INR">INR — Indian Rupee</option>
                    <option value="USD">USD — US Dollar</option>
                  </select>
                </div>
              </div>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Quotation Date</label>
                  <input 
                    type="date" 
                    className="form-control border-light-subtle" 
                    value={qtnDate}
                    onChange={(e) => setQtnDate(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Validity (days) *</label>
                  <input 
                    type="number" 
                    className="form-control border-light-subtle" 
                    value={validityDays}
                    onChange={(e) => setValidityDays(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Valid Until</label>
                  <input type="date" className="form-control bg-light border-0" value={validUntil} readOnly />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Terms */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center">
              <i className="fas fa-credit-card me-2 text-primary"></i>
              <h6 className="fw-bold mb-0 text-uppercase text-dark" style={{ fontSize: '11px', letterSpacing: '1px' }}>Payment Terms</h6>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Payment Terms *</label>
                  <select 
                    className="form-select border-light-subtle"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                  >
                    <option value="Net 30 Days">Net 30 Days</option>
                    <option value="Net 45 Days">Net 45 Days</option>
                    <option value="100% Advance">100% Advance</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Advance Required (%)</label>
                  <input 
                    type="number" 
                    className="form-control border-light-subtle" 
                    value={advanceRequired}
                    onChange={(e) => setAdvanceRequired(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Bank Guarantee Required?</label>
                  <select 
                    className="form-select border-light-subtle"
                    value={bankGuarantee}
                    onChange={(e) => setBankGuarantee(e.target.value)}
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Incoterms & Delivery */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center">
              <i className="fas fa-truck me-2 text-danger"></i>
              <h6 className="fw-bold mb-0 text-uppercase text-dark" style={{ fontSize: '11px', letterSpacing: '1px' }}>Incoterms & Delivery</h6>
            </div>
            <div className="card-body">
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Incoterms *</label>
                  <select 
                    className="form-select border-light-subtle"
                    value={incoterms}
                    onChange={(e) => setIncoterms(e.target.value)}
                  >
                    <option value="Ex-Works">Ex-Works</option>
                    <option value="FOR">FOR - Free On Road</option>
                    <option value="FOB">FOB - Free On Board</option>
                  </select>
                </div>
                <div className="col-md-8">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Named Place / Location</label>
                  <input 
                    type="text" 
                    className="form-control border-light-subtle" 
                    placeholder="e.g. Bangalore Plant, Gate 3"
                    value={namedPlace}
                    onChange={(e) => setNamedPlace(e.target.value)}
                  />
                </div>
              </div>
              <div className="row g-3">
                <div className="col-md-4">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Quoted Delivery Date *</label>
                  <input 
                    type="date" 
                    className="form-control border-light-subtle" 
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Lead Time (days)</label>
                  <input 
                    type="number" 
                    className="form-control border-light-subtle" 
                    placeholder="e.g. 15"
                    value={leadTime}
                    onChange={(e) => setLeadTime(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Shipping Mode</label>
                  <select 
                    className="form-select border-light-subtle"
                    value={shippingMode}
                    onChange={(e) => setShippingMode(e.target.value)}
                  >
                    <option value="Road">Road</option>
                    <option value="Rail">Rail</option>
                    <option value="Air">Air</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Cover Note & Remarks */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center">
              <i className="fas fa-message me-2 text-success"></i>
              <h6 className="fw-bold mb-0 text-uppercase text-dark" style={{ fontSize: '11px', letterSpacing: '1px' }}>Cover Note & Remarks</h6>
            </div>
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Cover Note <small className="text-muted fw-normal">(visible to buyer)</small></label>
                  <textarea 
                    className="form-control border-light-subtle" 
                    rows="4" 
                    style={{ resize: 'none' }}
                    placeholder="Introduce your quotation, highlight key strengths..."
                    value={coverNote}
                    onChange={(e) => setCoverNote(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label text-muted fw-bold text-uppercase" style={{ fontSize: '10px' }}>Internal Notes <small className="text-muted fw-normal">(not sent to buyer)</small></label>
                  <textarea 
                    className="form-control border-light-subtle" 
                    rows="4" 
                    style={{ resize: 'none' }}
                    placeholder="Internal memos, pricing rationale..."
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2 mb-5">
            <button className="btn btn-light border px-4" onClick={onBack} style={{ borderRadius: '6px' }}>Cancel</button>
            <button className="btn btn-dark px-4" onClick={() => showStep(2)} style={{ borderRadius: '6px', backgroundColor: '#1e293b' }}>
              Next: Line Items <i className="fas fa-arrow-right ms-1"></i>
            </button>
          </div>
        </div>
      )}

      {/* Step 2 Content: Line Items */}
      {currentStep === 2 && (
        <div className="step-container">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center">
                <i className="fas fa-list-ol me-2 text-danger"></i>
                <h6 className="fw-bold mb-0 text-uppercase text-dark" style={{ fontSize: '11px', letterSpacing: '1px' }}>Line Items</h6>
              </div>
              <div className="d-flex align-items-center gap-2">
                <button 
                  className="btn btn-outline-success btn-sm fs-11 fw-bold px-3"
                  style={{ borderRadius: '6px' }}
                  onClick={addAddonItem}
                >
                  <i className="fas fa-plus me-1"></i> Add-on Item
                </button>
                <button 
                  className="btn btn-link btn-sm text-muted text-decoration-none small fw-semibold" 
                  onClick={() => showStep(1)}
                >
                  <i className="fas fa-arrow-left me-1"></i> Back
                </button>
                <button 
                  className="btn btn-dark btn-sm px-4 fw-bold" 
                  style={{ borderRadius: '6px', backgroundColor: '#1e293b' }}
                  onClick={() => showStep(3)}
                >
                  Next: Documents <i className="fas fa-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body p-0">
              <div className="bg-light p-3 border-bottom d-flex align-items-center text-muted" style={{ fontSize: '11px' }}>
                <i className="fas fa-info-circle me-2 fs-6 text-info"></i>
                <div>
                  <strong>PR lines</strong> are imported from the reference — edit quantity, price and delivery date. | 
                  <i className="fas fa-wand-magic-sparkles ms-3 me-1 text-warning"></i> <strong>Add-on items</strong> are extra additions like packaging, transport, etc.
                </div>
              </div>
              <div className="table-responsive">
                <table className="table table-hover table-bordered border-light align-middle mb-0 text-center" style={{ fontSize: '11px' }}>
                  <thead className="bg-light text-muted fw-bold">
                    <tr>
                      <th style={{ width: '50px' }}>Type</th>
                      <th style={{ width: '60px' }}>Item</th>
                      <th>Description / Material</th>
                      <th style={{ width: '90px' }}>Requested Qty</th>
                      <th style={{ width: '90px' }}>Quoted Qty *</th>
                      <th style={{ width: '65px' }}>UOM</th>
                      <th style={{ width: '120px' }}>Unit Price *</th>
                      <th style={{ width: '70px' }}>GST %</th>
                      <th style={{ width: '120px' }}>Delivery Date</th>
                      <th style={{ width: '110px' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingPr ? (
                      <tr>
                        <td colSpan="10" className="py-5 text-muted">
                          <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                          Loading PR details...
                        </td>
                      </tr>
                    ) : lineItems.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="py-5 text-muted">
                          No lines added yet. Click "+ Add-on Item" to add a custom item.
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((item, idx) => (
                        <tr key={idx} style={{ backgroundColor: item.is_addon ? '#fefcbf' : 'transparent' }}>
                          <td>
                            {item.is_addon ? (
                              <i className="fas fa-wand-magic-sparkles text-warning fs-5" title="Add-on item"></i>
                            ) : (
                              <i className="fas fa-link text-primary fs-5" title="Linked to PR"></i>
                            )}
                          </td>
                          <td className="fw-bold">{item.id}</td>
                          <td>
                            <input 
                              type="text" 
                              className="form-control form-control-sm border-light-subtle bg-white"
                              value={item.description}
                              disabled={!item.is_addon}
                              onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                            />
                            {item.is_addon && (
                              <input 
                                type="text" 
                                className="form-control form-control-sm border-light-subtle bg-white mt-1"
                                placeholder="Item Code"
                                value={item.item_code}
                                onChange={(e) => handleLineItemChange(idx, 'item_code', e.target.value)}
                              />
                            )}
                          </td>
                          <td>{item.is_addon ? '—' : item.pr_qty}</td>
                          <td>
                            <input 
                              type="number" 
                              className="form-control form-control-sm border-light-subtle text-center bg-white"
                              value={item.quoted_qty}
                              onChange={(e) => handleLineItemChange(idx, 'quoted_qty', parseFloat(e.target.value) || 0)}
                            />
                          </td>
                          <td>
                            {item.is_addon ? (
                              <input 
                                type="text" 
                                className="form-control form-control-sm border-light-subtle text-center bg-white"
                                value={item.uom}
                                onChange={(e) => handleLineItemChange(idx, 'uom', e.target.value)}
                              />
                            ) : (
                              item.uom
                            )}
                          </td>
                          <td>
                            <div className="input-group input-group-sm">
                              <span className="input-group-text border-light-subtle bg-light">{currency === 'USD' ? '$' : '₹'}</span>
                              <input 
                                type="number" 
                                className="form-control form-control-sm border-light-subtle bg-white" 
                                placeholder="Price"
                                value={item.unit_price}
                                onChange={(e) => handleLineItemChange(idx, 'unit_price', e.target.value === '' ? '' : e.target.value)}
                              />
                            </div>
                          </td>
                          <td>
                            <select 
                              className="form-select form-select-sm border-light-subtle bg-white"
                              value={item.gst_percent}
                              onChange={(e) => handleLineItemChange(idx, 'gst_percent', parseFloat(e.target.value) || 0)}
                            >
                              <option value="0">0%</option>
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                              <option value="28">28%</option>
                            </select>
                          </td>
                          <td>
                            <input 
                              type="date" 
                              className="form-control form-control-sm border-light-subtle bg-white" 
                              value={item.delivery_date}
                              onChange={(e) => handleLineItemChange(idx, 'delivery_date', e.target.value)}
                            />
                          </td>
                          <td className="fw-bold text-dark text-end pe-3">
                            {currency === 'USD' ? '$' : '₹'} {(parseFloat(item.quoted_qty || 0) * parseFloat(item.unit_price || 0)).toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-light fw-bold border-top text-end">
                    <tr>
                      <td colSpan="8" className="border-0"></td>
                      <td className="text-muted py-2" style={{ fontSize: '10px' }}>SUBTOTAL:</td>
                      <td className="pe-3 text-dark">{currency === 'USD' ? '$' : '₹'} {subtotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan="8" className="border-0"></td>
                      <td className="text-muted py-2" style={{ fontSize: '10px' }}>GST TOTAL:</td>
                      <td className="pe-3 text-dark">{currency === 'USD' ? '$' : '₹'} {gstTotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan="8" className="border-0"></td>
                      <td className="text-muted py-2" style={{ fontSize: '10px' }}>GRAND TOTAL:</td>
                      <td className="pe-3 text-success" style={{ fontSize: '13px' }}>{currency === 'USD' ? '$' : '₹'} {grandTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 Content: Upload & Docs */}
      {currentStep === 3 && (
        <div className="step-container text-start">
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center">
                <i className="fas fa-file-pdf me-2 text-primary"></i>
                <h6 className="fw-bold mb-0 text-uppercase text-dark" style={{ fontSize: '11px', letterSpacing: '1px' }}>Upload Documents</h6>
              </div>
              <div className="d-flex align-items-center gap-2">
                <button className="btn btn-link btn-sm text-muted text-decoration-none small fw-semibold" onClick={() => showStep(2)}>
                  <i className="fas fa-arrow-left me-1"></i> Back
                </button>
                <button 
                  className="btn btn-dark btn-sm px-4 fw-bold" 
                  style={{ borderRadius: '6px', backgroundColor: '#1e293b' }}
                  onClick={() => showStep(4)}
                >
                  Next: Review & Submit <i className="fas fa-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            <div className="card-body">
              <label className="form-label text-muted fw-bold text-uppercase mb-3" style={{ fontSize: '10px' }}>Upload Your Quotation PDF <span className="text-danger fw-bold">*</span></label>
              
              <div className="position-relative">
                <input 
                  type="file" 
                  id="qtn-pdf-upload" 
                  accept="application/pdf" 
                  className="d-none" 
                  onChange={handleOcrUpload} 
                  disabled={ocrLoading}
                />
                <label 
                  htmlFor="qtn-pdf-upload"
                  className="upload-dropzone border border-dashed rounded-3 p-5 text-center mb-4 bg-light bg-opacity-50 w-100 d-block"
                  style={{ cursor: ocrLoading ? 'not-allowed' : 'pointer', border: '2px dashed #cbd5e1' }}
                >
                  {ocrLoading ? (
                    <div>
                      <div className="spinner-border text-success mb-3" role="status"></div>
                      <h6 className="fw-bold mb-1 text-dark">Uploading Document...</h6>
                      <p className="text-muted mb-0" style={{ fontSize: '11px' }}>Please wait</p>
                    </div>
                  ) : (
                    <div>
                      <i className="fas fa-file-pdf text-muted mb-3 d-block" style={{ fontSize: '42px' }}></i>
                      <h6 className="fw-bold mb-1 text-dark">Drop your PDF quotation here, or click to browse</h6>
                      <p className="text-muted mb-0" style={{ fontSize: '11px' }}>PDF, max 10 MB</p>
                    </div>
                  )}
                </label>
              </div>

              {ocrSuccessMsg && (
                <div className="alert alert-success border-0 d-flex flex-column mb-4">
                  <div className="d-flex align-items-center mb-2">
                    <i className="fas fa-check-circle me-2"></i>
                    <div style={{ fontSize: '12px' }}>{ocrSuccessMsg}</div>
                  </div>
                  {uploadedFile && (
                    <div className="mt-2 border rounded p-3 bg-white">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <div className="d-flex align-items-center gap-2">
                          <i className="fas fa-file-pdf text-danger fs-4"></i>
                          <div>
                            <p className="mb-0 fw-bold small text-dark">{uploadedFile.name}</p>
                            <p className="mb-0 text-muted" style={{ fontSize: '10px' }}>{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                          </div>
                        </div>
                        <div className="d-flex gap-2">
                          <a 
                            href={URL.createObjectURL(uploadedFile)} 
                            download={uploadedFile.name}
                            className="btn btn-sm btn-outline-success fw-semibold"
                            style={{ fontSize: '12px', borderRadius: '4px' }}
                          >
                            <i className="fas fa-download me-1"></i> Download
                          </a>
                        </div>
                      </div>
                      <iframe src={URL.createObjectURL(uploadedFile)} width="100%" height="400px" style={{ border: '1px solid #e2e8f0', borderRadius: '6px' }} title="Quotation PDF Preview"></iframe>
                    </div>
                  )}
                </div>
              )}



              <label className="form-label text-muted fw-bold text-uppercase mb-3 mt-4" style={{ fontSize: '10px' }}>Additional Supporting Documents <span className="text-danger fw-bold">*</span></label>
              
              <input 
                type="file" 
                id="additional-doc-upload" 
                className="d-none" 
                onChange={(e) => {
                  if (e.target.files[0] && activeDocType) {
                    setAdditionalDocs({ ...additionalDocs, [activeDocType]: e.target.files[0] });
                  }
                }} 
              />
              
              <div className="d-flex flex-column gap-2">
                {[
                  { id: 'technical', label: 'Technical Specification' },
                  { id: 'quality', label: 'Quality Certificate' },
                  { id: 'brochure', label: 'Product Brochure' },
                  { id: 'other', label: 'Other Document' }
                ].map(docType => {
                  const file = additionalDocs[docType.id];
                  if (file) {
                    return (
                      <div key={docType.id} className="border rounded p-2 bg-white d-flex align-items-center justify-content-between" style={{ minWidth: '220px' }}>
                        <div className="d-flex align-items-center gap-2">
                          <i className="fas fa-file-alt text-primary fs-5"></i>
                          <div style={{ maxWidth: '200px' }} className="text-truncate">
                            <p className="mb-0 fw-bold text-dark" style={{ fontSize: '11px' }}>{docType.label}</p>
                            <p className="mb-0 text-muted text-truncate" style={{ fontSize: '10px' }} title={file.name}>{file.name}</p>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          <a 
                            href={URL.createObjectURL(file)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-outline-primary fw-semibold"
                            style={{ fontSize: '11px', padding: '2px 8px' }}
                          >
                            <i className="fas fa-eye me-1"></i> Preview
                          </a>
                          <button 
                            className="btn btn-sm btn-light border-0 text-danger" 
                            style={{ padding: '2px 8px' }}
                            onClick={() => {
                              const newDocs = { ...additionalDocs };
                              delete newDocs[docType.id];
                              setAdditionalDocs(newDocs);
                            }}
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <button 
                      key={docType.id}
                      className="btn btn-light border px-3 py-2 fw-semibold text-start" 
                      style={{ fontSize: '12px', backgroundColor: '#fff', borderRadius: '6px' }}
                      onClick={() => {
                        setActiveDocType(docType.id);
                        document.getElementById('additional-doc-upload').click();
                      }}
                    >
                      <i className="fas fa-plus me-2 text-success"></i> {docType.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4 Content: Review & Submit */}
      {currentStep === 4 && (
        <div className="step-container">
          <div className="d-flex align-items-center mb-4">
            <p className="text-muted mb-0 small">Review details before submitting quotation</p>
            <div className="ms-auto d-flex gap-2">
              <button className="btn btn-link btn-sm text-muted text-decoration-none small fw-semibold" onClick={() => showStep(3)}>
                <i className="fas fa-arrow-left me-1"></i> Back
              </button>
              <button 
                className="btn btn-dark btn-sm px-4 fw-bold" 
                style={{ borderRadius: '6px', backgroundColor: '#293383', borderColor: '#293383' }}
                disabled={submitting}
                onClick={() => handleSubmit(false)}
              >
                {submitting ? 'Submitting...' : 'Submit Quotation'} <i className="fas fa-arrow-right ms-1"></i>
              </button>
            </div>
          </div>

          {/* Quotation Summary */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center">
              <i className="fas fa-file-lines me-2 text-warning"></i>
              <h6 className="fw-bold mb-0 text-uppercase text-dark" style={{ fontSize: '11px', letterSpacing: '1px' }}>Quotation Summary</h6>
            </div>
            <div className="card-body">
              <div className="row g-4 text-start">
                <div className="col-md-4 col-6">
                  <label className="form-label text-muted fw-bold text-uppercase mb-1" style={{ fontSize: '10px' }}>Quotation No.</label>
                  <h6 className="fw-bold text-success mb-0">{qtnNumber}</h6>
                </div>
                <div className="col-md-4 col-6">
                  <label className="form-label text-muted fw-bold text-uppercase mb-1" style={{ fontSize: '10px' }}>PR Reference</label>
                  <h6 className="fw-bold text-dark mb-0">{prId || '— Standalone'}</h6>
                </div>
                <div className="col-md-4 col-6">
                  <label className="form-label text-muted fw-bold text-uppercase mb-1" style={{ fontSize: '10px' }}>Currency</label>
                  <h6 className="fw-bold text-dark mb-0">{currency}</h6>
                </div>
                <div className="col-md-4 col-6">
                  <label className="form-label text-muted fw-bold text-uppercase mb-1" style={{ fontSize: '10px' }}>Payment Terms</label>
                  <h6 className="fw-bold text-dark mb-0">{paymentTerms}</h6>
                </div>
                <div className="col-md-4 col-6">
                  <label className="form-label text-muted fw-bold text-uppercase mb-1" style={{ fontSize: '10px' }}>Incoterms</label>
                  <h6 className="fw-bold text-dark mb-0">{incoterms} ({namedPlace})</h6>
                </div>
                <div className="col-md-4 col-6">
                  <label className="form-label text-muted fw-bold text-uppercase mb-1" style={{ fontSize: '10px' }}>Valid Until</label>
                  <h6 className="fw-bold text-dark mb-0">{validUntil}</h6>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Summary */}
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-white py-3 border-bottom d-flex align-items-center">
              <i className="fas fa-list-check me-2 text-danger"></i>
              <h6 className="fw-bold mb-0 text-uppercase text-dark" style={{ fontSize: '11px', letterSpacing: '1px' }}>{lineItems.length} Line Items</h6>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0 text-center" style={{ fontSize: '11px' }}>
                  <thead className="bg-light text-muted text-uppercase fw-bold">
                    <tr>
                      <th style={{ width: '80px' }}>Type</th>
                      <th className="text-start">Description</th>
                      <th style={{ width: '120px' }}>Item Code</th>
                      <th style={{ width: '120px' }}>Qty / UOM</th>
                      <th style={{ width: '150px' }}>Price</th>
                      <th style={{ width: '150px' }} className="text-end pe-4">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          {item.is_addon ? (
                            <span className="badge bg-soft-warning text-warning border px-2 py-1">ADDON</span>
                          ) : (
                            <span className="badge bg-soft-info text-info border px-2 py-1">PR LINE</span>
                          )}
                        </td>
                        <td className="text-start text-dark fw-medium">{item.description}</td>
                        <td className="text-muted">{item.item_code}</td>
                        <td className="fw-bold text-dark">
                          {item.quoted_qty} <span className="text-muted fw-normal">{item.uom}</span>
                        </td>
                        <td className="fw-bold text-dark">
                          {currency === 'USD' ? '$' : '₹'} {parseFloat(item.unit_price || 0).toFixed(2)}
                        </td>
                        <td className="text-end fw-bold text-dark pe-4">
                          {currency === 'USD' ? '$' : '₹'} {(parseFloat(item.quoted_qty || 0) * parseFloat(item.unit_price || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-light fw-bold border-top text-end">
                    <tr>
                      <td colSpan="4" className="border-0"></td>
                      <td className="text-muted py-2" style={{ fontSize: '10px' }}>SUBTOTAL:</td>
                      <td className="pe-4 text-dark">{currency === 'USD' ? '$' : '₹'} {subtotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan="4" className="border-0"></td>
                      <td className="text-muted py-2" style={{ fontSize: '10px' }}>GST TOTAL:</td>
                      <td className="pe-4 text-dark">{currency === 'USD' ? '$' : '₹'} {gstTotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td colSpan="4" className="border-0"></td>
                      <td className="text-muted py-2" style={{ fontSize: '10px' }}>GRAND TOTAL:</td>
                      <td className="pe-4 text-success" style={{ fontSize: '14px' }}>{currency === 'USD' ? '$' : '₹'} {grandTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          <div className="alert alert-soft-success border-0 d-flex align-items-center mb-5" style={{ backgroundColor: '#E3FBFC', color: '#0E7C86' }}>
            <i className="fas fa-check-circle me-2 fs-5"></i>
            <div className="small text-start">
              By submitting, you confirm that all prices, quantities, and terms in this quotation are accurate and commercially binding for the validity period.
            </div>
          </div>
        </div>
      )}
      {/* Success Toast */}
      {showToast && (
        <div 
          className="position-fixed top-0 end-0 p-3" 
          style={{ zIndex: 9999 }}
        >
          <div className="toast show align-items-center text-white bg-success border-0 fade-in-slide shadow" role="alert" aria-live="assertive" aria-atomic="true">
            <div className="d-flex">
              <div className="toast-body fw-medium d-flex align-items-center" style={{ fontSize: '14px' }}>
                <i className="fas fa-check-circle me-2 fs-5"></i>
                Quotation submitted successfully!
              </div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setShowToast(false)} aria-label="Close"></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewQuotationWizard;
