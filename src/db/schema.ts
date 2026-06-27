export const CREATE_SEARCHES_TABLE = `
CREATE TABLE IF NOT EXISTS searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL,
  username TEXT,
  input_type TEXT NOT NULL,
  raw_text TEXT,
  image_file_id TEXT,
  product_name TEXT,
  category TEXT,
  confidence REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

export const CREATE_RESULTS_TABLE = `
CREATE TABLE IF NOT EXISTS results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  search_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT,
  image_url TEXT,
  price_text TEXT,
  currency TEXT,
  price_value REAL,
  marketplace TEXT,
  match_confidence REAL,
  buying_risk TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(search_id) REFERENCES searches(id)
);
`;

export const CREATE_WALLET_ACCOUNTS_TABLE = `
CREATE TABLE IF NOT EXISTS wallet_accounts (
  telegram_id INTEGER PRIMARY KEY,
  currency TEXT NOT NULL,
  available_cents INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

export const CREATE_WALLET_LEDGER_ENTRIES_TABLE = `
CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  type TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  metadata_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

export const CREATE_STRIPE_TOPUPS_TABLE = `
CREATE TABLE IF NOT EXISTS stripe_topups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL,
  checkout_session_id TEXT NOT NULL UNIQUE,
  payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  credited_at DATETIME
);
`;

export const CREATE_PURCHASE_INTENTS_TABLE = `
CREATE TABLE IF NOT EXISTS purchase_intents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL,
  result_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  marketplace TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  risk TEXT,
  status TEXT NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  confirmed_at DATETIME,
  FOREIGN KEY(result_id) REFERENCES results(id)
);
`;

export const CREATE_SIMULATED_ORDERS_TABLE = `
CREATE TABLE IF NOT EXISTS simulated_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id INTEGER NOT NULL,
  purchase_intent_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  marketplace TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  receipt_code TEXT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  voided_at DATETIME,
  FOREIGN KEY(purchase_intent_id) REFERENCES purchase_intents(id)
);
`;
