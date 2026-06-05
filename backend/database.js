const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'database.sqlite');
let db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    db.run("PRAGMA foreign_keys = ON;", (pragmaErr) => {
      if (pragmaErr) {
        console.error("Failed to enable foreign key support:", pragmaErr.message);
      } else {
        console.log("Foreign key support enabled successfully.");
      }
    });
  }
});

// Run migrations / create tables
db.serialize(() => {
  // Accounts
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('bank', 'credit_card', 'cash')) NOT NULL,
      balance REAL DEFAULT 0,
      credit_limit REAL,
      billing_cycle_date INTEGER,
      due_date INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (!err) {
      db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='accounts'", (errSql, row) => {
        if (row && row.sql && !row.sql.includes("'cash'")) {
          console.log("Migrating accounts table to support cash/dompet type...");
          db.serialize(() => {
            db.run("ALTER TABLE accounts RENAME TO accounts_old");
            db.run(`
              CREATE TABLE accounts (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT CHECK(type IN ('bank', 'credit_card', 'cash')) NOT NULL,
                balance REAL DEFAULT 0,
                credit_limit REAL,
                billing_cycle_date INTEGER,
                due_date INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )
            `);
            db.run("INSERT INTO accounts SELECT * FROM accounts_old");
            db.run("DROP TABLE accounts_old");
          });
        }
      });
    }
  });

  // PDF Passwords (for convenience in local environment)
  db.run(`
    CREATE TABLE IF NOT EXISTS pdf_passwords (
      id TEXT PRIMARY KEY,
      bank_name TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Installments
  db.run(`
    CREATE TABLE IF NOT EXISTS installments (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      description TEXT NOT NULL,
      monthly_amount REAL NOT NULL,
      total_months INTEGER NOT NULL,
      remaining_months INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      interest_rate REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);

  // Transactions
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      date TEXT NOT NULL,
      booking_date TEXT,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      is_installment BOOLEAN DEFAULT 0,
      installment_id TEXT,
      note TEXT,
      location_merchant TEXT,
      product_service TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY(installment_id) REFERENCES installments(id) ON DELETE SET NULL
    )
  `, (err) => {
    // Dynamically add columns if table exists but doesn't have them
    db.run("ALTER TABLE transactions ADD COLUMN booking_date TEXT", (alterErr) => {
      // Ignored if column already exists
    });
    db.run("ALTER TABLE transactions ADD COLUMN note TEXT", (alterErr) => {
      // Ignored if column already exists
    });
    db.run("ALTER TABLE transactions ADD COLUMN location_merchant TEXT", (alterErr) => {
      // Ignored if column already exists
    });
    db.run("ALTER TABLE transactions ADD COLUMN product_service TEXT", (alterErr) => {
      // Ignored if column already exists
    });
  });

  // Budgets
  db.run(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      month_year TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(category, month_year)
    )
  `);

  // Transfers
  db.run(`
    CREATE TABLE IF NOT EXISTS transfers (
      id TEXT PRIMARY KEY,
      source_account_id TEXT NOT NULL,
      destination_account_id TEXT NOT NULL,
      amount REAL NOT NULL,
      fee REAL DEFAULT 0,
      date TEXT NOT NULL,
      description TEXT,
      source_transaction_id TEXT,
      destination_transaction_id TEXT,
      fee_transaction_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(source_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY(destination_account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);

  // AI Configuration Setup
  db.run(`
    CREATE TABLE IF NOT EXISTS ai_config (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      api_key TEXT,
      model_name TEXT,
      base_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (!err) {
      db.get("SELECT COUNT(*) as count FROM ai_config", (errCount, row) => {
        if (!errCount && row && row.count === 0) {
          db.run(
            "INSERT INTO ai_config (id, provider, api_key, model_name, base_url) VALUES ('default', 'gemini', '', 'gemini-1.5-flash', '')"
          );
        }
      });
    }
  });

  // Custom Categories
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      parent_id TEXT,
      type TEXT CHECK(type IN ('income', 'expense', 'both')) DEFAULT 'expense',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    // Dynamically add parent_id if table exists but doesn't have it
    db.run("ALTER TABLE categories ADD COLUMN parent_id TEXT", (alterErr) => {
      // Ignored if column already exists
    });

    // Dynamically add type if table exists but doesn't have it
    db.run("ALTER TABLE categories ADD COLUMN type TEXT CHECK(type IN ('income', 'expense', 'both')) DEFAULT 'expense'", (alterErr) => {
      // Ignored if column already exists
    });

    if (!err) {
      db.get('SELECT COUNT(*) as count FROM categories', (errCount, row) => {
        if (!errCount && row && row.count === 0) {
          const defaultCategories = [
            {
              name: 'Food & Dining',
              subs: ['Restaurants', 'Cafe & Coffee', 'Groceries'],
              type: 'expense'
            },
            {
              name: 'Shopping & Groceries',
              subs: ['Clothing', 'Electronics', 'Supermarket'],
              type: 'expense'
            },
            {
              name: 'Utilities',
              subs: ['Electricity & Water', 'Internet & Phone'],
              type: 'expense'
            },
            {
              name: 'Transportation & Travel',
              subs: ['Fuel & Gas', 'Public Transport', 'Flights & Lodging'],
              type: 'expense'
            },
            {
              name: 'Entertainment',
              subs: ['Movies & Streaming', 'Gaming & Hobbies'],
              type: 'expense'
            },
            {
              name: 'Medical & Health',
              subs: ['Pharmacy & Meds', 'Doctor & Clinic'],
              type: 'expense'
            },
            {
              name: 'Credit Card Payment',
              subs: [],
              type: 'both'
            },
            {
              name: 'Transfers & Salary',
              subs: ['Salary & Bonus', 'Investment Income'],
              type: 'both'
            },
            {
              name: 'Fees & Taxes',
              subs: ['Bank Fees', 'Late Fees & Taxes'],
              type: 'expense'
            },
            {
              name: 'Others',
              subs: [],
              type: 'both'
            }
          ];

          db.serialize(() => {
            const stmt = db.prepare('INSERT INTO categories (id, name, parent_id, type) VALUES (?, ?, ?, ?)');
            defaultCategories.forEach(cat => {
              const parentUuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
              stmt.run(parentUuid, cat.name, null, cat.type);

              cat.subs.forEach(sub => {
                const subUuid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                let subType = 'expense';
                if (sub === 'Salary & Bonus' || sub === 'Investment Income') {
                  subType = 'income';
                } else if (cat.type === 'expense') {
                  subType = 'expense';
                } else {
                  subType = cat.type;
                }
                stmt.run(subUuid, sub, parentUuid, subType);
              });
            });
            stmt.finalize();
          });
        }
      });
    }
  });

  // Import Logs
  db.run(`
    CREATE TABLE IF NOT EXISTS import_logs (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      account_id TEXT NOT NULL,
      account_name TEXT NOT NULL,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      transaction_count INTEGER NOT NULL,
      FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);

  // Debts and Receivables
  db.run(`
    CREATE TABLE IF NOT EXISTS debts_receivables (
      id TEXT PRIMARY KEY,
      type TEXT CHECK(type IN ('debt', 'receivable')) NOT NULL,
      person TEXT NOT NULL,
      amount REAL NOT NULL,
      remaining_amount REAL NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      due_date TEXT,
      status TEXT CHECK(status IN ('active', 'paid')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Financial Goals / Target Dana Masa Depan
  db.run(`
    CREATE TABLE IF NOT EXISTS financial_goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_savings REAL DEFAULT 0,
      target_date TEXT NOT NULL,
      recurrence TEXT CHECK(recurrence IN ('one-time', 'monthly', 'semester', 'yearly')) DEFAULT 'one-time',
      category TEXT DEFAULT 'general',
      status TEXT CHECK(status IN ('active', 'achieved', 'cancelled')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Investments / Aset Investasi
  db.run(`
    CREATE TABLE IF NOT EXISTS investments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT CHECK(type IN ('gold', 'stock', 'mutual_fund', 'crypto', 'property', 'deposit', 'bond', 'other')) NOT NULL,
      platform TEXT,
      currency TEXT DEFAULT 'IDR',
      unit TEXT,
      current_units REAL DEFAULT 0,
      current_price_per_unit REAL DEFAULT 0,
      current_value REAL DEFAULT 0,
      total_invested REAL DEFAULT 0,
      account_id TEXT,
      notes TEXT,
      status TEXT CHECK(status IN ('active', 'sold', 'closed')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS investment_transactions (
      id TEXT PRIMARY KEY,
      investment_id TEXT NOT NULL,
      type TEXT CHECK(type IN ('buy', 'sell', 'dividend', 'price_update')) NOT NULL,
      date TEXT NOT NULL,
      units REAL DEFAULT 0,
      price_per_unit REAL DEFAULT 0,
      amount REAL NOT NULL,
      fee REAL DEFAULT 0,
      linked_account_id TEXT,
      linked_transaction_id TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(investment_id) REFERENCES investments(id) ON DELETE CASCADE,
      FOREIGN KEY(linked_account_id) REFERENCES accounts(id) ON DELETE SET NULL
    )
  `);

  // Migration: Add debt_receivable_id to transactions
  db.run("ALTER TABLE transactions ADD COLUMN debt_receivable_id TEXT", (alterErr) => {
    // Ignored if column already exists
  });

  // Self-healing migration to fix broken foreign keys pointing to "accounts_old" due to previous SQLite table rename
  db.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND sql LIKE '%accounts_old%'", (err, row) => {
    if (!err && row && row.count > 0) {
      console.log("Detected broken foreign key references to accounts_old. Repairing schemas...");
      db.serialize(() => {
        db.run("PRAGMA foreign_keys = OFF;");

        // 1. Rebuild installments
        db.run("ALTER TABLE installments RENAME TO installments_old");
        db.run(`
          CREATE TABLE installments (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            description TEXT NOT NULL,
            monthly_amount REAL NOT NULL,
            total_months INTEGER NOT NULL,
            remaining_months INTEGER NOT NULL,
            start_date TEXT NOT NULL,
            interest_rate REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
          )
        `);
        db.run("INSERT INTO installments SELECT * FROM installments_old WHERE account_id IN (SELECT id FROM accounts)");
        db.run("DROP TABLE installments_old");

        // 2. Rebuild transactions
        db.run("ALTER TABLE transactions RENAME TO transactions_old");
        db.run(`
          CREATE TABLE transactions (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            date TEXT NOT NULL,
            booking_date TEXT,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            is_installment BOOLEAN DEFAULT 0,
            installment_id TEXT,
            note TEXT,
            location_merchant TEXT,
            product_service TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            debt_receivable_id TEXT,
            FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            FOREIGN KEY(installment_id) REFERENCES installments(id) ON DELETE SET NULL
          )
        `);
        db.run(`
          INSERT INTO transactions (
            id, account_id, date, booking_date, description, amount, category, 
            is_installment, installment_id, note, location_merchant, product_service, 
            created_at, debt_receivable_id
          ) 
          SELECT 
            id, account_id, date, booking_date, description, amount, category, 
            is_installment, installment_id, note, location_merchant, product_service, 
            created_at, debt_receivable_id 
          FROM transactions_old 
          WHERE account_id IN (SELECT id FROM accounts)
        `);
        db.run("DROP TABLE transactions_old");

        // 3. Rebuild transfers
        db.run("ALTER TABLE transfers RENAME TO transfers_old");
        db.run(`
          CREATE TABLE transfers (
            id TEXT PRIMARY KEY,
            source_account_id TEXT NOT NULL,
            destination_account_id TEXT NOT NULL,
            amount REAL NOT NULL,
            fee REAL DEFAULT 0,
            date TEXT NOT NULL,
            description TEXT,
            source_transaction_id TEXT,
            destination_transaction_id TEXT,
            fee_transaction_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(source_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            FOREIGN KEY(destination_account_id) REFERENCES accounts(id) ON DELETE CASCADE
          )
        `);
        db.run("INSERT INTO transfers SELECT * FROM transfers_old WHERE source_account_id IN (SELECT id FROM accounts) AND destination_account_id IN (SELECT id FROM accounts)");
        db.run("DROP TABLE transfers_old");

        // 4. Rebuild import_logs
        db.run("ALTER TABLE import_logs RENAME TO import_logs_old");
        db.run(`
          CREATE TABLE import_logs (
            id TEXT PRIMARY KEY,
            file_name TEXT NOT NULL,
            account_id TEXT NOT NULL,
            account_name TEXT NOT NULL,
            imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            transaction_count INTEGER NOT NULL,
            FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
          )
        `);
        db.run("INSERT INTO import_logs SELECT * FROM import_logs_old WHERE account_id IN (SELECT id FROM accounts)");
        db.run("DROP TABLE import_logs_old");

        db.run("PRAGMA foreign_keys = ON;", (pragmaErr) => {
          if (!pragmaErr) {
            console.log("Database foreign keys pointing to accounts_old repaired successfully.");
          }
        });
      });
    }
  });
});

// Helper wrapper for DB queries using Promises
const query = {
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },
  
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  exec(sql) {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

function restoreDatabaseFile(tempPath) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database connection:', err.message);
      }
      try {
        fs.copyFileSync(tempPath, dbPath);
        const newDb = new sqlite3.Database(dbPath, (openErr) => {
          if (openErr) {
            reject(openErr);
          } else {
            db = newDb;
            db.run("PRAGMA foreign_keys = ON;", (pragmaErr) => {
              if (pragmaErr) {
                console.error("Failed to enable foreign key support after restore:", pragmaErr.message);
              } else {
                console.log("Foreign key support enabled successfully after restore.");
              }
              resolve();
            });
          }
        });
      } catch (copyErr) {
        reject(copyErr);
      }
    });
  });
}

module.exports = {
  db,
  query,
  restoreDatabaseFile
};
