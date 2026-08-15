import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { DOCS, fieldError } from './data';
import DocUploadCard from './DocUploadCard';
import Input from '../common/Input';
import Button from '../common/Button';

const STEPS = [
  { n: 1, label: 'Documents' },
  { n: 2, label: 'Your details' },
  { n: 3, label: 'Review & submit' },
];

const emptyFields = {
  vendorName: '', address: '', contactName: '', designation: '', email: '', phone: '',
};

// "Become a Supplier" — ported from the become-a-supplier Next.js prototype's document
// upload + OCR + KYC verification flow, rebuilt with vendor_portal's own Bootstrap-based
// components instead of that prototype's CSS. Backed by backend_java's
// /api/public/supplier-registration/** endpoints (see SupplierRegistrationController.java).
const SupplierRegistrationPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [registrationId, setRegistrationId] = useState(null);
  const [resumeCode, setResumeCode] = useState(null);
  const [resumeInput, setResumeInput] = useState('');
  const [fields, setFields] = useState(emptyFields);
  const [docs, setDocs] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const setDocState = (docId, patch) =>
    setDocs((prev) => ({ ...prev, [docId]: { ...prev[docId], ...patch } }));

  const handleUpload = async (docId, file) => {
    setDocState(docId, { status: 'reading', fileName: file.name });
    try {
      const form = new FormData();
      form.append('file', file);
      const params = registrationId ? { registrationId } : {};
      const { data } = await axios.post(
        `/api/public/supplier-registration/documents/${docId}`,
        form,
        { params, headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const result = data.data?.result || {};
      if (!registrationId && result.registrationId) setRegistrationId(result.registrationId);

      const values = result.values || {};
      const uncertain = result.uncertain || [];
      const source = {};
      Object.keys(values).forEach((k) => { source[k] = 'ocr'; });

      setDocState(docId, { status: 'read', values, source, uncertain, fileName: file.name });
    } catch (err) {
      setDocState(docId, { status: 'error', fileName: file.name });
      setMessage({ type: 'danger', text: err.response?.data?.statusMsg || 'Could not process that document.' });
    }
  };

  const handleFieldChange = (docId, key, value) => {
    setDocs((prev) => ({
      ...prev,
      [docId]: {
        ...prev[docId],
        values: { ...prev[docId]?.values, [key]: value },
        source: { ...prev[docId]?.source, [key]: 'you' },
      },
    }));
  };

  const handleVerify = async (docId) => {
    setDocState(docId, { status: 'verifying' });
    try {
      const { data } = await axios.post('/api/public/supplier-registration/verify', null, {
        params: { registrationId, docType: docId },
      });
      const result = data.data?.result || {};
      setDocState(docId, {
        status: result.verified ? 'verified' : 'error',
        verifyMessage: result.message,
        verifyDetails: result.details || [],
      });
    } catch (err) {
      setDocState(docId, { status: 'error', verifyMessage: 'Could not verify.' });
    }
  };

  const handleRemove = (docId) => setDocState(docId, { status: 'idle', fileName: null, values: {}, source: {} });

  const buildDraftPayload = () => ({
    registrationId,
    resumeCode,
    ...fields,
    gstNumber: docs.gst?.values?.gstin || '',
    panNumber: docs.pan?.values?.pan || '',
    msmeNumber: docs.udyam?.values?.udyam || '',
    cinNumber: docs.coi?.values?.cin || '',
    beneficiaryName: docs.chq?.values?.benName || '',
    accountNumber: docs.chq?.values?.acctNo || '',
    ifscCode: docs.chq?.values?.ifsc || '',
    isoCertificateNo: docs.iso?.values?.isoNo || '',
    isoCertifyingBody: docs.iso?.values?.isoBody || '',
    isoExpiry: docs.iso?.values?.isoExpiry || '',
    as9100dCertificateNo: docs.as?.values?.asNo || '',
    as9100dCertifyingBody: docs.as?.values?.asBody || '',
    as9100dExpiry: docs.as?.values?.asExpiry || '',
  });

  const handleSaveDraft = async () => {
    if (!fields.email || fieldError('email', fields.email)) {
      setMessage({ type: 'danger', text: 'Enter a valid email first so we can send you a resume code.' });
      return;
    }
    setBusy(true);
    try {
      const { data } = await axios.post('/api/public/supplier-registration/draft', buildDraftPayload());
      const result = data.data?.result || {};
      setRegistrationId(result.registrationId);
      setResumeCode(result.resumeCode);
      setMessage({ type: 'success', text: `Draft saved. A resume code (${result.resumeCode}) has been emailed to you.` });
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.statusMsg || 'Could not save draft.' });
    } finally {
      setBusy(false);
    }
  };

  const handleResume = async () => {
    if (!resumeInput.trim()) return;
    setBusy(true);
    try {
      const { data } = await axios.get(`/api/public/supplier-registration/draft/${resumeInput.trim().toUpperCase()}`);
      const result = data.data?.result || {};
      const reg = result.registration || {};
      setRegistrationId(reg.id);
      setResumeCode(reg.resumeCode);
      setFields({
        vendorName: reg.vendorName || '', address: reg.address || '', contactName: reg.contactName || '',
        designation: reg.designation || '', email: reg.email?.includes('@placeholder.local') ? '' : (reg.email || ''),
        phone: reg.phone || '',
      });
      const nextDocs = {};
      (result.documents || []).forEach((d) => {
        nextDocs[d.docType] = {
          status: d.verifyStatus || 'read', fileName: d.fileName, values: d.values || {},
          source: Object.fromEntries(Object.keys(d.values || {}).map((k) => [k, 'ocr'])),
        };
      });
      setDocs(nextDocs);
      setMessage({ type: 'success', text: 'Draft loaded.' });
    } catch (err) {
      setMessage({ type: 'danger', text: 'No draft found for that code.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!registrationId) {
      setMessage({ type: 'danger', text: 'Upload your documents first.' });
      return;
    }
    if (!fields.email || fieldError('email', fields.email)) {
      setMessage({ type: 'danger', text: 'Enter a valid work email on the "Your details" step before submitting.' });
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      await handleSaveDraft(); // make sure the latest typed fields are persisted first
      await axios.post('/api/public/supplier-registration/submit', null, { params: { registrationId } });
      setSubmitted(true);
    } catch (err) {
      setMessage({ type: 'danger', text: err.response?.data?.statusMsg || 'Could not submit — check the required documents are all uploaded.' });
    } finally {
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <div className="auth-container">
        <div className="d-flex align-items-center justify-content-center w-100">
          <div className="form-card card fade-in-slide text-center" style={{ maxWidth: 480 }}>
            <div className="form-card-body py-5">
              <i className="far fa-check-circle text-emerald mb-3" style={{ fontSize: 48 }}></i>
              <h4>Submitted for review</h4>
              <p className="text-muted">
                Your application is with our procurement team. We'll email {fields.email} once it's reviewed.
              </p>
              <Button variant="green" onClick={() => navigate('/login')}>Back to sign in</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-5" style={{ maxWidth: 760 }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-0">Become a Supplier</h3>
          <p className="text-muted mb-0">Upload your documents, get verified, and receive your vendor login.</p>
        </div>
        <button className="btn btn-link" onClick={() => navigate('/login')}>Back to sign in</button>
      </div>

      {!registrationId && step === 1 && (
        <div className="card mb-4">
          <div className="card-body d-flex align-items-center gap-2">
            <Input
              label="Already started? Enter your resume code"
              id="resumeCode"
              value={resumeInput}
              onChange={(e) => setResumeInput(e.target.value)}
              className="mb-0 flex-grow-1"
            />
            <Button variant="outline-green" onClick={handleResume} loading={busy}>Resume</Button>
          </div>
        </div>
      )}

      {message && (
        <div className={`alert alert-${message.type}`} role="alert">
          {message.text}
        </div>
      )}

      <div className="d-flex justify-content-between mb-4">
        {STEPS.map((s) => (
          <div
            key={s.n}
            className="text-center flex-grow-1"
            style={{ cursor: 'pointer' }}
            onClick={() => setStep(s.n)}
          >
            <div
              className="rounded-circle d-inline-flex align-items-center justify-content-center mb-1"
              style={{
                width: 32, height: 32,
                backgroundColor: step === s.n ? '#10b981' : '#fff',
                border: `2px solid ${step >= s.n ? '#10b981' : '#e2e8f0'}`,
                color: step === s.n ? '#fff' : step > s.n ? '#10b981' : '#94a3b8',
              }}
            >
              {step > s.n ? <i className="fas fa-check"></i> : s.n}
            </div>
            <div className="text-uppercase fw-bold" style={{ fontSize: 11, color: step >= s.n ? '#10b981' : '#94a3b8' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <>
          {DOCS.map((doc) => (
            <DocUploadCard
              key={doc.id}
              doc={doc}
              state={docs[doc.id]}
              onUpload={handleUpload}
              onFieldChange={handleFieldChange}
              onVerify={handleVerify}
              onRemove={handleRemove}
            />
          ))}
          <div className="d-flex justify-content-end">
            <Button variant="green" onClick={() => setStep(2)}>Continue</Button>
          </div>
        </>
      )}

      {step === 2 && (
        <div className="card">
          <div className="card-body">
            <Input label="Company / vendor name" id="vendorName" required
              value={fields.vendorName} onChange={(e) => setFields({ ...fields, vendorName: e.target.value })} />
            <Input label="Registered address" id="address" rows={2}
              value={fields.address} onChange={(e) => setFields({ ...fields, address: e.target.value })} />
            <Input label="Contact person name" id="contactName" required
              value={fields.contactName} onChange={(e) => setFields({ ...fields, contactName: e.target.value })} />
            <Input label="Designation" id="designation"
              value={fields.designation} onChange={(e) => setFields({ ...fields, designation: e.target.value })} />
            <Input label="Work email" id="email" type="email" required
              value={fields.email} onChange={(e) => setFields({ ...fields, email: e.target.value })} />
            <Input label="Phone" id="phone"
              value={fields.phone} onChange={(e) => setFields({ ...fields, phone: e.target.value })} />
            <div className="d-flex justify-content-between">
              <Button variant="outline-green" onClick={() => setStep(1)}>Back</Button>
              <Button variant="green" onClick={() => setStep(3)}>Continue</Button>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <div className="card-body">
            <h6>Review</h6>
            <p className="text-muted small">
              {fields.vendorName || '—'} · {fields.contactName || '—'} · {fields.email || '—'}
            </p>
            <ul className="small text-muted">
              {DOCS.map((d) => (
                <li key={d.id}>
                  {d.name}: {docs[d.id]?.fileName ? `${docs[d.id].fileName} (${docs[d.id].status})` : d.req ? 'missing (required)' : 'not provided'}
                </li>
              ))}
            </ul>
            <div className="d-flex justify-content-between flex-wrap gap-2">
              <Button variant="outline-green" onClick={() => setStep(2)}>Back</Button>
              <div className="d-flex gap-2">
                <Button variant="outline-green" onClick={handleSaveDraft} loading={busy}>Save draft</Button>
                <Button variant="green" onClick={handleSubmit} loading={busy}>Submit for review</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierRegistrationPage;
