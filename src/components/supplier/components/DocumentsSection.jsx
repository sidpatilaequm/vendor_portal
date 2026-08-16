import React from 'react';
import { DOCS } from '../data';
import DocCard from './DocCard';

// Ported from become-a-supplier/app/become-a-supplier/components/DocumentsSection.tsx
const DocumentsSection = ({ form }) => {
  const { state, readiness, ingestFile, removeDoc, setField } = form;

  return (
    <section className="sec" id="sec-docs">
      <div className="sh">
        <h2>Your documents</h2>
        <span className="n">01</span>
      </div>
      <p className="sdesc">
        Upload a document and its details appear underneath it, read automatically. Check each one against the
        paper in front of you — where we can, we also verify it against the official record.
      </p>
      <div>
        {DOCS.map((doc) => (
          <DocCard
            key={doc.id}
            doc={doc}
            file={state.docs[doc.id]}
            fields={state.fields}
            src={state.src}
            errors={readiness.errors}
            onFile={(file) => ingestFile(doc.id, file)}
            onRemove={() => removeDoc(doc.id)}
            onFieldChange={setField}
          />
        ))}
      </div>
    </section>
  );
};

export default DocumentsSection;
