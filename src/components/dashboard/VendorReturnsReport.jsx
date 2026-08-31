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

function PeriodSelect({ value, onChange }) {
  return (
    <select
      aria-label="Reporting period"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="form-select border-light-subtle shadow-sm"
      style={{ width: '150px', borderRadius: '6px', height: '31px', padding: '0 30px 0 10px', fontSize: '13px', fontWeight: '500' }}
    >
      <option value="month">This month</option>
      <option value="quarter">This quarter</option>
      <option value="year">This year</option>
    </select>
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

function LedgerRow({ k, v, strong }) {
  return (
    <div className="d-flex align-items-baseline gap-2 py-1" style={{ fontSize: '12px' }}>
      <span className={strong ? "text-dark fw-bold" : "text-muted"}>{k}</span>
      <span className="flex-grow-1 border-bottom border-secondary border-opacity-25" style={{ borderBottomStyle: 'dotted !important', marginBottom: '4px' }} />
      <span className={`font-monospace ${strong ? "fw-bold text-dark" : "text-muted"}`}>
        {v}
      </span>
    </div>
  );
}

function Pill({ tone, children }) {
  const style = {
    green: { background: "#E3FBFC", color: "#0E7C86" },
    amber: { background: "#FBEEEE", color: "#8B4B4D" },
    blue: { background: "#ECEEFA", color: "#293383" },
    red: { background: "#FDECEB", color: "#C81017" },
  }[tone] || { background: "#f1f5f9", color: "#64748b" };

  return (
    <span
      className="badge rounded-pill fw-medium"
      style={{ ...style, fontSize: '11px', padding: '4px 10px' }}
    >
      {children}
    </span>
  );
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
 * Vendor Returns — quantity only.
 * Value settlement is handled in the credit notes report; where a credit
 * note exists the reference shows in the status and row detail.
 */
const TONE = {
  "Credit note issued": "green",
  "Replacement due": "blue",
  "Under inspection": "amber",
  Closed: "green",
};

export default function VendorReturnsReport({ bpNo = "BP-MARK-01", onBack }) {
  const [period, setPeriod] = useState("year");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  const { data, error, loading } = useReport("/api/reports/vendor-returns", {
    bp_no: bpNo,
    period,
    q,
  });

  const rows = data?.rows ?? [];
  const t = data?.totals ?? {};
  const vendorName = data?.vendor?.name ?? "";

  const kpis = [
    { label: "Return notes", value: String(t.count ?? 0), sub: "line items returned this period", color: "#111827" },
    { label: "Avg return rate", value: `${t.avgReturnRate ?? 0}%`, sub: "of supplied qty, per line", color: "#C81017" },
    { label: "Awaiting closure", value: String(t.openLines ?? 0), sub: "replacement or inspection", color: "#3b82f6" },
    { label: "Credit notes issued", value: String(t.creditNoteLines ?? 0), sub: "settled by value", color: "#0E7C86" },
  ];

  const exportCsv = () =>
    downloadCsv(
      `vendor-returns-${bpNo}-${period}.csv`,
      ["Return note", "Return date", "Item", "Item code", "Reason", "Against invoice",
       "Invoice date", "PO no.", "PO date", "Qty supplied", "Qty returned", "UOM",
       "Return %", "Status", "Credit note ref", "Replacement due"],
      rows.map((r) => [
        r.rtnNo, r.returnDate, r.item, r.itemCode, r.reason, r.invoiceNo, r.invoiceDate,
        r.po, r.poDate, r.qtySupplied, r.qtyReturned, r.uom, r.returnPct,
        r.status, r.cnRef || "", r.replacementDue || "",
      ])
    );

  return (
    <div className="fade-in-slide container-fluid py-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Poppins", sans-serif' }}>
      <div className="d-flex flex-wrap justify-content-between align-items-end mb-4">
        <div>
          <div className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
            Vendor portal · Returns
          </div>
          <h3 className="fw-bold text-dark mb-1">Vendor returns{vendorName ? " — " + vendorName : ""}</h3>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-end mt-3 mt-md-0">
          {onBack && (
            <button
              onClick={onBack}
              className="btn btn-sm btn-light border shadow-sm px-3 fw-bold"
              style={{ borderRadius: '6px', height: '31px' }}
            >
              Back
            </button>
          )}
          <PeriodSelect value={period} onChange={(v) => { setPeriod(v); setOpen(null); }} />
          <ExportButton onClick={exportCsv} />
        </div>
      </div>

      <KpiRow items={kpis} />
      
      <div className="d-flex flex-column flex-md-row gap-3 mb-4">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Search return note, item, invoice no, PO no, or reason"
        />
      </div>

      <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-start">
              <thead className="bg-light text-muted text-uppercase fw-bold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                <tr>
                  <th className="py-3 ps-4">Return note</th>
                  <th>Return date</th>
                  <th>Item</th>
                  <th>Against invoice</th>
                  <th>PO no.</th>
                  <th className="text-end">Qty supplied</th>
                  <th className="text-end">Qty returned</th>
                  <th>Return %</th>
                  <th>Status</th>
                  <th className="pe-4"></th>
                </tr>
              </thead>
              <tbody>
                <StateRow
                  colSpan={10}
                  loading={loading}
                  error={error}
                  empty={!loading && !error && rows.length === 0}
                  emptyText="No returns in this period. Try a wider period or clear the search."
                />

                {!loading && !error && rows.map((r) => {
                  const isOpen = open === r.rtnNo;
                  const rate = Number(r.returnPct) || 0;
                  return (
                    <Fragment key={r.rtnNo}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : r.rtnNo)}
                        className="cursor-pointer align-middle"
                        style={{ backgroundColor: isOpen ? '#f8fafc' : '' }}
                      >
                        <td className="py-3 ps-4 align-top">
                          <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>{r.rtnNo}</div>
                          <div className="text-muted" style={{ fontSize: '11px' }}>{r.reason}</div>
                        </td>
                        <td className="text-muted align-top text-nowrap" style={{ fontSize: '12px', paddingTop: '16px' }}>{fmtDate(r.returnDate)}</td>
                        <td className="align-top" style={{ paddingTop: '16px' }}>
                          <div className="text-dark fw-medium" style={{ fontSize: '13px' }}>{r.item}</div>
                          <div className="text-muted font-monospace" style={{ fontSize: '11px' }}>{r.itemCode}</div>
                        </td>
                        <td className="text-muted align-top text-nowrap" style={{ fontSize: '12px', paddingTop: '16px' }}>{r.invoiceNo || "—"}</td>
                        <td className="text-muted align-top text-nowrap" style={{ fontSize: '12px', paddingTop: '16px' }}>{r.po || "—"}</td>
                        
                        <td className="text-end font-monospace align-top text-dark fw-medium" style={{ fontSize: '13px', paddingTop: '16px' }}>
                          {qty(r.qtySupplied)}
                          <span className="d-block text-muted" style={{ fontSize: '10px' }}>{r.uom}</span>
                        </td>
                        <td className="text-end font-monospace align-top fw-bold" style={{ fontSize: '13px', paddingTop: '16px', color: '#C81017' }}>
                          {qty(r.qtyReturned)}
                          <span className="d-block text-muted fw-normal" style={{ fontSize: '10px' }}>{r.uom}</span>
                        </td>
                        
                        <td className="align-top" style={{ paddingTop: '16px' }}>
                          <span className="font-monospace text-dark fw-medium" style={{ fontSize: '13px' }}>{rate.toFixed(1)}%</span>
                          <div className="progress mt-1" style={{ height: '5px', width: '80px', backgroundColor: '#e2e8f0' }}>
                            <div className="progress-bar" style={{ width: `${Math.min(100, rate)}%`, backgroundColor: '#C81017' }} />
                          </div>
                        </td>
                        
                        <td className="align-top" style={{ paddingTop: '14px' }}>
                          <Pill tone={TONE[r.status] || "amber"}>{r.status}</Pill>
                        </td>
                        <td className="text-center text-muted pe-4 align-top" style={{ paddingTop: '16px' }}>
                          <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={10} className="p-0 border-bottom">
                            <div className="bg-light p-4 shadow-inner" style={{ borderTop: '1px solid #e2e8f0' }}>
                              <div style={{ maxWidth: '460px' }}>
                                <div className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
                                  Return detail
                                </div>
                                <LedgerRow k="Item" v={`${r.item} · ${r.itemCode}`} />
                                <LedgerRow k="Qty supplied" v={`${qty(r.qtySupplied)} ${r.uom || ""}`} />
                                <LedgerRow k="Qty returned" v={`${qty(r.qtyReturned)} ${r.uom || ""}`} strong />
                                <LedgerRow k="Return rate" v={`${rate.toFixed(1)}% of supplied qty`} />
                                <LedgerRow k="Reason" v={r.reason || "—"} />
                                <LedgerRow k="Against invoice" v={`${r.invoiceNo || "—"} (${fmtDate(r.invoiceDate)})`} />
                                <LedgerRow k="PO reference" v={`${r.po || "—"} (${fmtDate(r.poDate)})`} />
                                {r.cnRef ? (
                                  <LedgerRow k="Credit note" v={`${r.cnRef} — see credit notes report`} />
                                ) : (
                                  <LedgerRow k="Replacement due by" v={fmtDate(r.replacementDue)} />
                                )}
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
                    <td colSpan={6} className="py-3 ps-4 fw-bold text-dark">Total ({t.count} return lines)</td>
                    <td className="text-end font-monospace fw-bold" style={{ color: '#C81017' }}>
                      {qty(t.totalQtyReturned)}
                      <span className="d-block text-muted fw-normal" style={{ fontSize: '10px' }}>mixed UOM</span>
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      <p className="mt-3 text-muted text-end" style={{ fontSize: '11px' }}>
        This report tracks returns by quantity only. Values are settled separately through credit
        notes — where one has been issued, the reference appears in the row detail. Totals mix
        units of measure, so read the per-line UOM rather than the column sum.
      </p>
    </div>
  );
}
