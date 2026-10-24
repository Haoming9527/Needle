export type DiscoveryMode = 'sample' | 'live';
export type MatchKind = 'exact' | 'likely' | 'similar';
export interface Selection {
  text?: string;
  imageDataUrl?: string;
  /** Marked copy for vision; the unmarked crop remains the shopper's preview. */
  annotatedImageDataUrl?: string;
  /** Cursor location within the crop, normalized to 0..1 from its top-left. */
  focus?: { x: number; y: number };
  clarifications?: Array<{ question: string; answer: string }>;
  imageUrl?: string;
  pageUrl?: string;
  pageTitle?: string;
  capturedAt?: string;
}
export interface Preferences { budget?: number; currency?: string }
export interface Interpretation {
  identifierEvidence?: 'text' | 'visual';
  name: string;
  productType: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  attributes: string[];
  queries: string[];
  needsClarification: boolean;
  clarification: string | null;
}
export interface Offer {
  referenceUrl?: string;
  priceIsIllustrative?: boolean;
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  sourceUrl: string | null;
  match: MatchKind;
  matchEvidence: string;
  price: number | null;
  currency: string | null;
  observedAt: string;
  dataOrigin: 'sample' | 'retrieved';
  variants: string[];
  shipping: string | null;
  availability: string | null;
  returns: string | null;
  reason: string;
  differences: string[];
}
export interface DiscoverRequest { selection: Selection; preferences?: Preferences; mode?: DiscoveryMode }
export interface RefineRequest { sessionId: string; instruction: string; preferences?: Preferences }
export interface ClarifyRequest { sessionId: string; answer: string; selection: Selection }
export interface ProductDecision {
  status: 'selected' | 'no_match' | 'unavailable' | 'failed';
  offerId?: string;
  model?: string;
}
export interface SearchResponse {
  /** Server-owned attribution to the confirmed need that produced this search. */
  recommendationHypothesisId?: string;
  decision?: ProductDecision;
  discoverySource?: 'catalog' | 'exa';
  webSearch?: { status: 'used' | 'empty' | 'unavailable' | 'failed'; message: string };
  agentMode?: 'ai' | 'catalog';
  sessionId: string;
  mode: DiscoveryMode;
  interpretation: Interpretation;
  offers: Offer[];
  warnings: string[];
}
export interface DemoOrderRequest {
  cartItemId?: string;
  quantity?: number;
  sessionId: string;
  offerId: string;
  variant?: string;
  confirmationId: string;
  confirmed: true;
}
export interface DemoOrder {
  quantity?: number;
  imageUrl?: string | null;
  id: string;
  confirmationId: string;
  createdAt: string;
  status: 'simulated';
  title: string;
  variant: string | null;
  price: number | null;
  currency: string | null;
  dataOrigin: 'sample' | 'retrieved';
  message: string;
}
export interface HealthResponse {
  voiceAvailable?: boolean;
  decisionAvailable?: boolean;
  agentAvailable?: boolean;
  agentMode?: 'ai' | 'catalog';
  database?: 'sqlite';
  status: 'ok';
  defaultMode: DiscoveryMode;
  liveAvailable: boolean;
  missingKeys: string[];
  model: string;
}
export interface ApiError { error: { code: string; message: string; retryable: boolean } }
export interface CapturedSelection {
  result?: SearchResponse;
  intent?: 'buy' | 'cart' | 'find';
  offerId?: string;
  variant?: string;
  id: string;
  selection: Selection;
  screenshotDataUrl?: string;
  needsCrop: boolean;
  error?: string;
}
export interface CartItem {
  id: string;
  sessionId: string;
  offer: Offer;
  variant: string | null;
  quantity: number;
  createdAt: string;
}
export interface CartResponse { items: CartItem[] }
export interface OrderHistoryResponse { orders: DemoOrder[] }
