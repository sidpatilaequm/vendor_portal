import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import AdminVendors from './AdminVendors';
import AdminProspects from './AdminProspects';
import AdminInvitations from './AdminInvitations';
import AdminUsers from './AdminUsers';
import AdminAuditLog from './AdminAuditLog';
import AdminMasterData from './AdminMasterData';
import AdminEnterpriseStructure from './AdminEnterpriseStructure';
import AdminPurchaseRoles from './AdminPurchaseRoles';
import AdminWorkflows from './AdminWorkflows';
import AdminAnalytics from './AdminAnalytics';
import AdminEmailTemplates from './AdminEmailTemplates';
import Questionnaire from './Questionnaire';
import BudgetApp from './BudgetApp';
import PurchaseRequisition from './PurchaseRequisition';
import Quotation from './Quotation';
import PurchaseOrder from './PurchaseOrder';
import ASN from './ASN';
import GateEntry from './GateEntry';
import MaterialInward from './MaterialInward';
import MaterialReport from './MaterialReport';
import VendorPaymentReport from './VendorPaymentReport';
import VendorReturnsReport from './VendorReturnsReport';
import CreditNotesReport from './CreditNotesReport';
import './admin-launcher.css';

/* ============================================================
   NexD Support Portal — admin.

   Chrome (top nav, hero, tile grid, breadcrumb) now matches the same
   employee-portal look used everywhere else in this app (Header.jsx +
   DashboardHome.jsx's card grid): white top bar with the Ankit logo,
   and icon-circle Bootstrap cards with a colored "View Details"-style
   pill button, instead of the old bespoke dark-rail mockup chrome.

   Every leaf either mounts a real, working screen already built in
   this app, or shows an honest "reserved — not defined yet" stub (no
   fake data, no simulated connect/save flows) when nothing real backs
   it. See MENU below for exactly which is which.
   ============================================================ */

const TAGS = {
  active: 't-good', released: 't-good', open: 't-good', approved: 't-good', posted: 't-good',
  paid: 't-good', received: 't-good', cleared: 't-good', connected: 't-good', enabled: 't-good',
  pending: 't-warn', draft: 't-warn', locked: 't-warn', on_hold: 't-warn', partial: 't-warn',
  submitted: 't-warn', overdue: 't-warn',
  blacklisted: 't-bad', obsolete: 't-bad', rejected: 't-bad', disputed: 't-bad', blocked: 't-bad',
  closed: 't-off', cancelled: 't-off', inactive: 't-off', 'not connected': 't-off', disabled: 't-off',
};
const Tag = ({ v }) => <span className={`tag ${TAGS[String(v).toLowerCase()] || 't-off'}`}>{String(v).replace(/_/g, ' ')}</span>;

