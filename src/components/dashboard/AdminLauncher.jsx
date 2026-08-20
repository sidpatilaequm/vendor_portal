import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import AdminVendors from './AdminVendors';
import AdminProspects from './AdminProspects';
import AdminInvitations from './AdminInvitations';
import AdminMasterData from './AdminMasterData';
import AdminUsers from './AdminUsers';
import AdminWorkflows from './AdminWorkflows';
import DashboardHome from './DashboardHome';
import PurchaseRequisition from './PurchaseRequisition';
import Quotation from './Quotation';
import PurchaseOrder from './PurchaseOrder';
import ASN from './ASN';
import BudgetApp from './BudgetApp';
import IndentDashboard from './IndentDashboard';
import Questionnaire from './Questionnaire';
import AdminEmailTemplates from './AdminEmailTemplates';
import './admin-launcher.css';

/* ============================================================
   Supplier Portal — Admin launcher.
   Pixel-perfect port of the provided mockup's tile-based module
   launcher, with the tile menu trimmed to only what this app
   actually has built (per explicit scope decision) — every leaf
   tile resolves to a real screen, or the same ComingSoonView the
   old sidebar used for features still in progress. No mockup-only
   modules (Budget audit trail, SSO, etc.) that don't exist here.
   ============================================================ */

/* ---------------- icons — one line-drawn glyph per concept, 24x24 ---------------- */
const S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const I = {
  grid:     S + '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></svg>',
  factory:  S + '<path d="M3.5 20.5V11l5 3.2V11l5 3.2V11l5 3.2v6.3z"/><path d="M18.5 11 18 3.5h-3l-.4 7"/></svg>',
  userPlus: S + '<circle cx="10" cy="8.5" r="3.5"/><path d="M3.5 19.5a6.5 6.5 0 0 1 13 0"/><path d="M19 8v5M16.5 10.5h5"/></svg>',
  cart:     S + '<path d="M3 4h2.2l2.3 10.5h9.6L19 7H6"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></svg>',
  clipboard:S + '<rect x="5" y="5" width="14" height="16" rx="1.5"/><path d="M9 5V3.5h6V5"/><path d="M9 11h6M9 15h4"/></svg>',
  tag:      S + '<path d="M3.5 11.2V4.5h6.7l9.3 9.3-6.7 6.7z"/><circle cx="7.5" cy="8.5" r="1.3"/></svg>',
  truck:    S + '<path d="M3 6.5h10v9H3z"/><path d="M13 9.5h4l3 3.2v2.8h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/></svg>',
  money:    S + '<rect x="3" y="6" width="18" height="12" rx="1.5"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 12h.01M17.5 12h.01"/></svg>',
  refresh:  S + '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4h-4"/></svg>',
  tree:     S + '<rect x="9" y="3.5" width="6" height="4.5" rx="1"/><rect x="3" y="16" width="6" height="4.5" rx="1"/><rect x="15" y="16" width="6" height="4.5" rx="1"/><path d="M12 8v4M6 16v-2h12v2"/></svg>',
  gauge:    S + '<path d="M4.5 17a8 8 0 1 1 15 0"/><path d="M12 17l3.5-4.5"/></svg>',
  flag:     S + '<path d="M6 21V4"/><path d="M6 4.5h11l-2 3.5 2 3.5H6"/></svg>',
  users:    S + '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 19a5.6 5.6 0 0 0-2-4"/></svg>',
  trend:    S + '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M7 16l3.5-4 3 2.5L20 8"/></svg>',
  mail:     S + '<rect x="3" y="5.5" width="18" height="13" rx="1.5"/><path d="M3.5 7l8.5 6 8.5-6"/></svg>',
  bell:     S + '<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5S6.5 14 6.5 10z"/><path d="M10.2 19a2 2 0 0 0 3.6 0"/></svg>',
  gear:     S + '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M18 6l-1.4 1.4M7.4 16.6 6 18M18 18l-1.4-1.4M7.4 7.4 6 6"/></svg>',
  box:      S + '<path d="M12 3.5l8 4v9l-8 4-8-4v-9z"/><path d="M4 7.5l8 4 8-4M12 11.5v9"/></svg>',
  layers:   S + '<path d="M12 3.5l8.5 4.3L12 12 3.5 7.8z"/><path d="M3.5 12.2 12 16.5l8.5-4.3M3.5 16.4 12 20.7l8.5-4.3"/></svg>',
  question: S + '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.8-.9 1.4v.4"/><path d="M12 17h.01"/></svg>',
  clock:    S + '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/></svg>',
  wallet:   S + '<rect x="3" y="7" width="18" height="12" rx="1.5"/><path d="M16 13h3"/><path d="M6 7V5.5a1.5 1.5 0 0 1 1.5-1.5H18"/></svg>',
  search:   S + '<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8 20.5 20.5"/></svg>',
};

