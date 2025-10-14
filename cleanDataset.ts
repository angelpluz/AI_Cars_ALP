import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

import type { RawRecord } from './datasetCleaner';
import { cleanJsonPayload } from './datasetCleaner';

function appendSuffix(path: string, suffix: string): string {
  const lastDot = path.lastIndexOf('.');
  if (lastDot >= 0) {
    return `${path.slice(0, lastDot)}${suffix}${path.slice(lastDot)}`;
  }
  return `${path}${suffix}`;
}

function ensureJson(value: unknown): asserts value is RawRecord | RawRecord[] {
  if (Array.isArray(value)) {
    if (value.every((entry) => entry && typeof entry === 'object')) {
      return;
    }
    throw new Error('When providing an array, every entry must be an object.');
  }
  if (value && typeof value === 'object') {
    return;
  }
  throw new Error('Input JSON must be an object or array of objects.');
}

async function main(): Promise<void> {
  const args = Bun.argv.slice(2);
  let inputArg: string | undefined;
  let outputArg: string | undefined;
  let reviewWithLlm = false;
  let reviewModel = Bun.env.REVIEW_MODEL?.trim() || Bun.env.LARGE_MODEL?.trim() || 'gemma3:27b';

  for (const arg of args) {
    if (arg === '--review') {
      reviewWithLlm = true;
      continue;
    }
    if (arg.startsWith('--model=')) {
      reviewModel = arg.slice('--model='.length).trim() || reviewModel;
      continue;
    }
    if (!inputArg) {
      inputArg = arg;
    } else if (!outputArg) {
      outputArg = arg;
    } else {
      console.warn(`Ignoring extra argument: ${arg}`);
    }
  }

  if (!inputArg) {
    console.error('Usage: bun run cleanDataset.ts <input.json> [output.json]');
    console.error('       bun run cleanDataset.ts <input.json> [output.json] --review [--model=model-name]');
    process.exitCode = 1;
    return;
  }

  const inputPath = resolve(process.cwd(), inputArg);
  const inputDir = dirname(inputPath);
  const baseName = basename(inputPath, '.json');
  const outputPath = outputArg
    ? resolve(process.cwd(), outputArg)
    : resolve(inputDir, `${baseName}${reviewWithLlm ? '.reviewed' : '.cleaned'}.json`);
  const rawFile = await readFile(inputPath, 'utf8');
  const parsed = JSON.parse(rawFile) as unknown;
  ensureJson(parsed);

  const result = await cleanJsonPayload(parsed, { review: reviewWithLlm, model: reviewModel });
  const cleanedString = `${JSON.stringify(result.cleaned, null, 2)}\n`;
  const reviewedString = result.reviewed ? `${JSON.stringify(result.reviewed, null, 2)}\n` : undefined;

  let cleanOnlyPath: string | undefined;
  if (reviewWithLlm && reviewedString) {
    cleanOnlyPath = outputArg
      ? appendSuffix(outputPath, '.clean-only')
      : resolve(inputDir, `${baseName}.cleaned.json`);
    await writeFile(cleanOnlyPath, cleanedString, 'utf8');
    await writeFile(outputPath, reviewedString, 'utf8');
  } else {
    await writeFile(outputPath, cleanedString, 'utf8');
  }

  const summary = result.summary;
  const baseMessage = [
    `Cleaned ${result.recordCount} record(s).`,
    `Removed cookie paragraphs: ${summary.removedCookieParagraphs}`,
    `empty data rows: ${summary.removedEmptyDataRows}`,
    `deduped paragraphs: ${summary.dedupedParagraphs}`,
    `dropped keywords: ${summary.droppedKeywords}.`,
  ].join(' ');

  console.log(baseMessage);
  if (result.modelUsed) {
    console.log(`LLM review requested with model ${result.modelUsed}.`);
  }
  if (reviewWithLlm && reviewedString && cleanOnlyPath) {
    console.log(`Clean-only output written to ${cleanOnlyPath}`);
    console.log(`LLM-reviewed output written to ${outputPath}`);
  } else {
    console.log(`Output written to ${outputPath}`);
  }
}

main().catch((error) => {
  console.error('[cleanDataset] Failed:', error);
  process.exitCode = 1;
});
