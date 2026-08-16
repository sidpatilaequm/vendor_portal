import React from 'react';
import { PAYMENT_TERMS, PLANTS, SUPPLY_CATEGORIES } from '../data';
import ContactCard from './ContactCard';

// Ported from become-a-supplier/app/become-a-supplier/components/YouSection.tsx
const YouSection = ({ form }) => {
  const { state, readiness, setField, setDeclaration, toggleCategory, setContactsCount, setPrimaryContact } = form;

  const contactValues = (n) => ({
    name: state.fields[`c${n}_name`] || '',
    role: state.fields[`c${n}_role`] || '',
    email: state.fields[`c${n}_email`] || '',
    phone: state.fields[`c${n}_phone`] || '',
  });

  return (
    <section className="sec" id="sec-you">
      <div className="sh">
        <h2>What no document tells us</h2>
        <span className="n">03</span>
      </div>
      <p className="sdesc">Six things. Everything else came off your certificates.</p>

      <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Who we deal with</h3>
      <p className="sm muted" style={{ marginBottom: 12 }}>
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

      <div style={{ marginTop: 16 }}>
        <label>What do you supply? <span className="req">*</span></label>
        <div className="grid g3">
          {SUPPLY_CATEGORIES.map((cat) => (
            <label className="chk" key={cat}>
              <input type="checkbox" checked={state.cats.includes(cat)} onChange={() => toggleCategory(cat)} />
              <span>{cat}</span>
            </label>
          ))}
        </div>
        <div className={'emsg' + (state.cats.length === 0 ? ' on' : '')} id="catErr">Choose at least one.</div>
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <div>
          <label htmlFor="plant">Plant you can serve <span className="req">*</span></label>
          <select id="plant" value={state.fields.plant || ''} onChange={(e) => setField('plant', e.target.value)}>
            <option value="">Select</option>
            {PLANTS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <div className="emsg" />
        </div>
        <div>
          <label htmlFor="terms">Payment terms sought <span className="req">*</span></label>
          <select id="terms" value={state.fields.terms || ''} onChange={(e) => setField('terms', e.target.value)}>
            <option value="">Select</option>
            {PAYMENT_TERMS.map((t) => <option key={t}>{t}</option>)}
          </select>
          <div className="emsg" />
        </div>
      </div>
      {!!state.fields.udyam && (
        <div className="note amber">
          You are registered as MSME, so payment falls due in 45 days under the MSMED Act whatever is agreed here.
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
