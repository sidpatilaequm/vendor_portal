import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import './QrScannerModal.css';

export default function QrScannerModal({ isOpen, onClose, onScan, title = "Scan QR Code", defaultSampleQr = null }) {
  const [scanInput, setScanInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameIdRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScanInput('');
      setErrorMsg('');
      setStatusMsg('');
    }
  }, [isOpen]);

  const stopCamera = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startCamera = async () => {
    setErrorMsg('');
    setStatusMsg('Requesting camera access...');
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
        }
        setCameraActive(true);
        setStatusMsg('Scanning... Position QR code inside the frame.');
        requestScanFrame();
      } else {
        setErrorMsg('Camera access is not supported by this browser.');
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setErrorMsg('Unable to access camera. Please check camera permissions or upload a QR image.');
      stopCamera();
    }
  };

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  };

  const requestScanFrame = () => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          playBeep();
          stopCamera();
          onScan(code.data);
          onClose();
          return;
        }
      }
      animFrameIdRef.current = requestAnimationFrame(tick);
    };

    animFrameIdRef.current = requestAnimationFrame(tick);
  };

  const handleProcessScan = (textToProcess) => {
    const text = (textToProcess !== undefined ? textToProcess : scanInput).trim();
    if (!text) {
      setErrorMsg('Please enter or scan a valid QR payload.');
      return;
    }
    playBeep();
    stopCamera();
    onScan(text);
    onClose();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setErrorMsg('');
    setStatusMsg('Decoding QR image...');

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);

        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (code && code.data) {
          playBeep();
          stopCamera();
          onScan(code.data);
          onClose();
        } else {
          // If pure barcode image or raw text filename simulation
          if (defaultSampleQr) {
            handleProcessScan(typeof defaultSampleQr === 'object' ? JSON.stringify(defaultSampleQr) : defaultSampleQr);
          } else {
            setErrorMsg('No QR code detected in the uploaded image. Please try another clear image or use live camera / manual entry.');
            setStatusMsg('');
          }
        }
      };
      img.onerror = () => {
        setErrorMsg('Failed to load image file.');
        setStatusMsg('');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div className="qr-modal-overlay" onClick={onClose}>
      <div className="qr-modal-card" onClick={e => e.stopPropagation()}>
        <div className="qr-modal-header">
          <div className="qr-modal-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
              <line x1="7" y1="7" x2="7.01" y2="7"></line>
              <line x1="18" y1="7" x2="18.01" y2="7"></line>
              <line x1="7" y1="18" x2="7.01" y2="18"></line>
              <line x1="18" y1="18" x2="18.01" y2="18"></line>
            </svg>
            <h3>{title}</h3>
          </div>
          <button className="qr-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="qr-modal-body">
          {/* Scanner Viewfinder / Camera Video */}
          <div className="qr-viewfinder">
            <video
              ref={videoRef}
              className={`qr-video-stream ${cameraActive ? 'active' : ''}`}
              style={{ display: cameraActive ? 'block' : 'none' }}
            />
            
            <div className="qr-camera-overlay">
              <div className="qr-scan-frame">
                <div className="qr-corner top-left"></div>
                <div className="qr-corner top-right"></div>
                <div className="qr-corner bottom-left"></div>
                <div className="qr-corner bottom-right"></div>
                {cameraActive && <div className="qr-laser-line"></div>}
                {!cameraActive && (
                  <div className="qr-frame-icon">
                    <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v2M16 20h2a2 2 0 0 0 2-2v-2" />
                      <rect x="7" y="7" width="10" height="10" rx="1" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="qr-hint">
                {cameraActive
                  ? (statusMsg || 'Scanning live... Hold QR code steady')
                  : 'Click "Start Live Camera" or "Upload QR Image" to decode'}
              </p>
            </div>
          </div>

          {errorMsg && <div className="qr-modal-error">{errorMsg}</div>}

          {/* Action Row for Camera / File */}
          <div className="qr-modal-actions">
            {!cameraActive ? (
              <button className="qr-btn primary" onClick={startCamera}>
                📷 Start Live Camera
              </button>
            ) : (
              <button className="qr-btn danger" onClick={stopCamera}>
                ⏹ Stop Camera
              </button>
            )}

            <label className="qr-btn secondary file-upload-lbl">
              📁 Upload QR Image
              <input type="file" accept="image/*" onChange={handleFileUpload} hidden />
            </label>
          </div>

          {/* Manual Input / Hardware Scanner Input */}
          <div className="qr-manual-input">
            <label>OR Scan / Paste QR Code Data:</label>
            <div className="qr-input-group">
              <input
                type="text"
                className="qr-text-input"
                placeholder="Scan barcode gun / paste payload here..."
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleProcessScan();
                }}
                autoFocus
              />
              <button className="qr-btn action" onClick={() => handleProcessScan()}>
                Apply Scan
              </button>
            </div>
          </div>

          {/* Quick Scan Shortcut */}
          {defaultSampleQr && (
            <div className="qr-presets">
              <span className="qr-preset-label">Quick Scan Test:</span>
              <button
                type="button"
                className="qr-preset-chip"
                onClick={() => handleProcessScan(typeof defaultSampleQr === 'object' ? JSON.stringify(defaultSampleQr) : defaultSampleQr)}
              >
                ⚡ Scan ASN / Package QR Payload
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
