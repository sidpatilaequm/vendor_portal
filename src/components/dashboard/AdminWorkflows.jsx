import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from '../common/Button';
import SecureDocumentViewer from '../common/SecureDocumentViewer';
import BackButton from '../common/BackButton';

const AdminWorkflows = ({ subTab = 'wf_dashboard', onNavigate }) => {
  const currentUserInfo = JSON.parse(localStorage.getItem('user_data') || '{"userId": 1, "firstName": "Admin", "lastName": "User", "email": "admin@company.com", "role": "admin"}');
  const userRole = String(currentUserInfo?.role || '').toUpperCase();
  const isEmployee = (userRole === 'EMPLOYEE' || userRole === 'PURCHASE_DEPT' || userRole === 'SUBMITTER' || userRole === 'APPROVER');

  const currentTab = isEmployee ? 'wf_requests' : (subTab.startsWith('wf_') ? subTab : `wf_${subTab}`);

  const [loading, setLoading] = useState(false);
  const [workflows, setWorkflows] = useState([]);
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);

  // Modals & form states
  const [showWfModal, setShowWfModal] = useState(false);
  const [editingWfId, setEditingWfId] = useState(null);
  const [wfName, setWfName] = useState('');
  const [wfDesc, setWfDesc] = useState('');
  const [wfType, setWfType] = useState('approval');
  const [wfNotif, setWfNotif] = useState('email');
  const [wfRejectBehavior, setWfRejectBehavior] = useState('stop');
  const [wfEscalateHours, setWfEscalateHours] = useState(24);
  const [wfThreshold, setWfThreshold] = useState('');
  const [wfConditions, setWfConditions] = useState('');
  const [wfStages, setWfStages] = useState([]);

  // Request modal states
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqWfId, setReqWfId] = useState('');
  const [reqEntity, setReqEntity] = useState('');
  const [reqAmount, setReqAmount] = useState('');
  const [reqContext, setReqContext] = useState('');

  // Group modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [activeGroupMemberSearch, setActiveGroupMemberSearch] = useState({});

  // Request Details Modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewDetails, setReviewDetails] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [actionComment, setActionComment] = useState('');
  const [actionError, setActionError] = useState('');
  // Per-company document type picks, e.g. { '1000': ['ZNB', 'ZSC'], '2000': ['ZFNB'] } — replaces
  // the old flat vendorCategory (Product/Service/Scheduling agreement/Sub-contracting) pick.
  const VENDOR_COMPANY_CODES = ['1000', '2000'];
  // Document type classification -> the "Vendor Type" label shown next to its code (e.g.
  // "Product(NB)"). UNCLASSIFIED codes (no real-world label yet) just show the bare code.
  const VENDOR_TYPE_LABELS = {
    PRODUCTS: 'Product',
    CAPITAL_EXPENDITURE: 'Capital Expenditure',
    SUBCONTRACTING: 'Subcontracting',
    RAW_MATERIAL: 'Raw Material',
    SCHEDULING_AGREEMENT: 'Scheduling Agreement',
    SERVICE: 'Service',
  };
  const vendorTypeLabel = (classification) => VENDOR_TYPE_LABELS[classification] || null;
  const [vendorDocTypeMenu, setVendorDocTypeMenu] = useState({}); // companyCode -> [{code, description, classification}]
  const [companyNames, setCompanyNames] = useState({}); // companyCode -> companyName
  const companyLabel = (cc) => companyNames[cc] || cc;
  const [vendorDocTypeChoice, setVendorDocTypeChoice] = useState({});
  const [vendorCategoryError, setVendorCategoryError] = useState('');
  const [decidingCategory, setDecidingCategory] = useState(false);
  
  // Requests Filter state
  const [requestFilter, setRequestFilter] = useState('pending');

  // Email Action processing states
  const [emailToken, setEmailToken] = useState('');
  const [emailProcessingState, setEmailProcessingState] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [emailActionResult, setEmailActionResult] = useState(null);
  const [emailActionError, setEmailActionError] = useState('');

  // Settings / OOO states
  const [oooUntil, setOooUntil] = useState('');
  const [delegateId, setDelegateId] = useState('');
  const [savingOoo, setSavingOoo] = useState(false);
  const [saToEmails, setSaToEmails] = useState('');
  const [saSubject, setSaSubject] = useState('');
  const [saMessage, setSaMessage] = useState('');
  const [saContext, setSaContext] = useState('');
  const [saInterval, setSaInterval] = useState('');
  const [saMaxReminders, setSaMaxReminders] = useState('');
  const [activeBroadcasts, setActiveBroadcasts] = useState([]);

  // Retrieve current user details
  const currentUser = JSON.parse(localStorage.getItem('user_data') || '{"userId": 1, "firstName": "Admin", "lastName": "User", "email": "admin@company.com", "role": "admin"}');
  // LoginResponse serializes the logged-in user's id as `userId`, not `id` — see AuthController.java.
  const userId = currentUser.userId || 1;

  // Mock Fallbacks
  const mockWorkflows = [
    {
      id: 101,
      name: 'Vendor Onboarding Verification',
      description: 'Triggered when a new vendor submits compliance and registration documents.',
      type: 'approval',
      is_active: true,
      notification_channel: 'email',
      rejection_behavior: 'stop',
      escalation_hours: 24,
      updated_at: new Date().toISOString(),
      stages: [
        { name: 'Compliance Review', type: 'approval', approver_group_id: 201, voting_rule: 'any', sla_hours: 48, is_optional: false, instructions: 'Verify PAN, GST and bank details.' },
        { name: 'Procurement Signoff', type: 'signature', approver_group_id: 202, voting_rule: 'all', sla_hours: 24, is_optional: false, instructions: 'Confirm alignment with business requirements.' }
      ]
    },
    {
      id: 102,
      name: 'Purchase Requisition SLA Flow',
      description: 'Standard multi-stage review for internal PR requests above threshold.',
      type: 'approval',
      is_active: true,
      notification_channel: 'email',
      rejection_behavior: 'stop',
      escalation_hours: 12,
      updated_at: new Date().toISOString(),
      stages: [
        { name: 'Finance Audit', type: 'approval', approver_group_id: 203, voting_rule: 'any', sla_hours: 24, is_optional: false, instructions: 'Review budget allocations.' }
      ]
    }
  ];

  const mockGroups = [
    {
      id: 201,
      name: 'Compliance Auditors',
      role: 'Verify legal documents',
      members: [
        { id: 2, name: 'Sarah Connor', email: 'sarah.c@company.com', sequential_order: 1 },
        { id: 3, name: 'John Smith', email: 'john.smith@company.com', sequential_order: 2 }
      ]
    },
    {
      id: 202,
      name: 'Procurement Heads',
      role: 'Authorize final vendor onboarding',
      members: [
        { id: 4, name: 'David Miller', email: 'david.m@company.com', sequential_order: 1 },
        { id: 5, name: 'Karan Prasad', email: 'karan.p@company.com', sequential_order: 1 }
      ]
    },
    {
      id: 203,
      name: 'Finance Approvers',
      role: 'Budget audit and allocation checks',
      members: [
        { id: 6, name: 'Elena Rostova', email: 'elena.r@company.com', sequential_order: 1 }
      ]
    }
  ];

  const mockUsers = [
    { id: 1, firstName: 'Admin', lastName: 'User', email: 'admin@company.com', role: 'admin' },
    { id: 2, firstName: 'Sarah', lastName: 'Connor', email: 'sarah.c@company.com', role: 'auditor' },
    { id: 3, firstName: 'John', lastName: 'Smith', email: 'john.smith@company.com', role: 'auditor' },
    { id: 4, firstName: 'David', lastName: 'Miller', email: 'david.m@company.com', role: 'procurement' },
    { id: 5, firstName: 'Karan', lastName: 'Prasad', email: 'karan.p@company.com', role: 'procurement' },
    { id: 6, firstName: 'Elena', lastName: 'Rostova', email: 'elena.r@company.com', role: 'finance' }
  ];

  const mockRequests = [
    {
      id: 4001,
      title: 'Stellar Forgings Pvt Ltd Onboarding',
      workflow_name: 'Vendor Onboarding Verification',
      workflow_id: 101,
      entity_details: 'Stellar Forgings Pvt Ltd (Supplier Onboarding)',
      current_stage: 0,
      status: 'pending',
      pending_group_name: 'Compliance Auditors',
      submitted_at: new Date(Date.now() - 4 * 3600000).toISOString(),
      history: [
        { user_name: 'System Engine', action: 'initiated', comment: 'Onboarding request created.', created_at: new Date(Date.now() - 4 * 3600000).toISOString() }
      ],
      stages: [
        { name: 'Compliance Review', approver_group_id: 201 },
        { name: 'Procurement Signoff', approver_group_id: 202 }
      ]
    },
    {
      id: 4002,
      title: 'Titanium Alloys - PR Review',
      workflow_name: 'Purchase Requisition SLA Flow',
      workflow_id: 102,
      entity_details: 'PR #90302 - High Grade Titanium Rods',
      current_stage: 1,
      status: 'approved',
      pending_group_name: 'Completed',
      submitted_at: new Date(Date.now() - 24 * 3600000).toISOString(),
      history: [
        { user_name: 'System Engine', action: 'initiated', comment: 'PR submitted.', created_at: new Date(Date.now() - 24 * 3600000).toISOString() },
        { user_name: 'Elena Rostova', action: 'approved', comment: 'Budget cleared.', created_at: new Date(Date.now() - 20 * 3600000).toISOString() }
      ],
      stages: [
        { name: 'Finance Audit', approver_group_id: 203 }
      ]
    }
  ];

  const mockBroadcasts = [
    { id: 501, subject: 'Weekly Compliance Reminder', to_emails: ['audits@aequm.com'], reminder_interval_hours: 168, reminders_sent: 4, max_reminders: 10 }
  ];

  // Sync state with localStorage to support client-side interactive flow
  const loadStateFromLocalStorage = () => {
    if (!localStorage.getItem('workflows_list')) {
      localStorage.setItem('workflows_list', JSON.stringify(mockWorkflows));
    }
    if (!localStorage.getItem('workflows_groups')) {
      localStorage.setItem('workflows_groups', JSON.stringify(mockGroups));
    }
    if (!localStorage.getItem('workflows_users')) {
      localStorage.setItem('workflows_users', JSON.stringify(mockUsers));
    }
    if (!localStorage.getItem('workflows_requests')) {
      localStorage.setItem('workflows_requests', JSON.stringify(mockRequests));
    }
    if (!localStorage.getItem('workflows_broadcasts')) {
      localStorage.setItem('workflows_broadcasts', JSON.stringify(mockBroadcasts));
    }
  };

  const getLocalData = (key) => {
    return JSON.parse(localStorage.getItem(key) || '[]');
  };

  const setLocalData = (key, val) => {
    localStorage.setItem(key, JSON.stringify(val));
  };

  const logActivity = (detail) => {
    const act = getLocalData('workflows_activities');
    act.unshift({
      id: Date.now(),
      detail,
      created_at: new Date().toISOString()
    });
    setLocalData('workflows_activities', act.slice(0, 50));
    setActivityLogs(act);
  };

  // API Call Orchestration
  const fetchAllData = async () => {
    setLoading(true);
    loadStateFromLocalStorage();

    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      // 1. Fetch Workflows
      try {
        const res = await axios.get(`/api/workflows/?user_id=${userId}`, { headers });
        if (res.data && Array.isArray(res.data)) {
          setWorkflows(res.data);
          setLocalData('workflows_list', res.data);
        } else {
          setWorkflows(getLocalData('workflows_list'));
        }
      } catch (err) {
        console.warn('API error workflows, loading local storage.', err);
        setWorkflows(getLocalData('workflows_list'));
      }

      // 2. Fetch Groups
      try {
        const res = await axios.get(`/api/stages/approver-groups?user_id=${userId}`, { headers });
        if (res.data && Array.isArray(res.data)) {
          setGroups(res.data);
          setLocalData('workflows_groups', res.data);
        } else {
          setGroups(getLocalData('workflows_groups'));
        }
      } catch (err) {
        console.warn('API error groups, loading local storage.', err);
        setGroups(getLocalData('workflows_groups'));
      }

      // 3. Fetch Users
      if (!isEmployee) {
        try {
          const res = await axios.get(`/api/stages/users?user_id=${userId}`, { headers });
          if (res.data && Array.isArray(res.data)) {
            const mappedUsers = res.data.map(u => ({
              id: u.id,
              name: u.name || `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown',
              firstName: u.firstName,
              lastName: u.lastName,
              email: u.email
            }));
            setUsers(mappedUsers);
            setLocalData('workflows_users', mappedUsers);
          } else {
            setUsers(getLocalData('workflows_users'));
          }
        } catch (err) {
          console.warn('API error users, loading local storage.', err);
          setUsers(getLocalData('workflows_users'));
        }
      }

      // 4. Fetch Requests
      try {
        const res = await axios.get(`/api/requests/?user_id=${userId}`, { headers });
        if (res.data && Array.isArray(res.data)) {
          const sorted = [...res.data].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
          setRequests(sorted);
          setLocalData('workflows_requests', sorted);
        } else {
          setRequests(getLocalData('workflows_requests'));
        }
      } catch (err) {
        console.warn('API error requests, loading local storage.', err);
        setRequests(getLocalData('workflows_requests'));
      }

      // 5. Fetch Broadcast messages & OOO status
      if (!isEmployee) {
        try {
          const res = await axios.get(`/api/messages/?user_id=${userId}`, { headers });
          if (res.data && Array.isArray(res.data)) {
            setActiveBroadcasts(res.data);
            setLocalData('workflows_broadcasts', res.data);
          } else {
            setActiveBroadcasts(getLocalData('workflows_broadcasts'));
          }
        } catch (err) {
          setActiveBroadcasts(getLocalData('workflows_broadcasts'));
        }
      }

      // Fetch OOO config
      try {
        const res = await axios.get(`/api/auth/me?user_id=${userId}`, { headers });
        if (res.data) {
          setOooUntil(res.data.ooo_until ? res.data.ooo_until.slice(0, 16) : '');
          setDelegateId(res.data.delegate_id || '');
        }
      } catch (err) {
        console.warn('OOO fetch error, keeping default.');
      }

      // Load activities
      setActivityLogs(getLocalData('workflows_activities'));

    } catch (e) {
      console.error('Workflow page reload error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [currentTab]);

  // Become-a-Supplier requests carry a registrationId in request_metadata — fetch the full
  // application (documents + extracted/verified fields) so the approver can actually see
  // what they're approving instead of just the generic request title/status.
  useEffect(() => {
    setReviewDetails(null);
    setReviewError('');
    setExpandedDocType(null);
    setVendorDocTypeChoice({});
    setVendorCategoryError('');
    setActionError('');
    const registrationId = selectedRequest?.request_metadata?.registrationId;
    if (!selectedRequest || selectedRequest.request_type !== 'vendor_registration' || !registrationId) return;

    setReviewLoading(true);
    const token = localStorage.getItem('auth_token');
    const authHeader = { headers: { Authorization: `Bearer ${token}` } };
    axios.get(`/api/supplier-registration/${registrationId}`, authHeader)
      .then(({ data }) => setReviewDetails(data.data?.result || null))
      .catch(() => setReviewError('Could not load the application details.'))
      .finally(() => setReviewLoading(false));

    if (Object.keys(vendorDocTypeMenu).length === 0) {
      const qs = VENDOR_COMPANY_CODES.map((c) => `companyCode=${c}`).join('&');
      axios.get(`/api/supplier-registration/document-types?${qs}`, authHeader)
        .then(({ data }) => {
          const menu = {};
          for (const cc of VENDOR_COMPANY_CODES) menu[cc] = [];
          for (const dt of (data || [])) {
            for (const a of (dt.assignments || [])) {
              if (menu[a.companyCode]) menu[a.companyCode].push({ code: dt.code, description: dt.description, classification: dt.classification });
            }
          }
          setVendorDocTypeMenu(menu);
        })
        .catch(() => {});
    }

    if (Object.keys(companyNames).length === 0) {
      axios.get('/api/mm/companies', authHeader)
        .then(({ data }) => {
          const names = {};
          for (const c of (data?.companies || [])) names[c.companyCode] = c.companyName;
          setCompanyNames(names);
        })
        .catch(() => {});
    }
  }, [selectedRequest]);

  // A vendor's self-service "change my document/answer" request — same webhook/approval
  // mechanics as vendor_registration above, carrying changeRequestId instead of registrationId.
  const [changeRequestDetail, setChangeRequestDetail] = useState(null);
  useEffect(() => {
    setChangeRequestDetail(null);
    const changeRequestId = selectedRequest?.request_metadata?.changeRequestId;
    if (!selectedRequest || selectedRequest.request_type !== 'vendor_change_request' || !changeRequestId) return;

    setReviewLoading(true);
    const token = localStorage.getItem('auth_token');
    axios.get(`/api/supplier-registration/change-request/${changeRequestId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => setChangeRequestDetail(data.data?.result || null))
      .catch(() => setReviewError('Could not load the change request details.'))
      .finally(() => setReviewLoading(false));
  }, [selectedRequest]);

  const [expandedDocType, setExpandedDocType] = useState(null);
  const [viewerDoc, setViewerDoc] = useState(null);

  // Opens the document in SecureDocumentViewer (canvas-rendered, view-only — see that
  // component) rather than the plain new-tab blob this used to do, so a reviewer can look at a
  // supplier's document without it being trivially "Save As"-able. The backend still streams
  // it with an inline disposition through /preview (not FolderIt's own presigned, download-
  // forcing link) — the viewer component does its own authenticated blob fetch from doc.previewUrl.
  const handleViewDocument = (doc) => {
    if (!doc.previewUrl) return;
    setViewerDoc(doc);
  };

  // WORKFLOW CRUD HANDLERS
  const handleWfSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    let autoApproveConditions = null;
    if (wfConditions.trim()) {
      try {
        autoApproveConditions = JSON.parse(wfConditions);
      } catch (err) {
        alert('Invalid JSON in Auto-approve Conditions');
        return;
      }
    }

    const payload = {
      name: wfName,
      description: wfDesc,
      type: wfType,
      notification_channel: wfNotif,
      rejection_behavior: wfRejectBehavior,
      escalation_hours: Number(wfEscalateHours),
      amount_threshold: wfThreshold ? parseFloat(wfThreshold) : null,
      auto_approve_conditions: autoApproveConditions,
      stages: wfStages.map((s, idx) => ({ ...s, order: idx }))
    };

    try {
      if (editingWfId) {
        await axios.put(`/api/workflows/${editingWfId}?user_id=${userId}`, payload, { headers });
        logActivity(`Updated Workflow template "${wfName}"`);
      } else {
        await axios.post(`/api/workflows/?user_id=${userId}`, payload, { headers });
        logActivity(`Created new Workflow template "${wfName}"`);
      }
      setShowWfModal(false);
      fetchAllData();
    } catch (err) {
      console.warn('API save failed. Saving locally.');
      // Local fallback
      const localWfs = getLocalData('workflows_list');
      if (editingWfId) {
        const index = localWfs.findIndex(w => w.id === editingWfId);
        if (index !== -1) {
          localWfs[index] = { ...localWfs[index], ...payload, updated_at: new Date().toISOString() };
        }
        logActivity(`Updated Workflow template "${wfName}" locally`);
      } else {
        const newWf = { id: Date.now(), ...payload, is_active: true, updated_at: new Date().toISOString() };
        localWfs.push(newWf);
        logActivity(`Created Workflow template "${wfName}" locally`);
      }
      setLocalData('workflows_list', localWfs);
      setShowWfModal(false);
      fetchAllData();
    }
  };

  const handleWfDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete the workflow "${name}"?`)) return;
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      await axios.delete(`/api/workflows/${id}?user_id=${userId}`, { headers });
      logActivity(`Deleted Workflow template "${name}"`);
      fetchAllData();
    } catch (err) {
      console.warn('API delete failed. Deleting locally.');
      const localWfs = getLocalData('workflows_list').filter(w => w.id !== id);
      setLocalData('workflows_list', localWfs);
      logActivity(`Deleted Workflow template "${name}" locally`);
      fetchAllData();
    }
  };

  const openWfCreate = () => {
    setEditingWfId(null);
    setWfName('');
    setWfDesc('');
    setWfType('approval');
    setWfNotif('email');
    setWfRejectBehavior('stop');
    setWfEscalateHours(24);
    setWfThreshold('');
    setWfConditions('');
    setWfStages([
      { name: 'Compliance Verification', type: 'approval', approver_group_id: groups[0]?.id || '', voting_rule: 'any', sla_hours: 48, is_optional: false, instructions: '' }
    ]);
    setShowWfModal(true);
  };

  const openWfEdit = (wf) => {
    setEditingWfId(wf.id);
    setWfName(wf.name);
    setWfDesc(wf.description || '');
    setWfType(wf.type || 'approval');
    setWfNotif(wf.notification_channel || 'email');
    setWfRejectBehavior(wf.rejection_behavior || 'stop');
    setWfEscalateHours(wf.escalation_hours || 24);
    setWfThreshold(wf.amount_threshold || '');
    setWfConditions(wf.auto_approve_conditions ? JSON.stringify(wf.auto_approve_conditions, null, 2) : '');
    setWfStages(wf.stages || []);
    setShowWfModal(true);
  };

  // STAGE HANDLERS
  const addStageRow = () => {
    setWfStages([...wfStages, {
      name: `Stage ${wfStages.length + 1}`,
      type: 'approval',
      approver_group_id: groups[0]?.id || '',
      voting_rule: 'any',
      sla_hours: 24,
      is_optional: false,
      instructions: ''
    }]);
  };

  const removeStageRow = (index) => {
    if (wfStages.length <= 1) {
      alert('A workflow must have at least one stage.');
      return;
    }
    setWfStages(wfStages.filter((_, idx) => idx !== index));
  };

  const updateStageField = (index, field, value) => {
    const updated = [...wfStages];
    updated[index][field] = value;
    setWfStages(updated);
  };

  // REQUEST MANAGEMENT HANDLERS
  const handleReqSubmit = async (e) => {
    e.preventDefault();
    const selectedWf = workflows.find(w => w.id === Number(reqWfId));
    if (!selectedWf) return;

    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    let context = {};
    if (reqContext.trim()) {
      try { context = JSON.parse(reqContext); } catch (err) { alert('Invalid context JSON'); return; }
    }

    const payload = {
      title: reqTitle,
      workflow_id: selectedWf.id,
      entity_details: reqEntity,
      amount: reqAmount ? parseFloat(reqAmount) : null,
      context
    };

    try {
      await axios.post(`/api/requests/?user_id=${userId}`, payload, { headers });
      logActivity(`Submitted new approval request for "${reqTitle}"`);
      setShowReqModal(false);
      fetchAllData();
    } catch (err) {
      console.warn('API request creation failed, using local fallback.');
      const localReqs = getLocalData('workflows_requests');
      const newReq = {
        id: Date.now(),
        title: reqTitle,
        workflow_name: selectedWf.name,
        workflow_id: selectedWf.id,
        entity_details: reqEntity,
        current_stage: 0,
        status: 'pending',
        pending_group_name: groups.find(g => g.id === selectedWf.stages[0]?.approver_group_id)?.name || 'First Approvers',
        submitted_at: new Date().toISOString(),
        history: [{ user_name: currentUser.firstName, action: 'initiated', comment: 'Request created locally.', created_at: new Date().toISOString() }],
        stages: selectedWf.stages || []
      };
      localReqs.unshift(newReq);
      setLocalData('workflows_requests', localReqs);
      logActivity(`Created Request "${reqTitle}" locally`);
      setShowReqModal(false);
      fetchAllData();
    }
  };

  const processRequestAction = async (action) => {
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    // WorkFlow's real action endpoint is POST /api/requests/action/{id} with action/user_id/
    // comment as query params (not a JSON body) — action here is "approve"/"reject" from the
    // buttons below, but the API expects "approved"/"rejected".
    const wfAction = action === 'approve' ? 'approved' : 'rejected';
    setActionError('');

    try {
      const mappedAction = action === 'approve' ? 'approved' : 'rejected';
      const response = await axios.post(`/api/requests/action/${selectedRequest.id}`, null, {
        params: { action: mappedAction, user_id: userId, comment: actionComment },
        headers,
      });

      logActivity(`Processed action "${action}" on Request #${selectedRequest.id}`);

      if (response.data && response.data.status === 'approved') {
        const prId = response.data.request_metadata?.prId || selectedRequest.request_metadata?.prId;
        if (prId) {
          try {
            await axios.post(`/api/purchase-requisitions/${prId}/status`, { status: 'APPROVED' }, { headers });
            console.log(`Updated PR ${prId} status to APPROVED`);
          } catch (e) { console.error('Failed to update PR status', e); }
        }
      } else if (response.data && response.data.status === 'rejected') {
        const prId = response.data.request_metadata?.prId || selectedRequest.request_metadata?.prId;
        if (prId) {
          try {
            await axios.post(`/api/purchase-requisitions/${prId}/status`, { status: 'REJECTED' }, { headers });
            console.log(`Updated PR ${prId} status to REJECTED`);
          } catch (e) { console.error('Failed to update PR status', e); }
        }
      }

      setSelectedRequest(null);
      setActionComment('');
      fetchAllData();
    } catch (err) {
      // A real response (e.g. the backend's 400 "You have already acted on this stage") means
      // the server understood and refused the action — showing that to the user beats silently
      // faking a local "success" via the offline fallback below, which used to make a rejected
      // second vote look like it worked while actually changing nothing.
      if (err.response) {
        setActionError(err.response.data?.detail || err.response.data?.statusMsg || 'Could not process this action. It may already have been recorded.');
        return;
      }
      console.warn('API Action processing failed. Acting locally.');
      const localReqs = getLocalData('workflows_requests');
      const idx = localReqs.findIndex(r => r.id === selectedRequest.id);
      if (idx !== -1) {
        const req = localReqs[idx];
        req.history.push({
          user_name: `${currentUser.firstName} ${currentUser.lastName}`,
          action: action === 'approve' ? 'approved' : 'rejected',
          comment: actionComment || 'No comment provided.',
          created_at: new Date().toISOString()
        });

        if (action === 'approve') {
          if (req.current_stage + 1 >= (req.stages?.length || 1)) {
            req.status = 'approved';
            req.pending_group_name = 'Completed';
          } else {
            req.current_stage += 1;
            const nextGroupId = req.stages[req.current_stage]?.approver_group_id;
            req.pending_group_name = groups.find(g => g.id === nextGroupId)?.name || 'Next Group';
          }
        } else {
          req.status = 'rejected';
          req.pending_group_name = 'Rejected';
        }

        localReqs[idx] = req;
        setLocalData('workflows_requests', localReqs);
        logActivity(`Processed action "${action}" on Request #${selectedRequest.id} locally`);
      }
      setSelectedRequest(null);
      setActionComment('');
      fetchAllData();
    }
  };

  // Document types (per company code — every vendor is assigned to both 1000 and 2000 for now)
  // is decided by whichever approver acts first — see
  // SupplierRegistrationService.setVendorDocumentTypes on the backend for the "first write wins"
  // logic this relies on. Only fires the call when it's actually still undecided; once
  // reviewDetails.documentTypeSelections is non-empty, this is a no-op and Approve goes straight
  // through like normal.
  const handleApproveClick = async () => {
    const needsDocTypes = selectedRequest?.request_type === 'vendor_registration'
      && reviewDetails && (!reviewDetails.documentTypeSelections || reviewDetails.documentTypeSelections.length === 0);
    if (!needsDocTypes) {
      processRequestAction('approve');
      return;
    }
    const selections = VENDOR_COMPANY_CODES.flatMap((cc) =>
      (vendorDocTypeChoice[cc] || []).map((code) => ({ companyCode: cc, docTypeCode: code }))
    );
    if (selections.length === 0) {
      setVendorCategoryError('Pick at least one document type before approving.');
      return;
    }
    setDecidingCategory(true);
    setVendorCategoryError('');
    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(
        `/api/supplier-registration/${selectedRequest.request_metadata.registrationId}/document-types`,
        { selections },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      processRequestAction('approve');
    } catch (err) {
      setVendorCategoryError(err.response?.data?.statusMsg || 'Could not record the document types. Try again.');
    } finally {
      setDecidingCategory(false);
    }
  };

  // The stage currently blocking the request, its recorded votes (actions), and the full
  // required-approver roster for it (from workflow_snapshot — see workflow_snapshot.py on the
  // WorkFlow service: this stays "frozen" as of submission even if the workflow is edited
  // later). Used both to render an approval trail everyone in the group can see, and to stop
  // showing an active Approve/Reject control to someone who already voted on this stage —
  // the backend already rejects a second vote with 400, this just keeps the UI honest about it.
  const activeStage = selectedRequest?.stages?.find(s => s.stage_order === selectedRequest.current_stage);
  const activeStageMembers = selectedRequest?.workflow_snapshot?.stages
    ?.find(s => s.order === selectedRequest.current_stage)?.members || [];
  const activeStageActions = activeStage?.actions || [];
  const myStageAction = activeStageActions.find(a => a.approver_id === userId);
  const outstandingApprovers = activeStageMembers.filter(
    m => !activeStageActions.some(a => a.approver_id === m.user_id)
  );

  // GROUP CRUD HANDLERS
  const handleGroupCreate = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      await axios.post(`/api/stages/approver-groups?name=${encodeURIComponent(newGroupName)}&user_id=${userId}`, {}, { headers });
      logActivity(`Created Approver Group "${newGroupName}"`);
      setNewGroupName('');
      setShowGroupModal(false);
      fetchAllData();
    } catch (err) {
      console.warn('API group creation failed. Creating locally.');
      const localGrps = getLocalData('workflows_groups');
      const newGrp = { id: Date.now(), name: newGroupName, role: 'Custom Role', members: [] };
      localGrps.push(newGrp);
      setLocalData('workflows_groups', localGrps);
      logActivity(`Created Approver Group "${newGroupName}" locally`);
      setNewGroupName('');
      setShowGroupModal(false);
      fetchAllData();
    }
  };

  const handleGroupDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete Approver Group "${name}"?`)) return;
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      await axios.delete(`/api/stages/approver-groups/${id}?user_id=${userId}`, { headers });
      logActivity(`Deleted Approver Group "${name}"`);
      fetchAllData();
    } catch (err) {
      console.warn('API delete group failed. Deleting locally.');
      const localGrps = getLocalData('workflows_groups').filter(g => g.id !== id);
      setLocalData('workflows_groups', localGrps);
      logActivity(`Deleted Approver Group "${name}" locally`);
      fetchAllData();
    }
  };

  const addGroupMember = async (groupId, targetUserId) => {
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      await axios.post(`/api/stages/approver-groups/${groupId}/members?user_id=${userId}`, { user_id: targetUserId, sequential_order: 1, is_optional: false }, { headers });
      logActivity(`Added user ${targetUserId} to Approver Group ${groupId}`);
      fetchAllData();
    } catch (err) {
      console.warn('API add group member failed. Adding locally.');
      const localGrps = getLocalData('workflows_groups');
      const index = localGrps.findIndex(g => g.id === groupId);
      if (index !== -1) {
        const u = users.find(x => x.id === targetUserId);
        if (u) {
          if (!localGrps[index].members) localGrps[index].members = [];
          localGrps[index].members.push({ id: u.id, name: `${u.firstName || ''} ${u.lastName || ''}`, email: u.email, sequential_order: 1 });
        }
      }
      setLocalData('workflows_groups', localGrps);
      logActivity(`Added member locally.`);
      fetchAllData();
    }
  };

  const removeGroupMember = async (groupId, targetUserId) => {
    if (!confirm('Remove member from group?')) return;
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      await axios.delete(`/api/stages/approver-groups/${groupId}/members/${targetUserId}?user_id=${userId}`, { headers });
      logActivity(`Removed user ${targetUserId} from Approver Group ${groupId}`);
      fetchAllData();
    } catch (err) {
      console.warn('API remove group member failed. Removing locally.');
      const localGrps = getLocalData('workflows_groups');
      const index = localGrps.findIndex(g => g.id === groupId);
      if (index !== -1 && localGrps[index].members) {
        localGrps[index].members = localGrps[index].members.filter(m => m.id !== targetUserId);
      }
      setLocalData('workflows_groups', localGrps);
      logActivity(`Removed member locally.`);
      fetchAllData();
    }
  };

  // SETTINGS / OOO HANDLERS
  const handleSaveOoo = async (e) => {
    e.preventDefault();
    setSavingOoo(true);

    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    const payload = {
      ooo_until: oooUntil ? new Date(oooUntil).toISOString() : null,
      delegate_id: delegateId ? parseInt(delegateId) : null
    };

    try {
      await axios.patch(`/api/auth/me/out-of-office?user_id=${userId}`, payload, { headers });
      alert('Out-of-office delegation settings saved successfully!');
      logActivity('Updated OOO and delegation settings.');
    } catch (err) {
      console.warn('OOO API update failed, saving locally.');
      alert('OOO settings saved locally.');
      logActivity('Updated OOO and delegation settings locally.');
    } finally {
      setSavingOoo(false);
    }
  };

  const handleSendStandalone = async (e) => {
    e.preventDefault();
    if (!saToEmails) {
      alert('Please specify recipients.');
      return;
    }

    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    let context = null;
    if (saContext.trim()) {
      try { context = JSON.parse(saContext); } catch (err) { alert('Invalid context JSON'); return; }
    }

    const payload = {
      to_emails: saToEmails.split(',').map(em => em.trim()).filter(em => em),
      subject: saSubject,
      message: saMessage,
      context,
      reminder_interval_hours: saInterval ? parseInt(saInterval) : null,
      max_reminders: saMaxReminders ? parseInt(saMaxReminders) : null
    };

    try {
      await axios.post(`/api/messages/?user_id=${userId}`, payload, { headers });
      alert('Standalone notification triggered successfully!');
      logActivity(`Fired standalone notification: "${saSubject}"`);
      setSaToEmails('');
      setSaSubject('');
      setSaMessage('');
      setSaContext('');
      setSaInterval('');
      setSaMaxReminders('');
      fetchAllData();
    } catch (err) {
      console.warn('API send message failed. Simulating locally.');
      const localBroadcasts = getLocalData('workflows_broadcasts');
      localBroadcasts.push({
        id: Date.now(),
        subject: saSubject || 'One-off Notification',
        to_emails: payload.to_emails,
        reminder_interval_hours: payload.reminder_interval_hours,
        reminders_sent: 1,
        max_reminders: payload.max_reminders
      });
      setLocalData('workflows_broadcasts', localBroadcasts);
      alert('Message processed locally.');
      logActivity(`Fired standalone notification locally: "${saSubject}"`);
      setSaToEmails('');
      setSaSubject('');
      setSaMessage('');
      setSaContext('');
      setSaInterval('');
      setSaMaxReminders('');
      fetchAllData();
    }
  };

  const handleDeactivateMessage = async (id) => {
    if (!confirm('Deactivate this broadcast sequence?')) return;
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      await axios.patch(`/api/messages/${id}/deactivate?user_id=${userId}`, {}, { headers });
      logActivity(`Stopped broadcast message #${id}`);
      fetchAllData();
    } catch (err) {
      const localBroadcasts = getLocalData('workflows_broadcasts').filter(b => b.id !== id);
      setLocalData('workflows_broadcasts', localBroadcasts);
      logActivity(`Stopped broadcast message #${id} locally`);
      fetchAllData();
    }
  };

  // EMAIL ACTION TRIGGER
  const handleProcessEmailToken = async (e) => {
    e.preventDefault();
    if (!emailToken.trim()) return;

    setEmailProcessingState('loading');
    setEmailActionError('');

    try {
      const res = await axios.get(`/api/requests/action/${emailToken}`);
      setEmailProcessingState('success');
      setEmailActionResult(res.data);
      logActivity(`Email token processed successfully: "${emailToken}"`);
      fetchAllData();
    } catch (err) {
      console.warn('API Action via token failed, trying local mock fallback.');
      const parts = emailToken.split('_');
      if (parts.length >= 2) {
        const action = parts[0]; // "approve" or "reject"
        const reqId = parseInt(parts[1]);

        const localReqs = getLocalData('workflows_requests');
        const idx = localReqs.findIndex(r => r.id === reqId);

        if (idx !== -1) {
          const req = localReqs[idx];
          req.history.push({
            user_name: 'Email Approver Link',
            action: action === 'approve' ? 'approved' : 'rejected',
            comment: 'Processed via single-click token-based email link.',
            created_at: new Date().toISOString()
          });

          if (action === 'approve') {
            if (req.current_stage + 1 >= (req.stages?.length || 1)) {
              req.status = 'approved';
              req.pending_group_name = 'Completed';
            } else {
              req.current_stage += 1;
              const nextGroupId = req.stages[req.current_stage]?.approver_group_id;
              req.pending_group_name = groups.find(g => g.id === nextGroupId)?.name || 'Next Group';
            }
          } else {
            req.status = 'rejected';
            req.pending_group_name = 'Rejected';
          }

          localReqs[idx] = req;
          setLocalData('workflows_requests', localReqs);
          setEmailProcessingState('success');
          setEmailActionResult(req);
          logActivity(`Simulated token action: request #${reqId} (${action})`);
          fetchAllData();
          return;
        }
      }
      setEmailProcessingState('error');
      setEmailActionError(err.response?.data?.detail || 'Token has expired or is invalid.');
    }
  };

  // Helper date formatter
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '—';
    const diffMs = new Date() - new Date(dateStr);
    const diffMins = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMins / 60);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  // Analytics Computation
  const computeAnalytics = () => {
    const total = requests.length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;
    const pending = requests.filter(r => r.status === 'pending').length;
    const rate = total > 0 ? Math.round((approved / (approved + rejected || 1)) * 100) : 0;

    return { total, approved, rejected, pending, rate };
  };

  const stats = computeAnalytics();

  return (
    <div className="fade-in-slide container-fluid py-4 text-start" style={{ fontFamily: '"Poppins", sans-serif', minHeight: '100%' }}>
      {isEmployee && (
        <BackButton onClick={() => onNavigate ? onNavigate('dashboard') : window.history.back()} />
      )}
      {/* Sub-Header Navigation Tabs */}
      <div className="row align-items-center mb-4">
        <div className="col">
          <h4 className="fw-bold mb-1 text-dark">
            <i className="fas fa-project-diagram me-2 text-success"></i>Workflow Automation Center
          </h4>
          <p className="text-muted mb-0 small">Design approval paths, configure user delegation, process actions, and review SLA metrics.</p>
        </div>
        <div className="col-auto d-flex gap-2">
          {currentTab === 'wf_list' && (
            <Button onClick={openWfCreate} className="btn-success btn-sm">
              <i className="fas fa-plus me-1"></i> Create Workflow
            </Button>
          )}
          {currentTab === 'wf_requests' && (
            <Button onClick={() => setShowReqModal(true)} className="btn-success btn-sm">
              <i className="fas fa-plus me-1"></i> New Request
            </Button>
          )}
          {currentTab === 'wf_groups' && (
            <Button onClick={() => setShowGroupModal(true)} className="btn-success btn-sm">
              <i className="fas fa-plus me-1"></i> Create Group
            </Button>
          )}
        </div>
      </div>

      {/* Tabs list inside screen (dual routing support) */}
      {!isEmployee && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body p-2">
            <ul className="nav nav-pills gap-1">
              {[
                { id: 'wf_dashboard', label: 'Dashboard', icon: 'fas fa-tachometer-alt' },
                { id: 'wf_list', label: 'Workflows', icon: 'fas fa-project-diagram' },
                { id: 'wf_requests', label: 'Requests', icon: 'fas fa-tasks' },
                { id: 'wf_groups', label: 'Groups', icon: 'fas fa-users' },
                { id: 'wf_analytics', label: 'Analytics', icon: 'fas fa-chart-pie' },
                { id: 'wf_email_action', label: 'Email Action', icon: 'fas fa-envelope-open-text' },
                { id: 'wf_settings', label: 'Settings', icon: 'fas fa-cog' }
              ].map(tab => (
                <li key={tab.id} className="nav-item">
                  <button
                    className={`nav-link border-0 py-2 px-3 rounded fw-semibold small d-flex align-items-center gap-2 ${currentTab === tab.id ? 'active-tab-style' : 'text-dark hover-tab-style'
                      }`}
                    onClick={() => onNavigate ? onNavigate(tab.id) : null}
                  >
                    <i className={tab.icon} style={{ fontSize: '12px' }}></i>
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-success" role="status"></div>
          <p className="text-muted mt-2 small">Loading workflow engine data...</p>
        </div>
      ) : (
        <>
          {/* DASHBOARD TAB */}
          {currentTab === 'wf_dashboard' && (
            <div className="row g-4">
              {/* Quick Stats */}
              <div className="col-12">
                <div className="row g-3">
                  <div className="col-md-3 col-sm-6">
                    <div className="card border-0 shadow-sm p-4 bg-white">
                      <div className="text-muted small fw-bold text-uppercase">Total Requests</div>
                      <div className="fs-2 fw-bold text-dark mt-2">{stats.total}</div>
                      <small className="text-muted">Workflow executions</small>
                    </div>
                  </div>
                  <div className="col-md-3 col-sm-6">
                    <div className="card border-0 shadow-sm p-4 bg-white">
                      <div className="text-muted small fw-bold text-uppercase">Pending Approval</div>
                      <div className="fs-2 fw-bold text-warning mt-2">{stats.pending}</div>
                      <small className="text-warning fw-bold">Awaiting action</small>
                    </div>
                  </div>
                  <div className="col-md-3 col-sm-6">
                    <div className="card border-0 shadow-sm p-4 bg-white">
                      <div className="text-muted small fw-bold text-uppercase">Approval Rate</div>
                      <div className="fs-2 fw-bold text-success mt-2">{stats.rate}%</div>
                      <small className="text-success fw-bold">Conversion efficacy</small>
                    </div>
                  </div>
                  <div className="col-md-3 col-sm-6">
                    <div className="card border-0 shadow-sm p-4 bg-white">
                      <div className="text-muted small fw-bold text-uppercase">Rejections</div>
                      <div className="fs-2 fw-bold text-danger mt-2">{stats.rejected}</div>
                      <small className="text-muted">Unapproved requests</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Awaiting My Action requests */}
              <div className="col-lg-8 col-12">
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                    <h6 className="fw-bold text-dark mb-0">Active Requests Queue</h6>
                    <select 
                      className="form-select form-select-sm w-auto"
                      value={requestFilter}
                      onChange={(e) => setRequestFilter(e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="all">All Statuses</option>
                    </select>
                  </div>
                  <div className="card-body p-0">
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light text-muted fw-bold" style={{ fontSize: '11px' }}>
                          <tr>
                            <th className="ps-4 py-3">Request Name / ID</th>
                            <th>Workflow Flow</th>
                            <th>Current Task Group</th>
                            <th>Submitted Date</th>
                            <th>State</th>
                            <th className="text-end pe-4">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {requests.filter(req => requestFilter === 'all' ? true : req.status === requestFilter).length > 0 ? (
                            requests.filter(req => requestFilter === 'all' ? true : req.status === requestFilter).map(req => (
                              <tr key={req.id}>
                                <td className="ps-4">
                                  <div className="fw-bold text-dark small">{req.title || 'Untitled Request'}</div>
                                  <div className="text-muted" style={{ fontSize: '10px' }}>#{req.id}</div>
                                </td>
                                <td><span className="small fw-semibold text-muted">{req.workflow_name}</span></td>
                                <td><span className="badge bg-success-subtle text-success">{req.pending_group_name || 'Completed'}</span></td>
                                <td><span className="small text-muted">{formatTimeAgo(req.submitted_at)}</span></td>
                                <td>
                                  <span className={`badge ${req.status === 'approved' ? 'bg-success text-white' :
                                      req.status === 'rejected' ? 'bg-danger text-white' : 'bg-warning text-dark'
                                    } px-2.5 py-1 rounded-pill small`}>
                                    {req.status}
                                  </span>
                                </td>
                                <td className="text-end pe-4">
                                  <button onClick={() => setSelectedRequest(req)} className="btn btn-light btn-sm border px-2.5 py-1 text-success fw-bold" style={{ fontSize: '11.5px' }}>
                                    View Details
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="6" className="text-center py-5 text-muted small">No active requests matching filter.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Activity Log */}
              <div className="col-lg-4 col-12">
                <div className="card border-0 shadow-sm" style={{ minHeight: '100%' }}>
                  <div className="card-header bg-white border-0 py-3">
                    <h6 className="fw-bold text-dark mb-0">Workflow Activity Logs</h6>
                  </div>
                  <div className="card-body py-2">
                    <div className="d-flex flex-column gap-3">
                      {activityLogs.length > 0 ? (
                        activityLogs.slice(0, 5).map(log => (
                          <div key={log.id} className="d-flex gap-2 align-items-start border-bottom pb-2">
                            <div className="bg-success-subtle text-success p-1 px-2 rounded-circle" style={{ fontSize: '10px' }}>
                              <i className="fas fa-check"></i>
                            </div>
                            <div className="text-start">
                              <p className="mb-0 text-dark small" style={{ fontSize: '12px' }}>{log.detail}</p>
                              <small className="text-muted" style={{ fontSize: '10px' }}>{formatTimeAgo(log.created_at)}</small>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4 text-muted small">No activities logged yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WORKFLOWS LIST TAB */}
          {currentTab === 'wf_list' && (
            <div className="card border-0 shadow-sm">
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-muted fw-bold" style={{ fontSize: '11px' }}>
                      <tr>
                        <th className="ps-4 py-3">Workflow Name</th>
                        <th>Stages / Steps</th>
                        <th>Rejection Behavior</th>
                        <th>Status</th>
                        <th>Last Modified</th>
                        <th className="text-end pe-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workflows.length > 0 ? (
                        workflows.map(wf => (
                          <tr key={wf.id}>
                            <td className="ps-4">
                              <div className="fw-bold text-dark">{wf.name}</div>
                              <div className="text-muted small" style={{ maxWidth: '400px', fontSize: '11px' }}>{wf.description || 'No description provided.'}</div>
                            </td>
                            <td><span className="small fw-semibold">{wf.stages?.length || 0} Stages</span></td>
                            <td><span className="small text-muted font-monospace">{wf.rejection_behavior}</span></td>
                            <td>
                              <span className={`badge ${wf.is_active ? 'bg-success-subtle text-success' : 'bg-secondary-subtle text-secondary'} px-2.5 py-1 rounded`}>
                                {wf.is_active ? 'Active' : 'Draft'}
                              </span>
                            </td>
                            <td><span className="small text-muted">{formatTimeAgo(wf.updated_at || wf.created_at)}</span></td>
                            <td className="text-end pe-4">
                              <div className="d-flex justify-content-end gap-2">
                                <button onClick={() => openWfEdit(wf)} className="btn btn-light btn-sm border text-success fw-bold" style={{ fontSize: '11px' }}>Edit</button>
                                <button onClick={() => handleWfDelete(wf.id, wf.name)} className="btn btn-light btn-sm border text-danger fw-bold" style={{ fontSize: '11px' }}>Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="text-center py-5 text-muted small">No workflows created. Click "+ Create Workflow" to start.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* REQUESTS QUEUE TAB */}
          {currentTab === 'wf_requests' && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center">
                <h6 className="fw-bold text-dark mb-0">Workflow Requests</h6>
                <select 
                  className="form-select form-select-sm w-auto"
                  value={requestFilter}
                  onChange={(e) => setRequestFilter(e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="all">All Statuses</option>
                </select>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-muted fw-bold" style={{ fontSize: '11px' }}>
                      <tr>
                        <th className="ps-4 py-3">Request Name / ID</th>
                        <th>Workflow Template</th>
                        <th>Target Context Details</th>
                        <th>Awaiting Approvers</th>
                        <th>Submitted At</th>
                        <th>Approval State</th>
                        <th className="text-end pe-4">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.filter(req => requestFilter === 'all' ? true : req.status === requestFilter).length > 0 ? (
                        requests.filter(req => requestFilter === 'all' ? true : req.status === requestFilter).map(req => (
                          <tr key={req.id}>
                            <td className="ps-4 font-monospace small">
                              <div className="fw-bold text-dark">#{req.id}</div>
                              <span className="text-muted" style={{ fontSize: '11px' }}>{req.title}</span>
                            </td>
                            <td><span className="small fw-semibold">{req.workflow_name}</span></td>
                            <td><span className="small text-muted">{req.entity_details}</span></td>
                            <td><span className="badge bg-success-subtle text-success">{req.pending_group_name || 'Completed'}</span></td>
                            <td><span className="small text-muted">{formatTimeAgo(req.submitted_at)}</span></td>
                            <td>
                              <span className={`badge ${req.status === 'approved' ? 'bg-success text-white' :
                                  req.status === 'rejected' ? 'bg-danger text-white' : 'bg-warning text-dark'
                                } px-2.5 py-1 rounded-pill small`}>
                                {req.status}
                              </span>
                            </td>
                            <td className="text-end pe-4">
                              <button onClick={() => setSelectedRequest(req)} className="btn btn-light btn-sm border px-3 py-1 text-success fw-bold" style={{ fontSize: '11px' }}>
                                View
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="text-center py-5 text-muted small">No request flow records matching filter.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* APPROVER GROUPS TAB */}
          {currentTab === 'wf_groups' && (
            <div className="row g-4">
              {groups.length > 0 ? (
                groups.map(group => (
                  <div key={group.id} className="col-md-6 col-12">
                    <div className="card border-0 shadow-sm p-4 h-100 bg-white">
                      <div className="d-flex justify-content-between align-items-start mb-3 border-bottom pb-2">
                        <div>
                          <h6 className="fw-bold text-dark mb-1">{group.name}</h6>
                          <span className="text-muted" style={{ fontSize: '11.5px' }}>Role/Responsibility: {group.role || 'General approver duties'}</span>
                        </div>
                        <button onClick={() => handleGroupDelete(group.id, group.name)} className="btn btn-light btn-sm border text-danger" style={{ fontSize: '10px' }}>
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>

                      {/* Active Members */}
                      <div className="mb-4">
                        <label className="text-muted small fw-bold text-uppercase d-block mb-2">Group Members</label>
                        <div className="d-flex flex-column gap-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {group.members && group.members.length > 0 ? (
                            group.members.map(member => (
                              <div key={member.id} className="d-flex justify-content-between align-items-center bg-light p-2 rounded">
                                <div className="d-flex align-items-center gap-2">
                                  <div className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center fw-bold" style={{ width: '24px', height: '24px', fontSize: '10px' }}>
                                    {member.name.charAt(0)}
                                  </div>
                                  <div className="text-start">
                                    <div className="small fw-bold text-dark">{member.name}</div>
                                    <div className="text-muted" style={{ fontSize: '10px' }}>{member.email}</div>
                                  </div>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                  <span className="text-muted small" style={{ fontSize: '10.5px' }}>Seq Order: {member.sequential_order || 1}</span>
                                  <button onClick={() => removeGroupMember(group.id, member.id)} className="btn btn-link text-danger p-0" style={{ fontSize: '12px' }}>
                                    &times;
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-muted small mb-0">No members configured in this group.</p>
                          )}
                        </div>
                      </div>

                      {/* Add Member Dropdown */}
                      <div className="mt-auto pt-2">
                        {!activeGroupMemberSearch[group.id] ? (
                          <button onClick={() => setActiveGroupMemberSearch({ ...activeGroupMemberSearch, [group.id]: true })} className="btn btn-outline-success btn-sm w-100 py-1.5" style={{ fontSize: '11px' }}>
                            <i className="fas fa-plus me-1"></i> Add Member
                          </button>
                        ) : (
                          <div className="bg-light p-3 rounded">
                            <div className="d-flex justify-content-between align-items-center mb-2">
                              <span className="fw-bold small text-dark">Add Approver</span>
                              <button onClick={() => setActiveGroupMemberSearch({ ...activeGroupMemberSearch, [group.id]: false })} className="btn btn-link text-muted p-0 text-decoration-none small">&times; Close</button>
                            </div>
                            <div className="d-flex flex-column gap-1 max-vh-25 overflow-auto">
                              {users.filter(u => !group.members || !group.members.some(m => m.id === u.id)).map(u => (
                                <button key={u.id} onClick={() => addGroupMember(group.id, u.id)} className="btn btn-light btn-sm text-start py-1.5 px-2 border-0 w-100" style={{ fontSize: '11.5px' }}>
                                  <div className="fw-bold text-dark">{u.name}</div>
                                  <div className="text-muted" style={{ fontSize: '9.5px' }}>{u.email}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-12 text-center py-5 text-muted small">No approver groups configured. Click "+ Create Group" to start.</div>
              )}
            </div>
          )}

          {/* ANALYTICS TAB */}
          {currentTab === 'wf_analytics' && (
            <div className="row g-4">
              <div className="col-md-6">
                <div className="card border-0 shadow-sm p-4 bg-white">
                  <h6 className="fw-bold text-dark mb-3"><i className="fas fa-chart-line text-success me-2"></i>By Workflow Volume</h6>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Workflow</th>
                          <th>Total</th>
                          <th>Approved</th>
                          <th>Rejected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workflows.map(wf => {
                          const wfReqs = requests.filter(r => r.workflow_id === wf.id);
                          return (
                            <tr key={wf.id}>
                              <td className="small fw-semibold">{wf.name}</td>
                              <td>{wfReqs.length}</td>
                              <td className="text-success">{wfReqs.filter(r => r.status === 'approved').length}</td>
                              <td className="text-danger">{wfReqs.filter(r => r.status === 'rejected').length}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="col-md-6">
                <div className="card border-0 shadow-sm p-4 bg-white">
                  <h6 className="fw-bold text-dark mb-3"><i className="fas fa-history text-success me-2"></i>Approver Responses Speed</h6>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>Approver</th>
                          <th>Decisions</th>
                          <th>Average Speed</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="small fw-semibold">Sarah Connor</td>
                          <td>14</td>
                          <td className="text-muted">1.8 hrs</td>
                        </tr>
                        <tr>
                          <td className="small fw-semibold">Elena Rostova</td>
                          <td>9</td>
                          <td className="text-muted">2.1 hrs</td>
                        </tr>
                        <tr>
                          <td className="small fw-semibold">David Miller</td>
                          <td>5</td>
                          <td className="text-muted">4.5 hrs</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="col-12">
                <div className="card border-0 shadow-sm p-4 bg-white">
                  <h6 className="fw-bold text-dark mb-3">Workflow Execution Timeline Feed</h6>
                  <div className="d-flex flex-column gap-3">
                    {activityLogs.map(log => (
                      <div key={log.id} className="d-flex gap-3 align-items-start border-bottom pb-3">
                        <div className="bg-success bg-opacity-10 text-success p-2 rounded-circle" style={{ fontSize: '11px' }}>
                          <i className="fas fa-history"></i>
                        </div>
                        <div className="text-start">
                          <p className="mb-0 text-dark small fw-semibold">{log.detail}</p>
                          <small className="text-muted" style={{ fontSize: '10.5px' }}>{new Date(log.created_at).toLocaleString()}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EMAIL ACTION PROCESSOR TAB */}
          {currentTab === 'wf_email_action' && (
            <div className="row justify-content-center">
              <div className="col-lg-6 col-md-8 col-12">
                <div className="card border-0 shadow-lg p-5 text-center bg-white" style={{ borderRadius: '24px' }}>
                  <div className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-4 bg-success bg-opacity-10" style={{ width: '80px', height: '80px', color: '#0E7C86' }}>
                    <i className="fas fa-envelope-open-text fs-2"></i>
                  </div>
                  <h4 className="fw-bold mb-2">Process Token Approval</h4>
                  <p className="text-muted small mb-4">Simulate or input a one-click notification action token to approve or reject a workflow stage instantly.</p>

                  <form onSubmit={handleProcessEmailToken}>
                    <div className="mb-3">
                      <input
                        type="text"
                        className="form-control text-center py-2 px-3"
                        placeholder="e.g. approve_4001 or reject_4001"
                        required
                        value={emailToken}
                        onChange={(e) => setEmailToken(e.target.value)}
                        style={{ borderRadius: '8px', fontSize: '13px' }}
                      />
                    </div>
                    <Button type="submit" className="btn-success w-100 py-2" loading={emailProcessingState === 'loading'}>
                      Validate & Process Link
                    </Button>
                  </form>

                  {emailProcessingState === 'success' && emailActionResult && (
                    <div className="alert alert-success mt-4 text-start small">
                      <h6 className="alert-heading fw-bold mb-1"><i className="fas fa-check-circle me-1"></i>Action Executed Successfully!</h6>
                      <p className="mb-1"><strong>Request:</strong> {emailActionResult.title}</p>
                      <p className="mb-1"><strong>Status:</strong> {emailActionResult.status}</p>
                      <p className="mb-0"><strong>Workflow Flow:</strong> {emailActionResult.workflow_name}</p>
                    </div>
                  )}

                  {emailProcessingState === 'error' && (
                    <div className="alert alert-danger mt-4 text-start small">
                      <h6 className="alert-heading fw-bold mb-1"><i className="fas fa-exclamation-triangle me-1"></i>Validation Error</h6>
                      <p className="mb-0">{emailActionError}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS / OOO TAB */}
          {currentTab === 'wf_settings' && (
            <div className="row g-4 text-start">
              {/* Out Of Office */}
              <div className="col-lg-6 col-12">
                <div className="card border-0 shadow-sm p-4 bg-white h-100">
                  <div className="card-header bg-white border-0 p-0 mb-3">
                    <h6 className="fw-bold text-dark mb-1"><i className="fas fa-calendar-times text-success me-2"></i>Out of Office Availability</h6>
                    <p className="text-muted mb-0 small" style={{ fontSize: '11.5px' }}>Manage delegation dates so incoming stage tasks automatically fallback to backups.</p>
                  </div>
                  <form onSubmit={handleSaveOoo}>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Out of Office Until</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={oooUntil}
                        onChange={(e) => setOooUntil(e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Delegate Backup Approver</label>
                      <select
                        className="form-select"
                        value={delegateId}
                        onChange={(e) => setDelegateId(e.target.value)}
                      >
                        <option value="">Select fallback user...</option>
                        {users.filter(u => u.id !== userId).map(u => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                        ))}
                      </select>
                    </div>
                    <Button type="submit" loading={savingOoo} className="btn-success px-4">
                      Save Settings
                    </Button>
                  </form>
                </div>
              </div>

              {/* Standalone Broadcast Notification */}
              <div className="col-lg-6 col-12">
                <div className="card border-0 shadow-sm p-4 bg-white h-100">
                  <div className="card-header bg-white border-0 p-0 mb-3">
                    <h6 className="fw-bold text-dark mb-1"><i className="fas fa-bullhorn text-success me-2"></i>Standalone Broadcast Message</h6>
                    <p className="text-muted mb-0 small" style={{ fontSize: '11.5px' }}>Fire context-aware one-off or recurring messages, independent of workflows.</p>
                  </div>
                  <form onSubmit={handleSendStandalone}>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Recipients (comma-separated)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. lead@comp.com, auditor@comp.com"
                        required
                        value={saToEmails}
                        onChange={(e) => setSaToEmails(e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Subject</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Compliance notification warning"
                        required
                        value={saSubject}
                        onChange={(e) => setSaSubject(e.target.value)}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label fw-bold text-muted small">Message Template</label>
                      <textarea
                        className="form-control"
                        rows="3"
                        placeholder="Supports placeholder variables resolved against context JSON below..."
                        required
                        value={saMessage}
                        onChange={(e) => setSaMessage(e.target.value)}
                      />
                    </div>
                    <div className="row g-2">
                      <div className="col-md-6 mb-3">
                        <label className="form-label fw-bold text-muted small">Repeat Interval (hours)</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="e.g. 24"
                          value={saInterval}
                          onChange={(e) => setSaInterval(e.target.value)}
                        />
                      </div>
                      <div className="col-md-6 mb-3">
                        <label className="form-label fw-bold text-muted small">Max Reminders</label>
                        <input
                          type="number"
                          className="form-control"
                          placeholder="e.g. 5"
                          value={saMaxReminders}
                          onChange={(e) => setSaMaxReminders(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button type="submit" className="btn-success px-4">
                      Send Broadcast
                    </Button>
                  </form>
                </div>
              </div>

              {/* Active Broadcasts */}
              {activeBroadcasts.length > 0 && (
                <div className="col-12">
                  <div className="card border-0 shadow-sm p-4 bg-white mt-4">
                    <h6 className="fw-bold text-dark mb-3">Active Recurring Messages</h6>
                    <div className="d-flex flex-column gap-2">
                      {activeBroadcasts.map(msg => (
                        <div key={msg.id} className="d-flex justify-content-between align-items-center bg-light p-3 rounded">
                          <div>
                            <div className="fw-bold text-dark">{msg.subject}</div>
                            <span className="text-muted small">To: {msg.to_emails?.join(', ')} | Every {msg.reminder_interval_hours}h</span>
                          </div>
                          <button onClick={() => handleDeactivateMessage(msg.id)} className="btn btn-outline-danger btn-sm" style={{ fontSize: '11px' }}>
                            Stop Broadcast
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* CREATE / EDIT WORKFLOW TEMPLATE WIZARD MODAL */}
      {showWfModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '900px' }}>
            <div className="custom-modal-header bg-white border-bottom-0 pt-4 px-4 pb-2">
              <h5 className="custom-modal-title fw-bold text-dark">
                {editingWfId ? 'Edit Workflow Template' : 'Create New Workflow'}
              </h5>
              <button className="custom-modal-close-btn" onClick={() => setShowWfModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleWfSubmit}>
              <div className="custom-modal-body p-4 text-start" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-muted small">Workflow Name *</label>
                    <input type="text" className="form-control" required value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="e.g. High Value PR Flow" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-muted small">Workflow Type</label>
                    <select className="form-select" value={wfType} onChange={(e) => setWfType(e.target.value)}>
                      <option value="approval">Multi-stage Approval</option>
                      <option value="parallel">Parallel Approvals</option>
                      <option value="sequential">Strict Sequential</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-bold text-muted small">Description</label>
                    <textarea className="form-control" rows="2" value={wfDesc} onChange={(e) => setWfDesc(e.target.value)} placeholder="Brief summary of trigger conditions and scope..." />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold text-muted small">Notification Channel</label>
                    <select className="form-select" value={wfNotif} onChange={(e) => setWfNotif(e.target.value)}>
                      <option value="email">Email Only</option>
                      <option value="slack">Slack Integration</option>
                      <option value="both">Both Channels</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold text-muted small">Rejection Action</label>
                    <select className="form-select" value={wfRejectBehavior} onChange={(e) => setWfRejectBehavior(e.target.value)}>
                      <option value="stop">Stop Workflow Immediately</option>
                      <option value="resubmit">Request Resubmission</option>
                      <option value="continue">Skip & Continue Stage</option>
                    </select>
                  </div>
                  <div className="col-md-4">
                    <label className="form-label fw-bold text-muted small">Escalation Deadline (hours)</label>
                    <input type="number" className="form-control" value={wfEscalateHours} onChange={(e) => setWfEscalateHours(e.target.value)} />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-muted small">Amount Threshold Limit (Optional)</label>
                    <input type="number" className="form-control" value={wfThreshold} onChange={(e) => setWfThreshold(e.target.value)} placeholder="e.g. 50000" />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label fw-bold text-muted small">Auto-Approve Conditions (Optional JSON)</label>
                    <textarea className="form-control font-monospace" rows="2" value={wfConditions} onChange={(e) => setWfConditions(e.target.value)} placeholder='e.g. {"field": "status", "operator": "equals", "value": "verified"}' style={{ fontSize: '11.5px' }} />
                  </div>

                  {/* Stage Designer list */}
                  <div className="col-12 mt-4">
                    <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                      <h6 className="fw-bold text-dark mb-0">Workflow Stage Approval Pipeline</h6>
                      <button type="button" onClick={addStageRow} className="btn btn-outline-success btn-sm py-1" style={{ fontSize: '11.5px' }}>
                        <i className="fas fa-plus me-1"></i> Add Stage
                      </button>
                    </div>
                    <div className="d-flex flex-column gap-3">
                      {wfStages.map((stage, index) => (
                        <div key={index} className="card p-3 border rounded bg-light bg-opacity-75">
                          <div className="row g-2 align-items-center">
                            <div className="col-md-3">
                              <label className="form-label small fw-bold text-muted mb-1">Stage Name</label>
                              <input type="text" className="form-control form-control-sm" required value={stage.name} onChange={(e) => updateStageField(index, 'name', e.target.value)} />
                            </div>
                            <div className="col-md-3">
                              <label className="form-label small fw-bold text-muted mb-1">Approver Group</label>
                              <select className="form-select form-select-sm" required value={stage.approver_group_id} onChange={(e) => updateStageField(index, 'approver_group_id', Number(e.target.value))}>
                                <option value="">Select Group...</option>
                                {groups.map(g => (
                                  <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="col-md-2">
                              <label className="form-label small fw-bold text-muted mb-1">Stage Type</label>
                              <select className="form-select form-select-sm" value={stage.type} onChange={(e) => updateStageField(index, 'type', e.target.value)}>
                                <option value="approval">Approval</option>
                                <option value="review">Review</option>
                                <option value="acknowledgement">Acknowledgement</option>
                                <option value="signature">Signature</option>
                              </select>
                            </div>
                            <div className="col-md-2">
                              <label className="form-label small fw-bold text-muted mb-1">Voting Rule</label>
                              <select className="form-select form-select-sm" value={stage.voting_rule} onChange={(e) => updateStageField(index, 'voting_rule', e.target.value)}>
                                <option value="any">Any (Single)</option>
                                <option value="all">Unanimous (All)</option>
                                <option value="sequential">Sequential</option>
                              </select>
                            </div>
                            <div className="col-md-1">
                              <label className="form-label small fw-bold text-muted mb-1">SLA (hrs)</label>
                              <input type="number" className="form-control form-control-sm" value={stage.sla_hours} onChange={(e) => updateStageField(index, 'sla_hours', Number(e.target.value))} />
                            </div>
                            <div className="col-md-1 text-end pt-3">
                              <button type="button" onClick={() => removeStageRow(index)} className="btn btn-outline-danger btn-sm p-1 border-0">
                                <i className="fas fa-trash-alt"></i>
                              </button>
                            </div>
                            <div className="col-12 mt-2">
                              <input type="text" className="form-control form-control-sm" placeholder="Additional instructions for this stage..." value={stage.instructions || ''} onChange={(e) => updateStageField(index, 'instructions', e.target.value)} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="custom-modal-footer gap-2">
                <button type="button" className="btn btn-outline-secondary px-3 py-1.5 small fw-semibold" onClick={() => setShowWfModal(false)} style={{ borderRadius: '8px', fontSize: '12px' }}>Cancel</button>
                <Button type="submit" className="btn-success px-4">
                  Save Template
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW REQUEST MODAL */}
      {showReqModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '500px' }}>
            <div className="custom-modal-header bg-white border-bottom-0 pt-4 px-4 pb-2">
              <h5 className="custom-modal-title fw-bold text-dark">Trigger Workflow Request</h5>
              <button className="custom-modal-close-btn" onClick={() => setShowReqModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleReqSubmit}>
              <div className="custom-modal-body p-4 text-start">
                <div className="mb-3">
                  <label className="form-label fw-bold text-muted small">Request Title *</label>
                  <input type="text" className="form-control" required value={reqTitle} onChange={(e) => setReqTitle(e.target.value)} placeholder="e.g. Stellar Forgings Onboarding Approval" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold text-muted small">Select Workflow Template *</label>
                  <select className="form-select" required value={reqWfId} onChange={(e) => setReqWfId(e.target.value)}>
                    <option value="">Choose Workflow...</option>
                    {workflows.map(wf => (
                      <option key={wf.id} value={wf.id}>{wf.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold text-muted small">Entity Details *</label>
                  <input type="text" className="form-control" required value={reqEntity} onChange={(e) => setReqEntity(e.target.value)} placeholder="e.g. Stellar Forgings Pvt Ltd" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold text-muted small">Amount (Optional)</label>
                  <input type="number" className="form-control" value={reqAmount} onChange={(e) => setReqAmount(e.target.value)} placeholder="e.g. 25000" />
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold text-muted small">Additional Context (Optional JSON)</label>
                  <textarea className="form-control font-monospace" rows="2" value={reqContext} onChange={(e) => setReqContext(e.target.value)} placeholder='e.g. {"region": "West", "urgency": "high"}' style={{ fontSize: '11.5px' }} />
                </div>
              </div>
              <div className="custom-modal-footer gap-2">
                <button type="button" className="btn btn-outline-secondary px-3 py-1.5 small fw-semibold" onClick={() => setShowReqModal(false)} style={{ borderRadius: '8px', fontSize: '12px' }}>Cancel</button>
                <Button type="submit" className="btn-success px-4">
                  Trigger Flow
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE APPROVER GROUP MODAL */}
      {showGroupModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '400px' }}>
            <div className="custom-modal-header bg-white border-bottom-0 pt-4 px-4 pb-2">
              <h5 className="custom-modal-title fw-bold text-dark">Create Approver Group</h5>
              <button className="custom-modal-close-btn" onClick={() => setShowGroupModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleGroupCreate}>
              <div className="custom-modal-body p-4 text-start">
                <div className="mb-3">
                  <label className="form-label fw-bold text-muted small">Group Name *</label>
                  <input type="text" className="form-control" required value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="e.g. Compliance Auditors" />
                </div>
              </div>
              <div className="custom-modal-footer gap-2">
                <button type="button" className="btn btn-outline-secondary px-3 py-1.5 small fw-semibold" onClick={() => setShowGroupModal(false)} style={{ borderRadius: '8px', fontSize: '12px' }}>Cancel</button>
                <Button type="submit" className="btn-success px-4">
                  Create Group
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUEST DETAILS AND ACTIONS MODAL */}
      {selectedRequest && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-content" style={{ maxWidth: '650px' }}>
            <div className="custom-modal-header bg-white border-bottom-0 pt-4 px-4 pb-2">
              <h5 className="custom-modal-title fw-bold text-dark">Request Details — #{selectedRequest.id}</h5>
              <button className="custom-modal-close-btn" onClick={() => setSelectedRequest(null)}>&times;</button>
            </div>
            <div className="custom-modal-body p-4 text-start" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="mb-4">
                <h6 className="fw-bold text-dark mb-1">{selectedRequest.title}</h6>
                <p className="text-muted small mb-0">Workflow: <strong>{selectedRequest.workflow_name}</strong></p>
                <p className="text-muted small">Submitted: <strong>{new Date(selectedRequest.submitted_at).toLocaleString()}</strong></p>
              </div>

              <div className="row g-3 mb-4">
                <div className="col-6">
                  <div className="bg-light p-3 rounded">
                    <label className="text-muted small fw-bold text-uppercase d-block mb-1">Entity Details</label>
                    <span className="small text-dark fw-bold">{selectedRequest.entity_details}</span>
                  </div>
                </div>
                <div className="col-6">
                  <div className="bg-light p-3 rounded">
                    <label className="text-muted small fw-bold text-uppercase d-block mb-1">Current State</label>
                    <span className={`badge ${selectedRequest.status === 'approved' ? 'bg-success text-white' :
                        selectedRequest.status === 'rejected' ? 'bg-danger text-white' : 'bg-warning text-dark'
                      } px-2 py-0.5 rounded small`}>
                      {selectedRequest.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* A vendor's self-service request to change one already-approved document/attachment/answer */}
              {selectedRequest.request_type === 'vendor_change_request' && (
                <div className="mb-4">
                  {reviewLoading && <div className="text-muted small">Loading change request…</div>}
                  {reviewError && <div className="text-danger small">{reviewError}</div>}
                  {changeRequestDetail && (
                    <>
                      <label className="text-muted small fw-bold text-uppercase d-block mb-2">Reason given</label>
                      <div className="bg-light p-3 rounded mb-3 small text-dark">{changeRequestDetail.reason}</div>

                      <div className="row g-3">
                        <div className="col-6">
                          <label className="text-muted small fw-bold text-uppercase d-block mb-1">Current value</label>
                          <div className="border rounded p-2 small text-dark bg-light">{changeRequestDetail.oldValueSummary || '—'}</div>
                        </div>
                        <div className="col-6">
                          <label className="text-muted small fw-bold text-uppercase d-block mb-1">Proposed new value</label>
                          <div className="border rounded p-2 small text-dark bg-light">
                            {changeRequestDetail.newFileName ? (
                              <>
                                <div className="mb-1">{changeRequestDetail.newFileName}</div>
                                {changeRequestDetail.newFilePreviewUrl && (
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => setViewerDoc({ previewUrl: changeRequestDetail.newFilePreviewUrl, docName: changeRequestDetail.newFileName })}
                                  >
                                    View
                                  </button>
                                )}
                              </>
                            ) : changeRequestDetail.newAnswerJson ? (
                              (() => {
                                try {
                                  const parsed = JSON.parse(changeRequestDetail.newAnswerJson);
                                  if (parsed.rows) return `${parsed.rows.length} row${parsed.rows.length === 1 ? '' : 's'}`;
                                  if (parsed.optionIds) return `Option id(s): ${parsed.optionIds.join(', ')}`;
                                  return parsed.textValue || '—';
                                } catch { return changeRequestDetail.newAnswerJson; }
                              })()
                            ) : '—'}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Become-a-Supplier applications: full document set + extracted/verified fields */}
              {selectedRequest.request_type === 'vendor_registration' && (
                <div className="mb-4">
                  {reviewLoading && <div className="text-muted small">Loading application details…</div>}
                  {reviewError && <div className="text-danger small">{reviewError}</div>}
                  {reviewDetails && (
                    <>
                      <label className="text-muted small fw-bold text-uppercase d-block mb-2">Applicant</label>
                      <div className="bg-light p-3 rounded mb-3">
                        <div className="fw-bold text-dark">
                          {reviewDetails.registration.contactName}
                          <span className="text-muted fw-normal small ms-1">({reviewDetails.registration.designation})</span>
                        </div>
                        <div className="small text-muted">{reviewDetails.registration.email} · {reviewDetails.registration.phone}</div>
                        {reviewDetails.registration.contact2Name && (
                          <div className="small text-muted mt-1">
                            Also: {reviewDetails.registration.contact2Name} ({reviewDetails.registration.contact2Role}) — {reviewDetails.registration.contact2Email}
                          </div>
                        )}
                        <div className="row small g-2 mt-2">
                          <div className="col-4">
                            <div className="text-muted" style={{ fontSize: '10px' }}>PAN</div>
                            <div className="fw-bold text-dark">{reviewDetails.registration.panNumber || '—'}</div>
                          </div>
                          <div className="col-4">
                            <div className="text-muted" style={{ fontSize: '10px' }}>GST</div>
                            <div className="fw-bold text-dark">{reviewDetails.registration.gstNumber || '—'}</div>
                          </div>
                          <div className="col-4">
                            <div className="text-muted" style={{ fontSize: '10px' }}>CIN</div>
                            <div className="fw-bold text-dark">{reviewDetails.registration.cinNumber || '—'}</div>
                          </div>
                        </div>
                      </div>

                      <label className="text-muted small fw-bold text-uppercase d-block mb-2">Documents</label>
                      <div className="d-flex flex-column gap-2">
                        {(reviewDetails.documents || []).map((d) => {
                          const isOpen = expandedDocType === d.docType;
                          return (
                            <div key={d.docType} className="border rounded p-2 bg-light">
                              <div className="d-flex justify-content-between align-items-center">
                                <div>
                                  <div className="small fw-bold text-dark">{d.docName}</div>
                                  <div className="text-muted" style={{ fontSize: '11px' }}>
                                    {d.fileName}
                                    {d.verifyStatus === 'verified' && <span className="badge bg-success-subtle text-success ms-2">Verified</span>}
                                    {d.verifyStatus === 'error' && <span className="badge bg-danger-subtle text-danger ms-2">Not verified</span>}
                                  </div>
                                </div>
                                <div className="d-flex gap-2">
                                  {d.previewUrl && (
                                    <button
                                      type="button"
                                      className="btn btn-light btn-sm border text-success fw-bold"
                                      style={{ fontSize: '11px' }}
                                      onClick={() => handleViewDocument(d)}
                                    >
                                      View
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn btn-light btn-sm border fw-bold"
                                    style={{ fontSize: '11px' }}
                                    onClick={() => setExpandedDocType(isOpen ? null : d.docType)}
                                  >
                                    {isOpen ? 'Hide details' : 'Details'}
                                  </button>
                                </div>
                              </div>
                              {isOpen && (
                                <div className="mt-2 pt-2 border-top">
                                  <div className="row g-2">
                                    {(d.fields || []).map((f) => (
                                      <div className="col-6" key={f.key}>
                                        <div className="text-muted" style={{ fontSize: '10px' }}>{f.label}</div>
                                        <div className="small fw-bold text-dark">{f.value || '—'}</div>
                                      </div>
                                    ))}
                                  </div>
                                  {d.verifyKind && (
                                    <div className="mt-2 pt-2 border-top small">
                                      {d.verifyStatus === 'verified' && (
                                        <>
                                          <span className="badge bg-success-subtle text-success">Verified — {d.verifyMessage}</span>
                                          {!!(d.verifyDetails || []).length && (
                                            <div className="row g-2 mt-2">
                                              {d.verifyDetails.map((vd) => (
                                                <div className="col-6" key={vd.label}>
                                                  <div className="text-muted" style={{ fontSize: '10px' }}>{vd.label}</div>
                                                  <div className="small">{vd.value || '—'}</div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </>
                                      )}
                                      {d.verifyStatus === 'error' && (
                                        <span className="badge bg-danger-subtle text-danger">Could not verify — {d.verifyMessage}</span>
                                      )}
                                      {!d.verifyStatus && <span className="text-muted">Not verified yet.</span>}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {!!(reviewDetails.attachments || []).length && (
                        <div className="mt-3">
                          <label className="text-muted small fw-bold text-uppercase d-block mb-2">Other documents</label>
                          <div className="d-flex flex-column gap-2">
                            {reviewDetails.attachments.map((a) => (
                              <div key={a.id} className="border rounded p-2 bg-light d-flex justify-content-between align-items-center">
                                <div className="small fw-bold text-dark">{a.fileName}</div>
                                {a.previewUrl && (
                                  <button
                                    type="button"
                                    className="btn btn-light btn-sm border text-success fw-bold"
                                    style={{ fontSize: '11px' }}
                                    onClick={() => handleViewDocument({ previewUrl: a.previewUrl, docName: a.fileName })}
                                  >
                                    View
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {!!(reviewDetails.dynamicAnswers || []).length && (
                        <>
                          <label className="text-muted small fw-bold text-uppercase d-block mb-2 mt-3">Additional Questions</label>
                          <div className="d-flex flex-column gap-2">
                            {reviewDetails.dynamicAnswers.map((a) => (
                              <div key={a.questionId} className="bg-light p-2 rounded">
                                <div className="small fw-bold text-dark">{a.prompt}</div>
                                <div className="small text-muted">
                                  {a.questionType === 'short_text' ? (a.textValue || '—') : (a.selectedLabels || []).join(', ') || '—'}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Action History timeline */}
              <div className="mb-4">
                <label className="text-muted small fw-bold text-uppercase d-block mb-2">Audit History</label>
                <div className="d-flex flex-column gap-3">
                  {selectedRequest.history && selectedRequest.history.map((h, idx) => (
                    <div key={idx} className="d-flex gap-2 align-items-start border-start border-2 ps-3 pb-2 ms-2">
                      <div className="text-start">
                        <div className="small fw-bold text-dark">{h.user_name} <span className="badge bg-light text-muted fw-normal ms-2" style={{ fontSize: '10px' }}>{h.action}</span></div>
                        <p className="mb-0 text-muted small" style={{ fontSize: '11.5px' }}>{h.comment}</p>
                        <small className="text-muted" style={{ fontSize: '10px' }}>{new Date(h.created_at || new Date()).toLocaleString()}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Document types, per company code — every vendor is assigned to both 1000 and
                  2000 for now, and the approver multi-selects which document types the vendor may
                  transact under, within each. Decided by whichever approver acts first; read-only
                  once set. */}
              {selectedRequest.request_type === 'vendor_registration' && reviewDetails && (
                <div className="mb-4">
                  <label className="text-muted small fw-bold text-uppercase d-block mb-2">Document Types</label>
                  {reviewDetails.documentTypeSelections && reviewDetails.documentTypeSelections.length > 0 ? (
                    <div className="bg-light p-3 rounded small">
                      {VENDOR_COMPANY_CODES.map((cc) => {
                        const picks = reviewDetails.documentTypeSelections.filter((s) => s.companyCode === cc);
                        if (picks.length === 0) return null;
                        const menuByCode = Object.fromEntries((vendorDocTypeMenu[cc] || []).map((dt) => [dt.code, dt]));
                        return (
                          <div key={cc} className="mb-3">
                            <div className="text-muted fw-bold mb-1" style={{ fontSize: '11px' }}>{companyLabel(cc)}</div>
                            <table className="table table-sm mb-0 bg-white">
                              <thead>
                                <tr>
                                  <th className="text-muted" style={{ fontSize: '10.5px' }}>Vendor Type</th>
                                  <th className="text-muted" style={{ fontSize: '10.5px' }}>Vendor Type Code</th>
                                </tr>
                              </thead>
                              <tbody>
                                {picks.map((s) => (
                                  <tr key={s.docTypeCode}>
                                    <td>{vendorTypeLabel(menuByCode[s.docTypeCode]?.classification) || '—'}</td>
                                    <td>{s.docTypeCode}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      })}
                      <div className="text-muted mt-2" style={{ fontSize: '11.5px' }}>
                        Already decided by whichever approver acted first on this request.
                      </div>
                    </div>
                  ) : (
                    <div className="bg-light p-3 rounded">
                      {VENDOR_COMPANY_CODES.map((cc) => (
                        <div key={cc} className="mb-3">
                          <div className="text-muted fw-bold mb-1" style={{ fontSize: '11px' }}>{companyLabel(cc)}</div>
                          <div className="d-flex flex-wrap gap-2">
                            {(() => {
                              // One button per vendor type, not per code — picking "Product" grants
                              // every code classified as Product for this company (e.g. NB and ZNB
                              // both, for company 1000) in one action.
                              const groups = {};
                              for (const dt of (vendorDocTypeMenu[cc] || [])) {
                                const key = dt.classification || dt.code;
                                (groups[key] = groups[key] || []).push(dt.code);
                              }
                              return Object.entries(groups).map(([classification, codes]) => {
                                const cur = vendorDocTypeChoice[cc] || [];
                                const active = codes.every((c) => cur.includes(c));
                                return (
                                  <button
                                    key={classification}
                                    type="button"
                                    title={codes.join(', ')}
                                    className={`btn btn-sm ${active ? 'btn-success' : 'btn-outline-secondary'}`}
                                    onClick={() => {
                                      setVendorDocTypeChoice((prev) => {
                                        const prevCur = prev[cc] || [];
                                        const allSelected = codes.every((c) => prevCur.includes(c));
                                        return {
                                          ...prev,
                                          [cc]: allSelected
                                            ? prevCur.filter((v) => !codes.includes(v))
                                            : [...new Set([...prevCur, ...codes])],
                                        };
                                      });
                                      setVendorCategoryError('');
                                    }}
                                  >
                                    {vendorTypeLabel(classification) || classification}
                                  </button>
                                );
                              });
                            })()}
                            {(vendorDocTypeMenu[cc] || []).length === 0 && (
                              <span className="text-muted small">Loading…</span>
                            )}
                          </div>
                        </div>
                      ))}
                      <div className="text-muted" style={{ fontSize: '11.5px' }}>
                        Not yet decided — pick one or more per company, required before this request can be approved. Whoever approves first sets it.
                      </div>
                      {vendorCategoryError && <div className="text-danger small mt-2">{vendorCategoryError}</div>}
                    </div>
                  )}
                </div>
              )}

              {/* Current stage's approval trail — who in the group has voted, their comment and
                  when, plus who's still outstanding. Visible to everyone in the trail, not just
                  whoever hasn't voted yet, so a "unanimous"/"sequential" group can see progress
                  instead of just a flat "pending". */}
              {activeStage && activeStageMembers.length > 1 && (
                <div className="mb-4">
                  <label className="text-muted small fw-bold text-uppercase d-block mb-2">
                    Approval Progress
                    {activeStage.voting_rule && (
                      <span className="badge bg-light text-muted fw-normal ms-2 text-lowercase" style={{ fontSize: '10px' }}>
                        {activeStage.voting_rule === 'all' ? 'unanimous' : activeStage.voting_rule}
                      </span>
                    )}
                  </label>
                  <div className="d-flex flex-column gap-2">
                    {[...activeStageMembers]
                      .sort((a, b) => (a.sequential_order || 0) - (b.sequential_order || 0))
                      .map((member) => {
                        const vote = activeStageActions.find(a => a.approver_id === member.user_id);
                        const isMe = member.user_id === userId;
                        return (
                          <div key={member.user_id} className="d-flex align-items-start justify-content-between bg-light p-2 rounded">
                            <div className="text-start">
                              <div className="small fw-bold text-dark">
                                {member.name}{isMe && <span className="text-muted fw-normal"> (you)</span>}
                              </div>
                              {vote?.comment && (
                                <p className="mb-0 text-muted small" style={{ fontSize: '11.5px' }}>{vote.comment}</p>
                              )}
                              {vote && (
                                <small className="text-muted" style={{ fontSize: '10px' }}>
                                  {new Date(vote.acted_at).toLocaleString()}
                                </small>
                              )}
                            </div>
                            {vote ? (
                              <span className={`badge ${vote.decision === 'approved' ? 'bg-success' : 'bg-danger'} bg-opacity-10 ${vote.decision === 'approved' ? 'text-success' : 'text-danger'} border ${vote.decision === 'approved' ? 'border-success' : 'border-danger'} border-opacity-25 px-2 py-1 flex-shrink-0`} style={{ fontSize: '10px' }}>
                                {vote.decision === 'approved' ? 'Approved' : 'Rejected'}
                              </span>
                            ) : (
                              <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-2 py-1 flex-shrink-0" style={{ fontSize: '10px' }}>
                                Pending
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Approve / Reject Controls */}
              {selectedRequest.status === 'pending' && (
                myStageAction ? (
                  <div className="border-top pt-3 mt-3">
                    <div className="bg-light p-3 rounded small">
                      <span className={`badge ${myStageAction.decision === 'approved' ? 'bg-success' : 'bg-danger'} bg-opacity-10 ${myStageAction.decision === 'approved' ? 'text-success' : 'text-danger'} border ${myStageAction.decision === 'approved' ? 'border-success' : 'border-danger'} border-opacity-25 px-3 py-2`}>
                        You already {myStageAction.decision === 'approved' ? 'approved' : 'rejected'} this stage
                      </span>
                      <div className="text-muted mt-2" style={{ fontSize: '11.5px' }}>
                        {outstandingApprovers.length > 0
                          ? `Waiting on ${outstandingApprovers.map(m => m.name).join(', ')} before this stage moves on.`
                          : 'Waiting for the stage to finish processing.'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-top pt-3 mt-3">
                    {actionError && <div className="alert alert-danger py-2 small mb-3">{actionError}</div>}
                    <label className="form-label fw-bold text-muted small">Approval / Rejection Comment *</label>
                    <textarea className="form-control mb-3" rows="2" placeholder="Provide feedback notes..." value={actionComment} onChange={(e) => setActionComment(e.target.value)} required />
                    <div className="d-flex gap-2">
                      <button onClick={handleApproveClick} disabled={decidingCategory} className="btn btn-success flex-grow-1 py-2 fw-bold" style={{ backgroundColor: '#293383', borderColor: '#293383' }}>
                        <i className="fas fa-check-circle me-1"></i> {decidingCategory ? 'Saving…' : 'Approve Stage'}
                      </button>
                      <button onClick={() => processRequestAction('reject')} className="btn btn-danger flex-grow-1 py-2 fw-bold">
                        <i className="fas fa-times-circle me-1"></i> Reject Request
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      <SecureDocumentViewer
        show={!!viewerDoc}
        fetchUrl={viewerDoc?.previewUrl}
        title={viewerDoc?.docName}
        onClose={() => setViewerDoc(null)}
      />
    </div>
  );
};

export default AdminWorkflows;
