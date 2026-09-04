import http from 'http';
import httpProxy from 'http-proxy';

// Always-on backend router for production, standing in for the path-based proxy rules that
// vite.config.js's dev server provides for free. Deliberately NOT imported from vite.config.js
// (that file is dev-only and untouched by this change) — this is a separate, hand-kept copy of
// the same routing table, checked in the same order vite checks its proxy object (insertion
// order = first match wins), so keep the two in sync if routes ever change.
//
// Runs as its own systemd service, independent of frontend deploys — a `git pull && npm run
// build` for the React app never touches or restarts this process, so API routing has zero
// downtime on every ordinary frontend deploy. It only needs restarting if this routing table, or
// a backend target's port, actually changes.

const PORT = process.env.API_PROXY_PORT || 5174;
const BACKEND_JAVA = `http://127.0.0.1:${process.env.BACKEND_JAVA_PORT || 8080}`;
const WORKFLOW_TARGET = `http://127.0.0.1:${process.env.WORKFLOW_PORT || 8000}`;
const INVOICE_TARGET = `http://127.0.0.1:${process.env.INVOICE_EXTRACT_PORT || 5000}`;

// Same rules as vite.config.js's server.proxy, same order, same semantics: a key starting with
// "^" is a RegExp tested against the raw URL, everything else is a plain string prefix.
const RULES = [
  ['/api/auth/login', { target: BACKEND_JAVA, rewrite: (p) => p.replace(/^\/api\/auth\/login\/?/, '/api/users/login') }],
  ['/vendor/register-request/', { target: WORKFLOW_TARGET }],
  ['/api/workflows', { target: WORKFLOW_TARGET }],
  ['/api/users', { target: BACKEND_JAVA }],
  ['/api/dashboard', { target: BACKEND_JAVA }],
  ['/api/reports', { target: BACKEND_JAVA }],
  ['/api/locations', { target: WORKFLOW_TARGET, rewrite: (p) => p.replace(/^\/api\/locations/, '/api/locations/') }],
  ['/api/materials', { target: WORKFLOW_TARGET }],
  ['/api/employee/quote-comparison', { target: WORKFLOW_TARGET }],
  ['/api/employee/award-quote', { target: WORKFLOW_TARGET }],
  ['/api/employee', { target: BACKEND_JAVA }],
  ['/api/vendors', { target: BACKEND_JAVA }],
  ['^/api/vendor/asns/history/.+', { target: BACKEND_JAVA }],
  ['^/api/vendor/asns/.+', { target: WORKFLOW_TARGET }],
  ['^/api/vendor/asns/?$', { target: BACKEND_JAVA }],
  ['/api/vendor/create-pr-options', { target: WORKFLOW_TARGET }],
  ['/api/vendor/selection-list', { target: WORKFLOW_TARGET }],
  ['^/api/vendor/purchase-orders/\\d+/?$', { target: BACKEND_JAVA }],
  ['^/api/vendor/purchase-requisitions/[^/]+/create-rfq/?$', { target: WORKFLOW_TARGET }],
  ['/api/vendor/purchase-requisitions', { target: BACKEND_JAVA }],
  ['/api/vendor/quotations', { target: BACKEND_JAVA }],
  ['/api/vendor/material-list', { target: WORKFLOW_TARGET }],
  ['/api/purchase-orders', { target: BACKEND_JAVA }],
  ['/api/purchase-requisitions', { target: BACKEND_JAVA }],
  ['/api/vendor/gate-entry', { target: BACKEND_JAVA }],
  ['/api/vendor/all', { target: WORKFLOW_TARGET }],
  ['/api/vendor', { target: BACKEND_JAVA }],
  ['/api/stages', { target: WORKFLOW_TARGET }],
  ['/api/auth/me', { target: WORKFLOW_TARGET }],
  ['/api/messages', { target: WORKFLOW_TARGET }],
  ['/api/requests', { target: WORKFLOW_TARGET }],
  ['/api/email-templates', { target: WORKFLOW_TARGET }],
  ['/api/extract-invoice', { target: INVOICE_TARGET, rewrite: (p) => p.replace(/^\/api\/extract-invoice/, '/extract-invoice') }],
  ['/api/budget', { target: WORKFLOW_TARGET, rewrite: (p) => p.replace(/^\/api\/budget/, '/api') }],
  ['/api/department-status', { target: BACKEND_JAVA }],
  ['/api/organization', { target: BACKEND_JAVA }],
  ['/api/questionnaire', { target: BACKEND_JAVA }],
  ['/api', { target: BACKEND_JAVA }],
];

const COMPILED = RULES.map(([key, opts]) => ({
  // Matched against the pathname only (query string stripped) — several rules are anchored
  // with a trailing "$" (e.g. "^/api/vendor/asns/?$"), which would never match a URL carrying
  // a query string ("?x=1") if tested against the full req.url instead.
  test: key.startsWith('^') ? (path) => new RegExp(key).test(path) : (path) => path.startsWith(key),
  ...opts,
}));

function resolveRule(pathname) {
  return COMPILED.find((r) => r.test(pathname));
}

const proxy = httpProxy.createProxyServer({ changeOrigin: true, xfwd: true });

proxy.on('error', (err, req, res) => {
  console.error(`[api-proxy] upstream error for ${req.url}:`, err.message);
  if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
  res.end('Bad gateway (upstream unreachable)');
});

const server = http.createServer((req, res) => {
  const pathname = req.url.split('?')[0];
  const rule = resolveRule(pathname);
  if (!rule) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('No proxy rule matched');
    return;
  }
  if (rule.rewrite) req.url = rule.rewrite(req.url);
  proxy.web(req, res, { target: rule.target });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[api-proxy] listening on 127.0.0.1:${PORT}`);
  console.log(`[api-proxy] backend_java=${BACKEND_JAVA} workflow=${WORKFLOW_TARGET} invoice=${INVOICE_TARGET}`);
});