/* One tint per module, colour values reused directly from the mockup's palette. */
const TINTS = {
  D:{bg:'#e2edf9', ink:'#10508c'},   V:{bg:'#dcefec', ink:'#0f7264'},
  P:{bg:'#fdeade', ink:'#b0561d'},   W:{bg:'#eae7fa', ink:'#6152cc'},
  B:{bg:'#fbf0d5', ink:'#8a6a12'},   M:{bg:'#e0f0e4', ink:'#1c6047'},
  U:{bg:'#e7eafc', ink:'#4551b5'},   Q:{bg:'#fbe5ee', ink:'#ad3a70'},
};
const tintOf = codes => TINTS[(codes[0] || 'D').split('.')[0]] || TINTS.D;

/* ---------------- the menu — every leaf maps to a real screen ---------------- */
const MENU = [
  { code:'D', name:'Dashboard', icon:'grid', activeTab:'dashboard',
    desc:'Live metrics across the whole portal.' },

  { code:'V', name:'Vendors', icon:'factory',
    desc:'Supplier accounts and applicants still in onboarding.',
    items:[
      { code:'V.1', name:'All vendors', icon:'factory', activeTab:'vendors', desc:'Every approved and active supplier.' },
      { code:'V.2', name:'Vendor prospects', icon:'userPlus', activeTab:'prospects', desc:'Applicants still in onboarding review.' },
      { code:'V.3', name:'Invitations', icon:'mail', activeTab:'invitations', desc:'Invite a new supplier to register.' },
    ]},

  { code:'P', name:'Procure to Pay', icon:'cart',
    desc:'Requisitions through to payment.',
    items:[
      { code:'P.1', name:'Purchase requisition', icon:'clipboard', activeTab:'pr', desc:'Requisitions raised across the business.' },
      { code:'P.2', name:'Indent', icon:'clipboard', activeTab:'indent', desc:'Internal stock and material requests.' },
      { code:'P.3', name:'Quotation', icon:'tag', activeTab:'quotation', desc:'Quotes requested and received.' },
      { code:'P.4', name:'Purchase order', icon:'cart', activeTab:'po', desc:'Released orders and their status.' },
      { code:'P.5', name:'ASN', icon:'truck', activeTab:'asn', desc:'Advance shipping notices from suppliers.' },
      { code:'P.6', name:'Invoice', icon:'money', activeTab:'invoice', comingSoon:true, desc:'Invoices and their approval position.' },
      { code:'P.7', name:'Vendor payments', icon:'wallet', activeTab:'vendor_payments', comingSoon:true, desc:'Payments released to suppliers.' },
      { code:'P.8', name:'Vendor returns', icon:'refresh', activeTab:'vendor_returns', comingSoon:true, desc:'Goods returned to a supplier.' },
      { code:'P.9', name:'Credit', icon:'money', activeTab:'credit', comingSoon:true, desc:'Credit notes issued.' },
      { code:'P.10', name:'Credit payment', icon:'wallet', activeTab:'credit_payment', comingSoon:true, desc:'Settlement against credit notes.' },
    ]},

  { code:'W', name:'Workflow Configurations', icon:'tree',
    desc:'Approval routing, service levels and everything in flight.',
    items:[
      { code:'W.1', name:'Workflow dashboard', icon:'gauge', activeTab:'wf_dashboard', desc:'Where every open request currently sits.' },
      { code:'W.2', name:'Workflows', icon:'tree', activeTab:'wf_list', desc:'Every configured approval workflow.' },
      { code:'W.3', name:'Requests', icon:'flag', activeTab:'wf_requests', desc:'Act on individual requests.' },
      { code:'W.4', name:'Groups', icon:'users', activeTab:'wf_groups', desc:'Approver groups used by workflow stages.' },
      { code:'W.5', name:'Analytics', icon:'trend', activeTab:'wf_analytics', desc:'Where time is actually being spent.' },
      { code:'W.6', name:'Email action', icon:'mail', activeTab:'wf_email_action', desc:'Approving straight from the inbox.' },
      { code:'W.7', name:'Email templates', icon:'mail', activeTab:'wf_email_templates', desc:'Wording of every transactional email.' },
      { code:'W.8', name:'Settings', icon:'gear', activeTab:'wf_settings', desc:'Rules that apply to every workflow.' },
    ]},

  { code:'B', name:'Budget', icon:'money', activeTab:'budget',
    desc:'Allocations per cost centre, and what happens when one runs out.' },

  { code:'M', name:'Master Data', icon:'box',
    desc:'The records everything else refers to.',
    items:[
      { code:'M.1', name:'Master data', icon:'box', activeTab:'masterdata', desc:'Vendor and material master records.' },
      { code:'M.2', name:'Material BOM', icon:'layers', activeTab:'material_bom', comingSoon:true, desc:'How a finished item is built.' },
    ]},

  { code:'U', name:'Users', icon:'users', activeTab:'users',
    desc:'Accounts and exactly what each may do.' },

  { code:'Q', name:'Questionnaires', icon:'question', activeTab:'questionnaires',
    desc:'Build the questionnaires suppliers complete, and decide who is asked.' },
];