/* ---------------- menu ----------------
   `real`: a function returning the JSX for that leaf's actual screen.
   `stub`: true when nothing real backs it yet — renders the mockup's
   own reserved-page design instead of fabricating a working screen.
   `icon`/`color`: FontAwesome icon suffix + Bootstrap color keyword,
   same vocabulary DashboardHome.jsx's employee card grid uses — kept
   in sync with it by name where the two overlap (Vendor List, Material
   List, Purchase Requisition, ...) so the same concept always gets the
   same icon/color everywhere in the app.
------------------------------------------------- */
const MENU = {
  budget: {
    name: 'Budget Maintenance', eyebrow: '01', icon: 'fa-wallet', color: 'primary',
    desc: 'Allocations by cost centre, what is committed against them, and what remains.',
    real: () => <BudgetApp />,
  },
  master: {
    name: 'Master Data', eyebrow: '02', icon: 'fa-database', color: 'success',
    desc: 'The records everything else refers to — suppliers, parts and assemblies.',
    children: {
      vendors: { name: 'Vendors', icon: 'fa-users', color: 'success', desc: 'Suppliers, payment terms and contacts.', ownChrome: true, real: (onBack) => <AdminVendors onBack={onBack} /> },
      // approvedSuppliers: { name: 'Approved Suppliers', icon: 'fa-user-check', color: 'success', desc: 'Vendors approved through Become-a-Supplier, with their Product/Service/Scheduling agreement/Sub-contracting type.', real: (onBack) => <AdminApprovedSuppliers onBack={onBack} /> },
      prospects: { name: 'Vendor Prospects', icon: 'fa-user-clock', color: 'warning', desc: 'Applicants still in onboarding review.', real: () => <AdminProspects /> },
      invitations: { name: 'Invitations', icon: 'fa-envelope-open-text', color: 'primary', desc: 'Invite a new supplier to register.', real: () => <AdminInvitations /> },
      materials: { name: 'Materials', icon: 'fa-box', color: 'primary', desc: 'Part master with cost, stock and lead time.', stub: true,
        table: 'material_master', endpoint: '/api/materials' },
      orgdata: { name: 'Organisation Data', icon: 'fa-building', color: 'secondary', desc: 'Companies, departments, projects and activities behind the budget module.',
        real: () => <AdminMasterData /> },
      enterpriseStructure: { name: 'Enterprise Structure', icon: 'fa-industry', color: 'success', desc: 'Company, plant and purchasing organisation/group master data.',
        real: () => <AdminEnterpriseStructure /> },
      purchaseRoles: { name: 'Purchasing Roles', icon: 'fa-user-shield', color: 'warning', desc: 'Which document types a vendor or employee role can act on, per company code.',
        ownChrome: true, real: (onBack) => <AdminPurchaseRoles onBack={onBack} /> },
    },
  },
  settings: {
    name: 'System Settings', eyebrow: '03', icon: 'fa-cog', color: 'secondary',
    desc: 'How the portal identifies your company, who can sign in, and what it sends out.',
    children: {
      company: { name: 'Company Profile', icon: 'fa-id-card', color: 'secondary', desc: 'Legal entity, tax registration and registered address.', stub: true,
        table: 'company_profile', endpoint: '/api/company-profile' },
      users: { name: 'User Accounts', icon: 'fa-user-cog', color: 'primary', desc: 'People who can sign in, and their role.', real: () => <AdminUsers /> },
      auditLog: { name: 'Audit Log', icon: 'fa-clipboard-list', color: 'secondary', desc: 'Who changed what on employee and admin accounts.',
        real: () => <AdminAuditLog /> },
      directory: { name: 'Directory (SSO)', icon: 'fa-address-book', color: 'info', desc: 'Microsoft and Google sign-in are live for staff with an existing account.',
        real: () => <PlatformCredentialsPanel group={['azure', 'google']} /> },
      workflows: { name: 'Workflow Templates', icon: 'fa-project-diagram', color: 'primary', desc: 'Approval routes for requisitions, orders and invoices.',
        real: (_, subTab, onNavigate) => <AdminWorkflows subTab={subTab} onNavigate={onNavigate} /> },
      emails: { name: 'Email Templates', icon: 'fa-envelope', color: 'warning', desc: 'Messages the portal sends to vendors and staff.', real: () => <AdminEmailTemplates /> },
      questionnaires: { name: 'Questionnaires', icon: 'fa-list-alt', color: 'info', desc: 'Forms vendors fill in at onboarding and audit.', real: () => <Questionnaire /> },
      reportDesigner: {
        name: 'Report Designer', icon: 'fa-chart-pie', color: 'success', desc: 'Build custom reports against the live database — bind boxes to tables, add formulas, publish role-scoped links.',
        real: () => <AdminAnalytics />,
      },
      folderit: {
        name: 'FolderIT Integration', icon: 'fa-folder-open', color: 'warning', desc: 'The credentials FolderIt document storage actually uses — view and change them here.',
        real: () => <PlatformCredentialsPanel group="folderit" />,
      },
      microvista: {
        name: 'Microvista', icon: 'fa-shield-alt', color: 'success', desc: 'The credentials Microvista KYC verification actually uses — view and change them here.',
        real: () => <PlatformCredentialsPanel group="microvista" />,
      },
      slack: {
        name: 'Slack', icon: 'fa-hashtag', color: 'secondary',
        desc: "Push portal events into your team's channels.",
        blurb: 'Portal events land in the channels your team already watches. Only a "Slack" label exists today, inside the workflow notification-channel picker — nothing behind it sends anything yet.',
        hub: true,
        children: {
          connection: { name: 'Connection', icon: 'fa-plug', color: 'secondary', desc: 'Authorise the portal against a Slack workspace.', stub: true, table: 'integrations', endpoint: '/api/integrations/slack/connection' },
          credentials: { name: 'API Credentials', icon: 'fa-key', color: 'secondary', desc: 'Endpoint, authentication and token storage.', stub: true, table: 'integration_credentials', endpoint: '/api/integrations/slack/credentials' },
          channels: { name: 'Channel Routing', icon: 'fa-random', color: 'secondary', desc: 'Map each portal event to a channel.', stub: true, table: 'slack_channel_routes', endpoint: '/api/integrations/slack/channels' },
          events: { name: 'Event Subscriptions', icon: 'fa-bell', color: 'secondary', desc: 'Pick which events post at all.', stub: true, table: 'slack_event_subs', endpoint: '/api/integrations/slack/events' },
          commands: { name: 'Slash Commands', icon: 'fa-terminal', color: 'secondary', desc: 'Which lookups staff can run from Slack.', stub: true, table: 'slack_commands', endpoint: '/api/integrations/slack/commands' },
          activity: { name: 'Activity Log', icon: 'fa-history', color: 'secondary', desc: 'Messages posted, delivery failures and command usage.', stub: true, table: 'integration_events', endpoint: '/api/integrations/slack/activity' },
        },
      },
    },
  },
  analytics: {
    name: 'Analytics', eyebrow: '04', icon: 'fa-chart-line', color: 'info',
    desc: 'Registers across the procure-to-pay chain, from requisition through to reconciliation.',
    children: {
      'vendor-list': { name: 'Vendor List', icon: 'fa-users', color: 'success', desc: 'Every registered supplier with terms, category and compliance state.', ownChrome: true, real: (onBack) => <AdminVendors onBack={onBack} /> },
      'material-list': { name: 'Material List', icon: 'fa-box', color: 'primary', desc: 'Materials with standard cost and usage.', ownChrome: true, real: (onBack) => <MaterialReport onBack={onBack} /> },
      'purchase-requisition': { name: 'Purchase Requisitions', icon: 'fa-file-alt', color: 'primary', desc: 'Requisitions raised and how long they waited.', ownChrome: true, real: (onBack) => <PurchaseRequisition mode="pr" onBack={onBack} /> },
      quotation: { name: 'Quotations', icon: 'fa-comments-dollar', color: 'warning', desc: 'Quotes received and which was accepted.', ownChrome: true, real: (onBack) => <Quotation onBack={onBack} onNavigate={() => {}} /> },
      'purchase-orders': { name: 'Purchase Orders', icon: 'fa-shopping-cart', color: 'success', desc: 'Released orders and delivery position.', ownChrome: true, real: (onBack) => <PurchaseOrder onBack={onBack} /> },
      asn: { name: 'Advance Shipping Notices', icon: 'fa-truck', color: 'warning', desc: 'ASNs and how they reconciled.', ownChrome: true, real: (onBack) => <ASN onBack={onBack} /> },
      'gate-entry': { name: 'Gate Entry', icon: 'fa-door-open', color: 'info', desc: 'Vehicles logged at the plant gate against inbound shipments.', ownChrome: true, real: (onBack) => <GateEntry onBack={onBack} /> },
      'material-inward': { name: 'Material Inward', icon: 'fa-box-open', color: 'success', desc: 'Verify and receive incoming material against gate entries.', ownChrome: true, real: (onBack) => <MaterialInward onBack={onBack} /> },
      'goods-receipt': { name: 'Goods Receipt', icon: 'fa-dolly', color: 'info', desc: 'What was received against what was ordered.', stub: true, table: 'goods_receipt_notes', endpoint: '/api/reports/goods-receipt' },
      invoice: { name: 'Invoices', icon: 'fa-file-invoice-dollar', color: 'success', desc: 'Invoices and their position in approval.', stub: true, table: 'invoices', endpoint: '/api/reports/invoices' },
      'vendor-payments': { name: 'Vendor Payments', icon: 'fa-wallet', color: 'secondary', desc: 'Payments released to suppliers.', ownChrome: true, real: (onBack) => <VendorPaymentReport onBack={onBack} /> },
      'vendor-returns': { name: 'Vendor Returns', icon: 'fa-undo', color: 'danger', desc: 'Material sent back to suppliers.', ownChrome: true, real: (onBack) => <VendorReturnsReport onBack={onBack} /> },
      'credit-note': { name: 'Credit Notes', icon: 'fa-file-invoice', color: 'danger', desc: 'Credits raised against returns, rate differences and short supply.', ownChrome: true, real: (onBack) => <CreditNotesReport onBack={onBack} /> },
      'service-entry': { name: 'Service Entry', icon: 'fa-tools', color: 'info', desc: 'Service sheets confirming work done against service orders.', stub: true, table: 'service_entry_sheets', endpoint: '/api/reports/service-entry' },
      subcontracting: { name: 'Sub-contracting Reconciliation', icon: 'fa-people-carry', color: 'warning', desc: 'Material issued to job workers against what came back.', stub: true, table: 'subcontracting_jobs', endpoint: '/api/reports/subcontracting' },
    },
  },
};

