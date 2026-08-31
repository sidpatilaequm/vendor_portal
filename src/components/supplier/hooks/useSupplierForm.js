import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import axios from 'axios';
import { DOCS, fieldError } from '../data';
import { fmtSize, nowStr } from '../lib/utils';
import { computeReadiness } from '../lib/validation';

// Ported from become-a-supplier/app/become-a-supplier/hooks/useSupplierForm.ts, rewired to
// backend_java's real /api/public/supplier-registration/** endpoints (document upload there
// runs OCR *and* the FolderIt upload in one call, unlike the original's two separate ones) and
// WorkFlow-backed submit, instead of the prototype's in-memory mock backend.

function docForField(key) {
  return DOCS.find((d) => {
    if (!d.verifyKind) return false;
    if (d.verifyKind === 'bank') return key === 'acctNo' || key === 'ifsc' || key === 'benName';
    return d.fields[0].k === key;
  });
}

const initialState = {
  code: null,
  registrationId: null,
  email: null,
  docs: {},
  // Free-form extra files with no fixed slot — array of {localId, id?, name, size, url, status,
  // remoteStatus}. Keyed by an array, not an object like docs, since there's no docType to key by.
  extraFiles: [],
  fields: {},
  src: {},
  businessTypes: [],
  equipmentFacilities: [],
  directors: [],
  machinery: [],
  // Admin-defined questionnaire (Questionnaire tab in the admin panel) — null until fetched, or
  // if none is currently published+active. { textValue?, optionIds? } per questionId once answered.
  questionnaire: null,
  dynamicAnswers: {},
  contactsCount: 1,
  primaryContact: 1,
  declaration: false,
  submitted: false,
  dirty: false,
  savedAt: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'INGEST_START':
      return { ...state, docs: { ...state.docs, [action.docId]: action.file } };

    case 'UPLOAD_DONE': {
      const doc = state.docs[action.docId];
      if (!doc) return state;
      const fields = { ...state.fields };
      const src = { ...state.src };
      Object.entries(action.values).forEach(([k, v]) => {
        if (!v) return;
        if (fields[k] && src[k] === 'you') return;
        fields[k] = v;
        src[k] = action.docId;
      });
      return {
        ...state,
        registrationId: action.registrationId || state.registrationId,
        docs: {
          ...state.docs,
          [action.docId]: { ...doc, status: 'read', remoteStatus: 'uploaded', remoteFileUid: action.folderItFileUid },
        },
        fields,
        src,
        dirty: true,
      };
    }

    case 'UPLOAD_ERROR': {
      const doc = state.docs[action.docId];
      if (!doc) return state;
      return { ...state, docs: { ...state.docs, [action.docId]: { ...doc, status: 'read', remoteStatus: 'error' } } };
    }

    case 'VERIFY_START': {
      const doc = state.docs[action.docId];
      if (!doc) return state;
      return {
        ...state,
        docs: { ...state.docs, [action.docId]: { ...doc, verifyStatus: 'checking', verifyMessage: undefined, verifyDetails: undefined } },
      };
    }

    case 'VERIFY_DONE': {
      const doc = state.docs[action.docId];
      if (!doc) return state;
      return {
        ...state,
        docs: { ...state.docs, [action.docId]: { ...doc, verifyStatus: 'verified', verifyMessage: action.message, verifyDetails: action.details } },
      };
    }

    case 'VERIFY_ERROR': {
      const doc = state.docs[action.docId];
      if (!doc) return state;
      return { ...state, docs: { ...state.docs, [action.docId]: { ...doc, verifyStatus: 'error', verifyMessage: action.message } } };
    }

    case 'REMOVE_DOC': {
      const docDef = DOCS.find((d) => d.id === action.docId);
      const docs = { ...state.docs };
      delete docs[action.docId];
      const fields = { ...state.fields };
      const src = { ...state.src };
      docDef?.fields.forEach((f) => {
        if (src[f.k] === action.docId) {
          delete src[f.k];
          fields[f.k] = '';
        }
      });
      return { ...state, docs, fields, src, dirty: true };
    }

    case 'EXTRA_FILE_START':
      return { ...state, extraFiles: [...state.extraFiles, action.file] };

    case 'EXTRA_FILE_DONE':
      return {
        ...state,
        registrationId: action.registrationId || state.registrationId,
        extraFiles: state.extraFiles.map((f) =>
          f.localId === action.localId ? { ...f, status: 'read', remoteStatus: 'uploaded', id: action.id } : f
        ),
        dirty: true,
      };

    case 'EXTRA_FILE_ERROR':
      return { ...state, extraFiles: state.extraFiles.filter((f) => f.localId !== action.localId) };

    case 'REMOVE_EXTRA_FILE':
      return { ...state, extraFiles: state.extraFiles.filter((f) => f.localId !== action.localId), dirty: true };

    case 'SET_FIELD': {
      const src = { ...state.src };
      if (src[action.key] && src[action.key] !== 'you') src[action.key] = 'you';
      return { ...state, fields: { ...state.fields, [action.key]: action.value }, src, dirty: true };
    }

    case 'SET_DECLARATION':
      return { ...state, declaration: action.value, dirty: true };

    case 'SET_QUESTIONNAIRE':
      return { ...state, questionnaire: action.questionnaire };

    case 'SET_DYNAMIC_ANSWER': {
      const current = state.dynamicAnswers[action.questionId] || {};
      return {
        ...state,
        dynamicAnswers: { ...state.dynamicAnswers, [action.questionId]: { ...current, ...action.patch } },
        dirty: true,
      };
    }

    case 'TOGGLE_LIST': {
      const arr = state[action.list] || [];
      const has = arr.includes(action.value);
      const next = has ? arr.filter((v) => v !== action.value) : [...arr, action.value];
      return { ...state, [action.list]: next, dirty: true };
    }

    case 'ADD_ROW':
      return { ...state, [action.list]: [...state[action.list], action.row], dirty: true };

    case 'UPDATE_ROW': {
      const rows = state[action.list].map((r, i) => (i === action.index ? { ...r, [action.key]: action.value } : r));
      return { ...state, [action.list]: rows, dirty: true };
    }

    case 'REMOVE_ROW': {
      const rows = state[action.list].filter((_, i) => i !== action.index);
      return { ...state, [action.list]: rows, dirty: true };
    }

    case 'SET_CONTACTS_COUNT':
      return { ...state, contactsCount: action.count, primaryContact: action.count === 1 ? 1 : state.primaryContact, dirty: true };

    case 'SET_PRIMARY_CONTACT':
      return { ...state, primaryContact: action.n, dirty: true };

    case 'SET_EMAIL':
      return { ...state, email: action.email };

    case 'SET_CODE':
      return { ...state, code: action.code };

    case 'SET_REGISTRATION_ID':
      // Always sync to the server's answer — a draft save is authoritative about which
      // row it actually saved to, even if that differs from whatever was in state before.
      return { ...state, registrationId: action.registrationId };

    case 'MARK_SAVED':
      return { ...state, savedAt: action.at, dirty: false };

    case 'SUBMIT':
      return { ...state, submitted: true, dirty: false };

    case 'LOAD_DRAFT':
      return {
        ...state,
        code: action.code,
        registrationId: action.registrationId,
        email: action.email,
        fields: { ...action.fields },
        src: { ...action.src },
        businessTypes: [...action.businessTypes],
        equipmentFacilities: [...action.equipmentFacilities],
        directors: [...action.directors],
        machinery: [...action.machinery],
        dynamicAnswers: { ...action.dynamicAnswers },
        contactsCount: action.contactsCount,
        primaryContact: action.primaryContact,
        declaration: action.declaration,
        docs: { ...action.docs },
        extraFiles: [...action.extraFiles],
        submitted: false,
        dirty: false,
      };

    default:
      return state;
  }
}

