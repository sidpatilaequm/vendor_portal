import React, { useState, useEffect, useRef } from 'react';
import './GateEntry.css';



const DOC_LIST = [
  { id: "inv", name: "Tax invoice (original for buyer)", hint: "GST-compliant, signed / digitally signed", req: true },
  { id: "ewb", name: "e-Way bill copy", hint: "Part-A and Part-B", req: true },
  { id: "chal", name: "Delivery challan / packing list", hint: "Box-wise, item-wise detail", req: true },
  { id: "lr", name: "LR / GR copy (consignment note)", hint: "Not required for supplier's own vehicle", req: true },
  { id: "mtc", name: "Material test certificate", hint: "Heat number traceable to invoice lines", req: false },
  { id: "dl", name: "Driver licence", hint: "Sighted and returned to driver", req: true },
  { id: "ins", name: "Insurance cover note", hint: "High-value consignments only", req: false },
  { id: "coc", name: "Warranty / certificate of conformity", hint: "Where contractually agreed", req: false }
];

const getNowStr = () => {
  const d = new Date();
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
};


const GateEntry = ({ onBack }) => {
  const [clock, setClock] = useState(getNowStr());
  const [search, setSearch] = useState("");
  const [arrivals, setArrivals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchArrivals = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/employee/gate-entry/arrivals/expected', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.data && data.data.items) {
          const mapped = data.data.items.map(a => ({
            asn: a.asnNumber,
            po: a.poNumber,
            vendor: a.vendorName,
            vehicle: a.vehicleNo,
            eta: a.eta ? new Date(a.eta).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : "Today",
            etaTag: a.etaTag || "due",
            pkgs: a.totalPackages
          }));
          setArrivals(mapped);
        }
      }
    } catch (err) {
      console.error("Failed to fetch arrivals", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchArrivals();
  }, []);

  const [sel, setSel] = useState(null);
  const [decided, setDecided] = useState(false);
  const [docState, setDocState] = useState({});
  const [lineVal, setLineVal] = useState({});
  const [lineLock, setLineLock] = useState({});
  const [lineRmk, setLineRmk] = useState({});
  const [pkgVal, setPkgVal] = useState("");
  const [pkgLock, setPkgLock] = useState(false);
  const [pkgRmk, setPkgRmk] = useState("");
  const [feed, setFeed] = useState([{ time: getNowStr(), msg: "Awaiting selection", kind: "" }]);
  const [passGe, setPassGe] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setClock(getNowStr());
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const appendLog = (msg, kind = "") => {
    setFeed(prev => {
      const newLog = { time: getNowStr(), msg, kind };
      if (prev.length === 1 && prev[0].msg === "Awaiting selection") {
        return [newLog];
      }
      return [newLog, ...prev];
    });
  };

  const handleSelectArrival = async (a) => {
    appendLog(`Selected ${a.vehicle} — Fetching details...`);
    
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/employee/gate-entry/arrivals/${a.asn}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.data && data.data.details) {
          const d = data.data.details;
          const detailedArrival = {
            ...a,
            vendor: d.vendor?.name || a.vendor,
            gstin: d.vendor?.gstin || "N/A",
            inv: d.invoice?.number || "N/A",
            invDate: d.invoice?.date || "N/A",
            invVal: d.invoice?.value || "N/A",
            ewb: d.logistics?.ewb || "N/A",
            ewbTill: "N/A",
            vehicle: d.logistics?.vehicle || a.vehicle,
            transporter: d.logistics?.transporter || "N/A",
            lr: "N/A",
            driver: d.logistics?.driver || "N/A",
            dl: "N/A",
            pkgs: d.declaredPackages || a.pkgs,
            lines: (d.lines || []).map(l => ({
              mat: l.materialCode,
              desc: l.description,
              qty: l.qty,
              uom: l.uom
            }))
          };
          
          setSel(detailedArrival);
          setDecided(false);
          setDocState({});
          setLineVal({});
          setLineLock({});
          setLineRmk({});
          setPkgVal("");
          setPkgLock(false);
          setPkgRmk("");
          appendLog(`Loaded details for ${a.asn}`, "ok");
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
      }
      appendLog(`Failed to load details for ${a.asn}`, "bad");
    } catch (err) {
      console.error(err);
      appendLog(`Error loading details for ${a.asn}`, "bad");
    }
  };

  const handleDocClick = (docId, value, docName) => {
    setDocState(prev => ({ ...prev, [docId]: value }));
    const word = value === "ok" ? "received" : (value === "bad" ? "NOT handed over" : "marked not applicable");
    const kind = value === "bad" ? "bad" : (value === "na" ? "warn" : "ok");
    appendLog(`${docName} — ${word}`, kind);
  };

  const handlePkgVerify = () => {
    if (pkgLock) {
      setPkgLock(false);
      appendLog("Package count reopened for re-count", "warn");
      return;
    }
    const v = parseFloat(pkgVal);
    if (pkgVal === "" || isNaN(v)) {
      appendLog("Enter the package count before verifying", "warn");
      return;
    }
    setPkgLock(true);
    const diff = v - sel.pkgs;
    appendLog(`Packages verified — counted ${v} against ${sel.pkgs} declared`, diff === 0 ? "ok" : "warn");
  };

  const handleLineVerify = (i, mat, qty, uom) => {
    if (lineLock[i]) {
      setLineLock(prev => ({ ...prev, [i]: false }));
      appendLog(`Line ${mat} reopened for re-count`, "warn");
      return;
    }
    const v = parseFloat(lineVal[i]);
    if (lineVal[i] === undefined || lineVal[i] === "" || isNaN(v)) {
      appendLog(`Enter the counted quantity for ${mat} before verifying`, "warn");
      return;
    }
    setLineLock(prev => ({ ...prev, [i]: true }));
    const diff = v - qty;
    appendLog(`Verified ${mat} — counted ${v} of ${qty} ${uom} declared`, diff === 0 ? "ok" : "warn");
  };

  const submitDecision = async (decision) => {
    setDecided(true);
    const token = localStorage.getItem('auth_token');
    
    const lineVerification = sel.lines.map((l, i) => ({
      materialCode: l.mat,
      countedQty: parseFloat(lineVal[i] || 0),
      remark: lineRmk[i] || ""
    }));

    const payload = {
      asnNumber: sel.asn,
      decision: decision,
      documents: docState,
      packageVerification: {
        counted: parseFloat(pkgVal || 0),
        remark: pkgRmk || ""
      },
      lineVerification: lineVerification
    };

    try {
      const res = await fetch('/api/employee/gate-entry/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.status === 'success') {
        if (decision === 'ALLOW') {
          appendLog(data.statusMsg || 'Entry allowed', 'ok');
          setPassGe(data.data.result.gate_pass_number);
        } else if (decision === 'HOLD') {
          appendLog('Vehicle held at gate — supervisor called', 'warn');
          alert('Vehicle held at the gate.');
        } else {
          appendLog('Turned away at gate — ASN rejected', 'bad');
          alert('Vehicle turned away.');
        }
        fetchArrivals();
      } else {
        appendLog('Failed to process: ' + data.statusMsg, 'bad');
        setDecided(false);
      }
    } catch (err) {
      appendLog('Error connecting to server', 'bad');
      setDecided(false);
    }
  };

  const handleAllow = () => submitDecision('ALLOW');
  const handleHold = () => submitDecision('HOLD');
  const handleReject = () => submitDecision('REJECT');

  const handleReset = () => {
    if (sel) handleSelectArrival(sel);
  };

  // Evaluate state
  let docsDone = 0, mandMissing = 0, mandUnanswered = 0;
  DOC_LIST.forEach(d => {
    if (docState[d.id]) docsDone++;
    if (d.req && docState[d.id] !== "ok") mandMissing++;
    if (d.req && !docState[d.id]) mandUnanswered++;
  });

  let verified = 0, qtyIssue = 0, needRmk = 0, tDec = 0, tAct = 0;
  if (sel) {
    sel.lines.forEach((l, i) => {
      tDec += l.qty;
      if (lineLock[i]) {
        verified++;
        const v = parseFloat(lineVal[i]);
        tAct += v;
        if (v !== l.qty) {
          qtyIssue++;
          if (!(lineRmk[i] || "").trim()) needRmk++;
        }
      }
    });
  }

  const pkgNum = parseFloat(pkgVal);
  const pkgDiff = pkgLock && pkgNum !== sel?.pkgs;
  if (pkgDiff && !pkgRmk.trim()) needRmk++;

  const complete = pkgLock && sel && verified === sel.lines.length && mandUnanswered === 0 && needRmk === 0;

  let verdictClass = "v-idle";
  let verdictTitle = "No delivery selected";
  let verdictSub = "Pick an incoming delivery from the queue to begin.";
  let allow = false;

  if (sel) {
    if (!complete) {
      verdictClass = "v-prog";
      verdictTitle = "Count in progress";
      let pending = [];
      if (mandUnanswered) pending.push(`${mandUnanswered} mandatory document(s) not recorded`);
      if (!pkgLock) pending.push("package count not verified");
      if (verified < sel.lines.length) pending.push(`${sel.lines.length - verified} line(s) not verified`);
      if (needRmk) pending.push(`${needRmk} reason(s) required against differences`);
      verdictSub = "Pending: " + pending.join(" · ");
    } else if (qtyIssue || pkgDiff || mandMissing) {
      verdictClass = "v-hold";
      verdictTitle = "HOLD — supervisor approval needed";
      let why = [];
      if (mandMissing) why.push(`${mandMissing} mandatory document(s) missing`);
      if (pkgDiff) why.push("package count differs from declared");
      if (qtyIssue) why.push(`${qtyIssue} line(s) short or in excess`);
      verdictSub = why.join(" · ") + ". A gate officer cannot release this — call the stores supervisor.";
    } else {
      verdictClass = "v-ok";
      verdictTitle = "CLEARED FOR ENTRY";
      verdictSub = "All documents received. Package count and every line counted and verified against the invoice.";
      allow = true;
    }
  }

  const filteredArrivals = arrivals.filter(a => {
    if (!search) return true;
    const term = search.toLowerCase();
    return `${a.asn} ${a.po} ${a.vendor} ${a.vehicle}`.toLowerCase().includes(term);
  });

  return (
    <div className="gate-entry-container">
      <div className="wrap">
        <div className="d-flex justify-content-between align-items-center mb-4 mt-4">
          <div>
            <h3 className="mb-1 fw-bold text-dark" style={{ letterSpacing: '-0.5px' }}>
              Gate Entry
            </h3>
            <p className="text-muted mb-0 fs-14">
              Inbound Security Check
            </p>
          </div>
          <div className="d-flex align-items-stretch gap-3">
            {onBack && (
              <div
                onClick={onBack}
                className="d-inline-flex align-items-center justify-content-center text-muted cursor-pointer px-2"
                style={{ cursor: 'pointer', transition: 'color 0.2s ease' }}
              >
                <i className="fas fa-arrow-left me-2"></i>
                <span className="fw-medium">Back</span>
              </div>
            )}
            <div className="d-flex align-items-center border px-3 rounded shadow-sm text-muted" style={{ backgroundColor: '#fff', fontSize: '14px' }}>
              Plant <b className="ms-1 me-1 text-dark">BLR-01</b> · Gate <b className="ms-1 text-dark">02</b>
            </div>
            <div className="d-flex align-items-center border px-3 rounded shadow-sm text-muted fw-bold" style={{ backgroundColor: '#fff', fontSize: '14px' }}>
              {clock}
            </div>
          </div>
        </div>

        <div className={`verdict ${verdictClass}`}>
          <div className="vt">{verdictTitle}</div>
          <div className="vs">{verdictSub}</div>
          <div className="prog">
            {sel && (
              <>
                <span className={`pill ${mandUnanswered === 0 ? "done" : ""}`}>Documents</span>
                <span className={`pill ${pkgLock ? "done" : ""}`}>Packages</span>
                <span className={`pill ${verified === sel.lines.length ? "done" : ""}`}>Lines {verified}/{sel.lines.length}</span>
              </>
            )}
          </div>
        </div>

        <div className="grid">
          {/* LEFT */}
          <div>
            <div className="card">
              <h2><span className="step">1</span>Incoming deliveries<small>{filteredArrivals.length} expected</small></h2>
              <div className="cb">
                <input
                  className="search"
                  placeholder="Search vehicle, ASN, PO or supplier"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <div>
                  {filteredArrivals.length === 0 ? (
                    <div className="empty" style={{ padding: "24px 0" }}>No delivery matches that search.</div>
                  ) : (
                    filteredArrivals.map(a => {
                      const tagText = a.etaTag === "late" ? "Overdue" : (a.etaTag === "early" ? "Not due yet" : "Due now");
                      const isSel = sel && sel.asn === a.asn;
                      return (
                        <div key={a.asn} className={`arr ${isSel ? "sel" : ""}`} onClick={() => handleSelectArrival(a)}>
                          <div className="an">{a.vehicle}</div>
                          <div className="av">{a.vendor}</div>
                          <div className="av" style={{ fontFamily: "Consolas,monospace" }}>{a.asn} · PO {a.po}</div>
                          <div className="am">
                            <span>{a.eta} · {a.pkgs} pkgs</span>
                            <span className={`tag t-${a.etaTag}`}>{tagText}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <h2>Verification log</h2>
              <div className="cb">
                <div className="feed">
                  {feed.map((f, i) => (
                    <div key={i} className={`fi ${f.kind}`}>
                      <time>{f.time}</time>
                      <span>{f.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            {!sel ? (
              <div className="card" id="emptyState">
                <div className="empty">
                  <b>No delivery selected</b>
                  Select a vehicle from the incoming deliveries queue on the left.<br />
                  The declared consignment loads from the supplier's ASN, and you count the goods
                  against the documents the driver hands over.
                </div>
              </div>
            ) : (
              <div>
                <div className="card">
                  <h2><span className="step">2</span>Declared consignment<small>From supplier ASN — read only</small></h2>
                  <div className="cb">
                    <div className="kv">
                      <div><span>Supplier</span><b>{sel.vendor}</b></div>
                      <div><span>Supplier GSTIN</span><b>{sel.gstin}</b></div>
                      <div><span>Purchase order</span><b>{sel.po}</b></div>
                      <div><span>ASN</span><b>{sel.asn}</b></div>
                      <div><span>Tax invoice</span><b>{sel.inv} · {sel.invDate}</b></div>
                      <div><span>Invoice value</span><b>₹ {sel.invVal}</b></div>
                      <div><span>e-Way bill</span><b>{sel.ewb}</b></div>
                      <div><span>EWB valid upto</span><b>{sel.ewbTill}</b></div>
                      <div><span>Vehicle</span><b>{sel.vehicle}</b></div>
                      <div><span>Transporter</span><b>{sel.transporter}</b></div>
                      <div><span>LR / GR number</span><b>{sel.lr}</b></div>
                      <div><span>Driver</span><b>{sel.driver} · {sel.dl}</b></div>
                      <div><span>Packages declared</span><b>{String(sel.pkgs)}</b></div>
                      <div><span>Expected at gate</span><b>{sel.eta}</b></div>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h2><span className="step">3</span>Documents handed over<small>{docsDone} of {DOC_LIST.length} recorded</small></h2>
                  <div className="cb">
                    <div>
                      {DOC_LIST.map(d => (
                        <div key={d.id} className="doc">
                          <div className="dn">
                            <b>{d.name}{d.req && <span className="req">MANDATORY</span>}</b>
                            <i>{d.hint}</i>
                          </div>
                          <div className="seg">
                            <button className={docState[d.id] === "ok" ? "on-ok" : ""} onClick={() => handleDocClick(d.id, "ok", d.name)}>Received</button>
                            <button className={docState[d.id] === "bad" ? "on-bad" : ""} onClick={() => handleDocClick(d.id, "bad", d.name)}>Not given</button>
                            <button className={docState[d.id] === "na" ? "on-na" : ""} onClick={() => handleDocClick(d.id, "na", d.name)}>Not applicable</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={`card ${verdictTitle.startsWith("HOLD") || verdictTitle === "Count in progress" ? "focus" : ""}`}>
                  <h2><span className="step">4</span>Physical count — mandatory<small>{verified} of {sel.lines.length} lines verified</small></h2>
                  <div className="cb" style={{ paddingBottom: 8 }}>
                    <p className="note">
                      Count the packages first, then the material on each line. Enter what you physically
                      counted and press <b>Verify</b> to lock the line. Entry cannot be allowed until every
                      line and the package count are verified.
                    </p>
                  </div>
                  <div className="cb" style={{ paddingTop: 8 }}>
                    <div className="pkg">
                      <div><span className="lab">Packages declared</span><span className="big">{sel.pkgs}</span></div>
                      <div><span className="lab">Packages counted at gate</span>
                        <input type="number" placeholder="0" disabled={pkgLock} value={pkgVal} onChange={e => setPkgVal(e.target.value)} />
                      </div>
                      <button className={`vbtn ${pkgLock ? "undo" : ""}`} onClick={handlePkgVerify}>{pkgLock ? "Re-count" : "Verify package count"}</button>
                      <span className={`st ${!pkgLock ? "p" : (pkgDiff ? (pkgNum < sel.pkgs ? "s" : "x") : "m")}`}>
                        {!pkgLock ? "Not counted" : (pkgDiff ? (pkgNum < sel.pkgs ? `Short by ${sel.pkgs - pkgNum}` : `Excess by ${pkgNum - sel.pkgs}`) : "Matches")}
                      </span>
                    </div>
                    {pkgLock && pkgDiff && (
                      <input
                        className="rmk"
                        style={{ display: "block" }}
                        placeholder="Reason for the package difference (required)"
                        value={pkgRmk}
                        onChange={e => setPkgRmk(e.target.value)}
                      />
                    )}
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Material</th><th>Description</th>
                          <th style={{ textAlign: "right" }}>Declared</th><th>UOM</th>
                          <th style={{ textAlign: "right" }}>Counted at gate</th><th>Verify</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sel.lines.map((l, i) => {
                          const v = parseFloat(lineVal[i]);
                          const diff = v - l.qty;
                          const locked = lineLock[i];
                          const trClass = locked ? (diff === 0 ? "done" : "diff") : "";
                          let stClass = "p";
                          let stText = "Not counted";
                          if (locked) {
                            if (diff === 0) { stClass = "m"; stText = "Matches"; }
                            else if (diff < 0) { stClass = "s"; stText = `Short by ${Math.abs(diff)} ${l.uom}`; }
                            else { stClass = "x"; stText = `Excess by ${diff} ${l.uom}`; }
                          }

                          return (
                            <tr key={i} className={trClass}>
                              <td style={{ fontFamily: "Consolas,monospace" }}>{l.mat}</td>
                              <td>{l.desc}</td>
                              <td style={{ textAlign: "right" }}><span className="dec">{l.qty}</span></td>
                              <td>{l.uom}</td>
                              <td style={{ textAlign: "right" }}>
                                <input
                                  className="cnt"
                                  type="number"
                                  placeholder="0"
                                  disabled={locked}
                                  value={lineVal[i] || ""}
                                  onChange={e => setLineVal(prev => ({ ...prev, [i]: e.target.value }))}
                                />
                                {locked && diff !== 0 && (
                                  <input
                                    className="rmk"
                                    style={{ display: "block" }}
                                    placeholder="Reason for the difference (required)"
                                    value={lineRmk[i] || ""}
                                    onChange={e => setLineRmk(prev => ({ ...prev, [i]: e.target.value }))}
                                  />
                                )}
                              </td>
                              <td><button className={`vbtn ${locked ? "undo" : ""}`} onClick={() => handleLineVerify(i, l.mat, l.qty, l.uom)}>{locked ? "Re-count" : "Verify"}</button></td>
                              <td><span className={`st ${stClass}`}>{stText}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="totals">
                    <div>Lines verified <b>{verified} / {sel.lines.length}</b></div>
                    <div>Total declared <b>{tDec}</b></div>
                    <div>Total counted <b>{tAct}</b></div>
                    <div>Net difference <b style={{ color: tAct - tDec === 0 ? "var(--ok)" : "var(--warn)" }}>{tAct - tDec > 0 ? "+" : ""}{tAct - tDec}</b></div>
                  </div>
                </div>

                <div className="card">
                  <h2><span className="step">5</span>Gate decision</h2>
                  <div className="acts">
                    <button className="btn b-ok" disabled={!allow || decided} onClick={handleAllow}>Allow entry</button>
                    <button className="btn b-hold" disabled={decided} onClick={handleHold}>Hold for supervisor</button>
                    <button className="btn b-bad" disabled={decided} onClick={handleReject}>Turn away</button>
                    <button className="btn b-gh" onClick={handleReset}>Clear and start over</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {passGe && (
        <div className="modal on" onClick={(e) => e.target.className.includes("modal") && setPassGe(null)}>
          <div className="pass">
            <div className="pass-h">
              <b>Inward Gate Pass</b>
              <span>Aequm India Private Limited · Plant BLR-01 · Gate 02</span>
            </div>
            <div className="pass-b">
              <div className="kv" style={{ marginBottom: 18 }}>
                <div><span>Gate entry number</span><b>{passGe}</b></div>
                <div><span>In-time</span><b>{getNowStr()} · {new Date().toDateString()}</b></div>
                <div><span>Supplier</span><b>{sel.vendor}</b></div>
                <div><span>Purchase order</span><b>{sel.po}</b></div>
                <div><span>ASN</span><b>{sel.asn}</b></div>
                <div><span>Tax invoice</span><b>{sel.inv} · {sel.invDate}</b></div>
                <div><span>Vehicle</span><b>{sel.vehicle}</b></div>
                <div><span>Driver</span><b>{sel.driver}</b></div>
                <div><span>Packages</span><b>{pkgVal} counted of {sel.pkgs} declared</b></div>
                <div><span>Unload at dock</span><b>D-3</b></div>
                <div><span>Counted and verified by</span><b>R. Nagaraj, Security · Gate 02</b></div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Material</th><th>Description</th>
                    <th style={{ textAlign: "right" }}>Declared</th><th style={{ textAlign: "right" }}>Counted</th>
                    <th>UOM</th><th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {sel.lines.map((l, i) => {
                    const c = lineVal[i] !== undefined ? lineVal[i] : "";
                    const d = parseFloat(c) - l.qty;
                    const note = isNaN(d) ? "" : (d === 0 ? "OK" : (d < 0 ? `Short ${Math.abs(d)}` : `Excess ${d}`));
                    return (
                      <tr key={i}>
                        <td style={{ fontFamily: "Consolas,monospace" }}>{l.mat}</td>
                        <td>{l.desc}</td>
                        <td style={{ textAlign: "right" }}>{l.qty}</td>
                        <td style={{ textAlign: "right" }}><b>{c}</b></td>
                        <td>{l.uom}</td>
                        <td>{note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p style={{ fontSize: 13, color: "var(--mute)", marginTop: 14 }}>
                Quantities above are the physical count taken at the gate. Stores must receipt against the counted quantity, not the invoice quantity.
              </p>
              <div className="sign">
                <div>Security officer</div>
                <div>Driver</div>
                <div>Stores — GRN reference</div>
              </div>
            </div>
            <div className="acts noprint" style={{ borderTop: "1px solid var(--line)" }}>
              <button className="btn b-ok" onClick={() => window.print()}>Print gate pass</button>
              <button className="btn b-gh" onClick={() => setPassGe(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GateEntry;
