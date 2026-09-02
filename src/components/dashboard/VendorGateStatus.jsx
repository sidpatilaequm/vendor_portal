import React, { useState, useEffect } from 'react';
import BackButton from '../common/BackButton';
import './VendorGateStatus.css';

const VendorGateStatus = ({ onBack }) => {
  const [asns, setAsns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsn, setSelectedAsn] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/vendor/gate-entry/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.data && data.data.items) {
          setAsns(data.data.items);
        }
      }
    } catch (err) {
      console.error("Failed to fetch gate status", err);
    }
    setLoading(false);
  };

  const handleCardClick = async (asn) => {
    if (asn.gateStatus === 'ALLOWED' || asn.gateStatus === 'IN_TRANSIT') return;
    
    setSelectedAsn(asn);
    setDetailsLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/vendor/gate-entry/status/${asn.asnNumber}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.data && data.data.details) {
          setDetails(data.data.details);
        }
      }
    } catch (err) {
      console.error("Failed to fetch discrepancy details", err);
    }
    setDetailsLoading(false);
  };

  const closeModal = () => {
    setSelectedAsn(null);
    setDetails(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="vendor-gate-status">
      <BackButton onClick={onBack} />
      <div className="vgs-header">
        <div>
          <h2>Gate Entry Status</h2>
          <p>Track your dispatched ASNs and view inspection results</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5 text-muted">Loading gate statuses...</div>
      ) : asns.length === 0 ? (
        <div className="text-center py-5">
          <i className="fas fa-truck-loading fs-1 text-muted mb-3 opacity-50"></i>
          <h5 className="fw-bold text-dark">No active shipments</h5>
          <p className="text-muted">You do not have any ASNs currently tracking at the gate.</p>
        </div>
      ) : (
        <div className="vgs-grid">
          {asns.map(a => (
            <div 
              key={a.asnNumber} 
              className={`vgs-card st-${a.gateStatus}`}
              onClick={() => handleCardClick(a)}
              title={(a.gateStatus === 'HELD' || a.gateStatus === 'REJECTED') ? "Click to view discrepancy report" : ""}
            >
              <div className="vgs-card-top">
                <h4 className="vgs-asn">{a.asnNumber}</h4>
                <span className={`vgs-badge st-${a.gateStatus}`}>
                  {a.gateStatus.replace('_', ' ')}
                </span>
              </div>
              
              <div className="vgs-details">
                <div>
                  <div className="vgs-dt">Vehicle No</div>
                  <div className="vgs-dd">{a.vehicleNo || 'N/A'}</div>
                </div>
                {a.gatePassNumber && (
                  <div>
                    <div className="vgs-dt">Gate Pass</div>
                    <div className="vgs-dd" style={{fontFamily: 'monospace'}}>{a.gatePassNumber}</div>
                  </div>
                )}
              </div>

              <div className="vgs-footer">
                <span>Updated at: <b>{formatDate(a.processedAt || new Date())}</b></span>
                {(a.gateStatus === 'HELD' || a.gateStatus === 'REJECTED') && (
                  <i className="fas fa-chevron-right" style={{color: '#9ca3af', alignSelf: 'center'}}></i>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedAsn && (
        <div className="vgs-modal-overlay" onClick={(e) => e.target.className === 'vgs-modal-overlay' && closeModal()}>
          <div className="vgs-modal">
            <div className="vgs-modal-header">
              <div>
                <h3>Discrepancy Report</h3>
                <div className="text-muted fs-14 mt-1" style={{fontFamily: 'monospace'}}>{selectedAsn.asnNumber}</div>
              </div>
              <button className="vgs-modal-close" onClick={closeModal}>×</button>
            </div>
            
            <div className="vgs-modal-body">
              <div className={`vgs-alert ${selectedAsn.gateStatus}`}>
                <i className={`fas ${selectedAsn.gateStatus === 'HELD' ? 'fa-exclamation-triangle' : 'fa-times-circle'}`}></i>
                <div>
                  <strong>Status: {selectedAsn.gateStatus}</strong>
                  <p className="mb-0 mt-1" style={{fontSize: '14px'}}>
                    {selectedAsn.gateStatus === 'HELD' 
                      ? "This vehicle is held at the gate pending supervisor review due to the following discrepancies."
                      : "This vehicle was rejected at the gate and turned away."}
                  </p>
                </div>
              </div>

              {detailsLoading ? (
                <div className="text-center py-4 text-muted">Loading discrepancy details...</div>
              ) : details?.discrepancies ? (
                <>
                  {details.discrepancies.documents && details.discrepancies.documents.length > 0 && (
                    <div className="mb-4">
                      <div className="vgs-section-title">Missing Documents</div>
                      <ul className="vgs-list">
                        {details.discrepancies.documents.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {details.discrepancies.packages && (
                    <div className="mb-4">
                      <div className="vgs-section-title">Package Count Mismatch</div>
                      <ul className="vgs-list">
                        <li>{details.discrepancies.packages}</li>
                      </ul>
                    </div>
                  )}

                  {details.discrepancies.lines && details.discrepancies.lines.length > 0 && (
                    <div>
                      <div className="vgs-section-title">Material Discrepancies ({details.discrepancies.lines.length})</div>
                      {details.discrepancies.lines.map((l, i) => (
                        <div key={i} className="vgs-line-card">
                          <div className="vgs-line-header">
                            <span style={{fontFamily: 'monospace'}}>{l.materialCode}</span>
                          </div>
                          <div className="vgs-line-grid">
                            <div>
                              <div className="vgs-dt">Declared Qty</div>
                              <div className="vgs-dd">{l.declared}</div>
                            </div>
                            <div>
                              <div className="vgs-dt">Counted Qty</div>
                              <div className="vgs-dd">{l.counted}</div>
                            </div>
                          </div>
                          {l.remark && (
                            <div className="vgs-line-rmk">
                              <i className="fas fa-comment-dots me-2"></i>{l.remark}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-muted text-center py-3">No specific discrepancy details provided.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorGateStatus;
