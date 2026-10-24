export const appConfig = {
  apartmentName: 'Sri Balaji Serene Apartment',
  adminPassword: import.meta.env.VITE_APP_ADMIN_PASSWORD?.trim() || '',
};

export const UPI_ID = import.meta.env.VITE_UPI_ID?.trim() || 'sribalajiserene@okhdfcbank';

export const mockData = {
  reserveFund: 18500,
  activeEvent: {
    id: 'evt-2026-ganesh',
    name: 'Ganesh Chaturthi 2026',
    target: 50000,
    startDate: '2026-08-20',
    endDate: '2026-09-03',
    status: 'active',
  },
  donations: [
    { id: 'd1', flat: 'A-101', residentName: 'Ramesh Kumar', amount: 2000, mode: 'UPI', status: 'Verified', date: '2026-08-12' },
    { id: 'd2', flat: 'A-204', residentName: 'Anonymous', amount: 1500, mode: 'Cash', status: 'Verified', date: '2026-08-13' },
    { id: 'd3', flat: 'B-302', residentName: 'Lakshmi Devi', amount: 3000, mode: 'UPI', status: 'Verified', date: '2026-08-14' },
    { id: 'd4', flat: 'B-105', residentName: 'Suresh Reddy', amount: 2500, mode: 'UPI', status: 'Verified', date: '2026-08-15' },
    { id: 'd5', flat: 'C-401', residentName: 'Anita Sharma', amount: 1000, mode: 'UPI', status: 'Pending', date: '2026-08-18' },
    { id: 'd6', flat: 'A-110', residentName: 'Resident 1', amount: 2000, mode: 'UPI', status: 'Verified', date: '2026-08-18' },
    { id: 'd7', flat: 'B-112', residentName: 'Resident 2', amount: 2000, mode: 'Cash', status: 'Verified', date: '2026-08-19' },
    { id: 'd8', flat: 'C-215', residentName: 'Resident 3', amount: 2000, mode: 'UPI', status: 'Verified', date: '2026-08-20' },
    { id: 'd9', flat: 'A-330', residentName: 'Anonymous', amount: 2000, mode: 'Cash', status: 'Verified', date: '2026-08-21' },
    { id: 'd10', flat: 'B-444', residentName: 'Resident 4', amount: 2000, mode: 'UPI', status: 'Verified', date: '2026-08-22' },
  ],
  expenses: [
    { id: 'e1', category: 'Pooja', description: 'Idol, flowers & pooja samagri', amount: 9500, vendor: 'Sri Lakshmi Pooja Stores', date: '2026-08-20', receipt: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80' },
    { id: 'e2', category: 'Catering', description: 'Prasadam lunch for 250', amount: 17000, vendor: 'Annapurna Caterers', date: '2026-08-25', receipt: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80' },
    { id: 'e3', category: 'Decoration', description: 'Pandal & lighting', amount: 8000, vendor: 'Shree Decorators', date: '2026-08-19', receipt: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80' },
    { id: 'e4', category: 'Sound', description: 'DJ & speakers (2 days)', amount: 6000, vendor: 'Beat Box Audio', date: '2026-08-24', receipt: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=80' },
  ],
  pendingPayments: [
    { id: 'p1', flat: 'C-210', residentName: 'Mohan Rao', amount: 2000, paymentMode: 'UPI', referenceNo: '412398765012', screenshotUrl: '', status: 'Pending', submittedAt: '2026-08-22' },
  ],
  history: [
    { id: 'h1', name: 'Diwali 2025', target: 40000, raised: 42500, spent: 38200, date: '2025-10-24' },
    { id: 'h2', name: 'New Year 2026', target: 30000, raised: 27500, spent: 31800, date: '2026-01-01' },
    { id: 'h3', name: 'Sankranti 2026', target: 20000, raised: 21000, spent: 19600, date: '2026-01-15' },
  ],
};
