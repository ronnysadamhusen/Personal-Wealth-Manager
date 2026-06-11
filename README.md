# Personal Wealth Manager (PWM)

A premium, glassmorphism-designed **Personal Financial Management & Investment Tracker** application. It serves as a unified dashboard to manage cash accounts, automatically parse credit card statements, scan paper receipts using OCR, track investments (gold, stocks, mutual funds), and receive AI-driven financial health recommendations.

---

## 🌟 Key Features

- **📈 Investment & Wealth Tracker:** Track gold (Pegadaian), stocks (Bibit/Stockbit), mutual funds, and properties. Monitor real-time net worth, average buy price, current market value, and unrealized gains/losses (ROI %).
- **💳 Automatic BNI Credit Card PDF Statement Parser:** Drag-and-drop your billing statement PDFs (including password-encrypted files) to extract transaction records, calculate installments, and offset balances automatically.
- **📷 OCR Receipt Scanner:** Scan paper receipts in real-time to log transactions instantly using Tesseract.js.
- **🔄 Unified Cash flow Ledger:** Log transactions manually, transfer funds between cash accounts, and link investment purchases directly to deduct cash balances automatically.
- **🤖 AI Financial Health Advisor:** Analyze your spending patterns, track budgets, and receive personalized advice on wealth optimization.
- **🎨 Glassmorphic Dark UI:** Beautiful, harmonized dark mode layout with sleek gradients, smooth micro-interactions, and blurred glass panel aesthetics.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Vanilla CSS (Custom Glassmorphic design).
- **Backend:** Node.js, Express.js.
- **Database:** SQLite (SQL-based persistence).
- **Libraries & OCR:** Tesseract.js (OCR), PDF.js (PDF parsing).
- **Containerization:** Docker & Docker Compose.

---

## 📁 Project Structure

```
backend/
  server.js              # Express entry point: middleware, static serving, router mounting
  database.js            # SQLite connection, schema creation & self-healing migrations
  pdfParser.js           # Bank statement PDF parsers (BCA, Mandiri, BNI, generic)
  middleware/upload.js   # Multer in-memory upload (PDF & backup files)
  utils/                 # generateUUID (crypto), default category seed data
  routes/                # One router per API domain:
    accounts.js  transactions.js  transfers.js  budgets.js  installments.js
    categories.js  pdf.js  ai.js  debtsReceivables.js  goals.js  investments.js  system.js

frontend/src/
  main.tsx               # React entry point
  App.tsx                # Header, navigation & tab switching shell
  constants.ts           # API_URL, category & bank name lists
  utils/format.ts        # IDR currency formatting
  context/AppContext.tsx # Shared state: API data, fetchers, privacy mode, category helpers
  components/            # Icons, AutocompleteInput, TransactionEditModal, SplitTransactionModal
  pages/                 # One component per feature page:
    DashboardPage  AccountsPage  TransactionsPage (+ ImportView, OcrView)
    BudgetsPage  LiabilitiesPage  GoalsPage  InvestmentsPage  AdvisorPage  SettingsPage
```

---

## 🚀 Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed on your machine.
- OR [Node.js v20+](https://nodejs.org/) installed for local development.

### Running with Docker (Recommended)

1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Personal-Wealth-Manager.git
   cd Personal-Wealth-Manager
   ```

2. Build and run the Docker container:
   ```bash
   docker build -t pfm-app .
   docker run -d --name pfm -p 3000:3000 -v "pfm-data:/app/data" pfm-app
   ```

3. Open your browser and navigate to `http://localhost:3000`.

### Local Development Setup

#### Backend Setup (port 3000)
```bash
cd backend
npm install
npm run dev
```

#### Frontend Setup (port 5173, proxies /api to the backend)
```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` for development with hot reload. The Vite dev server forwards all `/api` requests to the backend on port 3000.

To serve the production build directly from the backend instead, run `npm run build` in `frontend/` and copy `frontend/dist/*` into `backend/public/`, then open `http://localhost:3000`.

---

## 🔒 Privacy & Security

All PDF statements parsing, receipt scanning, and SQLite databases run **100% locally** on your machine or inside your Docker container. Your sensitive financial statements and credentials never leave your local environment.

---

*Developed with ❤️ as a personal financial command center.*
