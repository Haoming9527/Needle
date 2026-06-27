import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { env } from "../config.js";
import { logger } from "../lib/logger.js";
import type { RunNeedleAgentInput } from "../agent/needle-agent.js";
import type { NeedleReport } from "../types/needle.js";
import {
  CREATE_PURCHASE_INTENTS_TABLE,
  CREATE_RESULTS_TABLE,
  CREATE_SEARCHES_TABLE,
  CREATE_SIMULATED_ORDERS_TABLE,
  CREATE_STRIPE_TOPUPS_TABLE,
  CREATE_WALLET_ACCOUNTS_TABLE,
  CREATE_WALLET_LEDGER_ENTRIES_TABLE
} from "./schema.js";

type SearchRow = {
  id: number;
  input_type: string;
  raw_text: string | null;
  product_name: string | null;
  category: string | null;
  confidence: number | null;
  created_at: string;
};

export type LedgerEntryRow = {
  id: number;
  amount_cents: number;
  type: string;
  reference_type: string;
  reference_id: string;
  created_at: string;
};

export type WalletSummary = {
  telegramId: number;
  currency: string;
  availableCents: number;
  recentEntries: LedgerEntryRow[];
};

export type LatestResultRow = {
  id: number;
  title: string;
  url: string;
  source: string | null;
  image_url: string | null;
  price_text: string | null;
  currency: string | null;
  price_value: number | null;
  marketplace: string | null;
  match_confidence: number | null;
  buying_risk: string | null;
  search_created_at: string;
};

export type PurchaseIntentRow = {
  id: number;
  telegram_id: number;
  result_id: number;
  title: string;
  url: string;
  marketplace: string | null;
  amount_cents: number;
  currency: string;
  risk: string | null;
  status: string;
  expires_at_ms: number;
  created_at: string;
};

export type SimulatedOrderRow = {
  id: number;
  telegram_id: number;
  purchase_intent_id: number;
  title: string;
  url: string;
  marketplace: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  receipt_code: string;
  created_at: string;
  voided_at: string | null;
};

let db: Database.Database | undefined;

export function initDb(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = resolve(env.DATABASE_PATH);
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(CREATE_SEARCHES_TABLE);
  db.exec(CREATE_RESULTS_TABLE);
  migrateResultsTable(db);
  db.exec(CREATE_WALLET_ACCOUNTS_TABLE);
  db.exec(CREATE_WALLET_LEDGER_ENTRIES_TABLE);
  db.exec(CREATE_STRIPE_TOPUPS_TABLE);
  db.exec(CREATE_PURCHASE_INTENTS_TABLE);
  db.exec(CREATE_SIMULATED_ORDERS_TABLE);

  logger.debug({ dbPath }, "SQLite database ready");
  return db;
}

