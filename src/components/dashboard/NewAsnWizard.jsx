import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './NewAsnWizard.css';

const MultiSelectDropdown = ({ options, selectedValues, onChange, placeholder = "Select Materials..." }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (val) => {
    let newSelected;
    if (selectedValues.includes(val)) {
      newSelected = selectedValues.filter(v => v !== val);
    } else {
      newSelected = [...selectedValues, val];
    }
    onChange(newSelected);
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <div 
        className="batch-in" 
        style={{ width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', minHeight: '32px', backgroundColor: '#fff', border: isOpen ? '1px solid var(--teal)' : '1px solid var(--line)' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {(!selectedValues || selectedValues.length === 0) ? (
          <span style={{color: 'var(--muted)'}}>{placeholder}</span>
        ) : (
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', width: '100%' }}>
            {selectedValues.map(val => options.find(o => o.value === val)?.label || val).join(', ')}
          </span>
        )}
      </div>
      {isOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--line)', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', borderRadius: '4px' }}>
          {options.map(opt => (
            <div key={opt.value} style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: (selectedValues || []).includes(opt.value) ? 'var(--teal-soft)' : '#fff' }} onClick={() => toggle(opt.value)}>
              <input type="checkbox" checked={(selectedValues || []).includes(opt.value)} readOnly style={{ cursor: 'pointer' }} />
              <span style={{ fontSize: '12px', userSelect: 'none', color: 'var(--text)' }}>{opt.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const NewAsnWizard = ({ poId, poObj, onBack, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');

  // Use poObj for basic details, fallback to mock if undefined
  const [poDetails] = useState({
    poNumber: poObj?.poNumber || poObj?.po_number || poId || 'PO-2026-004471',
    poDate: '04 May 2026',
    validTo: '31 Aug 2026',
    plantDock: 'P12 · Dock 04'
  });

  const [lines, setLines] = useState([]);
  const [lineState, setLineState] = useState([]);

  useEffect(() => {
    const fetchPoItems = async () => {
      if (!poId) {
        // Fallback to dummy data
        const dummyLines = [
          { no: 10, part: "AA-BRK-1042", oem: "BRK1042-LH", desc: "Bracket, wing rib LH", uom: "EA", ordered: 1200, received: 400, onLive: 200, tolPct: 0, needsHeat: false },
          { no: 20, part: "AA-FST-8871", oem: "FST8871-TI", desc: "Fastener, titanium M6×32", uom: "EA", ordered: 5000, received: 5000, onLive: 0, tolPct: 5, needsHeat: false },
          { no: 30, part: "AA-SEA-3390", oem: "SEA3390-32", desc: "Seal, hydraulic 32 mm", uom: "EA", ordered: 800, received: 0, onLive: 300, tolPct: 5, needsHeat: true },
          { no: 40, part: "AA-PLT-2201", oem: "PLT2201-AL", desc: "Plate, aluminium 6061 · 2 mm", uom: "KG", ordered: 2500, received: 900, onLive: 0, tolPct: 2, needsHeat: true }
        ];
        setLines(dummyLines);
        setLineState(dummyLines.map(l => ({ qty: "", batch: l.needsHeat ? "" : "—" })));
        return;
      }
      try {
        setLoading(true);
        const token = localStorage.getItem('auth_token');
        const response = await axios.get(`/api/vendor/purchase-orders/${poId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const itemsData = response.data?.data?.items || response.data?.items || [];
        if (itemsData.length > 0) {
          const fetchedItems = itemsData.map((item, index) => ({
            no: item.lineNumber || (index + 1) * 10,
            part: item.materialNumber || `ITEM-${index}`,
            oem: item.oem || "N/A",
            desc: item.materialDescription || "General Supply",
            uom: item.uom || "EA",
            ordered: item.quantity || 0,
            received: item.receivedQuantity !== undefined ? item.receivedQuantity : 0,
            pending: item.pendingQuantity,
            onLive: item.inTransitQuantity !== undefined ? item.inTransitQuantity : 0,
            tolPct: 5,
            needsHeat: false,
            sloc: 'SL01'
          }));
          setLines(fetchedItems);
          setLineState(fetchedItems.map(l => ({ qty: "", batch: l.needsHeat ? "" : "—" })));
        }
      } catch (err) {
        console.error('Failed to fetch PO items', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPoItems();
  }, [poId]);

  const [showClosed, setShowClosed] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [asnHistory, setAsnHistory] = useState([]);
  const [asnHistoryLoading, setAsnHistoryLoading] = useState(false);

  useEffect(() => {
    if (!poId || !drawerOpen) return;
    const fetchHistory = async () => {
      try {
        setAsnHistoryLoading(true);
        const token = localStorage.getItem('auth_token');
        const response = await axios.get(`/api/vendor/asns/history/${poDetails.poNumber}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        setAsnHistory(response.data?.data?.asns || response.data?.asns || []);
      } catch (err) {
        console.error("Failed to fetch ASN history", err);
      } finally {
        setAsnHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [poId, drawerOpen]);
  const [formData, setFormData] = useState({
    invoiceNumber: '',
    invoiceDate: '',
    ewayBill: '',
    ewbValidTo: '',
    vehicleNumber: '',
    transporterCode: '',
    dispatchDate: '',
    expectedDelivery: '',
    packaging: 'Returnable bin — RB-40',
    noOfPackages: '',
    // Documents
    taxInvoiceAttached: null,
    ewayBillAttached: null,
    packingListAttached: null,
    testCertAttached: null,
    pdirAttached: null,
    deviationAttached: null,
    othersAttached: []
  });

  const [packageDetails, setPackageDetails] = useState([]);

  // Calculate functions
  const fmt = n => (n != null && n !== '') ? Number(n).toLocaleString("en-IN") : '—';
  const avail = l => l.pending !== undefined ? l.pending : (Math.max(0, l.ordered - l.received) - l.onLive);
  const tolQty = l => Math.floor(l.ordered * l.tolPct / 100);
  const isClosed = l => avail(l) <= 0 && l.received >= l.ordered;

  const handleLineChange = (index, field, value) => {
    const updated = [...lineState];
    updated[index] = { ...updated[index], [field]: value };
    setLineState(updated);
  };

  const handleFillRemaining = () => {
    const updated = [...lineState];
    lines.forEach((l, i) => {
      if (!isClosed(l)) {
        updated[i] = { ...updated[i], qty: String(Math.max(0, avail(l))) };
      }
    });
    setLineState(updated);
  };

  const handleInputChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
    if (field === 'noOfPackages') {
      const num = parseInt(val, 10);
      if (!isNaN(num) && num > 0) {
        setPackageDetails(prev => {
          const newPackages = [...prev];
          while (newPackages.length < num) {
            newPackages.push({ packageNumber: newPackages.length + 1, materialDetails: [], quantity: '' });
          }
          if (newPackages.length > num) {
            newPackages.length = num;
          }
          return newPackages;
        });
      } else {
         setPackageDetails([]);
      }
    }
  };

  const handlePackageChange = (index, field, value) => {
    const updated = [...packageDetails];
    updated[index] = { ...updated[index], [field]: value };
    setPackageDetails(updated);
  };

  const handleFileChange = (field, e) => {
    if (e.target.files && e.target.files.length > 0) {
      if (field === 'othersAttached') {
        setFormData(prev => ({ ...prev, [field]: Array.from(e.target.files) }));
      } else {
        setFormData(prev => ({ ...prev, [field]: e.target.files[0] }));
      }
    }
  };

  const renderMultiDocRow = (label, desc, field, required = false) => {
    const files = formData[field] || [];
    return (
      <div className="doc" key={field}>
        <div>
          <div className="nm">{label} {required && <span style={{ color: 'var(--red)' }}>*</span>}</div>
          <div className="meta">
            {files.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{f.name} · {(f.size / 1024).toFixed(1)} KB</span>
                    <button type="button" className="btn-asn" onClick={() => { setPreviewTitle(f.name); setPreviewFile(URL.createObjectURL(f)); }} style={{ padding: '2px 8px', fontSize: '11px' }}>Preview</button>
                  </div>
                ))}
              </div>
            ) : desc}
          </div>
        </div>
        <div className="st">
          <input type="file" id={`file-${field}`} multiple style={{ display: 'none' }} onChange={(e) => handleFileChange(field, e)} />
          {files.length > 0 ? (
            <>
              <span className="pill done">Attached</span>
              <span className="tick on">✓</span>
              <label htmlFor={`file-${field}`} className="btn-asn" style={{ padding: '4px 10px', marginLeft: '8px', cursor: 'pointer', marginBottom: 0 }}>Change</label>
            </>
          ) : (
            <>
              <label htmlFor={`file-${field}`} className="btn-asn" style={{ padding: '4px 10px', cursor: 'pointer', marginBottom: 0 }}>Attach</label>
              <span className={`tick ${required ? 'off' : 'opt'}`}>{required ? '!' : '–'}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderDocRow = (label, desc, field, required = false) => {
    const file = formData[field];
    return (
      <div className="doc" key={field}>
        <div>
          <div className="nm">{label} {required && <span style={{ color: 'var(--red)' }}>*</span>}</div>
          <div className="meta">
            {file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KB` : desc}
          </div>
        </div>
        <div className="st">
          <input type="file" id={`file-${field}`} style={{ display: 'none' }} onChange={(e) => handleFileChange(field, e)} />
          {file ? (
            <>
              <button type="button" className="btn-asn" onClick={() => { setPreviewTitle(file.name); setPreviewFile(URL.createObjectURL(file)); }} style={{ padding: '4px 10px', marginRight: '8px', marginBottom: 0 }}>Preview</button>
              <span className="pill done">Attached</span>
              <span className="tick on">✓</span>
              <label htmlFor={`file-${field}`} className="btn-asn" style={{ padding: '4px 10px', marginLeft: '8px', cursor: 'pointer', marginBottom: 0 }}>Change</label>
            </>
          ) : (
            <>
              <label htmlFor={`file-${field}`} className="btn-asn" style={{ padding: '4px 10px', cursor: 'pointer', marginBottom: 0 }}>Attach</label>
              <span className={`tick ${required ? 'off' : 'opt'}`}>{required ? '!' : '–'}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const asnData = {
        po_id: poDetails.poNumber,
        vendor_bpno: 'BP-MARK-01',
        shipment_details: {
          invoice_number: formData.invoiceNumber,
          invoice_date: formData.invoiceDate,
          eway_bill: formData.ewayBill,
          ewb_valid_to: formData.ewbValidTo,
          vehicle_number: formData.vehicleNumber,
          transporter_code: formData.transporterCode,
          dispatch_date: formData.dispatchDate,
          expected_delivery: formData.expectedDelivery,
          packaging: formData.packaging,
          no_of_packages: formData.noOfPackages ? parseInt(formData.noOfPackages, 10) : null
        },
        packages: packageDetails.map(p => ({
          package_number: p.packageNumber,
          material_details: Array.isArray(p.materialDetails) ? p.materialDetails.join(', ') : p.materialDetails,
          quantity: parseFloat(p.quantity)
        })),
        items: []
      };

      lines.forEach((l, i) => {
        const q = parseFloat(lineState[i].qty) || 0;
        if (q > 0) {
          asnData.items.push({
            line_number: l.no,
            part_number: l.part,
            quantity_shipped: q,
            batch_heat_number: l.needsHeat ? lineState[i].batch : null
          });
        }
      });

      const submitData = new FormData();
      submitData.append('asnData', JSON.stringify(asnData));
      
      if (formData.taxInvoiceAttached) submitData.append('taxInvoiceAttached', formData.taxInvoiceAttached);
      if (formData.ewayBillAttached) submitData.append('ewayBillAttached', formData.ewayBillAttached);
      if (formData.packingListAttached) submitData.append('packingListAttached', formData.packingListAttached);
      if (formData.pdirAttached) submitData.append('pdirAttached', formData.pdirAttached);
      if (formData.deviationAttached) submitData.append('deviationAttached', formData.deviationAttached);
      
      formData.othersAttached.forEach((file) => {
        submitData.append('othersAttached', file);
      });

      if (formData.testCertAttached) {
        const firstHeatLine = asnData.items.find(item => item.batch_heat_number);
        if (firstHeatLine) {
          submitData.append(`testCertAttached_${firstHeatLine.line_number}`, formData.testCertAttached);
        }
      }

      const token = localStorage.getItem('auth_token');
      // The Spring Boot backend expects X-User-Id to be an integer
      const storedUserId = localStorage.getItem('user_id');
      const userId = storedUserId && !isNaN(storedUserId) ? parseInt(storedUserId, 10) : 1; 
      
      const res = await axios.post('/api/vendor/asns', submitData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-User-Id': userId,
          'Content-Type': 'multipart/form-data'
        }
      });

      onSuccess(res.data?.statusMsg || 'ASN created successfully');
    } catch (err) {
      console.error(err);
      setError('Failed to submit ASN. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Totals
  let tLines = 0, tQty = 0, blocked = [];
  lines.forEach((l, i) => {
    const q = parseFloat(lineState[i].qty) || 0;
    if (q <= 0 || isClosed(l)) return;
    tLines++;
    tQty += q;
    const a = avail(l), tol = tolQty(l);
    if (q > a + tol) blocked.push(`line ${l.no} exceeds balance`);
    if (l.needsHeat && !lineState[i].batch.trim()) blocked.push(`line ${l.no} has no heat number`);
  });

  const tHu = tLines ? Math.max(1, Math.ceil(tQty / 500)) : 0;
  const openLines = lines.filter(l => !isClosed(l)).length;

  const canSubmit = tLines > 0 && blocked.length === 0;

  return (
    <div className="asn-wizard-wrapper">
      <div className="wrap">
        <div className="page-head">
          <div>
            <h1>Create advance shipment notice</h1>
            <div className="sub">Dispatching against <strong>{poDetails.poNumber}</strong> · Shipment 4 of an open order</div>
          </div>
          <div className="head-actions">
            <button className="btn-asn" onClick={handleFillRemaining}>Fill remaining balance</button>
            <button className="btn-asn" onClick={() => setDrawerOpen(true)}>ASN history {asnHistory.length > 0 && <span className="count">{asnHistory.length}</span>}</button>
            {onBack && <button className="btn-asn" onClick={onBack}>Cancel</button>}
          </div>
        </div>

        {error && (
          <div className="note" style={{ background: 'var(--red-soft)', borderColor: 'var(--red)', color: 'var(--red)' }}>
            <div><b>Error:</b> {error}</div>
          </div>
        )}

        <div className="po-strip">
          <div className="po-cell"><div className="k">PO number</div><div className="v num">{poDetails.poNumber}</div></div>
          <div className="po-cell"><div className="k">PO date</div><div className="v">{poDetails.poDate}</div></div>
          <div className="po-cell"><div className="k">Valid to</div><div className="v">{poDetails.validTo}</div></div>
          <div className="po-cell"><div className="k">Plant / dock</div><div className="v">{poDetails.plantDock}</div></div>
          <div className="po-cell"><div className="k">Lines</div><div className="v">{openLines} open · {lines.length - openLines} closed</div></div>
          <div className="po-cell"><div className="k">PO status</div><div className="v"><span className="pill part"><span className="dot"></span>Partially shipped</span></div></div>
        </div>

        <div className="note" style={{ marginTop: '14px' }}>
          <div>
            <b>This PO stays open.</b> One line is fully received and closed, and ASN-2026-00463 is still in transit.
            The order closes only when every line is closed and no ASN is in a live status.
          </div>
        </div>

        <div className="asn-card">
          <div className="asn-card-hd">
            <h2>Order lines</h2>
            <span className="pill grey">{openLines} lines available to ship</span>
            <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted)', cursor: 'pointer' }}>
              <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} /> Show closed lines
            </label>
          </div>
          <div className="tbl-scroll">
            <table className="lines">
              <thead>
                <tr>
                  <th style={{ width: '230px' }}>Line / part</th>
                  <th style={{ minWidth: '210px' }}>Balance</th>
                  <th className="r">Available</th>
                  <th className="r" style={{ width: '140px' }}>Ship now</th>
                  <th style={{ width: '130px' }}>Batch / heat</th>
                  <th style={{ width: '110px' }}>Line status</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const closed = isClosed(l);
                  if (closed && !showClosed) return null;

                  const a = avail(l), tol = tolQty(l);
                  const q = parseFloat(lineState[i].qty) || 0;
                  const over = q > a;
                  const inTol = over && q <= a + tol && tol > 0;
                  const hardOver = over && !inTol;

                  const span = l.ordered + tol;
                  const w = n => Math.max(0, (n / span) * 100) + "%";
                  const shownThis = Math.min(q, Math.max(a, 0));
                  const shownTol = Math.max(0, Math.min(q - Math.max(a, 0), tol));

                  let statusPill = closed
                    ? <span className="pill done"><span className="dot"></span>Closed</span>
                    : (l.received > 0 || l.onLive > 0
                      ? <span className="pill part"><span className="dot"></span>Part shipped</span>
                      : <span className="pill open"><span className="dot"></span>Open</span>);

                  let msg = "", cls = "";
                  if (closed) { msg = "Fully received — no balance"; cls = "ok"; }
                  else if (hardOver) { msg = `Over by ${fmt(q - a - tol)} ${l.uom}. Maximum ${fmt(a + tol)} including ${l.tolPct}% tolerance.`; cls = "err"; }
                  else if (inTol) { msg = `${fmt(q - a)} ${l.uom} above balance — inside the ${l.tolPct}% tolerance. Buyer approval on receipt.`; cls = "warn"; }
                  else if (q > 0) { msg = `${fmt(a - q)} ${l.uom} will remain open after this shipment`; cls = "ok"; }
                  else { msg = tol > 0 ? `Tolerance +${fmt(tol)} ${l.uom}` : "—"; cls = "ok"; }

                  const batchErr = !closed && q > 0 && l.needsHeat && !lineState[i].batch.trim();

                  return (
                    <tr key={l.no} className={closed ? "closed" : ""}>
                      <td>
                        <div className="oem-tag">Line {l.no} · OEM {l.oem}</div>
                        <div className="part-no">{l.part}</div>
                        <div className="part-desc">{l.desc}</div>
                      </td>
                      <td>
                        <div className="meter">
                          <div className="meter-bar">
                            <div className="seg recd" style={{ width: w(l.received) }}></div>
                            <div className="seg open" style={{ width: w(l.onLive) }}></div>
                            <div className="seg this" style={{ width: w(shownThis) }}></div>
                            <div className="seg tol" style={{ width: w(shownTol) }}></div>
                          </div>
                          <div className="meter-key">
                            <span><i style={{ background: 'var(--green)' }}></i>Received <span className="kv">{fmt(l.received)}</span></span>
                            <span><i style={{ background: '#6FA3AC' }}></i>On live ASN <span className="kv">{fmt(l.onLive)}</span></span>
                            <span><i style={{ background: 'var(--teal)' }}></i>This ASN <span className="kv">{fmt(shownThis + shownTol)}</span></span>
                            <span>Ordered <span className="kv">{fmt(l.ordered)} {l.uom}</span></span>
                          </div>
                        </div>
                      </td>
                      <td className="r"><div className="avail">{fmt(Math.max(a, 0))}<small>{l.uom}</small></div></td>
                      <td className="r qty-cell">
                        <input className={`qty-in ${hardOver ? "err" : inTol ? "warn" : ""}`} type="text" inputMode="numeric"
                          value={lineState[i].qty} disabled={closed} onChange={e => handleLineChange(i, 'qty', e.target.value)} aria-label={`Quantity for line ${l.no}`} />
                        <div className={`qty-msg ${cls}`}>{msg}</div>
                      </td>
                      <td>
                        <input className={`batch-in ${batchErr ? "err" : ""}`} value={lineState[i].batch} disabled={closed || !l.needsHeat}
                          placeholder="Heat no." onChange={e => handleLineChange(i, 'batch', e.target.value)} aria-label={`Batch for line ${l.no}`} />
                        {batchErr && <div className="qty-msg err">Required</div>}
                      </td>
                      <td>{statusPill}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="asn-card">
          <div className="asn-card-hd"><h2>Shipment</h2></div>
          <div className="asn-card-bd">
            <div className="grid">
              <div className="f"><label>Invoice number <span className="req">*</span></label><input className="mono" value={formData.invoiceNumber} onChange={e => handleInputChange('invoiceNumber', e.target.value)} /></div>
              <div className="f"><label>Invoice date <span className="req">*</span></label><input type="date" value={formData.invoiceDate} onChange={e => handleInputChange('invoiceDate', e.target.value)} /></div>
              <div className="f"><label>E-way bill <span className="req">*</span></label><input className="mono" value={formData.ewayBill} onChange={e => handleInputChange('ewayBill', e.target.value)} /></div>
              <div className="f"><label>EWB valid to</label><input type="date" value={formData.ewbValidTo} onChange={e => handleInputChange('ewbValidTo', e.target.value)} /></div>
              <div className="f"><label>Vehicle number <span className="req">*</span></label><input className="mono" value={formData.vehicleNumber} onChange={e => handleInputChange('vehicleNumber', e.target.value)} /></div>
              <div className="f"><label>Transporter code </label><input className="mono" value={formData.transporterCode} onChange={e => handleInputChange('transporterCode', e.target.value)} /></div>
              <div className="f"><label>Dispatch date <span className="req">*</span></label><input type="date" value={formData.dispatchDate} onChange={e => handleInputChange('dispatchDate', e.target.value)} /></div>
              <div className="f"><label>Expected delivery <span className="req">*</span></label><input type="date" value={formData.expectedDelivery} onChange={e => handleInputChange('expectedDelivery', e.target.value)} /></div>
              <div className="f"><label>Packaging</label>
                <select value={formData.packaging} onChange={e => handleInputChange('packaging', e.target.value)}>
                  <option>Returnable bin — RB-40</option>
                  <option>Wooden crate</option>
                  <option>Carton</option>
                </select>
              </div>
              <div className="f"><label>No. of packages <span className="req">*</span></label><input type="number" min="1" className="mono" value={formData.noOfPackages} onChange={e => handleInputChange('noOfPackages', e.target.value)} /></div>
            </div>
          </div>
        </div>

        {packageDetails.length > 0 && (
          <div className="asn-card">
            <div className="asn-card-hd"><h2>Package Details</h2></div>
            <div className="asn-card-bd" style={{ padding: '0', overflow: 'visible' }}>
              <div className="tbl-scroll" style={{ overflow: 'visible' }}>
                <table className="lines" style={{ minWidth: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Package #</th>
                      <th>Material Details</th>
                      <th style={{ width: '200px' }}>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {packageDetails.map((pkg, i) => (
                      <tr key={i}>
                        <td style={{ verticalAlign: 'middle' }}><b>{pkg.packageNumber}</b></td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <MultiSelectDropdown 
                            options={lines.map(l => ({ value: `${l.part}`, label: `${l.part} - ${l.desc}` }))}
                            selectedValues={pkg.materialDetails || []}
                            onChange={(vals) => handlePackageChange(i, 'materialDetails', vals)}
                          />
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <input type="number" min="0" className="batch-in mono" style={{ width: '100%' }} value={pkg.quantity} placeholder="0" onChange={e => handlePackageChange(i, 'quantity', e.target.value)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="asn-card">
          <div className="asn-card-hd"><h2>Documents</h2><span className="pill grey">Required documents</span></div>
          <div className="asn-card-bd" style={{ paddingTop: '4px' }}>
            {renderDocRow('Tax invoice', 'PDF format required', 'taxInvoiceAttached', true)}
            {renderDocRow('E-way bill', 'Required for road transports', 'ewayBillAttached', true)}
            {renderDocRow('Packing list', 'Detailed packaging breakout', 'packingListAttached', true)}
            {renderDocRow('Pre-dispatch inspection report', 'PDIR document', 'pdirAttached', true)}
            {renderDocRow('Deviation approval', 'Optional — attach only if shipping against a concession', 'deviationAttached', false)}
            {renderMultiDocRow('Others', 'Any other supporting documents', 'othersAttached', false)}
          </div>
        </div>
      </div>

      {/* History Drawer */}
      <div className={`scrim ${drawerOpen ? 'on' : ''}`} onClick={() => setDrawerOpen(false)}></div>
      <aside className={`drawer ${drawerOpen ? 'on' : ''}`} role="dialog" aria-modal="true" aria-label="ASN history for this purchase order">
        <div className="drawer-hd">
          <div>
            <h3>ASN history — {poDetails.poNumber}</h3>
            <div className="sub">{asnHistory.length} notices raised since {poDetails.poDate}</div>
          </div>
          <button className="x" onClick={() => setDrawerOpen(false)} aria-label="Close">×</button>
        </div>
        <div className="drawer-bd">
          <div className="rollup">
            <h4>How the balance was reached</h4>
            <table>
              <thead><tr><th>Line</th><th>Ordered</th><th>Received</th><th>On live ASN</th><th>Available</th></tr></thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.no}>
                    <td>{l.no} · {l.part}</td>
                    <td>{fmt(l.ordered)}</td>
                    <td>{fmt(l.received)}</td>
                    <td>{fmt(l.onLive)}</td>
                    <td style={{ color: avail(l) > 0 ? 'var(--teal-dk)' : 'var(--muted)' }}>{fmt(Math.max(avail(l), 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {asnHistoryLoading ? (
            <div className="p-4 text-center text-muted">
              <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div> Loading history...
            </div>
          ) : asnHistory.length === 0 ? (
            <div className="p-4 text-center text-muted">No ASN history found.</div>
          ) : asnHistory.map((asn) => (
            <div className="hist" key={asn.asnId || asn.asnNumber}>
              <div className="hist-hd">
                <span className="id">{asn.asnNumber}</span><span className="dt">{asn.dispatchDate}</span>
                <span className={`pill ${asn.status === 'RECEIVED' ? 'done' : asn.status === 'CANCELLED' ? 'dead' : 'open'}`}>
                  <span className="dot"></span>{asn.status === 'RECEIVED' ? 'Received' : asn.status === 'CANCELLED' ? 'Cancelled' : 'In transit'}
                </span>
                <span className={`eff ${asn.effect === 'CONSUMED' ? 'consumed' : asn.effect === 'RELEASED_BACK' ? 'released' : 'holds'}`}>
                  {asn.effect === 'CONSUMED' ? 'Consumed' : asn.effect === 'RELEASED_BACK' ? 'Released back' : 'Holding quantity'}
                </span>
              </div>
              <div className="hist-bd">
                <table className="hist-lines">
                  <thead><tr><th>Line</th><th>Part</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>GRN qty</th></tr></thead>
                  <tbody>
                    {asn.lines?.map(l => (
                      <tr key={l.lineNumber}>
                        <td>{l.lineNumber}</td><td>{l.partNumber}</td><td className="q">{fmt(l.quantity)}</td>
                        <td className="q">{l.grnQuantity ? fmt(l.grnQuantity) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="hist-meta">
                  {asn.grnNumber && <span>GRN <b>{asn.grnNumber}</b></span>}
                  {asn.invoiceNumber && <span>Invoice <b>{asn.invoiceNumber}</b>{asn.status === 'CANCELLED' ? ' cancelled' : ''}</span>}
                  {asn.ewayBill && <span>EWB <b>{asn.ewayBill}</b>{asn.status === 'CANCELLED' ? ' cancelled' : ''}</span>}
                  {asn.vehicleNumber && <span>Vehicle <b>{asn.vehicleNumber}</b></span>}
                  {asn.eta && <span>ETA <b>{asn.eta}</b></span>}
                </div>
                {asn.documents && asn.documents.length > 0 && (
                  <div className="docrow">
                    {asn.documents.map((doc, idx) => (
                      <span className="chip" key={idx}>{doc.name} <span className="ext">PDF</span></span>
                    ))}
                  </div>
                )}
                {asn.remarks && <div className="reason">{asn.remarks}</div>}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Sticky Footer */}
      <div className="foot">
        <div className="foot-in">
          <div className="tot">
            <div><div className="k">Lines on this ASN</div><div className="v">{tLines}</div></div>
            <div><div className="k">Total quantity</div><div className="v">{fmt(tQty)}</div></div>
            <div><div className="k">Handling units</div><div className="v">{tHu}</div></div>
          </div>
          <div className="blockers">
            {tLines === 0 ? (
              <span style={{ color: 'var(--muted)' }}>Enter a quantity on at least one line.</span>
            ) : blocked.length > 0 ? (
              <><b>Cannot submit —</b> {[...new Set(blocked)].join(", ")}.</>
            ) : (
              <span style={{ color: 'var(--green)' }}><b>Ready.</b> PO stays open after this shipment.</span>
            )}
          </div>
          <div className="foot-actions">
            <button className="btn-asn">Save draft</button>
            <button className="btn-asn btn-asn-primary" disabled={!canSubmit || loading} onClick={handleSubmit}>
              {loading ? 'Submitting...' : 'Submit ASN'}
            </button>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {previewFile && (
        <div className="custom-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="custom-modal-content" style={{ maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="custom-modal-header bg-light">
              <h5 className="custom-modal-title text-dark fw-bold">
                Preview: {previewTitle}
              </h5>
              <button className="custom-modal-close-btn" onClick={() => { URL.revokeObjectURL(previewFile); setPreviewFile(null); }}>&times;</button>
            </div>
            <div className="custom-modal-body p-0" style={{ flex: 1 }}>
              <iframe src={previewFile} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NewAsnWizard;
