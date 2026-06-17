export interface ChangelogEntry {
  version: string;
  date: string;
  highlights?: string;
  changes: {
    type: 'feat' | 'fix' | 'improvement' | 'refactor';
    description: string;
  }[];
}

export const APP_VERSION = '1.8.0';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.8.0',
    date: '2026-06-17',
    highlights: 'Tambah kategori langsung dari proses import PDF — lengkap dengan parent, tipe, kepentingan, dan urgensi.',
    changes: [
      { type: 'feat', description: 'Tombol "➕ Buat Kategori" di header tabel verifikasi import — membuka modal tanpa membatalkan proses import' },
      { type: 'feat', description: 'Modal tambah kategori dari import: mendukung nama, parent kategori, tipe, kepentingan (Eisenhower), dan urgensi' },
      { type: 'improvement', description: 'Kolom checkbox dihapus dari tabel verifikasi — semua transaksi dari PDF langsung diimport tanpa perlu select/deselect' },
      { type: 'improvement', description: 'Tombol Simpan menampilkan total semua transaksi (bukan hanya yang dipilih)' },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-06-16',
    highlights: 'Import PDF per akun: tombol import pindah ke halaman Akun, muncul sebagai popup. Ringkasan tagihan & limit tampil langsung setelah import, beserta summary income/expense/saldo di tabel verifikasi.',
    changes: [
      { type: 'feat', description: 'Tombol Import PDF dipindah ke halaman Akun — satu tombol per akun (bank/CC), membuka popup modal tanpa pindah halaman' },
      { type: 'feat', description: 'Akun sudah terpilih otomatis di popup import sesuai tombol yang diklik, tanpa perlu pilih dropdown' },
      { type: 'feat', description: 'Summary bar di stage verifikasi: menampilkan total pemasukan, pengeluaran, tagihan saat ini, tagihan baru, sisa limit, dan total limit dari PDF secara real-time' },
      { type: 'feat', description: 'Setiap log import menyimpan dan menampilkan total income, total expense, saldo awal, saldo akhir/tagihan, dan sisa limit kartu kredit' },
      { type: 'improvement', description: 'Tabel verifikasi import: Transaction Date & Posting Date tampil sebagai teks, deskripsi + kategori (searchable) + merchant + produk digabung dalam satu kolom' },
      { type: 'improvement', description: 'Kolom Amount rata kanan dengan format pemisah ribuan IDR; kolom Note dan CC Installment disembunyikan untuk tampilan lebih bersih' },
      { type: 'improvement', description: 'Modal import melebar hingga 98vw; indikator duplikat berubah jadi simbol ⚠ inline di depan deskripsi' },
      { type: 'fix', description: 'Password setup di modal import disederhanakan — hanya field password, bank auto-detect dari nama akun' },
    ],
  },
  {
    version: '1.6.2',
    date: '2026-06-16',
    highlights: 'Fix critical: error "no such table: accounts_old" saat simpan transaksi — self-healing migration diperbaiki dan safety net ditambahkan.',
    changes: [
      { type: 'fix', description: 'Self-healing migration kini men-drop tabel accounts_old setelah semua child tables dibangun ulang, mencegah FK check error saat INSERT ke import_logs/transactions' },
      { type: 'fix', description: 'Schema investment_transactions di self-healing diperbarui ke 12 kolom (sesuai schema terkini) dan INSERT menggunakan explicit column names untuk menghindari column count mismatch' },
      { type: 'fix', description: 'Safety net unconditional DROP TABLE IF EXISTS accounts_old ditambahkan di akhir startup — membersihkan sisa crashed migration apapun secara otomatis' },
    ],
  },
  {
    version: '1.6.1',
    date: '2026-06-14',
    highlights: 'Perbaikan dan peningkatan fitur Payroll: parsing lebih akurat, number formatting, category per komponen, dan fix database migration.',
    changes: [
      { type: 'fix', description: 'Parser slip gaji: "Iuran BPJS Pensiun" tidak lagi terlewat — regex diperbaiki agar 2+ spasi selalu jadi delimiter kolom, bukan bagian label' },
      { type: 'feat', description: 'Setiap komponen slip gaji (income & potongan) kini punya dropdown Category untuk pengelompokan analisa keuangan' },
      { type: 'improvement', description: 'Angka nominal di modal review slip gaji diformat id-ID (65.000 bukan 65000) dan rata kanan untuk kemudahan membaca' },
      { type: 'fix', description: 'Self-healing DB migration diperluas: investments, investment_transactions, dan payroll_slips kini ikut diperbaiki saat ada broken FK ke accounts_old' },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-06-14',
    highlights: 'Fitur baru: Akun Payroll untuk mencatat komponen slip gaji dari perusahaan — upload PDF dan AI akan mengekstrak pendapatan, tunjangan, dan potongan secara otomatis.',
    changes: [
      { type: 'feat', description: 'Tipe akun baru "Payroll" — virtual account untuk mencatat gaji kotor, tunjangan, bonus, dan potongan per komponen dari slip gaji perusahaan' },
      { type: 'feat', description: 'Modal Input Slip Gaji: upload PDF terenkripsi → AI extraction komponen pendapatan & potongan → review/edit → simpan & auto-transfer gaji bersih ke rekening bank' },
      { type: 'feat', description: 'Backend route /api/payroll/parse: ekstraksi teks PDF via pdfjs + AI provider yang dikonfigurasi user (Gemini/OpenAI/Ollama/dll)' },
      { type: 'feat', description: 'Backend route /api/payroll/slips: CRUD slip gaji dengan otomatis membuat transaksi per komponen dan transfer gaji bersih ke rekening tujuan' },
      { type: 'feat', description: 'Akun payroll muncul di Dashboard Kas & Tabungan dengan balance bersih (biasanya 0 setelah transfer gaji)' },
    ],
  },
  {
    version: '1.5.1',
    date: '2026-06-13',
    highlights: 'Dashboard CC Debt kini konsisten dengan halaman Accounts — pakai tagihan PDF bukan akumulasi transaksi.',
    changes: [
      { type: 'fix', description: 'Dashboard: nilai hutang kartu kredit per-kartu dan Total CC Debt kini pakai current_bill dari PDF statement jika tersedia, bukan current_balance akumulasi transaksi' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-06-13',
    highlights: 'Setelah import PDF tetap di halaman Transactions, dan Sisa Kredit Limit BCA kini diambil langsung dari PDF — tidak ada lagi selisih akibat TUNGGAKAN atau komponen tersembunyi.',
    changes: [
      { type: 'fix', description: 'Setelah import PDF berhasil, aplikasi tidak lagi berpindah ke Dashboard — tetap di halaman Transactions (tab Ledger)' },
      { type: 'fix', description: 'Available Credit Limit BCA CC kini diambil langsung dari nilai SISA KREDIT LIMIT di PDF, menghindari selisih akibat TUNGGAKAN dan komponen lain yang BCA hitung sendiri' },
      { type: 'feat', description: 'Parser BCA CC menangkap field SISA KREDIT LIMIT (V7) dari tabel kredit PDF dan menyimpannya sebagai available_credit di database' },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-06-13',
    highlights: 'Parser BCA CC diperbaiki menyeluruh — Current Balance, Available Credit Limit, dan Installment Debt kini sinkron persis dengan nilai di PDF e-statement.',
    changes: [
      { type: 'fix', description: 'Current Balance kartu kredit menampilkan TAGIHAN BARU langsung dari PDF, bukan kalkulasi rolling transaksi' },
      { type: 'fix', description: 'Available Credit Limit dihitung dari KREDIT LIMIT − TAGIHAN BARU − SISA TAGIHAN CICILAN, floor ke 0 (sesuai perilaku BCA)' },
      { type: 'fix', description: 'Installment Debt menampilkan SISA TAGIHAN CICILAN langsung dari PDF (current_installment_debt), bukan kalkulasi rolling' },
      { type: 'fix', description: 'billingMatch dijalankan pada teks asli sebelum preprocessing agar statementDate tidak gagal diekstrak' },
      { type: 'fix', description: 'Transaksi di batas halaman PDF tidak lagi terlewat — page marker stripped sebelum regex berjalan' },
      { type: 'feat', description: 'Batch import multi-PDF: current_bill selalu diambil dari statement terbaru berdasarkan statementDate, bukan urutan filename' },
      { type: 'feat', description: 'Transaksi hasil batch import diurutkan berdasarkan tanggal, bukan urutan file dipilih' },
    ],
  },
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
