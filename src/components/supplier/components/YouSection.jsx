import React from 'react';
import { BUSINESS_TYPES, COMPANY_TYPES, WEEKLY_OFF_DAYS, EQUIPMENT_FACILITIES, DIRECTOR_ROW_TEMPLATE, MACHINERY_ROW_TEMPLATE } from '../data';
import ContactCard from './ContactCard';
import RepeatingRows from './RepeatingRows';

const DIRECTOR_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'qualification', label: 'Qualification' },
  { key: 'experience', label: 'Work experience' },
  { key: 'commencementDate', label: 'Date of commencement of manufacturing', type: 'date' },
  { key: 'capitalEmployed', label: 'Total capital employed', mono: true },
];

const MACHINERY_COLUMNS = [
  { key: 'description', label: 'Description' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'makeName', label: 'Make — name' },
  { key: 'makeYear', label: 'Make — year' },
  { key: 'numbers', label: 'Numbers', mono: true },
  { key: 'remarks', label: 'Remarks' },
];

// Ported from become-a-supplier/app/become-a-supplier/components/YouSection.tsx, then
// re-fielded to match AA-PUR-F-03 Rev02 "Supplier Evaluation and Registration Form" —
// business type, company type, directors/partners, and production facilities in place
// of the earlier supply-category/plant/payment-terms questions.
const YouSection = ({ form }) => {
  const { state, readiness, setField, setDeclaration, toggleListValue, addRow, updateRow, removeRow, setContactsCount, setPrimaryContact } = form;

  const contactValues = (n) => ({
    name: state.fields[`c${n}_name`] || '',
    role: state.fields[`c${n}_role`] || '',
    email: state.fields[`c${n}_email`] || '',
    phone: state.fields[`c${n}_phone`] || '',
  });

  const isManufacturer = state.businessTypes.includes('Manufacturer');

  return (
    <section className="sec" id="sec-you">
      <div className="sh">
        <h2>What no document tells us</h2>
        <span className="n">03</span>
      </div>
      <p className="sdesc">Everything else came off your certificates — this is the rest of the evaluation form.</p>

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

      <div style={{ marginTop: 16 }} id="businessTypeCount">
        <label>Nature of business <span className="req">*</span></label>
        <div className="grid g3">
          {BUSINESS_TYPES.map((t) => (
            <label className="chk" key={t}>
              <input type="checkbox" checked={state.businessTypes.includes(t)} onChange={() => toggleListValue('businessTypes', t)} />
              <span>{t}</span>
            </label>
          ))}
        </div>
        <div className={'emsg' + (state.businessTypes.length === 0 ? ' on' : '')}>Choose at least one.</div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label htmlFor="businessScope">Detail scope of business <span className="req">*</span></label>
        <input
          id="businessScope"
          value={state.fields.businessScope || ''}
          onChange={(e) => setField('businessScope', e.target.value)}
          placeholder="e.g. Precision machining of aerospace-grade aluminium components"
        />
        <div className={'emsg' + (readiness.errors.businessScope ? ' on' : '')}>{readiness.errors.businessScope}</div>
      </div>

      <div className="grid g2" style={{ marginTop: 16 }}>
        <div id="companyType">
          <label htmlFor="companyTypeSel">Type of the company <span className="req">*</span></label>
          <select id="companyTypeSel" value={state.fields.companyType || ''} onChange={(e) => setField('companyType', e.target.value)}>
            <option value="">Select</option>
            {COMPANY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <div className="emsg" />
        </div>
        <div>
          <label htmlFor="weeklyOff">Weekly off day</label>
          <select id="weeklyOff" value={state.fields.weeklyOff || ''} onChange={(e) => setField('weeklyOff', e.target.value)}>
            <option value="">Select</option>
            {WEEKLY_OFF_DAYS.map((d) => <option key={d}>{d}</option>)}
          </select>
          <div className="emsg" />
        </div>
      </div>

      <div className="grid g3" style={{ marginTop: 16 }}>
        <div id="telephone">
          <label htmlFor="telephoneInput">Telephone <span className="req">*</span></label>
          <input id="telephoneInput" className="mono" value={state.fields.telephone || ''} onChange={(e) => setField('telephone', e.target.value)} />
          <div className="emsg" />
        </div>
        <div>
          <label htmlFor="fax">Fax</label>
          <input id="fax" className="mono" value={state.fields.fax || ''} onChange={(e) => setField('fax', e.target.value)} />
          <div className="emsg" />
        </div>
      </div>

      <RepeatingRows
        title="Details of directors / partners / proprietor"
        rows={state.directors}
        columns={DIRECTOR_COLUMNS}
        template={DIRECTOR_ROW_TEMPLATE}
        onAdd={(row) => addRow('directors', row)}
        onUpdate={(idx, key, value) => updateRow('directors', idx, key, value)}
        onRemove={(idx) => removeRow('directors', idx)}
        addLabel="+ Add a director / partner"
      />

      <div className="grid g2" style={{ marginTop: 16 }}>
        <div>
          <label htmlFor="annualTurnover">Annual sales turnover</label>
          <input id="annualTurnover" value={state.fields.annualTurnover || ''} onChange={(e) => setField('annualTurnover', e.target.value)} />
          <div className="emsg" />
        </div>
        <div>
          <label htmlFor="turnoverYear">Year</label>
          <input id="turnoverYear" className="mono" value={state.fields.turnoverYear || ''} onChange={(e) => setField('turnoverYear', e.target.value)} />
          <div className="emsg" />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <label htmlFor="regulatoryActs">Regulatory acts applicable</label>
        <input id="regulatoryActs" value={state.fields.regulatoryActs || ''} onChange={(e) => setField('regulatoryActs', e.target.value)} />
        <div className="emsg" />
      </div>

      {isManufacturer && (
        <>
          <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 600, marginTop: 24, marginBottom: 4 }}>
            Production facilities
          </h3>
          <p className="sm muted" style={{ marginBottom: 12 }}>
            Shown because you ticked Manufacturer above — not needed for service or trading only.
          </p>

          <div className="grid g3">
            <div>
              <label htmlFor="manpowerOffice">Office staff</label>
              <input id="manpowerOffice" className="mono" value={state.fields.manpowerOffice || ''} onChange={(e) => setField('manpowerOffice', e.target.value)} />
              <div className="emsg" />
            </div>
            <div>
              <label htmlFor="manpowerSupervisor">Supervisors</label>
              <input id="manpowerSupervisor" className="mono" value={state.fields.manpowerSupervisor || ''} onChange={(e) => setField('manpowerSupervisor', e.target.value)} />
              <div className="emsg" />
            </div>
            <div>
              <label htmlFor="manpowerWorkmen">Workmen</label>
              <input id="manpowerWorkmen" className="mono" value={state.fields.manpowerWorkmen || ''} onChange={(e) => setField('manpowerWorkmen', e.target.value)} />
              <div className="emsg" />
            </div>
          </div>

          <div className="grid g3" style={{ marginTop: 12 }}>
            <div>
              <label htmlFor="shiftsPerDay">Shifts worked per day</label>
              <input id="shiftsPerDay" className="mono" value={state.fields.shiftsPerDay || ''} onChange={(e) => setField('shiftsPerDay', e.target.value)} />
              <div className="emsg" />
            </div>
            <div>
              <label htmlFor="spareCapacity">Spare capacity available</label>
              <input id="spareCapacity" value={state.fields.spareCapacity || ''} onChange={(e) => setField('spareCapacity', e.target.value)} />
              <div className="emsg" />
            </div>
            <div>
              <label htmlFor="floorSpace">Total floor space</label>
              <input id="floorSpace" value={state.fields.floorSpace || ''} onChange={(e) => setField('floorSpace', e.target.value)} />
              <div className="emsg" />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <label>Equipment facilities available</label>
            <div className="grid g3">
              {EQUIPMENT_FACILITIES.map((eq) => (
                <label className="chk" key={eq}>
                  <input type="checkbox" checked={state.equipmentFacilities.includes(eq)} onChange={() => toggleListValue('equipmentFacilities', eq)} />
                  <span>{eq}</span>
                </label>
              ))}
            </div>
          </div>

          <RepeatingRows
            title="Details of machinery & other equipment"
            rows={state.machinery}
            columns={MACHINERY_COLUMNS}
            template={MACHINERY_ROW_TEMPLATE}
            onAdd={(row) => addRow('machinery', row)}
            onUpdate={(idx, key, value) => updateRow('machinery', idx, key, value)}
            onRemove={(idx) => removeRow('machinery', idx)}
            addLabel="+ Add a machine"
          />
        </>
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