const NAV = [
  ['budget', 'Budget Maintenance'],
  ['master', 'Master Data'],
  ['settings', 'System Settings'],
  ['analytics', 'Analytics'],
];

/* ---------------- small pieces ---------------- */

/* Icon-circle Bootstrap card, matching DashboardHome.jsx's employee dashboard cards exactly —
   same rounded-circle icon avatar, bold title, muted description, colored outline pill button. */
function Tile({ go, name, desc, stub, big, onOpen, href, icon = 'fa-circle', color = 'secondary' }) {
  const body = (
    <div className={`card h-100 shadow-sm border-0 ${stub ? 'border-top border-3 border-warning-subtle' : ''}`} style={{ borderRadius: 12 }}>
      <div className="card-body text-center p-4 d-flex flex-column align-items-center">
        <div className={`rounded-circle bg-light d-flex align-items-center justify-content-center mb-3 text-${color}`} style={{ width: big ? 68 : 60, height: big ? 68 : 60 }}>
          <i className={`fas ${icon} ${big ? 'fs-3' : 'fs-4'}`}></i>
        </div>
        {big ? <h4 className="fw-bold mb-2 text-dark">{name}</h4> : <h5 className="fw-bold mb-2 text-dark">{name}</h5>}
        <p className="text-muted small mb-4">{desc}</p>
        {href ? (
          <span className={`btn btn-outline-${color} w-100 mt-auto rounded-pill fw-medium`} style={{ fontSize: 14 }}>
            Open <i className="fas fa-external-link-alt ms-1" style={{ fontSize: 11 }}></i>
          </span>
        ) : (
          <button
            className={`btn btn-outline-${color} w-100 mt-auto rounded-pill fw-medium`}
            style={{ fontSize: 14 }}
            onClick={() => onOpen(go)}
          >
            {stub ? 'View' : 'Open'} <i className="fas fa-arrow-right ms-1"></i>
          </button>
        )}
      </div>
    </div>
  );
  if (href) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="text-decoration-none d-block h-100">{body}</a>;
  }
  return body;
}

