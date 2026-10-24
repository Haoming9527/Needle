import type { IntentSynthesisState } from './synthesis';
import type { IntentCaptureMetadata } from './attention';
export const intentActions = ['dwell', 'revisit', 'save', 'find', 'wishlist', 'cart', 'group_interest'] as const;
export const intentTags = ['meal-prep', 'cycle-commute', 'recording', 'audio', 'small-space', 'portable'] as const;
export type IntentAction = typeof intentActions[number];
export type IntentTag = typeof intentTags[number];
export interface IntentObservationInput {
  capture?: IntentCaptureMetadata;
  id: string; action: IntentAction; sourceOrigin: string; sourceTitle: string; summary: string;
  tags: IntentTag[]; provenance: 'observed' | 'demo_fixture'; entityKey?: string; collectionId?: string;
}
export interface IntentObservation extends IntentObservationInput { createdAt: string }
export type RecommendationKey = 'portable-lunch' | 'home-meal-prep' | 'recording' | 'work-calls' | 'contextual';
export interface IntentConnection {
  why?: string;
  evidenceReasons?: Array<{ observationId: string; reason: string }>;
  observations: Array<{
    capture?: IntentCaptureMetadata;
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
  origin?: { kind: 'model'; model: string; promptVersion: string; evidenceFingerprint: string; productQuery: string };
  connection: IntentConnection;
  id: string; label: string; question: string; interest: 'tentative' | 'confirmed';
  readiness: 'exploring' | 'considering' | 'conditional' | 'ready_to_review';
  evidencePoints: number; evidenceIds: string[]; explanation: string; status: 'active' | 'dismissed';
  constraints?: string; recommendationKey: RecommendationKey;
}
export interface IntentState { synthesis?: IntentSynthesisState; consent: boolean; attentionConsent: boolean; observations: IntentObservation[]; hypotheses: IntentHypothesis[] }
export interface IntentFeedback { action: 'confirm' | 'dismiss' | 'correct'; correction?: 'home-meal-prep' | 'work-calls'; constraints?: string }

/** Binds a suggestion to the currently reviewed need and its supporting observations. */
export function intentSuggestionKey(hypothesis: IntentHypothesis): string {
  return JSON.stringify([hypothesis.id, hypothesis.status, hypothesis.interest,
    hypothesis.recommendationKey, hypothesis.origin ?? null, hypothesis.constraints ?? '',
    hypothesis.connection.observations.map(observation => observation.observationId)]);
}
