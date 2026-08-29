import React, { useState, useEffect } from 'react';
import axios from 'axios';

const formatCurrency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const getStatusBadge = (s) => {
  const status = (s || '').toUpperCase();
  if (status === 'DELIVERED' || status === 'COMPLETED' || status === 'CLOSED' || status === 'GR DONE') return 'bg-success bg-opacity-10 text-success';
  if (status === 'ISSUED' || status === 'RELEASED' || status === 'OPEN') return 'bg-primary bg-opacity-10 text-primary';
  if (status === 'CREATED') return 'bg-info bg-opacity-10 text-info';
  return 'bg-secondary bg-opacity-10 text-secondary';
};

const PurchaseOrder = ({ onBack }) => {
  const [vendorCodeInput, setVendorCodeInput] = useState('');
  const [appliedVendorCode, setAppliedVendorCode] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expandedIdx, setExpandedIdx] = useState(null);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showKpis, setShowKpis] = useState(false);
  const [isVendorUser, setIsVendorUser] = useState(false);

  useEffect(() => {
    // When the component mounts, check if the current user is a vendor and preset their code
    try {
      const userStr = localStorage.getItem('user_data');
      if (userStr) {
        const user = JSON.parse(userStr);
        const isV = user.role === 'VENDOR' || user.email === 'markjhon@gmail.com';
        setIsVendorUser(isV);
        // If it's our mock user Mark Jhon Supplies, default it to BP-MARK-01
        if (isV) {
          setVendorCodeInput('BP-MARK-01');
          setAppliedVendorCode('BP-MARK-01');
        }
      }
    } catch (e) { }
  }, []);

  useEffect(() => {
    fetchData();
  }, [appliedVendorCode, isVendorUser]);


  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      
      const endpoint = isVendorUser ? '/api/vendor/purchase-orders' : '/api/purchase-orders';

      const response = await axios.get(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      let rawOrders = [];
      if (Array.isArray(response.data)) {
        rawOrders = response.data;
      } else if (response.data && response.data.orders) {
        rawOrders = response.data.orders;
      }

      if (!isVendorUser && appliedVendorCode) {
        const searchUpper = appliedVendorCode.toUpperCase();
        rawOrders = rawOrders.filter(o => 
          (o.vendorCode && o.vendorCode.toUpperCase().includes(searchUpper)) || 
          (o.sapVendorCode && o.sapVendorCode.toUpperCase().includes(searchUpper)) ||
          (o.vendorName && o.vendorName.toUpperCase().includes(searchUpper))
        );
      }
      
      const totalPOs = rawOrders.length;
      const poIssued = rawOrders.filter(p => ['CREATED', 'ISSUED', 'OPEN', 'RELEASED'].includes((p.status || p.poStatus || '').toUpperCase())).length;
      const poDelivered = rawOrders.filter(p => ['DELIVERED', 'COMPLETED', 'CLOSED', 'GR DONE', 'FULLY_SHIPPED'].includes((p.status || p.poStatus || '').toUpperCase())).length;
      
      const finalData = {
        vendorInfo: {},
        summary: {
          totalPOs,
          poIssued,
          poDelivered,
          poInProcess: totalPOs - poDelivered
        },
        orders: rawOrders.map(o => {
          let s = o.poStatus || o.status;
          if (s === 'CREATED') s = 'RELEASED';
          return {
            ...o,
            poStatus: s
          };
        })
      };
      
      setData(finalData);
      setExpandedIdx(null); // Reset expansion on new fetch
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch Purchase Orders.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyVendorCode = () => {
    if (vendorCodeInput.trim() !== '') {
      setAppliedVendorCode(vendorCodeInput.trim());
    }
  };

  const handleExpand = async (idx, poId) => {
    if (expandedIdx === idx) {
      setExpandedIdx(null);
      return;
    }
    setExpandedIdx(idx);

    const token = localStorage.getItem('auth_token');
    const poNumber = data.orders[idx].poNumber;

    const needsItems = !data.orders[idx].items;
    const needsHistory = !data.orders[idx].asnHistory;

    if (needsItems || needsHistory) {
      try {
        const [itemsRes, historyRes] = await Promise.all([
          needsItems ? axios.get(`/api/vendor/purchase-orders/${poId}`, { headers: { 'Authorization': `Bearer ${token}` } }) : Promise.resolve({ data: { items: data.orders[idx].items } }),
          needsHistory ? axios.get(`/api/vendor/purchase-orders/${poNumber}/asns`, { headers: { 'Authorization': `Bearer ${token}` } }) : Promise.resolve({ data: data.orders[idx].asnHistory })
        ]);

        const updatedOrders = [...data.orders];
        updatedOrders[idx] = { 
          ...updatedOrders[idx], 
          items: itemsRes.data.items || itemsRes.data,
          asnHistory: historyRes.data 
        };
        setData({ ...data, orders: updatedOrders });
      } catch (err) {
        console.error('Failed to fetch PO details/history:', err);
      }
    }
  };

  const handleAction = async (poId, action) => {
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(`/api/vendor/purchase-orders/${poId}/${action}`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Update local state
      const updatedOrders = data.orders.map(o => {
        if (o.poId === poId) {
          return { ...o, poStatus: action === 'acknowledge' ? 'ACKNOWLEDGED' : 'REJECTED' };
        }
        return o;
      });
      setData({ ...data, orders: updatedOrders });
    } catch (err) {
      console.error(`Failed to ${action} PO:`, err);
      alert(`Failed to ${action} Purchase Order`);
    }
  };

  const vendor = data?.vendorInfo || {};
  const summary = data?.summary || {};
  const rows = data?.orders || [];

  const filtered = rows.filter(r => {
    const matchSearch = search === '' || (r.poNumber || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'All' || r.poStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const exportCSV = () => {
    const headers = ['PO Number', 'PO Date', 'Grand Total', 'PO Status', 'Material Number', 'Quantity', 'Unit Price', 'Total Value', 'Delivery Date'];
    const csvRows = [];
    filtered.forEach(po => {
      if (po.items && po.items.length > 0) {
        po.items.forEach(item => {
          csvRows.push([
            po.poNumber, po.poDate, po.grandTotal, po.poStatus,
            item.materialNumber, item.quantity, item.unitPrice, item.totalValue, item.confirmedDeliveryDate
          ].join(','));
        });
      } else {
        csvRows.push([po.poNumber, po.poDate, po.grandTotal, po.poStatus, '', '', '', '', ''].join(','));
      }
    });
    const blob = new Blob([[headers.join(','), ...csvRows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `purchase_orders_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="fade-in-slide container-fluid py-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      {/* Header & Controls */}
      <div className="d-flex flex-wrap justify-content-between align-items-end mb-4">
        <div>
          <h3 className="fw-bold text-dark mb-1">Purchase Orders</h3>
          {/* <p className="text-muted mb-0 small">PO tracking, item details, and delivery status</p> */}
        </div>
        <div className="d-flex flex-wrap gap-3 align-items-end mt-3 mt-md-0">
          {/* <div>
            <label className="form-label text-muted fw-semibold mb-1" style={{ fontSize: '12px' }}>Vendor Code</label>
            <input
              type="text"
              value={vendorCodeInput}
              onChange={e => setVendorCodeInput(e.target.value)}
              onBlur={handleApplyVendorCode}
              onKeyDown={e => e.key === 'Enter' && handleApplyVendorCode()}
              className="form-control form-control-sm border-light-subtle bg-white shadow-sm"
              style={{ borderRadius: '6px' }}
            />
          </div> */}

          {/* <button onClick={exportCSV} className="btn btn-sm btn-dark shadow-sm px-4 fw-bold" style={{ backgroundColor: '#293383', borderRadius: '6px', height: '31px' }}>
            Export CSV
          </button> */}

          {onBack && (
            <div
              onClick={onBack}
              className="d-inline-flex align-items-center justify-content-center text-muted cursor-pointer px-2"
              style={{ cursor: 'pointer', transition: 'color 0.2s ease', height: '31px' }}
            >
              <i className="fas fa-arrow-left me-2"></i>
              <span className="fw-medium">Back</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger shadow-sm border-0 mb-4 py-2 px-3 d-flex align-items-center" style={{ borderRadius: '8px' }}>
          <i className="fas fa-exclamation-circle me-2"></i>
          <span className="small fw-medium">{error}</span>
        </div>
      )}

      {/* Vendor Info Block */}

      {/*
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
        <div className="card-body p-4">
          <div className="row">
            <div className="col-md-4">
              <p className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>SAP Vendor Code</p>
              <p className="fw-bold text-dark mb-0 fs-5">{vendor.sapVendorCode || '-'}</p>
            </div>
            <div className="col-md-4 mt-3 mt-md-0">
              <p className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>SAP Vendor Name</p>
              <p className="fw-bold text-dark mb-0 fs-5">{vendor.sapVendorName || '-'}</p>
            </div>
            <div className="col-md-4 mt-3 mt-md-0">
              <p className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>Company Code</p>
              <p className="fw-bold text-dark mb-0 fs-5">{vendor.companyCode || '-'}</p>
            </div>
          </div>
        </div>
      </div>
      */}

      {/* Filter and Search */}
      <div className="d-flex flex-column flex-md-row gap-3 mb-4">
        <div className="flex-grow-1 position-relative text-start" style={{ minWidth: '250px' }}>
          {/* <span className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted">
            <i className="fas fa-search"></i>
          </span> */}
          <input
            type="text"
            placeholder="Filter by PO Number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="form-control border-light-subtle bg-white shadow-sm ps-3 text-start"
            style={{ borderRadius: '8px', padding: '10px 16px' }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="form-select border-light-subtle shadow-sm"
          style={{ width: '200px', borderRadius: '8px', padding: '10px 16px' }}
        >
          <option value="All">All Statuses</option>
          <option value="RELEASED">Released</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
        </select>
        <button
          className="btn btn-light text-secondary border shadow-sm d-flex align-items-center justify-content-center"
          style={{ borderRadius: '8px', padding: '10px 16px', minWidth: '48px', backgroundColor: showKpis ? '#f8f9fa' : '#ffffff' }}
          onClick={() => setShowKpis(!showKpis)}
          title={showKpis ? 'Hide Stats' : 'Show Stats'}
        >
          <i className={`fas fa-chart-bar fs-15 ${showKpis ? 'text-primary' : ''}`}></i>
        </button>
      </div>

      {/* KPIs */}
      <div className="row g-3 mb-4" style={{ display: showKpis ? 'flex' : 'none' }}>
        <div className="col-md-3 col-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-4 text-center">
              <h2 className="fw-bold text-dark mb-1">{summary.totalPOs || 0}</h2>
              <p className="text-muted small fw-medium mb-0">Total POs</p>
            </div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-4 text-center">
              <h2 className="fw-bold text-primary mb-1">{summary.poIssued || 0}</h2>
              <p className="text-muted small fw-medium mb-0">PO Issued</p>
            </div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-4 text-center">
              <h2 className="fw-bold text-success mb-1">{summary.poDelivered || 0}</h2>
              <p className="text-muted small fw-medium mb-0">PO Delivered</p>
            </div>
          </div>
        </div>
        <div className="col-md-3 col-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-4 text-center">
              <h2 className="fw-bold text-warning mb-1">{summary.poInProcess || 0}</h2>
              <p className="text-muted small fw-medium mb-0">PO In Process</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-start">
              <thead className="bg-light text-muted text-uppercase fw-bold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th className="py-3">PO Number</th>
                  <th>PO Date</th>
                  <th className="text-end">Grand Total</th>
                  <th className="text-center pe-4">PO Status</th>
                  {isVendorUser && <th className="text-center">Action</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5">
                      <div className="spinner-border text-success" role="status"></div>
                      <p className="mt-2 text-muted">Loading Purchase Orders...</p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-5 text-muted">
                      {error ? "Could not load data." : "No purchase orders found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, idx) => (
                    <React.Fragment key={idx}>
                      <tr className="align-middle">
                        <td className="ps-3 text-center">
                          <button
                            className="btn btn-sm btn-link text-secondary p-0"
                            onClick={() => handleExpand(idx, r.poId)}
                          >
                            <i className={`fas fa-chevron-${expandedIdx === idx ? 'up' : 'down'}`}></i>
                          </button>
                        </td>
                        <td className="fw-bold text-primary font-monospace" style={{ fontSize: '13px' }}>{r.poNumber}</td>
                        <td>{formatDate(r.poDate)}</td>
                        <td className="text-end fw-semibold text-dark">{formatCurrency(r.grandTotal)}</td>
                        <td className="text-center pe-4">
                          <span className={`badge rounded-pill px-3 py-2 text-uppercase fw-bold ${getStatusBadge(r.poStatus)}`} style={{ fontSize: '10px' }}>
                            {r.poStatus}
                          </span>
                        </td>
                        {isVendorUser && (
                          <td className="text-center">
                            {r.poStatus === 'RELEASED' ? (
                              <div className="d-flex justify-content-center gap-2">
                                <button 
                                  className="btn btn-sm btn-outline-success rounded-pill fw-bold" 
                                  style={{ fontSize: '11px', padding: '4px 12px' }}
                                  onClick={() => handleAction(r.poId, 'acknowledge')}
                                >
                                  Acknowledge
                                </button>
                                <button 
                                  className="btn btn-sm btn-outline-danger rounded-pill fw-bold" 
                                  style={{ fontSize: '11px', padding: '4px 12px' }}
                                  onClick={() => handleAction(r.poId, 'reject')}
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted" style={{ fontSize: '12px' }}>—</span>
                            )}
                          </td>
                        )}
                      </tr>
                      {expandedIdx === idx && (
                        <tr>
                          <td colSpan="6" className="p-4 bg-light border-bottom">
                            <div className="card border-0 shadow-sm rounded-3">
                              <div className="card-body p-4">
                                <h6 className="text-uppercase fw-bold text-dark mb-3" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>
                                  <i className="fas fa-boxes me-2 text-primary"></i>Item Details
                                </h6>
                                <div className="table-responsive">
                                  <table className="table table-sm table-bordered mb-0" style={{ fontSize: '12px' }}>
                                    <thead className="table-light text-muted text-uppercase">
                                      <tr>
                                        <th className="ps-3 py-2">Material Number</th>
                                        <th className="py-2">Description</th>
                                        <th className="text-end py-2">Quantity</th>
                                        <th className="text-end py-2">Shipped</th>
                                        <th className="text-end py-2">Pending</th>
                                        <th className="text-end py-2">Unit Price</th>
                                        <th className="text-end py-2">Total Value</th>
                                        <th className="py-2 pe-3">Delivery Date</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {r.items && r.items.length > 0 ? (
                                        r.items.map((item, i) => (
                                          <tr key={i}>
                                            <td className="ps-3 fw-semibold text-primary font-monospace">{item.materialNumber}</td>
                                            <td className="text-truncate" style={{ maxWidth: '250px' }} title={item.materialDescription}>{item.materialDescription}</td>
                                            <td className="text-end fw-medium">{item.quantity} {item.uom}</td>
                                            <td className="text-end fw-medium text-success">{item.shippedQuantity || 0}</td>
                                            <td className="text-end fw-medium text-danger">{item.pendingQuantity !== undefined ? item.pendingQuantity : item.quantity}</td>
                                            <td className="text-end text-muted">{formatCurrency(item.unitPrice)}</td>
                                            <td className="text-end fw-semibold">{formatCurrency(item.totalValue)}</td>
                                            <td className="pe-3">{formatDate(item.confirmedDeliveryDate)}</td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr><td colSpan="6" className="text-center py-3 text-muted">No items available</td></tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                                {r.asnHistory && r.asnHistory.length > 0 && (
                                  <div className="mt-4">
                                    <h6 className="text-uppercase fw-bold text-dark mb-3" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>
                                      <i className="fas fa-history me-2 text-primary"></i>ASN History (Partial Shipments)
                                    </h6>
                                    <div className="table-responsive">
                                      <table className="table table-sm table-bordered mb-0" style={{ fontSize: '12px' }}>
                                        <thead className="table-light text-muted text-uppercase">
                                          <tr>
                                            <th className="ps-3 py-2">ASN Number</th>
                                            <th className="py-2">Despatch Date</th>
                                            <th className="py-2">Status</th>
                                            <th className="py-2">E-Way Bill</th>
                                            <th className="py-2 pe-3">Invoice No.</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {r.asnHistory.map((asn, i) => (
                                            <tr key={i}>
                                              <td className="ps-3 fw-semibold text-success font-monospace">{asn.display_number || asn.asn_number}</td>
                                              <td>{asn.despatch_date}</td>
                                              <td>
                                                <span className={`badge bg-soft-${asn.status_badge || 'info'} text-${asn.status_badge || 'info'}`}>{asn.status}</span>
                                                {asn.isPartial && <span className="ms-2 badge bg-warning text-dark">Partial</span>}
                                              </td>
                                              <td>{asn.eway_bill}</td>
                                              <td className="pe-3">{asn.invoice_number}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="text-muted text-end mt-3 mb-5" style={{ fontSize: '12px' }}>
        Showing {filtered.length} of {rows.length} records
      </p>
    </div>
  );
};

export default PurchaseOrder;
