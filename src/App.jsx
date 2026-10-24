import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  IndianRupee,
  Lock,
  PiggyBank,
  Plus,
  QrCode,
  Receipt,
  Search,
  ShieldCheck,
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
  return (
    <label className="mb-3 block text-sm text-slate-700">
      <span className="mb-1 block">{label}</span>
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

  const flatValid = String(form.flat).trim().length > 0;
  const nameValid = String(form.name).trim().length > 0;
  const amountValid = Number(form.amount) > 0;
  const utrValid = String(form.utr).trim().length >= 8;
  const screenshotValid = Boolean(screenshot && screenshot.trim().length > 0);
  const valid = flatValid && nameValid && amountValid && utrValid && screenshotValid;

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = () => {
    if (!valid || typeof onSubmit !== 'function') return;
    onSubmit({
      flat: String(form.flat).trim(),
      name: String(form.name).trim(),
      amount: Number(form.amount),
      utr: String(form.utr).trim(),
      screenshotUrl: screenshot,
    });
  };

  return (
    <Modal title="Submit payment proof" onClose={onClose}>
      <Input label="Flat No." value={form.flat} onChange={update('flat')} placeholder="A-101" />
      <Input label="Resident Name" value={form.name} onChange={update('name')} placeholder="Your name" />
      <Input label="Amount (₹)" type="number" value={form.amount} onChange={update('amount')} placeholder="2000" />
      <Input label="UTR / Reference No. (min 8 digits)" value={form.utr} onChange={update('utr')} placeholder="123456789012" />
      <label className="mb-4 block text-sm text-slate-700">
        <span className="mb-1 block">Screenshot upload</span>
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

function LoginBox({ onSuccess }) {
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
          if (password === appConfig.adminPassword) {
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
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-gradient-to-br from-orange-600 via-orange-600 to-rose-600 text-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-orange-100">Community event & fund portal</p>
              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{appConfig.apartmentName}</h1>
            </div>
            <button
              type="button"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 sm:w-auto"
              onClick={() => setShowAdmin(true)}
            >
              {adminReady ? <ShieldCheck size={16} /> : <Lock size={16} />}
              {adminReady ? 'Organizer' : 'Organizer login'}
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {renderStatCard('Funds raised', INR(raised), <TrendingUp size={14} />, 'text-emerald-200')}
            {renderStatCard('Total spent', INR(spent), <Wallet size={14} />, 'text-white')}
            {renderStatCard(netBalance >= 0 ? 'Surplus' : 'Deficit', INR(Math.abs(netBalance)), <IndianRupee size={14} />, netBalance >= 0 ? 'text-emerald-200' : 'text-amber-200')}
            {renderStatCard('Reserve fund', INR(data.reserveFund), <PiggyBank size={14} />, 'text-sky-200')}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Live</span>
              <h2 className="mt-2 text-2xl font-bold text-slate-800">{data.activeEvent ? data.activeEvent.name : 'No active event'}</h2>
              {data.activeEvent && <p className="mt-1 text-sm text-slate-500">{fmtDate(data.activeEvent.startDate)} - {fmtDate(data.activeEvent.endDate)}</p>}
            </div>

            {data.activeEvent && (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setShowUPI(true)}>
                  <QrCode size={16} /> Contribute via UPI
                </Button>
                <Button variant="outline" onClick={() => setShowProof(true)}>
                  <Upload size={16} /> Submit proof
                </Button>
              </div>
            )}
          </div>

          {data.activeEvent && (
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
                <span>
                  {INR(raised)} <span className="text-slate-400">/ {INR(data.activeEvent.target)}</span>
                </span>
                <span className="font-semibold text-orange-600">{progressPercentage}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-700"
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
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
            <div className="flex border-b border-slate-200 text-sm font-medium">
              { [
                ['income', 'Income'],
                ['expenses', 'Expenses & bills'],
                ['history', 'History & reserve'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`flex-1 px-4 py-3 ${tab === key ? 'border-b-2 border-orange-600 text-orange-600' : 'text-slate-500'}`}
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
                    <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search flat no. or resident name"
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
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
                          <tr key={donation.id} className="border-b border-slate-100 align-middle">
                            <td className="py-3 pr-4 font-medium text-slate-800">{donation.flat}</td>
                            <td className="py-3 pr-4 text-slate-700">{donation.residentName || 'Anonymous'}</td>
                            <td className="py-3 pr-4 text-right font-semibold text-slate-800">{INR(donation.amount)}</td>
                            <td className="py-3 pr-4 text-slate-600">{donation.mode}</td>
                            <td className="py-3 pr-4"><Badge status={donation.status} /></td>
                            <td className="py-3 text-slate-500">{fmtDate(donation.date)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {!filteredDonations.length && (
                    <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No donations match this search.</div>
                  )}
                </>
              )}

              {tab === 'expenses' && (
                <div className="space-y-3">
                  {data.expenses.map((expense) => (
                    <div key={expense.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <span className="inline-flex rounded-full bg-orange-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-700">
                          {expense.category}
                        </span>
                        <p className="mt-2 font-semibold text-slate-800">{expense.description}</p>
                        <p className="mt-1 text-xs text-slate-500">{expense.vendor} · {fmtDate(expense.date)}</p>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-lg font-bold text-slate-800">{INR(expense.amount)}</p>
                        <button
                          type="button"
                          onClick={() => setReceiptModal(expense)}
                          className="mt-1 inline-flex items-center gap-2 text-xs font-medium text-orange-600 hover:text-orange-700"
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
                      <div key={entry.id} className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-slate-800">{entry.name}</h3>
                          <span className="text-xs text-slate-500">{fmtDate(entry.date)}</span>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-4">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Budget</p>
                            <p className="mt-1 font-semibold text-slate-800">{INR(entry.target)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Raised</p>
                            <p className="mt-1 font-semibold text-slate-800">{INR(entry.raised)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Spent</p>
                            <p className="mt-1 font-semibold text-slate-800">{INR(entry.spent)}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{diff >= 0 ? 'Surplus' : 'Deficit'}</p>
                            <p className={`mt-1 font-semibold ${diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {diff >= 0 ? '+' : '-'}{INR(Math.abs(diff))}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    <span className="font-semibold text-slate-800">Reserve fund:</span> {INR(data.reserveFund)} carried forward for future community events.
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

          <Button className="mt-5 w-full" onClick={() => {
            setShowUPI(false);
            setShowProof(true);
          }}>
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
            <LoginBox onSuccess={() => setAdminReady(true)} />
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
        <Modal title={`${receiptModal.category} • ${INR(receiptModal.amount)}`} onClose={() => setReceiptModal(null)}>
          {(() => {
            const receiptUrl = receiptModal.receipt || receiptModal.receipt_url || receiptModal.receipt_path || '';
            return receiptUrl ? (
              <>
                <img
                  src={receiptUrl}
                  alt="Receipt"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                    const fallback = event.currentTarget.nextSibling;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                  className="max-h-[70vh] w-full rounded-2xl border border-slate-200 object-cover"
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
                  onChange={(event) => setDonationForm({ ...donationForm, mode: event.target.value })}
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