/* ---------------- alphabetical everywhere ---------------- */
const byName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
const sorted = list => [...list].sort(byName);

function resolve(codes) {
  const chain = [];
  let level = MENU;
  for (const code of codes) {
    const node = (level || []).find((n) => n.code === code);
    if (!node) break;
    chain.push(node);
    level = node.items;
  }
  return chain;
}

const ALL = [];
(function walk(list, trail) {
  sorted(list).forEach((n) => {
    const here = [...trail, n];
    ALL.push({ node: n, trail: here, codes: here.map((x) => x.code) });
    if (n.items) walk(n.items, here);
  });
})(MENU, []);

const ACTIVE_TAB_PATH = Object.fromEntries(
  ALL.filter((e) => e.node.activeTab).map((e) => [e.node.activeTab, e.codes])
);

/* ---------------- small pieces ---------------- */
const Icon = ({ name }) => <span className="tile__ico" dangerouslySetInnerHTML={{ __html: I[name] || I.grid }} />;
const ScreenIcon = ({ name }) => <span className="screen__ico" dangerouslySetInnerHTML={{ __html: I[name] || I.grid }} />;

function Tile({ node, codes, onOpen }) {
  const t = tintOf(codes);
  const branch = !!node.items;
  const sub = branch ? `${node.items.length} options` : 'Open';
  return (
    <li>
      <button
        className={`tile ${branch ? 'tile--branch' : ''}`}
        style={{ '--tint-bg': t.bg, '--tint-ink': t.ink }}
        title={`${node.code} · ${node.desc || node.name}`}
        onClick={() => onOpen(codes)}
      >
        {node.comingSoon && <span className="tile__soon">Soon</span>}
        <Icon name={node.icon} />
        <span className="tile__label">{node.name}</span>
        <span className="tile__sub">{sub}</span>
      </button>
    </li>
  );
}

