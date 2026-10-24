import type { ExaResult } from './live-provider.js';
import { hasIdentifier, isCoupangProductUrl, matchesModel } from './evidence.js';

export interface CoverageCase { query: string; brandAliases: string[]; modelAliases: string[] }

export const coverageCases: CoverageCase[] = [
  { query: 'Sony WH-1000XM5 소니 헤드폰', brandAliases: ['Sony', '소니'], modelAliases: ['WH-1000XM5'] },
  { query: 'Fjallraven Kanken 피엘라벤 칸켄 백팩', brandAliases: ['Fjallraven', 'Fjällräven', '피엘라벤'], modelAliases: ['Kanken', '칸켄'] },
  { query: 'IKEA TERTIAL 이케아 테르티알 작업등', brandAliases: ['IKEA', '이케아'], modelAliases: ['TERTIAL', '테르티알'] },
  { query: 'Logitech MX Master 3S 로지텍 마우스', brandAliases: ['Logitech', '로지텍'], modelAliases: ['MX Master 3S'] },
  { query: 'LEGO 10329 레고', brandAliases: ['LEGO', '레고'], modelAliases: ['10329'] },
];

export function hasCoverageEvidence(result: ExaResult, target: CoverageCase): boolean {
  if (!isCoupangProductUrl(result.url)) return false;
  const content = [result.text ?? '', ...(result.highlights ?? [])].join('\n').trim();
  if (!content) return false;
  const evidence = `${result.title}\n${content}`;
  return target.brandAliases.some(brand => hasIdentifier(evidence, brand))
    && target.modelAliases.some(model => matchesModel(evidence, model));
}
