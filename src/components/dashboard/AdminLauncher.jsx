import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import AdminVendors from './AdminVendors';
import AdminProspects from './AdminProspects';
import AdminInvitations from './AdminInvitations';
import AdminUsers from './AdminUsers';
import AdminMasterData from './AdminMasterData';
import AdminWorkflows from './AdminWorkflows';
import AdminEmailTemplates from './AdminEmailTemplates';
import Questionnaire from './Questionnaire';
import BudgetApp from './BudgetApp';
import PurchaseRequisition from './PurchaseRequisition';
import Quotation from './Quotation';
import PurchaseOrder from './PurchaseOrder';
import ASN from './ASN';
import GateEntry from './GateEntry';
import MaterialReport from './MaterialReport';
import VendorPaymentReport from './VendorPaymentReport';
import VendorReturnsReport from './VendorReturnsReport';
import CreditNotesReport from './CreditNotesReport';
import './admin-launcher.css';

/* ============================================================
   NexD Support Portal — admin. Pixel-perfect port of the provided
   mockup's chrome (top rail, one-line nav, breadcrumb, tiles, section
   landing pages, stub-page design) — see admin-launcher.css for the
   full style port.

   Every leaf either mounts a real, working screen already built in
   this app, or shows the mockup's own "reserved — not defined yet"
   stub (no fake data, no simulated connect/save flows) when nothing
   real backs it. See MENU below for exactly which is which.
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
------------------------------------------------- */
const MENU = {
  budget: {
    name: 'Budget Maintenance', eyebrow: '01',
    desc: 'Allocations by cost centre, what is committed against them, and what remains.',
    real: () => <BudgetApp />,
  },
  master: {
    name: 'Master Data', eyebrow: '02',
    desc: 'The records everything else refers to — suppliers, parts and assemblies.',
    children: {
      vendors: { name: 'Vendors', desc: 'Suppliers, payment terms and contacts.', real: (onBack) => <AdminVendors onBack={onBack} /> },
      prospects: { name: 'Vendor Prospects', desc: 'Applicants still in onboarding review.', real: () => <AdminProspects /> },
      invitations: { name: 'Invitations', desc: 'Invite a new supplier to register.', real: () => <AdminInvitations /> },
      materials: { name: 'Materials', desc: 'Part master with cost, stock and lead time.', stub: true,
        table: 'material_master', endpoint: '/api/materials' },
      boms: { name: 'Bill of Materials', desc: 'Assemblies and their component lines, with rolled-up cost.', stub: true,
        table: 'bom_header / bom_lines', endpoint: '/api/boms' },
      orgdata: { name: 'Organisation Data', desc: 'Companies, departments, projects and activities behind the budget module.',
        real: () => <AdminMasterData /> },
    },
  },
  settings: {
    name: 'System Settings', eyebrow: '03',
    desc: 'How the portal identifies your company, who can sign in, and what it sends out.',
    children: {
      company: { name: 'Company Profile', desc: 'Legal entity, tax registration and registered address.', stub: true,
        table: 'company_profile', endpoint: '/api/company-profile' },
      users: { name: 'User Accounts', desc: 'People who can sign in, and their role.', real: () => <AdminUsers /> },
      directory: { name: 'Directory (SSO)', desc: "Sign in with the organisation's Google or Microsoft account.", stub: true,
        table: 'sso_directory_config', endpoint: '/api/sso/directories' },
      workflows: { name: 'Workflow Templates', desc: 'Approval routes for requisitions, orders and invoices.',
        real: (_, onNavigate) => <AdminWorkflows subTab="wf_dashboard" onNavigate={onNavigate} /> },
      emails: { name: 'Email Templates', desc: 'Messages the portal sends to vendors and staff.', real: () => <AdminEmailTemplates /> },
      questionnaires: { name: 'Questionnaires', desc: 'Forms vendors fill in at onboarding and audit.', real: () => <Questionnaire /> },
      folderit: {
        name: 'FolderIT Integration', desc: 'The credentials FolderIt and Microvista document/KYC verification actually use — view and change them here.',
        real: () => <PlatformCredentialsPanel />,
      },
      slack: {
        name: 'Slack', desc: "Push portal events into your team's channels.",
        blurb: 'Portal events land in the channels your team already watches. Only a "Slack" label exists today, inside the workflow notification-channel picker — nothing behind it sends anything yet.',
        hub: true,
        children: {
          connection: { name: 'Connection', desc: 'Authorise the portal against a Slack workspace.', stub: true, table: 'integrations', endpoint: '/api/integrations/slack/connection' },
          credentials: { name: 'API Credentials', desc: 'Endpoint, authentication and token storage.', stub: true, table: 'integration_credentials', endpoint: '/api/integrations/slack/credentials' },
          channels: { name: 'Channel Routing', desc: 'Map each portal event to a channel.', stub: true, table: 'slack_channel_routes', endpoint: '/api/integrations/slack/channels' },
          events: { name: 'Event Subscriptions', desc: 'Pick which events post at all.', stub: true, table: 'slack_event_subs', endpoint: '/api/integrations/slack/events' },
          commands: { name: 'Slash Commands', desc: 'Which lookups staff can run from Slack.', stub: true, table: 'slack_commands', endpoint: '/api/integrations/slack/commands' },
          activity: { name: 'Activity Log', desc: 'Messages posted, delivery failures and command usage.', stub: true, table: 'integration_events', endpoint: '/api/integrations/slack/activity' },
        },
      },
    },
  },
  analytics: {
    name: 'Analytics', eyebrow: '04',
    desc: 'Registers across the procure-to-pay chain, from requisition through to reconciliation.',
    children: {
      'vendor-list': { name: 'Vendor List', desc: 'Every registered supplier with terms, category and compliance state.', real: (onBack) => <AdminVendors onBack={onBack} /> },
      'material-list': { name: 'Material List', desc: 'Materials with standard cost and usage.', real: (onBack) => <MaterialReport onBack={onBack} /> },
      'purchase-requisition': { name: 'Purchase Requisitions', desc: 'Requisitions raised and how long they waited.', real: (onBack) => <PurchaseRequisition mode="pr" onBack={onBack} /> },
      quotation: { name: 'Quotations', desc: 'Quotes received and which was accepted.', real: (onBack) => <Quotation onBack={onBack} onNavigate={() => {}} /> },
      'purchase-orders': { name: 'Purchase Orders', desc: 'Released orders and delivery position.', real: (onBack) => <PurchaseOrder onBack={onBack} /> },
      asn: { name: 'Advance Shipping Notices', desc: 'ASNs and how they reconciled.', real: (onBack) => <ASN onBack={onBack} /> },
      'gate-entry': { name: 'Gate Entry', desc: 'Vehicles logged at the plant gate against inbound shipments.', real: (onBack) => <GateEntry onBack={onBack} /> },
      'goods-receipt': { name: 'Goods Receipt', desc: 'What was received against what was ordered.', stub: true, table: 'goods_receipt_notes', endpoint: '/api/reports/goods-receipt' },
      invoice: { name: 'Invoices', desc: 'Invoices and their position in approval.', stub: true, table: 'invoices', endpoint: '/api/reports/invoices' },
      'vendor-payments': { name: 'Vendor Payments', desc: 'Payments released to suppliers.', real: (onBack) => <VendorPaymentReport onBack={onBack} /> },
      'vendor-returns': { name: 'Vendor Returns', desc: 'Material sent back to suppliers.', real: (onBack) => <VendorReturnsReport onBack={onBack} /> },
      'credit-note': { name: 'Credit Notes', desc: 'Credits raised against returns, rate differences and short supply.', real: (onBack) => <CreditNotesReport onBack={onBack} /> },
      'service-entry': { name: 'Service Entry', desc: 'Service sheets confirming work done against service orders.', stub: true, table: 'service_entry_sheets', endpoint: '/api/reports/service-entry' },
      subcontracting: { name: 'Sub-contracting Reconciliation', desc: 'Material issued to job workers against what came back.', stub: true, table: 'subcontracting_jobs', endpoint: '/api/reports/subcontracting' },
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
function Tile({ go, eyebrow, name, desc, foot, stub, big, onOpen }) {
  return (
    <button className={`tile ${stub ? 'stub' : ''}`} onClick={() => onOpen(go)}>
      <span className="go" aria-hidden="true">→</span>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      {big ? <h2>{name}</h2> : <h3>{name}</h3>}
      <p>{desc}</p>
      {foot && (
        <dl className="foot">
          {foot.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      )}
    </button>
  );
}

function Crumbs({ trail, onOpen }) {
  if (!trail.length) return null;
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {trail.map((c, i) => (
        <React.Fragment key={c.go ?? c.name}>
          {i === trail.length - 1
            ? <span className="now">{c.name}</span>
            : <><button onClick={() => onOpen(c.go)}>{c.name}</button><span aria-hidden="true">/</span></>}
        </React.Fragment>
      ))}
    </nav>
  );
}

/* The mockup's own honest "reserved — not defined yet" page for anything with no real screen. */
function StubPage({ node, path }) {
  return (
    <>
      <div className="hero" style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 21 }}>{node.name}</h1>
        <p>{node.desc}</p>
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
    </>
  );
}

function IntegrationHub({ node, path, onOpen }) {
  const kids = Object.entries(node.children);
  return (
    <>
      <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', padding: '18px 20px', marginBottom: 22 }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 14.5 }}>{node.name}</h3>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '5px 0 0', maxWidth: '66ch' }}>{node.blurb}</p>
        </div>
      </div>
      <div className="eyebrow-row"><h2>Configuration pages</h2></div>
      <div className="tiles compact">
        {kids.map(([key, p]) => (
          <Tile key={key} go={`${path}:${key}`} eyebrow="" name={p.name} desc={p.desc} stub onOpen={onOpen} />
        ))}
      </div>
    </>
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

function PlatformCredentialsPanel() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    axios.get('/api/admin/platform-credentials', { headers: authHeaders() })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.detail || 'Could not load credentials.'));
  };

  useEffect(load, []);

  const saveGroup = (group) => async (values) => {
    const payload = Object.fromEntries(Object.entries(values).map(([field, value]) => [`${group}.${field}`, value]));
    await axios.patch('/api/admin/platform-credentials', payload, { headers: authHeaders() });
    load();
  };

  if (error) return <div className="card"><div className="card-body"><p style={{ color: 'var(--iron)', fontSize: 13.5, margin: 0 }}>{error}</p></div></div>;
  if (!data) return <p style={{ color: 'var(--muted)', fontSize: 13 }}>Loading…</p>;

  const fieldsFor = (group) => Object.entries(data[group] || {}).map(([field, f]) => ({ key: field, label: f.label, value: f.value }));

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(360px,1fr))' }}>
      <CredentialGroupCard
        title="FolderIt"
        desc="Used to file vendor certificates and other documents during onboarding."
        fields={fieldsFor('folderit')}
        onSave={saveGroup('folderit')}
      />
      <CredentialGroupCard
        title="Microvista"
        desc="Used to verify PAN, GSTIN, CIN, Udyam/MSME and bank details during KYC."
        fields={fieldsFor('microvista')}
        onSave={saveGroup('microvista')}
      />
    </div>
  );
}

