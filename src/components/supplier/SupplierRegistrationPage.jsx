import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './supplier-form.css';
import { SECTIONS } from './data';
import { useSupplierForm } from './hooks/useSupplierForm';
import TopBar from './components/TopBar';
import Rail from './components/Rail';
import ResumeStrip from './components/ResumeStrip';
import DocumentsSection from './components/DocumentsSection';
import OnFileSection from './components/OnFileSection';
import YouSection from './components/YouSection';
import DynamicQuestionsSection from './components/DynamicQuestionsSection';
import SubmitSection from './components/SubmitSection';
import EmailDialog from './components/EmailDialog';
import Toast from './components/Toast';
import SuccessScreen from './components/SuccessScreen';

// Ported 1:1 (layout, fields, and copy) from become-a-supplier/app/become-a-supplier/page.tsx,
// rewired to backend_java's real /api/public/supplier-registration/** endpoints — document OCR
// (OpenAI vision) and FolderIt storage instead of the prototype's local mock backend.
const SupplierRegistrationPage = () => {
  const navigate = useNavigate();
  const form = useSupplierForm();
  const { state, readiness, toast, emailDialogOpen, setEmailDialogOpen, resumeMessage, submission, primaryEmail } = form;
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [submitting, setSubmitting] = useState(false);

  // Hide the "Additional questions" nav item entirely unless an admin actually has a
  // questionnaire published + active — no dead link to a section that renders nothing.
  const hasQuestionnaire = !!state.questionnaire?.sections?.length;
  const visibleSections = hasQuestionnaire ? SECTIONS : SECTIONS.filter((s) => s.id !== 'sec-questions');

  // Scroll-spy for the step nav.
  useEffect(() => {
    const onScroll = () => {
      let cur = visibleSections[0].id;
      visibleSections.forEach((s) => {
        const el = document.getElementById(s.id);
        if (el && el.getBoundingClientRect().top < 130) cur = s.id;
      });
      setActiveSection(cur);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Debounced autosave whenever the draft is dirty and we already know how to reach the person.
  useEffect(() => {
    if (state.dirty) form.scheduleAutosave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dirty, state.fields, state.businessTypes, state.equipmentFacilities, state.directors, state.machinery, state.dynamicAnswers, state.docs, state.declaration]);

  // Warn on unload if there is unsaved work.
  useEffect(() => {
    const handler = (e) => {
      if (state.dirty && !state.submitted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.dirty, state.submitted]);

  const handleSubmit = async () => {
    setSubmitting(true);
    const ok = await form.submit();
    setSubmitting(false);
    if (!ok) {
      document.getElementById('sec-submit')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="supplier-page">
      <TopBar
        code={state.code}
        email={state.email}
        savedAt={state.savedAt}
        dirty={state.dirty}
        submitted={state.submitted}
        onSave={form.saveDraft}
      />

      <div className="wrap">
        <Rail
          readiness={readiness}
          submitted={state.submitted}
          activeSection={activeSection}
          onSubmit={handleSubmit}
          onSaveDraft={form.saveDraft}
          busy={submitting}
          sections={visibleSections}
        />

        <main>
          <div style={{ marginBottom: 12 }}>
            <button className="btn ghost sm" type="button" onClick={() => navigate('/login')}>← Back to sign in</button>
          </div>
          {submission ? (
            <SuccessScreen submission={submission} />
          ) : (
            <>
              <ResumeStrip onResume={form.resumeDraft} message={resumeMessage} />
              <DocumentsSection form={form} />
              <OnFileSection state={state} readiness={readiness} />
              <YouSection form={form} />
              {hasQuestionnaire && (
                <DynamicQuestionsSection state={state} readiness={readiness} setDynamicAnswer={form.setDynamicAnswer} />
              )}
              <SubmitSection readiness={readiness} onSubmit={handleSubmit} busy={submitting} />
            </>
          )}
        </main>
      </div>

      <EmailDialog
        open={emailDialogOpen}
        defaultValue={primaryEmail}
        onClose={() => setEmailDialogOpen(false)}
        onConfirm={form.confirmEmailAndSave}
      />

      {toast && <Toast html={toast.html} />}
    </div>
  );
};

export default SupplierRegistrationPage;
