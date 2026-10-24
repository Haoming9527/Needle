import type { DiscoveryMode } from '../shared/types.js';

export interface ServerConfig {
  exaKey: string;
  openAiKey: string;
  model: string;
  defaultMode: DiscoveryMode;
  timeoutMs: number;
  orderFile: string | null;
  databaseFile?: string;
  gatewayKey?: string;
  decisionModel?: string;
  speechModel?: string;
  transcriptionModel?: string;
  speechVoice?: string;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    exaKey: env.EXA_API_KEY?.trim() ?? '',
    openAiKey: env.OPENAI_API_KEY?.trim() ?? '',
    model: env.OPENAI_MODEL?.trim() || 'gpt-5.6-terra',
    defaultMode: env.NEEDLE_MODE === 'live' ? 'live' : 'sample',
    timeoutMs: 45_000,
    orderFile: '.local/demo-orders.json',
    databaseFile: env.DATABASE_PATH?.trim() || '.local/needle.sqlite',
    gatewayKey: env.AI_GATEWAY_API_KEY?.trim() ?? '',
    decisionModel: env.OPENAI_DECISION_MODEL?.trim() || 'gpt-6-luna',
    speechModel: env.OPENAI_TTS_MODEL?.trim() || 'gpt-4o-mini-tts',
    transcriptionModel: env.OPENAI_TRANSCRIBE_MODEL?.trim() || 'gpt-transcribe',
    speechVoice: env.OPENAI_TTS_VOICE?.trim() || 'coral',
  };
}

export function missingKeys(config: ServerConfig): string[] {
  return [!config.exaKey && 'EXA_API_KEY', !agentAvailable(config) && 'OPENAI_API_KEY'].filter((key): key is string => !!key);
}

export function agentAvailable(config: ServerConfig): boolean { return !!(config.openAiKey || config.gatewayKey); }
