// Sri Balaji Serene - Community Event & Fund Portal
// Run: npm create vite@latest portal -- --template react && cd portal
//      npm i lucide-react && add Tailwind (https://tailwindcss.com/docs/installation/using-vite)
//      replace src/App.jsx with this file.
// All data lives in React state (mock). See the TODO(supabase) notes to wire up the backend.
import React, { useMemo, useState } from "react";
import {
  IndianRupee, QrCode, Search, Clock, Receipt, X, Lock, Upload, CheckCircle2,
  Wallet, TrendingUp, PiggyBank, ShieldCheck, Plus, Check, Copy,
} from "lucide-react";

const UPI_ID = "sribalajiserene@okhdfcbank"; // TODO: your association's UPI ID
const ADMIN_PASSWORD = "balaji123"; // TODO(supabase): replace with supabase.auth.signInWithPassword
const inr = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const uid = () => Math.random().toString(36).slice(2, 9);

// placeholder receipt image so the viewer works without uploads
const fakeReceipt = (title, amt) =>
  "data:image/svg+xml;utf8," + encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='480'><rect width='100%' height='100%' fill='#fffdf5'/><text x='24' y='60' font-size='22' font-family='monospace' font-weight='bold'>${title}</text><text x='24' y='100' font-size='14' font-family='monospace'>TAX INVOICE (sample)</text><line x1='24' y1='120' x2='336' y2='120' stroke='#999'/><text x='24' y='400' font-size='20' font-family='monospace'>TOTAL: Rs ${amt}</text></svg>`
  );

const seed = {
  reserve: 18500,
  event: { id: "e3", name: "Ganesh Chaturthi 2026", target: 50000, start: "2026-08-20", end: "2026-09-03" },
  donations: [
    { id: "d1", flat: "A-101", name: "Ramesh Kumar", amount: 2000, mode: "UPI", status: "Verified", date: "2026-08-12" },
    { id: "d2", flat: "A-204", name: "Anonymous", amount: 1500, mode: "Cash", status: "Verified", date: "2026-08-13" },
    { id: "d3", flat: "B-302", name: "Lakshmi Devi", amount: 3000, mode: "UPI", status: "Verified", date: "2026-08-14" },
    { id: "d4", flat: "B-105", name: "Suresh Reddy", amount: 2500, mode: "UPI", status: "Verified", date: "2026-08-15" },
    { id: "d5", flat: "C-401", name: "Anita Sharma", amount: 1000, mode: "UPI", status: "Pending", date: "2026-08-18" },
    ...Array.from({ length: 15 }, (_, i) => ({
      id: "x" + i, flat: ["A", "B", "C"][i % 3] + "-" + (100 + i * 7), name: i % 5 === 0 ? "Anonymous" : "Resident " + (i + 1),
      amount: 2000, mode: i % 2 ? "Cash" : "UPI", status: "Verified", date: "2026-08-" + String(16 + (i % 10)).padStart(2, "0"),
    })),
  ],
  expenses: [
    { id: "p1", category: "Pooja", desc: "Idol, flowers & pooja samagri", amount: 9500, date: "2026-08-20", vendor: "Sri Lakshmi Pooja Stores", receipt: fakeReceipt("Sri Lakshmi Pooja Stores", 9500) },
    { id: "p2", category: "Catering", desc: "Prasadam lunch for 250", amount: 17000, date: "2026-08-25", vendor: "Annapurna Caterers", receipt: fakeReceipt("Annapurna Caterers", 17000) },
    { id: "p3", category: "Decoration", desc: "Pandal & lighting", amount: 8000, date: "2026-08-19", vendor: "Shree Decorators", receipt: fakeReceipt("Shree Decorators", 8000) },
    { id: "p4", category: "Sound", desc: "DJ & speakers (2 days)", amount: 6000, date: "2026-08-24", vendor: "Beat Box Audio", receipt: fakeReceipt("Beat Box Audio", 6000) },
  ],
  pending: [{ id: "q1", flat: "C-210", name: "Mohan Rao", amount: 2000, utr: "412398765012", shot: null, date: "2026-08-22" }],
  history: [
    { id: "h1", name: "Diwali 2025", target: 40000, raised: 42500, spent: 38200, date: "2025-10-24" },
    { id: "h2", name: "New Year 2026", target: 30000, raised: 27500, spent: 31800, date: "2026-01-01" },
    { id: "h3", name: "Sankranti 2026", target: 20000, raised: 21000, spent: 19600, date: "2026-01-15" },
  ],
};

const Badge = ({ s }) => {
  const c = s === "Verified" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
  const Icon = s === "Verified" ? CheckCircle2 : Clock;
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${c}`}><Icon size={12} />{s}</span>;
};

