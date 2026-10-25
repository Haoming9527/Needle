import type { ExaResult } from '../../server/providers/live.js';
import { hasIdentifier, matchesModel, publicImageUrl } from '../../server/providers/evidence.js';

export interface CoverageCase { query: string; brandAliases: string[]; modelAliases: string[] }

export const coverageCases: CoverageCase[] = [
  { query: 'Sony WH-1000XM5 headphones product buy', brandAliases: ['Sony', '소니'], modelAliases: ['WH-1000XM5'] },
  { query: 'Fjallraven Kanken backpack product buy', brandAliases: ['Fjallraven', 'Fjällräven', '피엘라벤'], modelAliases: ['Kanken', '칸켄'] },
  { query: 'IKEA TERTIAL work lamp product buy', brandAliases: ['IKEA', '이케아'], modelAliases: ['TERTIAL', '테르티알'] },
  { query: 'Logitech MX Master 3S mouse product buy', brandAliases: ['Logitech', '로지텍'], modelAliases: ['MX Master 3S'] },
  { query: 'LEGO 10329 product buy', brandAliases: ['LEGO', '레고'], modelAliases: ['10329'] },
];

export function hasCoverageEvidence(result: ExaResult, target: CoverageCase): boolean {
  if (!publicImageUrl(result.url)) return false;
  const content = [result.text ?? '', ...(result.highlights ?? [])].join('\n').trim();
  if (!content) return false;
  const evidence = `${result.title}\n${content}`;
  return target.brandAliases.some(brand => hasIdentifier(evidence, brand))
    && target.modelAliases.some(model => matchesModel(evidence, model));
}
