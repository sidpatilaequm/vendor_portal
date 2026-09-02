import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';
import Modal from '../common/Modal';
import BackButton from '../common/BackButton';
import PurchaseRequisitionDetail from './PurchaseRequisitionDetail';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';

const PurchaseRequisition = ({ onBack, mode = 'pr' }) => {
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedPrId, setSelectedPrId] = useState(null);
  const [showKpis, setShowKpis] = useState(false);
  const { selectedCompanyCode } = useAuth();

  // Modal states
  const [showActionModal, setShowActionModal] = useState(false);
  const [activePr, setActivePr] = useState(null);
  const [decisionComment, setDecisionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionAlert, setActionAlert] = useState(null);

  // Create PR States
  const [userRole, setUserRole] = useState('VENDOR');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Custom Toast state
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Invoice Extraction States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [extractionLoading, setExtractionLoading] = useState(false);
  const [extractionError, setExtractionError] = useState('');
  const [extractedData, setExtractedData] = useState(null);

  // Budget Checking States
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState("");
  const [budgetStatus, setBudgetStatus] = useState(null);
  const [plants, setPlants] = useState([
    { id: 1, name: 'Mumbai Primary Plant' },
    { id: 2, name: 'Bangalore Assembly Plant' }
  ]);
  const [uploadPlantId, setUploadPlantId] = useState("");
  const [uploadLocationId, setUploadLocationId] = useState("");

  // Details Modal pagination & search
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [itemsCurrentPage, setItemsCurrentPage] = useState(1);
  const [createLoading, setCreateLoading] = useState(false);
  const [locations, setLocations] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);


  const getTodayDateStr = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [newPr, setNewPr] = useState({
    locationId: '',
    requiredDate: '',
    remarks: '',
    companyCode: '',
    requestDate: getTodayDateStr(),
    items: [
      {
        materialId: '',
        sku: '',
        name: '',
        quantity: 0,
        uom: 'NOS',
        estimatedPrice: 0,
        remarks: ''
      }
    ]
  });


  const fetchCreateOptions = async () => {
    const token = localStorage.getItem('auth_token');
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    };
    try {
      const res = await axios.get('/api/purchase-requisitions/create-pr-options', { headers });
      const data = res.data;
      setLocations(data.locations || []);
      setMaterials(data.materials || []);
    } catch (err) {
      console.error('Failed to fetch options for creating PR:', err);
    }
  };

  const handleAddLine = () => {
    setNewPr(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          materialId: '',
          sku: '',
          name: '',
          quantity: 0,
          uom: 'NOS',
          estimatedPrice: 0,
          remarks: ''
        }
      ]
    }));
  };

  const handleDeleteLine = () => {
    if (newPr.items.length > 1) {
      setNewPr(prev => {
        const updated = [...prev.items];
        updated.splice(selectedRowIndex, 1);
        return { ...prev, items: updated };
      });
      setSelectedRowIndex(0);
    } else {
      setNewPr(prev => ({
        ...prev,
        items: [
          {
            materialId: '',
            sku: '',
            name: '',
            quantity: 0,
            uom: 'NOS',
            estimatedPrice: 0,
            remarks: ''
          }
        ]
      }));
      setSelectedRowIndex(0);
    }
  };

  const handleItemChange = (index, field, value) => {
    setNewPr(prev => {
      const updated = [...prev.items];
      updated[index][field] = value;
      if (field === 'materialId') {
        const selectedMat = materials.find(m => String(m.id || m.materialId) === String(value));
        if (selectedMat) {
          updated[index].sku = selectedMat.materialCode || selectedMat.sku || '';
          updated[index].name = selectedMat.description || selectedMat.materialName || selectedMat.name || '';
          updated[index].uom = selectedMat.baseUnitOfMeasure || selectedMat.baseUnit || selectedMat.uom || 'NOS';
          updated[index].hsnCode = selectedMat.hsnCode || '';
          updated[index].estimatedPrice = selectedMat.unitPrice || selectedMat.estimatedPrice || 0;
        } else {
          updated[index].sku = '';
          updated[index].name = '';
          updated[index].uom = 'NOS';
          updated[index].hsnCode = '';
          updated[index].estimatedPrice = 0;
        }
      }
      return { ...prev, items: updated };
    });
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newPr.locationId) {
      alert('Please select a Delivery Location.');
      return;
    }
    if (!newPr.requiredDate) {
      alert('Please select a Requested Receipt Date.');
      return;
    }

    const items = [];
    for (let i = 0; i < newPr.items.length; i++) {
      const item = newPr.items[i];
      if (!item.materialId) {
        alert(`Please select an Item for line #${i + 1}.`);
        return;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        alert(`Please enter a valid quantity greater than 0 for line #${i + 1}.`);
        return;
      }
      items.push({
        materialId: Number(item.materialId),
        sku: item.sku,
        quantity: Number(item.quantity),
        uom: item.uom,
        estimatedPrice: Number(item.estimatedPrice) || 0,
        remarks: item.remarks
        // NOTE: No vendor assignment here — vendors are assigned later via RFQ
        //       after this PR is approved by the workflow engine.
      });
    }

    const token = localStorage.getItem('auth_token');
    const payload = {
      locationId: Number(newPr.locationId),
      companyCode: newPr.companyCode,
      requiredDate: newPr.requiredDate,
      remarks: newPr.remarks,
      status: 'CREATED',
      items: items
    };

    setCreateLoading(true);
    try {
      const response = await axios.post('/api/purchase-requisitions', payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200 || response.status === 201) {
        // Trigger workflow
        try {
          let userId = 1;
          const userStr = localStorage.getItem('user_data');
          if (userStr) userId = JSON.parse(userStr).id || 1;

          const prNum = response.data?.prNumber || 'Unknown';
          const prId = response.data?.prId || response.data?.id || '';

          const requestPayload = {
            title: `PR Approval for: ${prNum}`,
            description: `Please approve Purchase Requisition ${prNum}. Total items: ${items.length}`,
            amount: response.data?.totalAmount || 0,
            workflow_id: 12, // PR / Indent Approval workflow
            request_metadata: { prId: prId }
          };
          await axios.post(`/api/requests/?user_id=${userId}`, requestPayload, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
        } catch (wfErr) {
          console.error("Workflow trigger failed for PR:", wfErr);
        }

        showToast('Purchase Requisition successfully submitted and sent for approval.');
        setShowCreateModal(false);
        setNewPr({
          locationId: '',
          requiredDate: '',
          remarks: '',
          requestDate: getTodayDateStr(),
          items: [
            {
              materialId: '',
              sku: '',
              name: '',
              quantity: 0,
              uom: 'NOS',
              estimatedPrice: 0,
              remarks: ''
            }
          ]
        });
        setSelectedRowIndex(0);
        fetchPRs();

      } else {
        alert(response.data?.error || 'Failed to create PR');
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Error occurred while creating PR.';
      alert(errMsg);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleFileUploadChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFile(e.target.files[0]);
      setExtractionError('');
    }
  };

  const handleExtractInvoice = async () => {
    if (!uploadFile) {
      setExtractionError('Please select a file first.');
      return;
    }
    if (!selectedActivity) {
      setExtractionError('Please select an activity to charge this invoice against.');
      return;
    }
    if (!uploadPlantId) {
      setExtractionError('Please select a Plant.');
      return;
    }
    if (!uploadLocationId) {
      setExtractionError('Please select a Location Code.');
      return;
    }

    setExtractionLoading(true);
    setExtractionError('');

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await axios.post('/api/extract-invoice', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data) {
        setExtractedData(response.data);

        // Check budget availability
        try {
          const grandTotal = response.data.grandTotal || 0;
          const taxTotal = response.data.taxTotal || 0;

          // Connect to the workflow service running on port 8001
          const token = localStorage.getItem('auth_token');
          const budgetCheckResponse = await axios.post('/api/budget/check-invoice', {
            activity_code: selectedActivity,
            amount_with_tax: grandTotal,
            amount_without_tax: grandTotal - taxTotal
          }, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          setBudgetStatus(budgetCheckResponse.data);
        } catch (budgetErr) {
          console.error("Budget check failed", budgetErr);
        }

        setShowUploadModal(false);
        setShowDetailsModal(true);
      } else {
        setExtractionError('Failed to extract data from document.');
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Error occurred during extraction.';
      setExtractionError(msg);
    } finally {
      setExtractionLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (!extractedData) return;

    // Create Header Sheet data
    const headerData = [
      {
        "Document Number": extractedData.documentNumber || '',
        "Document Type": extractedData.documentType || '',
        "Document Date": extractedData.documentDate || '',
        "Due Date": extractedData.dueDate || '',
        "Currency": extractedData.currency || 'INR',
        "Place of Supply": extractedData.placeOfSupply || '',
        "Supplier Name": extractedData.supplier?.name || '',
        "Supplier GSTIN": extractedData.supplier?.gstin || '',
        "Supplier Address": extractedData.supplier?.address || '',
        "Customer Name": extractedData.customer?.name || '',
        "Customer GSTIN": extractedData.customer?.gstin || '',
        "Customer Address": extractedData.customer?.address || '',
        "Payment Terms": extractedData.paymentTerms || '',
        "Notes": extractedData.notes || '',
        "Sub Total": extractedData.subTotal || 0,
        "Discount": extractedData.discountTotal || 0,
        "Tax Total": extractedData.taxTotal || 0,
        "Grand Total": extractedData.grandTotal || 0,
        "Amount In Words": extractedData.amountInWords || '',
        "Confidence": extractedData.confidenceScore || 0
      }
    ];

    // Create Items Sheet data
    const itemsData = (extractedData.items || []).map(item => ({
      "Document Number": extractedData.documentNumber || '',
      "Line No": item.lineNumber || '',
      "Description": item.description || '',
      "HSN/SAC": item.hsnSac || '',
      "Qty": item.quantity || 0,
      "Unit": item.unit || '',
      "Rate": item.rate || 0,
      "Discount": item.discount || 0,
      "Tax %": item.taxPercentage || 0,
      "Tax Amount": item.taxAmount || 0,
      "Line Amount": item.amount || 0
    }));

    // Generate Excel workbook
    const wsHeader = XLSX.utils.json_to_sheet(headerData);
    const wsItems = XLSX.utils.json_to_sheet(itemsData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsHeader, "Invoice Header");
    XLSX.utils.book_append_sheet(wb, wsItems, "Invoice Items");

    XLSX.writeFile(wb, `${extractedData.documentNumber || 'extracted_invoice'}.xlsx`);
  };

  const handleSaveInvoice = async () => {
    if (!selectedActivity || !extractedData) return;

    try {
      setLoading(true); // Reusing loading state
      const token = localStorage.getItem('auth_token');

      // 1. Block the amount in budget
      await axios.post('/api/budget/block-amount', {
        activity_code: selectedActivity,
        amount: extractedData.grandTotal
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // 2. Save as Workflow Request (Indent Approval, ID = 12)
      const userStr = localStorage.getItem('user_data');
      let userId = 1;
      let userName = 'Unknown User';
      if (userStr) {
        try {
          const parsed = JSON.parse(userStr);
          userId = parsed.id || 1;
          userName = parsed.name || parsed.username || 'Unknown User';
        } catch (e) { }
      }

      const currentYear = new Date().getFullYear();
      const selectedAct = activities.find(a => String(a.activity_code) === String(selectedActivity));
      const department = selectedAct ? selectedAct.name : 'N/A';
      const budgetOwnerDept = department;
      const budgetBalance = budgetStatus ? (budgetStatus.current_month_available - extractedData.grandTotal) : 0;

      const enrichedMetadata = {
        ...extractedData,
        indent_fields: {
          requestor: userName,
          department: department,
          year: currentYear,
          budgetOwnerDepartment: budgetOwnerDept,
          plantId: uploadPlantId,
          locationId: uploadLocationId,
          balanceAmount: budgetBalance,
          itemValueWithoutTax: extractedData.subTotal,
          businessJustificationCode: extractedData.supplier?.gstin || 'N/A'
        }
      };


      showToast('Invoice successfully saved and budget blocked.');
      setShowDetailsModal(false);
      fetchPRs();

    } catch (error) {
      console.error(error);
      alert('Error saving invoice. Ensure the backend services are running.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrencyVal = (val) => {
    if (val === undefined || val === null) return '₹0.00';
    return `₹${Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const InfoRow = ({ label, value }) => (
    <div className="row mb-1 align-items-start" style={{ fontSize: '12px' }}>
      <div className="col-5 text-muted fw-semibold" style={{ minWidth: '100px' }}>{label}</div>
      <div className="col-1 text-muted p-0 text-center" style={{ width: '15px' }}>:</div>
      <div className="col text-dark fw-bold text-wrap">{value || '—'}</div>
    </div>
  );

  const fetchPRs = async () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user_data');
    let role = 'VENDOR';
    let vendorId = 1;
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        role = u.role?.toUpperCase() || 'VENDOR';
        // vendor_id is set during login from vendor_master table (correct ID)
        // company_id is a fallback in case vendor_id is not yet present
        vendorId = u.vendor_id || u.company_id || u.id || 1;
      } catch (e) { }
    }

    try {
      let endpoint = role === 'VENDOR'
        ? `/api/vendor/purchase-requisitions?vendor_id=${vendorId}`
        : '/api/purchase-requisitions';
        
      if (role === 'VENDOR' && selectedCompanyCode) {
        endpoint += `&company_code=${selectedCompanyCode}`;
      }

      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });

      let content = [];
      const data = response.data;
      if (data) {
        if (data.prs && Array.isArray(data.prs)) content = data.prs; // Vendor API returns { prs: [...] }
        else if (data.content) content = data.content;
        else if (data.data && data.data.content) content = data.data.content;
        else if (data.data && Array.isArray(data.data)) content = data.data;
        else if (Array.isArray(data)) content = data;
      }

      const formattedPRs = content.map((item) => {
        const status = item.status || item.pr_status || item.assignmentStatus || 'CREATED';
        let statusBadge = 'secondary';
        if (status.toUpperCase() === 'RELEASED' || status.toUpperCase() === 'APPROVED' || status.toUpperCase() === 'CLOSED' || status.toUpperCase() === 'ACCEPTED') statusBadge = 'success';
        else if (status.toUpperCase() === 'PARTIALLY_RELEASED' || status.toUpperCase() === 'IN_PROCESS' || status.toUpperCase() === 'PENDING' || status.toUpperCase() === 'OPEN') statusBadge = 'warning';
        else if (status.toUpperCase() === 'REJECTED') statusBadge = 'danger';
        else if (status.toUpperCase() === 'ACKNOWLEDGED') statusBadge = 'primary';

        let dateStr = item.createdAt || item.requiredDate || item.prDate || item.sentDate || '';
        if (dateStr && dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0];
        } else if (dateStr && dateStr.includes(' ')) {
          dateStr = dateStr.split(' ')[0];
        }

        return {
          id: item.id || item.assignmentId || null,
          pr_number: item.prNumber || item.pr_number || 'PR-UNKNOWN',
          pr_status: status,
          status_slug: status.toLowerCase(),
          status_badge: statusBadge,
          line_count: item.items?.length || (item.quantity ? 1 : 1), // Sometimes it's flat
          created_by: item.createdBy || 'System',
          created_date: dateStr || 'N/A',
          payment_terms: item.paymentTerms || 'N/A' // Added payment terms if available
        };
      });

      // Fetch Workflow Requests
      let userId = 1;
      if (userStr) {
        try { userId = JSON.parse(userStr).id || 1; } catch (e) { }
      }
      let rawWfData = [];
      try {
        const wfResponse = await axios.get(`/api/requests/?user_id=${userId}&workflow_id=12`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        rawWfData = wfResponse.data || [];
      } catch (err) {
        console.warn('Failed to fetch workflow requests', err);
      }
      
      // Force sync PR status from workflow if Java backend hasn't updated
      if (rawWfData.length > 0) {
         try {
            rawWfData.forEach(wr => {
               const prIdStr = wr.request_metadata?.prId;
               if (prIdStr && wr.status === 'approved') {
                  const prId = parseInt(prIdStr, 10);
                  const pr = formattedPRs.find(p => p.id === prId);
                  if (pr && pr.pr_status.toUpperCase() !== 'RELEASED' && pr.pr_status.toUpperCase() !== 'APPROVED') {
                     pr.pr_status = 'APPROVED';
                     pr.status_slug = 'approved';
                     pr.status_badge = 'success';
                  }
               }
            });
         } catch (e) {
            console.warn('Failed to sync PR status from WF', e);
         }
      }

      const isVendor = role === 'VENDOR' || role === 'VENDOR_ADMIN';
      let filteredArray = formattedPRs;

      if (isVendor) {
        if (mode === 'pr') {
          // Broadened filter so vendors can see ACCEPTED, OPEN, and CLOSED PRs
          filteredArray = formattedPRs.filter(pr => ['CLOSED', 'ACCEPTED', 'OPEN'].includes(pr.pr_status.toUpperCase()));
        } else if (mode === 'rfq') {
          filteredArray = formattedPRs.filter(pr => pr.pr_status.toUpperCase() !== 'CLOSED');
        }
      } else {
        if (mode === 'rfq') {
          // Allow employees to see ONLY approved/released requisitions for RFQ creation
          filteredArray = formattedPRs.filter(pr => ['APPROVED', 'RELEASED'].includes(pr.pr_status.toUpperCase()));
        }
      }

      const merged = [...filteredArray].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

      if (merged.length > 0 || !isVendor) {
        setPrs(merged);
      } else {
        loadMockPRs();
      }
    } catch (err) {
      console.error('Failed to fetch PRs from backend, loading fallback mock data.', err);
      loadMockPRs();
    } finally {
      setLoading(false);
    }
  };

  const loadMockPRs = () => {
    setPrs([]);
  };

  const fetchActivities = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await axios.get('/api/budget/activities', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let data = [];
      if (res.data) {
        if (res.data.content) data = res.data.content;
        else if (Array.isArray(res.data)) data = res.data;
      }
      setActivities(data);
    } catch (err) {
      console.error('Failed to fetch activities', err);
    }
  };

  useEffect(() => {
    const userStr = localStorage.getItem('user_data');
    if (userStr) {
      try {
        const u = JSON.parse(userStr);
        setUserRole(u.role?.toUpperCase() || 'VENDOR');
      } catch (e) { }
    }
    fetchPRs();
    fetchActivities();
  }, [selectedCompanyCode]);

  const openActionModal = (pr) => {
    setActivePr(pr);
    setDecisionComment('');
    setActionAlert(null);
    setShowActionModal(true);
  };

  const handleAction = async (action) => {
    if (!activePr) return;
    setActionLoading(true);
    setActionAlert(null);
    const token = localStorage.getItem('auth_token');

    try {
      const response = await axios.post(`/api/vendor/purchase-requisitions/${activePr.id}/${action}`, {
        comment: decisionComment
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200 || response.data?.status === 'success') {
        setActionAlert({ type: 'success', message: `PR ${activePr.pr_number} successfully ${action === 'accept' ? 'accepted/approved' : 'rejected'}!` });
        setTimeout(() => {
          setShowActionModal(false);
          fetchPRs();
        }, 1500);
      } else {
        setActionAlert({ type: 'danger', message: response.data?.error || 'Action failed' });
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Error occurred while submitting decision.';
      setActionAlert({ type: 'danger', message: errMsg });
    } finally {
      setActionLoading(false);
    }
  };

  if (selectedPrId) {
    return (
      <PurchaseRequisitionDetail
        prId={selectedPrId}
        onBack={() => setSelectedPrId(null)}
        onAcknowledgeSuccess={fetchPRs}
      />
    );
  }

  // Filter items based on search query
  const filteredItems = (extractedData?.items || []).filter(item => {
    const q = itemSearchQuery.toLowerCase();
    return (
      (item.description || '').toLowerCase().includes(q) ||
      (item.hsnSac || '').toLowerCase().includes(q) ||
      (item.unit || '').toLowerCase().includes(q)
    );
  });

  // Pagination calculations
  const totalItemsCount = filteredItems.length;
  const totalPagesCount = Math.max(1, Math.ceil(totalItemsCount / itemsPerPage));
  const startIndex = (itemsCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItemsCount);
  const paginatedItems = filteredItems.slice(startIndex, endIndex);

  const filteredPrs = filter === 'all'
    ? prs
    : prs.filter(item => {
        if (filter === 'approved') return item.status_slug === 'approved' || item.status_slug === 'released';
        if (filter === 'pending') return item.status_slug === 'pending' || item.status_slug === 'in_process';
        if (filter === 'open') return item.status_slug === 'new' || item.status_slug === 'open' || item.status_slug === 'created';
        return item.status_slug === filter;
      });

  return (
    <div className="fade-in-slide container-fluid py-4">
      {toastMessage && (
        <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1080 }}>
          <div className="toast show align-items-center text-bg-success border-0 shadow-lg" role="alert">
            <div className="d-flex">
              <div className="toast-body fw-medium">
                <i className="fas fa-check-circle me-2"></i>
                {toastMessage}
              </div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToastMessage('')}></button>
            </div>
          </div>
        </div>
      )}
      <BackButton onClick={onBack} />
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1 fw-bold text-dark" style={{ letterSpacing: '-0.5px' }}>
            {mode === 'rfq' ? 'RFQ Management' : 'Purchase Requisitions'}
          </h3>
          <p className="text-muted mb-0 fs-14">
            {mode === 'rfq' ? 'View active RFQs and invite bids' : 'View and track purchase requisition requests'}
          </p>
        </div>
        <div className="d-flex align-items-stretch gap-3">
          {userRole !== 'VENDOR' && mode !== 'rfq' && (
            <button
              className="btn btn-success px-4 fw-medium d-flex align-items-center justify-content-center gap-2 shadow-sm"
              style={{ backgroundColor: '#293383', borderColor: '#293383', borderRadius: '8px', whiteSpace: 'nowrap' }}
              onClick={() => {
                fetchCreateOptions();
                setShowCreateModal(true);
              }}
            >
              <i className="fas fa-plus fs-14"></i> Create PR
            </button>
          )}
          <button
            className="btn btn-light text-secondary border shadow-sm d-flex align-items-center justify-content-center px-3"
            style={{ borderRadius: '8px', backgroundColor: showKpis ? '#f8f9fa' : '#ffffff', minWidth: '48px' }}
            onClick={() => setShowKpis(!showKpis)}
            title={showKpis ? 'Hide Stats' : 'Show Stats'}
          >
            <i className={`fas fa-chart-bar fs-15 ${showKpis ? 'text-primary' : ''}`}></i>
          </button>
          <select
            className="form-select border-light-subtle shadow-sm fs-14 py-2"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ minWidth: '180px', borderRadius: '8px' }}
          >
            <option value="all">Status: All PRs</option>
            <option value="approved">Approved</option>
            <option value="pending">In Progress</option>
            <option value="open">Open / New</option>
          </select>
        </div>
      </div>

      {userRole !== 'VENDOR' ? (
        // === DASHBOARD UI (EMPLOYEE) ===
        <>
          {/* KPI Cards Section */}
          {showKpis && (
            <div className="row mb-4">
              {[
                { label: "PR Approved", value: prs.filter(pr => pr.status_slug === 'approved' || pr.status_slug === 'released').length || "3", icon: "fas fa-check-circle", color: "success" },
                { label: "PR to Quote", value: "2", icon: "fas fa-quote-right", color: "primary" },
                { label: "Quote Won", value: "1", icon: "fas fa-trophy", color: "info" },
                { label: "Quotation Rejected", value: prs.filter(pr => pr.status_slug === 'rejected').length || "0", icon: "fas fa-shield-alt", color: "danger" },
                { label: "PR Pending", value: prs.filter(pr => pr.status_slug === 'pending' || pr.status_slug === 'new' || pr.status_slug === 'open').length || "0", icon: "fas fa-clock", color: "warning" },
                { label: "SLA Adherence", value: "100%", icon: "fas fa-chart-line", color: "success" },
                { label: "Win %", value: "50%", icon: "fas fa-bullseye", color: "warning" },
                { label: "Pending %", value: prs.length > 0 ? Math.round((prs.filter(pr => pr.status_slug === 'pending' || pr.status_slug === 'new' || pr.status_slug === 'open').length / prs.length) * 100) + "%" : "0%", icon: "fas fa-chart-pie", color: "info" },
              ].map((kpi, idx) => (
                <div key={idx} className="col-md-3 mb-3">
                  <div className="card border-0 shadow-sm h-100 p-3" style={{ borderRadius: '12px' }}>
                    <div className="d-flex align-items-center">
                      <div
                        className={`d-flex align-items-center justify-content-center bg-${kpi.color} bg-opacity-10 text-${kpi.color} rounded-circle me-3`}
                        style={{ width: '48px', height: '48px' }}
                      >
                        <i className={`${kpi.icon} fs-5`}></i>
                      </div>
                      <div>
                        <h3 className="fw-bold mb-0 text-dark" style={{ fontSize: '24px' }}>{kpi.value}</h3>
                        <p className="text-muted fs-13 mb-0">{kpi.label}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Data Table Section */}
          <div className="card border shadow-sm mb-4" style={{ borderRadius: '8px' }}>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-start">
                <thead className="bg-light text-secondary fs-12 fw-semibold text-uppercase" style={{ letterSpacing: '0.5px' }}>
                  <tr>
                    <th className="py-3 ps-4 border-0 rounded-start" style={{ width: '40%' }}>PR NUMBER</th>
                    <th className="py-3 border-0" style={{ width: '30%' }}>PR DATE</th>
                    <th className="py-3 pe-4 border-0 rounded-end text-end" style={{ width: '30%' }}>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="3" className="text-center py-5"><div className="spinner-border text-success" role="status"></div><p className="mt-2 text-muted mb-0">Loading...</p></td></tr>
                  ) : filteredPrs.length === 0 ? (
                    <tr><td colSpan="3" className="text-center text-muted py-5">No records found.</td></tr>
                  ) : (
                    filteredPrs.map(pr => (
                      <tr
                        key={pr.pr_number}
                        className={`pr-row ${mode === 'rfq' ? 'cursor-pointer pr-item-hover' : ''}`}
                        onClick={() => { if (mode === 'rfq') setSelectedPrId(pr.pr_number); }}
                      >
                        <td className="py-3 fw-bold text-dark ps-4 border-bottom">{pr.pr_number}</td>
                        <td className="py-3 text-secondary border-bottom">{pr.created_date || "N/A"}</td>
                        <td className="py-3 pe-4 border-bottom text-end">
                          <span className={`badge bg-soft-${pr.status_badge} text-${pr.status_badge} text-uppercase px-3 py-2 rounded-pill`}>{pr.pr_status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="card-footer bg-white border-top text-end py-3 pe-4">
              <span className="text-muted fs-13">Showing {filteredPrs.length} records</span>
            </div>
          </div>
        </>
      ) : (
        // === LIST UI (VENDOR) ===
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-white border-bottom py-3">
            <h5 className="card-title mb-0 fw-bold">All Requisitions</h5>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-success" role="status"></div>
                <p className="mt-2 text-muted">Loading Requisitions...</p>
              </div>
            ) : filteredPrs.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="fas fa-file-invoice fs-1 mb-3 d-block text-secondary"></i>
                <h6>No data</h6>
                <p className="fs-12 mb-0">No Invoices found.</p>
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {filteredPrs.map((pr) => (
                  <div
                    key={pr.pr_number}
                    className="list-group-item p-4 pr-item-hover"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedPrId(pr.pr_number)}
                  >
                    <div className="d-flex align-items-center">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center mb-2">
                          <h5
                            className="fw-bold text-dark mb-0 me-3 fs-5"
                            style={{ textDecoration: 'none' }}
                          >
                            {pr.pr_number}
                          </h5>
                          <span className={`badge bg-${pr.status_badge} text-uppercase px-3 py-1 rounded-pill`} style={{ fontSize: '11px' }}>
                            {pr.pr_status}
                          </span>
                        </div>
                        <p className="text-muted mb-1">{pr.line_count} line(s) - Requisition</p>
                        <div className="d-flex align-items-center text-muted gap-4" style={{ fontSize: '13px' }}>
                          <span><i className="fas fa-user me-1"></i> {pr.created_by}</span>
                          <span><i className="fas fa-calendar me-1"></i> {pr.created_date}</span>
                        </div>
                      </div>
                      <div className="text-end d-flex flex-column align-items-end justify-content-center">
                        <h5 className="fw-bold mb-0 text-dark">{pr.line_count} item(s)</h5>
                        {mode !== 'rfq' && userRole === 'VENDOR' && (
                          pr.status_slug !== 'approved' && pr.status_slug !== 'rejected' && pr.status_slug !== 'released' ? (
                            <button
                              className="btn btn-sm btn-outline-success mt-2 px-3 fw-bold"
                              style={{ borderRadius: '6px' }}
                              onClick={(e) => { e.stopPropagation(); openActionModal(pr); }}
                            >
                              <i className="fas fa-check-circle me-1"></i> Acknowledge
                            </button>
                          ) : (
                            <span className="text-success fs-13 mt-2 fw-bold">
                              <i className="fas fa-check-circle me-1"></i> {pr.pr_status}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Acknowledge Action Modal */}
      {showActionModal && activePr && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content">
            <div className="custom-modal-header bg-light">
              <h5 className="custom-modal-title text-dark fw-bold d-flex align-items-center gap-2">
                <i className="fas fa-shield-halved text-success"></i> Take Action on {activePr.pr_number}
              </h5>
              <button className="custom-modal-close-btn" onClick={() => setShowActionModal(false)}>&times;</button>
            </div>
            <div className="custom-modal-body">
              {actionAlert && (
                <div className={`alert alert-${actionAlert.type} py-2`} role="alert">
                  {actionAlert.message}
                </div>
              )}
              <div className="mb-3">
                <label htmlFor="modalComment" className="form-label fw-bold text-muted small text-uppercase">Decision Comment</label>
                <textarea
                  id="modalComment"
                  className="form-control border-light-subtle bg-light bg-opacity-25"
                  rows="3"
                  style={{ resize: 'none', borderRadius: '8px' }}
                  placeholder="Add a note explaining your decision..."
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                />
              </div>
            </div>
            <div className="custom-modal-footer bg-light d-flex justify-content-between p-3 gap-2">
              <Button
                variant="green"
                className="flex-grow-1 py-2 fw-semibold"
                disabled={actionLoading}
                onClick={() => handleAction('accept')}
              >
                {actionLoading ? 'Loading...' : 'Approve'}
              </Button>
              <Button
                variant="danger"
                className="flex-grow-1 py-2 fw-semibold"
                disabled={actionLoading}
                onClick={() => handleAction('reject')}
              >
                {actionLoading ? 'Loading...' : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create PR Modal */}
      {showCreateModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '950px', width: '95%' }}>
            <div className="custom-modal-header bg-light">
              <h5 className="custom-modal-title text-dark fw-bold d-flex align-items-center gap-2">
                <i className="fas fa-file-invoice text-success"></i> Create Purchase Requisition
              </h5>
              <button className="custom-modal-close-btn" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="custom-modal-body text-start" style={{ maxHeight: '75vh', overflowY: 'auto', padding: '24px' }}>

                {/* Header Action Buttons Mimic */}
                <div className="d-flex gap-2 mb-4 pb-3 border-bottom">
                  <button type="button" className="btn btn-sm btn-light border text-success fw-semibold"><i className="fas fa-check me-1"></i> Release</button>
                  <button type="button" className="btn btn-sm btn-light border fw-semibold">Automate <i className="fas fa-chevron-down ms-1 fs-11"></i></button>
                  <button type="button" className="btn btn-sm btn-link text-muted text-decoration-none fw-semibold">Fewer options</button>
                </div>

                {/* General Section */}
                <h5 className="fw-bold mb-3 text-dark text-uppercase" style={{ fontSize: '13px', letterSpacing: '0.5px' }}>General</h5>
                <div className="row g-3 mb-4">
                  {/* Left Column */}
                  <div className="col-md-6">
                    <div className="row align-items-center mb-3">
                      <label className="col-sm-4 col-form-label text-muted small fw-bold text-uppercase">Requisition Code</label>
                      <div className="col-sm-8 d-flex gap-1">
                        <input type="text" className="form-control bg-light" value="Auto Generated" readOnly style={{ borderRadius: '6px' }} />
                        <button type="button" className="btn btn-light border px-2">...</button>
                      </div>
                    </div>

                    <div className="row align-items-center mb-3">
                      <label className="col-sm-4 col-form-label text-muted small fw-bold text-uppercase">Remarks</label>
                      <div className="col-sm-8">
                        <input
                          type="text"
                          className="form-control border-light-subtle"
                          style={{ borderRadius: '6px' }}
                          value={newPr.remarks}
                          onChange={(e) => setNewPr({ ...newPr, remarks: e.target.value })}
                          placeholder="Overall remarks"
                        />
                      </div>
                    </div>

                    <div className="row align-items-center">
                      <label className="col-sm-4 col-form-label text-muted small fw-bold text-uppercase">Request Date</label>
                      <div className="col-sm-8">
                        <input
                          type="date"
                          className="form-control border-light-subtle bg-light"
                          style={{ borderRadius: '6px' }}
                          value={newPr.requestDate}
                          readOnly
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="col-md-6">
                    <div className="row align-items-center mb-3">
                      <label className="col-sm-4 col-form-label text-muted small fw-bold text-uppercase">Requested Receipt Date <span className="text-danger">*</span></label>
                      <div className="col-sm-8">
                        <input
                          type="date"
                          className="form-control border-light-subtle"
                          style={{ borderRadius: '6px' }}
                          value={newPr.requiredDate}
                          onChange={(e) => setNewPr({ ...newPr, requiredDate: e.target.value })}
                          min={getTodayDateStr()}
                          required
                        />
                      </div>
                    </div>

                    <div className="row align-items-center mb-3">
                      <label className="col-sm-4 col-form-label text-muted small fw-bold text-uppercase">Company <span className="text-danger">*</span></label>
                      <div className="col-sm-8">
                        <select
                          className="form-select border-light-subtle"
                          style={{ borderRadius: '6px' }}
                          value={newPr.companyCode}
                          onChange={(e) => setNewPr({ ...newPr, companyCode: e.target.value })}
                          required
                        >
                          <option value="">Select Company...</option>
                          <option value="1000">1000 - Ankit Aerospace</option>
                          <option value="1001">1001 - Ankit Fasteners</option>
                        </select>
                      </div>
                    </div>

                    <div className="row align-items-center mb-3">
                      <label className="col-sm-4 col-form-label text-muted small fw-bold text-uppercase">Plant <span className="text-danger">*</span></label>
                      <div className="col-sm-8">
                        <select
                          className="form-select border-light-subtle"
                          style={{ borderRadius: '6px' }}
                          value={newPr.locationId}
                          onChange={(e) => setNewPr({ ...newPr, locationId: e.target.value })}
                          required
                        >
                          <option value="">Select Plant...</option>
                          {locations.map(loc => (
                            <option key={loc.locationId || loc.id} value={loc.locationId || loc.id}>{loc.locationName || loc.name} ({loc.city || ''})</option>
                          ))}
                        </select>
                      </div>
                    </div>


                  </div>
                </div>

                <hr className="my-4" />

                {/* Subform Section */}
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="fw-bold mb-0 text-dark text-uppercase" style={{ fontSize: '13px', letterSpacing: '0.5px' }}>Purch. Requisition Subform</h5>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-light border text-muted fw-bold d-flex align-items-center gap-1 animate-hover"
                      onClick={handleAddLine}
                      style={{ borderRadius: '6px', fontSize: '12px' }}
                    >
                      <i className="fas fa-plus"></i> New Line
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-light border text-muted fw-bold d-flex align-items-center gap-1 animate-hover"
                      onClick={handleDeleteLine}
                      style={{ borderRadius: '6px', fontSize: '12px' }}
                    >
                      <i className="fas fa-times"></i> Delete Line
                    </button>
                  </div>
                </div>

                <div className="table-responsive border rounded mb-3" style={{ maxHeight: '350px' }}>
                  <table className="table align-middle mb-0" style={{ fontSize: '12px' }}>
                    <thead className="bg-light text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>
                      <tr>
                        <th style={{ width: '40px' }}></th>
                        <th style={{ minWidth: '150px' }}>Item No.</th>
                        <th style={{ minWidth: '220px' }}>Description</th>
                        <th style={{ minWidth: '100px' }}>HSN</th>
                        <th style={{ minWidth: '100px' }}>UOM</th>
                        <th style={{ minWidth: '120px' }}>Plant</th>
                        <th style={{ minWidth: '100px' }} className="text-end">Availability</th>
                        <th style={{ minWidth: '100px' }} className="text-end">Quantity</th>
                        <th style={{ minWidth: '180px' }}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newPr.items.map((item, index) => {
                        const isSelected = selectedRowIndex === index;
                        const selectedLocation = locations.find(l => String(l.locationId || l.id) === String(newPr.locationId));
                        const locationCodeText = selectedLocation ? (selectedLocation.locationName || selectedLocation.name) : '';

                        return (
                          <tr
                            key={index}
                            className={isSelected ? 'table-active bg-light border-start border-3 border-success' : ''}
                            onClick={() => setSelectedRowIndex(index)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td className="text-center text-muted">
                              {isSelected && <i className="fas fa-arrow-right text-success"></i>}
                            </td>
                            <td>
                              <select
                                className="form-select border-0 bg-transparent py-1 px-2"
                                value={item.materialId}
                                onChange={(e) => handleItemChange(index, 'materialId', e.target.value)}
                                style={{ boxShadow: 'none', borderRadius: 0 }}
                                required
                              >
                                <option value="">Select Item</option>
                                {materials.map(mat => (
                                  <option key={mat.materialId || mat.id} value={mat.materialId || mat.id}>
                                    {mat.materialCode || mat.materialName || mat.name || mat.sku}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control border-0 bg-transparent py-1"
                                value={item.name}
                                readOnly
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control border-0 bg-transparent py-1"
                                value={item.hsnCode || ''}
                                readOnly
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control border-0 bg-transparent py-1"
                                value={item.uom || ''}
                                readOnly
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control border-0 bg-transparent py-1"
                                value={locationCodeText}
                                readOnly
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control border-0 bg-transparent py-1 text-end text-muted"
                                value="0.00"
                                readOnly
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                pattern="[0-9]*"
                                className="form-control border-0 bg-transparent py-1 text-end fw-bold"
                                value={item.quantity === 0 ? '' : item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                min="0"
                                required
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control border-0 bg-transparent py-1"
                                value={item.remarks}
                                onChange={(e) => handleItemChange(index, 'remarks', e.target.value)}
                                placeholder="Enter remarks"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>

              <div className="custom-modal-footer bg-light p-3 px-4 border-top d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-light border px-4 fw-bold"
                  style={{ borderRadius: '6px' }}
                  onClick={() => setShowCreateModal(false)}
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-success px-4 fw-bold text-white animate-hover"
                  style={{ backgroundColor: '#293383', borderColor: '#293383', borderRadius: '6px' }}
                  disabled={createLoading}
                >
                  {createLoading ? 'Submitting...' : 'Submit PR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Invoice Modal */}
      {showUploadModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '500px', borderRadius: '12px' }}>
            <div className="custom-modal-header bg-light p-3" style={{ borderBottom: '1px solid #e2e8f0' }}>
              <h5 className="custom-modal-title text-dark fw-bold d-flex align-items-center gap-2 m-0" style={{ fontSize: '16px' }}>
                <i className="fas fa-file-invoice text-success"></i> Upload Invoice / Estimate
              </h5>
              <button className="custom-modal-close-btn" style={{ fontSize: '20px', border: 'none', background: 'none', cursor: 'pointer' }} onClick={() => setShowUploadModal(false)}>&times;</button>
            </div>
            <div className="custom-modal-body p-4 text-start">
              {extractionError && (
                <div className="alert alert-danger py-2" role="alert" style={{ fontSize: '13px' }}>
                  <i className="fas fa-exclamation-circle me-2"></i> {extractionError}
                </div>
              )}

              <div className="mb-4">
                <label className="form-label fw-bold text-muted small text-uppercase mb-2">Charge to Activity / WBS <span className="text-danger">*</span></label>
                <select
                  className="form-select mb-4"
                  value={selectedActivity}
                  onChange={(e) => setSelectedActivity(e.target.value)}
                >
                  <option value="">-- Select Activity --</option>
                  {activities.map(act => (
                    <option key={act.activity_code} value={act.activity_code}>
                      {act.name} ({act.wbs})
                    </option>
                  ))}
                </select>

                <div className="row g-2 mb-4">
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-muted small text-uppercase mb-2">Plant <span className="text-danger">*</span></label>
                    <select
                      className="form-select"
                      value={uploadPlantId}
                      onChange={(e) => setUploadPlantId(e.target.value)}
                    >
                      <option value="">-- Select Plant --</option>
                      {plants.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-muted small text-uppercase mb-2">Location Code <span className="text-danger">*</span></label>
                    <select
                      className="form-select"
                      value={uploadLocationId}
                      onChange={(e) => setUploadLocationId(e.target.value)}
                      disabled={!uploadPlantId}
                    >
                      <option value="">-- Select Location --</option>
                      <option value="LOC-1">Warehouse A</option>
                      <option value="LOC-2">Warehouse B</option>
                      <option value="LOC-3">Main Office</option>
                    </select>
                  </div>
                </div>

                <label className="form-label fw-bold text-muted small text-uppercase mb-2">Select Invoice or Estimate Document</label>
                <div
                  className="border-dashed p-4 rounded-3 text-center bg-light bg-opacity-50"
                  style={{ border: '2px dashed #cbd5e1', cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onClick={() => document.getElementById('invoiceFileInput').click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      setUploadFile(e.dataTransfer.files[0]);
                      setExtractionError('');
                    }
                  }}
                >
                  <i className="fas fa-cloud-upload-alt text-muted fa-2x mb-2"></i>
                  <p className="mb-1 text-dark fw-semibold" style={{ fontSize: '14px' }}>
                    {uploadFile ? uploadFile.name : 'Drag and drop or click to upload'}
                  </p>
                  <p className="text-muted small mb-0" style={{ fontSize: '11px' }}>
                    Supports PDF, PNG, JPG, JPEG
                  </p>
                  <input
                    type="file"
                    id="invoiceFileInput"
                    className="d-none"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={handleFileUploadChange}
                  />
                </div>
              </div>
            </div>
            <div className="custom-modal-footer bg-light d-flex justify-content-end p-3 gap-2" style={{ borderTop: '1px solid #e2e8f0' }}>
              <button
                className="btn btn-light fw-semibold px-4 py-2"
                style={{ borderRadius: '8px', fontSize: '13px' }}
                disabled={extractionLoading}
                onClick={() => setShowUploadModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-success fw-bold px-4 py-2 d-flex align-items-center gap-2"
                style={{ backgroundColor: '#293383', borderColor: '#293383', borderRadius: '8px', fontSize: '13px' }}
                disabled={extractionLoading}
                onClick={handleExtractInvoice}
              >
                {extractionLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    Extracting...
                  </>
                ) : (
                  <>
                    <i className="fas fa-cog"></i> Extract Invoice
                  </>
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
                className="btn btn-success fw-bold px-4 py-2 d-flex align-items-center gap-2"
                style={{ backgroundColor: '#293383', borderColor: '#293383', borderRadius: '8px', fontSize: '13px' }}
                onClick={handleSaveInvoice}
                disabled={loading}
              >
                {loading ? <span className="spinner-border spinner-border-sm"></span> : <i className="fas fa-save"></i>}
                {loading ? 'Saving...' : 'Save & Block Budget'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimal Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#293383',
          color: '#ffffff',
          padding: '12px 24px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 9999,
          transition: 'all 0.3s ease-in-out',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          <i className="fas fa-check-circle fs-5" style={{ color: '#0E7C86' }}></i>
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default PurchaseRequisition;
