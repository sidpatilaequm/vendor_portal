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
    id: 'gst',
    name: 'GST registration certificate',
    req: true,
    gives: 'GSTIN, verified against the GST portal',
    verifyKind: 'gstin',
    fields: [{ k: 'gstin', label: 'GSTIN', req: true, mono: true, upper: true }],
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
    id: 'chq',
    name: 'Cancelled cheque',
    req: true,
    gives: 'Account name, number and IFSC, verified with a penny-drop',
    verifyKind: 'bank',
    fields: [
      { k: 'benName', label: 'Account name as printed', req: true, editable: true },
      { k: 'acctNo', label: 'Account number', req: true, mono: true, editable: true },
      { k: 'ifsc', label: 'IFSC', req: true, mono: true, upper: true, editable: true },
    ],
  },
  {
    id: 'udyam',
    name: 'MSME / Udyam certificate',
    req: false,
    gives: 'Udyam registration number, verified against the Udyam portal',
    verifyKind: 'udyam',
    fields: [{ k: 'udyam', label: 'Udyam registration number', req: true, mono: true, upper: true }],
  },
  {
    id: 'iso',
    name: 'ISO 9001 certificate',
    req: false,
    gives: 'Certificate number and expiry',
    fields: [
      { k: 'isoNo', label: 'Certificate number', req: true, mono: true },
      { k: 'isoBody', label: 'Certifying body', req: true },
      { k: 'isoExpiry', label: 'Valid to', req: true, type: 'date', expiry: true },
    ],
  },
  {
    id: 'iso14001',
    name: 'ISO 14001 certificate',
    req: false,
    gives: 'Certificate number and expiry',
    fields: [
      { k: 'iso14001No', label: 'Certificate number', req: true, mono: true },
      { k: 'iso14001Body', label: 'Certifying body', req: true },
      { k: 'iso14001Expiry', label: 'Valid to', req: true, type: 'date', expiry: true },
    ],
  },
  {
    id: 'iso45001',
    name: 'ISO 45001 certificate',
    req: false,
    gives: 'Certificate number and expiry',
    fields: [
      { k: 'iso45001No', label: 'Certificate number', req: true, mono: true },
      { k: 'iso45001Body', label: 'Certifying body', req: true },
      { k: 'iso45001Expiry', label: 'Valid to', req: true, type: 'date', expiry: true },
    ],
  },
  {
    id: 'iso27001',
    name: 'ISO 27001 certificate',
    req: false,
    gives: 'Certificate number and expiry',
    fields: [
      { k: 'iso27001No', label: 'Certificate number', req: true, mono: true },
      { k: 'iso27001Body', label: 'Certifying body', req: true },
      { k: 'iso27001Expiry', label: 'Valid to', req: true, type: 'date', expiry: true },
    ],
  },
  {
    id: 'as',
    name: 'AS9100D certificate',
    req: false,
    gives: 'Certificate number and expiry',
    fields: [
      { k: 'asNo', label: 'Certificate number', req: true, mono: true },
      { k: 'asBody', label: 'Certifying body', req: true },
      { k: 'asExpiry', label: 'Valid to', req: true, type: 'date', expiry: true },
    ],
  },
  {
    id: 'nadcap',
    name: 'NADCAP certificate',
    req: false,
    gives: 'Certificate number and expiry',
    fields: [
      { k: 'nadcapNo', label: 'Certificate number', req: true, mono: true },
      { k: 'nadcapExpiry', label: 'Expiration date', req: true, type: 'date', expiry: true },
    ],
  },
  {
    id: 'nda',
    name: 'Signed NDA',
    req: true,
    gives: 'Confirms you have reviewed and agreed to our non-disclosure terms',
    fields: [],
    templateUrl: '/supplier-nda-template.pdf',
    templateLabel: 'Download the NDA template',
  },
];

// Mirrors AA-PUR-F-03 Rev02 "Supplier Evaluation and Registration Form" — the paper form
// this section of the digital flow is a direct port of.
export const BUSINESS_TYPES = ['Manufacturer', 'Service', 'Trader'];

export const COMPANY_TYPES = ['Proprietary', 'Partnership', 'Private Limited', 'Public Limited'];

export const WEEKLY_OFF_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const EQUIPMENT_FACILITIES = [
  'Fabrication — Sheet Metal',
  'Fabrication — Plate',
  'Machining',
  'Casting — Ferrous',
  'Casting — Non Ferrous',
  'Forging — Cold',
  'Forging — Hot',
  'Grinding',
  'Sheet Metal Press',
  'Moldings — Rubber',
  'Moldings — Plastic',
  'Moldings — Bakelite',
  'Moldings — Others',
  'Springs',
  'Elec. & Electronics Items',
  'Heat Treatment',
  'Electro Plating',
  'Tooling',
  'Others',
];

export const DIRECTOR_ROW_TEMPLATE = { name: '', qualification: '', experience: '', commencementDate: '', capitalEmployed: '' };

export const MACHINERY_ROW_TEMPLATE = { description: '', capacity: '', makeName: '', makeYear: '', numbers: '', remarks: '' };

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

export const TODAY = new Date().toISOString().slice(0, 10);

export const REVIEW_FLOW = [
  { title: 'Procurement — duplicate and category check', sub: '1 working day' },
  {
    title:
      'Finance — PAN, GST and Udyam verified on the government portals; one rupee sent to your account and the returned name matched',
    sub: '2 working days',
  },
  { title: 'Quality — certificate review, and a site audit for manufacturing', sub: '5 working days' },
  { title: 'Vendor code created and your portal login emailed', sub: '1 working day' },
];

export const SECTIONS = [
  { id: 'sec-docs', name: 'Documents and details' },
  { id: 'sec-other', name: 'Other documents' },
  { id: 'sec-file', name: 'On file' },
  { id: 'sec-you', name: 'Only you can answer' },
  { id: 'sec-questions', name: 'Additional questions' },
  { id: 'sec-submit', name: 'Submit' },
];
