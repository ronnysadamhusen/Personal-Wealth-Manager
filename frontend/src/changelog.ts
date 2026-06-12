export interface ChangelogEntry {
  version: string;
  date: string;
  highlights?: string;
  changes: {
    type: 'feat' | 'fix' | 'improvement' | 'refactor';
    description: string;
  }[];
}

export const APP_VERSION = '1.1.0';

export const CHANGELOG: ChangelogEntry[] = [
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
