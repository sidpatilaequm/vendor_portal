import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';
import BackButton from '../common/BackButton';
import NewAsnWizard from './NewAsnWizard';
import AsnDetail from './AsnDetail';
import { useAuth } from '../../context/AuthContext';

const ASN = ({ onBack }) => {
  const [selectedAsnId, setSelectedAsnId] = useState(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [selectedPoId, setSelectedPoId] = useState(null);
  const [selectedPoObj, setSelectedPoObj] = useState(null);

  // Modals
  const [showPoSelectModal, setShowPoSelectModal] = useState(false);
  const [loadingPos, setLoadingPos] = useState(false);
  const [availablePos, setAvailablePos] = useState([]);
  const [tempSelectedPo, setTempSelectedPo] = useState('');
  const [poSearchQuery, setPoSearchQuery] = useState('');

  // Main list states
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [showKpis, setShowKpis] = useState(false);
  const { selectedCompanyCode } = useAuth();
  const [asns, setAsns] = useState([]);

  const fetchASNs = async () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    try {
      let endpoint = '/api/vendor/asns';
      if (selectedCompanyCode) {
        endpoint += `?company_code=${selectedCompanyCode}`;
      }
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      let asnsList = [];
      if (Array.isArray(response.data)) {
        asnsList = response.data;
      } else if (response.data && response.data.data && Array.isArray(response.data.data.asns)) {
        asnsList = response.data.data.asns;
      }

      if (asnsList.length > 0) {
        const mappedAsns = asnsList.map((asn) => {
          let totalQty = 0;
          if (asn.items && asn.items.length > 0) {
            totalQty = asn.items.reduce((sum, item) => sum + (item.quantityShipped || 0), 0);
          }

          let displayStatus = 'Draft';
          let slug = 'draft';
          let badge = 'warning';

          if (asn.status === 'IN_TRANSIT') {
            displayStatus = 'In Transit';
            slug = 'in-transit';
            badge = 'info';
          } else if (asn.status === 'DELIVERED') {
            displayStatus = 'Delivered';
            slug = 'delivered';
            badge = 'success';
          }

          return {
            asn_number: asn.asn_number || `ASN-${asn.id}`,
            display_number: asn.display_number || asn.asn_number || `ASN-${asn.id}`,
            delivery_note: asn.delivery_note || '',
            po_reference: asn.po_reference || asn.poNumber || '—',
            despatch_date: asn.despatch_date || asn.dispatchDate || '—',
            expected_delivery: asn.expected_delivery || asn.expectedDelivery || '—',
            carrier: asn.carrier || asn.transporterCode || '—',
            invoice_date: asn.invoice_date || asn.invoiceDate || '',
            packages: asn.noOfPackages || (Array.isArray(asn.packages) ? asn.packages.length : asn.packages) || '—',
            gross_weight: (asn.gross_weight && asn.gross_weight !== 'TBD') ? asn.gross_weight : `${totalQty} KG`,
            eway_bill: asn.eway_bill || asn.ewayBill || '—',
            eway_validity: asn.eway_validity || '',
            invoice_number: asn.invoice_number || asn.invoiceNumber || '—',
            status: asn.status_slug ? displayStatus : displayStatus,
            status_slug: asn.status_slug || slug,
            status_badge: asn.status_badge || badge
          };
        });
        setAsns(mappedAsns);
      }
    } catch (err) {
      console.warn('Failed to fetch ASNs, keeping defaults.', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailablePOs = async () => {
    setLoadingPos(true);
    const token = localStorage.getItem('auth_token');
    try {
      const response = await axios.get('/api/vendor/purchase-orders', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: { vendor_code: '' } // Fetch all POs or let backend decide based on context
      });
      let data = response.data?.orders || response.data?.content || response.data || [];
      if (!Array.isArray(data)) data = [];
      data = data.filter(po => {
        const status = po.poStatus || po.status;
        return status && (status.toLowerCase() === 'acknowledged' || status.toLowerCase() === 'partial_dispatch');
      });
      setAvailablePos(data);
    } catch (err) {
      console.warn('Failed to fetch POs for modal selection, loading default mocks.', err);
      setAvailablePos([
        { poNumber: 'PO-2026-04512', description: 'OPC 53 Grade Cement + Packing Bags', grandTotal: 20635000, createdAt: '2026-06-10', poStatus: 'Acknowledged' },
        { poNumber: 'PO-2026-04588', description: 'Steel structural frames', grandTotal: 1397050, createdAt: '2026-06-18', poStatus: 'Acknowledged' }
      ]);
    } finally {
      setLoadingPos(false);
    }
  };

  useEffect(() => {
    fetchASNs();
  }, [selectedCompanyCode]);

  const openPoSelectionModal = () => {
    fetchAvailablePOs();
    setShowPoSelectModal(true);
  };

  const handleContinueWithPo = () => {
    if (!tempSelectedPo) {
      alert('Please select a Purchase Order first.');
      return;
    }
    // tempSelectedPo might be a string now, but the table 'Select' directly calls setShowCreateWizard
    setShowPoSelectModal(false);
    setShowCreateWizard(true);
  };

  const handleCreateStandalone = () => {
    setSelectedPoId('PO-STANDALONE');
    setShowPoSelectModal(false);
    setShowCreateWizard(true);
  };

  const handleWizardSuccess = (msg) => {
    setShowCreateWizard(false);
    if (msg) alert(msg);
    fetchASNs();
  };

  if (selectedAsnId) {
    return <AsnDetail asnId={selectedAsnId} onBack={() => setSelectedAsnId(null)} />;
  }

  if (showCreateWizard) {
    return <NewAsnWizard poId={selectedPoId} poObj={selectedPoObj} onBack={() => setShowCreateWizard(false)} onSuccess={handleWizardSuccess} />;
  }

  const filteredAsns = asns.filter((asn) => {
    const matchesFilter = filter === 'all' || asn.status_slug === filter;
    const matchesSearch =
      asn.asn_number.toLowerCase().includes(search.toLowerCase()) ||
      asn.po_reference.toLowerCase().includes(search.toLowerCase()) ||
      (asn.carrier && asn.carrier.toLowerCase().includes(search.toLowerCase())) ||
      (asn.invoice_number && asn.invoice_number.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="fade-in-slide container-fluid py-4">
      <BackButton onClick={onBack} />

      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="text-start">
          <h4 className="fw-bold text-uppercase mb-1" style={{ color: '#293383' }}>Advance Shipment Notices</h4>
          <p className="text-muted mb-0" style={{ fontSize: '13px' }}>Create and track all despatches against Purchase Orders</p>
        </div>
        <div className="d-flex gap-2">

          <Button variant="outline-green" className="fw-bold shadow-sm" onClick={openPoSelectionModal}>
            <i className="fas fa-plus me-1"></i> Create ASN from PO
          </Button>
          {/* <Button variant="green" className="fw-bold shadow-sm" onClick={handleCreateStandalone}>
            <i className="fas fa-truck me-1"></i> + New ASN
          </Button> */}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="d-flex flex-column flex-md-row gap-3 mb-4">
        <div className="flex-grow-1 position-relative text-start" style={{ minWidth: '250px' }}>
          <span className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted">
            <i className="fas fa-search"></i>
          </span>
          <input
            type="text"
            className="form-control border-light-subtle bg-white shadow-sm ps-5"
            placeholder="Search ASN, PO number, LR number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ borderRadius: '8px', padding: '10px 16px' }}
          />
        </div>

        <select
          className="form-select border-light-subtle shadow-sm fs-12"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: '200px', borderRadius: '8px', padding: '10px 16px' }}
        >
          <option value="all">Status: All</option>
          <option value="draft">Draft</option>
          <option value="submitted">Submitted</option>
          <option value="delivered">Delivered</option>
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

      {/* Statistics Cards */}
      <div className="row g-3 mb-4 text-start" style={{ display: showKpis ? 'flex' : 'none' }}>
        <div className="col-md col-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-3">
              <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px' }}>Total ASNs</p>
              <h3 className="fw-bold mb-0 text-dark">{asns.length}</h3>
              <p className="text-muted small mb-0">All statuses</p>
            </div>
          </div>
        </div>
        <div className="col-md col-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-3">
              <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px', color: '#8B4B4D' }}>Draft</p>
              <h3 className="fw-bold text-warning mb-0">{asns.filter(a => a.status_slug === 'draft').length}</h3>
              <p className="text-muted small mb-0">Not yet submitted</p>
            </div>
          </div>
        </div>
        <div className="col-md col-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-3">
              <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px', color: '#293383' }}>In Transit</p>
              <h3 className="fw-bold text-info mb-0">{asns.filter(a => a.status_slug === 'in-transit').length}</h3>
              <p className="text-muted small mb-0">Goods on the way</p>
            </div>
          </div>
        </div>
        <div className="col-md col-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-3">
              <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px', color: '#0E7C86' }}>Delivered</p>
              <h3 className="fw-bold text-success mb-0">{asns.filter(a => a.status_slug === 'delivered').length}</h3>
              <p className="text-muted small mb-0">GR posted</p>
            </div>
          </div>
        </div>
      </div>

      {/* ASN Table */}
      <div className="card border-0 shadow-sm mb-5" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-start" style={{ minWidth: '1000px', fontSize: '12px' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr className="text-muted text-uppercase fw-bold" style={{ fontSize: '11px' }}>
                  <th className="ps-4 py-3">ASN Number</th>
                  <th>PO Reference</th>
                  <th>Despatch Date</th>
                  <th>Expected Delivery</th>
                  <th>Carrier / LR No.</th>
                  <th className="text-center">Packages</th>
                  <th className="text-end">Gross Weight</th>
                  <th>E-Way Bill</th>
                  <th>Invoice No.</th>
                  <th className="text-center">Status</th>
                  <th className="pe-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredAsns.map((asn) => (
                  <tr key={asn.asn_number} className="cursor-pointer" onClick={() => setSelectedAsnId(asn.asn_number)}>
                    <td className="ps-4">
                      <div className="fw-bold text-success" style={{ fontSize: '13px' }}>{asn.display_number}</div>
                      {asn.delivery_note && <div className="text-muted small">{asn.delivery_note}</div>}
                    </td>
                    <td>
                      <div className="fw-bold text-dark">{asn.po_reference}</div>
                    </td>
                    <td>{asn.despatch_date}</td>
                    <td>{asn.expected_delivery}</td>
                    <td>
                      {asn.carrier !== '—' && asn.carrier ? (
                        <>
                          <div className="fw-bold text-dark">{asn.carrier}</div>
                          <div className="text-muted small">{asn.invoice_date}</div>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-center fw-bold">{asn.packages}</td>
                    <td className="text-end fw-bold">{asn.gross_weight}</td>
                    <td>
                      {asn.eway_bill !== '—' && asn.eway_bill ? (
                        <>
                          <div className="fw-bold text-success">{asn.eway_bill}</div>
                          <div className="text-muted small">{asn.eway_validity}</div>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="fw-semibold text-dark">{asn.invoice_number}</td>
                    <td className="text-center">
                      <span className={`badge bg-soft-${asn.status_badge} text-${asn.status_badge} rounded-pill px-3 py-2 text-uppercase fw-bold`} style={{ fontSize: '10px' }}>
                        ● {asn.status}
                      </span>
                    </td>
                    <td className="pe-3 text-end"><i className="fas fa-chevron-right text-muted fs-6"></i></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* PO Selection Modal */}
      {showPoSelectModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '650px' }}>
            <div className="custom-modal-header bg-light d-flex justify-content-between align-items-center">
              <h5 className="custom-modal-title text-dark fw-bold mb-0">
                <i className="fas fa-file-invoice text-success me-2"></i> Select Purchase Order
              </h5>
              <button className="custom-modal-close-btn" onClick={() => setShowPoSelectModal(false)}>&times;</button>
            </div>
            <div className="bg-white p-3 border-bottom">
              <input 
                type="text" 
                className="form-control form-control-sm" 
                placeholder="Search by PO Number..." 
                value={poSearchQuery}
                onChange={e => setPoSearchQuery(e.target.value)}
              />
            </div>
            <div className="custom-modal-body p-0">
              <div className="table-responsive" style={{ maxHeight: '350px' }}>
                <table className="table table-hover align-middle mb-0 text-start" style={{ fontSize: '12px' }}>
                  <thead className="bg-light text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>
                    <tr>
                      <th className="ps-3 py-3">PO Number</th>
                      <th>Description</th>
                      <th>Date</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                      {loadingPos ? (
                        <tr>
                          <td colSpan="4" className="text-center py-4 text-muted">
                            <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                            Loading valid purchase orders...
                          </td>
                        </tr>
                      ) : availablePos.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-4 text-muted">
                            <i className="fas fa-info-circle me-1"></i> No available POs (Acknowledged or Partial).
                          </td>
                        </tr>
                      ) : availablePos.filter(po => (po.poNumber || po.po_number || '').toLowerCase().includes(poSearchQuery.toLowerCase())).length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-4 text-muted">
                            <i className="fas fa-info-circle me-1"></i> No available POs match your search.
                          </td>
                        </tr>
                      ) : (
                      availablePos.filter(po => (po.poNumber || po.po_number || '').toLowerCase().includes(poSearchQuery.toLowerCase())).map((po) => (
                        <tr key={po.poNumber || po.po_number || po.id}>
                          <td className="ps-3 fw-bold text-success">{po.poNumber || po.po_number}</td>
                          <td>{po.description || po.vendorName || 'General Supply'}</td>
                          <td>{(po.createdAt || po.poDate || po.po_date || '').substring(0, 10)}</td>
                          <td className="text-center">
                            <Button
                              variant="green"
                              className="btn-sm py-1 px-3 fw-bold"
                              style={{ borderRadius: '6px', fontSize: '11px' }}
                              onClick={() => {
                                setTempSelectedPo(po.poNumber || po.po_number);
                                setSelectedPoId(po.poId || po.id);
                                setSelectedPoObj(po);
                                setShowPoSelectModal(false);
                                setShowCreateWizard(true);
                              }}
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
            <div className="custom-modal-footer bg-light p-3 d-flex justify-content-between">
              {/* <button
                className="btn btn-outline-primary btn-sm fw-bold px-4 shadow-sm"
                onClick={handleCreateStandalone}
                style={{ borderRadius: '8px' }}
              >
                Create Without PO
              </button> */}
              {/* <button
                className="btn btn-outline-secondary btn-sm fw-bold px-4 shadow-sm"
                onClick={() => setShowPoSelectModal(false)}
                style={{ borderRadius: '8px' }}
              >
                Close
              </button> */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ASN;
