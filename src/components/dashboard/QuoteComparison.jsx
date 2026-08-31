import React, { useState, useEffect } from 'react';

const formatCurrency = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

const scoreColor = (score, weight) => {
  const pct = weight ? score / weight : 0;
  if (pct >= 0.85) return 'text-success';
  if (pct >= 0.6) return 'text-warning';
  return 'text-danger';
};

const DEFAULT_W = { compliance: 20, cost: 30, quality: 20, terms: 15, delivery: 15 };
const W_LABELS = { compliance: 'Compliance', cost: 'Cost', quality: 'Quality', terms: 'Terms', delivery: 'Delivery' };

export default function QuoteComparison({ onBack, initialPrNumber }) {
  const [employeeId, setEmployeeId] = useState('1'); // fallback
  useEffect(() => {
    try {
      const userStr = localStorage.getItem('user_data');
      if (userStr) setEmployeeId(JSON.parse(userStr).id || '1');
    } catch(e) {}
  }, []);

  const [prId, setPrId] = useState(null);
  const [prNumber, setPrNumber] = useState(initialPrNumber || null);
  const [w, setW] = useState(DEFAULT_W);
  const [appliedW, setAppliedW] = useState(null);
  const [showWeights, setShowWeights] = useState(false);
  const [awarding, setAwarding] = useState(false);
  const [awardResult, setAwardResult] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let url = `/api/employee/quote-comparison?employee_id=${employeeId}`;
    if (prId) url += `&pr_id=${prId}`;
    else if (prNumber) url += `&pr_number=${prNumber}`;
    
    if (appliedW) {
      url += `&weights=${['compliance', 'cost', 'quality', 'terms', 'delivery'].map(k => appliedW[k]).join(',')}`;
    }
    
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(resData => {
        setData(resData);
        if (resData.comparison?.prId) setPrId(resData.comparison.prId);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [employeeId, prId, prNumber, appliedW, refreshKey]);

  const emp = data?.employeeInfo || {};
  const prOptions = data?.prOptions || [];
  const cmp = data?.comparison;
  const maxScore = cmp?.vendors?.length ? Math.max(...cmp.vendors.map(v => v.weightedScore), 1) : 100;
  const wSum = Object.values(w).reduce((a, b) => a + Number(b || 0), 0);

  const awardQuote = async () => {
    if (!cmp?.recommendation) return;
    if (!window.confirm(`Award ${cmp.recommendation.quoteNo} to ${cmp.recommendation.vendorName} and raise a PO?`)) return;
    setAwarding(true);
    setAwardResult(null);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/employee/award-quote`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'X-Employee-Id': String(employeeId),
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ employee_id: String(employeeId), quotation_id: cmp.recommendation.quotationId }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : `HTTP ${res.status}`);
      setAwardResult({ ok: true, msg: body.message });
      setRefreshKey(k => k + 1);
    } catch (e) {
      setAwardResult({ ok: false, msg: e.message });
    } finally {
      setAwarding(false);
    }
  };

  return (
    <div className="container-fluid py-4" style={{ fontFamily: "'Poppins', sans-serif", backgroundColor: '#fafafa', minHeight: '100vh' }}>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div className="d-flex align-items-center gap-3">
          <button className="btn btn-sm btn-light border shadow-sm rounded-circle d-flex align-items-center justify-content-center" onClick={onBack} style={{ width: '36px', height: '36px' }}>
            <i className="fas fa-arrow-left text-muted"></i>
          </button>
          <div>
            <h3 className="mb-1 fw-bold text-dark" style={{ letterSpacing: '-0.5px', fontSize: '24px' }}>Quote Comparison — PR Level</h3>
            <p className="text-muted mb-0 fs-14" style={{ fontSize: '13px' }}>Five-axis weighted scorecard with award recommendation</p>
          </div>
        </div>
        {cmp && (
          <div className="d-flex gap-3 align-items-end">
            <div>
              <label className="form-label text-muted fs-12 mb-1">Purchase Requisition</label>
              <select value={cmp.prId} onChange={e => { setPrId(Number(e.target.value)); setAwardResult(null); }} className="form-select border-light-subtle shadow-sm fs-14 py-2" style={{borderRadius: '8px'}}>
                {prOptions.map(o => <option key={o.prId} value={o.prId}>{o.prNumber} · {o.quoteCount} quotes</option>)}
              </select>
            </div>
            <button onClick={() => setShowWeights(s => !s)} className="btn btn-light text-secondary border shadow-sm px-3" style={{height: '38px', borderRadius: '8px'}}>
              Adjust weights
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="card shadow-sm border-0 mb-4" style={{borderRadius: '8px'}}>
        <div className="card-body p-4">
          <div className="row">
            <div className="col-md-6">
              <p className="text-muted fs-12 fw-semibold text-uppercase mb-1">PR Under Comparison</p>
              <p className="fw-bold fs-5 mb-0 text-dark">{cmp?.prNumber || '-'}</p>
              <p className="text-muted fs-14">{cmp ? `${cmp.itemCodes?.join(', ') || 'no item codes'} · required ${formatDate(cmp.requiredDate)}` : ''}</p>
            </div>
            <div className="col-md-6">
              <p className="text-muted fs-12 fw-semibold text-uppercase mb-1">Quotes</p>
              <p className="fw-bold fs-5 mb-0 text-dark">{cmp ? `${cmp.received} received of ${cmp.invited} invited` : '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {showWeights && (
        <div className="card shadow-sm border-0 mb-4" style={{borderRadius: '8px'}}>
          <div className="card-body p-4 d-flex flex-wrap align-items-end gap-3">
            {Object.keys(DEFAULT_W).map(k => (
              <div key={k}>
                <label className="form-label text-muted fs-12 mb-1">{W_LABELS[k]}</label>
                <input type="number" min="0" max="100" value={w[k]}
                  onChange={e => setW({ ...w, [k]: Number(e.target.value) })}
                  className="form-control form-control-sm" style={{ width: '80px' }} />
              </div>
            ))}
            <div className="ms-2 d-flex align-items-center gap-3">
              <span className={`fw-semibold ${wSum === 100 ? 'text-success' : 'text-danger'}`}>Σ {wSum}%</span>
              <button disabled={wSum !== 100} onClick={() => setAppliedW({ ...w })}
                className={`btn btn-sm ${wSum === 100 ? 'btn-success' : 'btn-secondary'} px-3`} style={{borderRadius: '6px'}}>
                Apply
              </button>
              <button onClick={() => { setW(DEFAULT_W); setAppliedW(null); }} className="btn btn-sm btn-outline-secondary px-3" style={{borderRadius: '6px'}}>
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-success" role="status"></div>
          <p className="mt-2 text-muted">Loading Comparison...</p>
        </div>
      ) : !cmp ? (
        <div className="card shadow-sm border-0 p-5 text-center text-muted" style={{borderRadius: '8px'}}>
          No PRs with quotes yet — comparison appears once vendors submit quotations against your PRs.
        </div>
      ) : cmp.vendors.length === 0 ? (
        <div className="card shadow-sm border-0 p-5 text-center text-muted" style={{borderRadius: '8px'}}>
          {cmp.received === 0 && cmp.invited > 0
            ? `${cmp.invited} vendor(s) invited on ${cmp.prNumber} — no quotes submitted yet.`
            : 'No quotes found for this PR.'}
        </div>
      ) : (
        <>
          {cmp.alreadyAwarded && (
            <div className="alert alert-info border-0 shadow-sm" style={{borderRadius: '8px'}}>
              <i className="fas fa-info-circle me-2"></i> 
              {cmp.alreadyAwarded.quoteNo} ({cmp.alreadyAwarded.vendorName}) is already awarded on this PR.
            </div>
          )}

          <div className="card shadow-sm border-0 mb-4 overflow-hidden" style={{borderRadius: '8px'}}>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-start">
                <thead className="bg-light text-secondary fs-12 fw-semibold text-uppercase" style={{ letterSpacing: '0.5px' }}>
                  <tr>
                    <th className="py-3 ps-4 border-0 rounded-start">Criterion · weight</th>
                    {cmp.vendors.map(v => (
                      <th key={v.quotationId} className="py-3 text-center border-0 text-dark normal-case">
                        <div className="fw-bold fs-14">{v.vendorName}</div>
                        <div className="fw-normal text-muted">{v.quoteNo}</div>
                      </th>
                    ))}
                    <th className="py-3 border-0 rounded-end">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {cmp.criteria.map(c => (
                    <tr key={c.key}>
                      <td className="py-3 ps-4 border-bottom">
                        <span className="fw-semibold text-dark">{c.label}</span>
                        <span className="d-block text-muted fs-12">{c.weight}%</span>
                      </td>
                      {cmp.vendors.map(v => {
                        const s = v.scores[c.key];
                        return (
                          <td key={v.quotationId} className="py-3 text-center border-bottom">
                            <span className={`fs-5 fw-bold ${scoreColor(s.score, c.weight)}`}>{s.score}</span>
                            <span className="d-block text-muted fs-12">{s.detail}</span>
                          </td>
                        );
                      })}
                      <td className="py-3 text-muted fs-12 border-bottom">{c.source}</td>
                    </tr>
                  ))}
                  <tr className="bg-light">
                    <td className="py-3 ps-4 border-bottom">
                      <span className="fw-bold text-dark">Weighted score</span>
                      <span className="d-block text-muted fs-12">out of 100</span>
                    </td>
                    {cmp.vendors.map(v => (
                      <td key={v.quotationId} className="py-3 text-center border-bottom">
                        <span className={`fs-3 fw-bold ${v.rank === 1 && !v.awardBlocked ? 'text-success' : 'text-dark'}`}>{v.weightedScore}</span>
                      </td>
                    ))}
                    <td className="border-bottom"></td>
                  </tr>
                  <tr>
                    <td className="py-3 ps-4 fw-semibold border-0">Rank</td>
                    {cmp.vendors.map(v => (
                      <td key={v.quotationId} className="py-3 text-center border-0">
                        {v.awardBlocked
                          ? <span className="badge bg-danger rounded-pill px-3 py-2">blocked</span>
                          : cmp.recommendation?.quotationId === v.quotationId
                            ? <span className="badge bg-success rounded-pill px-3 py-2">{v.rank} · recommend</span>
                            : <span className="text-muted fw-bold">{v.rank}</span>}
                      </td>
                    ))}
                    <td className="border-0"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="row mb-4">
            <div className="col-md-6">
              <div className="card shadow-sm border-0 h-100" style={{borderRadius: '8px'}}>
                <div className="card-body p-4">
                  <h6 className="text-muted fs-12 fw-semibold text-uppercase mb-4">Score Profile</h6>
                  <div className="d-flex align-items-end justify-content-around h-100 pb-3" style={{ minHeight: '180px' }}>
                    {cmp.vendors.map(v => (
                      <div key={v.quotationId} className="d-flex flex-column align-items-center justify-content-end h-100">
                        <span className="fw-semibold mb-1 fs-14">{v.weightedScore}</span>
                        <div className={`rounded-top ${cmp.recommendation?.quotationId === v.quotationId ? 'bg-success' : v.awardBlocked ? 'bg-danger' : 'bg-primary'}`}
                          style={{ width: '40px', height: `${Math.max(8, (v.weightedScore / maxScore) * 100)}%`, opacity: 0.8 }} />
                        <span className="text-muted fs-12 mt-2 text-center text-truncate" style={{ width: '60px' }} title={v.vendorName}>{v.vendorName.split(' ')[0]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <div className="card shadow-sm border-0 h-100" style={{borderRadius: '8px'}}>
                <div className="card-body p-4">
                  <h6 className="text-muted fs-12 fw-semibold text-uppercase mb-4">Flags from Portal & History</h6>
                  <div className="d-flex flex-column gap-3">
                    {cmp.vendors.flatMap(v => v.flags.map((f, i) => (
                      <div key={`${v.quotationId}-${i}`} className="d-flex gap-2 align-items-start fs-14">
                        <i className={`fas fa-exclamation-triangle mt-1 ${f.includes('blocks') ? 'text-danger' : 'text-warning'}`}></i>
                        <span><span className="fw-bold">{v.vendorName.split(' ')[0]}</span> — {f}</span>
                      </div>
                    )))}
                    {cmp.vendors.every(v => v.flags.length === 0) && <p className="text-muted fs-14">No flags — all quotes clean.</p>}
                    <hr className="my-2" />
                    <div className="d-flex gap-2 text-muted fs-12 pt-1">
                      <i className="fas fa-info-circle mt-1"></i>
                      <span>Quality & delivery scores pulled from GRN + PO delivery history, not vendor claims</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {cmp.recommendation && (
            <div className="alert alert-success border-0 shadow-sm p-4 mb-4" style={{borderRadius: '8px'}}>
              <h6 className="text-success fw-bold text-uppercase fs-12 mb-2">Recommendation · {cmp.recommendation.vendorName}</h6>
              <p className="mb-0 text-dark fs-14">{cmp.recommendation.text} Attach this comparison to the PR before PO conversion.</p>
            </div>
          )}

          {awardResult && (
            <div className={`alert border-0 shadow-sm p-3 mb-4 ${awardResult.ok ? 'alert-success' : 'alert-danger'}`} style={{borderRadius: '8px'}}>
              <i className={`fas ${awardResult.ok ? 'fa-check-circle' : 'fa-times-circle'} me-2`}></i> 
              {awardResult.msg}
            </div>
          )}

          <div className="d-flex mb-5">
            <button onClick={awardQuote}
              disabled={awarding || !cmp.recommendation || !!cmp.alreadyAwarded}
              className={`btn w-100 py-3 fw-bold ${cmp.recommendation && !cmp.alreadyAwarded ? 'btn-success' : 'btn-light text-muted'}`} style={{borderRadius: '8px'}}>
              {awarding ? <><span className="spinner-border spinner-border-sm me-2"></span> Awarding...</>
                : cmp.alreadyAwarded ? 'Already awarded on this PR'
                : cmp.recommendation ? `Award to ${cmp.recommendation.vendorName.split(' ')[0]} & raise PO`
                : 'No eligible vendor to award'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