export function saveSearch(input: RunNeedleAgentInput, report: NeedleReport): void {
  const database = initDb();

  const insertSearch = database.prepare(`
    INSERT INTO searches (
      telegram_id,
      username,
      input_type,
      raw_text,
      image_file_id,
      product_name,
      category,
      confidence
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const searchResult = insertSearch.run(
    input.telegramId,
    input.username ?? null,
    report.identification.inputType,
    input.text ?? input.url ?? null,
    input.imageFileId ?? null,
    report.identification.likelyProductName,
    report.identification.productCategory,
    report.identification.confidence
  );

  const searchId = Number(searchResult.lastInsertRowid);
  const insertResult = database.prepare(`
    INSERT INTO results (
      search_id,
      title,
      url,
      source,
      image_url,
      price_text,
      currency,
      price_value,
      marketplace,
      match_confidence,
      buying_risk
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = database.transaction(() => {
    for (const candidate of report.candidates) {
      insertResult.run(
        searchId,
        candidate.title,
        candidate.url,
        candidate.source,
        candidate.imageUrl ?? null,
        candidate.priceText ?? null,
        candidate.currency ?? null,
        candidate.priceValue ?? null,
        candidate.marketplace ?? null,
        candidate.matchConfidence,
        candidate.buyingRisk
      );
    }
  });

  insertMany();
}

export function getRecentSearches(telegramId: number, limit = 5): SearchRow[] {
  const database = initDb();

  return database
    .prepare(
      `
      SELECT id, input_type, raw_text, product_name, category, confidence, created_at
      FROM searches
      WHERE telegram_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `
    )
    .all(telegramId, limit) as SearchRow[];
}

export function getWalletSummary(telegramId: number): WalletSummary {
  const database = initDb();
  ensureWalletAccount(database, telegramId);

  const account = database
    .prepare(
      `
      SELECT telegram_id, currency, available_cents
      FROM wallet_accounts
      WHERE telegram_id = ?
    `
    )
    .get(telegramId) as { telegram_id: number; currency: string; available_cents: number };

  const recentEntries = database
    .prepare(
      `
      SELECT id, amount_cents, type, reference_type, reference_id, created_at
      FROM wallet_ledger_entries
      WHERE telegram_id = ?
      ORDER BY id DESC
      LIMIT 5
    `
    )
    .all(telegramId) as LedgerEntryRow[];

  return {
    telegramId: account.telegram_id,
    currency: account.currency,
    availableCents: account.available_cents,
    recentEntries
  };
}

export function recordStripeTopup(input: {
  telegramId: number;
  checkoutSessionId: string;
  paymentIntentId?: string;
  amountCents: number;
  currency: string;
}): { credited: boolean; availableCents: number } {
  const database = initDb();

  return database.transaction(() => {
    ensureWalletAccount(database, input.telegramId, input.currency);

    const existing = database
      .prepare(
        `
        SELECT status
        FROM stripe_topups
        WHERE checkout_session_id = ?
      `
      )
      .get(input.checkoutSessionId) as { status: string } | undefined;

    if (existing?.status === "credited") {
      return {
        credited: false,
        availableCents: getAvailableCents(database, input.telegramId)
      };
    }

    if (!existing) {
      database
        .prepare(
          `
          INSERT INTO stripe_topups (
            telegram_id,
            checkout_session_id,
            payment_intent_id,
            amount_cents,
            currency,
            status,
            credited_at
          )
          VALUES (?, ?, ?, ?, ?, 'credited', CURRENT_TIMESTAMP)
        `
        )
        .run(
          input.telegramId,
          input.checkoutSessionId,
          input.paymentIntentId ?? null,
          input.amountCents,
          input.currency
        );
    } else {
      database
        .prepare(
          `
          UPDATE stripe_topups
          SET status = 'credited',
              payment_intent_id = ?,
              credited_at = CURRENT_TIMESTAMP
          WHERE checkout_session_id = ?
        `
        )
        .run(input.paymentIntentId ?? null, input.checkoutSessionId);
    }

    database
      .prepare(
        `
        UPDATE wallet_accounts
        SET available_cents = available_cents + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE telegram_id = ?
      `
      )
      .run(input.amountCents, input.telegramId);

    insertLedgerEntry(database, {
      telegramId: input.telegramId,
      amountCents: input.amountCents,
      type: "credit",
      referenceType: "stripe_topup",
      referenceId: input.checkoutSessionId,
      metadata: {
        paymentIntentId: input.paymentIntentId,
        currency: input.currency
      }
    });

    return {
      credited: true,
      availableCents: getAvailableCents(database, input.telegramId)
    };
  })();
}

export function getLatestSearchResults(telegramId: number): LatestResultRow[] {
  const database = initDb();

  const latestSearch = database
    .prepare(
      `
      SELECT id
      FROM searches
      WHERE telegram_id = ?
      ORDER BY id DESC
      LIMIT 1
    `
    )
    .get(telegramId) as { id: number } | undefined;

  if (!latestSearch) {
    return [];
  }

  return database
    .prepare(
      `
      SELECT
        r.id,
        r.title,
        r.url,
        r.source,
        r.image_url,
        r.price_text,
        r.currency,
        r.price_value,
        r.marketplace,
        r.match_confidence,
        r.buying_risk,
        s.created_at AS search_created_at
      FROM results r
      JOIN searches s ON s.id = r.search_id
      WHERE r.search_id = ?
      ORDER BY r.match_confidence DESC, r.id ASC
      LIMIT 3
    `
    )
    .all(latestSearch.id) as LatestResultRow[];
}

export function createPurchaseIntent(input: {
  telegramId: number;
  resultId: number;
  amountCents: number;
  currency: string;
  expiresAtMs: number;
}): PurchaseIntentRow {
  const database = initDb();
  const result = database
    .prepare(
      `
      SELECT r.id, r.title, r.url, r.marketplace, r.source, r.buying_risk
      FROM results r
      JOIN searches s ON s.id = r.search_id
      WHERE r.id = ? AND s.telegram_id = ?
    `
    )
    .get(input.resultId, input.telegramId) as
    | {
        id: number;
        title: string;
        url: string;
        marketplace: string | null;
        source: string | null;
        buying_risk: string | null;
      }
    | undefined;

  if (!result) {
    throw new Error("Result not found for this Telegram user.");
  }

  const insert = database
    .prepare(
      `
      INSERT INTO purchase_intents (
        telegram_id,
        result_id,
        title,
        url,
        marketplace,
        amount_cents,
        currency,
        risk,
        status,
        expires_at_ms
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `
    )
    .run(
      input.telegramId,
      result.id,
      result.title,
      result.url,
      result.marketplace ?? result.source,
      input.amountCents,
      input.currency,
      result.buying_risk,
      input.expiresAtMs
    );

  return getPurchaseIntent(Number(insert.lastInsertRowid), input.telegramId);
}

export function getPurchaseIntent(id: number, telegramId: number): PurchaseIntentRow {
  const database = initDb();
  const row = database
    .prepare(
      `
      SELECT *
      FROM purchase_intents
      WHERE id = ? AND telegram_id = ?
    `
    )
    .get(id, telegramId) as PurchaseIntentRow | undefined;

  if (!row) {
    throw new Error("Purchase intent not found.");
  }

  return row;
}

export function confirmPurchaseIntent(input: {
  telegramId: number;
  purchaseIntentId: number;
  nowMs: number;
}): { order: SimulatedOrderRow; availableCents: number } {
  const database = initDb();

  return database.transaction(() => {
    ensureWalletAccount(database, input.telegramId);
    const purchase = getPurchaseIntent(input.purchaseIntentId, input.telegramId);

    if (purchase.status !== "pending") {
      throw new Error(`Purchase intent is ${purchase.status}, not pending.`);
    }

    if (purchase.expires_at_ms < input.nowMs) {
      database
        .prepare("UPDATE purchase_intents SET status = 'expired' WHERE id = ?")
        .run(purchase.id);
      throw new Error("Purchase intent expired. Run /buy again.");
    }

    const availableCents = getAvailableCents(database, input.telegramId);

    if (availableCents < purchase.amount_cents) {
      throw new Error(
        `Insufficient wallet balance. Need ${formatCents(purchase.amount_cents, purchase.currency)}, available ${formatCents(availableCents, purchase.currency)}.`
      );
    }

    database
      .prepare(
        `
        UPDATE wallet_accounts
        SET available_cents = available_cents - ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE telegram_id = ?
      `
      )
      .run(purchase.amount_cents, input.telegramId);

    insertLedgerEntry(database, {
      telegramId: input.telegramId,
      amountCents: -purchase.amount_cents,
      type: "debit",
      referenceType: "simulated_order",
      referenceId: String(purchase.id),
      metadata: {
        title: purchase.title,
        url: purchase.url,
        marketplace: purchase.marketplace
      }
    });

    database
      .prepare(
        `
        UPDATE purchase_intents
        SET status = 'confirmed',
            confirmed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      )
      .run(purchase.id);

    const receiptCode = `SIM-${Date.now()}-${purchase.id}`;
    const orderResult = database
      .prepare(
        `
        INSERT INTO simulated_orders (
          telegram_id,
          purchase_intent_id,
          title,
          url,
          marketplace,
          amount_cents,
          currency,
          status,
          receipt_code
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'placed', ?)
      `
      )
      .run(
        input.telegramId,
        purchase.id,
        purchase.title,
        purchase.url,
        purchase.marketplace,
        purchase.amount_cents,
        purchase.currency,
        receiptCode
      );

    return {
      order: getSimulatedOrder(Number(orderResult.lastInsertRowid), input.telegramId),
      availableCents: getAvailableCents(database, input.telegramId)
    };
  })();
}

export function getRecentSimulatedOrders(
  telegramId: number,
  limit = 5
): SimulatedOrderRow[] {
  const database = initDb();

  return database
    .prepare(
      `
      SELECT *
      FROM simulated_orders
      WHERE telegram_id = ?
      ORDER BY id DESC
      LIMIT ?
    `
    )
    .all(telegramId, limit) as SimulatedOrderRow[];
}

export function voidSimulatedOrder(input: {
  telegramId: number;
  orderId: number;
}): { order: SimulatedOrderRow; availableCents: number } {
  const database = initDb();

  return database.transaction(() => {
    ensureWalletAccount(database, input.telegramId);
    const order = getSimulatedOrder(input.orderId, input.telegramId);

    if (order.status !== "placed") {
      throw new Error(`Order is already ${order.status}.`);
    }

    database
      .prepare(
        `
        UPDATE simulated_orders
        SET status = 'voided',
            voided_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `
      )
      .run(order.id);

    database
      .prepare(
        `
        UPDATE wallet_accounts
        SET available_cents = available_cents + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE telegram_id = ?
      `
      )
      .run(order.amount_cents, input.telegramId);

    insertLedgerEntry(database, {
      telegramId: input.telegramId,
      amountCents: order.amount_cents,
      type: "void_credit",
      referenceType: "simulated_order_void",
      referenceId: String(order.id),
      metadata: {
        receiptCode: order.receipt_code
      }
    });

    return {
      order: getSimulatedOrder(order.id, input.telegramId),
      availableCents: getAvailableCents(database, input.telegramId)
    };
  })();
}

export function formatCents(cents: number, currency = env.WALLET_CURRENCY): string {
  return `${currency.toUpperCase()} ${(cents / 100).toFixed(2)}`;
}

function getSimulatedOrder(id: number, telegramId: number): SimulatedOrderRow {
  const database = initDb();
  const row = database
    .prepare(
      `
      SELECT *
      FROM simulated_orders
      WHERE id = ? AND telegram_id = ?
    `
    )
    .get(id, telegramId) as SimulatedOrderRow | undefined;

  if (!row) {
    throw new Error("Simulated order not found.");
  }

  return row;
}

function ensureWalletAccount(
  database: Database.Database,
  telegramId: number,
  currency = env.WALLET_CURRENCY
): void {
  database
    .prepare(
      `
      INSERT OR IGNORE INTO wallet_accounts (telegram_id, currency, available_cents)
      VALUES (?, ?, 0)
    `
    )
    .run(telegramId, currency);
}

function getAvailableCents(database: Database.Database, telegramId: number): number {
  const row = database
    .prepare("SELECT available_cents FROM wallet_accounts WHERE telegram_id = ?")
    .get(telegramId) as { available_cents: number } | undefined;

  return row?.available_cents ?? 0;
}

function insertLedgerEntry(
  database: Database.Database,
  input: {
    telegramId: number;
    amountCents: number;
    type: string;
    referenceType: string;
    referenceId: string;
    metadata?: Record<string, unknown>;
  }
): void {
  database
    .prepare(
      `
      INSERT INTO wallet_ledger_entries (
        telegram_id,
        amount_cents,
        type,
        reference_type,
        reference_id,
        metadata_json
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      input.telegramId,
      input.amountCents,
      input.type,
      input.referenceType,
      input.referenceId,
      input.metadata ? JSON.stringify(input.metadata) : null
    );
}

function migrateResultsTable(database: Database.Database): void {
  const columns = database
    .prepare("PRAGMA table_info(results)")
    .all() as Array<{ name: string }>;
  const existing = new Set(columns.map((column) => column.name));
  const additions: Array<[string, string]> = [
    ["image_url", "TEXT"],
    ["currency", "TEXT"],
    ["price_value", "REAL"],
    ["marketplace", "TEXT"]
  ];

  for (const [name, type] of additions) {
    if (!existing.has(name)) {
      database.exec(`ALTER TABLE results ADD COLUMN ${name} ${type}`);
    }
  }
}