/* ============================================================
   Main component
   ============================================================ */
export default function AdminLauncher() {
  const { currentUser, logout } = useAuth();
  const [path, setPath] = useState('');

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
  const onNavigate = () => {}; // AdminWorkflows may ask to jump tabs internally; not part of this shell's routing

  if (!path) {
    /* home — 4 big tiles */
    content = (
      <>
        <div className="hero">
          <h1>Admin portal</h1>
          <p>Four areas run the portal. Pick one to go in.</p>
        </div>
        <div className="tiles four">
          {NAV.map(([key]) => {
            const n = MENU[key];
            return <Tile key={key} go={key} big eyebrow={n.eyebrow} name={n.name} desc={n.desc} onOpen={goTo} />;
          })}
        </div>
      </>
    );
  } else if (!node) {
    content = <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nothing here.</p>;
  } else if (node.real) {
    content = (
      <>
        <Crumbs trail={trail} onOpen={goTo} />
        <div className="hero" style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 21 }}>{node.name}</h1>
          <p>{node.desc}</p>
        </div>
        <div className="real-screen">{node.real(onBack, onNavigate)}</div>
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
        <div className="hero">
          <h1>{node.name}</h1>
          <p>{node.desc}</p>
        </div>
        <div className={`tiles ${top === 'analytics' ? 'compact' : ''}`}>
          {kids.map(([key, c], i) => (
            <Tile
              key={key}
              go={path ? `${path}:${key}` : key}
              eyebrow={String(i + 1).padStart(2, '0')}
              name={c.name}
              desc={c.desc}
              stub={!!(c.stub || c.hub)}
              onOpen={goTo}
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="nexdadmin">
      <header className="rail">
        <div className="wrap">
          <div className="rail-top">
            <button className="brand" onClick={() => goTo('')}>
              <b>NEXD</b><span>Support Portal</span>
            </button>
            <div className="who">
              <span className="fy">Admin</span>
              <span className="sep"></span>
              <span>{displayName}</span>
              <span className="av">{initials}</span>
              <button className="signout" onClick={logout}>Sign out</button>
            </div>
          </div>
          <nav className="nav" aria-label="Portal sections">
            {NAV.map(([key, label]) => (
              <button key={key} className="nav-item" aria-current={top === key} onClick={() => goTo(key)}>{label}</button>
            ))}
          </nav>
        </div>
      </header>
      <main>{content}</main>
    </div>
  );
}
