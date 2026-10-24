import type { Offer } from "./types";
export interface SavedItem {
  id: string;
  label: string;
  summary?: string;
  sourceOrigin?: string;
  sourceTitle?: string;
  tags: string[];
  provenance: "observed" | "demo_fixture";
  offer?: Offer;
  createdAt: string;
}
export interface Collection {
  id: string;
  name: string;
  itemIds: string[];
  createdAt: string;
}
export interface GroupBuyCampaign {
  id: string;
  savedItem: SavedItem;
  targetParticipants: number;
  targetPrice: number;
  currency: string;
  syntheticParticipants: 2;
  localPledge: { maxPrice: number; currency: string } | null;
  eligibleParticipants: number;
  state: "open" | "target_reached" | "expired";
  createdAt: string;
  expiresAt: string;
  demo: true;
  revision: number;
}
export interface CommerceSignal {
  type: "save" | "save_remove" | "group_buy_interest" | "group_buy_withdraw";
  eventId: string;
  savedItem: SavedItem;
  campaignId?: string;
}
