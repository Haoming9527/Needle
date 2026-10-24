import type { IntentTag } from './intent';
export const ATTENTION_DWELL_MS = 2000;
export type AttentionSourceId = 'recipe-guide' | 'commute-guide';
export interface DemoAttentionSource {
  id: AttentionSourceId; path: string; targetId: string; title: string; summary: string; tags: IntentTag[];
}
export const DEMO_ATTENTION_SOURCES: Record<AttentionSourceId, DemoAttentionSource> = {
  'recipe-guide': { id: 'recipe-guide', path: '/recipe-demo.html', targetId: 'meal-prep-reading', title: 'Meal preparation guide', summary: 'Spent time on a meal-preparation guide.', tags: ['meal-prep'] },
  'commute-guide': { id: 'commute-guide', path: '/commute-demo.html', targetId: 'commute-reading', title: 'Bicycle commuting guide', summary: 'Spent time on a bicycle-commuting guide.', tags: ['cycle-commute'] },
};
export function attentionSourceForUrl(value: string): DemoAttentionSource | undefined {
  try {
    const url = new URL(value);
    if (!['http://localhost:5173', 'http://127.0.0.1:5173'].includes(url.origin) || url.username || url.password) return undefined;
    return Object.values(DEMO_ATTENTION_SOURCES).find(source => source.path === url.pathname);
  } catch { return undefined; }
}
export interface AttentionCapture {
  id: string; sessionId: string; pageInstanceId: string; sourceId: AttentionSourceId; targetId: string;
  action: 'dwell' | 'revisit'; measurement: { dwellMs: number; visitOrdinal: number };
  capturedAt: string; documentUrl: string;
}
export interface IntentCaptureMetadata {
  method: 'measured_cursor'; environment: 'controlled_demo'; sessionId: string; pageInstanceId: string;
  sourceId: AttentionSourceId; targetId: string; actualOrigin: string; dwellMs: number; visitOrdinal: number; capturedAt: string;
}
