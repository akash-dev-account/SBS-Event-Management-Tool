import { hasSupabase, supabase } from './supabase';
import { mockData } from '../data/mockData';
import { isSafeHttpUrl, isValidImageDataUrl, safeFileName, sanitizeNumber, sanitizeText } from './security';

const today = () => new Date().toISOString().slice(0, 10);
const uid = () => Math.random().toString(36).slice(2, 10);

const normalizeDonation = (row) => ({
  id: row.id,
  flat: sanitizeText(row.flat_no ?? row.flat, 'N/A'),
  residentName: sanitizeText(row.resident_name ?? row.residentName ?? 'Anonymous'),
  amount: sanitizeNumber(row.amount ?? 0, 0),
  mode: sanitizeText(row.mode ?? row.payment_mode ?? 'UPI', 'UPI'),
  status: sanitizeText(row.status ?? 'Verified', 'Verified'),
  date: sanitizeText(row.date ?? row.donated_on ?? row.created_at?.slice(0, 10) ?? today(), today()),
});

const normalizeExpense = (row) => {
  const receiptValue = row.receipt ?? row.receipt_url ?? row.receipt_path ?? row.receiptUrl ?? row.image_url ?? row.img_url ?? '';
  const resolvedReceipt = isSafeHttpUrl(receiptValue) || isValidImageDataUrl(receiptValue) ? receiptValue : '';

  return {
    id: row.id,
    category: sanitizeText(row.category ?? 'Miscellaneous', 'Miscellaneous'),
    description: sanitizeText(row.description ?? row.desc ?? 'Expense', 'Expense'),
    vendor: sanitizeText(row.vendor ?? 'N/A', 'N/A'),
    amount: sanitizeNumber(row.amount ?? 0, 0),
    date: sanitizeText(row.date ?? row.spent_on ?? row.created_at?.slice(0, 10) ?? today(), today()),
    receipt: resolvedReceipt,
    receipt_path: resolvedReceipt,
    receipt_url: resolvedReceipt,
  };
};

const normalizePending = (row) => ({
  id: row.id,
  flat: sanitizeText(row.flat_no ?? row.flat, 'N/A'),
  residentName: sanitizeText(row.resident_name ?? row.residentName ?? 'Anonymous'),
  amount: sanitizeNumber(row.amount ?? 0, 0),
  paymentMode: sanitizeText(row.payment_mode ?? row.mode ?? 'UPI', 'UPI'),
  referenceNo: sanitizeText(row.reference_no ?? row.utr ?? 'N/A', 'N/A'),
  screenshotUrl: isSafeHttpUrl(row.screenshot_url ?? row.screenshot_path ?? row.screenshotPath ?? row.screenshotUrl ?? '')
    || isValidImageDataUrl(row.screenshot_url ?? row.screenshot_path ?? row.screenshotPath ?? row.screenshotUrl ?? '')
    ? row.screenshot_url ?? row.screenshot_path ?? row.screenshotPath ?? row.screenshotUrl ?? ''
    : '',
  status: sanitizeText(row.status ?? 'Pending', 'Pending'),
  isVerified: Boolean(row.is_verified ?? (row.status === 'Verified')),
  submittedAt: sanitizeText(row.submitted_at ?? row.created_at?.slice(0, 10) ?? today(), today()),
});

const normalizeEvent = (row) => ({
  id: row.id,
  name: sanitizeText(row.name, 'Untitled event'),
  target: sanitizeNumber(row.target_budget ?? row.target ?? 0, 0),
  startDate: sanitizeText(row.start_date ?? row.start ?? today(), today()),
  endDate: sanitizeText(row.end_date ?? row.end ?? today(), today()),
  status: sanitizeText(row.status ?? 'active', 'active'),
});

const findPendingPaymentById = async (paymentId) => {
  if (!supabase || !paymentId) return null;

  const { data, error } = await supabase
    .from('pending_payments')
    .select('*')
    .eq('id', paymentId)
    .maybeSingle();

  if (error) {
    console.warn('Pending payment lookup warning:', error);
    return null;
  }

  return data;
};

const isDataUrl = (value) => typeof value === 'string' && value.startsWith('data:image/');
const isHttpUrl = (value) => isSafeHttpUrl(value);

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

    if (bytes.length > 4 * 1024 * 1024) {
      return value;
    }

    const extension = mimeType.includes('png') ? 'png' : mimeType.includes('jpg') || mimeType.includes('jpeg') ? 'jpg' : 'webp';
    const actualBucket = bucketName === 'payment-proofs' ? 'proofs' : bucketName === 'expense-receipts' ? 'receipts' : bucketName;
    const fileName = `${actualBucket}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safeFileName('upload')}.${extension}`;

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
      name: sanitizeText(item.name, 'Past event'),
      target: sanitizeNumber(item.target_budget ?? item.target ?? 0, 0),
      raised: sanitizeNumber(item.total_raised ?? 0, 0),
      spent: sanitizeNumber(item.total_spent ?? 0, 0),
      date: sanitizeText(item.settled_at?.slice(0, 10) ?? today(), today()),
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

