// Ported from become-a-supplier/app/become-a-supplier/lib/utils.ts

export function fmtSize(bytes) {
  return bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(Math.round(bytes / 1024), 1) + ' KB';
}

export function nowStr() {
  return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ', ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
