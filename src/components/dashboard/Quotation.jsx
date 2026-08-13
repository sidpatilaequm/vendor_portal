import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';
import QuotationDetail from './QuotationDetail';
import NewQuotationWizard from './NewQuotationWizard';

const Quotation = ({ onBack, onNavigate }) => {
  const [quotations, setQuotations] = useState([]);
  const [showKpis, setShowKpis] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('submitted');
  const [search, setSearch] = useState('');

  const extractPrId = (prStr) => {
    if (!prStr) return null;
    if (typeof prStr === 'number') return prStr;
    const parts = prStr.split('-');
    return parseInt(parts[parts.length - 1], 10) || null;
  };

  // Sub-views and Modal States
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [selectedQtnId, setSelectedQtnId] = useState(null);
  const [selectedQtn, setSelectedQtn] = useState(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [selectedPrForQuote, setSelectedPrForQuote] = useState(null);
  const [showPrSelectModal, setShowPrSelectModal] = useState(false);
  const [availablePrs, setAvailablePrs] = useState([]);
  const [loadingPrs, setLoadingPrs] = useState(false);

  // Admin role states
  const [userRole, setUserRole] = useState('VENDOR');
  const [selectedPrId, setSelectedPrId] = useState('');
  const [purchaseRequisitions, setPurchaseRequisitions] = useState([]);

  const fetchPRsForAdmin = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const response = await axios.get('/api/purchase-requisitions', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      let content = [];
      const data = response.data;
      if (data) {
        if (data.content) content = data.content;
        else if (data.data && data.data.content) content = data.data.content;
        else if (data.data && Array.isArray(data.data)) content = data.data;
        else if (Array.isArray(data)) content = data;
      }
      setPurchaseRequisitions(content);
    } catch (err) {
      console.error('Failed to fetch PRs for Admin', err);
    }
  };

  const fetchQuotations = async () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');

    const userStr = localStorage.getItem('user_data');
    let role = 'VENDOR';
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        role = u.role?.toUpperCase() || 'VENDOR';
        setUserRole(role);
      } catch (e) { }
    }

    let apiEndpoint = '/api/vendor/quotations';
    if (role !== 'VENDOR' && role !== 'VENDOR_ADMIN') {
      apiEndpoint = `/api/vendor/all`;
    }

    try {
      const response = await axios.get(apiEndpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      let content = [];
      const data = response.data;
      if (data) {
        if (Array.isArray(data)) content = data;
        else if (data.data && Array.isArray(data.data)) content = data.data;
      }

      const formatted = content.map((item) => {
        const status = item.status || item.quoteStatus || (Array.isArray(item) ? item.find(v => typeof v === 'string' && ['DRAFT', 'SUBMITTED', 'AWARDED', 'WON', 'REJECTED'].includes(v?.toUpperCase())) : null) || 'DRAFT';
        let statusBadge = 'secondary';
        if (status.toUpperCase() === 'AWARDED' || status.toUpperCase() === 'WON') statusBadge = 'success';
        else if (status.toUpperCase() === 'SUBMITTED') statusBadge = 'info';
        else if (status.toUpperCase() === 'REJECTED') statusBadge = 'danger';
        else if (status.toUpperCase() === 'DRAFT') statusBadge = 'warning';

        // Extremely robust ID extraction
        let extractedId = null;
        let extractedNum = null;

        if (typeof item === 'string') {
          extractedId = item;
          extractedNum = item;
        } else if (Array.isArray(item)) {
          extractedId = item[0];
          extractedNum = item.find(v => typeof v === 'string' && v.startsWith('QTN')) || item[1];
        } else if (item && typeof item === 'object') {
          extractedId = item.quotation_id || item.quoteNo || item.quote_no || item.quotationNo || item.quotation_no || item.quotation_number || item.quotation_header?.quotation_number || item.quotationNumber || item.quotationId || item.id || item.quoteId || item.quote_id;
          extractedNum = item.quotation_number || item.quotation_no || item.quoteNo || item.quote_no || item.quotation_header?.quotation_number || item.quotationNumber;

          if (!extractedId) {
            extractedId = Object.values(item).find(v => typeof v === 'string' && v.startsWith('QTN')) || Object.values(item).find(v => typeof v === 'number');
          }
          if (!extractedNum) {
            extractedNum = Object.values(item).find(v => typeof v === 'string' && v.startsWith('QTN'));
          }
        }

        const finalId = extractedId || 'QTN-UNKNOWN';
        const finalNum = extractedNum || `QTN-2026-${String(extractedId || '').padStart(5, '0')}`;

        return {
          quotation_id: finalId,
          display_number: finalNum,
          remarks: item.remarks?.cover_note || item.remarks?.coverNote || item.description || item.coverNote || item.cover_note || (Array.isArray(item) ? item.find(v => typeof v === 'string' && v.length > 20) : null) || 'Quotation',
          pr_id: item.prNumber || item.pr_id || item.prId || item.pr_number || (Array.isArray(item) ? item.find(v => typeof v === 'string' && v.startsWith('PR-')) : null) || '',
          display_date: item.quoteDate || item.quotation_header?.quotation_date || item.quotation_date || item.quotationDate || item.createdAt?.split('T')[0] || 'N/A',
          display_valid_until: item.quotation_header?.valid_until || item.validUntil || item.valid_until || 'N/A',
          grand_total: item.grand_total || item.grandTotal || item.grand_total_amount || item.grandTotalAmount || (Array.isArray(item) ? item.find(v => typeof v === 'number' && v > 100) : null) || 0,
          currency: item.quotation_header?.currency || item.currency || 'INR',
          status: status,
          status_lower: status.toLowerCase(),
          status_badge: statusBadge,
          line_count: item.line_items?.length || item.items?.length || item.lines?.length || 1,
          vendorName: item.vendorName || '',
          line_items: item.line_items || item.items || item.lines || []
        };
      });

      if (formatted.length > 0 || (role !== 'VENDOR' && role !== 'VENDOR_ADMIN')) {
        setQuotations(formatted);
      } else {
        loadMockQuotations();
      }
    } catch (err) {
      console.error('Failed to fetch Quotations from backend, loading fallback mock data.', err);
      if (role === 'VENDOR' || role === 'VENDOR_ADMIN') {
        loadMockQuotations();
      } else {
        setQuotations([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMockQuotations = () => {
    setQuotations([
      {
        quotation_id: 'QTN-81308',
        display_number: 'QTN-81308',
        remarks: 'Please find our quotation.',
        pr_id: 'PR-3',
        display_date: '2026-06-10',
        display_valid_until: '2028-04-07',
        grand_total: 708.82,
        currency: 'INR',
        status: 'SUBMITTED',
        status_lower: 'submitted',
        status_badge: 'info',
        line_count: 1
      },
      {
        quotation_id: '2',
        display_number: 'QTN-2026-00042',
        remarks: 'Custom machined bolts & fasteners',
        pr_id: 'PR-2026-0009',
        display_date: '2026-06-10',
        display_valid_until: '2026-07-10',
        grand_total: 1850000,
        currency: 'INR',
        status: 'AWARDED',
        status_lower: 'awarded',
        status_badge: 'success',
        line_count: 2
      },
      {
        quotation_id: '3',
        display_number: 'QTN-2026-00038',
        remarks: 'Consulting and engineering services',
        pr_id: '',
        display_date: '2026-05-25',
        display_valid_until: '2026-06-25',
        grand_total: 95000,
        currency: 'INR',
        status: 'DRAFT',
        status_lower: 'draft',
        status_badge: 'warning',
        line_count: 1
      }
    ]);
  };

  const fetchAvailablePrs = async () => {
    setLoadingPrs(true);
    const token = localStorage.getItem('auth_token');
    try {
      const response = await axios.get('/api/vendor/purchase-requisitions/details', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      let content = [];
      const data = response.data;
      if (data) {
        if (data.content) content = data.content;
        else if (data.data && data.data.content) content = data.data.content;
        else if (data.data && Array.isArray(data.data)) content = data.data;
        else if (Array.isArray(data)) content = data;
      }
      // Filter by RELEASED/APPROVED/OPEN/PENDING/ACKNOWLEDGED
      const filtered = content.filter(item => {
        const s = (item.status || '').toUpperCase();
        return ['RELEASED', 'APPROVED', 'OPEN', 'PENDING', 'ACKNOWLEDGED'].includes(s);
      });
      setAvailablePrs(filtered);
    } catch (err) {
      console.error('Failed to fetch PRs for selection modal, loading fallback.', err);
      setAvailablePrs([
        { prNumber: 'PR-2026-0009', requestedBy: 'Inventory Manager', createdAt: '2026-05-07T00:00:00.000Z', items: [{}] }
      ]);
    } finally {
      setLoadingPrs(false);
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user_data');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        const role = u.role?.toUpperCase() || 'VENDOR';
        setUserRole(role);
        if (role !== 'VENDOR' && role !== 'VENDOR_ADMIN') {
          fetchPRsForAdmin();
        }
      } catch (e) { }
    }
  }, []);

  useEffect(() => {
    fetchQuotations();
  }, [selectedPrId]);

  const getFilteredQuotations = () => {
    return quotations.filter((item) => {
      const matchesFilter = filter === 'all' || item.status_lower === filter;
      const matchesSearch =
        item.display_number.toLowerCase().includes(search.toLowerCase()) ||
        item.remarks.toLowerCase().includes(search.toLowerCase()) ||
        (item.pr_id && item.pr_id.toLowerCase().includes(search.toLowerCase()));
      return matchesFilter && matchesSearch;
    });
  };

  const openPrSelection = () => {
    fetchAvailablePrs();
    setShowPrSelectModal(true);
  };

  const startQuoteFromPr = async (pr) => {
    const prNo = pr.prNumber || pr.pr_number;
    const vs = (pr.vendorStatus || pr.vendor_status || '').toUpperCase();
    if (vs !== 'ACCEPTED') {
      try {
        const token = localStorage.getItem('auth_token');
        await axios.post(`/api/vendor/purchase-requisitions/${pr.id}/accept`, {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (err) {
        console.error('Failed to auto-accept PR:', err);
      }
    }
    setSelectedPrForQuote(prNo);
    setShowPrSelectModal(false);
    setShowCreateWizard(true);
  };

  const startStandaloneQuote = () => {
    setSelectedPrForQuote(null);
    setShowCreateWizard(true);
  };

  if (selectedQtnId) {
    return (
      <QuotationDetail
        qtnId={selectedQtnId}
        qtnDataFromList={selectedQtn}
        onBack={() => {
          setSelectedQtnId(null);
          setSelectedQtn(null);
        }}
      />
    );
  }

  if (showCreateWizard) {
    return (
      <NewQuotationWizard
        prId={selectedPrForQuote}
        onBack={() => {
          setShowCreateWizard(false);
          setSelectedPrForQuote(null);
        }}
        onSuccess={() => {
          setShowCreateWizard(false);
          setSelectedPrForQuote(null);
          fetchQuotations();
        }}
      />
    );
  }

  const filteredItems = getFilteredQuotations();

  // Calculate summary counts
  const totalCount = quotations.length;
  const draftCount = quotations.filter(q => q.status_lower === 'draft').length;
  const submittedCount = quotations.filter(q => q.status_lower === 'submitted').length;
  const awardedCount = quotations.filter(q => q.status_lower === 'awarded').length;

  // Total value for submitted/awarded
  const totalValue = quotations
    .filter(q => q.status_lower === 'submitted' || q.status_lower === 'awarded')
    .reduce((sum, q) => sum + q.grand_total, 0);

  return (
    <div className="fade-in-slide container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4 text-start">
        {['VENDOR', 'VENDOR_ADMIN'].includes(userRole) ? (
          <>
            <div className="text-start">
              <h4 className="fw-bold text-uppercase mb-1" style={{ color: '#064e3b' }}>My Quotations</h4>
              {/* <p className="text-muted mb-0 small">Create, edit and track all your quotations — with or without a PR reference</p> */}
            </div>
            <div className="d-flex gap-2">

              <Button
                variant="outline-green"
                className="fw-bold px-3 py-2"
                style={{ borderRadius: '6px' }}
                onClick={openPrSelection}
              >
                <i className="fas fa-file-contract me-1"></i> Create from PR
              </Button>
              {/* <Button
                variant="green"
                className="fw-bold px-3 py-2"
                style={{ borderRadius: '6px' }}
                onClick={startStandaloneQuote}
              >
                <i className="fas fa-plus me-1"></i> New Quotation (Standalone)
              </Button> */}
              {onBack && (
                <div
                  onClick={onBack}
                  className="d-inline-flex align-items-center justify-content-center text-muted cursor-pointer px-4 py-2"
                  style={{ cursor: 'pointer', transition: 'color 0.2s ease' }}
                >
                  <i className="fas fa-arrow-left me-2"></i>
                  <span className="fw-medium">Back</span>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="text-start">
              <h4 className="fw-bold text-uppercase mb-1" style={{ color: '#064e3b' }}>Manage Quotations</h4>
              <p className="text-muted mb-0 small">Review, compare and award vendor quotations submitted against purchase requisitions</p>
            </div>
            <div className="d-flex gap-2">
              {onBack && (
                <div
                  onClick={onBack}
                  className="d-inline-flex align-items-center justify-content-center text-muted cursor-pointer px-2"
                  style={{ cursor: 'pointer', transition: 'color 0.2s ease' }}
                >
                  <i className="fas fa-arrow-left me-2"></i>
                  <span className="fw-medium">Back</span>
                </div>
              )}
              <Button
                variant="outline-green"
                className="fw-bold px-3 py-2"
                style={{ borderRadius: '6px' }}
                onClick={() => onNavigate && onNavigate('quote-comparison')}
              >
                <i className="fas fa-balance-scale me-1"></i> Compare Quotes
              </Button>
            </div>
          </>
        )}
      </div>
      {/* Filters and Search Bar */}
      <div className="d-flex flex-column flex-md-row gap-3 mb-4">
        <div className="flex-grow-1 position-relative" style={{ minWidth: '250px' }}>
          <input
            type="text"
            className="form-control border-light-subtle bg-white shadow-sm ps-3 text-start"
            placeholder="Search quotation number, description or PR reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ borderRadius: '8px', padding: '10px 5px' }}
          />
        </div>

        <select
          className="form-select border-light-subtle shadow-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: '200px', borderRadius: '8px', padding: '10px 16px' }}
        >
          <option value="all">Status: All</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="awarded">Awarded</option>
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

      <div className="row g-3 mb-4" style={{ display: showKpis ? 'flex' : 'none' }}>
        <div className="col-md col-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body p-3 text-start">
              <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px' }}>Total</p>
              <h3 className="fw-bold mb-0 text-dark">{totalCount}</h3>
              <p className="text-muted small mb-0">All quotations</p>
            </div>
          </div>
        </div>
        <div className="col-md col-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body p-3 text-start">
              <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px', color: '#d97706' }}>Draft</p>
              <h3 className="fw-bold text-warning mb-0">{draftCount}</h3>
              <p className="text-muted small mb-0">Not yet submitted</p>
            </div>
          </div>
        </div>
        <div className="col-md col-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body p-3 text-start">
              <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px', color: '#0284c7' }}>Submitted</p>
              <h3 className="fw-bold text-info mb-0">{submittedCount}</h3>
              <p className="text-muted small mb-0">Awaiting buyer</p>
            </div>
          </div>
        </div>
        <div className="col-md col-6">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body p-3 text-start">
              <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px', color: '#16a34a' }}>Awarded</p>
              <h3 className="fw-bold text-success mb-0">{awardedCount}</h3>
              <p className="text-muted small mb-0">Won</p>
            </div>
          </div>
        </div>
        <div className="col-md col-12">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body p-3 text-start">
              <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px' }}>Total Value</p>
              <h3 className="fw-bold mb-0" style={{ color: '#0f766e' }}>₹ {totalValue.toLocaleString('en-IN')}</h3>
              <p className="text-muted small mb-0">Submitted & Awarded</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quotations Table */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-start" style={{ minWidth: '800px' }}>
              <thead className="bg-light text-secondary fs-12 fw-semibold text-uppercase" style={{ letterSpacing: '0.5px' }}>
                <tr>
                  <th className="ps-3 py-3 border-0 rounded-start" style={{ width: '40px' }}></th>
                  <th className="py-3 border-0">Quotation No / Version</th>
                  <th className="py-3 border-0">Description</th>
                  <th className="py-3 border-0">Vendor</th>
                  <th className="py-3 border-0">PR Reference</th>
                  <th className="py-3 border-0">Date</th>
                  <th className="py-3 border-0">Valid Until</th>
                  <th className="text-end py-3 border-0">Grand Total</th>
                  <th className="text-center py-3 border-0">Status</th>
                  <th className="text-center pe-4 py-3 border-0 rounded-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" className="text-center py-5">
                      <div className="spinner-border text-success" role="status"></div>
                      <p className="mt-2 text-muted">Loading Quotations...</p>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="10" className="text-center py-5 text-muted">
                      <i className="fas fa-file-signature fs-1 mb-3 d-block text-secondary"></i>
                      <p className="mb-0 fw-semibold">No quotations found</p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((qtn, idx) => (
                    <React.Fragment key={qtn.quotation_id}>
                      <tr className="align-middle">
                        <td className="ps-3 py-3 border-bottom">
                          <button
                            className="btn btn-sm btn-link text-secondary p-0"
                            onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                          >
                            <i className={`fas fa-chevron-${expandedIdx === idx ? 'up' : 'down'}`}></i>
                          </button>
                        </td>
                        <td className="py-3 border-bottom">
                          <div
                            className="fw-bold text-success text-decoration-underline"
                            style={{ fontSize: '14px', cursor: 'pointer' }}
                            onClick={() => {
                              setSelectedQtnId(qtn.quotation_id);
                              setSelectedQtn(qtn);
                            }}
                          >
                            {qtn.display_number}
                          </div>
                          <div className="text-muted" style={{ fontSize: '11px' }}>v1 · 1 version</div>
                        </td>
                        <td>
                          <div className="fw-medium text-dark">{qtn.remarks}</div>
                          <div className="text-muted" style={{ fontSize: '11px' }}>
                            {qtn.pr_id ? `PR: ${qtn.pr_id}` : 'Standalone (no PR)'}
                          </div>
                        </td>
                        <td>
                          <span className="fw-semibold text-secondary" style={{ fontSize: '13px' }}>{qtn.vendorName || '-'}</span>
                        </td>
                        <td>
                          {qtn.pr_id ? (
                            <span className="text-primary fw-semibold">{qtn.pr_id}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>{qtn.display_date}</td>
                        <td>{qtn.display_valid_until}</td>
                        <td className="text-end fw-bold text-dark">
                          {qtn.currency === 'USD' ? '$' : '₹'} {qtn.grand_total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="text-center">
                          <span className={`badge bg-soft-${qtn.status_badge} text-${qtn.status_badge} rounded-pill px-3 py-2 text-uppercase fw-bold`} style={{ fontSize: '10px' }}>
                            ● {qtn.status}
                          </span>
                        </td>
                        <td className="text-center pe-4">
                          {qtn.pr_id && qtn.status_lower !== 'awarded' && userRole !== 'VENDOR' && userRole !== 'VENDOR_ADMIN' && (
                            <button
                              className="btn btn-sm btn-outline-success py-1 px-2"
                              style={{ fontSize: '11px', borderRadius: '4px' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onNavigate && onNavigate('quote-comparison', { initialPrNumber: qtn.pr_id });
                              }}
                              title="Compare Quotes for this PR"
                            >
                              <i className="fas fa-balance-scale"></i> Compare
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedIdx === idx && (
                        <tr>
                          <td colSpan="10" className="p-4 bg-light border-bottom">
                            <div className="card border-0 shadow-sm rounded-3">
                              <div className="card-body p-4">
                                <h6 className="text-uppercase fw-bold text-dark mb-3" style={{ fontSize: '12px', letterSpacing: '0.5px' }}>
                                  <i className="fas fa-boxes me-2 text-primary"></i>Item Details
                                </h6>
                                <div className="table-responsive">
                                  <table className="table table-sm table-bordered mb-0" style={{ fontSize: '12px' }}>
                                    <thead className="table-light text-muted text-uppercase">
                                      <tr>
                                        <th className="ps-3 py-2">Item Code</th>
                                        <th className="py-2">Description</th>
                                        <th className="text-end py-2">Qty</th>
                                        <th className="text-end py-2">Unit Price</th>
                                        <th className="text-end py-2">GST %</th>
                                        <th className="text-end py-2">Freight</th>
                                        <th className="text-end pe-3 py-2">Line Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {qtn.line_items && qtn.line_items.length > 0 ? (
                                        qtn.line_items.map((item, i) => (
                                          <tr key={i}>
                                            <td className="ps-3 fw-semibold text-primary" style={{ fontFamily: 'monospace' }}>{item.item_code || item.itemCode || '-'}</td>
                                            <td>{item.description || '-'}</td>
                                            <td className="text-end fw-medium">{item.quoted_qty || item.quotedQty || item.quantity || 0} {item.uom || 'NOS'}</td>
                                            <td className="text-end text-muted">₹ {(item.unit_price || item.unitPrice || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="text-end text-muted">{item.gst_percent || item.gstPercent || 0}%</td>
                                            <td className="text-end text-muted">₹ {(item.freight_amount || item.freightAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                            <td className="text-end pe-3 fw-bold text-dark">₹ {(item.line_total || item.lineTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                          </tr>
                                        ))
                                      ) : (
                                        <tr>
                                          <td colSpan="7" className="text-center py-4 text-muted">No line items available</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
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

      {/* PR Selection Modal */}
      {showPrSelectModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '600px' }}>
            <div className="custom-modal-header bg-light">
              <h5 className="custom-modal-title text-dark fw-bold">
                <i className="fas fa-file-circle-check text-success me-2"></i> Select PR for Quotation
              </h5>
              <button className="custom-modal-close-btn" onClick={() => setShowPrSelectModal(false)}>&times;</button>
            </div>
            <div className="custom-modal-body p-0">
              <div className="table-responsive" style={{ maxHeight: '350px' }}>
                <table className="table table-hover align-middle mb-0 text-start" style={{ fontSize: '12px' }}>
                  <thead className="bg-light text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>
                    <tr>
                      <th className="ps-3 py-3">PR Number</th>
                      <th>Created By</th>
                      <th>Date</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingPrs ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4 text-muted">
                          <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                          Loading released purchase requisitions...
                        </td>
                      </tr>
                    ) : availablePrs.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4 text-muted">
                          No released or approved PRs available.
                        </td>
                      </tr>
                    ) : (
                      availablePrs.map((pr) => (
                        <tr key={pr.prNumber || pr.pr_number}>
                          <td className="ps-3 fw-bold text-success">{pr.prNumber || pr.pr_number}</td>
                          <td>{pr.createdBy || pr.created_by || 'System'}</td>
                          <td>{(pr.createdAt || pr.created_date || '').substring(0, 10)}</td>
                          <td className="text-center">
                            <Button
                              variant="green"
                              className="btn-sm py-1 px-3 fw-bold"
                              style={{ borderRadius: '6px', fontSize: '11px' }}
                              onClick={() => startQuoteFromPr(pr)}
                            >
                              Select
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="custom-modal-footer bg-light p-3 text-end">
              <Button
                variant="outline-green"
                className="py-2 px-3 fw-bold"
                style={{ borderRadius: '6px' }}
                onClick={() => setShowPrSelectModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotation;