const validatePaymentProof = (payload) => {
  const flat = sanitizeText(payload.flat, '');
  const name = sanitizeText(payload.name, '');
  const amount = sanitizeNumber(payload.amount, 0);
  const utr = sanitizeText(payload.utr, '');
  const screenshotUrl = payload.screenshotUrl || '';

  if (!flat || !name || amount <= 0 || utr.length < 8 || !isValidImageDataUrl(screenshotUrl)) {
    return false;
  }

  return true;
};

export async function submitPaymentProof(payload, eventId) {
  if (!hasSupabase || !supabase) {
    return { ok: true };
  }

  try {
    if (!validatePaymentProof(payload)) {
      return { ok: false, error: 'Invalid payment proof payload' };
    }

    const screenshotUrl = await uploadImageToStorage(payload.screenshotUrl || payload.screenshot_path || '', 'payment-proofs');

    const insertPayload = {
      event_id: eventId,
      flat_no: sanitizeText(payload.flat, ''),
      resident_name: sanitizeText(payload.name, ''),
      amount: sanitizeNumber(payload.amount, 0),
      payment_mode: 'UPI',
      utr: sanitizeText(payload.utr, ''),
      reference_no: sanitizeText(payload.utr, ''),
      screenshot_path: isSafeHttpUrl(screenshotUrl) || isValidImageDataUrl(screenshotUrl) ? screenshotUrl : '',
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
    const name = sanitizeText(eventPayload.name, '');
    const target = sanitizeNumber(eventPayload.target, 0);
    const startDate = sanitizeText(eventPayload.startDate, today());
    const endDate = sanitizeText(eventPayload.endDate, today());

    if (!name || target <= 0) {
      return { ok: false, error: 'Invalid event payload' };
    }

    const { data, error } = await supabase.from('events').insert([
      {
        name,
        target_budget: target,
        start_date: startDate,
        end_date: endDate,
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
    const flat = sanitizeText(donationPayload.flat, '');
    const name = sanitizeText(donationPayload.name || 'Anonymous', 'Anonymous');
    const amount = sanitizeNumber(donationPayload.amount, 0);
    const mode = sanitizeText(donationPayload.mode ?? 'UPI', 'UPI');

    if (!flat || amount <= 0 || !['UPI', 'Cash'].includes(mode)) {
      return { ok: false, error: 'Invalid donation payload' };
    }

    const { error } = await supabase.from('donations').insert([
      {
        event_id: donationPayload.eventId,
        flat_no: flat,
        resident_name: name,
        amount,
        mode,
        status: 'Verified',
        utr: sanitizeText(donationPayload.referenceNo ?? '', ''),
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
    const description = sanitizeText(expensePayload.description, '');
    const amount = sanitizeNumber(expensePayload.amount, 0);
    const vendor = sanitizeText(expensePayload.vendor || 'N/A', 'N/A');
    const category = sanitizeText(expensePayload.category || 'Miscellaneous', 'Miscellaneous');

    if (!description || amount <= 0) {
      return { ok: false, error: 'Invalid expense payload' };
    }

    const receiptUrl = await uploadImageToStorage(expensePayload.receipt || '', 'expense-receipts');
    const safeReceipt = isSafeHttpUrl(receiptUrl) || isValidImageDataUrl(receiptUrl) ? receiptUrl : '';

    const { error } = await supabase.from('expenses').insert([
      {
        event_id: expensePayload.eventId,
        category,
        description,
        vendor,
        amount,
        receipt_path: safeReceipt,
        receipt_url: safeReceipt,
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
    if (!paymentId) {
      return { ok: false, error: 'Missing payment id' };
    }

    const paymentToVerify = await findPendingPaymentById(paymentId);

    if (!paymentToVerify) {
      return { ok: false, error: 'Payment not found' };
    }

    if (paymentToVerify.status === 'Verified' || paymentToVerify.is_verified === true) {
      return { ok: false, error: 'Payment already verified' };
    }

    if (shouldVerify) {
      const { data: existingDonation, error: existingError } = await supabase
        .from('donations')
        .select('id')
        .eq('event_id', paymentToVerify.event_id)
        .eq('flat_no', paymentToVerify.flat_no)
        .eq('resident_name', paymentToVerify.resident_name)
        .eq('amount', Number(paymentToVerify.amount))
        .eq('utr', paymentToVerify.utr ?? paymentToVerify.reference_no ?? '')
        .maybeSingle();

      if (existingError) {
        console.warn('Duplicate donation check warning:', existingError);
      }

      if (!existingDonation) {
        const { error: donationError } = await supabase.from('donations').insert([
          {
            event_id: paymentToVerify.event_id,
            flat_no: sanitizeText(paymentToVerify.flat_no ?? '', ''),
            resident_name: sanitizeText(paymentToVerify.resident_name ?? 'Anonymous', 'Anonymous'),
            amount: sanitizeNumber(paymentToVerify.amount ?? 0, 0),
            mode: 'UPI',
            status: 'Verified',
            utr: sanitizeText(paymentToVerify.utr ?? paymentToVerify.reference_no ?? '', ''),
            donated_on: today(),
          },
        ]);

        if (donationError) throw donationError;
      }
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
