/** Small, inspectable demo taxonomy. These tags are hypotheses, not user facts. */
export function contextTags(text: string): string[] {
  const tags: string[] = [];
  if (/meal[ -]?prep|batch cook|pack(?:ed|ing)? lunch|lunch recipe|food storage|lunch container/i.test(text)) tags.push('meal-prep');
  if (/(?:cycl|bik).{0,35}(?:commut|work)|(?:commut|work).{0,35}(?:cycl|bik)/i.test(text)) tags.push('cycle-commute');
  if (/podcast|recording|microphone|boom arm/i.test(text)) tags.push('recording');
  if (/headphone|audio|microphone/i.test(text)) tags.push('audio');
  if (/small desk|small.space|compact/i.test(text)) tags.push('small-space');
  if (/portable|leakproof|lunch container/i.test(text)) tags.push('portable');
  return tags;
}

export function sourceOrigin(value?: string): string | undefined {
  try { const url = new URL(value ?? ''); return /^https?:$/.test(url.protocol) ? url.origin : undefined; }
  catch { return undefined; }
}
