import { Fragment, useCallback, useEffect, useState } from "react";

/* ================================================================
 * Self-contained report. Palette, formatters, data hook and table
 * pieces are inlined below so this file drops in anywhere with no
 * local imports. Data comes from the API, never from mock arrays.
 * ================================================================ */

/* ------------------------------------------------------------------ *
 * Palette — carried over from the approved HTML mocks so these four
 * sit alongside the existing 24 reports without a visual break.
 * ------------------------------------------------------------------ */
const C = {
  paper: "#F4F6F6",
  card: "#FFFFFF",
  ink: "#1B2A32",
  inkSoft: "#5B6B72",
  line: "#DEE4E6",
  pine: "#293383",
  pineSoft: "#EEF0FB",
  blue: "#4955B6",
  blueSoft: "#ECEEFA",
  red: "#C81017",
  redSoft: "#FDECEB",
  amber: "#8B4B4D",
  amberSoft: "#FBEEEE",
};

/* ------------------------------------------------------------------ *
 * Formatters
 * ------------------------------------------------------------------ */
const inr = (n) =>
  "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

const qty = (n) =>
  (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const fmtDate = (d) =>
  d
    ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

/* ------------------------------------------------------------------ *
 * Data hook — one fetch per report, re-runs on period / search change.
 * Search is debounced so typing doesn't hammer the API.
 * ------------------------------------------------------------------ */
const API_BASE = import.meta.env.VITE_API_BASE || window.location.protocol + "//" + window.location.hostname + ":8001";

function useReport(path, params) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const key = JSON.stringify(params);

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(API_BASE + path);
      Object.entries(params).forEach(([k, v]) => {
        if (v !== null && v !== undefined && v !== "") url.searchParams.set(k, v);
      });
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`${res.status} — ${await res.text()}`);
      setData(await res.json());
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key]);

  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => load(ctrl.signal), 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [load]);

  return { data, error, loading, reload: () => load() };
}

/* ------------------------------------------------------------------ *
 * Layout pieces
 * ------------------------------------------------------------------ */
function ExportButton({ onClick, label = "Export CSV" }) {
  return (
    <button
      onClick={onClick}
      className="btn btn-sm text-white shadow-sm px-4 fw-bold"
      style={{ backgroundColor: '#293383', borderRadius: '6px', height: '31px' }}
    >
      {label}
    </button>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="flex-grow-1 position-relative text-start mb-4" style={{ minWidth: '250px' }}>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="form-control border-light-subtle bg-white shadow-sm ps-3 text-start"
        style={{ borderRadius: '8px', padding: '10px 16px' }}
      />
    </div>
  );
}

