import { useCallback, useEffect, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  IndianRupee,
  Lock,
  MoonStar,
  PiggyBank,
  Plus,
  QrCode,
  Receipt,
  Search,
  ShieldCheck,
  SunMedium,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import { appConfig, UPI_ID } from './data/mockData';
import {
  approvePaymentRecord,
  createDonationRecord,
  createEventRecord,
  createExpenseRecord,
  fetchPortalData,
  settleCurrentEvent,
  submitPaymentProof,
} from './lib/api';

const INR = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const fmtDate = (date) => new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

const readFile = (file) => new Promise((resolve) => {
  if (!file) return resolve('');
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.readAsDataURL(file);
});

function Badge({ status }) {
  const isVerified = status === 'Verified';
  const color = isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700';
  const Icon = isVerified ? CheckCircle2 : Clock3;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${color}`}>
      <Icon size={12} />
      {status}
    </span>
  );
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className={`w-full bg-white ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'} max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 shadow-soft`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  const isRequired = props.required || false;

  return (
    <label className="mb-3 block text-sm text-slate-700">
      <span className="mb-1 block">
        {label}
        {isRequired && <span className="ml-1 text-rose-500">*</span>}
      </span>
      <input
        {...props}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
      />
    </label>
  );
}

function Button({ children, variant = 'primary', className = '', ...props }) {
  const variants = {
    primary: 'bg-orange-600 text-white hover:bg-orange-700',
    outline: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    soft: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
  };

  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${variants[variant]} ${className} ${props.disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      {children}
    </button>
  );
}

function FakeQR() {
  const cells = useMemo(
    () =>
      Array.from({ length: 169 }, (_, index) => {
        const pattern = (index * 37 + (index % 13) * 11) % 5;
        return pattern < 2 || (index > 20 && index < 55 && index % 7 === 0);
      }),
    []
  );

  return (
    <div className="mx-auto grid h-44 w-44 grid-cols-13 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-lg">
      {cells.map((filled, index) => (
        <span key={index} className={filled ? 'bg-slate-900' : 'bg-white'} />
      ))}
    </div>
  );
}

function ProofForm({ onClose, onSubmit }) {
  const [form, setForm] = useState({ flat: '', name: '', amount: '', utr: '' });
  const [screenshot, setScreenshot] = useState('');

  const normalizeFlatCode = (value) => {
    const cleaned = String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!cleaned) return '';

    if (/^[A-Z]+-\d+$/.test(cleaned)) return cleaned;
    if (/^[A-Z]+\d+$/.test(cleaned)) {
      const match = cleaned.match(/^([A-Z]+)(\d+)$/);
      return match ? `${match[1]}-${match[2]}` : cleaned;
    }

    return cleaned;
  };

  const flatValue = normalizeFlatCode(form.flat);
  const flatValid = /^[A-Z]+-\d+$/.test(flatValue);
  const nameValid = String(form.name).trim().length > 0;
  const amountValid = Number(form.amount) > 0;
  const utrValid = String(form.utr).trim().length >= 8;
  const screenshotValid = Boolean(screenshot && screenshot.trim().length > 0);
  const valid = flatValid && nameValid && amountValid && utrValid && screenshotValid;

  const update = (key) => (event) => {
    if (key === 'flat') {
      const nextValue = normalizeFlatCode(event.target.value);
      setForm((prev) => ({ ...prev, [key]: nextValue }));
      return;
    }

    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSubmit = () => {
    if (!valid || typeof onSubmit !== 'function') return;
    onSubmit({
      flat: flatValue,
      name: String(form.name).trim(),
      amount: Number(form.amount),
      utr: String(form.utr).trim(),
      screenshotUrl: screenshot,
    });
  };

  return (
    <Modal title="Submit payment proof" onClose={onClose}>
      <Input
        label="Flat No."
        value={form.flat}
        onChange={update('flat')}
        placeholder="F-115"
        required
      />
      {form.flat && !flatValid && (
        <p className="-mt-2 mb-3 text-xs text-rose-600">Use format like F-115</p>
      )}
      <Input label="Resident Name" value={form.name} onChange={update('name')} placeholder="Your name" required />
      <Input label="Amount (₹)" type="number" value={form.amount} onChange={update('amount')} placeholder="2000" required />
      <Input label="UTR / Reference No. (min 8 digits)" value={form.utr} onChange={update('utr')} placeholder="123456789012" required />
      <label className="mb-4 block text-sm text-slate-700">
        <span className="mb-1 block">
          Screenshot upload
          <span className="ml-1 text-rose-500">*</span>
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            const base64 = await readFile(file);
            setScreenshot(base64);
          }}
          className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-none file:bg-orange-100 file:px-3 file:py-1.5 file:text-orange-700"
        />
      </label>

      {screenshot && <img src={screenshot} alt="Proof preview" className="mb-4 h-32 w-full rounded-xl border object-cover" />}

      <Button
        className="w-full"
        disabled={!valid}
        onClick={handleSubmit}
      >
        <Upload size={16} /> Submit for verification
      </Button>
    </Modal>
  );
}

