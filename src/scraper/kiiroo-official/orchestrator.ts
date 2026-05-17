export type KiirooCollectionSequenceStep = {
  code: string;
  runCrawler: () => Promise<unknown>;
  runCleaner?: () => Promise<unknown>;
};

export type KiirooCollectionSequenceResult = {
  code: string;
  crawlerResult: unknown;
  cleanerResult: unknown;
};

export async function runKiirooCollectionSequence(
  steps: KiirooCollectionSequenceStep[],
): Promise<KiirooCollectionSequenceResult[]> {
  const results: KiirooCollectionSequenceResult[] = [];

  for (const step of steps) {
    const crawlerResult = await step.runCrawler();
    const cleanerResult = step.runCleaner ? await step.runCleaner() : null;

    results.push({
      code: step.code,
      crawlerResult,
      cleanerResult,
    });
  }

  return results;
}
