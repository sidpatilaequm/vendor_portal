import React from 'react';

// Ported from become-a-supplier/app/become-a-supplier/components/YouSection.tsx. The
// AA-PUR-F-03-derived business-profile fields (business type, company type, directors,
// production facilities, machinery) that lived here were pulled per explicit request — that
// content now belongs to whatever the admin builds in the Questionnaire tab (see
// DynamicQuestionsSection), so this section is back to just the one thing no document can answer:
// who to actually contact. Previously this collected up to two named contacts (name/designation/
// email/phone each, one marked primary) — simplified per request down to a single email, since
// that's the only piece every downstream consumer (draft-code delivery, reviewer questions,
// orders, payment advice, the portal login) actually reads.
const YouSection = ({ form }) => {
  const { state, readiness, setField, setDeclaration } = form;

  return (
    <section className="sec" id="sec-you">
      <div className="sh">
        <h2>Who we deal with</h2>
        <span className="n">01</span>
      </div>
      <p className="sdesc">
        This is the primary email for your account — every notification (the draft code, questions from a
        reviewer, orders, payment advice) goes here, and it's what your portal login is created against.
      </p>

      <div>
        <label htmlFor="c1_email">Email <span className="req">*</span></label>
        <input
          id="c1_email"
          type="email"
          className={readiness.errors.c1_email ? 'err' : ''}
          value={state.fields.c1_email || ''}
          onChange={(e) => setField('c1_email', e.target.value)}
        />
        <div className={'emsg' + (readiness.errors.c1_email ? ' on' : '')}>{readiness.errors.c1_email}</div>
      </div>

      {!!state.fields.udyam && (
        <div className="note amber">
          You are registered as MSME, so payment falls due in 45 days under the MSMED Act.
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <label className="chk">
          <input type="checkbox" id="dTrue" checked={state.declaration} onChange={(e) => setDeclaration(e.target.checked)} />
          <span>
            Everything here is true, we accept the supplier code of conduct and the general conditions of purchase,
            we use no child or forced labour, and we will report any change within 30 days. <span className="req">*</span>
          </span>
        </label>
        <div className="emsg" />
      </div>
    </section>
  );
};

export default YouSection;