function LoginBox({ onSuccess, notify }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  return (
    <div>
      <Input
        label="Organizer password"
        type="password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          setError(false);
        }}
        placeholder="Enter password"
      />
      {error && <p className="mb-3 text-sm text-rose-600">Incorrect password</p>}
      <Button
        className="w-full"
        onClick={() => {
          const expectedPassword = appConfig.adminPassword;
          if (!expectedPassword) {
            setError(true);
            notify?.('Admin password is not configured.');
            return;
          }

          if (password === expectedPassword) {
            onSuccess();
          } else {
            setError(true);
          }
        }}
      >
        <Lock size={16} /> Unlock organizer panel
      </Button>
      <p className="mt-3 text-xs text-slate-500">Admin will share the password.</p>
    </div>
  );
}

function App() {
  const emptyPortalData = () => ({
    activeEvent: null,
    reserveFund: 0,
    donations: [],
    expenses: [],
    pendingPayments: [],
    history: [],
  });

  const [data, setData] = useState(emptyPortalData);
  const [tab, setTab] = useState('income');
  const [search, setSearch] = useState('');
  const [showUPI, setShowUPI] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminReady, setAdminReady] = useState(false);
  const [receiptModal, setReceiptModal] = useState(null);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('sbs-theme');
    return savedTheme || 'dark';
  });

  useEffect(() => {
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    localStorage.setItem('sbs-theme', theme);
  }, [theme]);

  const isDark = theme === 'dark';

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);
      const result = await fetchPortalData();
      if (mounted) {
        setData(result || emptyPortalData());
        setLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2500);
  };

  const downloadEventSummary = (entry) => {
    if (!entry) return;

    const eventName = entry.name || 'Event';
    const targetBudget = Number(entry.target ?? data.activeEvent?.target ?? 0);
    const reportGeneratedOn = today();
    const eventDate = entry.startDate || entry.endDate || entry.date || reportGeneratedOn;

    const currentRaised = Number(
      entry.raised ?? (
        data.activeEvent && entry.id === data.activeEvent.id
          ? data.donations.filter((item) => item.status === 'Verified').reduce((sum, item) => sum + Number(item.amount), 0)
          : 0
      )
    );

    const currentSpent = Number(
      entry.spent ?? (
        data.activeEvent && entry.id === data.activeEvent.id
          ? data.expenses.reduce((sum, item) => sum + Number(item.amount), 0)
          : 0
      )
    );

    const net = currentRaised - currentSpent;
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 40;
    const leftColX = 60;
    const rightColX = 260;
    const rowHeight = 22;

    pdf.setFillColor(245, 118, 34);
    pdf.rect(0, 0, pageWidth, 82, 'F');

    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(24);
    pdf.text(`${eventName} Summary`, margin, 48);

    pdf.setTextColor(30, 41, 59);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.text('Accountancy Details', margin, 120);
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin, 130, pageWidth - margin, 130);

    const rows = [
      ['Event Name', eventName],
      ['Report Generated', fmtDate(reportGeneratedOn)],
      ['Event Date', fmtDate(eventDate)],
      ['Target Budget', INR(targetBudget)],
      ['Total Raised', INR(currentRaised)],
      ['Total Spent', INR(currentSpent)],
      ['Net Result', `${net >= 0 ? 'Surplus' : 'Deficit'} ${INR(Math.abs(net))}`],
      ['Reserve Fund', INR(data.reserveFund)],
    ];

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);

    let y = 150;
    rows.forEach(([label, value], index) => {
      const isEven = index % 2 === 0;
      pdf.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
      pdf.rect(margin - 8, y - 14, pageWidth - (margin * 2) + 16, rowHeight + 4, 'F');
      pdf.setTextColor(71, 85, 105);
      pdf.text(label, leftColX, y);
      pdf.setTextColor(15, 23, 42);
      pdf.text(String(value), rightColX, y, { maxWidth: pageWidth - rightColX - margin });
      y += rowHeight;
    });

    y += 18;
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin, y, pageWidth - margin, y);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(15, 23, 42);
    pdf.setFontSize(18);
    pdf.text('Summary', margin, y + 28);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(51, 65, 85);

    const summaryLines = [
      `This report covers the ${eventName} accountancy for ${fmtDate(eventDate)}.`,
      `Total contributions received were ${INR(currentRaised)}, while total expenses were ${INR(currentSpent)}.`,
      `The final outcome is ${net >= 0 ? 'a surplus' : 'a deficit'} of ${INR(Math.abs(net))}.`,
      `The reserve fund carried forward is ${INR(data.reserveFund)}.`,
    ];

    let summaryY = y + 44;
    summaryLines.forEach((line) => {
      const wrapped = pdf.splitTextToSize(line, pageWidth - margin * 2);
      pdf.text(wrapped, margin, summaryY);
      summaryY += wrapped.length * 18 + 6;
    });

    const safeName = (eventName || 'event')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'event';

    pdf.save(`${safeName}-summary-${reportGeneratedOn}.pdf`);
    notify('PDF downloaded successfully');
  };

  const renderedAdminLogin = (
    <LoginBox onSuccess={() => setAdminReady(true)} notify={notify} />
  );

  const raised = useMemo(
    () => data.donations.filter((item) => item.status === 'Verified').reduce((sum, item) => sum + Number(item.amount), 0),
    [data.donations]
  );
  const spent = useMemo(
    () => data.expenses.reduce((sum, item) => sum + Number(item.amount), 0),
    [data.expenses]
  );
  const netBalance = raised - spent;
  const progressPercentage = useMemo(
    () => (data.activeEvent ? Math.min(100, Math.round((raised / data.activeEvent.target) * 100)) : 0),
    [data.activeEvent, raised]
  );

  const filteredDonations = useMemo(() => {
    const query = search.toLowerCase();
    return data.donations.filter((item) => {
      const haystack = `${item.flat} ${item.residentName}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [data.donations, search]);

  const visiblePendingPayments = useMemo(
    () => data.pendingPayments.filter((item) => !item.isVerified && item.status !== 'Verified'),
    [data.pendingPayments]
  );

  const renderStatCard = useCallback((label, value, icon, accent) => (
    <div key={label} className="rounded-2xl border border-white/20 bg-white/10 p-3 text-white backdrop-blur-sm">
      <div className="mb-1 flex items-center gap-1 text-xs text-orange-100">
        {icon}
        {label}
      </div>
      <div className={`text-xl font-bold ${accent}`}>{value}</div>
    </div>
  ), []);

  return (
    <div className={`min-h-screen ${isDark ? 'theme-dark' : 'theme-light'}`}>
      <div className={`min-h-screen ${isDark ? 'bg-[#090909] text-[#f5e7c4]' : 'bg-[#f5efe2] text-[#111111]'}`}>
        <header className={`${isDark ? 'bg-gradient-to-br from-[#1a1207] via-[#2e1d09] to-[#8a6323] text-[#f9e8b5]' : 'bg-gradient-to-br from-[#0f0f0f] via-[#2b2b2b] to-[#6e5d4e] text-[#f8f0d8]'} shadow-[0_18px_45px_rgba(212,175,55,0.15)]`}>
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className={`text-[10px] uppercase tracking-[0.25em] ${isDark ? 'text-[#d9b86c]' : 'text-[#d7c38f]'}`}>Community event & fund portal</p>
                <h1 className={`mt-2 text-2xl font-bold sm:text-3xl ${isDark ? 'text-[#f8e8be]' : 'text-[#f9f1d7]'}`}>{appConfig.apartmentName}</h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTheme(isDark ? 'light' : 'dark')}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${isDark ? 'border-[#d4af37]/40 bg-[#201b12] text-[#f7e8b5] hover:bg-[#2a2113]' : 'border-[#111111]/20 bg-[#171717] text-[#f5efe0] hover:bg-[#2a2a2a]'}`}
                >
                  {isDark ? <SunMedium size={16} /> : <MoonStar size={16} />}
                  {isDark ? 'Light mode' : 'Dark mode'}
                </button>

                <button
                  type="button"
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium sm:w-auto ${isDark ? 'border-[#d4af37]/40 bg-[#201b12] text-[#f7e8b5] hover:bg-[#2a2113]' : 'border-[#111111]/20 bg-[#111111] text-[#f7f0dc] hover:bg-[#2f2a25]'}`}
                  onClick={() => setShowAdmin(true)}
                >
                  {adminReady ? <ShieldCheck size={16} /> : <Lock size={16} />}
                  {adminReady ? 'Organizer' : 'Organizer login'}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
          <section className={`${isDark ? 'rounded-3xl border border-[#d4af37]/30 bg-[#121212] p-5 shadow-[0_16px_36px_rgba(12,10,7,0.8)]' : 'rounded-3xl border border-[#1b1b1b]/10 bg-[#f9f3e7] p-5 shadow-[0_14px_30px_rgba(17,17,17,0.08)]'}`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${isDark ? 'bg-[#d4af37]/15 text-[#f0d786]' : 'bg-[#111111] text-[#f5efe0]'}`}>Live</span>
                <h2 className={`mt-2 text-2xl font-bold ${isDark ? 'text-[#f5e7c4]' : 'text-[#141414]'}`}>{data.activeEvent ? data.activeEvent.name : 'No active event'}</h2>
                {data.activeEvent && <p className={`mt-1 text-sm ${isDark ? 'text-[#d6c296]' : 'text-[#4a4138]'}`}>{fmtDate(data.activeEvent.startDate)} - {fmtDate(data.activeEvent.endDate)}</p>}
              </div>

              {data.activeEvent && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    className={isDark ? 'bg-[#d4af37] text-[#17130a] hover:bg-[#e5c76d]' : 'bg-[#111111] text-[#f7f0dc] hover:bg-[#2a2a2a]'}
                    onClick={() => setShowUPI(true)}
                  >
                    <QrCode size={16} /> Contribute via UPI
                  </Button>
                  <Button
                    variant="outline"
                    className={isDark ? 'border-[#d4af37]/40 bg-[#1d1a15] text-[#f5e7c4] hover:bg-[#261f17]' : 'border-[#111111]/20 bg-[#f4ebd7] text-[#111111] hover:bg-[#e7d7b4]'}
                    onClick={() => setShowProof(true)}
                  >
                    <Upload size={16} /> Submit proof
                  </Button>
                </div>
              )}
            </div>

            {data.activeEvent && (
              <div className="mt-6">
                <div className={`mb-2 flex items-center justify-between text-sm ${isDark ? 'text-[#d3bb7d]' : 'text-[#2d2a28]'}`}>
                  <span>
                    {INR(raised)} <span className={isDark ? 'text-[#a9976f]' : 'text-[#5c554d]'}>/ {INR(data.activeEvent.target)}</span>
                  </span>
                  <span className={`font-semibold ${isDark ? 'text-[#f0d786]' : 'text-[#111111]'}`}>{progressPercentage}%</span>
                </div>
                <div className={`h-3 overflow-hidden rounded-full ${isDark ? 'bg-[#1d1a15]' : 'bg-[#e6dcc4]'}`}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#111111] to-[#7a6849] transition-all duration-700"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </section>

          {loading && (
            <section className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-soft">
              Loading portal data…
            </section>
          )}

          {!loading && (
            <section className={`${isDark ? 'overflow-hidden rounded-3xl border border-[#d4af37]/30 bg-[#121212] shadow-[0_16px_36px_rgba(12,10,7,0.8)]' : 'overflow-hidden rounded-3xl border border-[#1b1b1b]/10 bg-[#f9f3e7] shadow-[0_14px_30px_rgba(17,17,17,0.08)]'}`}>
              <div className={`flex border-b ${isDark ? 'border-[#d4af37]/30' : 'border-[#1b1b1b]/10'} text-sm font-medium`}>
                { [
                  ['income', 'Income'],
                  ['expenses', 'Expenses & bills'],
                  ['history', 'History & reserve'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={`flex-1 px-4 py-3 ${tab === key ? (isDark ? 'border-b-2 border-[#d4af37] text-[#f0d786]' : 'border-b-2 border-[#111111] text-[#111111]') : (isDark ? 'text-[#d3bb7d]' : 'text-[#3d3d3d]')}`}
                    onClick={() => setTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-4 sm:p-5">
                {tab === 'income' && (
                  <>
                    <div className="relative mb-4">
                      <Search size={16} className={`absolute left-3 top-3.5 ${isDark ? 'text-[#c7a45c]' : 'text-[#4a4138]'}`} />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search flat no. or resident name"
                        className={`w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 ${isDark ? 'border-[#d4af37]/30 bg-[#1a1a1a] text-[#f5e7c4] placeholder:text-[#9c8860] focus:border-[#d4af37] focus:ring-[#d4af37]/20' : 'border-[#1b1b1b]/15 bg-[#f4ebd7] text-[#111111] placeholder:text-[#6d6254] focus:border-[#111111] focus:ring-[#111111]/10'}`}
                      />
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead>
                          <tr className={isDark ? 'border-b border-[#d4af37]/20 text-[#d7bf7d]' : 'border-b border-[#1b1b1b]/10 text-[#2d2a28]'}
                          >
                            <th className="pb-2 pr-4 font-medium">Flat</th>
                            <th className="pb-2 pr-4 font-medium">Resident</th>
                            <th className="pb-2 pr-4 text-right font-medium">Amount</th>
                            <th className="pb-2 pr-4 font-medium">Mode</th>
                            <th className="pb-2 pr-4 font-medium">Status</th>
                            <th className="pb-2 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDonations.map((donation) => (
                            <tr key={donation.id} className={isDark ? 'border-b border-[#2a241b] align-middle' : 'border-b border-[#e2d6b8] align-middle'}>
                              <td className={`py-3 pr-4 font-medium ${isDark ? 'text-[#f2dfac]' : 'text-[#141414]'}`}>{donation.flat}</td>
                              <td className={`py-3 pr-4 ${isDark ? 'text-[#ead9a2]' : 'text-[#2e2a27]'}`}>{donation.residentName || 'Anonymous'}</td>
                              <td className={`py-3 pr-4 text-right font-semibold ${isDark ? 'text-[#f7eac3]' : 'text-[#111111]'}`}>{INR(donation.amount)}</td>
                              <td className={`py-3 pr-4 ${isDark ? 'text-[#d4b469]' : 'text-[#52473d]'}`}>{donation.mode}</td>
                              <td className="py-3 pr-4"><Badge status={donation.status} /></td>
                              <td className={`py-3 ${isDark ? 'text-[#b9a26d]' : 'text-[#5b5149]'}`}>{fmtDate(donation.date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {!filteredDonations.length && (
                      <div className={`rounded-2xl px-4 py-8 text-center text-sm ${isDark ? 'bg-[#1a1a1a] text-[#d3bb7d]' : 'bg-[#f1e5c9] text-[#2d2a28]'}`}>No donations match this search.</div>
                    )}
                  </>
                )}

                {tab === 'expenses' && (
                  <div className="space-y-3">
                    {data.expenses.map((expense) => (
                      <div key={expense.id} className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${isDark ? 'border-[#d4af37]/20 bg-[#17130d]' : 'border-[#1b1b1b]/10 bg-[#f4ebd7]'}`}>
                        <div className="min-w-0">
                          <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${isDark ? 'bg-[#d4af37]/15 text-[#f0d786]' : 'bg-[#111111] text-[#f5efe0]'}`}>
                            {expense.category}
                          </span>
                          <p className={`mt-2 font-semibold ${isDark ? 'text-[#f5e7c4]' : 'text-[#111111]'}`}>{expense.description}</p>
                          <p className={`mt-1 text-xs ${isDark ? 'text-[#c0a668]' : 'text-[#4d4a47]'}`}>{expense.vendor} · {fmtDate(expense.date)}</p>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          <p className={`text-lg font-bold ${isDark ? 'text-[#f7eac3]' : 'text-[#111111]'}`}>{INR(expense.amount)}</p>
                          <button
                            type="button"
                            onClick={() => setReceiptModal(expense)}
                            className={`mt-1 inline-flex items-center gap-2 text-xs font-medium ${isDark ? 'text-[#f0d786] hover:text-[#f9e8b5]' : 'text-[#111111] hover:text-[#3b3b3b]'}`}
                          >
                            <Receipt size={12} /> View receipt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {tab === 'history' && (
                  <div className="space-y-3">
                    {data.history.map((entry) => {
                      const diff = entry.raised - entry.spent;
                      return (
                        <div key={entry.id} className={`rounded-2xl border p-4 ${isDark ? 'border-[#d4af37]/20 bg-[#17130d]' : 'border-[#1b1b1b]/10 bg-[#f4ebd7]'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <h3 className={isDark ? 'font-semibold text-[#f5e7c4]' : 'font-semibold text-[#111111]'}>{entry.name}</h3>
                            <span className={isDark ? 'text-xs text-[#c0a668]' : 'text-xs text-[#554f49]'}>{fmtDate(entry.date)}</span>
                          </div>
                          <div className="mt-4 grid gap-3 sm:grid-cols-4">
                            <div>
                              <p className={`text-[11px] uppercase tracking-[0.12em] ${isDark ? 'text-[#d7bf7d]' : 'text-[#3d3d3d]'}`}>Budget</p>
                              <p className={`mt-1 font-semibold ${isDark ? 'text-[#f7eac3]' : 'text-[#111111]'}`}>{INR(entry.target)}</p>
                            </div>
                            <div>
                              <p className={`text-[11px] uppercase tracking-[0.12em] ${isDark ? 'text-[#d7bf7d]' : 'text-[#3d3d3d]'}`}>Raised</p>
                              <p className={`mt-1 font-semibold ${isDark ? 'text-[#f7eac3]' : 'text-[#111111]'}`}>{INR(entry.raised)}</p>
                            </div>
                            <div>
                              <p className={`text-[11px] uppercase tracking-[0.12em] ${isDark ? 'text-[#d7bf7d]' : 'text-[#3d3d3d]'}`}>Spent</p>
                              <p className={`mt-1 font-semibold ${isDark ? 'text-[#f7eac3]' : 'text-[#111111]'}`}>{INR(entry.spent)}</p>
                            </div>
                            <div>
                              <p className={`text-[11px] uppercase tracking-[0.12em] ${isDark ? 'text-[#d7bf7d]' : 'text-[#3d3d3d]'}`}>{diff >= 0 ? 'Surplus' : 'Deficit'}</p>
                              <p className={`mt-1 font-semibold ${diff >= 0 ? (isDark ? 'text-[#8ee0a8]' : 'text-[#1a6b3f]') : (isDark ? 'text-[#f7b7b7]' : 'text-[#9a2b2b]')}`}>
                                {diff >= 0 ? '+' : '-'}{INR(Math.abs(diff))}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {data.history.length > 0 && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => downloadEventSummary(data.history[0])}
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium ${isDark ? 'border-[#d4af37]/40 bg-[#1f1a12] text-[#f0d786] hover:bg-[#2b241a]' : 'border-[#111111]/15 bg-[#111111] text-[#f7f0dc] hover:bg-[#2a2a2a]'}`}
                        >
                          <Download size={14} /> Download summary
                        </button>
                      </div>
                    )}

                    <div className={`rounded-2xl p-4 text-sm ${isDark ? 'bg-[#17130d] text-[#e8d4a3]' : 'bg-[#f1e5c9] text-[#1b1b1b]'}`}>
                      <span className={isDark ? 'font-semibold text-[#f7eac3]' : 'font-semibold text-[#111111]'}>Reserve fund:</span> {INR(data.reserveFund)} carried forward for future community events.
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>

        {showUPI && (
          <Modal title="Contribute via UPI" onClose={() => setShowUPI(false)}>
            <div className="flex flex-col items-center">
              <FakeQR />
              <p className="mt-3 text-xs text-slate-500">Placeholder QR code — replace with your real one</p>
              <div className="mt-4 flex w-full items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm">
                <code className="break-all text-slate-700">{UPI_ID}</code>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"
                  onClick={() => {
                    navigator.clipboard?.writeText(UPI_ID);
                    notify('UPI ID copied');
                  }}
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-600">
              <li>Pay using the UPI ID or QR code.</li>
              <li>Save your UTR / reference number.</li>
              <li>Submit proof of payment from this page.</li>
              <li>Once verified, the amount appears in the public ledger.</li>
            </ol>

            <Button
              className="mt-5 w-full"
              onClick={() => {
                setShowUPI(false);
                setShowProof(true);
              }}
            >
              <ArrowUpRight size={16} /> I have paid — submit proof
            </Button>
          </Modal>
        )}

        {showProof && (
          <ProofForm
            onClose={() => setShowProof(false)}
            onSubmit={async (payload) => {
              const active = data.activeEvent;
              const pendingEntry = {
                id: uid(),
                flat: payload.flat,
                residentName: payload.name,
                amount: Number(payload.amount),
                paymentMode: 'UPI',
                referenceNo: payload.utr,
                screenshotUrl: payload.screenshotUrl || '',
                status: 'Pending',
                submittedAt: today(),
              };

              setData((previous) => ({
                ...previous,
                pendingPayments: [...previous.pendingPayments, pendingEntry],
              }));

              if (active) {
                try {
                  const result = await submitPaymentProof(payload, active.id);
                  if (result.ok) {
                    notify('Payment proof submitted for verification');
                  } else {
                    console.error('Supabase submitPaymentProof failed:', result.error);
                    notify('Saved locally; Supabase rejected the insert. Check RLS or schema.');
                  }
                } catch (error) {
                  console.error('submitPaymentProof threw:', error);
                  notify('Saved locally; API request failed.');
                }
              } else {
                notify('No active event found. Submission saved locally for review.');
              }

              setShowProof(false);
            }}
          />
        )}

        {showAdmin && (
          <Modal title="Organizer panel" wide onClose={() => setShowAdmin(false)}>
            {!adminReady ? (
              renderedAdminLogin
            ) : (
              <AdminPanel
                data={data}
                setData={setData}
                onClose={() => setShowAdmin(false)}
                onLogout={() => {
                  setAdminReady(false);
                  setShowAdmin(false);
                }}
                notify={notify}
              />
            )}
          </Modal>
        )}

        {receiptModal && (
          <Modal title="Expense receipt" onClose={() => setReceiptModal(null)}>
            {(() => {
              const receiptUrl = receiptModal.receipt || receiptModal.receipt_url || receiptModal.receipt_path || '';
              return receiptUrl ? (
                <>
                  <img
                    src={receiptUrl}
                    alt="Expense receipt"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                      const fallback = event.currentTarget.nextElementSibling;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                    className="mx-auto max-h-[70vh] max-w-full rounded-2xl border border-slate-200"
                    style={{ width: 'auto', height: 'auto', display: 'block' }}
                  />
                  <div className="hidden min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                    No receipt image available.
                  </div>
                </>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                  No receipt image available.
                </div>
              );
            })()}
          </Modal>
        )}

        {toast && (
          <div className="fixed bottom-5 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function AdminPanel({ data, setData, onClose, onLogout, notify }) {
  const [tab, setTab] = useState('pending');
  const [newEvent, setNewEvent] = useState({ name: '', target: '', startDate: today(), endDate: today() });
  const [donationForm, setDonationForm] = useState({ flat: '', name: '', amount: '', mode: 'UPI' });
  const [expenseForm, setExpenseForm] = useState({ category: 'Pooja', description: '', vendor: '', amount: '', receipt: '' });

  const activeEvent = data.activeEvent;
  const verifiedRaised = data.donations.filter((item) => item.status === 'Verified').reduce((sum, item) => sum + Number(item.amount), 0);
  const totalSpent = data.expenses.reduce((sum, item) => sum + Number(item.amount), 0);
  const net = verifiedRaised - totalSpent;

  const approvePayment = async (paymentId, shouldVerify) => {
    const result = await approvePaymentRecord(paymentId, shouldVerify);

    if (result.ok) {
      const paymentToMove = data.pendingPayments.find((item) => item.id === paymentId);

      setData((previous) => ({
        ...previous,
        pendingPayments: previous.pendingPayments.filter((item) => item.id !== paymentId),
        donations: shouldVerify && paymentToMove
          ? [
              ...previous.donations,
              {
                id: uid(),
                flat: paymentToMove.flat,
                residentName: paymentToMove.residentName,
                amount: Number(paymentToMove.amount),
                mode: paymentToMove.paymentMode || 'UPI',
                status: 'Verified',
                date: today(),
              },
            ]
          : previous.donations,
      }));

      notify(shouldVerify ? 'Payment verified and added to ledger' : 'Payment rejected');
    } else {
      notify('Verification update failed');
    }
  };

  const visiblePendingPayments = data.pendingPayments.filter((item) => !item.isVerified && item.status !== 'Verified');

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        { [
          ['pending', `Pending (${visiblePendingPayments.length})`],
          ['donation', 'Log donation'],
          ['expense', 'Log expense'],
          ['event', 'New event'],
          ['settle', 'Settle event'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-3 py-1.5 text-sm ${tab === key ? 'bg-orange-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            {label}
          </button>
        ))}

        <button type="button" className="ml-auto rounded-full px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={onLogout}>Logout</button>
      </div>

      {tab === 'pending' && (
        <div className="space-y-3">
          {visiblePendingPayments.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">No payment proofs pending.</div>
          ) : (
            visiblePendingPayments.map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{payment.flat} · {payment.residentName}</p>
                    <p className="text-xs text-slate-500">UTR: {payment.referenceNo} · {INR(payment.amount)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="soft" onClick={() => approvePayment(payment.id, true)}>
                      <Check size={14} /> Verify
                    </Button>
                    <Button variant="outline" onClick={() => approvePayment(payment.id, false)}>
                      <X size={14} /> Reject
                    </Button>
                  </div>
                </div>
                {payment.screenshotUrl && (
                  <img src={payment.screenshotUrl} alt="Payment proof" className="mt-3 h-32 rounded-xl border border-slate-200 object-cover" />
                )}
              </div>
            ))
          )}
          
        </div>
      )}

      {tab === 'donation' && (
        <div>
          {activeEvent ? (
            <>
              <Input label="Flat No." value={donationForm.flat} onChange={(event) => setDonationForm({ ...donationForm, flat: event.target.value })} placeholder="A-101" />
              <Input label="Resident Name" value={donationForm.name} onChange={(event) => setDonationForm({ ...donationForm, name: event.target.value })} placeholder="Resident name" />
              <Input label="Amount (₹)" type="number" value={donationForm.amount} onChange={(event) => setDonationForm({ ...donationForm, amount: event.target.value })} placeholder="2000" />
              <label className="mb-3 block text-sm text-slate-700">
                <span className="mb-1 block">Payment mode</span>
                <select
                  value={donationForm.mode}
                  onChange={(event) => setDonationForm({ ...donationForm, "mode": event.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                </select>
              </label>

              <Button
                className="w-full"
                onClick={async () => {
                  const amount = Number(donationForm.amount);
                  if (!donationForm.flat || !amount) return;

                  const result = await createDonationRecord({
                    eventId: activeEvent.id,
                    flat: donationForm.flat,
                    name: donationForm.name || 'Anonymous',
                    amount,
                    mode: donationForm.mode,
                  });

                  if (result.ok) {
                    setData((previous) => ({
                      ...previous,
                      donations: [
                        ...previous.donations,
                        {
                          id: uid(),
                          flat: donationForm.flat,
                          residentName: donationForm.name || 'Anonymous',
                          amount,
                          mode: donationForm.mode,
                          status: 'Verified',
                          date: today(),
                        },
                      ],
                    }));
                    setDonationForm({ flat: '', name: '', amount: '', mode: 'UPI' });
                    notify('Donation added to the ledger');
                  }
                }}
              >
                <Plus size={16} /> Log donation
              </Button>
            </>
          ) : (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Create an event first to begin logging donations.</div>
          )}
        </div>
      )}

      {tab === 'expense' && (
        <div>
          {activeEvent ? (
            <>
              <label className="mb-3 block text-sm text-slate-700">
                <span className="mb-1 block">Category</span>
                <select
                  value={expenseForm.category}
                  onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  {['Pooja', 'Catering', 'Decoration', 'Sound', 'Miscellaneous'].map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <Input label="Description" value={expenseForm.description} onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })} placeholder="Prasadam food for 250 guests" />
              <Input label="Vendor" value={expenseForm.vendor} onChange={(event) => setExpenseForm({ ...expenseForm, vendor: event.target.value })} placeholder="Annapurna Caterers" />
              <Input label="Amount (₹)" type="number" value={expenseForm.amount} onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} placeholder="15000" />
              <label className="mb-4 block text-sm text-slate-700">
                <span className="mb-1 block">Receipt image</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    const base64 = await readFile(file);
                    setExpenseForm({ ...expenseForm, receipt: base64 || '' });
                  }}
                  className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-none file:bg-orange-100 file:px-3 file:py-1.5 file:text-orange-700"
                />
              </label>

              <Button
                className="w-full"
                onClick={async () => {
                  const amount = Number(expenseForm.amount);
                  if (!expenseForm.description || !amount) return;

                  const result = await createExpenseRecord({
                    eventId: activeEvent.id,
                    category: expenseForm.category,
                    description: expenseForm.description,
                    vendor: expenseForm.vendor || 'N/A',
                    amount,
                    receipt: expenseForm.receipt || '',
                  });

                  if (result.ok) {
                    setData((previous) => ({
                      ...previous,
                      expenses: [
                        ...previous.expenses,
                        {
                          id: uid(),
                          category: expenseForm.category,
                          description: expenseForm.description,
                          vendor: expenseForm.vendor || 'N/A',
                          amount,
                          date: today(),
                          receipt: expenseForm.receipt || 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=80',
                        },
                      ],
                    }));
                    setExpenseForm({ category: 'Pooja', description: '', vendor: '', amount: '', receipt: '' });
                    notify('Expense added to the ledger');
                  }
                }}
              >
                <Plus size={16} /> Add expense
              </Button>
            </>
          ) : (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Create an event first to begin logging expenses.</div>
          )}
        </div>
      )}

      {tab === 'event' && (
        <div>
          {activeEvent ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">The active event is <span className="font-semibold text-slate-800">{activeEvent.name}</span>. Settle it before creating a new one.</div>
          ) : (
            <>
              <Input label="Event name" value={newEvent.name} onChange={(event) => setNewEvent({ ...newEvent, name: event.target.value })} placeholder="Diwali 2026" />
              <Input label="Target budget (₹)" type="number" value={newEvent.target} onChange={(event) => setNewEvent({ ...newEvent, target: event.target.value })} placeholder="50000" />
              <Input label="Start date" type="date" value={newEvent.startDate} onChange={(event) => setNewEvent({ ...newEvent, startDate: event.target.value })} />
              <Input label="End date" type="date" value={newEvent.endDate} onChange={(event) => setNewEvent({ ...newEvent, endDate: event.target.value })} />

              <Button
                className="w-full"
                onClick={async () => {
                  if (!newEvent.name || !Number(newEvent.target)) return;

                  const result = await createEventRecord({
                    name: newEvent.name,
                    target: Number(newEvent.target),
                    startDate: newEvent.startDate,
                    endDate: newEvent.endDate,
                  });

                  if (result.ok) {
                    setData((previous) => ({
                      ...previous,
                      activeEvent: {
                        id: result.data?.id ?? uid(),
                        name: newEvent.name,
                        target: Number(newEvent.target),
                        startDate: newEvent.startDate,
                        endDate: newEvent.endDate,
                        status: 'active',
                      },
                    }));
                    setNewEvent({ name: '', target: '', startDate: today(), endDate: today() });
                    notify('New event created');
                  }
                }}
              >
                <Plus size={16} /> Create event
              </Button>
            </>
          )}
        </div>
      )}

      {tab === 'settle' && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          {activeEvent ? (
            <>
              <p className="text-sm text-slate-600">Raised (verified) <span className="font-semibold text-slate-800">{INR(verifiedRaised)}</span></p>
              <p className="mt-2 text-sm text-slate-600">Spent <span className="font-semibold text-slate-800">{INR(totalSpent)}</span></p>
              <p className="mt-4 text-2xl font-bold text-slate-800">
                {net >= 0 ? 'Surplus' : 'Deficit'} {INR(Math.abs(net))}
              </p>
              <p className="mt-2 text-sm text-slate-500">This amount will be carried into the reserve fund after the event is settled.</p>

              <Button
                className="mt-4 w-full"
                onClick={async () => {
                  const result = await settleCurrentEvent(activeEvent);
                  if (result.ok) {
                    const nextReserve = data.reserveFund + (result.net ?? net);
                    setData((previous) => ({
                      ...previous,
                      reserveFund: nextReserve,
                      history: [
                        {
                          id: uid(),
                          name: previous.activeEvent.name,
                          target: previous.activeEvent.target,
                          raised: verifiedRaised,
                          spent: totalSpent,
                          date: today(),
                        },
                        ...previous.history,
                      ],
                      activeEvent: null,
                    }));
                    notify(`Event settled: ${result.net >= 0 ? 'added' : 'deducted'} ${INR(Math.abs(result.net ?? net))} to reserve fund`);
                  }
                }}
              >
                <Check size={16} /> Settle event
              </Button>

              <Button
                variant="outline"
                className="mt-2 w-full"
                onClick={() => downloadEventSummary(activeEvent)}
              >
                <Receipt size={16} /> Download summary
              </Button>
            </>
          ) : (
            <div className="text-sm text-slate-500">No active event to settle.</div>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}

export default App;
