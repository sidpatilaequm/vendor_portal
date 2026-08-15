// Java-side mirror lives at backend_java's SupplierDocumentConfig.java — keep field keys
// in sync with that file. Ported from become-a-supplier/app/become-a-supplier/lib/data.ts;
// this is pure data, independent of the UI/backend rewrite.

export const DOCS = [
  {
    id: 'coi',
    name: 'Certificate of incorporation',
    req: true,
    gives: 'CIN or LLPIN, verified against the MCA',
    verifyKind: 'cin',
    fields: [{ k: 'cin', label: 'CIN or LLPIN', req: true, mono: true, upper: true }],
  },
  {
    id: 'pan',
    name: 'PAN card',
    req: true,
    gives: 'PAN, verified against the Income Tax Department',
    verifyKind: 'pan',
    fields: [{ k: 'pan', label: 'PAN', req: true, mono: true, upper: true }],
  },
  {
    id: 'gst',
    name: 'GST registration certificate',
    req: true,
    gives: 'GSTIN, verified against the GST portal',
    verifyKind: 'gstin',
    fields: [{ k: 'gstin', label: 'GSTIN', req: true, mono: true, upper: true }],
  },
  {
    id: 'chq',
    name: 'Cancelled cheque',
    req: true,
    gives: 'Account name, number and IFSC, verified with a penny-drop',
    verifyKind: 'bank',
    fields: [
      { k: 'benName', label: 'Account name as printed', req: true },
      { k: 'acctNo', label: 'Account number', req: true, mono: true },
      { k: 'ifsc', label: 'IFSC', req: true, mono: true, upper: true },
    ],
  },
  {
    id: 'udyam',
    name: 'MSME / Udyam certificate',
    req: false,
    gives: 'Udyam registration number, verified against the Udyam portal',
    verifyKind: 'udyam',
    fields: [{ k: 'udyam', label: 'Udyam registration number', mono: true, upper: true }],
  },
  {
    id: 'iso',
    name: 'ISO 9001 certificate',
    req: false,
    gives: 'Certificate number and expiry',
    fields: [
      { k: 'isoNo', label: 'Certificate number', mono: true },
      { k: 'isoBody', label: 'Certifying body' },
      { k: 'isoExpiry', label: 'Valid to', type: 'date' },
    ],
  },
  {
    id: 'as',
    name: 'AS9100D certificate',
    req: false,
    gives: 'Certificate number and expiry',
    fields: [
      { k: 'asNo', label: 'Certificate number', mono: true },
      { k: 'asBody', label: 'Certifying body' },
      { k: 'asExpiry', label: 'Valid to', type: 'date' },
    ],
  },
];

export const RULES = {
  pan: { re: /^[A-Z]{5}[0-9]{4}[A-Z]$/, msg: 'Ten characters — five letters, four digits, one letter.' },
  gstin: { re: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/, msg: 'Fifteen characters.' },
  ifsc: { re: /^[A-Z]{4}0[A-Z0-9]{6}$/, msg: 'Eleven characters — four letters, a zero, six more.' },
  acctNo: { re: /^[0-9]{9,18}$/, msg: 'Nine to eighteen digits.' },
  cin: { re: /^[LUu][0-9]{5}[A-Za-z]{2}[0-9]{4}[A-Za-z]{3}[0-9]{6}$/, msg: 'Twenty-one characters as issued by the MCA.' },
  udyam: { re: /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/, msg: 'Format UDYAM-XX-00-0000000.' },
  phone: { re: /^[6-9][0-9]{9}$/, msg: 'Ten digits, starting 6 to 9.' },
  email: { re: /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/, msg: 'Enter a working email address.' },
};

export function fieldError(key, value) {
  if (!value) return null;
  const rule = RULES[key];
  if (!rule) return null;
  return rule.re.test(value) ? null : rule.msg;
}
