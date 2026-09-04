import React, { useState, useEffect } from 'react';
import BackButton from '../common/BackButton';
import './material-inward-verification.css';

// Utility functions
const nf = (n) => (n == null ? "0" : new Intl.NumberFormat("en-IN", {maximumFractionDigits:2}).format(n));
const sum = (arr, fn) => (arr || []).reduce((a, x) => a + (fn(x) || 0), 0);
const now = () => new Date().toISOString();

const STAGES = [
  {id:"seal",    title:"Seal check",   sub:"Every box, before opening"},
  {id:"count",   title:"Count",        sub:"Key each quantity, by batch"},
  {id:"reconcile",title:"Reconcile & decide", sub:"The numbers, then the call"},
  {id:"outcome", title:"Inward / Return", sub:"Warehouse or vendor"},
];

// Putaway bin entry, per line/batch — a controlled input (so what's typed is actually captured
// into state, unlike the old defaultValue-only field) with live autocomplete against the chosen
// warehouse's real bins (GET /api/mm/warehouses/{wh}/bins?search=...). Typing is still accepted
// even without picking a suggestion, so a bin that isn't in the master data yet doesn't block
// putaway — this only helps get the common case right, it doesn't hard-validate.
const BinField = ({ warehouseNo, value, onChange }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!warehouseNo || !(value || '').trim()) { setSuggestions([]); return; }
    const token = localStorage.getItem('auth_token');
    const t = setTimeout(() => {
      fetch(`/api/mm/warehouses/${warehouseNo}/bins?search=${encodeURIComponent(value.trim())}&limit=8`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => setSuggestions(data.bins || []))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => clearTimeout(t);
  }, [value, warehouseNo]);

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="miv-cnt"
        style={{ width: '110px', textAlign: 'left' }}
        placeholder={warehouseNo ? 'bin' : 'select warehouse'}
        disabled={!warehouseNo}
        value={value || ''}
        onChange={(e) => { onChange(e.target.value.toUpperCase()); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 20, background: '#fff', border: '1px solid #ccc', borderRadius: 4, minWidth: 120, boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
          {suggestions.map((b) => (
            <div key={b.binCode} style={{ padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
              onMouseDown={() => { onChange(b.binCode); setOpen(false); }}>
              {b.binCode}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function MaterialInwardVerification({ gateEntryId, onBack }) {
  const [C, setC] = useState(null);
  const [selBox, setSelBox] = useState(null);
  const [echo, setEcho] = useState({kind:"idle", text:"Ready.", sub:""});
  const [dialogContent, setDialogContent] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Real warehouses/bins from Enterprise Structure master data, for the putaway step's
  // warehouse picker and bin autocomplete (BinField below) — replaces the old hardcoded
  // "RCV-STAGE"/"WH1" placeholder strings that were never tied to real data.
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    fetch('/api/mm/warehouses', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setWarehouses(data.warehouses || []))
      .catch(() => setWarehouses([]));
  }, []);

  const toast = (msg) => setToastMessage(msg);
  const closeDialog = () => setDialogContent(null);

  // --- Core State Mutators ---
  const updateC = (updater) => {
    setC(prevC => {
      const nextC = { ...prevC };
      updater(nextC);
      return nextC;
    });
  };

  const goto = (stage) => updateC(c => c.stage = stage);

  // --- Initial Data Loading ---
  const adopt = (raw) => {
    const c = Object.assign({
      gate_entry_no:"", gate_in:"", vehicle_no:"", vehicle_type:"", driver:"",
      po_no:"", vendor_inv_no:"", vendor_no:"", vendor_name:"", order_date:"",
      packing_slip_no:"", packing_slip_date:"", location:"", receiving_warehouse:"", boxes:[],
    }, raw || {});
    
    c.boxes = (c.boxes || []).map((b, bi) => Object.assign({
      box_no:`BOX-${bi+1}`, barcode:"", seal_no:"", gross_kg:0, net_kg:0,
      seal_checked:false, seal_ok:null, seal_at:null, counted:false, counted_at:null, lines:[],
    }, b, {
      lines:(b.lines || []).map((l, li) => {
        const line = Object.assign({
          id:`${bi}-${li}`, item_no:"", description:"", uom:"EA",
          po_qty:0, packed_qty:0, counted_qty:0, damaged:0, remark:"", bin:"",
          unlisted:false, touched:false, batches:null,
        }, l, {id:`${bi}-${li}`});
        if (Array.isArray(line.batches) && line.batches.length){
          line.batches = line.batches.map(bt => Object.assign(
            {batch_no:"", packed_qty:0, counted_qty:0, damaged:0, remark:"", bin:"",
             touched:false, unlisted:false}, bt));
          line.packed_qty = sum(line.batches, x => x.packed_qty);
        } else line.batches = null;
        return line;
      }),
    }));
    c.stage = "seal"; c.hold = null; c.approval = null; c.vendor_share = null;
    c.auto_approved = null; c.decision = null; c.inward = null; c.rtv = null;
    
    setC(c);
    setSelBox(null);
    setEcho({kind:"idle", text:"Consignment loaded.", sub:`${c.boxes.length} boxes. Verify every seal before opening anything.`});
  };

  useEffect(() => {
    if (gateEntryId) {
      fetch(`/api/employee/material-inward/${gateEntryId}`)
        .then(res => res.json())
        .then(data => {
          const raw = {
            gate_entry_no: data.gateEntryNo,
            gate_in: data.gateIn,
            vehicle_no: data.vehicleNo || "N/A",
            vehicle_type: "N/A",
            driver: "Unknown",
            po_no: data.poReference,
            vendor_inv_no: data.invoiceNo,
            vendor_no: data.vendorCode,
            vendor_name: data.vendorName,
            order_date: data.poDate,
            packing_slip_no: data.packingSlipNo,
            packing_slip_date: data.packingSlipDate,
            location: data.destination || "WH1",
            boxes: data.boxes ? data.boxes.map(b => ({
              box_no: b.boxNo,
              seal_no: b.manifestSeal,
              gross_kg: b.weight ? parseFloat(b.weight) : 0,
              net_kg: 0,
              lines: b.lines ? b.lines.map(l => ({
                item_no: l.itemNo,
                description: l.description,
                uom: l.uom,
                po_qty: l.manifestQty,
                packed_qty: l.manifestQty,
                batches: l.batches ? l.batches.map(bt => ({
                  batch_no: bt.batchNo,
                  packed_qty: bt.qty
                })) : null
              })) : []
            })) : []
          };
          adopt(raw);
        })
        .catch(err => {
          console.error("Failed to fetch details from API, using demo data", err);
          loadDemo();
        });
    } else {
      loadDemo();
    }
  }, [gateEntryId]);

  const loadDemo = () => {
    adopt({
      gate_entry_no:"GE-2026-0418", gate_in:"23 Aug 2026, 09:14",
      vehicle_no:"KA-51-AB-7742", vehicle_type:"LCV — 14 ft", driver:"R. Salunke",
      po_no:"PO-104128", vendor_inv_no:"SIN/26-27/0912",
      vendor_no:"V-10248", vendor_name:"Sundaram Precision Components Pvt Ltd",
      order_date:"04 Aug 2026",
      packing_slip_no:"PS-0912/26", packing_slip_date:"21 Aug 2026",
      location:"WH1 — Main Warehouse, Inward Bay 2",
      boxes:[
        {box_no:"BOX-001", seal_no:"SL-88231", gross_kg:42, net_kg:38, lines:[
          {item_no:"MS-4410", description:"Flange, mild steel, 4 in, drilled", uom:"NOS",
           po_qty:120, batches:[
             {batch_no:"B26-0411", packed_qty:60},
             {batch_no:"B26-0412", packed_qty:60}]},
          {item_no:"FS-2201", description:"Hex bolt M12 x 60, Gr 8.8", uom:"NOS",
           po_qty:480, batches:[{batch_no:"L-2208", packed_qty:480}]},
        ]},
        {box_no:"BOX-002", seal_no:"SL-88232", gross_kg:57, net_kg:51, lines:[
          {item_no:"AL-7075", description:"Aluminium billet 7075-T6, 60 mm", uom:"KG",
           po_qty:250, batches:[
             {batch_no:"H-9921", packed_qty:150},
             {batch_no:"H-9922", packed_qty:100}]},
          {item_no:"CN-1180", description:"O-ring kit, nitrile, assorted", uom:"SET",
           po_qty:20, batches:[{batch_no:"N-4417", packed_qty:20, exp:"09/2028"}]},
        ]},
      ],
    });
    setEcho({kind:"idle", text:"Worked example loaded — 2 boxes, 4 materials, 6 batches.", sub:"Step 1: verify both seals before anything is opened."});
    toast("Worked example loaded.");
  };

  const clearConsignment = () => {
    setDialogContent({
      title: "Clear this consignment?",
      body: <div className="miv-danger">Everything recorded so far is discarded — seals, counts, the hold and any decision. Export first if you need it.</div>,
      buttons: [
        { label: "Keep it", onClick: closeDialog },
        { label: "Clear", cls: "warn", onClick: () => { setC(null); setSelBox(null); setEcho({kind:"idle", text:"Ready.", sub:""}); closeDialog(); } }
      ]
    });
  };

  if (!C) {
    return (
      <div className="miv-pane p-4" style={{ backgroundColor: 'transparent' }}>
        <BackButton onClick={onBack} />
        <div className="miv-pagebar">
          <button className="miv-pb" onClick={loadDemo}>Load Worked Example</button>
        </div>
        <div className="miv-empty">No consignment loaded. Click "Load Worked Example" to begin.</div>
        {toastMessage && <div className="miv-toast">{toastMessage}</div>}
        {dialogContent && (
          <div className="miv-dlg">
            <div className="miv-dlg-in">
              <header><h2>{dialogContent.title}</h2></header>
              <div className="miv-body">{dialogContent.body}</div>
              <footer>
                {dialogContent.buttons.map((b, i) => (
                  <button key={i} className={`miv-pb ${b.cls || ""}`} onClick={b.onClick}>{b.label}</button>
                ))}
              </footer>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Derived State & Helpers ---
  const allLines = () => {
    const list = [];
    C.boxes.forEach(box => box.lines.forEach(line => list.push({box, line})));
    return list;
  };

  const isBatched = (l) => Array.isArray(l.batches) && l.batches.length > 0;
  
  const linePacked = (l) => isBatched(l) ? sum(l.batches, x => x.packed_qty) : l.packed_qty;
  
  const lineState = (l) => {
    const ctd = isBatched(l) ? sum(l.batches, x => x.counted_qty) : l.counted_qty;
    const dmg = isBatched(l) ? sum(l.batches, x => x.damaged) : l.damaged;
    const pkd = linePacked(l);
    return {
      po: l.po_qty, packed: pkd, counted: ctd, damaged: dmg,
      accepted: Math.max(0, ctd - dmg), vsSlip: ctd - pkd, vsPO: pkd - l.po_qty,
      touched: isBatched(l) ? l.batches.some(x => x.touched) : l.touched,
    };
  };

  const summary = () => {
    const s = {countedUnits:0, expectedUnits:0, matched:0, short:0, excess:0, damaged:0, unlisted:0, poIssues:0, sealBroken:0};
    C.boxes.forEach(b => {
      if (b.seal_ok === false) s.sealBroken++;
      b.lines.forEach(l => {
        const st = lineState(l);
        s.countedUnits += st.counted; s.expectedUnits += st.packed;
        s.damaged += st.damaged;
        if (l.unlisted) s.unlisted++;
        else if (st.vsSlip < 0) s.short++;
        else if (st.vsSlip > 0) s.excess++;
        else s.matched++;
        if (!l.unlisted && st.vsPO !== 0) s.poIssues++;
      });
    });
    return s;
  };

  // --- Handlers ---
  const finishSeals = () => {
    const left = C.boxes.filter(x => !x.seal_checked).length;
    if (left > 0) return toast(`Cannot proceed — ${left} seal${left===1?" remains":"s remain"} unchecked.`);
    updateC(c => { c.seals_done_at = now(); c.stage = "count"; });
    setEcho({kind:"idle", text:"Count phase.", sub:"Select a box to start counting."});
  };

  const selectBox = (bno) => {
    const b = C.boxes.find(x => x.box_no === bno);
    if (!b) return;
    if (!b.seal_checked && C.stage !== "seal"){
      return toast("Cannot open this box — its seal was not checked.");
    }
    setSelBox(b.box_no);
    setEcho({kind:"idle", text:b.box_no, sub: b.counted ? "Already counted, but you can revise it." : "Ready to count."});
  };

  const markBoxCounted = (bno) => {
    updateC(c => {
      const box = c.boxes.find(x => x.box_no === bno);
      if (!box) return;
      box.counted = true;
      box.counted_at = box.counted_at || now();
      box.lines.forEach(l => {
        if (!l.touched && lineState(l).counted === 0){
          if (isBatched(l)){ l.batches.forEach(bt => { bt.counted_qty = 0; bt.touched = true; }); }
          else { l.counted_qty = 0; l.touched = true; }
        }
      });
    });
    const next = C.boxes.find(x => !x.counted && x.box_no !== bno);
    if (next) selectBox(next.box_no);
    else setSelBox(null);
    setEcho({kind:"ok", text:`${bno} counted.`, sub:"All lines marked."});
  };

  const reconcile = () => {
    const left = C.boxes.filter(x => !x.counted).length;
    if (left > 0) return toast(`Cannot reconcile — ${left} box${left===1?" remains":"es remain"} uncounted.`);
    const s = summary();
    
    updateC(c => {
      c.counted_at = c.counted_at || now();
      const reasons = [];
      if (s.sealBroken) reasons.push(`${s.sealBroken} box${s.sealBroken===1?"":"es"} arrived with a broken seal`);
      if (s.short) reasons.push(`${s.short} line${s.short===1?"":"s"} short-supplied against the packing slip`);
      if (s.excess) reasons.push(`${s.excess} line${s.excess===1?"":"s"} over-supplied against the packing slip`);
      if (s.damaged) reasons.push(`${s.damaged} unit${s.damaged===1?"":"s"} found damaged on arrival`);
      if (s.unlisted) reasons.push(`${s.unlisted} line${s.unlisted===1?"":"s"} found but not listed on the slip`);
      if (s.poIssues) reasons.push(`${s.poIssues} line${s.poIssues===1?"":"s"} where the slip disagrees with our PO`);
      
      c.stage = "reconcile";
      if (reasons.length === 0){
        c.auto_approved = {ref:"AUTO-" + c.gate_entry_no.replace(/^GE-/,"")};
        c.decision = {action:"accept", by:"System", reason:"Auto-approved: exact match and seals intact", automatic:true};
        toast("Perfect match — auto-approved.");
      } else if (!c.hold){
        const hid = "HLD-" + c.gate_entry_no.replace(/^GE-/,"");
        c.hold = {id:hid, raised_at:now(), reasons};
        c.approval = {id:"APP-" + hid.replace(/^HLD-/,""), requested_at:now()};
        c.vendor_share = {portal_ref:"/share/c-" + hid, shared_at:now(), rows:allLines().map(({box,line}) => {
          const st = lineState(line);
          if (isBatched(line)){
            return line.batches.map(bt => ({
              box_no:box.box_no, item_no:line.item_no, description:line.description,
              batch_no:bt.batch_no, packed_qty:+bt.packed_qty||0, counted_qty:+bt.counted_qty||0,
              variance:(+bt.counted_qty||0) - (+bt.packed_qty||0), note:bt.remark||(bt.unlisted?"Not on slip":"")
            }));
          } else {
            return [{box_no:box.box_no, item_no:line.item_no, description:line.description, batch_no:"",
              packed_qty:st.packed, counted_qty:st.counted, variance:st.vsSlip,
              note:line.remark||(line.unlisted?"Not on slip":"")}];
          }
        }).flat()};
        toast("Hold raised. Discrepancies shared with vendor.");
      }
    });
  };

  const askDecision = (action) => {
    const accept = action === "accept";
    let who = "", why = "", rn = "";
    setDialogContent({
      title: accept ? "Accept the material" : "Reject and return",
      body: <div>
        <div className={accept ? "miv-warnbox" : "miv-danger"}>
          {accept ? "Inward will be raised for the quantities counted, less anything damaged — not for the quantities on the slip."
                  : "Nothing enters the warehouse. The consignment goes back to the vendor."}
        </div>
        <div className="miv-fld" style={{marginTop:"14px"}}>
          <label>Approved by</label>
          <input placeholder="name or employee code" onChange={e => who = e.target.value} />
        </div>
        <div className="miv-fld">
          <label>Reason</label>
          <select onChange={e => why = e.target.value}>
            {(accept ? ["Shortage accepted, debit note raised","Excess accepted, PO to be amended", "Damage within tolerance","Documentation corrected with vendor","Urgent — production need"]
                     : ["Short supply beyond tolerance","Material does not match the order", "Damaged in transit","Seal broken, contents not trustworthy", "No test certificate","Wrong specification"])
             .map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="miv-fld">
          <label>Note (optional)</label>
          <input onChange={e => rn = e.target.value} />
        </div>
      </div>,
      buttons: [
        { label: "Cancel", onClick: closeDialog },
        { label: accept ? "Accept" : "Reject", cls: accept ? "go" : "warn", onClick: () => {
          if (!who.trim()) { toast("A name is needed against this decision."); return; }
          const finalWhy = why + (rn.trim() ? ` — ${rn.trim()}` : "");
          updateC(c => {
            c.decision = {action, by:who.trim(), reason:finalWhy, at:now()};
            if (c.hold) { c.hold.released_at = now(); c.hold.released_by = who.trim(); }
          });
          closeDialog();
        }}
      ]
    });
  };

  // --- Rendering Helpers ---
  const currentStageIndex = STAGES.findIndex(s => s.id === C.stage);
  const s = summary();

  return (
    <div className="miv-pane p-4" style={{ backgroundColor: 'transparent' }}>
      <BackButton onClick={onBack} />

      <div className="miv-pagebar">
        <div className="miv-stamp">Gate Entry</div><div className="miv-pb"><b>{C.gate_entry_no}</b></div>
        <div className="miv-stamp" style={{marginLeft:"8px"}}>Vehicle</div><div className="miv-pb">{C.vehicle_no} · {C.vehicle_type}</div>
        <div className="miv-espacer"></div>
        <div className="miv-pb" onClick={() => window.print()}>Print</div>
        <div className="miv-pb warn" onClick={clearConsignment}>Clear</div>
      </div>

      <div className="miv-rail">
        {STAGES.map((st, i) => {
          let cls = "miv-st";
          if (i < currentStageIndex) cls += " done";
          else if (i === currentStageIndex) cls += " now";
          else if (st.id === "outcome" && C.hold && !C.hold.released_at && !C.decision) cls += " blocked";
          return (
            <div key={st.id} className={cls}>
              <div className="n">
                {i < currentStageIndex ? <span className="miv-tick">✓</span> : <span>0{i+1}</span>}
                {st.title}
              </div>
              <div className="t">{st.sub}</div>
              <div className="s">{st.id === "outcome" && C.hold && !C.decision ? "Awaiting approval" : ""}</div>
            </div>
          );
        })}
      </div>

      <div className="miv-card">
        <header>
          <h2>{C.vendor_name}</h2>
          <span className="miv-chip grey">{C.vendor_no}</span>
        </header>
        <div className="miv-hdr">
          <div><label>Packing Slip</label><b>{C.packing_slip_no}</b> <span style={{color:"var(--muted)",fontSize:"12px"}}>· {C.packing_slip_date}</span></div>
          <div><label>Purchase Order</label><b>{C.po_no}</b> <span style={{color:"var(--muted)",fontSize:"12px"}}>· {C.order_date}</span></div>
          <div><label>Vendor Invoice</label><b>{C.vendor_inv_no}</b></div>
          <div><label>Arrived At</label><b>{C.gate_in}</b></div>
          <div><label>Destination</label><b>{C.location}</b></div>
        </div>
      </div>

      {C.stage === "seal" && (
        <div className="miv-card">
          <header>
            <h2>Step 1 — Verify seals on every box</h2>
            <div className="miv-acts">
              <button className="miv-mini" onClick={() => {
                const todo = C.boxes.filter(x => !x.seal_checked);
                if (!todo.length) return toast("Every seal is already checked.");
                setDialogContent({
                  title: "Mark every seal intact?",
                  body: <div className="miv-warnbox">{todo.length} boxes would be recorded as arriving with the seal intact.</div>,
                  buttons: [
                    { label: "Cancel", onClick: closeDialog },
                    { label: "I checked them all", cls: "go", onClick: () => {
                      updateC(c => { c.boxes.forEach(x => { x.seal_checked = true; x.seal_ok = true; x.seal_at = now(); }); });
                      closeDialog();
                    }}
                  ]
                });
              }}>Mark all intact</button>
            </div>
          </header>
          <div className="miv-card-body">
            <table className="miv-g">
              <thead>
                <tr><th>Box</th><th>Manifest Seal</th><th>Weight</th><th>Status</th><th>Verification</th></tr>
              </thead>
              <tbody>
                {C.boxes.map(b => (
                  <tr key={b.box_no}>
                    <td className="mono" style={{fontWeight:600}}>{b.box_no}</td>
                    <td className="mono">{b.seal_no}</td>
                    <td>{nf(b.gross_kg)} kg gross</td>
                    <td>
                      {!b.seal_checked ? <span className="miv-chip grey">Unchecked</span> :
                       b.seal_ok ? <span className="miv-chip green">Intact</span> :
                       <span className="miv-chip red">Broken</span>}
                    </td>
                    <td>
                      {!b.seal_checked ? (
                        <div style={{display:"flex",gap:"6px"}}>
                          <button className="miv-pb go" style={{padding:"6px 12px"}} onClick={() => updateC(c => { const bx = c.boxes.find(x => x.box_no === b.box_no); bx.seal_checked=true; bx.seal_ok=true; bx.seal_at=now(); })}>Seal intact</button>
                          <button className="miv-pb warn" style={{padding:"6px 12px"}} onClick={() => updateC(c => { const bx = c.boxes.find(x => x.box_no === b.box_no); bx.seal_checked=true; bx.seal_ok=false; bx.seal_at=now(); })}>Broken</button>
                        </div>
                      ) : (
                        <button className="miv-mini" onClick={() => updateC(c => { const bx = c.boxes.find(x => x.box_no === b.box_no); bx.seal_checked=false; bx.seal_ok=null; })}>Undo</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="miv-foot">
              <button className="miv-pb go big" onClick={finishSeals}>Continue to count</button>
              <span className="miv-stamp">{C.boxes.filter(x => x.seal_checked).length} of {C.boxes.length} seals verified</span>
            </div>
          </div>
        </div>
      )}

      {C.stage === "count" && (
        <div style={{display:"flex", gap:"18px", alignItems:"flex-start", flexWrap:"wrap"}}>
          <div style={{flex:"1 1 340px", display:"flex", flexDirection:"column", gap:"9px"}}>
            <div style={{fontFamily:"var(--mono)", fontSize:"9px", letterSpacing:".12em", textTransform:"uppercase", color:"var(--muted)", marginBottom:"5px"}}>Consignment Boxes</div>
            {C.boxes.map(b => (
              <div key={b.box_no} className={`miv-boxrow ${b.box_no === selBox ? "sel" : ""} ${b.counted ? "done" : "todo"}`}>
                <div className="miv-boxhead" onClick={() => selectBox(b.box_no)}>
                  <div className="miv-bno">{b.box_no}</div>
                  <div className="miv-bmeta">
                    {b.seal_ok === false ? <span style={{color:"var(--iron)"}}>Broken seal</span> : "Seal intact"}<br/>
                    {b.lines.length} material{b.lines.length===1?"":"s"} · {b.counted ? "Counted" : "Uncounted"}
                  </div>
                </div>
              </div>
            ))}
            <button className="miv-pb big" onClick={() => goto("seal")}>Back to seals</button>
            <button className="miv-pb go big" onClick={reconcile}>Finish counting &amp; Reconcile</button>
          </div>
          
          <div style={{flex:"2 1 600px"}}>
            {selBox ? (() => {
              const b = C.boxes.find(x => x.box_no === selBox);
              return (
                <div className="miv-card">
                  <header><h2>{b.box_no}</h2><span className="miv-stamp">seal {b.seal_no} {b.seal_ok === false ? "· BROKEN" : "· intact"}</span></header>
                  <div className="miv-card-body">
                    <table className="miv-g">
                      <thead>
                        <tr><th>Material</th><th>Batch</th><th className="num">UOM</th><th className="num">Ordered</th><th className="num">Packed</th><th className="num">Counted</th><th className="num">Damaged</th><th></th></tr>
                      </thead>
                      <tbody>
                        {b.lines.map(l => isBatched(l) ? (
                          <React.Fragment key={l.id}>
                            <tr className="miv-lhead">
                              <td><div className="mono" style={{fontWeight:600}}>{l.item_no}</div><div className="miv-desc">{l.description}</div></td>
                              <td><span className="miv-chip grey">{l.batches.length} batches</span></td>
                              <td className="num">{l.uom}</td>
                              <td className="num">{nf(l.po_qty)}</td>
                              <td className="num">{nf(linePacked(l))}</td>
                              <td className="num" style={{fontWeight:600}}>{nf(lineState(l).counted)}</td>
                              <td className="num">{lineState(l).damaged > 0 ? <span style={{color:"var(--iron)"}}>{nf(lineState(l).damaged)}</span> : "—"}</td>
                              <td></td>
                            </tr>
                            {l.batches.map(bt => (
                              <tr className="miv-brow" key={bt.batch_no}>
                                <td className="miv-bcell"><span className="miv-bmark">└</span><span className="miv-desc" style={{display:"inline"}}>batch</span></td>
                                <td className="mono">{bt.batch_no}</td>
                                <td></td><td></td>
                                <td className="num">{nf(bt.packed_qty)}</td>
                                <td className="num">
                                  <input type="number" className="miv-cnt" value={bt.counted_qty || ''} placeholder="0" 
                                         onChange={e => updateC(c => {
                                           const bx = c.boxes.find(x => x.box_no === selBox);
                                           const ln = bx.lines.find(x => x.id === l.id);
                                           const batch = ln.batches.find(x => x.batch_no === bt.batch_no);
                                           batch.counted_qty = Math.max(0, +e.target.value || 0);
                                           batch.touched = true;
                                         })} />
                                </td>
                                <td className="num">{bt.damaged > 0 ? <span style={{color:"var(--iron)"}}>{nf(bt.damaged)}</span> : "—"}</td>
                                <td>
                                  <div className="miv-acts">
                                    <button className="miv-mini" onClick={() => updateC(c => {
                                           const bx = c.boxes.find(x => x.box_no === selBox);
                                           const ln = bx.lines.find(x => x.id === l.id);
                                           const batch = ln.batches.find(x => x.batch_no === bt.batch_no);
                                           batch.counted_qty = bt.packed_qty; batch.touched = true;
                                    })}>All {bt.packed_qty}</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        ) : (
                          <tr key={l.id}>
                            <td><div className="mono" style={{fontWeight:600}}>{l.item_no}</div><div className="miv-desc">{l.description}</div></td>
                            <td className="mono">—</td>
                            <td className="num">{l.uom}</td>
                            <td className="num">{nf(l.po_qty)}</td>
                            <td className="num">{nf(l.packed_qty)}</td>
                            <td className="num">
                              <input type="number" className="miv-cnt" value={l.counted_qty || ''} placeholder="0"
                                     onChange={e => updateC(c => {
                                       const bx = c.boxes.find(x => x.box_no === selBox);
                                       const ln = bx.lines.find(x => x.id === l.id);
                                       ln.counted_qty = Math.max(0, +e.target.value || 0);
                                       ln.touched = true;
                                     })} />
                            </td>
                            <td className="num">{l.damaged > 0 ? <span style={{color:"var(--iron)"}}>{nf(l.damaged)}</span> : "—"}</td>
                            <td>
                              <div className="miv-acts">
                                <button className="miv-mini" onClick={() => updateC(c => {
                                       const bx = c.boxes.find(x => x.box_no === selBox);
                                       const ln = bx.lines.find(x => x.id === l.id);
                                       ln.counted_qty = l.packed_qty; ln.touched = true;
                                })}>All {l.packed_qty}</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="miv-foot">
                      <button className="miv-pb go" onClick={() => markBoxCounted(b.box_no)}>
                        {b.counted ? "Re-confirm this box" : "Mark this box counted"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="miv-empty">Select a box from the list on the left to start counting its contents.</div>
            )}
          </div>
        </div>
      )}

      {C.stage === "reconcile" && (
        <div className="miv-card">
          <header>
            <h2>Step 3 — Reconcile &amp; decide</h2>
            <span className={`miv-chip ${C.auto_approved ? "green" : (C.hold && !C.hold.released_at && !C.decision) ? "red" : "blue"}`}>
              {C.auto_approved ? "Auto approved" : (C.hold && !C.hold.released_at && !C.decision) ? "Awaiting approval" : "Decided"}
            </span>
          </header>
          <div className="miv-card-body">
            {C.auto_approved ? (
              <div className="miv-good"><b style={{fontSize:"15px"}}>AUTO APPROVED</b><br/>Every box reconciled and intact on quantity. Reference <span className="mono">{C.auto_approved.ref}</span>.</div>
            ) : (C.hold && !C.decision) ? (
              <div className="miv-danger"><b style={{fontSize:"15px"}}>ON HOLD — {C.hold.reasons.length} discrepanc{C.hold.reasons.length===1?"y":"ies"}</b><br/>
                Hold <span className="mono">{C.hold.id}</span> raised. The hold lifts only when the approval is granted.
                <ul style={{margin:"10px 0 0", paddingLeft:"20px", lineHeight:"1.6"}}>
                  {C.hold.reasons.map((r,i) => <li key={i} style={{marginBottom:"4px"}}>{r}</li>)}
                </ul>
              </div>
            ) : C.decision ? (
              <div className={C.decision.action === "accept" ? "miv-good" : "miv-danger"}>
                <b>{C.decision.action === "accept" ? "Approved" : "Approval refused"}</b> by {C.decision.by} — {C.decision.reason}.
              </div>
            ) : null}

            <div className="miv-tally" style={{marginTop:"16px"}}>
              <div className="miv-t3 b-ink"><label>Units counted</label><b>{nf(s.countedUnits)}</b><small>of {nf(s.expectedUnits)} declared</small></div>
              <div className="miv-t3"><label>Matched</label><b>{s.matched}</b><small>lines</small></div>
              <div className="miv-t3 b-amber"><label>Short</label><b>{s.short}</b><small>lines</small></div>
              <div className="miv-t3 b-iron"><label>Excess</label><b>{s.excess}</b><small>lines</small></div>
              <div className="miv-t3 b-iron"><label>Damaged</label><b>{s.damaged}</b><small>units</small></div>
              <div className="miv-t3 b-blue"><label>Slip vs PO</label><b>{s.poIssues}</b><small>lines differ</small></div>
              <div className="miv-t3 b-iron"><label>Seals broken</label><b>{s.sealBroken}</b><small>boxes</small></div>
            </div>

            <div style={{marginTop:"16px"}}>
              <table className="miv-g">
                <thead>
                  <tr><th>Box</th><th>Material</th><th>Batch</th><th className="num">UOM</th><th className="num">Ordered</th><th className="num">Packed</th><th className="num">Counted</th><th className="num">Damaged</th><th className="num">vs Slip</th><th className="num">Slip vs PO</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {C.boxes.map(b => (
                    <React.Fragment key={b.box_no}>
                      {b.seal_ok === false && <tr><td colSpan="11" style={{background:"var(--iron-soft)",color:"#6E241E",fontSize:"12px"}}><b>{b.box_no}</b> — arrived with broken seal</td></tr>}
                      {b.lines.map(l => isBatched(l) ? (
                        <React.Fragment key={l.id}>
                          <tr>
                            <td className="mono">{b.box_no}</td>
                            <td><div className="mono" style={{fontWeight:600}}>{l.item_no}</div><div className="miv-desc">{l.description}</div></td>
                            <td className="mono">{l.batches.length} batches</td>
                            <td className="num">{l.uom}</td>
                            <td className="num">{nf(l.po_qty)}</td>
                            <td className="num">{nf(linePacked(l))}</td>
                            <td className="num" style={{fontWeight:600}}>{nf(lineState(l).counted)}</td>
                            <td className="num">{lineState(l).damaged > 0 ? <span style={{color:"var(--iron)"}}>{nf(lineState(l).damaged)}</span> : "—"}</td>
                            <td className="num">{lineState(l).vsSlip === 0 ? <span style={{color:"var(--muted)"}}>0</span> : <span style={{color:lineState(l).vsSlip<0?"var(--amber)":"var(--iron)",fontWeight:600}}>{lineState(l).vsSlip>0?"+":""}{nf(lineState(l).vsSlip)}</span>}</td>
                            <td className="num">{lineState(l).vsPO === 0 ? <span style={{color:"var(--muted)"}}>0</span> : <span style={{color:"var(--blue)",fontWeight:600}}>{lineState(l).vsPO>0?"+":""}{nf(lineState(l).vsPO)}</span>}</td>
                            <td>{lineState(l).vsSlip === 0 ? <span className="miv-chip green">OK</span> : lineState(l).vsSlip < 0 ? <span className="miv-chip amber">Short</span> : <span className="miv-chip red">Excess</span>}</td>
                          </tr>
                          {l.batches.map(bt => (
                            <tr className="miv-brow" key={bt.batch_no}>
                              <td></td>
                              <td><span className="miv-bmark">└</span><span className="miv-desc" style={{display:"inline"}}>batch</span></td>
                              <td className="mono">{bt.batch_no}</td>
                              <td className="num">{l.uom}</td>
                              <td className="num">—</td>
                              <td className="num">{nf(bt.packed_qty)}</td>
                              <td className="num" style={{fontWeight:600}}>{nf(bt.counted_qty)}</td>
                              <td className="num">{bt.damaged > 0 ? <span style={{color:"var(--iron)"}}>{nf(bt.damaged)}</span> : "—"}</td>
                              <td className="num">{(bt.counted_qty - bt.packed_qty) === 0 ? <span style={{color:"var(--muted)"}}>0</span> : <span style={{color:(bt.counted_qty - bt.packed_qty)<0?"var(--amber)":"var(--iron)",fontWeight:600}}>{(bt.counted_qty - bt.packed_qty)>0?"+":""}{nf(bt.counted_qty - bt.packed_qty)}</span>}</td>
                              <td className="num">—</td>
                              <td>{(bt.counted_qty - bt.packed_qty) === 0 ? <span className="miv-chip green">OK</span> : (bt.counted_qty - bt.packed_qty) < 0 ? <span className="miv-chip amber">Short</span> : <span className="miv-chip red">Excess</span>}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ) : (
                        <tr key={l.id}>
                          <td className="mono">{b.box_no}</td>
                          <td><div className="mono" style={{fontWeight:600}}>{l.item_no}</div><div className="miv-desc">{l.description}</div></td>
                          <td className="mono">—</td>
                          <td className="num">{l.uom}</td>
                          <td className="num">{nf(l.po_qty)}</td>
                          <td className="num">{nf(l.packed_qty)}</td>
                          <td className="num" style={{fontWeight:600}}>{nf(l.counted_qty)}</td>
                          <td className="num">{l.damaged > 0 ? <span style={{color:"var(--iron)"}}>{nf(l.damaged)}</span> : "—"}</td>
                          <td className="num">{lineState(l).vsSlip === 0 ? <span style={{color:"var(--muted)"}}>0</span> : <span style={{color:lineState(l).vsSlip<0?"var(--amber)":"var(--iron)",fontWeight:600}}>{lineState(l).vsSlip>0?"+":""}{nf(lineState(l).vsSlip)}</span>}</td>
                          <td className="num">{lineState(l).vsPO === 0 ? <span style={{color:"var(--muted)"}}>0</span> : <span style={{color:"var(--blue)",fontWeight:600}}>{lineState(l).vsPO>0?"+":""}{nf(lineState(l).vsPO)}</span>}</td>
                          <td>{lineState(l).vsSlip === 0 ? <span className="miv-chip green">OK</span> : lineState(l).vsSlip < 0 ? <span className="miv-chip amber">Short</span> : <span className="miv-chip red">Excess</span>}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="miv-foot">
              {C.decision ? (
                <>
                  <button className="miv-pb go big" onClick={() => goto("outcome")}>Continue to {C.decision.action === "accept" ? "inward" : "return"}</button>
                  <button className="miv-pb" onClick={() => updateC(c => c.decision = null)}>Change decision</button>
                </>
              ) : C.auto_approved ? (
                <>
                  <button className="miv-pb go big" onClick={() => goto("outcome")}>Start inward — nothing to approve</button>
                  <button className="miv-pb" onClick={() => { updateC(c => { c.stage = "count"; c.auto_approved = null; }); }}>Re-open counting</button>
                </>
              ) : (
                <>
                  <button className="miv-pb go big" onClick={() => askDecision("accept")}>Approve — release the hold</button>
                  <button className="miv-pb warn big" onClick={() => askDecision("reject")}>Refuse — return to vendor</button>
                  <button className="miv-pb" onClick={() => { updateC(c => { c.stage = "count"; c.hold = null; c.approval = null; c.vendor_share = null; }); }}>Re-open counting</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {C.stage === "outcome" && C.decision?.action === "accept" && (
        <div className="miv-card">
          <header><h2>Step 5 — Inward to warehouse</h2><span className="miv-chip green">{C.decision.automatic ? "Cleared automatically" : "Accepted"}</span></header>
          <div className="miv-card-body">
            <div className={C.decision.automatic ? "miv-good" : "miv-warnbox"}>
              {C.decision.automatic ? <b>AUTO APPROVED. Every box reconciled.</b> : <b>Approved by {C.decision.by} — {C.decision.reason}.</b>}
            </div>
            {C.inward && <div className="miv-good" style={{marginTop:"14px"}}><b>Inward raised.</b> {C.inward.grn_no} into {C.location}. {nf(C.inward.units)} units putaway.</div>}

            <div style={{marginTop:"14px", maxWidth:320}}>
              <label style={{fontSize:11, fontWeight:700, color:"var(--ink-soft, #6b7a78)", display:"block", marginBottom:4}}>Receiving warehouse</label>
              <select className="miv-cnt" style={{width:"100%", textAlign:"left"}} value={C.receiving_warehouse || ""}
                disabled={!!C.inward}
                onChange={(e) => updateC(c => { c.receiving_warehouse = e.target.value; })}>
                <option value="">— Select warehouse —</option>
                {warehouses.map(w => <option key={w.warehouseNo} value={w.warehouseNo}>{w.description} ({w.warehouseNo})</option>)}
              </select>
              {!C.receiving_warehouse && <div className="miv-desc" style={{marginTop:4}}>Pick a warehouse to enable bin lookup below.</div>}
            </div>

            <table className="miv-g" style={{marginTop:"14px"}}>
              <thead><tr><th>Box</th><th>Material</th><th>Batch</th><th className="num">UOM</th><th className="num">Counted</th><th className="num">Damaged</th><th className="num">To putaway</th><th>Bin</th></tr></thead>
              <tbody>
                {allLines().map(({box, line}) => {
                  if (isBatched(line)) {
                    return line.batches.map(bt => {
                      const acc = Math.max(0, (+bt.counted_qty||0) - (+bt.damaged||0));
                      if (acc <= 0) return null;
                      return <tr key={`${line.id}-${bt.batch_no}`}>
                        <td className="mono">{box.box_no}</td>
                        <td><div className="mono" style={{fontWeight:600}}>{line.item_no}</div><div className="miv-desc">{line.description}</div></td>
                        <td className="mono">{bt.batch_no}</td>
                        <td className="num">{line.uom}</td>
                        <td className="num">{nf(bt.counted_qty)}</td>
                        <td className="num">{bt.damaged > 0 ? <span style={{color:"var(--iron)"}}>{nf(bt.damaged)}</span> : "—"}</td>
                        <td className="num" style={{fontWeight:600}}>{nf(acc)}</td>
                        <td>
                          <BinField warehouseNo={C.receiving_warehouse} value={bt.bin} onChange={(v) => updateC(c => {
                            const bx = c.boxes.find(x => x.box_no === box.box_no);
                            const ln = bx.lines.find(x => x.id === line.id);
                            const batch = ln.batches.find(x => x.batch_no === bt.batch_no);
                            batch.bin = v;
                          })} />
                        </td>
                      </tr>;
                    });
                  } else {
                    const st = lineState(line);
                    if (st.accepted <= 0) return null;
                    return <tr key={line.id}>
                      <td className="mono">{box.box_no}</td>
                      <td><div className="mono" style={{fontWeight:600}}>{line.item_no}</div><div className="miv-desc">{line.description}</div></td>
                      <td className="mono"><span style={{color:"#BFCAC8"}}>not tracked</span></td>
                      <td className="num">{line.uom}</td>
                      <td className="num">{nf(st.counted)}</td>
                      <td className="num">{st.damaged > 0 ? <span style={{color:"var(--iron)"}}>{nf(st.damaged)}</span> : "—"}</td>
                      <td className="num" style={{fontWeight:600}}>{nf(st.accepted)}</td>
                      <td>
                        <BinField warehouseNo={C.receiving_warehouse} value={line.bin} onChange={(v) => updateC(c => {
                          const bx = c.boxes.find(x => x.box_no === box.box_no);
                          const ln = bx.lines.find(x => x.id === line.id);
                          ln.bin = v;
                        })} />
                      </td>
                    </tr>;
                  }
                })}
              </tbody>
            </table>
            
            <div className="miv-foot">
              <button className="miv-pb go big" disabled={!!C.inward} onClick={() => {
                const payload = {
                  decision: "ACCEPT",
                  by: C.decision?.by || "System",
                  reason: C.decision?.reason || "Auto-approved",
                  inwardDetailsJson: JSON.stringify(C)
                };
                
                fetch(`/api/employee/material-inward/${gateEntryId}/verify`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                })
                .then(res => res.json())
                .then(data => {
                  const units = allLines().reduce((a, {line}) => a + lineState(line).accepted, 0);
                  updateC(c => { c.inward = {grn_no: data.grnNumber || ("GRN-" + c.gate_entry_no.replace(/^GE-/,"")), at:now(), units }; });
                  toast("Inward raised — putaway list ready.");
                })
                .catch(err => {
                  console.error("Failed to submit verification", err);
                  toast("Could not reach the server — nothing was recorded. Try again.");
                });
              }}>
                {C.inward ? "Inward raised" : `Start inward`}
              </button>
            </div>
          </div>
        </div>
      )}

      {C.stage === "outcome" && C.decision?.action === "reject" && (
        <div className="miv-card">
          <header><h2>Step 5 — Return to vendor</h2><span className="miv-chip red">Rejected</span></header>
          <div className="miv-card-body">
            <div className="miv-danger"><b>Approval refused</b> by {C.decision.by} — {C.decision.reason}. Hold stands. Nothing enters the warehouse.</div>
            {C.rtv && <div className="miv-warnbox" style={{marginTop:"14px"}}><b>Return raised.</b> {C.rtv.rtv_no} — {C.rtv.boxes} boxes on vehicle {C.rtv.vehicle}.</div>}
            <div className="miv-foot">
              <button className="miv-pb warn big" disabled={!!C.rtv} onClick={() => {
                const payload = {
                  decision: "REJECT",
                  by: C.decision?.by || "System",
                  reason: C.decision?.reason || "Auto-approved",
                  inwardDetailsJson: JSON.stringify(C)
                };

                fetch(`/api/employee/material-inward/${gateEntryId}/verify`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                })
                .then(res => res.json())
                .then(data => {
                  updateC(c => { c.rtv = {rtv_no: data.rtvNumber || ("RTV-" + c.gate_entry_no.replace(/^GE-/,"")), at:now(), boxes:c.boxes.length, vehicle:c.vehicle_no}; });
                  toast("Return to vendor raised.");
                })
                .catch(err => {
                  console.error("Failed to submit rejection", err);
                  toast("Could not reach the server — nothing was recorded. Try again.");
                });
              }}>
                {C.rtv ? "Return raised" : `Raise return — ${C.boxes.length} boxes`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
