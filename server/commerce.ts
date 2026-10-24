import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type {
  Collection,
  GroupBuyCampaign,
  SavedItem,
} from "../shared/commerce.js";
import { ApiError } from "./errors.js";
import { sourceOrigin } from "../shared/context.js";

function inspirationKey(item: SaveInput): string | undefined {
  const origin = sourceOrigin(item.sourceOrigin);
  const summary = (item.summary ?? item.label).trim().toLowerCase().replace(/\s+/g, " ");
  return !item.offer && origin && summary ? JSON.stringify([origin, summary]) : undefined;
}
export type SaveInput = Omit<SavedItem, "createdAt" | "tags" | "generation"> & {
  tags?: string[];
  collectionId?: string;
};
export class CommerceStore {
  constructor(
    private db: DatabaseSync,
    private now: () => number = Date.now,
  ) {
    db.exec(`CREATE TABLE IF NOT EXISTS saved_inspiration (id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS inspiration_collections (id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS demo_group_buys (id TEXT PRIMARY KEY,data TEXT NOT NULL);`);
  }
  private read<T>(table: string, id: string): T {
    const row = this.db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(id);
    if (!row)
      throw new ApiError(
        404,
        "ITEM_MISSING",
        "This saved item, collection, or group no longer exists.",
      );
    return JSON.parse(String(row.data)) as T;
  }
  private write(table: string, item: { id: string }): void {
    this.db
      .prepare(
        `INSERT INTO ${table}(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
      )
      .run(item.id, JSON.stringify(item));
  }
  private list<T>(table: string): T[] {
    return this.db
      .prepare(`SELECT data FROM ${table} ORDER BY rowid DESC`)
      .all()
      .map((row) => JSON.parse(String(row.data)) as T);
  }
  getSavedItems(): SavedItem[] {
    return this.list("saved_inspiration");
  }
  getSavedItem(id: string): SavedItem {
    return this.read("saved_inspiration", id);
  }
  saveItem(input: SaveInput): SavedItem {
    if (input.collectionId)
      this.read<Collection>("inspiration_collections", input.collectionId);
    const existing = this.getSavedItems();
    const key = inspirationKey(input);
    const duplicate = key && existing.find((item) => inspirationKey(item) === key);
    // A new popup UUID is a retry of the same saved idea, not new evidence.
    // Return the canonical item so collections and intent events share one identity.
    if (duplicate) {
      if (input.collectionId) this.addToCollection(input.collectionId, duplicate.id);
      return duplicate;
    }
    const previous = existing.find((item) => item.id === input.id);
    const { collectionId, ...data } = input;
    const item: SavedItem = {
      ...data,
      sourceOrigin: sourceOrigin(data.sourceOrigin),
      tags: input.tags ?? [],
      generation: previous?.generation ?? randomUUID(),
      createdAt: previous?.createdAt ?? new Date(this.now()).toISOString(),
    };
    this.write("saved_inspiration", item);
    if (collectionId) this.addToCollection(collectionId, item.id);
    return item;
  }
  removeItem(id: string): void {
    this.db.prepare("DELETE FROM saved_inspiration WHERE id=?").run(id);
    for (const collection of this.getCollections()) {
      collection.itemIds = collection.itemIds.filter((value) => value !== id);
      this.write("inspiration_collections", collection);
    }
  }
  getCollections(): Collection[] {
    return this.list("inspiration_collections");
  }
  createCollection(name: string): Collection {
    const collection = {
      id: randomUUID(),
      name,
      itemIds: [],
      createdAt: new Date(this.now()).toISOString(),
    };
    this.write("inspiration_collections", collection);
    return collection;
  }
  addToCollection(id: string, savedItemId: string): Collection {
    this.getSavedItem(savedItemId);
    const collection = this.read<Collection>("inspiration_collections", id);
    collection.itemIds = [...new Set([...collection.itemIds, savedItemId])];
    this.write("inspiration_collections", collection);
    return collection;
  }
  private evaluate(campaign: GroupBuyCampaign): GroupBuyCampaign {
    const eligible =
      campaign.localPledge &&
      campaign.localPledge.currency === campaign.currency &&
      campaign.localPledge.maxPrice >= campaign.targetPrice
        ? 1
        : 0;
    return {
      ...campaign,
      eligibleParticipants: 2 + eligible,
      state:
        this.now() >= Date.parse(campaign.expiresAt)
          ? "expired"
          : 2 + eligible >= campaign.targetParticipants
            ? "target_reached"
            : "open",
    };
  }
  getCampaigns(): GroupBuyCampaign[] {
    return this.list<GroupBuyCampaign>("demo_group_buys").map((item) =>
      this.evaluate(item),
    );
  }
  getCampaign(id: string): GroupBuyCampaign {
    return this.evaluate(this.read("demo_group_buys", id));
  }
  createCampaign(
    savedItemId: string,
    targetParticipants: number,
    targetPrice: number,
    currency: string,
  ): GroupBuyCampaign {
    const savedItem = this.getSavedItem(savedItemId);
    if (!savedItem.offer)
      throw new ApiError(
        422,
        "PRODUCT_REQUIRED",
        "Save a product before starting a demo group buy.",
      );
    if (savedItem.offer.currency && savedItem.offer.currency !== currency)
      throw new ApiError(
        422,
        "CURRENCY_MISMATCH",
        "Use the saved product’s currency.",
      );
    if (
      targetParticipants !== 3 ||
      !Number.isFinite(targetPrice) ||
      targetPrice <= 0 ||
      !/^[A-Z]{3}$/.test(currency)
    )
      throw new ApiError(
        422,
        "INVALID_GROUP",
        "Use three participants and a positive target price and currency.",
      );
    const existing = this.getCampaigns().find(
      (campaign) =>
        campaign.state !== "expired" &&
        campaign.currency === currency &&
        (campaign.savedItem.id === savedItemId ||
          campaign.savedItem.offer?.id === savedItem.offer?.id),
    );
    if (existing) {
      if (
        existing.targetPrice !== targetPrice ||
        existing.targetParticipants !== targetParticipants
      ) {
        throw new ApiError(
          409,
          "ACTIVE_GROUP_EXISTS",
          "An active demo group already exists for this product. Open Group buys to review its terms.",
        );
      }
      return existing;
    }
    const campaign: GroupBuyCampaign = {
      id: randomUUID(),
      savedItem,
      targetParticipants,
      targetPrice,
      currency,
      syntheticParticipants: 2,
      localPledge: null,
      eligibleParticipants: 2,
      state: "open",
      createdAt: new Date(this.now()).toISOString(),
      expiresAt: new Date(this.now() + 86400000).toISOString(),
      demo: true,
      revision: 0,
    };
    this.write("demo_group_buys", campaign);
    return campaign;
  }
  join(id: string, maxPrice: number, currency: string): GroupBuyCampaign {
    const campaign = this.getCampaign(id);
    if (campaign.state === "expired")
      throw new ApiError(409, "GROUP_EXPIRED", "This demo group has expired.");
    if (currency !== campaign.currency)
      throw new ApiError(422, "CURRENCY_MISMATCH", "Use the group’s currency.");
    if (!Number.isFinite(maxPrice) || maxPrice <= 0)
      throw new ApiError(
        422,
        "INVALID_PRICE",
        "Enter a positive maximum unit price.",
      );
    if (
      campaign.localPledge?.maxPrice !== maxPrice ||
      campaign.localPledge?.currency !== currency
    )
      campaign.revision = (campaign.revision ?? 0) + 1;
    campaign.localPledge = { maxPrice, currency };
    this.write("demo_group_buys", campaign);
    return this.evaluate(campaign);
  }
  leave(id: string): GroupBuyCampaign {
    const campaign = this.getCampaign(id);
    if (campaign.localPledge) campaign.revision = (campaign.revision ?? 0) + 1;
    campaign.localPledge = null;
    this.write("demo_group_buys", campaign);
    return this.evaluate(campaign);
  }
}
