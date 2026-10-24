import { hasSupabase, supabase } from './supabase';
import { mockData } from '../data/mockData';

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

const normalizeDonation = (row) => ({
  id: row.id,
  flat: row.flat_no ?? row.flat,
  residentName: row.resident_name ?? row.residentName ?? 'Anonymous',
  amount: Number(row.amount ?? 0),
  mode: row.mode ?? row.payment_mode ?? 'UPI',
  status: row.status ?? 'Verified',
  date: row.date ?? row.donated_on ?? row.created_at?.slice(0, 10) ?? today(),
});

const normalizeExpense = (row) => ({
  id: row.id,
  category: row.category ?? 'Miscellaneous',
  description: row.description ?? row.desc ?? 'Expense',
  vendor: row.vendor ?? 'N/A',
  amount: Number(row.amount ?? 0),
  date: row.date ?? row.spent_on ?? row.created_at?.slice(0, 10) ?? today(),
  receipt: row.receipt ?? row.receipt_url ?? row.receipt_path ?? row.receiptUrl ?? '',
});

const normalizePending = (row) => ({
  id: row.id,
  flat: row.flat_no ?? row.flat,
  residentName: row.resident_name ?? row.residentName ?? 'Anonymous',
  amount: Number(row.amount ?? 0),
  paymentMode: row.payment_mode ?? row.mode ?? 'UPI',
  referenceNo: row.reference_no ?? row.utr ?? 'N/A',
  screenshotUrl: row.screenshot_url ?? row.screenshot_path ?? row.screenshotPath ?? row.screenshotUrl ?? '',
  status: row.status ?? 'Pending',
  isVerified: Boolean(row.is_verified ?? (row.status === 'Verified')),
  submittedAt: row.submitted_at ?? row.created_at?.slice(0, 10) ?? today(),
});

const normalizeEvent = (row) => ({
  id: row.id,
  name: row.name,
  target: Number(row.target_budget ?? row.target ?? 0),
  startDate: row.start_date ?? row.start ?? today(),
  endDate: row.end_date ?? row.end ?? today(),
  status: row.status ?? 'active',
});

const findPendingPaymentById = async (paymentId) => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('pending_payments')
    .select('*')
    .or(`id.eq.${paymentId},id.eq."${paymentId}"`)
    .maybeSingle();

  if (error) {
    console.warn('Pending payment lookup warning:', error);
    return null;
  }

  return data;
};

const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:image/');
const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

async function uploadImageToStorage(value, bucketName) {
  if (!supabase || !value || (!isDataUrl(value) && !isHttpUrl(value))) {
    return value || '';
  }

  if (isHttpUrl(value)) {
    return value;
  }

  try {
    const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return value;

    const mimeType = match[1];
    const base64Data = match[2];
    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const extension = mimeType.includes('png') ? 'png' : mimeType.includes('jpg') || mimeType.includes('jpeg') ? 'jpg' : 'webp';
    const actualBucket = bucketName === 'payment-proofs' ? 'proofs' : bucketName === 'expense-receipts' ? 'receipts' : bucketName;
    const fileName = `${actualBucket}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`;

    const { error } = await supabase.storage.from(actualBucket).upload(fileName, bytes, {
      cacheControl: '3600',
      upsert: false,
      contentType: mimeType,
    });

    if (error) throw error;

    const { data } = supabase.storage.from(actualBucket).getPublicUrl(fileName);
    return data?.publicUrl || value;
  } catch (error) {
    console.warn(`Upload to ${bucketName} failed, falling back to data URL:`, error);
    return value;
  }
}

export async function fetchPortalData() {
  const emptyPortalData = {
    reserveFund: 0,
    activeEvent: null,
    donations: [],
    expenses: [],
    pendingPayments: [],
    history: [],
  };

  if (!hasSupabase || !supabase) {
    return emptyPortalData;
  }

  try {
    const { data: activeEventRow, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'active')
      .maybeSingle();

    if (eventError) throw eventError;

    const activeEvent = activeEventRow ? normalizeEvent(activeEventRow) : null;
    const eventId = activeEvent?.id ?? null;

    const [{ data: donationsData = [] }, { data: expensesData = [] }, { data: pendingData = [] }, { data: reserveData = [] }, { data: historyData = [] }] = await Promise.all([
      supabase
        .from('donations')
        .select('*')
        .order('donated_on', { ascending: false }),
      supabase
        .from('expenses')
        .select('*')
        .order('spent_on', { ascending: false }),
      supabase
        .from('pending_payments')
        .select('*')
        .or('status.eq.Pending,is_verified.eq.false')
        .order('submitted_at', { ascending: false }),
      supabase
        .from('reserve_fund')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('events')
        .select('*')
        .eq('status', 'settled')
        .order('settled_at', { ascending: false }),
    ]);

    const donations = (eventId
      ? donationsData.filter((item) => item.event_id === eventId)
      : donationsData
    ).map(normalizeDonation);

    const expenses = (eventId
      ? expensesData.filter((item) => item.event_id === eventId)
      : expensesData
    ).map(normalizeExpense);

    const pendingPayments = (eventId
      ? pendingData.filter((item) => item.event_id === eventId)
      : pendingData
    ).map(normalizePending);

    const reserveFund = reserveData.reduce((sum, item) => sum + Number(item.delta ?? 0), 0);

    const history = historyData.map((item) => ({
      id: item.id,
      name: item.name,
      target: Number(item.target_budget ?? item.target ?? 0),
      raised: Number(item.total_raised ?? 0),
      spent: Number(item.total_spent ?? 0),
      date: item.settled_at?.slice(0, 10) ?? today(),
    }));

    return {
      reserveFund,
      activeEvent,
      donations,
      expenses,
      pendingPayments,
      history,
    };
  } catch (error) {
    console.error('Supabase load failed; showing empty data state:', error);
    return emptyPortalData;
  }
}