function GroupCard({ node, parentCodes, onOpen }) {
  const t = tintOf([node.code]);
  const kids = node.items ? sorted(node.items) : [node];
  const count = node.items ? `${node.items.length} items` : 'No submenu';
  return (
    <section className="group" style={{ '--tint-bg': t.bg, '--tint-ink': t.ink }}>
      <header className="group__head">
        <span className="group__code">{node.code}</span>
        <h2 className="group__name">{node.name}</h2>
        <span className="group__count">{count}</span>
      </header>
      <div className="group__body">
        <ul className="tiles">
          {kids.map((k) => (
            <Tile
              key={k.code}
              node={k}
              codes={node.items ? [...parentCodes, node.code, k.code] : [...parentCodes, node.code]}
              onOpen={onOpen}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

function Trail({ chain, onOpen }) {
  if (!chain.length) return null;
  return (
    <nav className="trail" aria-label="Breadcrumb">
      <button onClick={() => onOpen([])}>All modules</button>
      {chain.map((node, i) => {
        const codes = chain.slice(0, i + 1).map((n) => n.code);
        const isLast = i === chain.length - 1;
        return (
          <React.Fragment key={node.code}>
            <span className="sep">›</span>
            {isLast ? <span className="here">{node.name}</span> : <button onClick={() => onOpen(codes)}>{node.name}</button>}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function Finder({ value, onChange }) {
  return (
    <div className="finder">
      <input
        type="search"
        placeholder="Jump to a menu item or code"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Find a menu item"
        autoComplete="off"
      />
      <span className="finder__hint">try “W.2” or “vendor”</span>
    </div>
  );
}

/* Same "coming soon" placeholder the old sidebar used for unbuilt features. */
function ComingSoonView({ moduleName }) {
  const [emailInput, setEmailInput] = useState('');
  const [notified, setNotified] = useState(false);
  const handleSubmit = (e) => {
    e.preventDefault();
    if (emailInput.trim()) setNotified(true);
  };
  return (
    <div className="fade-in-slide container-fluid py-5 text-start" style={{ fontFamily: '"Inter", sans-serif' }}>
      <div className="row justify-content-center mt-4">
        <div className="col-lg-6 col-md-8 col-sm-10 col-12">
          <div className="card border-0 shadow-lg" style={{ borderRadius: '24px', overflow: 'hidden' }}>
            <div
              className="p-5 text-center position-relative"
              style={{ background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)', color: '#ffffff' }}
            >
              <div className="position-absolute" style={{ top: '-40px', right: '-40px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)' }}></div>
              <div className="position-absolute" style={{ bottom: '-30px', left: '-30px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)' }}></div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-4 bg-white bg-opacity-10 shadow-sm"
                style={{ width: '80px', height: '80px', color: '#10b981' }}
              >
                <i className="fas fa-cogs fs-2"></i>
              </div>
              <span className="badge px-3 py-2 text-uppercase mb-2" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', fontSize: '10px', letterSpacing: '1px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>Coming Soon</span>
              <h3 className="fw-bold mb-2">{moduleName} Module</h3>
              <p className="text-light text-opacity-75 mb-0 small mx-auto" style={{ maxWidth: '400px' }}>
                The administrative panel and workflow automation for <strong>{moduleName}</strong> is currently being migrated to React.
              </p>
            </div>
            <div className="card-body p-5">
              <div className="mb-4">
                <div className="d-flex justify-content-between mb-1" style={{ fontSize: '11px' }}>
                  <span className="text-muted fw-semibold">Migration Progress</span>
                  <span className="text-success fw-bold">90% Completed</span>
                </div>
                <div className="progress" style={{ height: '8px', borderRadius: '4px' }}>
                  <div className="progress-bar progress-bar-striped progress-bar-animated bg-success" role="progressbar" style={{ width: '90%', backgroundColor: '#10b981' }} aria-valuenow="90" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
              </div>
              {!notified ? (
                <form onSubmit={handleSubmit} className="mt-4">
                  <h6 className="fw-bold text-dark mb-2 text-center" style={{ fontSize: '13px' }}>Notify when live?</h6>
                  <p className="text-muted text-center mb-3" style={{ fontSize: '11px' }}>Enter your email below to get notified of release details.</p>
                  <div className="d-flex gap-2">
                    <input type="email" className="form-control border-light-subtle py-2 px-3" placeholder="name@company.com" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} style={{ borderRadius: '8px', fontSize: '12px' }} />
                    <button type="submit" className="btn btn-success px-4 fw-bold shadow-sm" style={{ backgroundColor: '#064e3b', borderColor: '#064e3b', borderRadius: '8px', fontSize: '12px' }}>Subscribe</button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-3">
                  <div className="text-success mb-2"><i className="fas fa-check-circle fs-3"></i></div>
                  <h6 className="fw-bold text-dark mb-1" style={{ fontSize: '13px' }}>Subscribed!</h6>
                  <p className="text-muted mb-0" style={{ fontSize: '11px' }}>We will notify you at <strong>{emailInput}</strong> as soon as this feature goes live.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Real screen for one activeTab id — mirrors AdminDashboardLayout's old switch. */
function RealScreen({ activeTab, onNavigate }) {
  switch (activeTab) {
    case 'dashboard': return <DashboardHome isAdmin onNavigate={onNavigate} />;
    case 'vendors': return <AdminVendors />;
    case 'prospects': return <AdminProspects />;
    case 'invitations': return <AdminInvitations />;
    case 'masterdata': return <AdminMasterData />;
    case 'users': return <AdminUsers />;
    case 'wf_dashboard': case 'wf_list': case 'wf_requests': case 'wf_groups':
    case 'wf_analytics': case 'wf_email_action': case 'wf_settings':
      return <AdminWorkflows subTab={activeTab} onNavigate={onNavigate} />;
    case 'wf_email_templates': return <AdminEmailTemplates />;
    case 'pr': return <PurchaseRequisition />;
    case 'indent': return <IndentDashboard />;
    case 'quotation': return <Quotation />;
    case 'po': return <PurchaseOrder />;
    case 'asn': return <ASN />;
    case 'budget': return <BudgetApp />;
    case 'questionnaires': return <Questionnaire />;
    default: return null;
  }
}

/* ============================================================
   Main component
   ============================================================ */
export default function AdminLauncher() {
  const { currentUser, logout } = useAuth();
  const [path, setPath] = useState([]);
  const [query, setQuery] = useState('');

  const goTo = (codes) => {
    setPath(codes);
    setQuery('');
    document.getElementById('splauncher-main')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const onNavigate = (tabId) => goTo(ACTIVE_TAB_PATH[tabId] || []);

  useEffect(() => {
    const onKey = (e) => {
      const typing = e.target.tagName === 'INPUT';
      if (typing && e.key !== 'Escape') return;
      if (e.key === 'Escape' && typing && e.target.value) { setQuery(''); return; }
      if ((e.key === 'Escape' || e.key === 'Backspace') && path.length) {
        e.preventDefault();
        goTo(path.slice(0, -1));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const chain = resolve(path);
  const node = chain[chain.length - 1];

  const user = currentUser || JSON.parse(localStorage.getItem('user_data') || '{}');
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Admin';
  const initials = displayName.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'AD';
  const roleLabel = (user.role || 'Portal administrator').replace(/_/g, ' ');

  const q = query.trim().toLowerCase();

  let content;

  if (q) {
    const hits = ALL.filter((e) =>
      e.node.name.toLowerCase().includes(q) ||
      e.node.code.toLowerCase().includes(q) ||
      (e.node.desc || '').toLowerCase().includes(q)
    ).slice(0, 32);
    content = (
      <>
        <div className="pagehead">
          <div>
            <span className="codechip">FIND</span>
            <h1>Results for “{query}”</h1>
            <p className="lede">Every match at any level, in alphabetical order.</p>
          </div>
          <Finder value={query} onChange={setQuery} />
        </div>
        {hits.length ? (
          <>
            <p className="resulthead">{hits.length} match{hits.length === 1 ? '' : 'es'}</p>
            <section className="group">
              <div className="group__body">
                <ul className="tiles">
                  {hits.map((h) => {
                    const t = tintOf(h.codes);
                    return (
                      <li key={h.codes.join('/')}>
                        <button
                          className={`tile ${h.node.items ? 'tile--branch' : ''}`}
                          style={{ '--tint-bg': t.bg, '--tint-ink': t.ink }}
                          onClick={() => goTo(h.codes)}
                        >
                          {h.node.comingSoon && <span className="tile__soon">Soon</span>}
                          <Icon name={h.node.icon} />
                          <span className="tile__label">{h.node.name}</span>
                          <span className="crumbpath">{h.trail.slice(0, -1).map((n) => n.code).join(' › ') || 'Top'}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          </>
        ) : (
          <div className="empty">
            <p className="empty__title">Nothing matches “{query}”.</p>
            <p>Try a code such as W.2 or M.1, or a word like “budget”, “vendor” or “requests”.</p>
          </div>
        )}
      </>
    );
  } else if (node && !node.items) {
    /* leaf — breadcrumb, then the real screen (or its coming-soon placeholder) */
    const t = tintOf(path);
    const sibs = chain.length > 1 ? sorted(chain[chain.length - 2].items) : sorted(MENU);
    const base = chain.slice(0, -1).map((n) => n.code);
    const parentLabel = chain.length > 1 ? chain[chain.length - 2] : null;
    content = (
      <>
        <Trail chain={chain} onOpen={goTo} />
        <div className="pagehead">
          <div>
            <span className="codechip">{node.code}</span>
            <h1>{node.name}</h1>
            <p className="lede">{node.desc || ''}</p>
          </div>
          <Finder value={query} onChange={setQuery} />
        </div>
        {node.comingSoon ? (
          <div className="real-screen"><ComingSoonView moduleName={node.name} /></div>
        ) : (
          <div className="real-screen">
            <RealScreen activeTab={node.activeTab} onNavigate={onNavigate} />
          </div>
        )}
        <section className="group" style={{ marginTop: 18 }}>
          <header className="group__head">
            <span className="group__code" style={{ '--tint-bg': t.bg, '--tint-ink': t.ink }}>
              {parentLabel ? parentLabel.code : 'ADMIN'}
            </span>
            <h2 className="group__name">Also under {parentLabel ? parentLabel.name : 'the top level'}</h2>
          </header>
          <div className="group__body">
            <ul className="tiles">
              {sibs.map((s) => (
                <Tile key={s.code} node={s} codes={[...base, s.code]} onOpen={goTo} />
              ))}
            </ul>
          </div>
        </section>
      </>
    );
  } else if (!node) {
    /* home — every module as a card */
    content = (
      <>
        <div className="pagehead">
          <div>
            <span className="codechip">ADMIN</span>
            <h1>Supplier Portal administration</h1>
            <p className="lede">
              Every module, in alphabetical order, with its menu items shown. A tile with a ring
              around it opens another set of options; the rest open a screen.
            </p>
          </div>
          <Finder value={query} onChange={setQuery} />
        </div>
        {sorted(MENU).map((m) => (
          <GroupCard key={m.code} node={m} parentCodes={[]} onOpen={goTo} />
        ))}
      </>
    );
  } else {
    /* a module or submenu opened on its own */
    const t = tintOf(path);
    const branches = sorted(node.items).filter((c) => c.items);
    const leaves = sorted(node.items).filter((c) => !c.items);
    content = (
      <>
        <Trail chain={chain} onOpen={goTo} />
        <div className="pagehead">
          <div>
            <span className="codechip">{node.code}</span>
            <h1>{node.name}</h1>
            <p className="lede">{node.desc || ''}</p>
          </div>
          <Finder value={query} onChange={setQuery} />
        </div>
        {branches.map((child) => (
          <GroupCard key={child.code} node={child} parentCodes={path} onOpen={goTo} />
        ))}
        {leaves.length > 0 && (
          <section className="group" style={{ '--tint-bg': t.bg, '--tint-ink': t.ink }}>
            <header className="group__head">
              <span className="group__code">{node.code}</span>
              <h2 className="group__name">{node.name}</h2>
              <span className="group__count">{leaves.length} items</span>
            </header>
            <div className="group__body">
              <ul className="tiles">
                {leaves.map((c) => (
                  <Tile key={c.code} node={c} codes={[...path, c.code]} onOpen={goTo} />
                ))}
              </ul>
            </div>
          </section>
        )}
      </>
    );
  }

  return (
    <div className="splauncher">
      <header className="topbar">
        <button className="mark" onClick={() => goTo([])} aria-label="Back to all modules">
          <span className="mark__badge">SP</span>
          <span>
            <span className="mark__name">Supplier Portal</span>{' '}
            <span className="mark__sub">Admin</span>
          </span>
        </button>
        <div className="spacer"></div>
        <span className="env">Production</span>
        <div className="session">
          <span className="avatar">{initials}</span>
          <span>
            <span className="session__name">{displayName}</span><br />
            <span className="session__role">{roleLabel}</span>
          </span>
          <button className="signout" onClick={logout}>Sign out</button>
        </div>
      </header>
      <main id="splauncher-main" tabIndex={-1}>{content}</main>
    </div>
  );
}
