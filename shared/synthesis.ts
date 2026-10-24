import type { IntentAction, IntentTag } from './intent';

export const SYNTHESIS_PROMPT_VERSION = 'context-connection-v1';
export const MAX_SYNTHESIS_OBSERVATIONS = 12;

/** Only this bounded projection is sent to the configured model. */
export interface SynthesisObservation {
  id: string;
  sourceKey: string;
  sourceTitle: string;
  summary: string;
  action: IntentAction;
  tags: IntentTag[];
  provenance: 'observed' | 'demo_fixture';
  measurement?: { dwellMs: number; visitOrdinal: number };
}
export interface SynthesisOutput {
  outcome: 'hypothesis' | 'abstain';
  label: string | null;
  need: string | null;
  why: string | null;
  uncertainty: string;
  question: string | null;
  productQuery: string | null;
  evidence: Array<{ observationId: string; reason: string }>;
}
export interface SynthesisSnapshot {
  contextKey: string;
  observations: SynthesisObservation[];
}
export interface IntentSynthesisState {
  available: boolean;
  contextKey: string;
  status: 'idle' | 'ready' | 'abstained' | 'stale';
  model: string;
  promptVersion: string;
  generatedAt?: string;
  correction?: string;
  result?: SynthesisOutput;
  observations: SynthesisObservation[];
}
export interface SynthesisProvider {
  synthesize(snapshot: SynthesisSnapshot, signal: AbortSignal, correction?: string): Promise<SynthesisOutput>;
}
