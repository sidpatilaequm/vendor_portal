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
 * Paid Invoices — vendor view.
 * Invoice amount is the taxable value; GST @18% is paid in full and
 * TDS @2% (194C) is deducted on the taxable value only, never on GST.
 */
export default function VendorPaymentReport({ bpNo = "BP-MARK-01", onBack }) {
  const [period, setPeriod] = useState("year");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);

  const { data, error, loading } = useReport("/api/reports/vendor-payments", {
    bp_no: bpNo,
    period,
    q,
  });

  const rows = data?.rows ?? [];
  const t = data?.totals ?? {};
  const vendorName = data?.vendor?.name ?? "";

  const kpis = [
    { label: "Invoice amount (before GST)", value: inr(t.base), sub: `${t.count ?? 0} invoices paid`, color: "#111827" },
    { label: "GST paid", value: inr(t.gstAmount), sub: "@ 18% on invoice amount", color: "#3b82f6" },
    { label: "TDS deducted", value: inr(t.tdsAmount), sub: "@ 2% u/s 194C", color: "#C81017" },
    { label: "Net received", value: inr(t.netReceived), sub: "Invoice + GST − TDS", color: "#0E7C86" },
  ];

  const exportCsv = () =>
    downloadCsv(
      `paid-invoices-${bpNo}-${period}.csv`,
      ["Invoice", "Description", "Invoice date", "PO no.", "PO date", "Paid on",
       "Invoice amount", "GST %", "GST amount", "TDS %", "TDS deducted", "Net received", "UTR"],
      rows.map((r) => [
        r.invoiceNo, r.desc, r.date, r.po, r.poDate, r.paidDate,
        r.base, r.gstPct, r.gstAmount, r.tdsPct, r.tdsAmount, r.netReceived, r.utr,
      ])
    );

  return (
    <div className="fade-in-slide container-fluid py-4" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: '"Poppins", sans-serif' }}>
      <div className="d-flex flex-wrap justify-content-between align-items-end mb-4">
        <div>
          <div className="text-muted text-uppercase fw-bold mb-1" style={{ fontSize: '11px', letterSpacing: '0.1em' }}>
            Vendor portal · Payments
          </div>
          <h3 className="fw-bold text-dark mb-1">Paid invoices{vendorName ? " — " + vendorName : ""}</h3>
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
          placeholder="Search invoice no, PO no, description, or UTR"
        />
      </div>

      <div className="card border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 text-start">
              <thead className="bg-light text-muted text-uppercase fw-bold" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
                <tr>
                  <th className="py-3 ps-4">Invoice</th>
                  <th>Invoice date</th>
                  <th>PO no.</th>
                  <th>PO date</th>
                  <th>Paid on</th>
                  <th className="text-end">Invoice amount</th>
                  <th className="text-end">GST amount</th>
                  <th className="text-end">TDS deducted</th>
                  <th className="text-end">Net received</th>
                  <th className="pe-4"></th>
                </tr>
              </thead>
              <tbody>
                <StateRow
                  colSpan={10}
                  loading={loading}
                  error={error}
                  empty={!loading && !error && rows.length === 0}
                  emptyText="No paid invoices in this period. Try a wider period or clear the search."
                />

                {!loading && !error && rows.map((r) => {
                  const isOpen = open === r.invoiceNo;
                  return (
                    <Fragment key={r.invoiceNo}>
                      <tr
                        onClick={() => setOpen(isOpen ? null : r.invoiceNo)}
                        className="cursor-pointer align-middle"
                        style={{ backgroundColor: isOpen ? '#f8fafc' : '' }}
                      >
                        <td className="py-3 ps-4 align-top">
                          <div className="fw-bold text-dark" style={{ fontSize: '14px' }}>{r.invoiceNo}</div>
                          <div className="text-muted" style={{ fontSize: '11px' }}>{r.desc}</div>
                        </td>
                        <td className="text-muted align-top text-nowrap" style={{ fontSize: '12px', paddingTop: '16px' }}>{fmtDate(r.date)}</td>
                        <td className="text-muted align-top text-nowrap" style={{ fontSize: '12px', paddingTop: '16px' }}>{r.po || "—"}</td>
                        <td className="text-muted align-top text-nowrap" style={{ fontSize: '12px', paddingTop: '16px' }}>{fmtDate(r.poDate)}</td>
                        <td className="text-muted align-top text-nowrap" style={{ fontSize: '12px', paddingTop: '16px' }}>{fmtDate(r.paidDate)}</td>
                        <td className="text-end font-monospace align-top text-dark fw-medium" style={{ fontSize: '13px', paddingTop: '16px' }}>
                          {inr(r.base)}
                        </td>
                        <td className="text-end font-monospace align-top" style={{ fontSize: '13px', paddingTop: '16px' }}>
                          {inr(r.gstAmount)}
                          <span className="d-block text-muted" style={{ fontSize: '10px' }}>@ {r.gstPct}%</span>
                        </td>
                        <td className="text-end font-monospace align-top" style={{ fontSize: '13px', paddingTop: '16px' }}>
                          − {inr(r.tdsAmount)}
                          <span className="d-block text-muted" style={{ fontSize: '10px' }}>@ {r.tdsPct}%</span>
                        </td>
                        <td className="text-end font-monospace fw-bold align-top" style={{ fontSize: '13px', paddingTop: '16px', color: '#0E7C86' }}>
                          {inr(r.netReceived)}
                        </td>
                        <td className="text-center text-muted pe-4 align-top" style={{ paddingTop: '16px' }}>
                          <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
                        </td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={10} className="p-0 border-bottom">
                            <div className="bg-light p-4 shadow-inner" style={{ borderTop: '1px solid #e2e8f0' }}>
                              <div style={{ maxWidth: '440px' }}>
                                <div className="text-muted text-uppercase fw-bold mb-2" style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
                                  Remittance detail
                                </div>
                                <LedgerRow k="Invoice amount (taxable value)" v={inr(r.base)} />
                                <LedgerRow k={`GST @ ${r.gstPct}%`} v={"+ " + inr(r.gstAmount)} />
                                <LedgerRow k={`TDS @ ${r.tdsPct}% (194C, on taxable value)`} v={"− " + inr(r.tdsAmount)} />
                                <LedgerRow k="Net received" v={inr(r.netReceived)} strong />
                                <LedgerRow k="PO reference" v={`${r.po || "—"} (${fmtDate(r.poDate)})`} />
                                <LedgerRow k="Credited to" v={r.bank || "—"} />
                                <LedgerRow k="UTR reference" v={r.utr || "—"} />
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
                    <td colSpan={5} className="py-3 ps-4 fw-bold text-dark">Total ({t.count} invoices)</td>
                    <td className="text-end font-monospace fw-bold">{inr(t.base)}</td>
                    <td className="text-end font-monospace fw-bold">{inr(t.gstAmount)}</td>
                    <td className="text-end font-monospace fw-bold">− {inr(t.tdsAmount)}</td>
                    <td className="text-end font-monospace fw-bold" style={{ color: '#0E7C86' }}>{inr(t.netReceived)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      <p className="mt-3 text-muted text-end" style={{ fontSize: '11px' }}>
        Invoice amount is the taxable value before GST. GST is paid in full; TDS u/s 194C is
        deducted on the taxable value only. Net received = invoice + GST − TDS.
        &ldquo;This year&rdquo; follows the financial year, April to March.
      </p>
    </div>
  );
}
