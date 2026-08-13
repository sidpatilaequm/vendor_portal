import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';

const AsnDetail = ({ asnId, onBack }) => {
  const [asn, setAsn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAsnDetails = async () => {
      setLoading(true);
      setError(null);
      
      // Fallback/Mock data matching the selected ID
      const mockAsns = {
        'ASN-2026-00121': {
          asn_number: 'ASN-2026-00121',
          po_reference: 'PO-2026-04588',
          despatch_date: '18 Jun 2026',
          expected_delivery: '22 Jun 2026',
          is_partial: false,
          despatch_address: 'Ambuja Cements, Survey No 47, Surat-Magdalla Road, Surat, Gujarat 395007',
          deliver_address: 'Plot 47, Peenya Industrial Area, Bangalore 560058',
          despatch_state: '27 — Gujarat',
          delivery_state: '29 — Karnataka',
          transport_mode: 'Road',
          carrier: '—',
          vehicle_no: '—',
          lr_number: '—',
          packages: '4 Pallet',
          gross_weight: '82,000 KG',
          eway_bill: '—',
          eway_validity: '—',
          invoice_number: '—',
          status: 'Draft',
          status_slug: 'draft',
          status_badge: 'warning',
          lines: [
            { lineNo: '10', description: 'OPC 53 Grade Cement', hsn: '2523', despatchQty: 4000, uom: 'MT', batchNo: 'B-OPC-881', sloc: 'SL01' }
          ],
          documents: [
            { name: 'Tax Invoice', status: 'Pending Upload', mandatory: true },
            { name: 'E-Way Bill', status: 'Pending Upload', mandatory: true }
          ]
        },
        'ASN-2026-00112': {
          asn_number: 'ASN-2026-00112',
          po_reference: 'PO-2026-04512',
          despatch_date: '10 Jun 2026',
          expected_delivery: '13 Jun 2026',
          is_partial: true,
          despatch_address: 'Ambuja Cements, Survey No 47, Surat-Magdalla Road, Surat, Gujarat 395007',
          deliver_address: 'Plot 47, Peenya Industrial Area, Bangalore 560058',
          despatch_state: '27 — Gujarat',
          delivery_state: '29 — Karnataka',
          transport_mode: 'Road',
          carrier: 'Mahindra Logistics',
          vehicle_no: 'KA-19-AB-1234',
          lr_number: 'LR/MHI /2026/11245',
          packages: '50 Pallet',
          gross_weight: '2,52,000 KG',
          eway_bill: '240612345678',
          eway_validity: 'Valid: 13 Jun 2026',
          invoice_number: 'AMB/INV/2026/0556',
          status: 'Submitted',
          status_slug: 'submitted',
          status_badge: 'success',
          lines: [
            { lineNo: '10', description: 'OPC 53 Grade Cement', hsn: '2523', despatchQty: 5000, uom: 'MT', batchNo: 'B-OPC-881', sloc: 'SL01' },
            { lineNo: '20', description: 'Packing Bags', hsn: '3923', despatchQty: 10000, uom: 'EA', batchNo: 'B-PBG-204', sloc: 'SL02' }
          ],
          documents: [
            { name: 'Tax Invoice', status: 'Uploaded', file: 'invoice_AMB_0556.pdf', mandatory: true },
            { name: 'E-Way Bill', status: 'Uploaded', file: 'ewb_240612345678.pdf', mandatory: true },
            { name: 'LR Note', status: 'Uploaded', file: 'lr_mhi_11245.pdf', mandatory: true }
          ]
        },
        'ASN-2026-00098': {
          asn_number: 'ASN-2026-00098',
          po_reference: 'PO-2026-04488',
          despatch_date: '20 May 2026',
          expected_delivery: '23 May 2026',
          is_partial: false,
          despatch_address: 'Ambuja Cements, Survey No 47, Surat-Magdalla Road, Surat, Gujarat 395007',
          deliver_address: 'Plot 47, Peenya Industrial Area, Bangalore 560058',
          despatch_state: '27 — Gujarat',
          delivery_state: '29 — Karnataka',
          transport_mode: 'Road',
          carrier: 'Blue Dart',
          vehicle_no: 'DL-01-XY-9081',
          lr_number: 'BD/2026/44221',
          packages: '12 Carton',
          gross_weight: '840 KG',
          eway_bill: '230522345671',
          eway_validity: 'Valid: 23 May 2026',
          invoice_number: 'AMB/INV/2026/0532',
          status: 'Delivered',
          status_slug: 'delivered',
          status_badge: 'info',
          lines: [
            { lineNo: '10', description: 'Electrical panels', hsn: '8537', despatchQty: 12, uom: 'EA', batchNo: 'B-ELE-401', sloc: 'SL01' }
          ],
          documents: [
            { name: 'Tax Invoice', status: 'Uploaded', file: 'invoice_AMB_0532.pdf', mandatory: true },
            { name: 'E-Way Bill', status: 'Uploaded', file: 'ewb_230522345671.pdf', mandatory: true }
          ]
        }
      };

      try {
        const token = localStorage.getItem('auth_token');
        const response = await axios.get(`/api/vendor/asns/${asnId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.data) {
          setAsn(response.data);
        } else {
          setAsn(mockAsns[asnId] || mockAsns['ASN-2026-00112']);
        }
      } catch (err) {
        console.warn('Using mock details for ASN', asnId);
        setAsn(mockAsns[asnId] || mockAsns['ASN-2026-00112']);
      } finally {
        setLoading(false);
      }
    };

    fetchAsnDetails();
  }, [asnId]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '300px' }}>
        <div className="spinner-border text-success" role="status"></div>
      </div>
    );
  }

  if (error || !asn) {
    return (
      <div className="alert alert-danger m-4 text-start">
        <i className="fas fa-exclamation-triangle me-2"></i> {error || 'ASN not found.'}
        <button className="btn btn-link py-0" onClick={onBack}>Go Back</button>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4 fade-in-slide">
      {/* Header and Back Action */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="text-start">
          <div className="d-flex align-items-center gap-3">
            <h4 className="fw-bold text-uppercase mb-1" style={{ color: '#064e3b' }}>{asn.asn_number}</h4>
            <span className={`badge bg-soft-${asn.status_badge} text-${asn.status_badge} rounded-pill px-3 py-2 text-uppercase fw-bold`} style={{ fontSize: '10px' }}>
              ● {asn.status}
            </span>
          </div>
          <p className="text-muted mb-0 small">Linked Purchase Order: <span className="fw-bold text-primary">{asn.po_reference}</span></p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-green" className="fw-bold px-3" onClick={onBack}>
            ← Back to List
          </Button>
          <Button variant="green" className="fw-bold px-3">
            <i className="fas fa-download me-1"></i> Download PDF
          </Button>
        </div>
      </div>

      {/* Overview stats */}
      <div className="row g-3 mb-4 text-start">
        <div className="col-md-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body p-3">
              <span className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '10px' }}>Despatch Date</span>
              <span className="fw-bold text-dark fs-5">{asn.despatch_date}</span>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body p-3">
              <span className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '10px' }}>Expected Delivery</span>
              <span className="fw-bold text-dark fs-5">{asn.expected_delivery}</span>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body p-3">
              <span className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '10px' }}>Carrier / Transport</span>
              <span className="fw-bold text-dark fs-5">{asn.carrier || '—'}</span>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body p-3">
              <span className="text-muted text-uppercase fw-bold d-block mb-1" style={{ fontSize: '10px' }}>Gross Weight</span>
              <span className="fw-bold text-dark fs-5">{asn.gross_weight}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Details Blocks */}
      <div className="row g-4 text-start">
        <div className="col-lg-8">
          {/* Dispatch Details Card */}
          <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px' }}>
            <div className="card-header py-3 bg-white border-bottom d-flex align-items-center">
              <i className="fas fa-shipping-fast text-success me-2"></i>
              <h6 className="fw-bold mb-0 text-uppercase text-success" style={{ fontSize: '11px', letterSpacing: '1px' }}>Despatch & Carrier Details</h6>
            </div>
            <div className="card-body p-4">
              <div className="row g-3">
                <div className="col-md-4">
                  <span className="text-muted small d-block">Transport Mode</span>
                  <span className="fw-bold text-dark fs-12">{asn.transport_mode || 'Road'}</span>
                </div>
                <div className="col-md-4">
                  <span className="text-muted small d-block">Vehicle Number</span>
                  <span className="fw-bold text-dark fs-12">{asn.vehicle_no || '—'}</span>
                </div>
                <div className="col-md-4">
                  <span className="text-muted small d-block">LR / Consignment Note</span>
                  <span className="fw-bold text-dark fs-12">{asn.lr_number || '—'}</span>
                </div>
                <div className="col-md-4">
                  <span className="text-muted small d-block">E-Way Bill Number</span>
                  <span className="fw-bold text-success fs-12">{asn.eway_bill || '—'}</span>
                </div>
                <div className="col-md-4">
                  <span className="text-muted small d-block">E-Way Bill Validity</span>
                  <span className="fw-bold text-dark fs-12">{asn.eway_validity || '—'}</span>
                </div>
                <div className="col-md-4">
                  <span className="text-muted small d-block">Packages Count / Type</span>
                  <span className="fw-bold text-dark fs-12">{asn.packages || '—'}</span>
                </div>
                <div className="col-md-6">
                  <span className="text-muted small d-block">Despatch Address</span>
                  <span className="fw-medium text-dark fs-12">{asn.despatch_address}</span>
                </div>
                <div className="col-md-6">
                  <span className="text-muted small d-block">Delivery Address</span>
                  <span className="fw-medium text-dark fs-12">{asn.deliver_address}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Table Card */}
          <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            <div className="card-header py-3 bg-white border-bottom">
              <h6 className="fw-bold mb-0 text-uppercase text-success" style={{ fontSize: '11px', letterSpacing: '1px' }}>Despatched Line Items</h6>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-start" style={{ fontSize: '12px' }}>
                <thead className="bg-light text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>
                  <tr>
                    <th className="ps-3 py-3">PO Line</th>
                    <th>Material Description</th>
                    <th>HSN Code</th>
                    <th className="text-end">Despatched Qty</th>
                    <th>UOM</th>
                    <th>Batch Number</th>
                    <th>Storage Location</th>
                  </tr>
                </thead>
                <tbody>
                  {asn.lines?.map((line) => (
                    <tr key={line.lineNo}>
                      <td className="ps-3 fw-bold">{line.lineNo}</td>
                      <td>{line.description}</td>
                      <td>{line.hsn}</td>
                      <td className="text-end fw-bold">{line.despatchedQty || line.despatchQty}</td>
                      <td className="fw-bold">{line.uom}</td>
                      <td className="text-primary">{line.batchNo || '—'}</td>
                      <td>{line.sloc || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          {/* Documents Card */}
          <div className="card border-0 shadow-sm" style={{ borderRadius: '12px' }}>
            <div className="card-header py-3 bg-white border-bottom">
              <h6 className="fw-bold mb-0 text-uppercase text-success" style={{ fontSize: '11px', letterSpacing: '1px' }}>Attachments & Verification</h6>
            </div>
            <div className="card-body p-3">
              <div className="d-flex flex-column gap-2">
                {asn.documents?.map((doc, idx) => (
                  <div key={idx} className="p-2 border rounded d-flex align-items-center justify-content-between">
                    <div>
                      <h6 className="fw-bold mb-0" style={{ fontSize: '11px' }}>{doc.name}</h6>
                      <span className="text-muted" style={{ fontSize: '10px' }}>{doc.file || doc.status}</span>
                    </div>
                    {doc.file ? (
                      <button className="btn btn-outline-success btn-sm py-0 px-2 fw-bold" style={{ fontSize: '10px' }}>
                        View
                      </button>
                    ) : (
                      <span className="badge bg-warning text-dark" style={{ fontSize: '8px' }}>PNDG</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsnDetail;
