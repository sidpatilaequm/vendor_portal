import React, { useRef, useState } from 'react';
import { fmtSize } from '../lib/utils';
import SecureDocumentViewer from '../../common/SecureDocumentViewer';

// Free-form extra attachments — any number of files, no fixed slot, no OCR/verification.
// Otherwise the same upload/view/remove mechanics as DocCard's fixed document slots.
const ExtraDocumentsSection = ({ form }) => {
  const { state, uploadExtraFile, removeExtraFile } = form;
  const [dragOver, setDragOver] = useState(false);
  const [viewerFile, setViewerFile] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = (fileList) => {
    Array.from(fileList).forEach((f) => uploadExtraFile(f));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  return (
    <section className="sec" id="sec-other">
      <div className="sh">
        <h2>Other documents</h2>
        <span className="n">02</span>
      </div>
      <p className="sdesc">
        Anything else you'd like us to see — reference letters, insurance certificates, brochures — that doesn't fit
        one of the document slots above. Add as many as you need; nothing here is read automatically.
      </p>

      <div
        className={`doc ${dragOver ? 'over' : ''}`}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
        onDrop={handleDrop}
      >
        <label className="drop" tabIndex={0}>
          <span>Choose one or more files, or drop them here</span>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
          />
        </label>

        {state.extraFiles.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {state.extraFiles.map((f) => {
              const ext = (f.name.split('.').pop() || 'file').toUpperCase().slice(0, 4);
              return (
                <div className="filerow" key={f.localId}>
                  {f.status === 'reading' ? (
                    <>
                      <span className="spin" />
                      <span className="sm">Uploading {f.name}…</span>
                    </>
                  ) : (
                    <>
                      <div className="fi">{ext}</div>
                      <div>
                        <div className="fn">{f.name}</div>
                        {f.size > 0 && <div className="fm">{fmtSize(f.size)}</div>}
                      </div>
                      <div className="acts">
                        {f.url && (
                          <button className="btn ghost sm" type="button" onClick={() => setViewerFile(f)}>View</button>
                        )}
                        <button className="btn ghost sm" type="button" onClick={() => removeExtraFile(f.localId)}>Remove</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SecureDocumentViewer
        show={!!viewerFile}
        fetchUrl={viewerFile?.url}
        title={viewerFile?.name}
        onClose={() => setViewerFile(null)}
      />
    </section>
  );
};

export default ExtraDocumentsSection;