const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
    <div className={`bg-white w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5`} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg">{title}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X size={20} /></button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, ...p }) => (
  <label className="block text-sm mb-3">
    <span className="text-slate-600">{label}</span>
    <input {...p} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400" />
  </label>
);
const Btn = ({ children, variant = "primary", ...p }) => (
  <button {...p} className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${variant === "primary" ? "bg-orange-600 text-white hover:bg-orange-700" : "border border-slate-300 hover:bg-slate-50"} ${p.className || ""}`}>{children}</button>
);

const readFile = (f) => new Promise((res) => { if (!f) return res(null); const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });

// Fake QR (visual placeholder). TODO: replace with <img src="/upi-qr.png"> of your real QR.
const FakeQR = () => {
  const cells = useMemo(() => Array.from({ length: 169 }, (_, i) => (i * 7919 + (i % 13) * 31) % 5 < 2), []);
  return (
    <div className="mx-auto grid w-44 h-44 border-4 border-white shadow bg-white" style={{ gridTemplateColumns: "repeat(13,1fr)" }}>
      {cells.map((on, i) => <div key={i} className={on ? "bg-slate-900" : "bg-white"} />)}
    </div>
  );
};

export default function App() {
  const [data, setData] = useState(seed);
  const [tab, setTab] = useState("income");
  const [q, setQ] = useState("");
  const [showUpi, setShowUpi] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState("");
  const notify = (m) => { setToast(m); setTimeout(() => setToast(""), 2500); };

  const { event, donations, expenses, reserve } = data;
  const raised = donations.filter((d) => d.status === "Verified").reduce((s, d) => s + d.amount, 0);
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const net = raised - spent;
  const pct = event ? Math.min(100, Math.round((raised / event.target) * 100)) : 0;

  const filtered = donations.filter((d) => (d.flat + d.name).toLowerCase().includes(q.toLowerCase()));

  const metric = (icon, label, value, tone) => (
    <div className="rounded-xl bg-white/10 backdrop-blur p-3">
      <div className="flex items-center gap-1.5 text-xs text-orange-100">{icon}{label}</div>
      <div className={`mt-1 text-lg sm:text-xl font-bold ${tone || ""}`}>{value}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header */}
      <header className="bg-gradient-to-br from-orange-600 to-rose-600 text-white">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-orange-100">Community Event & Fund Portal</p>
              <h1 className="text-xl sm:text-2xl font-bold">Sri Balaji Serene Apartment</h1>
            </div>
            <button onClick={() => setShowAdmin(true)} className="flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25">
              {isAdmin ? <ShieldCheck size={16} /> : <Lock size={16} />} {isAdmin ? "Admin" : "Organizer"}
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
            {metric(<TrendingUp size={14} />, "Funds Raised", inr(raised))}
            {metric(<Wallet size={14} />, "Total Spent", inr(spent))}
            {metric(<IndianRupee size={14} />, net >= 0 ? "Surplus" : "Deficit", inr(Math.abs(net)), net >= 0 ? "text-emerald-200" : "text-yellow-200")}
            {metric(<PiggyBank size={14} />, "Reserve Fund", inr(reserve))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 space-y-5">
        {/* Active event */}
        <section className="rounded-2xl bg-white p-5 shadow-sm border">
          {event ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">LIVE</span>
                  <h2 className="mt-1 text-lg font-semibold">{event.name}</h2>
                  <p className="text-xs text-slate-500">{fmt(event.start)} – {fmt(event.end)}</p>
                </div>
                <div className="flex gap-2">
                  <Btn onClick={() => setShowUpi(true)}><QrCode size={16} />Contribute via UPI</Btn>
                  <Btn variant="ghost" onClick={() => setShowProof(true)}><Upload size={16} />Submit proof</Btn>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{inr(raised)} <span className="text-slate-400">/ {inr(event.target)} target</span></span>
                  <span className="font-semibold text-orange-600">{pct}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-rose-500 transition-all duration-700" style={{ width: pct + "%" }} />
                </div>
              </div>
            </>
          ) : (
            <p className="text-slate-500 text-sm">No active event. Organizers can create one from the admin panel.</p>
          )}
        </section>

        {/* Ledger */}
        <section className="rounded-2xl bg-white shadow-sm border overflow-hidden">
          <div className="flex border-b text-sm">
            {[["income", "Income"], ["expenses", "Expenses & Bills"], ["history", "History & Rollover"]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={`flex-1 px-3 py-3 font-medium ${tab === k ? "border-b-2 border-orange-600 text-orange-600" : "text-slate-500"}`}>{l}</button>
            ))}
          </div>
          <div className="p-4">
            {tab === "income" && (
              <>
                <div className="relative mb-3">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search flat no. or name…" className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead><tr className="text-left text-xs uppercase text-slate-500"><th className="py-2">Flat</th><th>Resident</th><th className="text-right">Amount</th><th className="pl-4">Mode</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>
                      {filtered.map((d) => (
                        <tr key={d.id} className="border-t">
                          <td className="py-2 font-medium">{d.flat}</td>
                          <td className={d.name === "Anonymous" ? "italic text-slate-400" : ""}>{d.name || "Anonymous"}</td>
                          <td className="text-right font-semibold">{inr(d.amount)}</td>
                          <td className="pl-4">{d.mode}</td>
                          <td><Badge s={d.status} /></td>
                          <td className="text-slate-500">{fmt(d.date)}</td>
                        </tr>
                      ))}
                      {!filtered.length && <tr><td colSpan="6" className="py-6 text-center text-slate-400">No matches</td></tr>}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {tab === "expenses" && (
              <div className="space-y-2">
                {expenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="min-w-0">
                      <span className="text-xs rounded bg-orange-100 text-orange-700 px-1.5 py-0.5">{e.category}</span>
                      <p className="font-medium mt-1 truncate">{e.desc}</p>
                      <p className="text-xs text-slate-500">{e.vendor} · {fmt(e.date)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold">{inr(e.amount)}</p>
                      {e.receipt && <button onClick={() => setReceipt(e)} className="mt-1 inline-flex items-center gap-1 text-xs text-orange-600 hover:underline"><Receipt size={12} />View Receipt</button>}
                    </div>
                  </div>
                ))}
                {!expenses.length && <p className="py-6 text-center text-slate-400">No expenses logged yet</p>}
              </div>
            )}
            {tab === "history" && (
              <div className="space-y-2">
                {data.history.map((h) => {
                  const diff = h.raised - h.spent;
                  return (
                    <div key={h.id} className="rounded-xl border p-3">
                      <div className="flex justify-between"><p className="font-medium">{h.name}</p><span className="text-xs text-slate-500">{fmt(h.date)}</span></div>
                      <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-slate-500">
                        <div>Budget<p className="text-sm font-semibold text-slate-800">{inr(h.target)}</p></div>
                        <div>Raised<p className="text-sm font-semibold text-slate-800">{inr(h.raised)}</p></div>
                        <div>Spent<p className="text-sm font-semibold text-slate-800">{inr(h.spent)}</p></div>
                        <div>{diff >= 0 ? "Surplus" : "Deficit"}<p className={`text-sm font-semibold ${diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{diff >= 0 ? "+" : "−"}{inr(Math.abs(diff))}</p></div>
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-slate-500 pt-2">Surplus/deficit from each settled event rolls into the Reserve Fund (now {inr(reserve)}).</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {showUpi && (
        <Modal title="Contribute via UPI" onClose={() => setShowUpi(false)}>
          <FakeQR />
          <p className="text-center text-xs text-slate-400 mt-1">(placeholder QR — replace with your real one)</p>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-slate-100 px-3 py-2 text-sm">
            <code>{UPI_ID}</code>
            <button onClick={() => { navigator.clipboard?.writeText(UPI_ID); notify("UPI ID copied"); }}><Copy size={16} /></button>
          </div>
          <ol className="mt-3 list-decimal pl-5 text-sm text-slate-600 space-y-1">
            <li>Pay any amount using the QR or UPI ID.</li>
            <li>Note the UTR / reference number.</li>
            <li>Tap <b>Submit proof</b> with your flat number and screenshot.</li>
            <li>Your donation appears as <b>Verified</b> once an organizer confirms it.</li>
          </ol>
          <Btn className="w-full mt-4" onClick={() => { setShowUpi(false); setShowProof(true); }}>I've paid — submit proof</Btn>
        </Modal>
      )}

      {showProof && <ProofForm onClose={() => setShowProof(false)} onSubmit={(p) => { setData((d) => ({ ...d, pending: [...d.pending, { ...p, id: uid(), date: today() }] })); setShowProof(false); notify("Submitted for verification"); }} />}

      {receipt && (
        <Modal title={`${receipt.vendor} — ${inr(receipt.amount)}`} onClose={() => setReceipt(null)}>
          <img src={receipt.receipt} alt="Receipt" className="w-full rounded-lg border" />
        </Modal>
      )}

      {showAdmin && (
        <Modal title="Organizer Panel" wide onClose={() => setShowAdmin(false)}>
          {!isAdmin ? <Login onOk={() => setIsAdmin(true)} /> : <Admin data={data} setData={setData} notify={notify} raised={raised} spent={spent} logout={() => { setIsAdmin(false); setShowAdmin(false); }} />}
        </Modal>
      )}

      {toast && <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] rounded-full bg-slate-900 text-white px-4 py-2 text-sm shadow-lg">{toast}</div>}
    </div>
  );
}

