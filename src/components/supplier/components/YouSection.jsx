import React from 'react';
import ContactCard from './ContactCard';

// Ported from become-a-supplier/app/become-a-supplier/components/YouSection.tsx. The
// AA-PUR-F-03-derived business-profile fields (business type, company type, directors,
// production facilities, machinery) that lived here were pulled per explicit request — that
// content now belongs to whatever the admin builds in the Questionnaire tab (see
// DynamicQuestionsSection), so this section is back to just the one thing no document can answer:
// who to actually contact.
const YouSection = ({ form }) => {
  const { state, readiness, setField, setDeclaration, setContactsCount, setPrimaryContact } = form;

  const contactValues = (n) => ({
    name: state.fields[`c${n}_name`] || '',
    role: state.fields[`c${n}_role`] || '',
    email: state.fields[`c${n}_email`] || '',
    phone: state.fields[`c${n}_phone`] || '',
  });

  return (
    <section className="sec" id="sec-you">
      <div className="sh">
        <h2>Who we deal with</h2>
        <span className="n">04</span>
      </div>
      <p className="sdesc">
        Add up to two people and mark one as primary. Every notification — the draft code, questions from a
        reviewer, orders, payment advice — goes to the primary contact, and the portal login is created in their
        name. The second person is copied on nothing unless you make them primary.
      </p>

      <div>
        <ContactCard
          n={1}
          isPrimary={state.primaryContact === 1}
          values={contactValues(1)}
          errors={readiness.errors}
          onFieldChange={setField}
          onSetPrimary={() => setPrimaryContact(1)}
        />
        {state.contactsCount === 2 && (
          <ContactCard
            n={2}
            isPrimary={state.primaryContact === 2}
            values={contactValues(2)}
            errors={readiness.errors}
            onFieldChange={setField}
            onSetPrimary={() => setPrimaryContact(2)}
            onRemove={() => setContactsCount(1)}
          />
        )}
      </div>
      {state.contactsCount === 1 && (
        <button className="btn ghost sm" style={{ marginTop: 10 }} type="button" onClick={() => setContactsCount(2)}>
          Add a second contact
        </button>
      )}

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