export async function submitPaymentProof(payload, eventId) {
  if (!hasSupabase || !supabase) {
    return { ok: true };
  }

  try {
    const screenshotUrl = await uploadImageToStorage(payload.screenshotUrl || payload.screenshot_path || '', 'payment-proofs');

    const insertPayload = {
      event_id: eventId,
      flat_no: payload.flat,
      resident_name: payload.name,
      amount: Number(payload.amount),
      payment_mode: 'UPI',
      utr: payload.utr,
      reference_no: payload.utr,
      screenshot_path: screenshotUrl,
      status: 'Pending',
      is_verified: false,
      submitted_at: today(),
    };

    const { error } = await supabase.from('pending_payments').insert([insertPayload]);
    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error('submitPaymentProof failed:', error);
    return { ok: false, error };
  }
}

export async function createEventRecord(eventPayload) {
  if (!hasSupabase || !supabase) {
    return { ok: true, data: { id: uid(), ...eventPayload } };
  }

  try {
    const { data, error } = await supabase.from('events').insert([
      {
        name: eventPayload.name,
        target_budget: Number(eventPayload.target),
        start_date: eventPayload.startDate,
        end_date: eventPayload.endDate,
        status: 'active',
      },
    ]).select();

    if (error) throw error;
    return { ok: true, data: data?.[0] ?? null };
  } catch (error) {
    console.error('createEventRecord failed:', error);
    return { ok: false, error };
  }
}

export async function createDonationRecord(donationPayload) {
  if (!hasSupabase || !supabase) {
    return { ok: true };
  }

  try {
    const { error } = await supabase.from('donations').insert([
      {
        event_id: donationPayload.eventId,
        flat_no: donationPayload.flat,
        resident_name: donationPayload.name || 'Anonymous',
        amount: Number(donationPayload.amount),
        mode: donationPayload.mode ?? 'UPI',
        status: 'Verified',
        utr: donationPayload.referenceNo ?? '',
        donated_on: today(),
      },
    ]);

    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error('createDonationRecord failed:', error);
    return { ok: false, error };
  }
}

export async function createExpenseRecord(expensePayload) {
  if (!hasSupabase || !supabase) {
    return { ok: true };
  }

  try {
    const receiptUrl = await uploadImageToStorage(expensePayload.receipt || '', 'expense-receipts');

    const { error } = await supabase.from('expenses').insert([
      {
        event_id: expensePayload.eventId,
        category: expensePayload.category,
        description: expensePayload.description,
        vendor: expensePayload.vendor || 'N/A',
        amount: Number(expensePayload.amount),
        receipt_path: receiptUrl,
        spent_on: today(),
      },
    ]);

    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error('createExpenseRecord failed:', error);
    return { ok: false, error };
  }
}

export async function approvePaymentRecord(paymentId, shouldVerify) {
  if (!hasSupabase || !supabase) {
    return { ok: true };
  }

  try {
    const paymentToVerify = await findPendingPaymentById(paymentId);

    if (shouldVerify && paymentToVerify) {
      const { error: donationError } = await supabase.from('donations').insert([
        {
          event_id: paymentToVerify.event_id,
          flat_no: paymentToVerify.flat_no,
          resident_name: paymentToVerify.resident_name,
          amount: Number(paymentToVerify.amount),
          mode: 'UPI',
          status: 'Verified',
          utr: paymentToVerify.utr ?? paymentToVerify.reference_no ?? '',
          donated_on: today(),
        },
      ]);

      if (donationError) throw donationError;
    }

    const { error } = await supabase
      .from('pending_payments')
      .update({
        status: shouldVerify ? 'Verified' : 'Rejected',
        is_verified: shouldVerify ? true : false,
      })
      .eq('id', paymentId);

    if (error) throw error;
    return { ok: true };
  } catch (error) {
    console.error('approvePaymentRecord failed:', error);
    return { ok: false, error };
  }
}

export async function settleCurrentEvent(event) {
  if (!hasSupabase || !supabase || !event) {
    return { ok: true };
  }

  try {
    const { data: donationsData = [] } = await supabase
      .from('donations')
      .select('amount')
      .eq('event_id', event.id)
      .eq('status', 'Verified');

    const { data: expensesData = [] } = await supabase
      .from('expenses')
      .select('amount')
      .eq('event_id', event.id);

    const raised = donationsData.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const spent = expensesData.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const net = raised - spent;

    const { error } = await supabase.rpc('settle_event', { p_event: event.id });
    if (error) throw error;

    return { ok: true, net, raised, spent };
  } catch (error) {
    console.error('settleCurrentEvent failed:', error);
    return { ok: false, error };
  }
}