function ProofForm({ onClose, onSubmit }) {
  const [f, setF] = useState({ flat: "", name: "", amount: "", utr: "" });
  const [file, setFile] = useState(null);
  const ok = f.flat && f.name && Number(f.amount) > 0 && f.utr.length >= 8;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Submit Payment Proof" onClose={onClose}>
      <Field label="Flat No." value={f.flat} onChange={set("flat")} placeholder="A-101" />
      <Field label="Your Name" value={f.name} onChange={set("name")} />
      <Field label="Amount (₹)" type="number" value={f.amount} onChange={set("amount")} />
      <Field label="UTR / Ref No. (min 8 chars)" value={f.utr} onChange={set("utr")} />
      <Field label="Payment screenshot" type="file" accept="image/*" onChange={async (e) => setFile(await readFile(e.target.files[0]))} />
      {/* TODO(supabase): upload file to 'proofs' bucket, insert into pending_payments */}
      <Btn className="w-full" disabled={!ok} onClick={() => onSubmit({ ...f, amount: Number(f.amount), shot: file })}>Submit for verification</Btn>
    </Modal>
  );
}

function Login({ onOk }) {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(false);
  return (
    <div>
      <Field label="Organizer password" type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(false); }} />
      {err && <p className="text-sm text-rose-600 mb-2">Incorrect password</p>}
      <Btn className="w-full" onClick={() => (pw === ADMIN_PASSWORD ? onOk() : setErr(true))}>Unlock</Btn>
      <p className="text-xs text-slate-400 mt-2">Demo password: balaji123</p>
    </div>
  );
}

