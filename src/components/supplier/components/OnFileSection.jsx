import React, { useState } from 'react';
import { DOCS } from '../data';
import { fmtSize } from '../lib/utils';
import SecureDocumentViewer from '../../common/SecureDocumentViewer';

const CHECK_SYMBOL = { ok: '✓', warn: '!', no: '✕' };

// Ported from become-a-supplier/app/become-a-supplier/components/OnFileSection.tsx
const OnFileSection = ({ state, readiness }) => {
  const [viewerDoc, setViewerDoc] = useState(null);
  const files = DOCS.filter((d) => state.docs[d.id]?.status === 'read');
  const extras = state.extraFiles.filter((f) => f.status === 'read');
  const total = files.reduce((t, d) => t + (state.docs[d.id].size || 0), 0) + extras.reduce((t, f) => t + (f.size || 0), 0);
  const rowCount = files.length + extras.length;

  return (
    <section className="sec" id="sec-file">
      <div className="sh">
        <h2>On file</h2>
        <span className="n">03</span>
      </div>
      <p className="sdesc">Everything you have uploaded, kept with this draft until you submit. Open any of them here.</p>

      {rowCount === 0 ? (
        <p className="sm muted">Nothing uploaded yet.</p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Document</th>
                <th>File</th>
                <th>Uploaded</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.map((d) => {
                const f = state.docs[d.id];
                return (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>
                      <span className="sm">{f.name}</span>
                      <div className="xs muted mono">{fmtSize(f.size || 0)}</div>
                    </td>
                    <td className="sm muted">{f.at}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn ghost sm" type="button" onClick={() => f.url && setViewerDoc({ url: f.url, name: d.name })}>View</button>
                    </td>
                  </tr>
                );
              })}
              {extras.map((f) => (
                <tr key={f.localId}>
                  <td>Other document</td>
                  <td>
                    <span className="sm">{f.name}</span>
                    {f.size > 0 && <div className="xs muted mono">{fmtSize(f.size)}</div>}
                  </td>
                  <td className="sm muted"></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn ghost sm" type="button" onClick={() => f.url && setViewerDoc({ url: f.url, name: f.name })}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="sm muted" style={{ marginTop: 10 }}>
            {rowCount} file{rowCount > 1 ? 's' : ''} · {fmtSize(total)} · held against {state.code || 'this draft'} until you submit.
          </p>
        </>
      )}

      <h3 style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 600, margin: '20px 0 8px' }}>Cross-checks</h3>
      <div className="xcheck">
        {readiness.crossChecks.length === 0 ? (
          <div className="muted">Nothing to compare yet.</div>
        ) : (
          readiness.crossChecks.map(([kind, text], i) => (
            <div key={i}>
              <span className={kind}>{CHECK_SYMBOL[kind]}</span>
              <span style={{ color: 'var(--ink)' }}>{text}</span>
            </div>
          ))
        )}
      </div>

      <SecureDocumentViewer
        show={!!viewerDoc}
        fetchUrl={viewerDoc?.url}
        title={viewerDoc?.name}
        onClose={() => setViewerDoc(null)}
      />
    </section>
  );
};

export default OnFileSection;
