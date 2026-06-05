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

- **Frontend:** React 18, TypeScript, Vite, Vanilla CSS (Custom Glassmorphic design).
- **Backend:** Node.js, Express.js.
- **Database:** SQLite (SQL-based persistence).
- **Libraries & OCR:** Tesseract.js (OCR), PDF.js (PDF parsing).
- **Containerization:** Docker & Docker Compose.

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

#### Backend Setup
```bash
cd backend
npm install
npm run dev
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🔒 Privacy & Security

All PDF statements parsing, receipt scanning, and SQLite databases run **100% locally** on your machine or inside your Docker container. Your sensitive financial statements and credentials never leave your local environment.

---

*Developed with ❤️ as a personal financial command center.*