export function useSupplierForm() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [toast, setToast] = useState(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [resumeMessage, setResumeMessage] = useState(null);
  const [submission, setSubmission] = useState(null);
  const saveTimer = useRef(null);
  const verifyTimers = useRef({});
  const toastId = useRef(0);
  // Coordinates concurrent document uploads so they all attach to the same registration
  // instead of racing: state.registrationId only updates on the next render, so two
  // uploads fired close together (e.g. dropping several files at once) could each still
  // see it as null and independently create their own separate draft. registrationIdRef
  // is set synchronously the instant it's known; pendingFirstUpload lets any upload that
  // starts before the first one resolves wait for that same id instead of minting its own.
  const registrationIdRef = useRef(null);
  const pendingFirstUpload = useRef(null);

  const readiness = useMemo(() => computeReadiness(state), [state]);

  // Fetched once — whichever questionnaire the admin has published + marked active, if any.
  // Empty {} (not null) means "no active questionnaire", same as the backend returns.
  useEffect(() => {
    axios
      .get('/api/public/supplier-registration/questionnaire')
      .then(({ data }) => {
        if (data && data.processId) dispatch({ type: 'SET_QUESTIONNAIRE', questionnaire: data });
      })
      .catch(() => {});
  }, []);

  const setDynamicAnswer = useCallback((questionId, patch) => dispatch({ type: 'SET_DYNAMIC_ANSWER', questionId, patch }), []);

  const showToast = useCallback((html, ms = 5200) => {
    toastId.current += 1;
    const id = toastId.current;
    setToast({ id, html });
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), ms);
  }, []);

  const primaryEmail = state.fields.c1_email || '';

  const runVerify = useCallback((doc, updatedFields, registrationId) => {
    if (!doc.verifyKind || !registrationId) return;

    if (doc.verifyKind === 'bank') {
      const acct = updatedFields.acctNo || '';
      const ifsc = updatedFields.ifsc || '';
      const name = updatedFields.benName || '';
      if (!acct || !ifsc || !name) return;
      if (fieldError('acctNo', acct) || fieldError('ifsc', ifsc)) return;
    } else {
      const value = updatedFields[doc.fields[0].k] || '';
      if (!value) return;
      if (fieldError(doc.fields[0].k, value)) return;
    }

    if (verifyTimers.current[doc.id]) clearTimeout(verifyTimers.current[doc.id]);
    verifyTimers.current[doc.id] = setTimeout(async () => {
      dispatch({ type: 'VERIFY_START', docId: doc.id });
      try {
        const { data } = await axios.post('/api/public/supplier-registration/verify', null, {
          params: { registrationId, docType: doc.id },
        });
        const result = data.data?.result || {};
        if (result.verified) {
          dispatch({ type: 'VERIFY_DONE', docId: doc.id, message: result.message, details: result.details || [] });
        } else {
          dispatch({ type: 'VERIFY_ERROR', docId: doc.id, message: result.message });
        }
      } catch (err) {
        dispatch({ type: 'VERIFY_ERROR', docId: doc.id, message: 'Verification unavailable' });
      }
    }, 600);
  }, []);

  const setField = useCallback(
    (key, value) => {
      dispatch({ type: 'SET_FIELD', key, value });
      const doc = docForField(key);
      if (doc) runVerify(doc, { ...state.fields, [key]: value }, state.registrationId);
    },
    [state.fields, state.registrationId, runVerify]
  );

  const setDeclaration = useCallback((value) => dispatch({ type: 'SET_DECLARATION', value }), []);
  const toggleListValue = useCallback((list, value) => dispatch({ type: 'TOGGLE_LIST', list, value }), []);
  const addRow = useCallback((list, row) => dispatch({ type: 'ADD_ROW', list, row }), []);
  const updateRow = useCallback((list, index, key, value) => dispatch({ type: 'UPDATE_ROW', list, index, key, value }), []);
  const removeRow = useCallback((list, index) => dispatch({ type: 'REMOVE_ROW', list, index }), []);
  const setContactsCount = useCallback((count) => dispatch({ type: 'SET_CONTACTS_COUNT', count }), []);
  const setPrimaryContact = useCallback((n) => dispatch({ type: 'SET_PRIMARY_CONTACT', n }), []);

  const ingestFile = useCallback(
    async (docId, file) => {
      const prev = state.docs[docId];
      if (prev?.url) URL.revokeObjectURL(prev.url);

      const uploaded = { name: file.name, size: file.size, type: file.type, at: nowStr(), url: URL.createObjectURL(file), status: 'reading' };
      dispatch({ type: 'INGEST_START', docId, file: uploaded });

      try {
        // If another upload that started just before this one is still the one creating
        // the registration, wait for it instead of also uploading with no id — otherwise
        // both would independently create their own separate draft.
        let knownId = registrationIdRef.current;
        if (!knownId && pendingFirstUpload.current) {
          knownId = await pendingFirstUpload.current;
        }

        const form = new FormData();
        form.append('file', file);
        const params = knownId ? { registrationId: knownId } : {};
        const uploadPromise = axios.post(`/api/public/supplier-registration/documents/${docId}`, form, {
          params,
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        // We're the first upload with no known id yet — claim the "pioneer" slot so any
        // sibling upload that starts before we resolve waits for our result instead of
        // racing to create its own registration.
        const isPioneer = !knownId && !pendingFirstUpload.current;
        if (isPioneer) {
          pendingFirstUpload.current = uploadPromise
            .then((res) => res.data.data?.result?.registrationId)
            .finally(() => { pendingFirstUpload.current = null; });
        }

        const { data } = await uploadPromise;
        const result = data.data?.result || {};
        if (result.registrationId) registrationIdRef.current = result.registrationId;
        dispatch({ type: 'UPLOAD_DONE', docId, values: result.values || {}, folderItFileUid: result.folderItFileUid, registrationId: result.registrationId });

        const docDef = DOCS.find((d) => d.id === docId);
        if (docDef) runVerify(docDef, { ...state.fields, ...(result.values || {}) }, result.registrationId || knownId);

        if (result.uncertain?.length) {
          const labels = result.uncertain
            .map((k) => docDef?.fields.find((f) => f.k === k)?.label || k)
            .join(', ');
          showToast(`${labels} didn't read the same way twice — please check ${result.uncertain.length === 1 ? 'it' : 'them'} against the document.`);
        }
      } catch (err) {
        dispatch({ type: 'UPLOAD_ERROR', docId });
        showToast(`Could not read ${file.name} automatically — fill in the fields yourself.`);
      }
    },
    [state.docs, state.fields, showToast, runVerify]
  );

  const removeDoc = useCallback(
    (docId) => {
      const f = state.docs[docId];
      if (f?.url) URL.revokeObjectURL(f.url);
      dispatch({ type: 'REMOVE_DOC', docId });
    },
    [state.docs]
  );

  // Extra files: no fixed slot (any number, appended to a list), no OCR/verify — otherwise the
  // same upload mechanics and "pioneer" registration-id coordination as ingestFile above.
  let extraFileSeed = 0;
  const uploadExtraFile = useCallback(
    async (file) => {
      const localId = `extra-${Date.now()}-${extraFileSeed++}`;
      const uploaded = { localId, name: file.name, size: file.size, url: URL.createObjectURL(file), status: 'reading' };
      dispatch({ type: 'EXTRA_FILE_START', file: uploaded });

      try {
        let knownId = registrationIdRef.current;
        if (!knownId && pendingFirstUpload.current) {
          knownId = await pendingFirstUpload.current;
        }

        const form = new FormData();
        form.append('file', file);
        const params = knownId ? { registrationId: knownId } : {};
        const uploadPromise = axios.post('/api/public/supplier-registration/attachments', form, {
          params,
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const isPioneer = !knownId && !pendingFirstUpload.current;
        if (isPioneer) {
          pendingFirstUpload.current = uploadPromise
            .then((res) => res.data.data?.result?.registrationId)
            .finally(() => { pendingFirstUpload.current = null; });
        }

        const { data } = await uploadPromise;
        const result = data.data?.result || {};
        if (result.registrationId) registrationIdRef.current = result.registrationId;
        dispatch({ type: 'EXTRA_FILE_DONE', localId, id: result.attachmentId, registrationId: result.registrationId });
      } catch (err) {
        URL.revokeObjectURL(uploaded.url);
        dispatch({ type: 'EXTRA_FILE_ERROR', localId });
        showToast(`Could not upload ${file.name}.`);
      }
    },
    [showToast]
  );

  // The file behind one dynamic file_upload question's answer — same upload mechanics as
  // uploadExtraFile (no OCR, "pioneer" registration-id coordination), but tagged with the
  // question id server-side (uploadQuestionFile) instead of being a free-form attachment, and
  // stored into dynamicAnswers[questionId].textValue (the filename) rather than a separate
  // files list, since a file_upload question's answer IS that one file.
  const uploadDynamicQuestionFile = useCallback(
    async (questionId, file) => {
      setDynamicAnswer(questionId, { uploadStatus: 'reading', fileName: file.name });
      try {
        let knownId = registrationIdRef.current;
        if (!knownId && pendingFirstUpload.current) {
          knownId = await pendingFirstUpload.current;
        }

        const form = new FormData();
        form.append('file', file);
        const params = knownId ? { registrationId: knownId } : {};
        const uploadPromise = axios.post(`/api/public/supplier-registration/dynamic-question-file/${questionId}`, form, {
          params,
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const isPioneer = !knownId && !pendingFirstUpload.current;
        if (isPioneer) {
          pendingFirstUpload.current = uploadPromise
            .then((res) => res.data.data?.result?.registrationId)
            .finally(() => { pendingFirstUpload.current = null; });
        }

        const { data } = await uploadPromise;
        const result = data.data?.result || {};
        if (result.registrationId) registrationIdRef.current = result.registrationId;
        setDynamicAnswer(questionId, { textValue: result.fileName || file.name, uploadStatus: 'done', fileName: result.fileName || file.name });
      } catch (err) {
        setDynamicAnswer(questionId, { textValue: '', uploadStatus: 'error', fileName: '' });
        showToast(`Could not upload ${file.name}.`);
      }
    },
    [showToast, setDynamicAnswer]
  );

  const removeExtraFile = useCallback(
    (localId) => {
      const f = state.extraFiles.find((x) => x.localId === localId);
      if (f?.url) URL.revokeObjectURL(f.url);
      dispatch({ type: 'REMOVE_EXTRA_FILE', localId });
      if (f?.id) {
        axios.delete(`/api/public/supplier-registration/attachments/${f.id}`).catch(() => {});
      }
    },
    [state.extraFiles]
  );

  function buildDraftPayload(explicitSave) {
    const f = state.fields;
    return {
      registrationId: state.registrationId,
      resumeCode: state.code,
      // True only for a deliberate "Save draft" click — never for the silent ~3s background
      // autosave — so the draft-saved email fires on every explicit save instead of a single
      // one-time trigger, without turning into an email per keystroke while someone's typing.
      explicitSave: !!explicitSave,
      // Name/designation/phone and the second-contact concept were dropped from the "Who we
      // deal with" section — only the primary email remains, so contact1Email is the only one
      // of these still filled in; contact2* and primaryContact stay in the payload only because
      // the backend DTO/entity still has the columns (nullable, unused going forward).
      contact1Email: f.c1_email || '',
      primaryContact: 1,
      businessTypes: state.businessTypes.join(','),
      businessScope: f.businessScope || '',
      companyType: f.companyType || '',
      telephone: f.telephone || '',
      fax: f.fax || '',
      weeklyOff: f.weeklyOff || '',
      annualTurnover: f.annualTurnover || '',
      turnoverYear: f.turnoverYear || '',
      regulatoryActs: f.regulatoryActs || '',
      manpowerOffice: f.manpowerOffice || '',
      manpowerSupervisor: f.manpowerSupervisor || '',
      manpowerWorkmen: f.manpowerWorkmen || '',
      shiftsPerDay: f.shiftsPerDay || '',
      spareCapacity: f.spareCapacity || '',
      floorSpace: f.floorSpace || '',
      equipmentFacilities: state.equipmentFacilities.join(','),
      directorsJson: JSON.stringify(state.directors),
      machineryJson: JSON.stringify(state.machinery),
      dynamicAnswersJson: JSON.stringify(
        Object.entries(state.dynamicAnswers).map(([questionId, a]) => ({ questionId: Number(questionId), ...a }))
      ),
      dynamicQuestionnaireProcessId: state.questionnaire?.processId ?? null,
      declarationAccepted: state.declaration,
      gstNumber: f.gstin || '',
      panNumber: f.pan || '',
      msmeNumber: f.udyam || '',
      cinNumber: f.cin || '',
      beneficiaryName: f.benName || '',
      accountNumber: f.acctNo || '',
      ifscCode: f.ifsc || '',
      isoCertificateNo: f.isoNo || '',
      isoCertifyingBody: f.isoBody || '',
      isoExpiry: f.isoExpiry || '',
      iso14001CertificateNo: f.iso14001No || '',
      iso14001CertifyingBody: f.iso14001Body || '',
      iso14001Expiry: f.iso14001Expiry || '',
      iso45001CertificateNo: f.iso45001No || '',
      iso45001CertifyingBody: f.iso45001Body || '',
      iso45001Expiry: f.iso45001Expiry || '',
      iso27001CertificateNo: f.iso27001No || '',
      iso27001CertifyingBody: f.iso27001Body || '',
      iso27001Expiry: f.iso27001Expiry || '',
      as9100dCertificateNo: f.asNo || '',
      as9100dCertifyingBody: f.asBody || '',
      as9100dExpiry: f.asExpiry || '',
      nadcapCertificateNo: f.nadcapNo || '',
      nadcapExpiry: f.nadcapExpiry || '',
    };
  }

  const commitSave = useCallback(async (explicitSave) => {
    try {
      const { data } = await axios.post('/api/public/supplier-registration/draft', buildDraftPayload(explicitSave));
      const result = data.data?.result || {};
      dispatch({ type: 'SET_CODE', code: result.resumeCode });
      dispatch({ type: 'SET_REGISTRATION_ID', registrationId: result.registrationId });
      registrationIdRef.current = result.registrationId;
      const at = 'Saved ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      dispatch({ type: 'MARK_SAVED', at });
      showToast(`Draft <b>${result.resumeCode}</b> saved${explicitSave ? ` and emailed to ${state.email}` : ''}.`);
    } catch (err) {
      showToast('Could not save your draft — please try again.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, showToast]);

  const saveDraft = useCallback(() => {
    if (!state.email) {
      setEmailDialogOpen(true);
      return;
    }
    commitSave(true);
  }, [state.email, commitSave]);

  const confirmEmailAndSave = useCallback(
    (email) => {
      dispatch({ type: 'SET_EMAIL', email });
      if (!state.fields.c1_email) {
        setField('c1_email', email);
      }
      setEmailDialogOpen(false);
      setTimeout(() => commitSave(true), 0);
    },
    [state.fields, setField, commitSave]
  );

  const resumeDraft = useCallback(async (rawCode) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    try {
      const { data } = await axios.get(`/api/public/supplier-registration/draft/${code}`);
      const result = data.data?.result || {};
      const reg = result.registration || {};

      // Only a fresh DRAFT or a REJECTED application (sent back to fix something) can be
      // reopened for editing — anything already in flight or resolved gets a status message
      // instead of being dropped into an editable form. Mirrors the same EDITABLE_STATUSES
      // gate the backend now enforces on saveDraft/submit, so this is UX, not the only guard.
      const NOT_RESUMABLE_MESSAGES = {
        REGISTRATION_SUBMITTED: 'This application has already been submitted and is awaiting a decision.',
        ESCALATED: 'This application is under additional review — our team will be in touch.',
        ACTIVE: 'This application was already approved. Check your email for your supplier login.',
        CANCELLED: 'This application was cancelled.',
      };
      if (NOT_RESUMABLE_MESSAGES[reg.status]) {
        setResumeMessage({ text: NOT_RESUMABLE_MESSAGES[reg.status], ok: false });
        return;
      }

      const fields = {
        // Name/designation/phone and the second-contact concept are gone — but a draft saved
        // before that change might have had contact 2 marked primary, with the real working
        // email sitting in contact2Email rather than contact1Email. reg.email is the backend's
        // already-resolved "whichever contact was primary" mirror, so fall back to it rather
        // than risk surfacing a blank email for a returning vendor.
        c1_email: reg.contact1Email || (reg.email && !reg.email.includes('@placeholder.local') ? reg.email : '') || '',
        businessScope: reg.businessScope || '', companyType: reg.companyType || '',
        telephone: reg.telephone || '', fax: reg.fax || '', weeklyOff: reg.weeklyOff || '',
        annualTurnover: reg.annualTurnover || '', turnoverYear: reg.turnoverYear || '',
        regulatoryActs: reg.regulatoryActs || '',
        manpowerOffice: reg.manpowerOffice || '', manpowerSupervisor: reg.manpowerSupervisor || '',
        manpowerWorkmen: reg.manpowerWorkmen || '', shiftsPerDay: reg.shiftsPerDay || '',
        spareCapacity: reg.spareCapacity || '', floorSpace: reg.floorSpace || '',
        gstin: reg.gstNumber || '', pan: reg.panNumber || '', udyam: reg.msmeNumber || '', cin: reg.cinNumber || '',
        benName: reg.beneficiaryName || '', acctNo: reg.accountNumber || '', ifsc: reg.ifscCode || '',
        isoNo: reg.isoCertificateNo || '', isoBody: reg.isoCertifyingBody || '', isoExpiry: reg.isoExpiry || '',
        iso14001No: reg.iso14001CertificateNo || '', iso14001Body: reg.iso14001CertifyingBody || '', iso14001Expiry: reg.iso14001Expiry || '',
        iso45001No: reg.iso45001CertificateNo || '', iso45001Body: reg.iso45001CertifyingBody || '', iso45001Expiry: reg.iso45001Expiry || '',
        iso27001No: reg.iso27001CertificateNo || '', iso27001Body: reg.iso27001CertifyingBody || '', iso27001Expiry: reg.iso27001Expiry || '',
        asNo: reg.as9100dCertificateNo || '', asBody: reg.as9100dCertifyingBody || '', asExpiry: reg.as9100dExpiry || '',
        nadcapNo: reg.nadcapCertificateNo || '', nadcapExpiry: reg.nadcapExpiry || '',
      };
      const src = {};
      const docs = {};
      (result.documents || []).forEach((d) => {
        docs[d.docType] = {
          name: d.fileName, size: 0, type: '', at: '', url: null,
          status: 'read', remoteStatus: 'uploaded', remoteFileUid: d.folderItFileUid,
          verifyStatus: d.verifyStatus === 'verified' ? 'verified' : undefined,
        };
        Object.keys(d.values || {}).forEach((k) => { src[k] = d.docType; });
      });
      const extraFiles = (result.attachments || []).map((a) => ({
        localId: `extra-remote-${a.id}`, id: a.id, name: a.fileName, size: 0, url: null,
        status: 'read', remoteStatus: 'uploaded',
      }));

      registrationIdRef.current = reg.id;
      dispatch({
        type: 'LOAD_DRAFT',
        code,
        registrationId: reg.id,
        email: reg.email?.includes('@placeholder.local') ? null : reg.email,
        fields,
        src,
        businessTypes: reg.businessTypes ? reg.businessTypes.split(',').filter(Boolean) : [],
        equipmentFacilities: reg.equipmentFacilities ? reg.equipmentFacilities.split(',').filter(Boolean) : [],
        directors: reg.directorsJson ? JSON.parse(reg.directorsJson) : [],
        machinery: reg.machineryJson ? JSON.parse(reg.machineryJson) : [],
        dynamicAnswers: reg.dynamicAnswersJson
          ? Object.fromEntries(JSON.parse(reg.dynamicAnswersJson).map(({ questionId, ...rest }) => [questionId, rest]))
          : {},
        contactsCount: 1,
        primaryContact: 1,
        declaration: !!reg.declarationAccepted,
        docs,
        extraFiles,
      });
      setResumeMessage(
        reg.status === 'REJECTED'
          ? { text: 'This application was rejected — update what needs fixing below and resubmit.', ok: true }
          : { text: 'Draft restored, documents and all.', ok: true }
      );
    } catch (err) {
      setResumeMessage({ text: 'No draft found with that code.', ok: false });
    }
  }, []);

  const submit = useCallback(async () => {
    if (!readiness.canSubmit || !state.registrationId) return false;
    try {
      // Save first so the latest edits are persisted, then submit against whichever
      // registrationId that save actually resolved to — not the possibly-stale value
      // already in state, since a draft save can create a *different* row (e.g. if the
      // one in state no longer exists server-side).
      const { data } = await axios.post('/api/public/supplier-registration/draft', buildDraftPayload());
      const draftResult = data.data?.result || {};
      const savedRegistrationId = draftResult.registrationId || state.registrationId;
      const savedCode = draftResult.resumeCode || state.code;
      dispatch({ type: 'SET_REGISTRATION_ID', registrationId: savedRegistrationId });
      if (savedCode) dispatch({ type: 'SET_CODE', code: savedCode });
      registrationIdRef.current = savedRegistrationId;

      await axios.post('/api/public/supplier-registration/submit', null, { params: { registrationId: savedRegistrationId } });
      dispatch({ type: 'SUBMIT' });
      const files = DOCS.filter((d) => state.docs[d.id]).map((d) => ({
        label: d.name,
        fileName: state.docs[d.id].name,
        size: fmtSize(state.docs[d.id].size),
      }));
      setSubmission({
        ref: savedCode || String(savedRegistrationId),
        legalName: state.fields.benName || '',
        primaryEmail: state.fields.c1_email || '',
        files,
      });
      return true;
    } catch (err) {
      showToast(err.response?.data?.statusMsg || 'Could not submit — please check the required fields.');
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readiness.canSubmit, state, showToast]);

  const scheduleAutosave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (state.dirty && state.registrationId && state.email) commitSave();
    }, 3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dirty, state.registrationId, state.email, commitSave]);

  return {
    state,
    readiness,
    toast,
    emailDialogOpen,
    setEmailDialogOpen,
    resumeMessage,
    submission,
    primaryEmail,
    setField,
    setDeclaration,
    toggleListValue,
    addRow,
    updateRow,
    removeRow,
    setDynamicAnswer,
    uploadDynamicQuestionFile,
    setContactsCount,
    setPrimaryContact,
    ingestFile,
    removeDoc,
    uploadExtraFile,
    removeExtraFile,
    saveDraft,
    confirmEmailAndSave,
    resumeDraft,
    submit,
    scheduleAutosave,
  };
}
