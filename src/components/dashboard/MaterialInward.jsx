import React, { useState, useEffect } from 'react';
import Button from '../common/Button';
import BackButton from '../common/BackButton';
import MaterialInwardVerification from './MaterialInwardVerification';

const MaterialInward = ({ onBack }) => {
  const [selectedGateEntryId, setSelectedGateEntryId] = useState(null);
  
  // Main list states
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showKpis, setShowKpis] = useState(false);
  
  const [workQueue, setWorkQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const response = await fetch('http://localhost:8080/api/employee/material-inward/queue');
        if (response.ok) {
          const data = await response.json();
          const mappedQueue = data.map(item => ({
            gate_entry_id: item.gateEntryId,
            gate_entry_no: item.gateEntryNo,
            po_reference: item.poReference,
            vendor: item.vendorName,
            vehicle: item.vehicleNo,
            gate_in: item.gateInTime,
            status: item.status,
            status_slug: item.status?.toLowerCase().replace(' ', '-'),
            status_badge: 'warning',
            boxes: item.noOfBoxes || 0
          }));
          setWorkQueue(mappedQueue);
        } else {
          console.error("Failed to fetch queue data");
        }
      } catch (error) {
        console.error("Error fetching queue:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchQueue();
  }, []);

  if (selectedGateEntryId) {
    return <MaterialInwardVerification gateEntryId={selectedGateEntryId} onBack={() => setSelectedGateEntryId(null)} />;
  }

  const filteredQueue = workQueue.filter((item) => {
    const matchesFilter = filter === 'all' || item.status_slug === filter;
    const matchesSearch =
      item.gate_entry_no.toLowerCase().includes(search.toLowerCase()) ||
      item.po_reference.toLowerCase().includes(search.toLowerCase()) ||
      item.vendor.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="fade-in-slide container-fluid py-4">
      <BackButton onClick={onBack} />

      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="text-start">
          <h4 className="fw-bold text-uppercase mb-1" style={{ color: '#293383' }}>Material Inward Queue</h4>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="d-flex flex-column flex-md-row gap-3 mb-4">
        <div className="flex-grow-1 position-relative text-start">
          <span className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted">
            <i className="fas fa-search"></i>
          </span>
          <input
            type="text"
            className="form-control border-light-subtle bg-white shadow-sm ps-5"
            placeholder="Search Gate Entry, PO number, Vendor..."
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
          <option value="pending">Pending</option>
          <option value="in-progress">In Progress</option>
          <option value="on-hold">On Hold</option>
          <option value="completed">Completed</option>
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
              <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px' }}>Total Items</p>
              <h3 className="fw-bold mb-0 text-dark">{workQueue.length}</h3>
              <p className="text-muted small mb-0">All statuses</p>
            </div>
          </div>
        </div>
        <div className="col-md col-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-3">
              <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px', color: '#8B4B4D' }}>Pending</p>
              <h3 className="fw-bold text-warning mb-0">{workQueue.filter(w => w.status_slug === 'pending').length}</h3>
              <p className="text-muted small mb-0">Awaiting action</p>
            </div>
          </div>
        </div>
        <div className="col-md col-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-3">
              <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px', color: '#293383' }}>In Progress</p>
              <h3 className="fw-bold text-info mb-0">{workQueue.filter(w => w.status_slug === 'in-progress').length}</h3>
              <p className="text-muted small mb-0">Being verified</p>
            </div>
          </div>
        </div>
        <div className="col-md col-6">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-3">
              <p className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px', color: '#0E7C86' }}>Completed</p>
              <h3 className="fw-bold text-success mb-0">{workQueue.filter(w => w.status_slug === 'completed').length}</h3>
              <p className="text-muted small mb-0">Finished</p>
            </div>
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="card border-0 shadow-sm mb-5" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-start" style={{ minWidth: '1000px', fontSize: '13px' }}>
              <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr className="text-muted text-uppercase fw-bold" style={{ fontSize: '11px' }}>
                  <th className="ps-4 py-3">Gate Entry No</th>
                  <th>PO Reference</th>
                  <th>Vendor</th>
                  <th>Vehicle</th>
                  <th>Gate In Time</th>
                  <th className="text-center">Boxes</th>
                  <th className="text-center">Status</th>
                  <th className="pe-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.length > 0 ? (
                  filteredQueue.map((item) => (
                    <tr key={item.gate_entry_id || item.gate_entry_no} className="cursor-pointer" onClick={() => setSelectedGateEntryId(item.gate_entry_id)}>
                      <td className="ps-4">
                        <div className="fw-bold text-success">{item.gate_entry_no}</div>
                      </td>
                      <td>
                        <div className="fw-bold text-dark">{item.po_reference}</div>
                      </td>
                      <td>{item.vendor}</td>
                      <td>{item.vehicle}</td>
                      <td>{item.gate_in}</td>
                      <td className="text-center fw-bold">{item.boxes}</td>
                      <td className="text-center">
                        <span className={`badge bg-soft-${item.status_badge} text-${item.status_badge} rounded-pill px-3 py-2 text-uppercase fw-bold`} style={{ fontSize: '10px' }}>
                          ● {item.status}
                        </span>
                      </td>
                      <td className="pe-3 text-end"><i className="fas fa-chevron-right text-muted fs-6"></i></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="text-center py-5 text-muted">
                      <i className="fas fa-inbox fs-3 mb-3 d-block text-light-subtle"></i>
                      No gate entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaterialInward;
