export const intentActions = ['dwell', 'revisit', 'save', 'find', 'wishlist', 'cart', 'group_interest'] as const;
export const intentTags = ['meal-prep', 'cycle-commute', 'recording', 'audio', 'small-space', 'portable'] as const;
export type IntentAction = typeof intentActions[number];
export type IntentTag = typeof intentTags[number];
export interface IntentObservationInput {
  id: string; action: IntentAction; sourceOrigin: string; sourceTitle: string; summary: string;
  tags: IntentTag[]; provenance: 'observed' | 'demo_fixture'; entityKey?: string; collectionId?: string;
}
export interface IntentObservation extends IntentObservationInput { createdAt: string }
export type RecommendationKey = 'portable-lunch' | 'home-meal-prep' | 'recording' | 'work-calls';
export interface IntentConnection {
  observations: Array<{
    observationId: string;
    sourceTitle: string;
    action: IntentAction;
    summary: string;
    provenance: 'observed' | 'demo_fixture';
  }>;
  inferredNeed: {
    text: string;
    basis: 'hypothesis' | 'user_confirmed' | 'user_corrected';
  };
  uncertainty: string;
  question: string;
  productRationale?: string;
}
export interface IntentHypothesis {
  connection: IntentConnection;
  id: string; label: string; question: string; interest: 'tentative' | 'confirmed';
  readiness: 'exploring' | 'considering' | 'conditional' | 'ready_to_review';
  evidencePoints: number; evidenceIds: string[]; explanation: string; status: 'active' | 'dismissed';
  constraints?: string; recommendationKey: RecommendationKey;
}
export interface IntentState { consent: boolean; observations: IntentObservation[]; hypotheses: IntentHypothesis[] }
export interface IntentFeedback { action: 'confirm' | 'dismiss' | 'correct'; correction?: 'home-meal-prep' | 'work-calls'; constraints?: string }