function Admin({ data, setData, notify, raised, spent, logout }) {
  const [t, setT] = useState("pending");
  const { event } = data;
  const [ev, setEv] = useState({ name: "", target: "", start: today(), end: today() });
  const [dn, setDn] = useState({ flat: "", name: "", amount: "", mode: "Cash" });
  const [ex, setEx] = useState({ category: "Pooja", desc: "", amount: "", vendor: "", receipt: null });

  const approve = (p, yes) => setData((d) => ({
    ...d,
    pending: d.pending.filter((x) => x.id !== p.id),
    donations: yes ? [...d.donations, { id: uid(), flat: p.flat, name: p.name, amount: p.amount, mode: "UPI", status: "Verified", date: today() }] : d.donations,
  })) || notify(yes ? "Payment verified" : "Rejected");

  const settle = () => {
    const net = raised - spent;
    setData((d) => ({
      ...d, reserve: d.reserve + net, event: null, donations: [], expenses: [],
      history: [{ id: uid(), name: event.name, target: event.target, raised, spent, date: today() }, ...d.history],
    }));
    notify(`Settled. ${net >= 0 ? "Added" : "Deducted"} ${inr(Math.abs(net))} ${net >= 0 ? "to" : "from"} reserve`);
    // TODO(supabase): await supabase.rpc('settle_event', { p_event: event.id })
  };

  const tabs = [["pending", `Pending (${data.pending.length})`], ["donation", "Donation"], ["expense", "Expense"], ["event", "New Event"], ["settle", "Settle"]];
  return (
    <div>
      <div className="flex gap-1 overflow-x-auto mb-4 text-sm">
        {tabs.map(([k, l]) => <button key={k} onClick={() => setT(k)} className={`whitespace-nowrap rounded-full px-3 py-1 ${t === k ? "bg-orange-600 text-white" : "bg-slate-100"}`}>{l}</button>)}
        <button onClick={logout} className="ml-auto text-slate-500 px-2">Logout</button>
      </div>

      {t === "pending" && (data.pending.length ? data.pending.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border p-3 mb-2 text-sm">
          <div><p className="font-medium">{p.flat} · {p.name} · {inr(p.amount)}</p><p className="text-xs text-slate-500">UTR {p.utr}</p>
            {p.shot && <img src={p.shot} alt="proof" className="mt-2 h-24 rounded border" />}</div>
          <div className="flex gap-1"><Btn onClick={() => approve(p, true)}><Check size={14} /></Btn><Btn variant="ghost" onClick={() => approve(p, false)}><X size={14} /></Btn></div>
        </div>
      )) : <p className="text-slate-400 text-sm">Queue is empty 🎉</p>)}

      {t === "donation" && (event ? <>
        <Field label="Flat No." value={dn.flat} onChange={(e) => setDn({ ...dn, flat: e.target.value })} />
        <Field label="Name (blank = Anonymous)" value={dn.name} onChange={(e) => setDn({ ...dn, name: e.target.value })} />
        <Field label="Amount (₹)" type="number" value={dn.amount} onChange={(e) => setDn({ ...dn, amount: e.target.value })} />
        <select className="w-full rounded-lg border px-3 py-2 mb-3 text-sm" value={dn.mode} onChange={(e) => setDn({ ...dn, mode: e.target.value })}><option>Cash</option><option>UPI</option></select>
        <Btn className="w-full" disabled={!dn.flat || !(Number(dn.amount) > 0)} onClick={() => { setData((d) => ({ ...d, donations: [...d.donations, { id: uid(), flat: dn.flat, name: dn.name || "Anonymous", amount: Number(dn.amount), mode: dn.mode, status: "Verified", date: today() }] })); setDn({ flat: "", name: "", amount: "", mode: "Cash" }); notify("Donation logged"); }}><Plus size={16} />Log donation</Btn>
      </> : <p className="text-sm text-slate-500">Create an event first.</p>)}

      {t === "expense" && (event ? <>
        <select className="w-full rounded-lg border px-3 py-2 mb-3 text-sm" value={ex.category} onChange={(e) => setEx({ ...ex, category: e.target.value })}>
          {["Pooja", "Catering", "Decoration", "Sound", "Misc"].map((c) => <option key={c}>{c}</option>)}</select>
        <Field label="Description" value={ex.desc} onChange={(e) => setEx({ ...ex, desc: e.target.value })} />
        <Field label="Vendor" value={ex.vendor} onChange={(e) => setEx({ ...ex, vendor: e.target.value })} />
        <Field label="Amount (₹)" type="number" value={ex.amount} onChange={(e) => setEx({ ...ex, amount: e.target.value })} />
        <Field label="Receipt / bill image" type="file" accept="image/*" onChange={async (e) => setEx({ ...ex, receipt: await readFile(e.target.files[0]) })} />
        <Btn className="w-full" disabled={!ex.desc || !(Number(ex.amount) > 0)} onClick={() => { setData((d) => ({ ...d, expenses: [...d.expenses, { id: uid(), category: ex.category, desc: ex.desc, vendor: ex.vendor || "—", amount: Number(ex.amount), date: today(), receipt: ex.receipt }] })); setEx({ category: "Pooja", desc: "", amount: "", vendor: "", receipt: null }); notify("Expense added"); }}><Plus size={16} />Add expense</Btn>
      </> : <p className="text-sm text-slate-500">Create an event first.</p>)}

      {t === "event" && (event ? <p className="text-sm text-slate-500">"{event.name}" is still active. Settle it first.</p> : <>
        <Field label="Event name" value={ev.name} onChange={(e) => setEv({ ...ev, name: e.target.value })} />
        <Field label="Target budget (₹)" type="number" value={ev.target} onChange={(e) => setEv({ ...ev, target: e.target.value })} />
        <Field label="Start date" type="date" value={ev.start} onChange={(e) => setEv({ ...ev, start: e.target.value })} />
        <Field label="End date" type="date" value={ev.end} onChange={(e) => setEv({ ...ev, end: e.target.value })} />
        <Btn className="w-full" disabled={!ev.name || !(Number(ev.target) > 0)} onClick={() => { setData((d) => ({ ...d, event: { id: uid(), name: ev.name, target: Number(ev.target), start: ev.start, end: ev.end } })); notify("Event created"); }}>Create event</Btn>
      </>)}

      {t === "settle" && (event ? (
        <div className="text-sm">
          <p>Raised (verified) <b>{inr(raised)}</b> − Spent <b>{inr(spent)}</b></p>
          <p className="my-2 text-lg font-bold">{raised - spent >= 0 ? "Surplus " : "Deficit "}{inr(Math.abs(raised - spent))}</p>
          <p className="text-slate-500 mb-3">This will {raised - spent >= 0 ? "add it to" : "deduct it from"} the reserve fund and archive the event. Pending payments are not counted.</p>
          <Btn className="w-full" onClick={settle}>Settle {event.name}</Btn>
        </div>
      ) : <p className="text-sm text-slate-500">No active event to settle.</p>)}
    </div>
  );
}
