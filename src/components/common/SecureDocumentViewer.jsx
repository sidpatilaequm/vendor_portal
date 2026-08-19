import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';

// pdfjs-dist (~1.3MB with its worker) is only needed once someone actually opens a PDF, so it's
// loaded on demand here rather than in this module's top-level imports — otherwise every page
// that ever renders AdminWorkflows would ship it in the main bundle whether or not it's used.
let pdfjsLibPromise = null;
const loadPdfjs = () => {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjsLib, workerUrlModule]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrlModule.default;
      return pdfjsLib;
    });
  }
  return pdfjsLibPromise;
};

// A view-only document preview: both images and PDF pages are decoded and painted onto a
// <canvas>, never handed to the browser as a real <img src>/<iframe src> file — so there's no
// native "Save image as" / PDF-viewer download-and-print toolbar for a reviewer to reach for.
// Right-click and the common save/print keyboard shortcuts are also blocked while it's open.
// This raises the bar for a casual save, not a determined one (a screenshot always works) — but
// that's the same ceiling every "view-only" document tool has; there's no such thing as fully
// undownloadable content once pixels reach a screen.
const SecureDocumentViewer = ({ show, fetchUrl, title, onClose }) => {
  const canvasRef = useRef(null);
  const objectUrlRef = useRef(null);
  const pdfDocRef = useRef(null);
  const renderTaskRef = useRef(null);
  const imgNaturalSizeRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [kind, setKind] = useState(null); // 'pdf' | 'image'
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(1);

  const cleanup = useCallback(() => {
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }
    if (pdfDocRef.current) {
      pdfDocRef.current.destroy();
      pdfDocRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    imgNaturalSizeRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx && ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const renderPdfPage = useCallback(async (num, atScale) => {
    if (!pdfDocRef.current || !canvasRef.current) return;
    if (renderTaskRef.current) renderTaskRef.current.cancel();
    const page = await pdfDocRef.current.getPage(num);
    const viewport = page.getViewport({ scale: atScale });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const task = page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch (e) {
      if (e?.name !== 'RenderingCancelledException') throw e;
    }
  }, []);

  useEffect(() => {
    if (!show || !fetchUrl) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPageNum(1);
    setScale(1);

    const token = localStorage.getItem('auth_token');
    axios
      .get(fetchUrl, { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' })
      .then(async (res) => {
        if (cancelled) return;
        const blob = res.data;
        const contentType = blob.type || res.headers?.['content-type'] || '';
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;

        if (contentType.includes('pdf')) {
          setKind('pdf');
          const [pdfjsLib, arrayBuffer] = await Promise.all([loadPdfjs(), blob.arrayBuffer()]);
          if (cancelled) return;
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          if (cancelled) { pdf.destroy(); return; }
          pdfDocRef.current = pdf;
          setNumPages(pdf.numPages);
          await renderPdfPage(1, 1);
        } else {
          setKind('image');
          const img = new Image();
          img.onload = () => {
            if (cancelled || !canvasRef.current) return;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
            imgNaturalSizeRef.current = { width: img.naturalWidth, height: img.naturalHeight };
            canvas.style.width = `${img.naturalWidth}px`;
            canvas.style.height = `${img.naturalHeight}px`;
          };
          img.onerror = () => !cancelled && setError('Could not render this document.');
          img.src = objectUrl;
        }
      })
      .catch(() => !cancelled && setError('Could not load the document preview.'))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, fetchUrl]);

  useEffect(() => {
    if (kind === 'pdf' && pdfDocRef.current) {
      renderPdfPage(pageNum, scale);
    } else if (kind === 'image' && imgNaturalSizeRef.current && canvasRef.current) {
      canvasRef.current.style.width = `${imgNaturalSizeRef.current.width * scale}px`;
      canvasRef.current.style.height = `${imgNaturalSizeRef.current.height * scale}px`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNum, scale, kind]);

  useEffect(() => {
    if (!show) return;
    const blockKeys = (e) => {
      const key = e.key?.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === 's' || key === 'p')) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (key === 'escape') onClose && onClose();
    };
    document.addEventListener('keydown', blockKeys, true);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', blockKeys, true);
      document.body.style.overflow = 'unset';
    };
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div
      className="custom-modal-overlay"
      style={{ alignItems: 'stretch', padding: 0 }}
      onClick={onClose}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        style={{
          margin: 'auto',
          width: '94vw',
          height: '92vh',
          maxWidth: '1100px',
          background: '#20242c',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            color: '#fff',
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 14 }}>
            {title || 'Document preview'}
            <span style={{ marginLeft: 10, fontSize: 11, opacity: 0.6, fontWeight: 400 }}>View only — cannot be downloaded</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {kind === 'pdf' && numPages > 1 && (
              <>
                <button
                  className="btn btn-sm btn-outline-light"
                  disabled={pageNum <= 1}
                  onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                >
                  ‹
                </button>
                <span style={{ fontSize: 12 }}>{pageNum} / {numPages}</span>
                <button
                  className="btn btn-sm btn-outline-light"
                  disabled={pageNum >= numPages}
                  onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
                >
                  ›
                </button>
              </>
            )}
            <button className="btn btn-sm btn-outline-light" onClick={() => setScale((s) => Math.max(0.4, s - 0.2))}>−</button>
            <span style={{ fontSize: 12, width: 40, textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
            <button className="btn btn-sm btn-outline-light" onClick={() => setScale((s) => Math.min(3, s + 0.2))}>+</button>
            <button className="btn btn-sm btn-outline-light" onClick={onClose}>Close</button>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            alignItems: kind === 'image' ? 'center' : 'flex-start',
            justifyContent: 'center',
            padding: 20,
            userSelect: 'none',
          }}
        >
          {loading && <div style={{ color: '#fff', alignSelf: 'center' }}>Loading document…</div>}
          {error && <div style={{ color: '#ff8a8a', alignSelf: 'center' }}>{error}</div>}
          <canvas
            ref={canvasRef}
            style={{ display: loading || error ? 'none' : 'block', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', background: '#fff' }}
            onContextMenu={(e) => e.preventDefault()}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
};

export default SecureDocumentViewer;
