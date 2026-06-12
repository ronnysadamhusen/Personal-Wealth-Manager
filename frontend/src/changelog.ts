export interface ChangelogEntry {
  version: string;
  date: string;
  highlights?: string;
  changes: {
    type: 'feat' | 'fix' | 'improvement' | 'refactor';
    description: string;
  }[];
}

export const APP_VERSION = '1.3.0';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.3.0',
    date: '2026-06-12',
    highlights: 'Transfer historis tanpa counterpart kini bisa ditandai otomatis — sistem buat transaksi counterpart dan balancer agar saldo tidak berubah.',
    changes: [
      { type: 'feat', description: 'Pembayaran kartu kredit (kategori Credit Card Payment & Transfers & Salary) otomatis muncul sebagai suspect transfer ⚡ meski belum ada data mutasi rekening lawan' },
      { type: 'feat', description: 'Auto-create counterpart: saat konversi ke transfer tanpa counterpart yang ada, pilih akun asal dan sistem buat 2 transaksi (outflow + balancer income) agar saldo akun tidak berubah' },
      { type: 'feat', description: 'Tipe Transfer di modal Add & Edit Transaction: bisa buat transfer baru atau konversi transaksi bestisting langsung dari edit modal' },
      { type: 'improvement', description: 'Balancer income otomatis dikecualikan dari agregasi income/expense (is_transfer=1) via JOIN ke kolom balancer_transaction_id di tabel transfers' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-06-12',
    highlights: 'Deteksi otomatis transaksi transfer antar akun — tandai, konversi, dan filter dengan mudah.',
    changes: [
      { type: 'feat', description: 'Deteksi otomatis transaksi yang kemungkinan transfer — badge ⚡ Transfer? muncul jika ada counterpart yang cocok di akun lain' },
      { type: 'feat', description: 'Modal konversi transfer: pilih counterpart, konfirmasi, dan transaksi langsung terlink sebagai transfer' },
      { type: 'feat', description: 'Badge 🔁 Transfer to/from [nama akun] pada transaksi yang sudah terlink sebagai transfer' },
      { type: 'feat', description: 'Filter Tipe (Income / Expense / Transfer) di panel Search & Filters' },
      { type: 'fix', description: 'Total Income, Expense, dan Net Cash Flow tidak lagi menghitung transaksi bertipe transfer' },
      { type: 'improvement', description: 'Tag Kepentingan & Urgensi di Manage Categories diubah ke dropdown select' },
      { type: 'improvement', description: 'Popup edit kategori transaksi: transaksi yang dipindah langsung menghilang dari list' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-06-12',
    highlights: 'Manage Categories mendapat peningkatan besar: jumlah transaksi, tag matriks Eisenhower, dan popup daftar transaksi per kategori.',
    changes: [
      { type: 'feat', description: 'Kolom jumlah transaksi di tabel Manage Categories — klik angka untuk lihat daftarnya' },
      { type: 'feat', description: 'Popup daftar transaksi per kategori dengan kemampuan ganti kategori langsung dari dalam popup' },
      { type: 'feat', description: 'Tag Kepentingan & Urgensi (Matriks Eisenhower) tampil di kolom terpisah, bisa diklik untuk cycle state' },
      { type: 'improvement', description: 'Tombol Actions di Manage Categories dirapikan jadi button group konsisten' },
      { type: 'improvement', description: 'Badge DEV di header untuk membedakan environment dev vs production' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-06',
    highlights: 'Rilis pertama Personal Wealth Manager dengan arsitektur modular.',
    changes: [
      { type: 'feat', description: 'Dashboard dengan ringkasan keuangan, saldo, dan indikator bulan ke bulan' },
      { type: 'feat', description: 'Manajemen akun bank dan kartu kredit' },
      { type: 'feat', description: 'Ledger transaksi dengan import PDF mutasi bank (BNI, BCA, Mandiri, dll)' },
      { type: 'feat', description: 'Budgets dengan tracking pengeluaran per kategori' },
      { type: 'feat', description: 'Pencatatan utang & piutang (Liabilities)' },
      { type: 'feat', description: 'Goals & investasi' },
      { type: 'feat', description: 'AI Advisor untuk analisis keuangan (Gemini, OpenAI, Ollama, dll)' },
      { type: 'feat', description: 'Manajemen kategori dengan hierarki parent-subcategory' },
      { type: 'feat', description: 'Privacy mode: blur, hover-to-reveal, dan display all' },
      { type: 'feat', description: 'Backup & restore database SQLite' },
      { type: 'refactor', description: 'Arsitektur modular: backend route terpisah, frontend halaman terpisah' },
    ],
  },
];
