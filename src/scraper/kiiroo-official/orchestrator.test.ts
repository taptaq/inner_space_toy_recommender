import test from 'node:test';
import assert from 'node:assert/strict';
import { runKiirooCollectionSequence } from './orchestrator.ts';

test('runKiirooCollectionSequence executes Kiiroo collections in the provided order and runs cleaner after each crawler', async () => {
  const events: string[] = [];

  const result = await runKiirooCollectionSequence([
    {
      code: 'male',
      runCrawler: async () => {
        events.push('crawl:male');
        return ['male-row'];
      },
      runCleaner: async () => {
        events.push('clean:male');
        return ['male-cleaned'];
      },
    },
    {
      code: 'female',
      runCrawler: async () => {
        events.push('crawl:female');
        return ['female-row'];
      },
      runCleaner: async () => {
        events.push('clean:female');
        return ['female-cleaned'];
      },
    },
    {
      code: 'couples',
      runCrawler: async () => {
        events.push('crawl:couples');
        return ['couples-row'];
      },
      runCleaner: async () => {
        events.push('clean:couples');
        return ['couples-cleaned'];
      },
    },
  ]);

  assert.deepEqual(events, [
    'crawl:male',
    'clean:male',
    'crawl:female',
    'clean:female',
    'crawl:couples',
    'clean:couples',
  ]);
  assert.deepEqual(
    result.map((entry) => entry.code),
    ['male', 'female', 'couples'],
  );
});
