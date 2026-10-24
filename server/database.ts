import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { CartItem, DemoOrder, DemoOrderRequest, Interpretation, Offer, Preferences, SearchResponse, Selection } from '../shared/types.js';
import { sampleCatalog, type SampleProduct } from './catalog.js';
import { ApiError } from './errors.js';
import { hasIdentifier, matchesModel, normalize, publicImageUrl } from './evidence.js';

export interface StoredSession { selection: Selection; interpretation: Interpretation; preferences: Preferences; result: SearchResponse; createdAt: number }
type Row = Record<string, string | number | bigint | null | Uint8Array>;
const parse = <T>(row: Row, key = 'data'): T => JSON.parse(String(row[key])) as T;
const fingerprint = (request: DemoOrderRequest) => createHash('sha256').update(JSON.stringify([request.sessionId, request.offerId, request.variant ?? null, request.cartItemId ?? null, request.quantity ?? 1])).digest('hex');

function variantFor(offer: Offer, variant?: string | null): string | null {
  if (offer.variants.length > 1 && !variant) throw new ApiError(422, 'VARIANT_REQUIRED', 'Choose a variant before continuing.');
  if (variant && !offer.variants.includes(variant)) throw new ApiError(422, 'INVALID_VARIANT', 'Choose one of the available variants.');
  return variant ?? offer.variants[0] ?? null;
}