function KpiRow({ items }) {
  return (
    <div className="row g-3 mb-4">
      {items.map((k) => (
        <div key={k.label} className="col">
          <div className="card shadow-sm border-0 h-100" style={{ borderRadius: '12px' }}>
            <div className="card-body p-4 text-center">
              <h3 className="fw-bold mb-1" style={{ color: k.color || '#111827' }}>
                {k.value}
              </h3>
              <p className="text-muted small fw-medium text-uppercase mb-0" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                {k.label}
              </p>
              <div className="mt-1 text-muted" style={{ fontSize: '10px' }}>{k.sub}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StateRow({ colSpan, loading, error, empty, emptyText }) {
  if (loading)
    return (
      <tr>
        <td colSpan={colSpan} className="text-center py-5">
          <div className="spinner-border text-success" role="status"></div>
          <p className="mt-2 text-muted">Loading...</p>
        </td>
      </tr>
    );
  if (error)
    return (
      <tr>
        <td colSpan={colSpan} className="text-center py-5 text-danger">
          <i className="fas fa-exclamation-circle me-2"></i>Could not load this report. {error}
        </td>
      </tr>
    );
  if (empty)
    return (
      <tr>
        <td colSpan={colSpan} className="text-center py-5 text-muted">
          {emptyText}
        </td>
      </tr>
    );
  return null;
}

/* CSV export — quotes every field, so commas in reasons don't break it. */
function downloadCsv(filename, header, rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((r) => r.map(esc).join(","));
  const blob = new Blob([[header.map(esc).join(","), ...body].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/**
 * Material Stock — point-in-time balance, no period filter.
 */
const DOT = {
  "In stock": "#0E7C86", // success
  "Low stock": "#8B4B4D", // warning
  "Out of stock": "#C81017", // danger
};

export default function MaterialStockReport({ bpNo = "BP-MARK-01", onBack }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  const { data, error, loading } = useReport("/api/reports/material-stock", {
    bp_no: bpNo,
    q,
  });

  const rows = data?.rows ?? [];
  const t = data?.totals ?? {};
  const asOn = data?.asOn;

  const kpis = [
    { label: "Line items", value: String(t.lineItems ?? 0), sub: "materials tracked", color: "#111827" },
    { label: "Own stock", value: qty(t.ownTotal), sub: "units · client-owned", color: "#3b82f6" },
    { label: "Consignment stock", value: qty(t.consignTotal), sub: "units · vendor-owned", color: "#111827" },
    { label: "Low stock", value: String(t.lowStock ?? 0), sub: "below reorder level", color: "#8B4B4D" },
    { label: "Out of stock", value: String(t.outOfStock ?? 0), sub: "nil balance", color: "#C81017" },
  ];

  const exportCsv = () =>
    downloadCsv(
      `material-stock-${bpNo}.csv`,
      ["Item", "Item code", "Stock type", "UOM", "Own stock", "Consignment stock",
       "Total stock", "Reorder level", "Status", "Storage location", "Last received", "Last issued"],
      rows.map((r) => [
        r.item, r.itemCode, r.stockType, r.uom, r.own, r.consignment, r.totalStock,
        r.reorder, r.status, r.location, r.lastReceived || "", r.lastIssued || "",
      ])
    );

  return (
    <div className="fade-in-slide container-fluid py-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <div className="d-flex flex-wrap justify-content-between align-items-end mb-4">
        <div>
          <div className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
            Vendor portal · Inventory
          </div>
          <h3 className="fw-bold text-dark mb-1">Material stock</h3>
          {asOn && (
            <p className="text-muted mb-0 small">Stock position as on {fmtDate(asOn)}</p>
          )}
        </div>
        <div className="d-flex flex-wrap gap-3 align-items-end mt-3 mt-md-0">
          {onBack && (
            <div
              onClick={onBack}
              className="d-inline-flex align-items-center justify-content-center text-muted cursor-pointer px-2"
              style={{ cursor: 'pointer', transition: 'color 0.2s ease', height: '31px' }}
            >
              <i className="fas fa-arrow-left me-2"></i>
              <span className="fw-medium">Back</span>
            </div>
          )}
          <ExportButton onClick={exportCsv} />
        </div>
      </div>

      <KpiRow items={kpis} />
      
      <div className="d-flex flex-column flex-md-row gap-3 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Search item name or item code" />
      </div>

      <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-start">
              <thead className="bg-light text-muted text-uppercase fw-bold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                <tr>
                  <th className="py-3 ps-4">Item</th>
                  <th>Stock type</th>
                  <th>UOM</th>
                  <th className="text-end">Own stock</th>
                  <th className="text-end">Consignment stock</th>
                  <th className="text-end">Total stock</th>
                  <th className="text-end">Reorder level</th>
                  <th className="pe-4">Status</th>
                </tr>
              </thead>
              <tbody>
                <StateRow
                  colSpan={8}
                  loading={loading}
                  error={error}
                  empty={!loading && !error && rows.length === 0}
                  emptyText="No materials on file for this vendor yet."
                />

                {!loading && !error && rows.map((r) => {
                  const isOpen = open === r.itemCode;
                  const pct = r.reorder
                    ? Math.min(100, Math.round((r.totalStock / (r.reorder * 2)) * 100))
                    : 100;
                  const tone = DOT[r.status] || "#6b7280";
                  
                  return (
                    <Fragment key={r.itemCode}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : r.itemCode)}
                        className="cursor-pointer align-middle"
                        style={{ backgroundColor: isOpen ? '#f8fafc' : '' }}
                      >
                        <td className="py-3 ps-4">
                          <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>{r.item}</div>
                          <div className="font-monospace text-muted" style={{ fontSize: '11px' }}>{r.itemCode}</div>
                        </td>
                        <td className="text-muted" style={{ fontSize: '12px' }}>{r.stockType || '-'}</td>
                        <td className="text-muted" style={{ fontSize: '12px' }}>{r.uom}</td>
                        <td className="text-end font-monospace" style={{ fontSize: '13px' }}>
                          {r.own ? qty(r.own) : <span className="text-muted">—</span>}
                        </td>
                        <td className="text-end font-monospace" style={{ fontSize: '13px' }}>
                          {r.consignment ? qty(r.consignment) : <span className="text-muted">—</span>}
                        </td>
                        <td className="text-end font-monospace fw-bold text-dark" style={{ fontSize: '13px' }}>
                          {qty(r.totalStock)}
                        </td>
                        <td className="text-end font-monospace text-muted" style={{ fontSize: '13px' }}>{qty(r.reorder)}</td>
                        <td className="pe-4">
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="rounded-circle" style={{ width: '8px', height: '8px', backgroundColor: tone }}></span>
                            <span className="fw-semibold" style={{ color: tone, fontSize: '12px' }}>{r.status}</span>
                          </div>
                          <div className="progress" style={{ height: '4px', width: '100px', backgroundColor: '#e2e8f0' }}>
                            <div className="progress-bar" style={{ width: `${pct}%`, backgroundColor: tone }} />
                          </div>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={8} className="p-0 border-bottom">
                            <div className="bg-light p-4 shadow-inner" style={{ borderTop: '1px solid #e2e8f0' }}>
                              <div className="row g-4 mb-3">
                                <div className="col-md-3">
                                  <Field label="Own stock" value={`${qty(r.own)} ${r.uom}`} note="Billed · client-owned" />
                                </div>
                                <div className="col-md-3">
                                  <Field
                                    label="Consignment stock"
                                    value={`${qty(r.consignment)} ${r.uom}`}
                                    note="Vendor-owned · billed on consumption"
                                  />
                                </div>
                                <div className="col-md-2">
                                  <Field label="Storage location" value={r.location || "—"} />
                                </div>
                                <div className="col-md-2">
                                  <Field label="Last received" value={fmtDate(r.lastReceived)} />
                                </div>
                                <div className="col-md-2">
                                  <Field label="Last issued" value={fmtDate(r.lastIssued)} />
                                </div>
                              </div>
                              <div className="ps-3 mt-2" style={{ borderLeft: '3px solid #cbd5e1', fontSize: '12px' }}>
                                <span className="text-muted">
                                  Reorder level <strong>{qty(r.reorder)} {r.uom}</strong> · status computed on own + consignment.
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>

              {!loading && !error && rows.length > 0 && (
                <tfoot>
                  <tr className="bg-light border-top border-2 border-dark">
                    <td className="py-3 ps-4 fw-bold text-dark">Total</td>
                    <td colSpan={2} />
                    <td className="text-end font-monospace fw-bold">{qty(t.ownTotal)}</td>
                    <td className="text-end font-monospace fw-bold">{qty(t.consignTotal)}</td>
                    <td className="text-end font-monospace fw-bold text-dark">
                      {qty((t.ownTotal || 0) + (t.consignTotal || 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      <p className="mt-3 text-muted text-end" style={{ fontSize: '11px' }}>
        Own stock is billed, client-owned material. Consignment stock remains vendor-owned and is
        billed on consumption. Open a row for storage location and movement dates. Low stock is
        flagged against the total of own + consignment.
      </p>
    </div>
  );
}

function Field({ label, value, note }) {
  return (
    <div>
      <div className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div className="font-monospace fw-medium text-dark" style={{ fontSize: '13px' }}>{value}</div>
      {note && <div className="text-muted mt-1" style={{ fontSize: '11px' }}>{note}</div>}
    </div>
  );
}
