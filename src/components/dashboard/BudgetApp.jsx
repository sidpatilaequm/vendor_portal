/**
 * BudgetApp.jsx — v2.0: Full parity with Budget_App_v4.html
 * Adapted for Aequm Vendor Portal Theme (Emerald / Inter)
 * Powered by persistent localStorage state for 100% reliability and interactivity
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import axios from "axios";

const FY = "FY 2026-27";
const MONTHS = ["Apr-26", "May-26", "Jun-26", "Jul-26", "Aug-26", "Sep-26", "Oct-26", "Nov-26", "Dec-26", "Jan-27", "Feb-27", "Mar-27"];
const CUR_PERIOD = 3; // index of current period (Jul-26 = 3, matching period_no-1 = 3)

const fmt = n => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n || 0);
const fmtN = n => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n || 0);
const fmtK = n => {
  const v = Math.abs(n || 0);
  return (n < 0 ? "-" : "") + (v >= 1e7 ? "₹" + (v / 1e7).toFixed(1) + "Cr" : v >= 1e5 ? "₹" + (v / 1e5).toFixed(1) + "L" : "₹" + fmtN(v));
};
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const today = () => new Date().toISOString().slice(0, 10);
const sum12 = arr => (Array.isArray(arr) ? arr : Object.values(arr || {})).reduce((a, b) => a + b, 0);

// Extract per-metric 12-month array from phases (array or object)
function getPhaseArr(phases, metric) {
  const arr = Array.isArray(phases) ? phases : Object.values(phases || {});
  return Array.from({ length: 12 }, (_, i) => {
    const p = arr.find(x => x.period_no === i + 1);
    return p ? (p[metric] ?? 0) : 0;
  });
}

// Ribbon chart (monthly alloc vs cons bars)
function Ribbon({ alloc, cons, big = false }) {
  const max = Math.max(...(alloc || []).map(Math.abs), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: big ? 3 : 1, height: big ? 120 : 44, padding: big ? "6px 0" : "2px 0" }}>
      {MONTHS.map((mm, m) => {
        const a = (alloc || [])[m] || 0;
        const c = (cons || [])[m] || 0;
        const over = c > a;
        const fill = a > 0 ? Math.min(c / a, 1) : 0;
        const closed = m < CUR_PERIOD;
        const isCur = m === CUR_PERIOD;
        const unutil = closed && a - c > 0.5;
        const barH = big ? (16 + 96 * (a / max)) : (6 + 36 * (a / max));
        const fillBg = over ? "#dc2626" : unutil ? "#d97706" : "#059669";
        const emptyBg = isCur ? "#a7f3d0" : "#f3f4f6";
        const title = `${mm} · alloc ${fmtK(a)} · cons ${fmtK(c)}` + (unutil ? ` · unutilised ${fmtK(a - c)} (lapsing)` : over ? ` · over by ${fmtK(c - a)}` : "");
        return (
          <div key={m} title={title}
            style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "stretch",
              height: barH, borderRadius: 2, overflow: "hidden",
              background: emptyBg,
              outline: isCur ? "2px solid #10b981" : "none",
              outlineOffset: isCur ? "-1px" : 0
            }}>
            <div style={{ marginTop: "auto", height: `${Math.min(fill, 1) * 100}%`, background: fillBg, transition: "height .3s" }} />
          </div>
        );
      })}
    </div>
  );
}

function RibbonLegend() {
  const items = [
    { color: "#059669", label: "Consumed" },
    { color: "#f3f4f6", label: "Allocated (remaining)", border: "1px solid #e5e7eb" },
    { color: "#d97706", label: "Unutilised in a closed month — lapsing" },
    { color: "#dc2626", label: "Over-utilised" },
    { color: "#fff", label: `Current period (${MONTHS[CUR_PERIOD]})`, outline: "2px solid #10b981" },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 20px", marginTop: 10, fontSize: 11.5, color: "#6b7280" }}>
      {items.map(({ color, label, border, outline }) => (
        <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <i style={{ width: 12, height: 12, borderRadius: 2, background: color, border: border, outline: outline, display: "inline-block", flexShrink: 0 }} />
          {label}
        </span>
      ))}
    </div>
  );
}

// Change-request types
const CR_TYPES = {
  months: { icon: "fas fa-exchange-alt", title: "Move budget between months", blurb: "Reallocate planned budget from one month to another within the same activity." },
  carry: { icon: "fas fa-angle-double-right", title: "Carry forward unutilised", blurb: "Bring a closed month's unspent budget into a later month before it lapses." },
  pull: { icon: "fas fa-angle-double-left", title: "Pull from a future month", blurb: "When a month needs more, draw planned budget from a later month of the same activity." },
  transfer: { icon: "fas fa-sync-alt", title: "Transfer between activities", blurb: "Move a month's budget from one activity to another." },
};

// Default seed data generation
const generateMockPhases = (totalAlloc, totalCons, prVal, poVal) => {
  return Array.from({ length: 12 }, (_, i) => {
    const alloc = Math.round(totalAlloc / 12);
    let cons = 0;
    if (i < CUR_PERIOD) {
      cons = Math.round(totalCons / CUR_PERIOD);
    } else if (i === CUR_PERIOD) {
      cons = Math.round(totalCons * 0.1);
    }

    let pr = 0;
    let po = 0;
    if (i >= CUR_PERIOD) {
      pr = Math.round(prVal / (12 - CUR_PERIOD));
      po = Math.round(poVal / (12 - CUR_PERIOD));
    } else {
      pr = Math.round(prVal * 0.05);
      po = Math.round(poVal * 0.05);
    }

    return {
      period_no: i + 1,
      alloc,
      pr,
      po,
      cons
    };
  });
};

const defaultEmployees = [
  { employee_code: "EMP-001", name: "Rohan Sharma", title: "Lead Cloud Architect", dept_code: "DPT-RD", manager_code: "EMP-005" },
  { employee_code: "EMP-002", name: "Priya Nair", title: "Senior Database Engineer", dept_code: "DPT-RD", manager_code: "EMP-005" },
  { employee_code: "EMP-003", name: "Amit Das", title: "Growth Marketing Lead", dept_code: "DPT-MK", manager_code: "EMP-006" },
  { employee_code: "EMP-004", name: "Karan Johar", title: "Logistics Manager", dept_code: "DPT-OP", manager_code: "EMP-007" },
  { employee_code: "EMP-005", name: "Siddarth Patil", title: "VP of Engineering", dept_code: "DPT-RD", manager_code: null },
  { employee_code: "EMP-006", name: "Alok Jayant", title: "VP of Marketing", dept_code: "DPT-MK", manager_code: null },
  { employee_code: "EMP-007", name: "Daman Arora", title: "VP of Operations", dept_code: "DPT-OP", manager_code: null }
];

const defaultDepartments = [
  { id: 1, dept_code: "DPT-RD", name: "Research & Development", wbs: "1.1", approved_budget: 150000000, projects_count: 2, activities_count: 2 },
  { id: 2, dept_code: "DPT-MK", name: "Marketing & Growth", wbs: "1.2", approved_budget: 80000000, projects_count: 1, activities_count: 1 },
  { id: 3, dept_code: "DPT-OP", name: "Operations", wbs: "1.3", approved_budget: 120000000, projects_count: 1, activities_count: 1 }
];

const defaultProjects = [
  { id: 1, project_code: "PRJ-MIG", dept_code: "DPT-RD", name: "Platform Migration 2027", wbs: "1.1.1" },
  { id: 2, project_code: "PRJ-API", dept_code: "DPT-RD", name: "Core API Scaling", wbs: "1.1.2" },
  { id: 3, project_code: "PRJ-MKT", dept_code: "DPT-MK", name: "Global Branding Campaign", wbs: "1.2.1" },
  { id: 4, project_code: "PRJ-OPS", dept_code: "DPT-OP", name: "Supply Chain Optimization", wbs: "1.3.1" }
];

const defaultActivities = [
  {
    activity_code: "ACT-INF",
    project_code: "PRJ-MIG",
    name: "Cloud Infrastructure & Hosting",
    wbs: "1.1.1.1",
    employee_code: "EMP-001",
    cost_type_tag: "Capex",
    cost_type_code: "Capex",
    status_name: "In Progress",
    status_code: "In Progress",
    approved: 80000000,
    allocated: 80000000,
    pr: 12000000,
    po: 35000000,
    invoiced: 25000000,
    phases: generateMockPhases(80000000, 25000000, 12000000, 35000000),
    sub_activities: [
      {
        subactivity_code: "SUB-AWS",
        name: "AWS Instance Hosting",
        wbs: "1.1.1.1.1",
        level: 1,
        cost_type_tag: "Capex",
        employee_name: "Rohan Sharma",
        employee_code: "EMP-001",
        allocated: 50000000,
        pr: 8000000,
        po: 25000000,
        invoiced: 18000000,
        phases: generateMockPhases(50000000, 18000000, 8000000, 25000000)
      },
      {
        subactivity_code: "SUB-CDN",
        name: "Cloudflare CDN & Security",
        wbs: "1.1.1.1.2",
        level: 1,
        cost_type_tag: "Capex",
        employee_name: "Rohan Sharma",
        employee_code: "EMP-001",
        allocated: 30000000,
        pr: 4000000,
        po: 10000000,
        invoiced: 7000000,
        phases: generateMockPhases(30000000, 7000000, 4000000, 10000000)
      }
    ]
  },
  {
    activity_code: "ACT-DB",
    project_code: "PRJ-MIG",
    name: "Database Sharding & Scaling",
    wbs: "1.1.1.2",
    employee_code: "EMP-002",
    cost_type_tag: "Capex",
    cost_type_code: "Capex",
    status_name: "In Progress",
    status_code: "In Progress",
    approved: 40000000,
    allocated: 40000000,
    pr: 8000000,
    po: 15000000,
    invoiced: 10000000,
    phases: generateMockPhases(40000000, 10000000, 8000000, 15000000),
    sub_activities: []
  },
  {
    activity_code: "ACT-AD",
    project_code: "PRJ-MKT",
    name: "Digital Ads & PPC Campaign",
    wbs: "1.2.1.1",
    employee_code: "EMP-003",
    cost_type_tag: "Opex",
    cost_type_code: "Opex",
    status_name: "In Progress",
    status_code: "In Progress",
    approved: 50000000,
    allocated: 50000000,
    pr: 10000000,
    po: 20000000,
    invoiced: 15000000,
    phases: generateMockPhases(50000000, 15000000, 10000000, 20000000),
    sub_activities: []
  },
  {
    activity_code: "ACT-LOG",
    project_code: "PRJ-OPS",
    name: "Last-Mile Delivery Logistics",
    wbs: "1.3.1.1",
    employee_code: "EMP-004",
    cost_type_tag: "Opex",
    cost_type_code: "Opex",
    status_name: "In Progress",
    status_code: "In Progress",
    approved: 70000000,
    allocated: 70000000,
    pr: 15000000,
    po: 30000000,
    invoiced: 20000000,
    phases: generateMockPhases(70000000, 20000000, 15000000, 30000000),
    sub_activities: []
  }
];

const defaultChangeRequests = [
  {
    id: "CR-001",
    request_type: "carry",
    status: "Pending",
    a_code: "ACT-INF",
    a_name: "Cloud Infrastructure & Hosting",
    b_code: null,
    b_name: null,
    period_from: 2, // May (index 1)
    period_to: 4,   // July (index 3)
    amount: 500000,
    reason: "Carry forward unused May budget to July for server load spikes",
    created_at: "2026-06-28T10:00:00Z"
  },
  {
    id: "CR-002",
    request_type: "transfer",
    status: "Approved",
    a_code: "ACT-DB",
    a_name: "Database Sharding & Scaling",
    b_code: "ACT-INF",
    b_name: "Cloud Infrastructure & Hosting",
    period_from: 3, // June (index 2)
    period_to: 3,   // June (index 2)
    amount: 150000,
    reason: "Database optimization saved cash, transfer to cloud storage",
    created_at: "2026-06-25T11:00:00Z"
  }
];

const defaultVersions = [
  { version_code: "BV-001", name: "Board Approved Annual Budget FY 2026-27", basis: "Board approval", fiscal_year: FY, created_date: "2026-04-01", is_current: 1, is_locked: 0 },
  { version_code: "BV-002", name: "Q1 Revised Budget FY 2026-27", basis: "Q1 performance review", fiscal_year: FY, created_date: "2026-06-30", is_current: 0, is_locked: 1 }
];

export default function BudgetApp() {
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [drawer, setDrawer] = useState(null); // activity_code of open line drawer
  const [crModal, setCrModal] = useState(null); // { type, form } change-request modal

  // Backend based states
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activities, setActivities] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [budgetVersions, setBudgetVersions] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [statuses, setStatuses] = useState([]);

  const costTypes = [{ cost_type_code: "Capex", tag: "Capex" }, { cost_type_code: "Opex", tag: "Opex" }];
  const fiscalYears = ["FY 2025-26", "FY 2026-27", "FY 2027-28"];

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3200);
  };

  const fetchData = async () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    const adminEmail = localStorage.getItem('user_email') || localStorage.getItem('email') || "siddarthpatil17@gmail.com";
    const headers = { 'Authorization': `Bearer ${token}` };
    try {
      const [empRes, deptRes, projRes, actRes, crRes, verRes, uplRes, stsRes] = await Promise.all([
        axios.get(`/api/budget/employees?admin_email=${encodeURIComponent(adminEmail)}`, { headers }),
        axios.get("/api/budget/departments", { headers }),
        axios.get("/api/budget/projects", { headers }),
        axios.get("/api/budget/activities", { headers }),
        axios.get("/api/budget/change-requests", { headers }),
        axios.get("/api/budget/budget-versions", { headers }),
        axios.get("/api/budget/budget-uploads", { headers }),
        axios.get("/api/budget/statuses", { headers })
      ]);
      setEmployees(empRes.data || []);
      setDepartments(deptRes.data || []);
      setProjects(projRes.data || []);
      setActivities(actRes.data || []);
      setChangeRequests(crRes.data || []);
      setBudgetVersions(verRes.data || []);
      setUploads(uplRes.data || []);
      setStatuses(stsRes.data || []);
    } catch (err) {
      console.error("Error loading budget data:", err);
      showToast("Failed to load budget data from API", false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const curBudget = budgetVersions.find(b => b.is_current) || budgetVersions[0];
  const pendingCount = changeRequests.filter(r => r.status === "Pending").length;

  const openCR = (type, actCode) => {
    const act = activities.find(a => a.activity_code === actCode) || activities[0];
    const b0 = activities.find(a => a.activity_code !== act?.activity_code);
    let form = {
      type,
      aCode: act?.activity_code || "",
      bCode: b0?.activity_code || "",
      mFrom: CUR_PERIOD,
      mTo: CUR_PERIOD + 1,
      amount: "",
      reason: "",
    };
    if (type === "months") { form.mFrom = CUR_PERIOD + 1; form.mTo = CUR_PERIOD; }
    if (type === "carry") { form.mFrom = Math.max(CUR_PERIOD - 1, 0); form.mTo = CUR_PERIOD; }
    if (type === "pull") { form.mFrom = Math.min(CUR_PERIOD + 1, 11); form.mTo = CUR_PERIOD; }
    if (type === "transfer") { form.mFrom = CUR_PERIOD; form.mTo = CUR_PERIOD; }
    setCrModal({ type, form });
    setDrawer(null);
  };

  // Approving or rejecting changes via API
  const decide = (id, approve) => {
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    axios.patch(`/api/budget/change-requests/${id}/decide`, { approve, decided_by: "EMP-001" }, { headers })
      .then(res => {
        fetchData();
        showToast(approve ? "Change request approved!" : "Change request rejected.", approve);
      })
      .catch(err => {
        showToast(err.response?.data?.detail || "Action failed", false);
      });
  };

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "fas fa-chart-pie" },
    // { id: "budgetbook", label: "Budget Book", icon: "fas fa-book-open" },
    // { id: "requests", label: "Change Requests", icon: "fas fa-exchange-alt", badge: pendingCount },
    // { id: "approvals", label: "Approvals", icon: "fas fa-check-double", badge: pendingCount },
    // { id: "budgets", label: "Budget Versions", icon: "fas fa-code-branch" },
    // { id: "hierarchy", label: "WBS Hierarchy", icon: "fas fa-sitemap" },
    // { id: "lines", label: "Budget Lines", icon: "fas fa-list-ul" },
    { id: "upload", label: "Excel Upload", icon: "fas fa-file-upload" },
    { id: "employees", label: "Employees", icon: "fas fa-users" },
  ];

  const ctx = {
    departments, setDepartments,
    projects, setProjects,
    employees, setEmployees,
    costTypes, statuses,
    budgetVersions, setBudgetVersions,
    fiscalYears,
    activities, setActivities,
    changeRequests, setChangeRequests,
    uploads, setUploads,
    curBudget,
    decide,
    showToast, fmt, fmtN, pct,
    drawer, setDrawer, openCR, crModal, setCrModal,
    fetchData,
  };

  if (loading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: "400px", fontFamily: '"Inter", sans-serif' }}>
        <div className="spinner-border text-success" role="status" style={{ width: "3rem", height: "3rem" }}>
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading budget governance data...</p>
      </div>
    );
  }

  return (
    <div className="fade-in-slide container-fluid py-4" style={{ fontFamily: '"Inter", sans-serif' }}>
      {/* Upper header */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h4 className="fw-bold text-uppercase mb-1" style={{ color: "#064e3b" }}>Budget Management</h4>
          <p className="text-muted mb-0 small">Governed capital & operating expenditure WBS control panel</p>
        </div>
        <div className="d-flex gap-2">
          <span className="badge px-3 py-2 text-uppercase d-flex align-items-center" style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", color: "#064e3b", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
            <i className="fas fa-calendar-alt me-1.5"></i> {curBudget?.fiscal_year ?? FY}
          </span>
          <span className={`badge px-3 py-2 text-uppercase d-flex align-items-center ${curBudget?.is_locked ? "bg-warning-subtle text-warning-emphasis" : "bg-success-subtle text-success-emphasis"}`}>
            <i className={`fas ${curBudget?.is_locked ? "fa-lock" : "fa-unlock"} me-1.5`}></i> {curBudget?.is_locked ? "Locked" : "Active"}
          </span>
          {pendingCount > 0 && (
            <span className="badge bg-danger-subtle text-danger-emphasis px-3 py-2 text-uppercase d-flex align-items-center">
              <i className="fas fa-exclamation-circle me-1.5"></i> {pendingCount} Pending
            </span>
          )}
        </div>
      </div>

      {/* Sub navigation tabs */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-white p-2 border-bottom">
          <div className="nav nav-pills flex-nowrap overflow-x-auto gap-1">
            {nav.map(n => (
              <button
                key={n.id}
                onClick={() => { setPage(n.id); setDrawer(null); }}
                className={`nav-link text-nowrap d-flex align-items-center gap-2 border-0 py-2 px-3 rounded-3 transition-all ${
                  page === n.id ? "active-tab-style" : "text-secondary hover-tab-style"
                }`}
                style={{ fontSize: "13.5px", fontWeight: "500" }}
              >
                <i className={`${n.icon} ${page === n.id ? "" : "text-muted"}`} style={{ fontSize: "14px" }}></i>
                {n.label}
                {n.badge > 0 && (
                  <span className="badge rounded-circle bg-danger text-white px-1.5 py-0.5" style={{ fontSize: "10px", marginLeft: "2px" }}>
                    {n.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body p-4 bg-light bg-opacity-10">
          {page === "dashboard" && <DashboardPage ctx={ctx} />}
          {page === "budgetbook" && <BudgetBookPage ctx={ctx} />}
          {page === "requests" && <RequestsPage ctx={ctx} />}
          {page === "approvals" && <ApprovalsPage ctx={ctx} />}
          {page === "budgets" && <BudgetsPage ctx={ctx} />}
          {page === "hierarchy" && <HierarchyPage ctx={ctx} />}
          {page === "lines" && <LinesPage ctx={ctx} />}
          {page === "upload" && <UploadPage ctx={ctx} />}
          {page === "employees" && <EmployeesPage ctx={ctx} />}
        </div>
      </div>

      {/* Line drawer */}
      {drawer && <LineDrawer ctx={ctx} />}

      {/* Change-request modal */}
      {crModal && <CRModal ctx={ctx} />}

      {toast && (
        <div className="toast-container position-fixed bottom-0 end-0 p-3" style={{ zIndex: 1100 }}>
          <div className={`toast show align-items-center text-white bg-${toast.ok ? "success" : "danger"} border-0 shadow-lg`} role="alert" aria-live="assertive" aria-atomic="true" style={{ borderRadius: "12px" }}>
            <div className="d-flex">
              <div className="toast-body fw-medium py-3 px-4">
                <i className={`fas ${toast.ok ? "fa-check-circle" : "fa-exclamation-triangle"} me-2`}></i>
                {toast.msg}
              </div>
              <button type="button" className="btn-close btn-close-white me-2 m-auto" onClick={() => setToast(null)}></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────────────────────
function DashboardPage({ ctx }) {
  const { fmt, pct, activities, openCR } = ctx;

  const totals = useMemo(() => {
    let allocated = 0;
    let invoiced = 0;
    let pr = 0;
    let po = 0;
    let remaining = 0;
    let opex_total = 0;
    let capex_total = 0;

    activities.forEach(a => {
      allocated += a.allocated;
      invoiced += a.invoiced;
      pr += a.pr;
      po += a.po;
      remaining += (a.allocated - a.invoiced);
      if (a.cost_type_code === "Capex") capex_total += a.allocated;
      else opex_total += a.allocated;
    });

    return { allocated, invoiced, pr, po, remaining, opex_total, capex_total };
  }, [activities]);

  const invoicedPct = pct(totals.invoiced, totals.allocated);
  const prPct = pct(totals.pr, totals.allocated);
  const poPct = pct(totals.po, totals.allocated);

  // Org-level ribbon
  const orgAlloc = useMemo(() => {
    const t = Array(12).fill(0);
    activities.forEach(a => {
      getPhaseArr(a.phases, "alloc").forEach((v, i) => { t[i] += v; });
    });
    return t;
  }, [activities]);

  const orgCons = useMemo(() => {
    const t = Array(12).fill(0);
    activities.forEach(a => {
      getPhaseArr(a.phases, "cons").forEach((v, i) => { t[i] += v; });
    });
    return t;
  }, [activities]);

  // Lapsing rows
  const lapseRows = useMemo(() => {
    const rows = [];
    activities.forEach(a => {
      const alloc = getPhaseArr(a.phases, "alloc");
      const cons = getPhaseArr(a.phases, "cons");
      for (let m = 0; m < CUR_PERIOD; m++) {
        const u = alloc[m] - cons[m];
        if (u > 500) {
          rows.push({ a, m, u, alloc: alloc[m], cons: cons[m] });
        }
      }
    });
    return rows.sort((x, y) => y.u - x.u);
  }, [activities]);

  const lapseTotal = lapseRows.reduce((acc, r) => acc + r.u, 0);

  // Dept summary calculations
  const deptSummaries = useMemo(() => {
    return ctx.departments.map(dept => {
      const dProjects = ctx.projects.filter(p => p.dept_code === dept.dept_code);
      const dActs = activities.filter(a => dProjects.some(p => p.project_code === a.project_code));

      let allocated = 0;
      let pr = 0;
      let po = 0;
      let invoiced = 0;

      dActs.forEach(a => {
        allocated += a.allocated;
        pr += a.pr;
        po += a.po;
        invoiced += a.invoiced;
      });

      return {
        dept_code: dept.dept_code,
        dept_name: dept.name,
        allocated,
        pr,
        po,
        invoiced,
        remaining: allocated - invoiced
      };
    });
  }, [ctx.departments, ctx.projects, activities]);

  const KPI = ({ label, value, sub, colorClass = "text-dark", icon = "fa-dollar-sign" }) => (
    <div className="card border-0 shadow-sm rounded-4 h-100">
      <div className="card-body p-4 d-flex align-items-center">
        <div className="flex-grow-1">
          <div className="text-uppercase text-muted fw-bold mb-1" style={{ fontSize: "11px", letterSpacing: "0.5px" }}>{label}</div>
          <h3 className={`fw-bold mb-1 ${colorClass}`} style={{ fontSize: "22px" }}>{value}</h3>
          {sub && <div className="text-muted small fs-12">{sub}</div>}
        </div>
        <div className="rounded-circle d-flex align-items-center justify-content-center bg-light text-secondary" style={{ width: "48px", height: "48px" }}>
          <i className={`fas ${icon} fs-5`}></i>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* KPI Tiles */}
      <div className="row g-4 mb-4">
        <div className="col-lg-4 col-md-6 col-sm-12">
          <KPI label="Total Budget" value={fmt(totals.allocated)} sub="Allocated FY 2026-27" icon="fa-wallet" />
        </div>
        <div className="col-lg-4 col-md-6 col-sm-12">
          <KPI label="Consumed / Invoiced" value={fmt(totals.invoiced)} sub={`${invoicedPct}% of budget`} colorClass="text-success" icon="fa-check-circle" />
        </div>
        <div className="col-lg-4 col-md-6 col-sm-12">
          <KPI label="Remaining" value={fmt(totals.remaining)} sub="Budget available for spend" colorClass={totals.remaining < 0 ? "text-danger" : "text-primary"} icon="fa-hand-holding-usd" />
        </div>
        <div className="col-lg-4 col-md-6 col-sm-12">
          <KPI label="PR Committed" value={fmt(totals.pr)} sub={`${prPct}% of budget`} colorClass="text-info" icon="fa-file-invoice" />
        </div>
        <div className="col-lg-4 col-md-6 col-sm-12">
          <KPI label="Lapse Risk" value={fmtK(lapseTotal)} sub={`${lapseRows.length} closed-month balances`} colorClass={lapseTotal > 0 ? "text-warning" : "text-muted"} icon="fa-hourglass-half" />
        </div>
        <div className="col-lg-4 col-md-6 col-sm-12">
          <KPI label="Pending Approvals" value={String(ctx.changeRequests.filter(r => r.status === "Pending").length)} sub="Awaiting financial review" colorClass={ctx.changeRequests.filter(r => r.status === "Pending").length > 0 ? "text-warning" : "text-success"} icon="fa-gavel" />
        </div>
      </div>

      {/* Org Ribbon */}
      <div className="card border-0 shadow-sm rounded-4 mb-4">
        <div className="card-body p-4">
          <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
            <i className="fas fa-sliders-h text-success"></i>
            Organisation — Allocation vs Consumption by Month <span className="text-muted fw-normal fs-12">{FY}</span>
          </h6>
          <Ribbon alloc={orgAlloc} cons={orgCons} big={true} />
          <div className="d-flex gap-1 mt-2 mb-3">
            {MONTHS.map((m, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", fontSize: "9.5px", color: i === CUR_PERIOD ? "#064e3b" : "#9ca3af", fontWeight: i === CUR_PERIOD ? 700 : 400 }}>
                {m.split("-")[0]}
              </div>
            ))}
          </div>
          <hr />
          <RibbonLegend />
        </div>
      </div>

      {/* Pipeline & Type Split */}
      <div className="row g-4 mb-4">
        <div className="col-lg-7 col-md-12">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-header bg-white border-bottom py-3">
              <h6 className="card-title fw-bold mb-0">Procurement Pipeline</h6>
            </div>
            <div className="card-body p-4">
              {[
                { label: "PR Committed", val: totals.pr, p: prPct, color: "#10b981" },
                { label: "PO Approved", val: totals.po, p: poPct, color: "#059669" },
                { label: "Consumed / Invoiced", val: totals.invoiced, p: invoicedPct, color: "#064e3b" },
              ].map(r => (
                <div key={r.label} className="mb-4">
                  <div className="d-flex justify-content-between mb-1 small fw-medium">
                    <span>{r.label}</span>
                    <span className="text-muted">{fmt(r.val)} <span style={{ color: r.color }}>({r.p}%)</span></span>
                  </div>
                  <div className="progress" style={{ height: "10px", borderRadius: "5px" }}>
                    <div className="progress-bar" style={{ width: `${Math.min(r.p, 100)}%`, backgroundColor: r.color, transition: "width 0.4s" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="col-lg-5 col-md-12">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-header bg-white border-bottom py-3">
              <h6 className="card-title fw-bold mb-0">Opex vs Capex Allocation</h6>
            </div>
            <div className="card-body p-4">
              <div className="row g-3">
                <div className="col-6">
                  <div className="p-3 bg-success-subtle bg-opacity-25 rounded-3 text-center">
                    <div className="text-success fw-bold small text-uppercase mb-2">Opex</div>
                    <h4 className="fw-bold mb-1 text-success-emphasis">{fmtK(totals.opex_total)}</h4>
                    <span className="text-muted fs-11">{pct(totals.opex_total, totals.allocated)}% of total</span>
                  </div>
                </div>
                <div className="col-6">
                  <div className="p-3 bg-info-subtle bg-opacity-25 rounded-3 text-center">
                    <div className="text-info fw-bold small text-uppercase mb-2">Capex</div>
                    <h4 className="fw-bold mb-1 text-info-emphasis">{fmtK(totals.capex_total)}</h4>
                    <span className="text-muted fs-11">{pct(totals.capex_total, totals.allocated)}% of total</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lapsing budget alert table */}
      {lapseRows.length > 0 && (
        <div className="card border-0 shadow-sm rounded-4 border border-warning mb-4">
          <div className="card-header bg-warning bg-opacity-10 border-bottom border-warning-subtle py-3 d-flex justify-content-between align-items-center">
            <h6 className="fw-bold mb-0 text-warning-emphasis">
              <i className="fas fa-exclamation-triangle me-2"></i> Lapsing Budget Warnings — Closed month unutilised balances
            </h6>
            <span className="fs-12 text-warning-emphasis">Carry forward before they lapse</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0" style={{ fontSize: "13px" }}>
              <thead className="table-light">
                <tr>
                  <th className="px-4 py-3">Activity</th>
                  <th className="py-3">Closed Month</th>
                  <th className="text-end py-3">Allocated</th>
                  <th className="text-end py-3">Consumed</th>
                  <th className="text-end py-3">Unutilised</th>
                  <th className="text-center py-3" style={{ width: "160px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {lapseRows.slice(0, 5).map((r, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 fw-bold text-success">{r.a.name}</td>
                    <td className="py-3">{MONTHS[r.m]}</td>
                    <td className="text-end py-3 font-monospace">{fmtK(r.alloc)}</td>
                    <td className="text-end py-3 font-monospace">{fmtK(r.cons)}</td>
                    <td className="text-end py-3 font-monospace text-warning fw-bold">{fmtK(r.u)}</td>
                    <td className="text-center py-3">
                      <button className="btn btn-sm btn-outline-warning py-1.5 px-3 fw-bold rounded-3" onClick={() => openCR("carry", r.a.activity_code)}>
                        <i className="fas fa-forward me-1"></i> Carry forward
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dept Summary Table */}
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-header bg-white border-bottom py-3">
          <h6 className="fw-bold mb-0">Department Budget Summary</h6>
        </div>
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0" style={{ fontSize: "13px" }}>
            <thead className="table-light">
              <tr>
                <th className="px-4 py-3">Department</th>
                <th className="text-end py-3">Allocated</th>
                <th className="text-end py-3">PR</th>
                <th className="text-end py-3">PO</th>
                <th className="text-end py-3">Invoiced</th>
                <th className="text-end py-3">Remaining</th>
                <th className="text-center py-3" style={{ width: "180px" }}>Utilisation</th>
              </tr>
            </thead>
            <tbody>
              {deptSummaries.map(d => {
                const u = pct(d.invoiced, d.allocated);
                return (
                  <tr key={d.dept_code}>
                    <td className="px-4 py-3 fw-bold">{d.dept_name}</td>
                    <td className="text-end py-3 font-monospace">{fmt(d.allocated)}</td>
                    <td className="text-end py-3 font-monospace text-info">{fmt(d.pr)}</td>
                    <td className="text-end py-3 font-monospace text-success">{fmt(d.po)}</td>
                    <td className="text-end py-3 font-monospace text-success fw-semibold">{fmt(d.invoiced)}</td>
                    <td className="text-end py-3 font-monospace">{fmt(d.remaining)}</td>
                    <td className="text-center py-3">
                      <div className="d-flex align-items-center justify-content-center gap-2">
                        <div className="progress flex-grow-1" style={{ height: "6px", maxWidth: "80px", borderRadius: "3px" }}>
                          <div className="progress-bar bg-success" style={{ width: `${Math.min(u, 100)}%` }} />
                        </div>
                        <span className="small text-muted font-monospace">{u}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── BUDGET BOOK ──────────────────────────────────────────────────────────────
function BudgetBookPage({ ctx }) {
  const { departments, projects, activities, employees, setDrawer, openCR } = ctx;
  const [view, setView] = useState("summary"); // summary | monthly
  const [metric, setMetric] = useState("alloc"); // alloc | pr | po | cons
  const [collapsed, setCollapsed] = useState({});
  const [filterDept, setFilterDept] = useState("");

  const toggle = key => setCollapsed(c => ({ ...c, [key]: !c[key] }));

  const metricColors = { alloc: "#047857", pr: "#10b981", po: "#0f766e", cons: "#064e3b" };

  const hasLapse = (act) => {
    const alloc = getPhaseArr(act.phases, "alloc");
    const cons = getPhaseArr(act.phases, "cons");
    return alloc.slice(0, CUR_PERIOD).some((a, i) => a - cons[i] > 500);
  };

  const visibleDepts = filterDept ? departments.filter(d => d.dept_code === filterDept) : departments;

  const SummaryView = () => (
    <div className="table-responsive rounded-4 border">
      <table className="table table-hover align-middle mb-0" style={{ fontSize: "13px" }}>
        <thead className="table-light">
          <tr>
            <th className="px-3 py-3" style={{ width: "90px" }}>WBS</th>
            <th className="py-3">Name</th>
            <th className="py-3" style={{ width: "80px" }}>Cost</th>
            <th className="py-3">Owner</th>
            <th className="text-end py-3">Approved</th>
            <th className="text-end py-3">Allocated</th>
            <th className="text-end py-3">Consumed</th>
            <th className="text-end py-3">Remaining</th>
            <th className="text-center py-3" style={{ width: "190px" }}>12-Month Plan</th>
          </tr>
        </thead>
        <tbody>
          {visibleDepts.map(dept => {
            const dKey = "dept_" + dept.dept_code;
            const dOpen = !collapsed[dKey];
            const dProjs = projects.filter(p => p.dept_code === dept.dept_code);
            const dActs = activities.filter(a => dProjs.some(p => p.project_code === a.project_code));

            const dAllocArr = Array(12).fill(0);
            const dConsArr = Array(12).fill(0);
            dActs.forEach(a => {
              getPhaseArr(a.phases, "alloc").forEach((v, i) => { dAllocArr[i] += v; });
              getPhaseArr(a.phases, "cons").forEach((v, i) => { dConsArr[i] += v; });
            });
            const dAllocT = sum12(dAllocArr);
            const dConsT = sum12(dConsArr);

            return (
              <React.Fragment key={dept.dept_code}>
                <tr className="table-secondary bg-opacity-25" style={{ cursor: "pointer" }} onClick={() => toggle(dKey)}>
                  <td className="px-3 py-2.5 font-monospace text-muted small">{dept.wbs}</td>
                  <td className="py-2.5 fw-bold text-dark-emphasis" colSpan={3}>
                    <i className={`fas fa-chevron-${dOpen ? "down" : "right"} text-muted me-2`}></i>
                    <i className="fas fa-folder me-2 text-warning"></i>
                    {dept.name}
                  </td>
                  <td className="text-end py-2.5 fw-bold font-monospace">{fmtK(dAllocT)}</td>
                  <td className="text-end py-2.5 fw-bold font-monospace">{fmtK(dAllocT)}</td>
                  <td className="text-end py-2.5 fw-bold font-monospace text-success">{fmtK(dConsT)}</td>
                  <td className="text-end py-2.5 fw-bold font-monospace">{fmtK(dAllocT - dConsT)}</td>
                  <td className="py-2.5 text-center"><Ribbon alloc={dAllocArr} cons={dConsArr} /></td>
                </tr>

                {dOpen && dProjs.map(proj => {
                  const pKey = "proj_" + proj.project_code;
                  const pOpen = !collapsed[pKey];
                  const pActs = dActs.filter(a => a.project_code === proj.project_code);
                  const pAllocArr = Array(12).fill(0);
                  const pConsArr = Array(12).fill(0);
                  pActs.forEach(a => {
                    getPhaseArr(a.phases, "alloc").forEach((v, i) => { pAllocArr[i] += v; });
                    getPhaseArr(a.phases, "cons").forEach((v, i) => { pConsArr[i] += v; });
                  });

                  return (
                    <React.Fragment key={proj.project_code}>
                      <tr className="table-light" style={{ cursor: "pointer" }} onClick={() => toggle(pKey)}>
                        <td className="px-3 py-2 font-monospace text-muted small">{proj.wbs}</td>
                        <td className="py-2 fw-semibold ps-4" colSpan={3}>
                          <i className={`fas fa-chevron-${pOpen ? "down" : "right"} text-muted me-2`}></i>
                          <i className="fas fa-folder-open me-2 text-warning"></i>
                          {proj.name}
                        </td>
                        <td className="text-end py-2 fw-semibold font-monospace">{fmtK(sum12(pAllocArr))}</td>
                        <td className="text-end py-2 fw-semibold font-monospace">{fmtK(sum12(pAllocArr))}</td>
                        <td className="text-end py-2 fw-semibold font-monospace text-success">{fmtK(sum12(pConsArr))}</td>
                        <td className="text-end py-2 fw-semibold font-monospace">{fmtK(sum12(pAllocArr) - sum12(pConsArr))}</td>
                        <td className="py-2 text-center"><Ribbon alloc={pAllocArr} cons={pConsArr} /></td>
                      </tr>

                      {pOpen && pActs.map(act => {
                        const actAlloc = getPhaseArr(act.phases, "alloc");
                        const actCons = getPhaseArr(act.phases, "cons");
                        const lapse = hasLapse(act);
                        const emp = employees.find(e => e.employee_code === act.employee_code);

                        return (
                          <tr key={act.activity_code} style={{ cursor: "pointer" }} onClick={() => setDrawer(act.activity_code)}>
                            <td className="px-3 py-2 font-monospace text-muted small">{act.wbs}</td>
                            <td className="py-2 ps-5">
                              <span className="d-flex align-items-center gap-2">
                                <i className="fas fa-file-invoice text-success"></i>
                                <span>{act.name}</span>
                                {lapse && <i className="fas fa-exclamation-circle text-warning" title="Lapsing Closed Month balance detected"></i>}
                              </span>
                            </td>
                            <td className="py-2">
                              {act.cost_type_tag && (
                                <span className={`badge px-2 py-1 ${act.cost_type_tag === "Capex" ? "bg-info-subtle text-info-emphasis" : "bg-success-subtle text-success-emphasis"}`} style={{ fontSize: "11px" }}>
                                  {act.cost_type_tag}
                                </span>
                              )}
                            </td>
                            <td className="py-2 small text-muted">
                              {emp ? emp.name : "—"}
                            </td>
                            <td className="text-end py-2 font-monospace">{fmtK(act.approved)}</td>
                            <td className="text-end py-2 font-monospace">{fmtK(sum12(actAlloc))}</td>
                            <td className="text-end py-2 font-monospace text-success">{fmtK(sum12(actCons))}</td>
                            <td className="text-end py-2 font-monospace">{fmtK(sum12(actAlloc) - sum12(actCons))}</td>
                            <td className="py-2 text-center"><Ribbon alloc={actAlloc} cons={actCons} /></td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const MonthlyView = () => (
    <div className="table-responsive rounded-4 border">
      <table className="table table-hover align-middle mb-0" style={{ fontSize: "12px" }}>
        <thead className="table-light">
          <tr>
            <th className="px-3 py-3" style={{ minWidth: "220px", position: "sticky", left: 0, backgroundColor: "#fff", zIndex: 10 }}>WBS / Name</th>
            <th className="text-end py-3" style={{ minWidth: "100px" }}>Total</th>
            {MONTHS.map((m, i) => (
              <th key={m} className={`text-end py-3 ${i === CUR_PERIOD ? "bg-success bg-opacity-10 text-success fw-bold" : ""}`} style={{ minWidth: "75px" }}>
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Org roll-up */}
          {(() => {
            const orgAllocArr = Array(12).fill(0);
            activities.forEach(a => {
              getPhaseArr(a.phases, metric).forEach((v, i) => { orgAllocArr[i] += v; });
            });
            const orgSum = sum12(orgAllocArr);
            return (
              <tr className="table-dark text-white">
                <td className="px-3 py-2.5 fw-bold" style={{ position: "sticky", left: 0, backgroundColor: "#212529" }}>
                  <i className="fas fa-globe me-2"></i> Organisation Total
                </td>
                <td className="text-end py-2.5 fw-bold font-monospace">{fmtK(orgSum)}</td>
                {orgAllocArr.map((v, i) => (
                  <td key={i} className={`text-end py-2.5 font-monospace ${i === CUR_PERIOD ? "bg-success bg-opacity-25" : ""}`}>
                    {fmtK(v)}
                  </td>
                ))}
              </tr>
            );
          })()}

          {/* Departments & projects */}
          {visibleDepts.map(dept => {
            const dKey = "dept_" + dept.dept_code;
            const dOpen = !collapsed[dKey];
            const dProjs = projects.filter(p => p.dept_code === dept.dept_code);
            const dActs = activities.filter(a => dProjs.some(p => p.project_code === a.project_code));

            const dPhases = Array(12).fill(0);
            dActs.forEach(a => {
              getPhaseArr(a.phases, metric).forEach((v, i) => { dPhases[i] += v; });
            });
            const dSum = sum12(dPhases);

            return (
              <React.Fragment key={dept.dept_code}>
                <tr className="table-secondary" style={{ cursor: "pointer" }} onClick={() => toggle(dKey)}>
                  <td className="px-3 py-2 fw-bold" style={{ position: "sticky", left: 0, backgroundColor: "#e2e3e5" }}>
                    <i className={`fas fa-chevron-${dOpen ? "down" : "right"} text-muted me-2`}></i>
                    📁 {dept.name}
                  </td>
                  <td className="text-end py-2 fw-bold font-monospace">{fmtK(dSum)}</td>
                  {dPhases.map((v, i) => (
                    <td key={i} className={`text-end py-2 font-monospace ${i === CUR_PERIOD ? "bg-success bg-opacity-10 fw-bold" : ""}`}>
                      {fmtK(v)}
                    </td>
                  ))}
                </tr>

                {dOpen && dProjs.map(proj => {
                  const pKey = "proj_" + proj.project_code;
                  const pOpen = !collapsed[pKey];
                  const pActs = dActs.filter(a => a.project_code === proj.project_code);

                  const pPhases = Array(12).fill(0);
                  pActs.forEach(a => {
                    getPhaseArr(a.phases, metric).forEach((v, i) => { pPhases[i] += v; });
                  });
                  const pSum = sum12(pPhases);

                  return (
                    <React.Fragment key={proj.project_code}>
                      <tr className="table-light" style={{ cursor: "pointer" }} onClick={() => toggle(pKey)}>
                        <td className="px-3 py-1.5 fw-semibold ps-4" style={{ position: "sticky", left: 0, backgroundColor: "#f8f9fa" }}>
                          <i className={`fas fa-chevron-${pOpen ? "down" : "right"} text-muted me-2`}></i>
                          📂 {proj.name}
                        </td>
                        <td className="text-end py-1.5 fw-semibold font-monospace">{fmtK(pSum)}</td>
                        {pPhases.map((v, i) => (
                          <td key={i} className={`text-end py-1.5 font-monospace ${i === CUR_PERIOD ? "bg-success bg-opacity-10 fw-bold" : ""}`}>
                            {fmtK(v)}
                          </td>
                        ))}
                      </tr>

                      {pOpen && pActs.map(act => {
                        const actPhases = getPhaseArr(act.phases, metric);
                        const actSum = sum12(actPhases);

                        return (
                          <tr key={act.activity_code} style={{ cursor: "pointer" }} onClick={() => setDrawer(act.activity_code)}>
                            <td className="px-3 py-1.5 ps-5 bg-white" style={{ position: "sticky", left: 0, backgroundColor: "#fff" }}>
                              <i className="fas fa-file-invoice text-success me-2"></i>
                              {act.name}
                            </td>
                            <td className="text-end py-1.5 font-monospace">{fmtK(actSum)}</td>
                            {actPhases.map((v, i) => (
                              <td key={i} className={`text-end py-1.5 font-monospace ${i === CUR_PERIOD ? "bg-success bg-opacity-10 fw-semibold" : ""}`}>
                                {v > 0 ? fmtK(v) : "—"}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div className="btn-group" role="group">
          <button className={`btn btn-sm btn-${view === "summary" ? "success" : "outline-success"}`} onClick={() => setView("summary")}>Summary Rollup</button>
          <button className={`btn btn-sm btn-${view === "monthly" ? "success" : "outline-outline"}`} onClick={() => setView("monthly")}>Monthly Phasing</button>
        </div>

        {view === "monthly" && (
          <div className="btn-group" role="group">
            {Object.entries({ alloc: "Alloc", pr: "PR", po: "PO", cons: "Cons" }).map(([k, lbl]) => (
              <button key={k} className={`btn btn-sm btn-${metric === k ? "success" : "outline-success"}`} onClick={() => setMetric(k)}>{lbl}</button>
            ))}
          </div>
        )}

        <div>
          <select className="form-select form-select-sm border-light-subtle shadow-sm" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
            <option value="">All Departments</option>
            {departments.map(d => <option key={d.dept_code} value={d.dept_code}>{d.name}</option>)}
          </select>
        </div>
      </div>

      {view === "summary" ? <SummaryView /> : <MonthlyView />}

      <div className="mt-3 card border-0 bg-light p-3 small text-muted">
        {view === "summary" ? (
          <div>
            <RibbonLegend />
            <div className="mt-2 text-warning fw-semibold">
              <i className="fas fa-exclamation-circle me-1"></i> Closed months (Apr-26, May-26, Jun-26) with unutilised funds are highlighted. Select individual line rows to carry forward.
            </div>
          </div>
        ) : (
          <div>
            <i className="fas fa-info-circle me-1"></i> Current period month ({MONTHS[CUR_PERIOD]}) is outlined. Figures shown in standard Indian currency scale.
          </div>
        )}
      </div>
    </div>
  );
}

// ── LINE DRAWER ──────────────────────────────────────────────────────────────
function LineDrawer({ ctx }) {
  const { activities, employees, drawer, setDrawer, openCR, setActivities, showToast } = ctx;
  const act = activities.find(a => a.activity_code === drawer);
  if (!act) return null;

  const emp = employees.find(e => e.employee_code === act.employee_code);
  const allocArr = getPhaseArr(act.phases, "alloc");
  const prArr = getPhaseArr(act.phases, "pr");
  const poArr = getPhaseArr(act.phases, "po");
  const consArr = getPhaseArr(act.phases, "cons");

  const reassign = (empCode) => {
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    axios.patch(`/api/budget/activities/${act.activity_code}`, { employee_code: empCode }, { headers })
      .then(res => {
        ctx.fetchData();
        showToast("Reassigned manager successfully.");
      })
      .catch(err => {
        showToast(err.response?.data?.detail || "Action failed", false);
      });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1050 }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0, 0, 0, 0.4)" }} onClick={() => setDrawer(null)} />
      <aside className="bg-white shadow-lg d-flex flex-column h-100 position-absolute top-0 end-0" style={{ width: "520px" }}>
        {/* Drawer Header */}
        <div className="p-4 border-bottom bg-light d-flex justify-content-between align-items-start">
          <div>
            <div className="text-muted small font-monospace">{act.wbs} · {act.activity_code}</div>
            <h5 className="fw-bold mb-1 mt-1">{act.name}</h5>
            <span className={`badge px-2 py-1 ${act.cost_type_tag === "Capex" ? "bg-info-subtle text-info-emphasis" : "bg-success-subtle text-success-emphasis"}`}>
              {act.cost_type_tag}
            </span>
          </div>
          <button className="btn-close" onClick={() => setDrawer(null)}></button>
        </div>

        {/* Drawer Body */}
        <div className="p-4 flex-grow-1 overflow-y-auto">
          {/* Reassign Manager */}
          <div className="mb-4">
            <label className="form-label small fw-bold text-muted text-uppercase mb-1.5">Owner / Manager</label>
            <select className="form-select border-light-subtle shadow-sm" value={act.employee_code || ""} onChange={e => reassign(e.target.value)}>
              <option value="">— Unassigned —</option>
              {employees.map(e => (
                <option key={e.employee_code} value={e.employee_code}>{e.name} — {e.title}</option>
              ))}
            </select>
          </div>

          {/* Quick Metrics */}
          <div className="row g-2 mb-4">
            {[
              { label: "Approved", val: act.approved, color: "text-muted" },
              { label: "Allocated", val: sum12(allocArr), color: "text-success" },
              { label: "Consumed", val: sum12(consArr), color: "text-dark" },
              { label: "Remaining", val: sum12(allocArr) - sum12(consArr), color: sum12(allocArr) - sum12(consArr) < 0 ? "text-danger" : "text-primary" }
            ].map(m => (
              <div className="col-3" key={m.label}>
                <div className="p-2 border rounded-3 bg-light bg-opacity-25 text-center">
                  <div className="small text-muted fs-11 fw-semibold text-uppercase">{m.label}</div>
                  <div className={`fw-bold mt-1 font-monospace ${m.color}`} style={{ fontSize: "13px" }}>{fmtK(m.val)}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Monthly Table */}
          <h6 className="fw-bold mb-3 text-uppercase text-muted small" style={{ letterSpacing: "0.5px" }}>Month-By-Month Breakdown</h6>
          <div className="table-responsive border rounded-3 mb-4">
            <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: "12px" }}>
              <thead className="table-light">
                <tr>
                  <th className="px-3 py-2">Month</th>
                  <th className="text-end py-2">Allocated</th>
                  <th className="text-end py-2">PR</th>
                  <th className="text-end py-2">PO</th>
                  <th className="text-end py-2">Consumed</th>
                  <th className="text-end py-2">Free</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map((mm, m) => {
                  const free = allocArr[m] - consArr[m];
                  const closed = m < CUR_PERIOD;
                  const isCur = m === CUR_PERIOD;
                  const lapsing = closed && free > 0.5;

                  return (
                    <tr key={mm} className={isCur ? "table-success bg-opacity-10" : ""}>
                      <td className="px-3 py-2 fw-medium">
                        {mm} {isCur && <span className="badge bg-success text-white px-1.5 py-0.5 ms-1">Cur</span>}
                        {closed && <span className="small text-muted font-normal ms-1">(Closed)</span>}
                      </td>
                      <td className="text-end py-2 font-monospace">{fmtK(allocArr[m])}</td>
                      <td className="text-end py-2 font-monospace text-info">{fmtK(prArr[m])}</td>
                      <td className="text-end py-2 font-monospace text-success">{fmtK(poArr[m])}</td>
                      <td className="text-end py-2 font-monospace text-dark">{fmtK(consArr[m])}</td>
                      <td className={`text-end py-2 font-monospace fw-semibold ${free < 0 ? "text-danger" : lapsing ? "text-warning" : "text-muted"}`}>
                        {fmtK(free)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action trigger buttons */}
          <h6 className="fw-bold mb-3 text-uppercase text-muted small" style={{ letterSpacing: "0.5px" }}>Raise Reallocation Request</h6>
          <div className="row g-2">
            {Object.entries(CR_TYPES).map(([k, v]) => (
              <div className="col-6" key={k}>
                <button className="btn btn-outline-success btn-sm w-100 py-2.5 text-start px-3 d-flex align-items-center gap-2 rounded-3" onClick={() => openCR(k, act.activity_code)}>
                  <i className={v.icon} style={{ width: "16px", textAlign: "center" }}></i>
                  <span className="small fw-semibold">{v.title.split(" ")[0]} {v.title.split(" ").slice(1).join(" ")}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ── CHANGE REQUESTS PAGE ──────────────────────────────────────────────────────
function RequestsPage({ ctx }) {
  const { changeRequests, openCR } = ctx;
  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h6 className="fw-bold mb-0">Change Requests History</h6>
          <p className="text-muted mb-0 small">Reallocations and carry forwards generated in this cycle</p>
        </div>
        <div className="d-flex gap-2">
          {Object.entries(CR_TYPES).map(([k, v]) => (
            <button key={k} className="btn btn-sm btn-outline-success py-1.5 px-3 rounded-3" onClick={() => openCR(k, null)}>
              <i className={v.icon}></i> {v.title.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {changeRequests.length === 0 ? (
        <div className="text-center py-5 text-muted border border-dashed rounded-4 bg-white">
          <i className="fas fa-exchange-alt fs-1 mb-3 text-secondary"></i>
          <h6>No requests raised yet</h6>
          <p className="fs-12 mb-0">Use the Budget Book or Dashboard carry forward actions to request adjustments.</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {changeRequests.map(cr => {
            const def = CR_TYPES[cr.request_type];
            let badgeClass = "bg-warning-subtle text-warning-emphasis";
            if (cr.status === "Approved") badgeClass = "bg-success-subtle text-success-emphasis";
            else if (cr.status === "Rejected") badgeClass = "bg-danger-subtle text-danger-emphasis";

            return (
              <div className="card border-0 shadow-sm rounded-4" key={cr.id}>
                <div className="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                  <div className="d-flex align-items-start gap-3">
                    <div className="rounded-circle bg-light d-flex align-items-center justify-content-center text-success" style={{ width: "40px", height: "40px", flexShrink: 0 }}>
                      <i className={def?.icon || "fas fa-sync"}></i>
                    </div>
                    <div>
                      <h6 className="fw-bold mb-1">{cr.id} · {def?.title}</h6>
                      <div className="text-muted small">
                        <strong>{cr.a_name}</strong> {cr.b_name ? `→ ${cr.b_name}` : ""}
                      </div>
                      <div className="text-muted fs-12 mt-1">
                        Month {cr.period_from} ({MONTHS[cr.period_from - 1]})
                        {cr.request_type !== "transfer" && ` → Month ${cr.period_to} (${MONTHS[cr.period_to - 1]})`}
                        {cr.reason && ` · "${cr.reason}"`}
                      </div>
                    </div>
                  </div>
                  <div className="text-end d-flex flex-column align-items-end">
                    <h5 className="fw-bold mb-1 font-monospace">{fmt(cr.amount)}</h5>
                    <span className={`badge px-2.5 py-1 text-uppercase rounded-pill ${badgeClass}`} style={{ fontSize: "10px" }}>
                      {cr.status}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── APPROVALS PAGE ────────────────────────────────────────────────────────────
function ApprovalsPage({ ctx }) {
  const { changeRequests, decide } = ctx;
  const pending = changeRequests.filter(r => r.status === "Pending");
  const decided = changeRequests.filter(r => r.status !== "Pending");

  return (
    <div>
      <h6 className="fw-bold mb-3">Pending Finance Actions ({pending.length})</h6>
      
      {pending.length === 0 ? (
        <div className="text-center py-5 text-muted border border-dashed rounded-4 bg-white mb-4">
          <i className="fas fa-check-circle fs-1 mb-3 text-success"></i>
          <h6>All clear!</h6>
          <p className="fs-12 mb-0">No pending change requests await decision.</p>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3 mb-4">
          {pending.map(cr => {
            const def = CR_TYPES[cr.request_type];
            return (
              <div className="card border-0 shadow-sm border-start border-warning border-4 rounded-4" key={cr.id}>
                <div className="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
                  <div className="d-flex align-items-start gap-3">
                    <div className="rounded-circle bg-light d-flex align-items-center justify-content-center text-warning" style={{ width: "40px", height: "40px", flexShrink: 0 }}>
                      <i className={def?.icon || "fas fa-gavel"}></i>
                    </div>
                    <div>
                      <h6 className="fw-bold mb-1">{cr.id} · {def?.title}</h6>
                      <div className="text-muted small">
                        Source: <strong>{cr.a_name}</strong> {cr.b_name ? `→ Target: ${cr.b_name}` : ""}
                      </div>
                      <div className="text-muted fs-12 mt-1">
                        Amount: <strong className="font-monospace">{fmt(cr.amount)}</strong> ·
                        Month {cr.period_from} ({MONTHS[cr.period_from - 1]})
                        {cr.request_type !== "transfer" && ` → Month ${cr.period_to} (${MONTHS[cr.period_to - 1]})`}
                        {cr.reason && ` · Reason: "${cr.reason}"`}
                      </div>
                    </div>
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-success btn-sm px-3 fw-bold rounded-3" onClick={() => decide(cr.id, true)}>
                      <i className="fas fa-check me-1"></i> Approve
                    </button>
                    <button className="btn btn-outline-danger btn-sm px-3 fw-bold rounded-3" onClick={() => decide(cr.id, false)}>
                      <i className="fas fa-times me-1"></i> Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {decided.length > 0 && (
        <div>
          <h6 className="fw-bold text-muted small text-uppercase mb-3 mt-4" style={{ letterSpacing: "0.5px" }}>Decided History</h6>
          <div className="d-flex flex-column gap-2">
            {decided.map(cr => (
              <div className="card border-0 bg-light bg-opacity-25" key={cr.id}>
                <div className="card-body py-2.5 px-4 d-flex justify-content-between align-items-center text-muted small">
                  <div>
                    <span className="fw-bold text-dark">{cr.id}</span> · {CR_TYPES[cr.request_type]?.title.split(" ")[0]} · {cr.a_name} · <strong className="font-monospace text-dark">{fmtN(cr.amount)}</strong>
                  </div>
                  <span className={`badge px-2 py-0.5 rounded-pill ${cr.status === "Approved" ? "bg-success bg-opacity-10 text-success" : "bg-danger bg-opacity-10 text-danger"}`}>
                    {cr.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── BUDGET VERSIONS ───────────────────────────────────────────────────────────
function BudgetsPage({ ctx }) {
  const { budgetVersions, setBudgetVersions, showToast } = ctx;
  const [form, setForm] = useState({ show: false, name: "", basis: "", fiscal_year: FY });

  const addBudget = () => {
    if (!form.name.trim()) return showToast("Budget Name is required", false);
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    axios.post('/api/budget/budget-versions', {
      name: form.name.trim(),
      basis: form.basis.trim() || "Manual creation",
      fiscal_year: form.fiscal_year,
      created_date: today()
    }, { headers })
      .then(res => {
        ctx.fetchData();
        setForm({ show: false, name: "", basis: "", fiscal_year: FY });
        showToast("Successfully created new budget version.");
      })
      .catch(err => showToast(err.response?.data?.detail || "Action failed", false));
  };

  const setActive = (code) => {
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    axios.patch(`/api/budget/budget-versions/${code}/set-active`, {}, { headers })
      .then(res => {
        ctx.fetchData();
        showToast("Active budget version updated.");
      })
      .catch(err => showToast(err.response?.data?.detail || "Action failed", false));
  };

  const toggleLock = (code) => {
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    axios.patch(`/api/budget/budget-versions/${code}/toggle-lock`, {}, { headers })
      .then(res => {
        ctx.fetchData();
        showToast("Budget version lock status updated.");
      })
      .catch(err => showToast(err.response?.data?.detail || "Action failed", false));
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h6 className="fw-bold mb-0">Budget Version Governance</h6>
          <p className="text-muted mb-0 small">Create, lock, and manage active working WBS budgets</p>
        </div>
        <button className="btn btn-success btn-sm fw-bold px-3 rounded-3" onClick={() => setForm(f => ({ ...f, show: !f.show }))}>
          <i className="fas fa-plus me-1.5"></i> New Version
        </button>
      </div>

      {form.show && (
        <div className="card border-0 shadow-sm p-4 rounded-4 mb-4">
          <h6 className="fw-bold mb-3 text-success">Create Working Budget Version</h6>
          <div className="row g-3">
            <div className="col-md-5 col-sm-12">
              <label className="form-label small text-muted fw-semibold">Version Name *</label>
              <input type="text" className="form-control border-light-subtle" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Q2 Midyear Correction" />
            </div>
            <div className="col-md-3 col-sm-12">
              <label className="form-label small text-muted fw-semibold">Fiscal Year</label>
              <select className="form-select border-light-subtle" value={form.fiscal_year} onChange={e => setForm(f => ({ ...f, fiscal_year: e.target.value }))}>
                {fiscalYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="col-md-4 col-sm-12">
              <label className="form-label small text-muted fw-semibold">Governance Basis / Notes</label>
              <input type="text" className="form-control border-light-subtle" value={form.basis} onChange={e => setForm(f => ({ ...f, basis: e.target.value }))} placeholder="e.g. Board revision" />
            </div>
          </div>
          <div className="d-flex gap-2 mt-4">
            <button className="btn btn-success btn-sm px-4 fw-semibold" onClick={addBudget}>Create</button>
            <button className="btn btn-outline-secondary btn-sm px-4" onClick={() => setForm(f => ({ ...f, show: false }))}>Cancel</button>
          </div>
        </div>
      )}

      <div className="d-flex flex-column gap-3">
        {budgetVersions.map(b => (
          <div className={`card border border-2 rounded-4 ${b.is_current ? "border-success shadow-sm" : "border-light"}`} key={b.version_code}>
            <div className="card-body p-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div>
                <h6 className="fw-bold mb-1">
                  {b.name}
                  {b.is_current === 1 && (
                    <span className="badge bg-success bg-opacity-10 text-success ms-2 rounded-pill px-2 py-0.5" style={{ fontSize: "11px" }}>Active</span>
                  )}
                </h6>
                <div className="text-muted small">
                  {b.version_code} · {b.fiscal_year} · Created {b.created_date} {b.basis && `· Note: "${b.basis}"`}
                </div>
              </div>
              <div className="d-flex gap-2">
                {b.is_current !== 1 && (
                  <button className="btn btn-outline-success btn-sm px-3 fw-bold rounded-3" onClick={() => setActive(b.version_code)}>
                    Set Active
                  </button>
                )}
                <button className={`btn btn-sm btn-${b.is_locked ? "warning" : "outline-secondary"} px-3 fw-semibold rounded-3`} onClick={() => toggleLock(b.version_code)}>
                  <i className={`fas ${b.is_locked ? "fa-lock" : "fa-unlock"} me-1`}></i>
                  {b.is_locked ? "Locked" : "Lock"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── WBS HIERARCHY ─────────────────────────────────────────────────────────────
function HierarchyPage({ ctx }) {
  const { departments, setDepartments, projects, setProjects, employees, activities, setActivities, showToast } = ctx;
  const [tab, setTab] = useState("dept");
  const [form, setForm] = useState({});

  const addDept = () => {
    if (!form.name?.trim()) return showToast("Department Name is required.", false);
    const wbs = "1." + (departments.length + 1);
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    axios.post('/api/budget/departments', {
      name: form.name.trim(),
      org_code: "ORG-001",
      wbs
    }, { headers })
      .then(res => {
        ctx.fetchData();
        setForm({});
        showToast("Department created.");
      })
      .catch(err => showToast(err.response?.data?.detail || "Action failed", false));
  };

  const addProject = () => {
    if (!form.name?.trim() || !form.dept_code) return showToast("Name and Department code are required.", false);
    const parentDept = departments.find(d => d.dept_code === form.dept_code);
    const siblings = projects.filter(p => p.dept_code === form.dept_code);
    const wbs = (parentDept?.wbs || "1.x") + "." + (siblings.length + 1);
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    axios.post('/api/budget/projects', {
      name: form.name.trim(),
      dept_code: form.dept_code,
      wbs
    }, { headers })
      .then(res => {
        ctx.fetchData();
        setForm({});
        showToast("Project created.");
      })
      .catch(err => showToast(err.response?.data?.detail || "Action failed", false));
  };

  const addActivity = () => {
    if (!form.name?.trim() || !form.project_code) return showToast("Activity Name and Project are required.", false);
    const parentProj = projects.find(p => p.project_code === form.project_code);
    const siblings = activities.filter(a => a.project_code === form.project_code);
    const wbs = (parentProj?.wbs || "1.x.x") + "." + (siblings.length + 1);
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    axios.post('/api/budget/activities', {
      name: form.name.trim(),
      project_code: form.project_code,
      cost_type_code: (form.cost_type_code || "Opex").toUpperCase(),
      employee_code: form.employee_code || null,
      status_code: "STS-NS",
      wbs,
      is_leaf: 1,
      allocated: Number(form.allocated) || 0
    }, { headers })
      .then(res => {
        ctx.fetchData();
        setForm({});
        showToast("Activity WBS node generated.");
      })
      .catch(err => showToast(err.response?.data?.detail || "Action failed", false));
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h6 className="fw-bold mb-0">WBS Structure Architect</h6>
          <p className="text-muted mb-0 small">Build and edit nodes for Organisation hierarchy</p>
        </div>
        <div className="btn-group" role="group">
          {["dept", "project", "activity"].map(t => (
            <button key={t} className={`btn btn-sm btn-${tab === t ? "success" : "outline-success"}`} onClick={() => { setTab(t); setForm({}); }}>
              {t === "dept" ? "Departments" : t === "project" ? "Projects" : "Activities"}
            </button>
          ))}
        </div>
      </div>

      <div className="row g-4">
        <div className="col-lg-5 col-md-12">
          <div className="card border-0 shadow-sm p-4 rounded-4 h-100">
            {tab === "dept" && (
              <div>
                <h6 className="fw-bold mb-3 text-success">Add WBS Department Node</h6>
                <div className="mb-3">
                  <label className="form-label small text-muted fw-semibold">Department Name *</label>
                  <input type="text" className="form-control border-light-subtle" value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Quality Assurance" />
                </div>
                <button className="btn btn-success btn-sm w-100 fw-bold py-2 mt-2" onClick={addDept}>Create Department Node</button>
              </div>
            )}

            {tab === "project" && (
              <div>
                <h6 className="fw-bold mb-3 text-success">Add WBS Project Node</h6>
                <div className="mb-3">
                  <label className="form-label small text-muted fw-semibold">Parent Department *</label>
                  <select className="form-select border-light-subtle" value={form.dept_code || ""} onChange={e => setForm(f => ({ ...f, dept_code: e.target.value }))}>
                    <option value="">— Select Department —</option>
                    {departments.map(d => <option key={d.dept_code} value={d.dept_code}>{d.name}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label small text-muted fw-semibold">Project Name *</label>
                  <input type="text" className="form-control border-light-subtle" value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. QA Automation Suite" />
                </div>
                <button className="btn btn-success btn-sm w-100 fw-bold py-2 mt-2" onClick={addProject}>Create Project Node</button>
              </div>
            )}

            {tab === "activity" && (
              <div>
                <h6 className="fw-bold mb-3 text-success">Add WBS Leaf Activity Node</h6>
                <div className="mb-3">
                  <label className="form-label small text-muted fw-semibold">Parent Project *</label>
                  <select className="form-select border-light-subtle" value={form.project_code || ""} onChange={e => setForm(f => ({ ...f, project_code: e.target.value }))}>
                    <option value="">— Select Project —</option>
                    {projects.map(p => <option key={p.project_code} value={p.project_code}>{p.name}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label small text-muted fw-semibold">Activity Name *</label>
                  <input type="text" className="form-control border-light-subtle" value={form.name || ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Cypress E2E Integration" />
                </div>
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <label className="form-label small text-muted fw-semibold">Cost Type</label>
                    <select className="form-select border-light-subtle" value={form.cost_type_code || ""} onChange={e => setForm(f => ({ ...f, cost_type_code: e.target.value }))}>
                      <option value="Opex">Opex</option>
                      <option value="Capex">Capex</option>
                    </select>
                  </div>
                  <div className="col-6">
                    <label className="form-label small text-muted fw-semibold">Owner</label>
                    <select className="form-select border-light-subtle" value={form.employee_code || ""} onChange={e => setForm(f => ({ ...f, employee_code: e.target.value }))}>
                      <option value="">— Select —</option>
                      {employees.map(e => <option key={e.employee_code} value={e.employee_code}>{e.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label small text-muted fw-semibold">Approved Allocation (₹)</label>
                  <input type="number" className="form-control border-light-subtle" value={form.allocated || ""} onChange={e => setForm(f => ({ ...f, allocated: e.target.value }))} placeholder="0" />
                </div>
                <button className="btn btn-success btn-sm w-100 fw-bold py-2 mt-2" onClick={addActivity}>Create Activity WBS Node</button>
              </div>
            )}
          </div>
        </div>

        <div className="col-lg-7 col-md-12">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-header bg-white border-bottom py-3">
              <h6 className="fw-bold mb-0">Active Hierarchy Structure Map</h6>
            </div>
            <div className="card-body p-4 overflow-y-auto" style={{ maxHeight: "400px" }}>
              {departments.map(d => (
                <div key={d.dept_code} className="mb-3">
                  <div className="fw-bold text-success-emphasis d-flex align-items-center gap-2">
                    <i className="fas fa-sitemap"></i>
                    <span>{d.wbs} · {d.name}</span>
                  </div>
                  {projects.filter(p => p.dept_code === d.dept_code).map(p => (
                    <div key={p.project_code} className="ms-4 mt-2 border-start ps-3 py-1">
                      <div className="fw-semibold small text-dark-emphasis">
                        <i className="fas fa-folder me-2 text-warning"></i>
                        {p.wbs} · {p.name}
                      </div>
                      {activities.filter(a => a.project_code === p.project_code).map(a => (
                        <div key={a.activity_code} className="ms-3 mt-1.5 small text-muted">
                          <i className="fas fa-file-invoice text-success me-2"></i>
                          {a.wbs} · {a.name} <span className="badge bg-light text-muted ms-1">{a.cost_type_tag}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── BUDGET LINES ──────────────────────────────────────────────────────────────
function LinesPage({ ctx }) {
  const { activities, setActivities, projects, employees, costTypes, statuses, fmt, showToast } = ctx;
  const [filter, setFilter] = useState({ dept: "", project: "", cost_type: "", status: "", search: "" });
  const [editId, setEditId] = useState(null);
  const [editVals, setEditVals] = useState({});

  // Filter calculations
  const filteredLines = useMemo(() => {
    return activities.filter(a => {
      const proj = projects.find(p => p.project_code === a.project_code);
      if (filter.dept && proj?.dept_code !== filter.dept) return false;
      if (filter.project && a.project_code !== filter.project) return false;
      if (filter.cost_type && a.cost_type_tag !== filter.cost_type) return false;
      if (filter.status && a.status_code !== filter.status) return false;
      if (filter.search && !a.name.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    });
  }, [activities, projects, filter]);

  const saveEdit = (code) => {
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    axios.patch(`/api/budget/activities/${code}`, {
      allocated: Number(editVals.allocated),
      pr: Number(editVals.pr),
      po: Number(editVals.po),
      invoiced: Number(editVals.invoiced),
      status_code: editVals.status_code,
    }, { headers })
      .then(res => {
        ctx.fetchData();
        setEditId(null);
        showToast("Budget line adjustments successfully saved.");
      })
      .catch(err => showToast(err.response?.data?.detail || "Action failed", false));
  };

  const deleteLine = (code) => {
    if (!confirm("Are you sure you want to delete this activity node from WBS?")) return;
    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    axios.delete(`/api/budget/activities/${code}`, { headers })
      .then(res => {
        ctx.fetchData();
        showToast("Activity deleted.");
      })
      .catch(err => showToast(err.response?.data?.detail || "Action failed", false));
  };

  return (
    <div>
      <div className="card border-0 shadow-sm p-3 rounded-4 mb-4 bg-white d-flex flex-wrap gap-2 flex-row align-items-center">
        <input type="text" className="form-control form-control-sm border-light-subtle flex-grow-1" placeholder="Search activities..." value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} style={{ minWidth: "150px" }} />
        <select className="form-select form-select-sm border-light-subtle" value={filter.dept} onChange={e => setFilter(f => ({ ...f, dept: e.target.value, project: "" }))} style={{ width: "160px" }}>
          <option value="">All Departments</option>
          {ctx.departments.map(d => <option key={d.dept_code} value={d.dept_code}>{d.name}</option>)}
        </select>
        <select className="form-select form-select-sm border-light-subtle" value={filter.project} onChange={e => setFilter(f => ({ ...f, project: e.target.value }))} style={{ width: "160px" }}>
          <option value="">All Projects</option>
          {projects.filter(p => !filter.dept || p.dept_code === filter.dept).map(p => <option key={p.project_code} value={p.project_code}>{p.name}</option>)}
        </select>
        <select className="form-select form-select-sm border-light-subtle" value={filter.cost_type} onChange={e => setFilter(f => ({ ...f, cost_type: e.target.value }))} style={{ width: "130px" }}>
          <option value="">All Cost Types</option>
          <option value="Opex">Opex</option>
          <option value="Capex">Capex</option>
        </select>
        <button className="btn btn-sm btn-outline-secondary px-3" onClick={() => setFilter({ dept: "", project: "", cost_type: "", status: "", search: "" })}>Clear</button>
      </div>

      <div className="table-responsive rounded-4 border bg-white">
        <table className="table table-hover align-middle mb-0" style={{ fontSize: "13px" }}>
          <thead className="table-light">
            <tr>
              <th className="px-3 py-3">WBS</th>
              <th className="py-3">Activity</th>
              <th className="py-3">Owner</th>
              <th className="py-3">Type</th>
              <th className="text-end py-3">Allocated</th>
              <th className="text-end py-3">PR</th>
              <th className="text-end py-3">PO</th>
              <th className="text-end py-3">Consumed</th>
              <th className="text-end py-3">Remaining</th>
              <th className="py-3">Status</th>
              <th className="text-center py-3" style={{ width: "120px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.map(l => {
              const emp = employees.find(e => e.employee_code === l.employee_code);
              const rem = l.allocated - l.invoiced;
              const isEdit = editId === l.activity_code;

              return (
                <tr key={l.activity_code}>
                  <td className="px-3 py-2.5 font-monospace text-muted small">{l.wbs}</td>
                  <td className="py-2.5 fw-bold">{l.name}</td>
                  <td className="py-2.5 small text-muted">{emp ? emp.name : "—"}</td>
                  <td className="py-2.5">
                    <span className={`badge px-2 py-1 ${l.cost_type_tag === "Capex" ? "bg-info-subtle text-info-emphasis" : "bg-success-subtle text-success-emphasis"}`} style={{ fontSize: "11px" }}>
                      {l.cost_type_tag}
                    </span>
                  </td>
                  {isEdit ? (
                    <>
                      <td className="text-end py-1.5"><input type="number" className="form-control form-control-sm text-end" value={editVals.allocated} onChange={e => setEditVals(v => ({ ...v, allocated: e.target.value }))} style={{ width: "90px", display: "inline-block" }} /></td>
                      <td className="text-end py-1.5"><input type="number" className="form-control form-control-sm text-end" value={editVals.pr} onChange={e => setEditVals(v => ({ ...v, pr: e.target.value }))} style={{ width: "90px", display: "inline-block" }} /></td>
                      <td className="text-end py-1.5"><input type="number" className="form-control form-control-sm text-end" value={editVals.po} onChange={e => setEditVals(v => ({ ...v, po: e.target.value }))} style={{ width: "90px", display: "inline-block" }} /></td>
                      <td className="text-end py-1.5"><input type="number" className="form-control form-control-sm text-end" value={editVals.invoiced} onChange={e => setEditVals(v => ({ ...v, invoiced: e.target.value }))} style={{ width: "90px", display: "inline-block" }} /></td>
                      <td className="text-end py-2.5 font-monospace text-muted">—</td>
                      <td className="py-1.5">
                        <select className="form-select form-select-sm" value={editVals.status_code} onChange={e => setEditVals(v => ({ ...v, status_code: e.target.value }))} style={{ width: "110px" }}>
                          {statuses.map(s => <option key={s.status_code} value={s.status_code}>{s.name}</option>)}
                        </select>
                      </td>
                      <td className="text-center py-1.5">
                        <button className="btn btn-sm btn-success me-1 px-2.5 py-1 fw-bold" onClick={() => saveEdit(l.activity_code)}>Save</button>
                        <button className="btn btn-sm btn-outline-secondary px-2 py-1" onClick={() => setEditId(null)}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="text-end py-2.5 font-monospace fw-semibold">{fmt(l.allocated)}</td>
                      <td className="text-end py-2.5 font-monospace text-info">{fmt(l.pr)}</td>
                      <td className="text-end py-2.5 font-monospace text-success">{fmt(l.po)}</td>
                      <td className="text-end py-2.5 font-monospace text-success fw-semibold">{fmt(l.invoiced)}</td>
                      <td className={`text-end py-2.5 font-monospace fw-medium ${rem < 0 ? "text-danger" : "text-primary"}`}>{fmt(rem)}</td>
                      <td className="py-2.5"><span className="badge bg-light text-dark border px-2.5 py-1">{l.status_name}</span></td>
                      <td className="text-center py-2.5">
                        <button className="btn btn-sm btn-outline-success me-1 py-1 px-2.5 fw-bold" onClick={() => { setEditId(l.activity_code); setEditVals({ allocated: l.allocated, pr: l.pr, po: l.po, invoiced: l.invoiced, status_code: l.status_code }); }}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger py-1 px-2" onClick={() => deleteLine(l.activity_code)}><i className="fas fa-trash-alt"></i></button>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── EXCEL UPLOAD ──────────────────────────────────────────────────────────────
function UploadPage({ ctx }) {
  const { uploads, setUploads, showToast, departments } = ctx;
  const [file, setFile] = useState(null);
  const [deptCode, setDeptCode] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const downloadTemplate = () => {
    const token = localStorage.getItem('auth_token');
    axios.get('/api/budget/budget-template', {
      headers: { 'Authorization': `Bearer ${token}` },
      responseType: 'blob'
    }).then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Budget_Upload_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast("Template downloaded successfully!");
    }).catch(err => {
      showToast("Failed to download template", false);
    });
  };

  const handleUpload = () => {
    if (!file) return showToast("Select an Excel file before triggering upload", false);
    if (!deptCode) return showToast("Select a target department", false);
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("fiscal_year", FY);
    formData.append("dept_code", deptCode);
    formData.append("requested_by", "EMP-001");

    const token = localStorage.getItem('auth_token');
    const headers = { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    };
    axios.post('/api/budget/budget-upload', formData, { headers })
      .then(res => {
        ctx.fetchData();
        setFile(null);
        setDeptCode("");
        if (fileRef.current) fileRef.current.value = "";
        setUploading(false);
        showToast("Excel spreadsheet imported successfully! Pending approval.");
      })
      .catch(err => {
        setUploading(false);
        showToast(err.response?.data?.detail || "Upload failed", false);
      });
  };

  const handleDecide = (id, approve) => {
    const token = localStorage.getItem('auth_token');
    axios.patch(`/api/budget/budget-uploads/${id}/decide`, { approve, decided_by: "EMP-001" }, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(res => {
        ctx.fetchData();
        showToast(approve ? "Upload approved!" : "Upload rejected.", approve);
      })
      .catch(err => showToast(err.response?.data?.detail || "Action failed", false));
  };

  const filteredUploads = filterDept ? uploads.filter(u => u.dept_code === filterDept) : uploads;

  return (
    <div className="row g-4">
      <div className="col-lg-5 col-md-12">
        <div className="card border-0 shadow-sm p-4 rounded-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="fw-bold mb-0 text-success">Upload Budget Plan</h6>
            <button className="btn btn-sm btn-outline-success fw-semibold" onClick={downloadTemplate}>
              <i className="fas fa-download me-1"></i> Template
            </button>
          </div>
          <div className="mb-3">
            <label className="form-label small text-muted fw-semibold">Target Department</label>
            <select className="form-select border-light-subtle" value={deptCode} onChange={e => setDeptCode(e.target.value)}>
              <option value="">Select Department...</option>
              {departments.map(d => <option key={d.dept_code} value={d.dept_code}>{d.name}</option>)}
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label small text-muted fw-semibold">Select Excel Spreadsheet (.xlsx)</label>
            <input type="file" ref={fileRef} accept=".xlsx,.xls" className="form-control border-light-subtle" onChange={e => setFile(e.target.files[0] || null)} />
          </div>
          <button className="btn btn-success w-100 fw-bold py-2 mt-3" onClick={handleUpload} disabled={uploading}>
            {uploading ? <div className="spinner-border spinner-border-sm me-2 text-white"></div> : <i className="fas fa-file-upload me-2"></i>}
            Import Excel Plan
          </button>
          <div className="mt-4 p-3 bg-light rounded-3 small text-muted">
            <div className="fw-bold text-dark mb-1">Required Schema Columns:</div>
            <code className="text-danger">project_code, activity_name, wbs, allocated</code>
            <div className="mt-2">Values will merge on matching WBS paths.</div>
          </div>
        </div>
      </div>

      <div className="col-lg-7 col-md-12">
        <div className="card border-0 shadow-sm rounded-4 h-100">
          <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
            <h6 className="fw-bold mb-0">Upload History Log</h6>
            <select className="form-select form-select-sm w-auto" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.dept_code} value={d.dept_code}>{d.name}</option>)}
            </select>
          </div>
          <div className="card-body p-0 overflow-y-auto" style={{ maxHeight: "450px" }}>
            {filteredUploads.length === 0 ? (
              <div className="text-center py-5 text-muted small">No spreadsheets uploaded yet.</div>
            ) : (
              <div className="list-group list-group-flush">
                {filteredUploads.map(u => (
                  <div key={u.id} className="list-group-item p-4">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h6 className="fw-bold text-success-emphasis mb-0">{u.filename}</h6>
                        <span className="small text-muted">{u.id} · {u.fiscal_year} · {departments.find(d => d.dept_code === u.dept_code)?.name || u.dept_code}</span>
                      </div>
                      <div className="text-end">
                        <span className="small text-muted font-monospace d-block">{new Date(u.uploaded_at).toLocaleDateString()}</span>
                        <span className={`badge ${u.status === 'Approved' ? 'bg-success' : u.status === 'Rejected' ? 'bg-danger' : 'bg-warning text-dark'} mt-1`}>{u.status}</span>
                      </div>
                    </div>
                    <div className="d-flex gap-2 mb-2 mt-2">
                      <span className="badge bg-success bg-opacity-10 text-success small">{u.rows_inserted} Inserted</span>
                      <span className="badge bg-info bg-opacity-10 text-info small">{u.rows_updated} Updated</span>
                      {u.rows_skipped > 0 && <span className="badge bg-danger bg-opacity-10 text-danger small">{u.rows_skipped} Skipped</span>}
                    </div>
                    {u.notes && <div className="small text-muted mt-2 font-monospace">{u.notes}</div>}
                    
                    {u.status === "Pending" && (
                      <div className="d-flex gap-2 mt-3 pt-3 border-top border-light">
                        <button className="btn btn-sm btn-success fw-semibold px-3" onClick={() => handleDecide(u.id, true)}>Approve & Merge</button>
                        <button className="btn btn-sm btn-outline-danger fw-semibold px-3" onClick={() => handleDecide(u.id, false)}>Reject</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EMPLOYEES ─────────────────────────────────────────────────────────────────
function EmployeesPage({ ctx }) {
  const { employees, setEmployees, departments, showToast } = ctx;
  const [form, setForm] = useState({ name: "", title: "", email: "", dept_code: "", manager_code: "" });

  const addEmployee = () => {
    if (!form.name.trim() || !form.title.trim()) return showToast("Name and Title are required", false);
    const token = localStorage.getItem('auth_token');
    const adminEmail = localStorage.getItem('user_email') || localStorage.getItem('email') || "siddarthpatil17@gmail.com";
    const headers = { 'Authorization': `Bearer ${token}` };
    axios.post('/api/budget/employees', {
      name: form.name.trim(),
      title: form.title.trim(),
      email: form.email.trim(),
      admin_email: adminEmail,
      dept_code: form.dept_code || null,
      manager_code: form.manager_code || null
    }, { headers })
      .then(res => {
        ctx.fetchData();
        setForm({ name: "", title: "", email: "", dept_code: "", manager_code: "" });
        showToast("Employee successfully added to team registry.");
      })
      .catch(err => showToast(err.response?.data?.detail || "Action failed", false));
  };

  // Render reporting line recursively
  const buildTree = (list, managerCode = null, depth = 0) =>
    list.filter(e => e.manager_code === managerCode).map(e => ({ ...e, depth, children: buildTree(list, e.employee_code, depth + 1) }));

  const tree = useMemo(() => buildTree(employees), [employees]);

  const renderTree = nodes => nodes.map(e => (
    <div key={e.employee_code} style={{ marginLeft: `${e.depth * 15}px`, marginBottom: "8px" }}>
      <div className="card border-0 bg-white p-3 shadow-sm rounded-3 d-flex flex-row align-items-center gap-3">
        <div className="rounded-circle bg-success bg-opacity-10 text-success fw-bold d-flex align-items-center justify-content-center" style={{ width: "36px", height: "36px", flexShrink: 0 }}>
          {e.name.charAt(0)}
        </div>
        <div className="flex-grow-1">
          <div className="fw-bold text-dark small">{e.name} {e.email && <span className="fw-normal text-muted">({e.email})</span>}</div>
          <div className="text-muted small fs-11">{e.title} · {departments.find(d => d.dept_code === e.dept_code)?.name || "External"}</div>
        </div>
        <div className="font-monospace text-muted small" style={{ fontSize: "11px" }}>{e.employee_code}</div>
      </div>
      {e.children?.length > 0 && (
        <div className="mt-2 border-start ps-3" style={{ borderColor: "#e5e7eb" }}>
          {renderTree(e.children)}
        </div>
      )}
    </div>
  ));

  return (
    <div className="row g-4">
      <div className="col-lg-5 col-md-12">
        <div className="card border-0 shadow-sm p-4 rounded-4">
          <h6 className="fw-bold mb-3 text-success">Register Employee</h6>
          <div className="mb-3">
            <label className="form-label small text-muted fw-semibold">Full Name *</label>
            <input type="text" className="form-control border-light-subtle" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Sambit Mohanty" />
          </div>
          <div className="mb-3">
            <label className="form-label small text-muted fw-semibold">Employee Email</label>
            <input type="email" className="form-control border-light-subtle" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="e.g. sambit@company.com" />
          </div>
          <div className="mb-3">
            <label className="form-label small text-muted fw-semibold">Designation Title *</label>
            <input type="text" className="form-control border-light-subtle" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Senior VP Finances" />
          </div>
          <div className="mb-3">
            <label className="form-label small text-muted fw-semibold">Department</label>
            <select className="form-select border-light-subtle" value={form.dept_code} onChange={e => setForm(f => ({ ...f, dept_code: e.target.value }))}>
              <option value="">— Select Department —</option>
              {departments.map(d => <option key={d.dept_code} value={d.dept_code}>{d.name}</option>)}
            </select>
          </div>
          <div className="mb-3">
            <label className="form-label small text-muted fw-semibold">Reports To</label>
            <select className="form-select border-light-subtle" value={form.manager_code} onChange={e => setForm(f => ({ ...f, manager_code: e.target.value || null }))}>
              <option value="">— Top of Hierarchy —</option>
              {employees.map(e => <option key={e.employee_code} value={e.employee_code}>{e.name}</option>)}
            </select>
          </div>
          <button className="btn btn-success btn-sm w-100 fw-bold py-2 mt-2" onClick={addEmployee}>Add Team Member</button>
        </div>
      </div>

      <div className="col-lg-7 col-md-12">
        <div className="card border-0 shadow-sm rounded-4 h-100 bg-light bg-opacity-25">
          <div className="card-header bg-white border-bottom py-3">
            <h6 className="fw-bold mb-0">Reporting Hierarchy Team Map</h6>
          </div>
          <div className="card-body p-4 overflow-y-auto" style={{ maxHeight: "460px" }}>
            {renderTree(tree)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CHANGE-REQUEST MODAL ──────────────────────────────────────────────────────
function CRModal({ ctx }) {
  const { activities, changeRequests, setChangeRequests, setCrModal, crModal, showToast } = ctx;
  if (!crModal) return null;
  const { type, form } = crModal;

  const upd = patch => setCrModal(m => ({ ...m, form: { ...m.form, ...patch } }));

  const actA = activities.find(a => a.activity_code === form.aCode);
  const actB = activities.find(a => a.activity_code === form.bCode);

  const allocA = actA ? getPhaseArr(actA.phases, "alloc") : Array(12).fill(0);
  const consA = actA ? getPhaseArr(actA.phases, "cons") : Array(12).fill(0);
  const freeM = actA ? allocA[Number(form.mFrom)] - consA[Number(form.mFrom)] : 0;

  const validate = () => {
    const amt = Number(form.amount) || 0;
    if (!actA) return "Pick an activity node.";
    if (!(amt > 0)) return "Enter a valid amount.";
    const mF = Number(form.mFrom);
    const mT = Number(form.mTo);

    if (type === "transfer") {
      if (!actB || actB.activity_code === actA.activity_code) return "Pick a target activity different from source.";
      if (amt > freeM) return `Maximum transferable from ${MONTHS[mF]} is ${fmtK(freeM)}.`;
      return "";
    }
    if (mF === mT) return "Months must differ.";
    if (type === "carry") {
      if (mF >= CUR_PERIOD) return "Carry forward only applies to closed periods.";
      if (mT < CUR_PERIOD) return "Target month must be current/open period or later.";
      const unutil = allocA[mF] - consA[mF];
      if (amt > unutil) return `Maximum carry available from ${MONTHS[mF]} is ${fmtK(unutil)}.`;
      return "";
    }
    if (type === "pull") {
      if (mF <= CUR_PERIOD) return "Pull source must be a future/planned month.";
      if (mT > CUR_PERIOD) return "Pull destination must be current or past open period.";
      if (amt > freeM) return `Maximum pull available from ${MONTHS[mF]} is ${fmtK(freeM)}.`;
      return "";
    }
    if (amt > freeM) return `${MONTHS[mF]} has only ${fmtK(freeM)} available.`;
    return "";
  };

  const err = validate();

  const submit = () => {
    const e = validate();
    if (e) return showToast(e, false);

    const payload = {
      request_type: type,
      a_code: form.aCode,
      b_code: type === "transfer" ? form.bCode : null,
      period_from: Number(form.mFrom) + 1,
      period_to: Number(form.mTo) + 1,
      amount: Number(form.amount),
      reason: form.reason || "Governed adjustment",
      requested_by: "EMP-001"
    };

    const token = localStorage.getItem('auth_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    axios.post('/api/budget/change-requests', payload, { headers })
      .then(res => {
        ctx.fetchData();
        setCrModal(null);
        showToast(`Change request CR-${String(res.data.id).padStart(3, "0")} raised successfully.`);
      })
      .catch(err => {
        showToast(err.response?.data?.detail || "Action failed", false);
      });
  };

  const monthOpts = (filter) => MONTHS.map((m, i) => ({ i, m })).filter(filter).map(({ i, m }) => (
    <option key={i} value={i}>{m} {i < CUR_PERIOD ? " (Closed)" : i === CUR_PERIOD ? " (Current)" : ""}</option>
  ));

  const def = CR_TYPES[type];
  const amt = Number(form.amount) || 0;
  const beforeA = actA ? allocA[Number(form.mFrom)] : 0;
  const beforeB = actB ? getPhaseArr(actB.phases, "alloc")[Number(form.mFrom)] : 0;

  return (
    <div className="custom-modal-overlay" style={{ zIndex: 1060 }}>
      <div className="custom-modal-content rounded-4" style={{ maxWidth: "560px" }}>
        <div className="custom-modal-header bg-light py-3 px-4 border-bottom">
          <h6 className="custom-modal-title fw-bold text-dark d-flex align-items-center gap-2 mb-0">
            <i className={def?.icon || "fas fa-sync"}></i>
            {def?.title}
          </h6>
          <button className="custom-modal-close-btn" onClick={() => setCrModal(null)}>&times;</button>
        </div>

        <div className="custom-modal-body p-4">
          <p className="text-muted small mb-4">{def?.blurb}</p>

          {type === "transfer" ? (
            <div className="row g-2 mb-3">
              <div className="col-6">
                <label className="form-label small text-muted fw-semibold">Source Activity Node</label>
                <select className="form-select border-light-subtle" value={form.aCode} onChange={e => upd({ aCode: e.target.value })}>
                  {activities.map(a => <option key={a.activity_code} value={a.activity_code}>{a.name}</option>)}
                </select>
              </div>
              <div className="col-6">
                <label className="form-label small text-muted fw-semibold">Target Activity Node</label>
                <select className="form-select border-light-subtle" value={form.bCode} onChange={e => upd({ bCode: e.target.value })}>
                  {activities.filter(a => a.activity_code !== form.aCode).map(a => <option key={a.activity_code} value={a.activity_code}>{a.name}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="mb-3">
              <label className="form-label small text-muted fw-semibold">WBS Activity Node</label>
              <select className="form-select border-light-subtle" value={form.aCode} onChange={e => upd({ aCode: e.target.value })}>
                {activities.map(a => <option key={a.activity_code} value={a.activity_code}>{a.name}</option>)}
              </select>
            </div>
          )}

          <div className="row g-2 mb-3">
            <div className="col-6">
              <label className="form-label small text-muted fw-semibold">
                {type === "carry" ? "From Closed Month" : type === "pull" ? "From Future Month" : "Source Month"}
              </label>
              <select className="form-select border-light-subtle" value={form.mFrom} onChange={e => upd({ mFrom: Number(e.target.value) })}>
                {type === "carry" ? monthOpts(({ i }) => i < CUR_PERIOD) :
                 type === "pull" ? monthOpts(({ i }) => i > CUR_PERIOD) :
                 monthOpts(() => true)}
              </select>
              {actA && <div className="small text-muted mt-1">Available: <strong>{fmtK(freeM)}</strong></div>}
            </div>
            {type !== "transfer" && (
              <div className="col-6">
                <label className="form-label small text-muted fw-semibold">
                  {type === "pull" ? "Into Destination Month" : "Into Month"}
                </label>
                <select className="form-select border-light-subtle" value={form.mTo} onChange={e => upd({ mTo: Number(e.target.value) })}>
                  {type === "carry" ? monthOpts(({ i }) => i >= CUR_PERIOD) :
                   type === "pull" ? monthOpts(({ i }) => i <= CUR_PERIOD) :
                   monthOpts(() => true)}
                </select>
              </div>
            )}
          </div>

          <div className="mb-3">
            <label className="form-label small text-muted fw-semibold">Reallocation Amount (₹) *</label>
            <input type="number" className="form-control border-light-subtle" value={form.amount} onChange={e => upd({ amount: e.target.value })} placeholder="0" />
          </div>

          <div className="mb-3">
            <label className="form-label small text-muted fw-semibold">Justification Explanation *</label>
            <textarea className="form-control border-light-subtle" rows="2" style={{ resize: "none" }} value={form.reason} onChange={e => upd({ reason: e.target.value })} placeholder="Explain why this budget adjustment is necessary..." />
          </div>

          {amt > 0 && (
            <div className="p-3 bg-light rounded-3 border mb-3">
              <div className="small fw-bold text-uppercase text-muted mb-2">Simulated Result Summary</div>
              <div className="row g-2 text-center text-md-start">
                <div className="col-5">
                  <div className="small text-muted">{actA?.name} · {MONTHS[Number(form.mFrom)]}</div>
                  <div className="fw-bold font-monospace">{fmtK(beforeA)} → {fmtK(beforeA - amt)}</div>
                  <div className="text-danger small font-semibold">- {fmtK(amt)}</div>
                </div>
                <div className="col-2 d-flex align-items-center justify-content-center"><i className="fas fa-arrow-right text-muted"></i></div>
                <div className="col-5">
                  {type !== "transfer" ? (
                    <div>
                      <div className="small text-muted">{actA?.name} · {MONTHS[Number(form.mTo)]}</div>
                      <div className="fw-bold font-monospace">{fmtK(allocA[Number(form.mTo)])} → {fmtK(allocA[Number(form.mTo)] + amt)}</div>
                      <div className="text-success small font-semibold">+ {fmtK(amt)}</div>
                    </div>
                  ) : (
                    <div>
                      <div className="small text-muted">{actB?.name} · {MONTHS[Number(form.mFrom)]}</div>
                      <div className="fw-bold font-monospace">{fmtK(beforeB)} → {fmtK(beforeB + amt)}</div>
                      <div className="text-success small font-semibold">+ {fmtK(amt)}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {err && amt > 0 && (
            <div className="alert alert-danger py-2 mb-0 mt-3" role="alert" style={{ fontSize: "12px", borderRadius: "8px" }}>
              <i className="fas fa-exclamation-circle me-1.5"></i> {err}
            </div>
          )}
        </div>

        <div className="custom-modal-footer bg-light p-3 px-4 border-top d-flex justify-content-end gap-2">
          <button className="btn btn-outline-secondary btn-sm px-3" onClick={() => setCrModal(null)}>Cancel</button>
          <button className="btn btn-success btn-sm px-4 fw-bold" onClick={submit} disabled={!!err}>Submit Request</button>
        </div>
      </div>
    </div>
  );
}
