const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { generateUUID } = require('./utils/id');
const { DEFAULT_CATEGORIES, subCategoryType } = require('./utils/defaultCategories');

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
      start_date TEXT,
      end_date TEXT,
      recurrence TEXT CHECK(recurrence IN ('monthly', 'weekly', 'none')) DEFAULT 'monthly',
      recurrence_day INTEGER, -- Date of month (1-31) or Day of week (1=Mon, 7=Sun)
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(category, month_year)
    )
  `, (err) => {
    // Add columns dynamically for self-healing migrations
    db.run("ALTER TABLE budgets ADD COLUMN start_date TEXT", (alterErr) => {});
    db.run("ALTER TABLE budgets ADD COLUMN end_date TEXT", (alterErr) => {});
    db.run("ALTER TABLE budgets ADD COLUMN recurrence TEXT CHECK(recurrence IN ('monthly', 'weekly', 'none')) DEFAULT 'monthly'", (alterErr) => {});
    db.run("ALTER TABLE budgets ADD COLUMN recurrence_day INTEGER", (alterErr) => {});
  });

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
  db.run("ALTER TABLE transfers ADD COLUMN balancer_transaction_id TEXT", () => {});
  db.run("ALTER TABLE accounts ADD COLUMN current_bill REAL DEFAULT NULL", () => {});
  db.run("ALTER TABLE accounts ADD COLUMN current_installment_debt REAL DEFAULT NULL", () => {});
  db.run("ALTER TABLE accounts ADD COLUMN available_credit REAL DEFAULT NULL", () => {});

  // Migration: add 'payroll' to accounts type CHECK constraint
  db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='accounts'", (errSql, row) => {
    if (row && row.sql && !row.sql.includes("'payroll'")) {
      console.log("Migrating accounts table to support payroll type...");
      db.serialize(() => {
        db.run("PRAGMA foreign_keys = OFF;");
        db.run("ALTER TABLE accounts RENAME TO accounts_old");
        db.run(`
          CREATE TABLE accounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('bank', 'credit_card', 'cash', 'payroll')),
            balance REAL DEFAULT 0,
            credit_limit REAL,
            billing_cycle_date INTEGER,
            due_date INTEGER,
            current_bill REAL DEFAULT NULL,
            current_installment_debt REAL DEFAULT NULL,
            available_credit REAL DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        db.run(`INSERT INTO accounts SELECT id, name, type, balance, credit_limit, billing_cycle_date, due_date, current_bill, current_installment_debt, available_credit, created_at FROM accounts_old`);
        db.run("DROP TABLE accounts_old");
        db.run("PRAGMA foreign_keys = ON;", () => {
          console.log("Accounts table migrated to support payroll type.");
        });
      });
    }
  });

  // Payroll slips table
  db.run(`
    CREATE TABLE IF NOT EXISTS payroll_slips (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      period TEXT NOT NULL,
      date TEXT NOT NULL,
      gross_income REAL NOT NULL,
      total_deductions REAL NOT NULL,
      net_income REAL NOT NULL,
      destination_account_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
    )
  `);

  // Migration: add payroll_slip_id to transactions
  db.run("ALTER TABLE transactions ADD COLUMN payroll_slip_id TEXT DEFAULT NULL", () => {});

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

    // Dynamically add Eisenhower Matrix fields
    db.run("ALTER TABLE categories ADD COLUMN importance TEXT CHECK(importance IN ('penting', 'tidak_penting')) DEFAULT NULL", (alterErr) => {
      // Ignored if column already exists
    });
    db.run("ALTER TABLE categories ADD COLUMN urgency TEXT CHECK(urgency IN ('mendesak', 'tidak_mendesak')) DEFAULT NULL", (alterErr) => {
      // Ignored if column already exists
    });

    if (!err) {
      db.get('SELECT COUNT(*) as count FROM categories', (errCount, row) => {
        if (!errCount && row && row.count === 0) {
          db.serialize(() => {
            const stmt = db.prepare('INSERT INTO categories (id, name, parent_id, type) VALUES (?, ?, ?, ?)');
            DEFAULT_CATEGORIES.forEach(cat => {
              const parentUuid = generateUUID();
              stmt.run(parentUuid, cat.name, null, cat.type);

              cat.subs.forEach(sub => {
                stmt.run(generateUUID(), sub, parentUuid, subCategoryType(sub, cat.type));
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

  // Migration: add summary columns to import_logs
  db.run("ALTER TABLE import_logs ADD COLUMN total_income REAL DEFAULT 0", () => {});
  db.run("ALTER TABLE import_logs ADD COLUMN total_expense REAL DEFAULT 0", () => {});
  db.run("ALTER TABLE import_logs ADD COLUMN opening_balance REAL", () => {});
  db.run("ALTER TABLE import_logs ADD COLUMN closing_balance REAL", () => {});
  db.run("ALTER TABLE import_logs ADD COLUMN available_credit REAL", () => {});

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

  // Migration: add merchant_name and product_name to installments
  db.run("ALTER TABLE installments ADD COLUMN merchant_name TEXT DEFAULT NULL", () => {});
  db.run("ALTER TABLE installments ADD COLUMN product_name TEXT DEFAULT NULL", () => {});

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

        // Drop any leftover _old tables from a previous failed migration
        db.run("DROP TABLE IF EXISTS installments_old");
        db.run("DROP TABLE IF EXISTS transactions_old");
        db.run("DROP TABLE IF EXISTS transfers_old");
        db.run("DROP TABLE IF EXISTS import_logs_old");

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
            payroll_slip_id TEXT DEFAULT NULL,
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
            balancer_transaction_id TEXT,
            FOREIGN KEY(source_account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            FOREIGN KEY(destination_account_id) REFERENCES accounts(id) ON DELETE CASCADE
          )
        `);
        db.run(`INSERT INTO transfers (id, source_account_id, destination_account_id, amount, fee, date, description, source_transaction_id, destination_transaction_id, fee_transaction_id, created_at, balancer_transaction_id)
          SELECT id, source_account_id, destination_account_id, amount, fee, date, description, source_transaction_id, destination_transaction_id, fee_transaction_id, created_at, balancer_transaction_id
          FROM transfers_old WHERE source_account_id IN (SELECT id FROM accounts) AND destination_account_id IN (SELECT id FROM accounts)`);
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

        // 5. Rebuild investments
        db.run("DROP TABLE IF EXISTS investments_old");
        db.run("ALTER TABLE investments RENAME TO investments_old");
        db.run(`
          CREATE TABLE investments (
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
        db.run("INSERT INTO investments SELECT * FROM investments_old");
        db.run("DROP TABLE investments_old");

        // 6. Rebuild investment_transactions
        db.run("DROP TABLE IF EXISTS investment_transactions_old");
        db.run("ALTER TABLE investment_transactions RENAME TO investment_transactions_old");
        db.run(`
          CREATE TABLE investment_transactions (
            id TEXT PRIMARY KEY,
            investment_id TEXT NOT NULL,
            type TEXT CHECK(type IN ('buy', 'sell', 'dividend', 'price_update')) NOT NULL,
            date TEXT NOT NULL,
            units REAL DEFAULT 0,
            price_per_unit REAL DEFAULT 0,
            amount REAL NOT NULL DEFAULT 0,
            fee REAL DEFAULT 0,
            linked_account_id TEXT,
            linked_transaction_id TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(investment_id) REFERENCES investments(id) ON DELETE CASCADE,
            FOREIGN KEY(linked_account_id) REFERENCES accounts(id) ON DELETE SET NULL
          )
        `);
        // Check whether old table uses 'amount' or 'total_amount' column name
        db.all("PRAGMA table_info(investment_transactions_old)", (pragErr, cols) => {
          const colNames = (cols || []).map(c => c.name);
          const amountCol = colNames.includes('amount') ? 'amount' : 'total_amount';
          db.run(`INSERT INTO investment_transactions (id, investment_id, type, date, units, price_per_unit, amount, notes, created_at)
            SELECT id, investment_id, type, date,
              COALESCE(units, 0),
              COALESCE(price_per_unit, 0),
              COALESCE(${amountCol}, 0),
              notes, created_at
            FROM investment_transactions_old`, (insErr) => {
            if (insErr) console.error("Failed to migrate investment_transactions:", insErr.message);
            db.run("DROP TABLE investment_transactions_old");
          });
        });

        // 7. Fix payroll_slips if it also references accounts_old
        db.run("DROP TABLE IF EXISTS payroll_slips_old");
        db.get("SELECT sql FROM sqlite_master WHERE name='payroll_slips'", (psErr, psRow) => {
          if (psRow && psRow.sql && psRow.sql.includes('accounts_old')) {
            db.serialize(() => {
              db.run("ALTER TABLE payroll_slips RENAME TO payroll_slips_old");
              db.run(`
                CREATE TABLE payroll_slips (
                  id TEXT PRIMARY KEY,
                  account_id TEXT NOT NULL,
                  period TEXT NOT NULL,
                  date TEXT NOT NULL,
                  gross_income REAL NOT NULL,
                  total_deductions REAL NOT NULL,
                  net_income REAL NOT NULL,
                  destination_account_id TEXT,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
                )
              `);
              db.run("INSERT INTO payroll_slips SELECT * FROM payroll_slips_old WHERE account_id IN (SELECT id FROM accounts)");
              db.run("DROP TABLE payroll_slips_old");
            });
          }
        });

        // Finally drop the accounts_old table itself so FK checks no longer fail
        db.run("DROP TABLE IF EXISTS accounts_old", (dropErr) => {
          if (dropErr) {
            console.error("Failed to drop accounts_old:", dropErr.message);
          } else {
            console.log("accounts_old table dropped.");
          }
        });

        db.run("PRAGMA foreign_keys = ON;", (pragmaErr) => {
          if (!pragmaErr) {
            console.log("Database foreign keys pointing to accounts_old repaired successfully.");
          }
        });
      });
    }
  });

  // Safety net: always drop accounts_old if it still exists from a crashed migration.
  // This prevents FK check errors ("no such table: accounts_old") on routes that touch
  // any table with a dangling REFERENCES accounts_old(...) constraint.
  db.run("DROP TABLE IF EXISTS accounts_old", (err) => {
    if (!err) console.log("Safety net: accounts_old cleaned up (no-op if it didn't exist).");
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
  query,
  restoreDatabaseFile,
  dbPath,
  dbDir
};