function Crumbs({ trail, onOpen }) {
  if (trail.length < 2) return null;
  return (
    <nav aria-label="breadcrumb" className="mb-2">
      <ol className="breadcrumb mb-0" style={{ fontSize: 13 }}>
        {trail.map((c, i) => (
          <li
            key={c.go ?? c.name}
            className={`breadcrumb-item ${i === trail.length - 1 ? 'active text-dark fw-semibold' : ''}`}
            aria-current={i === trail.length - 1 ? 'page' : undefined}
          >
            {i === trail.length - 1 ? (
              c.name
            ) : (
              <button type="button" className="btn btn-link btn-sm p-0 text-success text-decoration-none align-baseline" onClick={() => onOpen(c.go)}>
                {c.name}
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* The mockup's own honest "reserved — not defined yet" page for anything with no real screen. */
function StubPage({ node, path }) {
  return (
    <div className="cfg">
      <div className="hero" style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 21 }}>{node.name}</h1>
      </div>
      <section className="card">
        <h2 className="card-head">Not defined yet</h2>
        <div className="card-body">
          <p style={{ fontSize: 13.5, margin: '0 0 18px', maxWidth: '70ch' }}>
            This page is reserved. The route and breadcrumb exist so the screen can be dropped in without
            touching navigation. What is missing is the backend behind it.
          </p>
          <div className="form-grid" style={{ display: 'grid', gap: 15, gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))' }}>
            <div className="stub-route"><span className="code" style={{ color: 'var(--muted)' }}>Route</span><div>{path}</div></div>
            {node.table && <div className="stub-route"><span className="code" style={{ color: 'var(--muted)' }}>Would need</span><div>{node.table}</div></div>}
            {node.endpoint && <div className="stub-route"><span className="code" style={{ color: 'var(--muted)' }}>API endpoint</span><div>{node.endpoint}</div></div>}
          </div>
        </div>
      </section>
    </div>
  );
}

function IntegrationHub({ node, path, onOpen }) {
  const kids = Object.entries(node.children);
  return (
    <div className="cfg">
      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '18px 20px', marginBottom: 22 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 14.5 }}>{node.name}</h3>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '5px 0 0', maxWidth: '66ch' }}>{node.blurb}</p>
        </div>
      </div>
      <div className="eyebrow-row"><h2>Configuration pages</h2></div>
      <div className="row g-3">
        {kids.map(([key, p]) => (
          <div key={key} className="col-12 col-sm-6 col-lg-4">
            <Tile go={`${path}:${key}`} name={p.name} desc={p.desc} icon={p.icon} color={p.color} stub onOpen={onOpen} />
          </div>
        ))}
      </div>
    </div>
  );
}

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('auth_token')}` });

/* One editable box per external service (FolderIt, Microvista) — shows the credentials the
   backend is actually using right now (PlatformCredentialService, replacing what used to be a
   hardcoded constant / env var read once at boot) and saves changes straight back to it. */
function CredentialGroupCard({ title, desc, fields, onSave }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.key, f.value])));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setValues(Object.fromEntries(fields.map((f) => [f.key, f.value])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.map((f) => f.value).join('|')]);

  const save = async () => {
    setSaving(true);
    setStatus('');
    try {
      await onSave(values);
      setStatus('Saved.');
    } catch (err) {
      setStatus(err.response?.data?.detail || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <h2 className="card-head">{title}</h2>
      <div className="card-body">
        <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '0 0 14px' }}>{desc}</p>
        <div style={{ display: 'grid', gap: 14 }}>
          {fields.map((f) => (
            <label key={f.key} style={{ display: 'block' }}>
              <span style={{ display: 'block', fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 5 }}>
                {f.label}
              </span>
              <input
                className="field"
                style={{ width: '100%' }}
                value={values[f.key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <button className="btn" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
          {status && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{status}</span>}
        </div>
      </div>
    </section>
  );
}

const GROUP_META = {
  folderit: { title: 'FolderIt', desc: 'Used to file vendor certificates and other documents during onboarding.' },
  microvista: { title: 'Microvista', desc: 'Used to verify PAN, GSTIN, CIN, Udyam/MSME and bank details during KYC.' },
  azure: { title: 'Microsoft Entra ID', desc: "Tenant, client ID and secret for staff Microsoft sign-in. Redirect URI to register in Azure: this app's address + /api/auth/microsoft/callback." },
  google: { title: 'Google Workspace', desc: "Client ID, secret and (optional) Workspace domain for staff Google sign-in. Redirect URI to register in Google Cloud Console: this app's address + /api/auth/google/callback." },
};

// `group` is either a single key ("azure") or an array of keys (["azure", "google"]) — the
// Directory (SSO) page renders both providers' cards side by side on one page rather than each
// opening its own; every other caller still passes a single group and gets the original
// one-card behaviour.
function PlatformCredentialsPanel({ group }) {
  const groups = Array.isArray(group) ? group : [group];
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    axios.get('/api/admin/platform-credentials', { headers: authHeaders() })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load credentials.'));
  };

  useEffect(load, []);

  const saveGroup = (g) => async (values) => {
    const payload = Object.fromEntries(Object.entries(values).map(([field, value]) => [`${g}.${field}`, value]));
    await axios.patch('/api/admin/platform-credentials', payload, { headers: authHeaders() });
    load();
  };

  if (error) return <div className="cfg"><div className="card"><div className="card-body"><p style={{ color: 'var(--iron)', fontSize: 13.5, margin: 0 }}>{error}</p></div></div></div>;
  if (!data) return <div className="cfg"><p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p></div>;

  return (
    <div className="cfg">
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))' }}>
        {groups.map((g) => {
          const fields = Object.entries(data[g] || {}).map(([field, f]) => ({ key: field, label: f.label, value: f.value }));
          const meta = GROUP_META[g];
          return <CredentialGroupCard key={g} title={meta.title} desc={meta.desc} fields={fields} onSave={saveGroup(g)} />;
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Main component
   ============================================================ */
export default function AdminLauncher() {
  const { currentUser, logout } = useAuth();
  const [path, setPath] = useState('');
  // AdminWorkflows manages its own sub-tabs (Dashboard/Workflows/Requests/Groups/Analytics/...)
  // via a subTab prop + an onNavigate callback it calls on every internal tab click — this has
  // to be real state here, not a no-op, or clicking any tab inside it does nothing.
  const [wfSubTab, setWfSubTab] = useState('wf_dashboard');

  const goTo = (p) => {
    setPath(p);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && path) {
        e.preventDefault();
        const parts = path.split(':');
        goTo(parts.slice(0, -1).join(':'));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const user = currentUser || JSON.parse(localStorage.getItem('user_data') || '{}');
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Admin';
  const initials = displayName.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'AD';

  const parts = path ? path.split(':') : [];
  const top = parts[0];

  /* resolve current node + breadcrumb trail */
  let node = null;
  const trail = [{ name: 'Admin portal', go: '' }];
  if (top && MENU[top]) {
    node = MENU[top];
    trail.push({ name: node.name, go: top });
    let cursor = node;
    for (let i = 1; i < parts.length; i++) {
      const key = parts[i];
      const kids = cursor.children;
      if (!kids || !kids[key]) { node = null; break; }
      cursor = kids[key];
      node = cursor;
      trail.push({ name: cursor.name, go: parts.slice(0, i + 1).join(':') });
    }
  }

  let content;
  const onBack = () => goTo(parts.slice(0, -1).join(':'));

  if (!path) {
    /* home — 4 big tiles */
    content = (
      <>
        <div className="mb-4">
          <h1 className="fw-bold text-dark mb-1" style={{ fontSize: 26 }}>Admin portal</h1>
        </div>
        <div className="row g-4">
          {NAV.map(([key]) => {
            const n = MENU[key];
            return (
              <div key={key} className="col-12 col-md-6">
                <Tile go={key} big name={n.name} desc={n.desc} icon={n.icon} color={n.color} onOpen={goTo} />
              </div>
            );
          })}
        </div>
      </>
    );
  } else if (!node) {
    content = <p className="text-muted">Nothing here.</p>;
  } else if (node.real) {
    content = (
      <>
        <Crumbs trail={trail} onOpen={goTo} />
        {!node.ownChrome && (
          <div className="mb-3">
            <h1 className="fw-bold text-dark mb-1" style={{ fontSize: 21 }}>{node.name}</h1>
          </div>
        )}
        <div className="real-screen">{node.real(onBack, wfSubTab, setWfSubTab)}</div>
      </>
    );
  } else if (node.stub) {
    content = (
      <>
        <Crumbs trail={trail} onOpen={goTo} />
        <StubPage node={node} path={'#' + path} />
      </>
    );
  } else if (node.hub) {
    content = (
      <>
        <Crumbs trail={trail} onOpen={goTo} />
        <IntegrationHub node={node} path={path} onOpen={goTo} />
      </>
    );
  } else if (node.children) {
    /* section landing — tile grid of children */
    const kids = Object.entries(node.children);
    content = (
      <>
        <Crumbs trail={trail} onOpen={goTo} />
        <div className="mb-4">
          <h1 className="fw-bold text-dark mb-1" style={{ fontSize: 24 }}>{node.name}</h1>
        </div>
        <div className="row g-4">
          {kids.map(([key, c]) => (
            <div key={key} className="col-12 col-sm-6 col-lg-3">
              <Tile
                go={path ? `${path}:${key}` : key}
                name={c.name}
                desc={c.desc}
                icon={c.icon}
                color={c.color}
                stub={!!(c.stub || c.hub)}
                href={c.href}
                onOpen={goTo}
              />
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="nexdadmin">
      <nav className="navbar navbar-expand-lg navbar-light bg-white border-bottom sticky-top px-4 py-2" style={{ height: 70, zIndex: 1000 }}>
        <div className="container-fluid d-flex justify-content-between align-items-center">
          <button type="button" className="btn p-0 border-0 bg-transparent d-flex align-items-center" onClick={() => goTo('')}>
            <img src="/ankit-logo.png" alt="Ankit Group" style={{ height: 34, width: 'auto' }} />
          </button>
          <div className="d-flex align-items-center gap-3">
            <span className="d-none d-md-inline text-muted fw-semibold" style={{ fontSize: 13 }}>Admin Portal</span>
            <div className="d-flex align-items-center gap-2">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold"
                style={{ width: 34, height: 34, background: 'var(--oxide)', fontSize: 13 }}
              >
                {initials}
              </div>
              <span className="fw-semibold text-muted d-none d-sm-inline" style={{ fontSize: 14 }}>{displayName}</span>
            </div>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={logout}>Sign out</button>
          </div>
        </div>
      </nav>
      <main className="container-fluid py-4" style={{ maxWidth: 1400 }}>
        {path && !(node && node.ownChrome) && (
          <button type="button" className="btn btn-outline-secondary btn-sm mb-3" onClick={() => goTo(parts.slice(0, -1).join(':'))}>
            <i className="fas fa-arrow-left me-1"></i> Back
          </button>
        )}
        {content}
      </main>
    </div>
  );
}