/** Single-user local storage. No screenshots, credentials, payment data, or browser history are stored. */
export class NeedleDatabase {
  private db: DatabaseSync;
  constructor(path: string = ':memory:', legacyOrderFile?: string | null) {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path === ':memory:' ? path : resolve(path));
    this.db.exec(`PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS catalog (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS cart (id TEXT PRIMARY KEY, item_key TEXT NOT NULL UNIQUE, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS orders (confirmation_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS session_age ON sessions(created_at);`);
    const insert = this.db.prepare('INSERT INTO catalog(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data');
    for (const product of sampleCatalog) insert.run(product.id, JSON.stringify(product));
    this.importLegacyOrders(legacyOrderFile);
  }
  close(): void { this.db.close(); }
  /** Domain stores share this connection and its lifecycle; no independent database copies. */
  get connection(): DatabaseSync { return this.db; }
  catalog(): SampleProduct[] { return this.db.prepare('SELECT data FROM catalog ORDER BY rowid').all().map(row => parse<SampleProduct>(row)); }

  cacheWebOffers(item: Interpretation, offers: Offer[]): Offer[] {
    const find = this.db.prepare('SELECT data FROM catalog WHERE id = ?');
    const insert = this.db.prepare('INSERT INTO catalog(id,data) VALUES (?,?) ON CONFLICT(id) DO NOTHING');
    return offers.map(offer => {
      const referenceUrl = publicImageUrl(offer.referenceUrl);
      if (offer.dataOrigin !== 'sample' || !referenceUrl) return offer;
      const row = find.get(offer.id);
      const existing = row ? parse<SampleProduct>(row) : undefined;
      // Never replace a prepared product or a different source that happens to share an ID.
      if (existing && existing.referenceUrl !== referenceUrl) return offer;
      const product: SampleProduct = existing ?? {
        id: offer.id, title: offer.title,
        brand: item.brand && hasIdentifier(offer.title, item.brand) ? item.brand : '',
        model: item.model && matchesModel(offer.title, item.model) ? item.model : '',
        productType: item.productType,
        color: item.color && hasIdentifier(offer.title, item.color) ? item.color : '',
        attributes: offer.description.trim() ? [offer.description] : [],
        tags: [...new Set([item.productType, ...normalize(offer.title).split(' ').filter(word => word.length > 1)])],
        price: offer.price, currency: offer.currency, variants: offer.variants,
        imageUrl: publicImageUrl(offer.imageUrl) ?? '', referenceUrl,
        ...(offer.priceIsIllustrative !== undefined ? { priceIsIllustrative: offer.priceIsIllustrative } : {}),
        observedAt: offer.observedAt,
      };
      if (!existing) insert.run(product.id, JSON.stringify(product));
      const { priceIsIllustrative: _incomingPriceFlag, ...rest } = offer;
      return {
        ...rest, sourceUrl: null, referenceUrl,
        price: product.price, currency: product.currency, observedAt: product.observedAt ?? offer.observedAt,
        ...(product.priceIsIllustrative !== undefined ? { priceIsIllustrative: product.priceIsIllustrative } : {}),
      };
    });
  }

  saveSession(session: Omit<StoredSession, 'createdAt'>): void {
    const createdAt = Date.now();
    const { text, pageUrl, pageTitle, capturedAt } = session.selection;
    const stored: StoredSession = { ...session, selection: { text, pageUrl, pageTitle, capturedAt }, createdAt };
    this.db.prepare('DELETE FROM sessions WHERE created_at < ?').run(createdAt - 3_600_000);
    this.db.prepare('INSERT INTO sessions(id,created_at,data) VALUES (?,?,?)').run(session.result.sessionId, createdAt, JSON.stringify(stored));
  }
  session(id: string): StoredSession {
    const row = this.db.prepare('SELECT data,created_at FROM sessions WHERE id = ?').get(id);
    if (!row || Date.now() - Number(row.created_at) > 3_600_000) {
      this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
      throw new ApiError(410, 'SESSION_EXPIRED', 'This search has expired. Find the item again before continuing.');
    }
    return parse<StoredSession>(row);
  }
  cart(): CartItem[] { return this.db.prepare('SELECT data FROM cart ORDER BY rowid DESC').all().map(row => parse<CartItem>(row)); }
  private cartItem(id: string): CartItem {
    const row = this.db.prepare('SELECT data FROM cart WHERE id = ?').get(id);
    if (!row) throw new ApiError(404, 'CART_ITEM_MISSING', 'This item is no longer in your cart. Refresh the cart.');
    return parse<CartItem>(row);
  }
  addCart(sessionId: string, offerId: string, variant?: string, quantity = 1): CartItem[] {
    const offer = this.session(sessionId).result.offers.find(value => value.id === offerId);
    if (!offer) throw new ApiError(409, 'OFFER_CHANGED', 'Find this item again before adding it to your cart.');
    const selected = variantFor(offer, variant);
    const key = JSON.stringify([offer.id, selected, offer.price, offer.currency]);
    const previous = this.db.prepare('SELECT data FROM cart WHERE item_key = ?').get(key);
    const item: CartItem = previous ? parse<CartItem>(previous) : { id: randomUUID(), sessionId, offer, variant: selected, quantity: 0, createdAt: new Date().toISOString() };
    item.quantity += quantity;
    if (item.quantity > 99) throw new ApiError(422, 'QUANTITY_LIMIT', 'A cart item can contain up to 99 units.');
    item.sessionId = sessionId;
    item.offer = offer;
    this.db.prepare('INSERT INTO cart(id,item_key,data) VALUES (?,?,?) ON CONFLICT(item_key) DO UPDATE SET data=excluded.data').run(item.id, key, JSON.stringify(item));
    return this.cart();
  }
  removeCart(id: string): CartItem[] { this.db.prepare('DELETE FROM cart WHERE id = ?').run(id); return this.cart(); }
  quantity(id: string, quantity: number): CartItem[] {
    const item = this.cartItem(id); item.quantity = quantity;
    this.db.prepare('UPDATE cart SET data = ? WHERE id = ?').run(JSON.stringify(item), id);
    return this.cart();
  }
  history(): DemoOrder[] { return this.db.prepare('SELECT data FROM orders ORDER BY created_at DESC, rowid DESC').all().map(row => parse<DemoOrder>(row)); }
  previous(request: DemoOrderRequest): DemoOrder | null {
    const row = this.db.prepare('SELECT fingerprint,data FROM orders WHERE confirmation_id = ?').get(request.confirmationId);
    if (!row) return null;
    // Legacy receipts used only these three fields for their confirmation fingerprint.
    const oldFingerprint = createHash('sha256').update(JSON.stringify([request.sessionId, request.offerId, request.variant ?? null])).digest('hex');
    const legacyRequest = !request.cartItemId && (request.quantity === undefined || request.quantity === 1);
    if (row.fingerprint !== fingerprint(request) && !(legacyRequest && row.fingerprint === oldFingerprint)) throw new ApiError(409, 'CONFIRMATION_CONFLICT', 'This confirmation was already used for a different selection. Start a new confirmation.');
    return parse<DemoOrder>(row);
  }
  purchase(request: DemoOrderRequest): { order: DemoOrder; created: boolean } {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.previous(request);
      if (previous) { this.db.exec('COMMIT'); return { order: previous, created: false }; }
      const cart = request.cartItemId ? this.cartItem(request.cartItemId) : null;
      if (cart && (cart.sessionId !== request.sessionId || cart.offer.id !== request.offerId || cart.variant !== (request.variant ?? null) || cart.quantity !== (request.quantity ?? 1))) {
        throw new ApiError(409, 'CART_CHANGED', 'The cart item changed. Review it again before buying.');
      }
      const offer = cart?.offer ?? this.session(request.sessionId).result.offers.find(value => value.id === request.offerId);
      if (!offer) throw new ApiError(409, 'OFFER_CHANGED', 'That offer is not in the reviewed search. Find the item again.');
      const variant = variantFor(offer, request.variant);
      const order: DemoOrder = {
        id: `NDL-${randomUUID().slice(0, 8).toUpperCase()}`, confirmationId: request.confirmationId,
        createdAt: new Date().toISOString(), status: 'simulated', title: offer.title, variant,
        price: offer.price, currency: offer.currency, dataOrigin: offer.dataOrigin,
        quantity: cart?.quantity ?? request.quantity ?? 1, imageUrl: offer.imageUrl,
        message: 'No payment taken. This local purchase is simulated; no order was sent to a retailer.',
      };
      this.db.prepare('INSERT INTO orders(confirmation_id,fingerprint,created_at,data) VALUES (?,?,?,?)').run(request.confirmationId, fingerprint(request), order.createdAt, JSON.stringify(order));
      if (cart) this.db.prepare('DELETE FROM cart WHERE id = ?').run(cart.id);
      this.db.exec('COMMIT');
      return { order, created: true };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private importLegacyOrders(path?: string | null): void {
    if (!path || !existsSync(path) || this.db.prepare("SELECT value FROM metadata WHERE key='legacy_orders_imported'").get()) return;
    const entries: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(entries)) throw new Error('The existing order history is invalid. Preserve the file before repairing it.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      for (const entry of entries) {
        if (!Array.isArray(entry) || typeof entry[0] !== 'string' || typeof entry[1]?.fingerprint !== 'string' || entry[1]?.order?.status !== 'simulated' || entry[1].order.confirmationId !== entry[0]) throw new Error('The existing order history contains an invalid receipt.');
        this.db.prepare('INSERT OR IGNORE INTO orders(confirmation_id,fingerprint,created_at,data) VALUES (?,?,?,?)').run(entry[0], entry[1].fingerprint, entry[1].order.createdAt, JSON.stringify(entry[1].order));
      }
      this.db.prepare("INSERT INTO metadata(key,value) VALUES ('legacy_orders_imported',?)").run(new Date().toISOString());
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}
