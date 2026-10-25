import 'dotenv/config';
import { getConfig } from '../server/config.js';
import { exaSearch } from '../server/providers/live.js';
import { coverageCases, hasCoverageEvidence } from './lib/coverage.js';

const config = getConfig();
if (!config.exaKey) {
  console.error('EXA_API_KEY is missing. Add it to the local .env file, then rerun npm run check:coverage. Use explicit sample mode until coverage passes.');
  process.exitCode = 1;
} else {
  let passed = 0;
  for (const target of coverageCases) {
    const { query } = target;
    try {
      const results = await exaSearch(query, config, AbortSignal.timeout(30_000));
      const useful = results.filter(result => hasCoverageEvidence(result, target));
      if (useful.length) passed++;
      console.log(`${useful.length ? 'PASS' : 'FAIL'} ${query}: ${useful.length} public product references with identity evidence`);
      for (const source of useful.slice(0, 2)) console.log(`  ${source.title}\n  ${source.url}`);
    } catch (error) { console.log(`FAIL ${query}: ${error instanceof Error ? error.message : 'Request failed'}`); }
  }
  console.log(`\nCoverage: ${passed}/5. ${passed >= 3 ? 'Web-discovery gate passed. Review original stores and source quality; this check does not verify prices or stock.' : 'Insufficient web coverage. Refine queries; do not silently substitute samples for live results.'}`);
  if (passed < 3) process.exitCode = 1;
}
