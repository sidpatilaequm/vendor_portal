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
  pine: "#0E5F4B",
  pineSoft: "#E4F0EC",
  blue: "#1D4E89",
  blueSoft: "#E3ECF6",
  red: "#8C2B2B",
  redSoft: "#F6E3E3",
  amber: "#8A6510",
  amberSoft: "#F6EED9",
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
      style={{ backgroundColor: '#0f766e', borderRadius: '6px', height: '31px' }}
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
    green: { background: "#d1fae5", color: "#059669" },
    amber: { background: "#fef3c7", color: "#d97706" },
    blue: { background: "#dbeafe", color: "#2563eb" },
    red: { background: "#fee2e2", color: "#dc2626" },
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
 * Credit Notes — value settlement for returned goods.
 * Return amount is the taxable value; GST is reversed alongside it.
 * Total adjustment is set off against payables or a linked invoice.
 */
export default function CreditNotesReport({ bpNo = "BP-MARK-01", onBack }) {
  const [period, setPeriod] = useState("year");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  const { data, error, loading } = useReport("/api/reports/credit-notes", {
    bp_no: bpNo,
    period,
    q,
  });

  const rows = data?.rows ?? [];
  const t = data?.totals ?? {};
  const vendorName = data?.vendor?.name ?? "";

  const kpis = [
    { label: "Return value (before GST)", value: inr(t.base), sub: `${t.count ?? 0} credit notes`, color: "#111827" },
    { label: "GST reversed", value: inr(t.gstReversed), sub: "@ 18% on return value", color: "#3b82f6" },
    { label: "Total adjustment", value: inr(t.totalAdjustment), sub: "Set off against payables", color: "#dc2626" },
    {
      label: "Pending set-off",
      value: inr(t.pendingSetoff),
      sub: `${t.pendingCount ?? 0} awaiting adjustment`,
      color: "#d97706",
    },
  ];

  const exportCsv = () =>
    downloadCsv(
      `credit-notes-${bpNo}-${period}.csv`,
      ["Credit note", "Reason", "Return date", "Against invoice", "Invoice date", "PO no.",
       "PO date", "Return amount", "GST %", "GST reversed", "Total adjustment", "Status", "Set off against"],
      rows.map((r) => [
        r.cnNo, r.reason, r.returnDate, r.invoiceNo, r.invoiceDate, r.po, r.poDate,
        r.base, r.gstPct, r.gstReversed, r.totalAdjustment, r.status, r.adjustedAgainst || "",
      ])
    );

  return (
    <div className="fade-in-slide container-fluid py-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      <div className="d-flex flex-wrap justify-content-between align-items-end mb-4">
        <div>
          <div className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
            Vendor portal · Credit notes
          </div>
          <h3 className="fw-bold text-dark mb-1">Credit notes{vendorName ? " — " + vendorName : ""}</h3>
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
          placeholder="Search credit note, invoice no, PO no, or reason"
        />
      </div>

      <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-start">
              <thead className="bg-light text-muted text-uppercase fw-bold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                <tr>
                  <th className="py-3 ps-4">Credit note</th>
                  <th>Return date</th>
                  <th>Against invoice</th>
                  <th>PO no.</th>
                  <th className="text-end">Return amount</th>
                  <th className="text-end">GST reversed</th>
                  <th className="text-end">Total adjustment</th>
                  <th>Status</th>
                  <th className="pe-4"></th>
                </tr>
              </thead>
              <tbody>
                <StateRow
                  colSpan={9}
                  loading={loading}
                  error={error}
                  empty={!loading && !error && rows.length === 0}
                  emptyText="No credit notes in this period. Try a wider period or clear the search."
                />

                {!loading && !error && rows.map((r) => {
                  const isOpen = open === r.cnNo;
                  return (
                    <Fragment key={r.cnNo}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : r.cnNo)}
                        className="cursor-pointer align-middle"
                        style={{ backgroundColor: isOpen ? '#f8fafc' : '' }}
                      >
                        <td className="py-3 ps-4 align-top">
                          <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>{r.cnNo}</div>
                          <div className="text-muted" style={{ fontSize: '11px' }}>{r.reason}</div>
                        </td>
                        <td className="text-muted align-top text-nowrap" style={{ fontSize: '12px', paddingTop: '16px' }}>{fmtDate(r.returnDate)}</td>
                        <td className="align-top" style={{ paddingTop: '16px' }}>
                          <div className="text-dark fw-medium" style={{ fontSize: '13px' }}>{r.invoiceNo || "—"}</div>
                          <div className="text-muted" style={{ fontSize: '11px' }}>{fmtDate(r.invoiceDate)}</div>
                        </td>
                        <td className="align-top" style={{ paddingTop: '16px' }}>
                          <div className="text-dark fw-medium" style={{ fontSize: '13px' }}>{r.po || "—"}</div>
                          <div className="text-muted" style={{ fontSize: '11px' }}>{fmtDate(r.poDate)}</div>
                        </td>
                        
                        <td className="text-end font-monospace align-top text-dark fw-medium" style={{ fontSize: '13px', paddingTop: '16px' }}>
                          {inr(r.base)}
                        </td>
                        <td className="text-end font-monospace align-top" style={{ fontSize: '13px', paddingTop: '16px' }}>
                          {inr(r.gstReversed)}
                          <span className="d-block text-muted" style={{ fontSize: '10px' }}>@ {r.gstPct}%</span>
                        </td>
                        <td className="text-end font-monospace align-top fw-bold" style={{ fontSize: '13px', paddingTop: '16px', color: '#dc2626' }}>
                          − {inr(r.totalAdjustment)}
                        </td>
                        
                        <td className="align-top" style={{ paddingTop: '14px' }}>
                          <Pill tone={r.status === "Adjusted" ? "green" : "amber"}>{r.status}</Pill>
                        </td>
                        <td className="text-center text-muted pe-4 align-top" style={{ paddingTop: '16px' }}>
                          <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={9} className="p-0 border-bottom">
                            <div className="bg-light p-4 shadow-inner" style={{ borderTop: '1px solid #e2e8f0' }}>
                              <div style={{ maxWidth: '460px' }}>
                                <div className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
                                  Credit note detail
                                </div>
                                <LedgerRow k="Return value (taxable)" v={inr(r.base)} />
                                <LedgerRow k={`GST reversed @ ${r.gstPct}%`} v={"+ " + inr(r.gstReversed)} />
                                <LedgerRow k="Total adjustment" v={"− " + inr(r.totalAdjustment)} strong />
                                <LedgerRow k="Quantity returned" v={r.qty || "—"} />
                                <LedgerRow k="Against invoice" v={`${r.invoiceNo || "—"} (${fmtDate(r.invoiceDate)})`} />
                                <LedgerRow k="PO reference" v={`${r.po || "—"} (${fmtDate(r.poDate)})`} />
                                <LedgerRow k="Set off against" v={r.adjustedAgainst || "Awaiting set-off"} />
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
                    <td colSpan={4} className="py-3 ps-4 fw-bold text-dark">Total ({t.count} credit notes)</td>
                    <td className="text-end font-monospace fw-bold">{inr(t.base)}</td>
                    <td className="text-end font-monospace fw-bold">{inr(t.gstReversed)}</td>
                    <td className="text-end font-monospace fw-bold" style={{ color: '#dc2626' }}>
                      − {inr(t.totalAdjustment)}
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
        Return amount is the taxable value of goods returned, before GST. GST is reversed along
        with the return. Total adjustment = return amount + GST reversed, set off against payables
        or the linked invoice. &ldquo;This year&rdquo; follows the financial year, April to March.
      </p>
    </div>
  );
}
